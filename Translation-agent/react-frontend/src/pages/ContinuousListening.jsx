import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useSpeech } from '../hooks/useSpeech';
import * as api from '../services/api';
import { getLabels } from '../services/uiLabels';
import {
  Ear, Square, Loader2, Copy, Check, Download, Volume2,
  Languages, ChevronDown, Sparkles, Hash, Wand2, BookmarkPlus,
  Mail, Slack, Linkedin, MessageSquare, X, Send, ExternalLink,
  AlignLeft, ClipboardList, HelpCircle, Link, ChevronUp,
  ChevronDown as ChevronDownIcon, ArrowLeftRight, Globe2,
  BarChart2, BookOpen, Smile, Frown, Minus, Users, Play, Pause
} from 'lucide-react';

const SILENCE_THRESHOLD = 10;
const SILENCE_DURATION = 2000;
const TONE_OPTIONS = ['Email Formal', 'Email Casual', 'Slack', 'LinkedIn', 'WhatsApp Business', 'Custom'];
const TONE_TO_CHANNELS = {
  'Email Formal': ['email'], 'Email Casual': ['email'],
  'Slack': ['slack'], 'LinkedIn': ['linkedin'],
  'WhatsApp Business': ['whatsapp'], 'Custom': ['email', 'slack', 'linkedin', 'whatsapp'],
};
const CHANNELS = [
  { id: 'email',    label: 'Email',    icon: Mail,          color: 'text-blue-500',   bg: 'bg-blue-50',   border: 'border-blue-100'   },
  { id: 'slack',    label: 'Slack',    icon: Slack,         color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-100' },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin,      color: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-100'    },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: 'text-green-500',  bg: 'bg-green-50',  border: 'border-green-100'  },
];

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={copy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 text-[13px] font-medium transition-all">
      {copied ? <><Check className="w-3.5 h-3.5 text-green-500" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
    </button>
  );
}

function SpeakBtn({ onClick, isPlaying, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-all disabled:opacity-30 ${isPlaying ? 'bg-red-50 text-red-500 border-red-200' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'}`}>
      {isPlaying ? <><Square className="w-3.5 h-3.5 fill-red-500" />Stop</> : <><Volume2 className="w-3.5 h-3.5" />Speak</>}
    </button>
  );
}

function SentimentBadge({ sentiment, score }) {
  if (!sentiment) return null;
  const map = {
    positive: { icon: Smile, color: 'text-green-600 bg-green-50 border-green-100' },
    neutral:  { icon: Minus, color: 'text-gray-500 bg-gray-50 border-gray-200' },
    negative: { icon: Frown, color: 'text-red-500 bg-red-50 border-red-100' },
  };
  const { icon: Icon, color } = map[sentiment] || map.neutral;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${color}`}>
      <Icon className="w-3 h-3" />{sentiment} · {score}%
    </span>
  );
}

function ChannelModal({ channel, text, onClose }) {
  const { state } = useApp();
  const navigate = useNavigate();
  const creds = state.channelCredentials || {};
  const [toEmail, setToEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [errMsg, setErrMsg] = useState('');
  const hasCredentials = { email: true, slack: !!creds.slackWebhook?.trim(), linkedin: true, whatsapp: !!creds.whatsappPhone?.trim() }[channel.id];
  const goToProfile = () => { onClose(); navigate('/app/profile'); };
  const handleSend = async () => {
    setStatus('sending');
    try {
      if (channel.id === 'email') { window.open('mailto:' + toEmail.trim() + '?subject=' + encodeURIComponent('Message from SeedlingSpeaks') + '&body=' + encodeURIComponent(text), '_blank'); setStatus('ok'); return; }
      if (channel.id === 'slack') await api.sendToSlack({ text, webhookUrl: creds.slackWebhook });
      if (channel.id === 'linkedin') await api.shareToLinkedIn({ text });
      if (channel.id === 'whatsapp') { window.open('https://wa.me/' + creds.whatsappPhone.replace(/\D/g, '') + '?text=' + encodeURIComponent(text), '_blank'); setStatus('ok'); return; }
      setStatus('ok');
    } catch (e) { setErrMsg(e.message || 'Failed'); setStatus('err'); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={'w-9 h-9 rounded-xl ' + channel.bg + ' ' + channel.border + ' border flex items-center justify-center'}>
              <channel.icon className={'w-4 h-4 ' + channel.color} />
            </div>
            <p className="text-[15px] font-bold text-gray-900">Send via {channel.label}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        {!hasCredentials ? (
          <div className="text-center py-4">
            <p className="text-[14px] text-gray-500 mb-4">No {channel.label} credentials saved.</p>
            <button onClick={goToProfile} className="flex items-center gap-2 mx-auto bg-gray-900 text-white rounded-xl px-5 py-2.5 text-[13px] font-semibold hover:bg-gray-700 transition-all"><ExternalLink className="w-3.5 h-3.5" />Go to Profile</button>
          </div>
        ) : (
          <div>
            <div className="mb-4 px-4 py-3 rounded-xl border border-amber-100 bg-amber-50 text-[13px] text-gray-700 max-h-40 overflow-y-auto whitespace-pre-wrap">{text.slice(0, 400)}{text.length > 400 ? '…' : ''}</div>
            {channel.id === 'email' && <div className="mb-4"><label className="block text-[12px] font-semibold text-gray-500 mb-1.5">To email</label><input type="email" value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="recipient@example.com" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-[14px] focus:outline-none focus:border-gray-400 transition-all" /></div>}
            {status === 'ok' && <div className="mb-4 px-4 py-2.5 bg-green-50 border border-green-100 rounded-xl text-[13px] text-green-700 flex items-center gap-2"><Check className="w-4 h-4" />Sent successfully</div>}
            {status === 'err' && <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">{errMsg}</div>}
            <div className="flex items-center justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-[13px] font-medium text-gray-500 hover:bg-gray-100">Cancel</button>
              {status !== 'ok' && <button onClick={handleSend} disabled={status === 'sending' || (channel.id === 'email' && !toEmail.trim())} className={'flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40 ' + (channel.id === 'whatsapp' ? 'bg-green-500' : channel.id === 'linkedin' ? 'bg-sky-600' : channel.id === 'slack' ? 'bg-purple-600' : 'bg-blue-600')}>{status === 'sending' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}{(channel.id === 'email' || channel.id === 'whatsapp') ? <ExternalLink className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}Send</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ContinuousListening() {
  const { state, setFields, TARGET_LANGUAGES, showError, showSuccess, addHistory, saveTemplates, incrementUsage } = useApp();
  const L = getLabels(state.uiLanguage);
  const { isPlaying, speak } = useSpeech();

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [amplitude, setAmplitude] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const animFrameRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);

  const [transcript, setTranscript] = useState('');
  const [nativeTranslation, setNativeTranslation] = useState('');
  const [rewrittenText, setRewrittenText] = useState('');
  const [selectedTone, setSelectedTone] = useState(null);
  const [customToneInput, setCustomToneInput] = useState('');
  const [sentiment, setSentiment] = useState(null);
  const [summary, setSummary] = useState('');
  const [meetingNotes, setMeetingNotes] = useState(null);
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');
  const [backTranslation, setBackTranslation] = useState(null);
  const [toneConfidence, setToneConfidence] = useState(null);
  const [readability, setReadability] = useState(null);
  const [multiLangs, setMultiLangs] = useState([]);
  const [multiResults, setMultiResults] = useState({});
  const [shareLink, setShareLink] = useState('');
  const [activeChannel, setActiveChannel] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isSuggestingTone, setIsSuggestingTone] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isMeetingNotes, setIsMeetingNotes] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [isBackTranslating, setIsBackTranslating] = useState(false);
  const [isToneConfidence, setIsToneConfidence] = useState(false);
  const [isMultiTranslating, setIsMultiTranslating] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showMultiLang, setShowMultiLang] = useState(false);

  // Speaker diarization state
  const [segments, setSegments] = useState([]);
  const [isDiarizing, setIsDiarizing] = useState(false);
  const [diarizeError, setDiarizeError] = useState('');
  const [playLang, setPlayLang] = useState(state.selectedLanguage || 'hi-IN');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthSegments, setSynthSegments] = useState([]);
  const [playingIdx, setPlayingIdx] = useState(null);
  const audioRef = useRef(null);
  const recordedBlobRef = useRef(null);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(animFrameRef.current);
      clearTimeout(silenceTimerRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    cancelAnimationFrame(animFrameRef.current);
    clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
    setAmplitude(0);
    setIsListening(false);
  }, []);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArr = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArr);
        const avg = dataArr.reduce((a, b) => a + b, 0) / dataArr.length;
        setAmplitude(avg);
        if (avg < SILENCE_THRESHOLD) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
            }, SILENCE_DURATION);
          }
        } else {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        cancelAnimationFrame(animFrameRef.current);
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
        setAmplitude(0);
        setIsListening(false);
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        recordedBlobRef.current = blob; // save for diarization
        if (blob.size < 1000) return;
        setIsProcessing(true);
        try {
          const result = await api.translateAudioFromBlob(blob, 'recording.webm');
          if (result.transcript) {
            setTranscript(result.transcript);
            incrementUsage('sarvamCalls');
            addHistory({ text: result.transcript, lang: state.selectedLanguage, timestamp: new Date().toISOString(), confidence: result.confidence || null });
            api.analyzeSentiment(result.transcript).then(setSentiment).catch(() => {});
          }
        } catch (e) {
          showError((e.response && e.response.data && e.response.data.detail) || 'Transcription failed');
        } finally {
          setIsProcessing(false);
        }
      };
      mr.start();
      setIsListening(true);
    } catch (e) {
      showError('Microphone access denied');
    }
  }, [state.selectedLanguage, showError, incrementUsage, addHistory]);

  const handleTranslate = useCallback(async () => {
    if (!transcript || !transcript.trim()) return;
    setIsTranslating(true);
    try {
      const t = await api.translateText(transcript, state.selectedLanguage);
      setNativeTranslation(t);
      incrementUsage('sarvamCalls');
    } catch (e) { showError((e.response && e.response.data && e.response.data.detail) || 'Translation error'); }
    finally { setIsTranslating(false); }
  }, [transcript, state.selectedLanguage, showError, incrementUsage]);

  const handleRewrite = useCallback(async (tone) => {
    if (!transcript || !transcript.trim()) return;
    setIsRewriting(true); setRewrittenText('');
    try {
      const r = await api.rewriteTone(transcript, tone === 'Custom' ? 'User Override' : tone, tone === 'Custom' ? customToneInput : null, (state.customDictionary && state.customDictionary.length) ? state.customDictionary : null);
      setRewrittenText(r);
      incrementUsage('geminiCalls');
      api.getReadability(r).then(setReadability).catch(() => {});
    } catch (e) { showError((e.response && e.response.data && e.response.data.detail) || 'Rewrite failed'); }
    finally { setIsRewriting(false); }
  }, [transcript, customToneInput, state.customDictionary, showError, incrementUsage]);

  const handleToneClick = (tone) => { setSelectedTone(tone); if (tone !== 'Custom') handleRewrite(tone); };

  const handleSmartTone = async () => {
    if (!transcript || !transcript.trim()) return;
    setIsSuggestingTone(true);
    try { const tone = await api.suggestTone(transcript); setSelectedTone(tone); handleRewrite(tone); }
    catch (e) { showError('Tone suggestion failed'); }
    finally { setIsSuggestingTone(false); }
  };

  const handleSummarize = async () => {
    if (!transcript || !transcript.trim()) return;
    setIsSummarizing(true); setSummary('');
    try { setSummary(await api.summarizeTranscript(transcript)); }
    catch (e) { showError('Summarize failed'); }
    finally { setIsSummarizing(false); }
  };

  const handleMeetingNotes = async () => {
    if (!transcript || !transcript.trim()) return;
    setIsMeetingNotes(true); setMeetingNotes(null);
    try { setMeetingNotes(await api.getMeetingNotes(transcript)); }
    catch (e) { showError('Meeting notes failed'); }
    finally { setIsMeetingNotes(false); }
  };

  const handleAskQuestion = async () => {
    if (!transcript || !transcript.trim() || !qaQuestion.trim()) return;
    setIsAsking(true); setQaAnswer('');
    try { setQaAnswer(await api.askQuestion(transcript, qaQuestion)); }
    catch (e) { showError('Q&A failed'); }
    finally { setIsAsking(false); }
  };

  const handleShareLink = async () => {
    if (!transcript || !transcript.trim()) return;
    setIsSharing(true);
    try {
      const res = await api.createShareLink(transcript, 'Shared transcript');
      setShareLink(res.link_id);
      navigator.clipboard.writeText(res.link_id);
      showSuccess('Link ID copied: ' + res.link_id);
    } catch (e) { showError('Share failed'); }
    finally { setIsSharing(false); }
  };

  const handleBackTranslate = async () => {
    if (!nativeTranslation || !nativeTranslation.trim()) return;
    setIsBackTranslating(true); setBackTranslation(null);
    try { setBackTranslation(await api.backTranslate(nativeTranslation, state.selectedLanguage)); }
    catch (e) { showError('Back-translation failed'); }
    finally { setIsBackTranslating(false); }
  };

  const handleToneConfidence = async () => {
    if (!rewrittenText || !rewrittenText.trim() || !selectedTone) return;
    setIsToneConfidence(true); setToneConfidence(null);
    try { setToneConfidence(await api.getToneConfidence(rewrittenText, selectedTone)); }
    catch (e) { showError('Tone confidence check failed'); }
    finally { setIsToneConfidence(false); }
  };

  const handleMultiTranslate = async () => {
    if (!transcript || !transcript.trim() || multiLangs.length === 0) return;
    setIsMultiTranslating(true); setMultiResults({});
    try { setMultiResults(await api.multiTranslate(transcript, multiLangs)); }
    catch (e) { showError('Multi-translate failed'); }
    finally { setIsMultiTranslating(false); }
  };

  const handleSaveTemplate = () => {
    if (!rewrittenText || !rewrittenText.trim()) return;
    const templates = state.savedTemplates || [];
    saveTemplates([{ id: Date.now(), tone: selectedTone, text: rewrittenText, createdAt: new Date().toISOString() }, ...templates].slice(0, 20));
    showSuccess('Template saved');
  };

  const handleDownload = () => {
    const text = rewrittenText || nativeTranslation || transcript;
    if (!text) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = 'transcript.txt'; a.click();
  };

  const handleClear = () => {
    setTranscript(''); setNativeTranslation(''); setRewrittenText('');
    setSelectedTone(null); setSentiment(null); setSummary('');
    setMeetingNotes(null); setQaAnswer(''); setShareLink('');
    setBackTranslation(null); setReadability(null); setToneConfidence(null); setMultiResults({});
    setSegments([]); setSynthSegments([]); setPlayingIdx(null); setDiarizeError('');
    recordedBlobRef.current = null;
  };

  // ── Diarization handlers ──────────────────────────────────────────────────
  const handleDiarize = async () => {
    if (!recordedBlobRef.current) return;
    setIsDiarizing(true); setDiarizeError(''); setSegments([]); setSynthSegments([]);
    try {
      const result = await api.diarizeAudio(recordedBlobRef.current);
      setSegments(result.segments || []);
    } catch (e) {
      setDiarizeError(e.response?.data?.detail || 'Speaker detection failed');
    } finally {
      setIsDiarizing(false);
    }
  };

  const handleSynthesize = async () => {
    if (!segments.length) return;
    setIsSynthesizing(true); setSynthSegments([]);
    try {
      // Translate each segment first
      const translated = await Promise.all(segments.map(async (seg) => {
        try {
          const t = await api.translateText(seg.text, playLang);
          return { ...seg, translated_text: t };
        } catch {
          return { ...seg, translated_text: seg.text };
        }
      }));
      const result = await api.synthesizeConversation({ segments: translated, target_language: playLang });
      setSynthSegments(result.segments || []);
    } catch (e) {
      setDiarizeError(e.response?.data?.detail || 'Voice synthesis failed');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const playSegment = (idx) => {
    const seg = synthSegments[idx];
    if (!seg?.audio) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    const audio = new Audio(`data:audio/wav;base64,${seg.audio}`);
    audioRef.current = audio;
    setPlayingIdx(idx);
    audio.onended = () => {
      setPlayingIdx(null);
      // Auto-play next segment
      if (idx + 1 < synthSegments.length) playSegment(idx + 1);
    };
    audio.play();
  };

  const stopPlayback = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlayingIdx(null);
  };

  const wc = transcript && transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  const rwc = rewrittenText && rewrittenText.trim() ? rewrittenText.trim().split(/\s+/).length : 0;
  const shareText = rewrittenText || nativeTranslation || transcript;
  const bars = Array.from({ length: 20 }, (_, i) => isListening ? Math.max(4, Math.min(40, amplitude * (0.5 + Math.sin(i * 0.8) * 0.5))) : 4);

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f8f8]">
      <div className="bg-white border-b border-gray-100 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center">
            <Ear className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-gray-900">{L.continuousListening}</p>
            <p className="text-[11px] text-gray-400">Auto-stops after {SILENCE_DURATION / 1000}s of silence</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {transcript && <button onClick={handleClear} className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-gray-400 hover:text-red-400 hover:bg-red-50 transition-all">Clear</button>}
          <button onClick={handleDownload} disabled={!transcript} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 text-[12px] font-medium disabled:opacity-30 transition-all">
            <Download className="w-3.5 h-3.5" />Save
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 md:px-10 pt-8 pb-10 max-w-3xl w-full mx-auto">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="flex items-end gap-0.5 h-10">
            {bars.map((h, i) => (
              <div key={i} className={'w-1.5 rounded-full transition-all duration-75 ' + (isListening ? 'bg-gray-900' : 'bg-gray-200')} style={{ height: h + 'px' }} />
            ))}
          </div>
          <button onClick={isListening ? stopListening : startListening}
            className={'flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-[15px] font-bold transition-all shadow-sm active:scale-95 ' + (isListening ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-900 hover:bg-gray-700 text-white')}>
            {isListening ? <><Square className="w-4 h-4 fill-white" />{L.stopListening}</> : <><Ear className="w-4 h-4" />{L.startListening}</>}
          </button>
          {isProcessing && <div className="flex items-center gap-2 text-[13px] text-gray-400"><Loader2 className="w-3.5 h-3.5 animate-spin" />{L.transcribingAudio}</div>}
          {isListening && <p className="text-[12px] text-gray-400 animate-pulse">Listening… auto-stops after {SILENCE_DURATION / 1000}s of silence</p>}
        </div>

        {transcript ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">Transcript</span>
                <SentimentBadge sentiment={sentiment && sentiment.sentiment} score={sentiment && sentiment.score} />
              </div>
              <div className="flex items-center gap-1.5">
                <SpeakBtn onClick={() => speak(transcript, 'en-IN')} isPlaying={isPlaying} disabled={!transcript} />
                <CopyBtn text={transcript} />
              </div>
            </div>
            <textarea value={transcript} onChange={e => setTranscript(e.target.value)}
              rows={Math.max(4, transcript.split('\n').length + 1)}
              className="w-full text-[18px] text-gray-800 leading-[1.9] font-normal bg-white rounded-xl px-4 py-3 border border-gray-100 focus:outline-none focus:border-gray-300 resize-none transition-all"
              spellCheck={false} />
            <div className="flex items-center gap-1 mt-1 mb-3">
              <Hash className="w-3 h-3 text-gray-300" />
              <span className="text-[11px] text-gray-300">{wc} words</span>
            </div>

            <div className="mb-3">
              <button onClick={() => setShowAIPanel(v => !v)} className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-400 hover:text-gray-700 transition-colors">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />AI Tools
                {showAIPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
              </button>
              {showAIPanel && (
                <div className="mt-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={handleSummarize} disabled={isSummarizing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-[12px] font-semibold hover:bg-gray-50 disabled:opacity-40 transition-all">
                      {isSummarizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlignLeft className="w-3 h-3" />}Summarize
                    </button>
                    <button onClick={handleMeetingNotes} disabled={isMeetingNotes} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-[12px] font-semibold hover:bg-gray-50 disabled:opacity-40 transition-all">
                      {isMeetingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : <ClipboardList className="w-3 h-3" />}Meeting notes
                    </button>
                    <button onClick={handleShareLink} disabled={isSharing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-[12px] font-semibold hover:bg-gray-50 disabled:opacity-40 transition-all">
                      {isSharing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link className="w-3 h-3" />}Share link
                    </button>
                  </div>
                  {summary && <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3"><p className="text-[11px] font-bold text-blue-400 uppercase tracking-widest mb-1.5">Summary</p><p className="text-[13px] text-gray-700 leading-relaxed">{summary}</p></div>}
                  {meetingNotes && (
                    <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 space-y-2">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Meeting Notes</p>
                      {meetingNotes.summary && <p className="text-[13px] text-gray-700">{meetingNotes.summary}</p>}
                      {meetingNotes.action_items && meetingNotes.action_items.length > 0 && (
                        <div><p className="text-[11px] font-semibold text-gray-400 mt-2 mb-1">Action Items</p>
                          <ul className="list-disc list-inside space-y-0.5">{meetingNotes.action_items.map((a, i) => <li key={i} className="text-[13px] text-gray-700">{a}</li>)}</ul>
                        </div>
                      )}
                    </div>
                  )}
                  {shareLink && <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5"><Link className="w-3.5 h-3.5 text-gray-400 shrink-0" /><span className="text-[13px] text-gray-600 flex-1">Link ID: <span className="font-mono font-semibold text-gray-900">{shareLink}</span></span><button onClick={() => { navigator.clipboard.writeText(shareLink); showSuccess('Copied!'); }} className="text-[12px] text-gray-400 hover:text-gray-700">Copy</button></div>}
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Ask about this transcript</p>
                    <div className="flex gap-2">
                      <div className="relative flex-1"><HelpCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" /><input value={qaQuestion} onChange={e => setQaQuestion(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAskQuestion()} placeholder="e.g. What was the main concern?" className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-[13px] focus:outline-none focus:border-gray-400 transition-all" /></div>
                      <button onClick={handleAskQuestion} disabled={!qaQuestion.trim() || isAsking} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 text-white text-[12px] font-semibold hover:bg-gray-700 disabled:opacity-40 transition-all">{isAsking ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Ask'}</button>
                    </div>
                    {qaAnswer && <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[13px] text-gray-700 leading-relaxed">{qaAnswer}</div>}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <select value={state.selectedLanguage} onChange={e => {
                  const lang = e.target.value;
                  setFields({ selectedLanguage: lang });
                  if (transcript && transcript.trim()) {
                    setIsTranslating(true);
                    api.translateText(transcript, lang)
                      .then(t => setNativeTranslation(t))
                      .catch(err => showError(err.response?.data?.detail || 'Translation error'))
                      .finally(() => setIsTranslating(false));
                  }
                }}
                  className="appearance-none bg-white border border-gray-200 rounded-xl pl-3 pr-7 py-2 text-[13px] font-medium text-gray-600 cursor-pointer focus:outline-none hover:border-gray-300 transition-all shadow-sm">
                  {Object.entries(TARGET_LANGUAGES).map(function(entry) { return <option key={entry[1]} value={entry[1]}>{entry[0]}</option>; })}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
              <button onClick={handleTranslate} disabled={!transcript || !transcript.trim() || isTranslating}
                className="flex items-center gap-2 bg-gray-900 text-white rounded-xl px-4 py-2 text-[13px] font-semibold hover:bg-gray-700 transition-all disabled:opacity-30 shadow-sm">
                {isTranslating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Translating…</> : <><Languages className="w-3.5 h-3.5" />Translate</>}
              </button>
            </div>

            {nativeTranslation && (
              <div className="mb-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">Translation</span>
                  <div className="flex items-center gap-1.5">
                    <SpeakBtn onClick={() => speak(nativeTranslation, state.selectedLanguage)} isPlaying={isPlaying} disabled={!nativeTranslation} />
                    <button onClick={handleBackTranslate} disabled={isBackTranslating} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 text-[12px] font-medium disabled:opacity-40 transition-all">
                      {isBackTranslating ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowLeftRight className="w-3 h-3" />}Back-check
                    </button>
                  </div>
                </div>
                <p className="text-[18px] text-gray-700 leading-[1.9] whitespace-pre-wrap">{nativeTranslation}</p>
                {backTranslation && (
                  <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Back-translation</p>
                      <span className={'text-[12px] font-bold px-2 py-0.5 rounded-full border ' + (backTranslation.accuracy_score >= 80 ? 'bg-green-50 text-green-600 border-green-100' : backTranslation.accuracy_score >= 60 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-red-50 text-red-500 border-red-100')}>{backTranslation.accuracy_score}% accurate</span>
                    </div>
                    <p className="text-[13px] text-gray-700 italic">"{backTranslation.back_translation}"</p>
                  </div>
                )}
              </div>
            )}

            <div className="mb-4">
              <button onClick={() => setShowMultiLang(v => !v)} className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-400 hover:text-gray-700 transition-colors">
                <Globe2 className="w-3.5 h-3.5 text-blue-400" />Multi-language output
                {showMultiLang ? <ChevronUp className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
              </button>
              {showMultiLang && (
                <div className="mt-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {Object.entries(TARGET_LANGUAGES).map(function(entry) {
                      const sel = multiLangs.includes(entry[1]);
                      return <button key={entry[1]} onClick={() => setMultiLangs(prev => sel ? prev.filter(l => l !== entry[1]) : prev.length < 3 ? [...prev, entry[1]] : prev)} className={'px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ' + (sel ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400')}>{entry[0]}</button>;
                    })}
                  </div>
                  <button onClick={handleMultiTranslate} disabled={multiLangs.length === 0 || isMultiTranslating} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-700 disabled:opacity-40 transition-all mb-3">
                    {isMultiTranslating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Translating…</> : <><Languages className="w-3.5 h-3.5" />Translate all</>}
                  </button>
                  {Object.keys(multiResults).length > 0 && (
                    <div className="space-y-3">
                      {Object.entries(multiResults).map(function(entry) {
                        const langName = Object.entries(TARGET_LANGUAGES).find(function(e) { return e[1] === entry[0]; });
                        return <div key={entry[0]} className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3"><div className="flex items-center justify-between mb-1.5"><span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{langName ? langName[0] : entry[0]}</span><button onClick={() => navigator.clipboard.writeText(entry[1])} className="text-[11px] text-gray-400 hover:text-gray-700">Copy</button></div><p className="text-[15px] text-gray-700 leading-relaxed">{entry[1]}</p></div>;
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">Rewrite tone</span>
                  <button onClick={handleSmartTone} disabled={isSuggestingTone || !transcript || !transcript.trim()} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-100 text-amber-600 text-[11px] font-semibold hover:bg-amber-100 disabled:opacity-40 transition-all">
                    {isSuggestingTone ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}Smart suggest
                  </button>
                </div>
                {rewrittenText && <button onClick={() => { setRewrittenText(''); setSelectedTone(null); }} className="text-[12px] text-gray-400 hover:text-gray-700 transition-colors">Reset</button>}
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {TONE_OPTIONS.map(t => (
                  <button key={t} onClick={() => handleToneClick(t)} disabled={isRewriting} className={'px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all disabled:opacity-40 ' + (selectedTone === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-800')}>{t}</button>
                ))}
              </div>
              {selectedTone === 'Custom' && (
                <div className="flex gap-2 mb-3">
                  <input value={customToneInput} onChange={e => setCustomToneInput(e.target.value)} placeholder="Describe your tone" className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-[13px] focus:outline-none focus:border-gray-400 transition-all" />
                  <button onClick={() => handleRewrite('Custom')} disabled={!customToneInput.trim() || isRewriting} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-700 disabled:opacity-40 transition-all">
                    {isRewriting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}Apply
                  </button>
                </div>
              )}
              {isRewriting && <div className="flex items-center gap-2 text-[13px] text-gray-400 py-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Rewriting with AI…</div>}
              {rewrittenText && !isRewriting && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-amber-400" /><span className="text-[11px] font-bold text-amber-500 uppercase tracking-widest">{selectedTone} Rewritten</span></div>
                    <div className="flex items-center gap-1.5">
                      <SpeakBtn onClick={() => speak(rewrittenText, 'en-IN')} isPlaying={isPlaying} disabled={!rewrittenText} />
                      <CopyBtn text={rewrittenText} />
                      <button onClick={handleSaveTemplate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-amber-50 text-gray-400 hover:text-amber-600 text-[13px] font-medium border border-gray-200 hover:border-amber-200 transition-all"><BookmarkPlus className="w-3.5 h-3.5" />Save</button>
                    </div>
                  </div>
                  <textarea value={rewrittenText} onChange={e => setRewrittenText(e.target.value)} rows={Math.max(6, rewrittenText.split('\n').length + 2)} className="w-full text-[15px] text-gray-800 leading-[1.85] bg-amber-50 rounded-xl px-4 py-3 border border-amber-100 focus:outline-none focus:border-amber-300 resize-none transition-all" spellCheck={false} />
                  <div className="flex items-center gap-1 mt-1 mb-2">
                    <Hash className="w-3 h-3 text-gray-300" /><span className="text-[11px] text-gray-300">{rwc} words</span>
                    {readability && <span className="ml-2 text-[11px] text-gray-400 flex items-center gap-1"><BookOpen className="w-3 h-3" />Readability: <span className="font-semibold">{readability.label}</span></span>}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={handleToneConfidence} disabled={isToneConfidence} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 text-[11px] font-semibold disabled:opacity-40 transition-all">
                      {isToneConfidence ? <Loader2 className="w-3 h-3 animate-spin" /> : <BarChart2 className="w-3 h-3" />}Check tone fit
                    </button>
                    {toneConfidence && <span className={'text-[12px] font-bold px-2 py-0.5 rounded-full border ' + (toneConfidence.score >= 80 ? 'bg-green-50 text-green-600 border-green-100' : toneConfidence.score >= 60 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-red-50 text-red-500 border-red-100')}>{toneConfidence.score}% tone match</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-gray-300 uppercase tracking-widest mr-1">Send via</span>
                    {CHANNELS.filter(ch => (TONE_TO_CHANNELS[selectedTone] || []).includes(ch.id)).map(ch => (
                      <button key={ch.id} onClick={() => setActiveChannel(ch)} className={'flex items-center gap-1.5 px-4 py-2 rounded-xl border text-[13px] font-semibold transition-all hover:shadow-sm active:scale-95 ' + ch.bg + ' ' + ch.border + ' ' + ch.color}>
                        <ch.icon className="w-4 h-4" />Send to {ch.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
            <div className="w-14 h-14 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
              <Ear className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-[15px] text-gray-300 font-medium">{L.pressStartListening}</p>
            <p className="text-[12px] text-gray-300">Auto-stops after {SILENCE_DURATION / 1000}s of silence</p>
          </div>
        )}
      </div>

      {activeChannel && <ChannelModal channel={activeChannel} text={shareText} onClose={() => setActiveChannel(null)} />}

      {/* Speaker Diarization Panel */}
      {transcript && (
        <div className="px-4 md:px-10 pb-10 max-w-3xl w-full mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <p className="text-[14px] font-bold text-gray-900">Conversation</p>
                {segments.length > 0 && (
                  <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {new Set(segments.map(s => s.speaker)).size} speakers
                  </span>
                )}
              </div>
              <button onClick={handleDiarize} disabled={isDiarizing || !recordedBlobRef.current}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[12px] font-semibold hover:bg-gray-700 disabled:opacity-40 transition-all">
                {isDiarizing
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Detecting…</>
                  : <><Users className="w-3.5 h-3.5" />Detect Speakers</>}
              </button>
            </div>

            {diarizeError && (
              <div className="px-5 py-3 bg-red-50 border-b border-red-100">
                <p className="text-[12px] text-red-500">{diarizeError}</p>
              </div>
            )}

            {/* Conversation bubbles */}
            {segments.length > 0 ? (
              <>
                <div className="px-4 py-4 space-y-3 max-h-80 overflow-y-auto bg-[#f8f8f8]">
                  {segments.map((seg, i) => {
                    // Alternate sides: even = left (Person 1), odd = right (Person 2+)
                    const speakers = [...new Set(segments.map(s => s.speaker))];
                    const speakerIdx = speakers.indexOf(seg.speaker);
                    const isRight = speakerIdx % 2 !== 0;

                    const bubbleColors = [
                      'bg-white border border-gray-200 text-gray-800',
                      'bg-gray-900 text-white',
                      'bg-blue-50 border border-blue-100 text-blue-900',
                      'bg-purple-50 border border-purple-100 text-purple-900',
                    ];
                    const bubbleColor = bubbleColors[speakerIdx % bubbleColors.length];
                    const nameColors = ['text-gray-500', 'text-gray-300', 'text-blue-500', 'text-purple-500'];
                    const nameColor = nameColors[speakerIdx % nameColors.length];

                    const synthSeg = synthSegments[i];
                    const isPlaying = playingIdx === i;

                    return (
                      <div key={i} className={`flex gap-2 ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Avatar */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-1 ${speakerIdx % 2 === 0 ? 'bg-gray-200 text-gray-600' : 'bg-gray-700 text-white'}`}>
                          {seg.speaker.replace('Person ', 'P')}
                        </div>

                        {/* Bubble */}
                        <div className={`max-w-[75%] ${isRight ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                          <span className={`text-[10px] font-semibold ${nameColor} px-1`}>{seg.speaker}</span>
                          <div className={`rounded-2xl px-4 py-2.5 shadow-sm ${bubbleColor} ${isRight ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
                            <p className="text-[13px] leading-relaxed">{seg.text}</p>
                          </div>
                          <div className={`flex items-center gap-2 px-1 ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
                            <span className="text-[10px] text-gray-400 capitalize">{seg.emotion}</span>
                            {synthSeg?.audio && (
                              <button onClick={() => isPlaying ? stopPlayback() : playSegment(i)}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                                  isPlaying ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}>
                                {isPlaying
                                  ? <><Square className="w-2.5 h-2.5 fill-red-500" />Stop</>
                                  : <><Play className="w-2.5 h-2.5 fill-gray-500" />Play</>}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Playback controls */}
                <div className="px-5 py-4 border-t border-gray-100 bg-white">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative">
                      <select value={playLang} onChange={e => setPlayLang(e.target.value)}
                        className="appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-[13px] font-semibold text-gray-700 cursor-pointer focus:outline-none pr-8">
                        {Object.entries({ Hindi: 'hi-IN', Kannada: 'kn-IN', Tamil: 'ta-IN', Telugu: 'te-IN', Malayalam: 'ml-IN', Bengali: 'bn-IN', English: 'en-IN' }).map(([n, c]) => (
                          <option key={c} value={c}>{n}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    </div>

                    <button onClick={handleSynthesize} disabled={isSynthesizing}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-xl text-[12px] font-semibold hover:bg-gray-700 disabled:opacity-40 transition-all">
                      {isSynthesizing
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating voices…</>
                        : <><Volume2 className="w-3.5 h-3.5" />Generate voices</>}
                    </button>

                    {synthSegments.length > 0 && (
                      <button onClick={() => playingIdx !== null ? stopPlayback() : playSegment(0)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all ${
                          playingIdx !== null
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}>
                        {playingIdx !== null
                          ? <><Square className="w-3.5 h-3.5 fill-white" />Stop</>
                          : <><Play className="w-3.5 h-3.5 fill-white" />Play conversation</>}
                      </button>
                    )}
                  </div>

                  {synthSegments.length > 0 && (
                    <p className="text-[11px] text-gray-400 mt-2">
                      Each speaker plays in a different voice · auto-advances through the conversation
                    </p>
                  )}
                </div>
              </>
            ) : (
              !isDiarizing && (
                <div className="px-5 py-8 text-center">
                  <p className="text-[13px] text-gray-400">Record a conversation, then click "Detect Speakers" to see who said what.</p>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
