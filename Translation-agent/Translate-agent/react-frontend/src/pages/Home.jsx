import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import RecordingControls from '../components/RecordingControls';
import { useApp } from '../context/AppContext';
import {
  Mic, Ear, Copy, Check, Download, Sparkles, Volume2, Square,
  Languages, Loader2, ChevronDown, Mail, Slack, Linkedin,
  MessageSquare, X, Send, ExternalLink, BookmarkPlus, Hash,
  Upload, Smile, Frown, Minus, Wand2, FileAudio,
  AlignLeft, ClipboardList, HelpCircle, Link, ChevronUp, ChevronDown as ChevronDownIcon,
  ArrowLeftRight, BookOpen, BarChart2, Globe2, Tag, Keyboard, Pin
} from 'lucide-react';
import { useSpeech } from '../hooks/useSpeech';
import * as api from '../services/api';
import { getLabels } from '../services/uiLabels';

const MODES = (RM) => [
  { id: RM.PUSH_TO_TALK, icon: Mic,       title: 'Start Speaking',       desc: 'Record live with push-to-talk',      color: 'from-gray-900 to-gray-700' },
  { id: RM.CONTINUOUS,   icon: Ear,       title: 'Continuous Listening', desc: 'Hands-free with silence detection',  color: 'from-gray-700 to-gray-500' },
  { id: RM.FILE_UPLOAD,  icon: FileAudio, title: 'Upload Audio File',    desc: 'Transcribe .mp3, .wav, .m4a, .ogg', color: 'from-gray-600 to-gray-400' },
];

const CHANNELS = [
  { id: 'email',    label: 'Email',     icon: Mail,          color: 'text-blue-500',   bg: 'bg-blue-50',   border: 'border-blue-100'   },
  { id: 'slack',    label: 'Slack',     icon: Slack,         color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-100' },
  { id: 'linkedin', label: 'LinkedIn',  icon: Linkedin,      color: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-100'    },
  { id: 'whatsapp', label: 'WhatsApp',  icon: MessageSquare, color: 'text-green-500',  bg: 'bg-green-50',  border: 'border-green-100'  },
];

const TONE_OPTIONS = ['Email Formal', 'Email Casual', 'Slack', 'LinkedIn', 'WhatsApp Business', 'Custom'];

const TONE_TO_CHANNELS = {
  'Email Formal':      ['email'],
  'Email Casual':      ['email'],
  'Slack':             ['slack'],
  'LinkedIn':          ['linkedin'],
  'WhatsApp Business': ['whatsapp'],
  'Custom':            ['email', 'slack', 'linkedin', 'whatsapp'],
};

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
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
        isPlaying ? 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100'
                  : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 hover:text-gray-800'}`}>
      {isPlaying ? <><Square className="w-3.5 h-3.5 fill-red-500" /> Stop</> : <><Volume2 className="w-3.5 h-3.5" /> Speak</>}
    </button>
  );
}

function SentimentBadge({ sentiment, score, summary }) {
  if (!sentiment) return null;
  const map = {
    positive: { icon: Smile,  color: 'text-green-600 bg-green-50 border-green-100' },
    neutral:  { icon: Minus,  color: 'text-gray-500 bg-gray-50 border-gray-200'   },
    negative: { icon: Frown,  color: 'text-red-500 bg-red-50 border-red-100'      },
  };
  const { icon: Icon, color } = map[sentiment] || map.neutral;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${color}`} title={summary}>
      <Icon className="w-3 h-3" />{sentiment} · {score}%
    </span>
  );
}

function FileUploadZone({ onTranscribed }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState('');
  const inputRef = useRef(null);

  const processFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setUploading(true);
    try {
      const result = await api.translateAudioFromBlob(file, file.name);
      onTranscribed(result);
    } catch (e) {
      onTranscribed({ error: e.response?.data?.detail || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]); }}
      onClick={() => inputRef.current?.click()}
      className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed cursor-pointer transition-all py-14 ${
        dragging ? 'border-gray-400 bg-gray-100' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <input ref={inputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.webm" className="hidden"
        onChange={e => processFile(e.target.files[0])} />
      {uploading ? (
        <>
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          <p className="text-[14px] text-gray-500 font-medium">Transcribing {fileName}…</p>
        </>
      ) : (
        <>
          <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
            <Upload className="w-5 h-5 text-gray-400" />
          </div>
          <div className="text-center">
            <p className="text-[14px] font-semibold text-gray-700">{L.dropAudioHere || "Drop audio file here"}</p>
            <p className="text-[12px] text-gray-400 mt-1">MP3, WAV, M4A, OGG, FLAC · up to 100MB</p>
          </div>
        </>
      )}
    </div>
  );
}

function ChannelModal({ channel, text, onClose }) {
  const { state, setField } = useApp();
  const navigate = useNavigate();
  const creds = state.channelCredentials || {};
  const [toEmail, setToEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [errMsg, setErrMsg] = useState('');

  const hasCredentials = {
    email: true, slack: !!creds.slackWebhook?.trim(),
    linkedin: true, whatsapp: !!creds.whatsappPhone?.trim(),
  }[channel.id];

  const goToProfile = () => { onClose(); navigate('/app/profile'); };
  const canSend = channel.id === 'email' ? !!toEmail.trim() : true;

  const handleSend = async () => {
    setStatus('sending');
    try {
      if (channel.id === 'email') {
        const subject = encodeURIComponent(creds.emailSubject || 'Message from TransUI');
        window.open(`mailto:${toEmail.trim()}?subject=${subject}&body=${encodeURIComponent(text)}`, '_blank');
        setStatus('ok'); return;
      } else if (channel.id === 'slack') {
        await api.sendToSlack({ text, webhookUrl: creds.slackWebhook });
      } else if (channel.id === 'linkedin') {
        await api.shareToLinkedIn({ text, addHashtags: true });
      } else if (channel.id === 'whatsapp') {
        const num = creds.whatsappPhone.replace(/\D/g, '');
        window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, '_blank');
        setStatus('ok'); return;
      }
      setStatus('ok');
    } catch (e) {
      setErrMsg(e.response?.data?.detail || e.message || 'Something went wrong');
      setStatus('err');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${channel.bg} ${channel.border} border flex items-center justify-center`}>
              <channel.icon className={`w-4 h-4 ${channel.color}`} />
            </div>
            <p className="text-[15px] font-bold text-gray-900">Send via {channel.label}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        {!hasCredentials ? (
          <div className="text-center py-4">
            <p className="text-[14px] text-gray-500 mb-4">No {channel.label} credentials saved yet.</p>
            <button onClick={goToProfile} className="flex items-center gap-2 mx-auto bg-gray-900 text-white rounded-xl px-5 py-2.5 text-[13px] font-semibold hover:bg-gray-700 transition-all">
              <ExternalLink className="w-3.5 h-3.5" /> Go to Profile
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">Message preview</label>
              <div className="px-4 py-3 rounded-xl border border-amber-100 bg-amber-50 text-[13px] text-gray-700 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                {text.slice(0, 400)}{text.length > 400 ? '…' : ''}
              </div>
            </div>
            {channel.id === 'email' && (
              <div className="mb-4">
                <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">To email</label>
                <input type="email" value={toEmail} onChange={e => setToEmail(e.target.value)}
                  placeholder="recipient@example.com" autoFocus
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-[14px] focus:outline-none focus:border-gray-400 transition-all" />
              </div>
            )}
            {(channel.id === 'slack' || channel.id === 'whatsapp') && (
              <div className="mb-4 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 text-[12px] text-gray-400">
                {channel.id === 'slack' && <>Webhook: <span className="font-semibold text-gray-700">{creds.slackWebhook?.slice(0, 35)}…</span></>}
                {channel.id === 'whatsapp' && <>To: <span className="font-semibold text-gray-700">+{creds.whatsappPhone}</span></>}
                <button onClick={goToProfile} className="ml-2 underline underline-offset-2 hover:text-gray-700 transition-colors">Change →</button>
              </div>
            )}
            {status === 'ok' && (
              <div className="mb-4 px-4 py-2.5 bg-green-50 border border-green-100 rounded-xl text-[13px] text-green-700 flex items-center gap-2">
                <Check className="w-4 h-4" /> Sent successfully
              </div>
            )}
            {status === 'err' && (
              <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">{errMsg}</div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-[13px] font-medium text-gray-500 hover:bg-gray-100 transition-all">Cancel</button>
              {status !== 'ok' && (
                <button onClick={handleSend} disabled={status === 'sending' || !canSend}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    channel.id === 'whatsapp' ? 'bg-green-500 hover:bg-green-600' :
                    channel.id === 'linkedin' ? 'bg-sky-600 hover:bg-sky-700' :
                    channel.id === 'slack'    ? 'bg-purple-600 hover:bg-purple-700' :
                    'bg-blue-600 hover:bg-blue-700'}`}>
                  {status === 'sending'
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Sending...</>
                    : (channel.id === 'whatsapp' || channel.id === 'email')
                      ? <><ExternalLink className="w-3.5 h-3.5" />Open {channel.id === 'email' ? 'Email App' : 'WhatsApp'}</>
                      : <><Send className="w-3.5 h-3.5" />Send</>}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const { state, setField, setFields, RECORDING_MODES, TARGET_LANGUAGES, showError, showSuccess, addHistory, saveTemplates, incrementUsage, addNotificationLog } = useApp();
  const L = getLabels(state.uiLanguage);
  const { isPlaying, speak } = useSpeech();
  const [isTranslating, setIsTranslating] = useState(false);
  const [activeChannel, setActiveChannel] = useState(null);
  const [selectedTone, setSelectedTone] = useState(null);
  const [rewrittenText, setRewrittenText] = useState('');
  const [customToneInput, setCustomToneInput] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);
  const [editableTranscript, setEditableTranscript] = useState('');
  const [sentiment, setSentiment] = useState(null);
  const [isSuggestingTone, setIsSuggestingTone] = useState(false);
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [meetingNotes, setMeetingNotes] = useState(null);
  const [isMeetingNotes, setIsMeetingNotes] = useState(false);
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  // New features
  const [backTranslation, setBackTranslation] = useState(null);
  const [isBackTranslating, setIsBackTranslating] = useState(false);
  const [readability, setReadability] = useState(null);
  const [toneConfidence, setToneConfidence] = useState(null);
  const [isToneConfidence, setIsToneConfidence] = useState(false);
  const [multiLangs, setMultiLangs] = useState([]);
  const [multiResults, setMultiResults] = useState({});
  const [isMultiTranslating, setIsMultiTranslating] = useState(false);
  const [showMultiLang, setShowMultiLang] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const prevEnglishText = useRef('');

  // Sync editable transcript when englishText changes from recording
  useEffect(() => {
    setEditableTranscript(state.englishText || '');
  }, [state.englishText]);

  // Auto-save to history when a new transcript arrives
  useEffect(() => {
    if (state.englishText?.trim() && state.englishText !== prevEnglishText.current) {
      prevEnglishText.current = state.englishText;
      addHistory({
        text: state.englishText,
        lang: state.selectedLanguage,
        timestamp: new Date().toISOString(),
        confidence: state.confidenceScore,
      });
      // Run sentiment analysis in background
      api.analyzeSentiment(state.englishText).then(setSentiment).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.englishText]);

  // Keyboard shortcuts: Cmd/Ctrl+Enter = translate, Cmd/Ctrl+R = rewrite
  useEffect(() => {
    const handler = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === 'Enter') { e.preventDefault(); handleTranslate(); }
      if (e.key === 'r') { e.preventDefault(); if (selectedTone && selectedTone !== 'Custom') handleRewrite(selectedTone); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTone, editableTranscript]);

  const handleSpeakEnglish = useCallback(() => speak(rewrittenText || editableTranscript, 'en-IN'), [speak, rewrittenText, editableTranscript]);
  const handleSpeakNative  = useCallback(() => speak(state.nativeTranslation, state.selectedLanguage), [speak, state.nativeTranslation, state.selectedLanguage]);

  const handleRewrite = useCallback(async (tone) => {
    const text = editableTranscript || state.englishText;
    if (!text?.trim()) return;
    setIsRewriting(true);
    setRewrittenText('');
    try {
      const result = await api.rewriteTone(
        text,
        tone === 'Custom' ? 'User Override' : tone,
        tone === 'Custom' ? customToneInput : null,
        state.customDictionary?.length ? state.customDictionary : null,
      );
      setRewrittenText(result);
      incrementUsage('geminiCalls');
      // Auto-run readability on rewritten text
      api.getReadability(result).then(setReadability).catch(() => {});
    } catch (err) {
      showError(err.response?.data?.detail || 'Rewrite failed');
    } finally {
      setIsRewriting(false);
    }
  }, [editableTranscript, state.englishText, state.customDictionary, customToneInput, showError, incrementUsage]);

  const handleToneClick = (tone) => {
    setSelectedTone(tone);
    if (tone !== 'Custom') handleRewrite(tone);
  };

  const handleTranslate = useCallback(async () => {
    const text = editableTranscript || state.englishText;
    if (!text?.trim()) return;
    setIsTranslating(true);
    try {
      const translated = await api.translateText(text, state.selectedLanguage);
      setField('nativeTranslation', translated);
      incrementUsage('sarvamCalls');
    } catch (err) {
      showError(err.response?.data?.detail || 'Translation error');
    } finally {
      setIsTranslating(false);
    }
  }, [editableTranscript, state.englishText, state.selectedLanguage, setField, showError, incrementUsage]);

  const handleLangChange = useCallback((lang) => {
    setFields({ selectedLanguage: lang, nativeTranslation: '' });
  }, [setFields]);

  const handleDownload = () => {
    const text = rewrittenText || state.nativeTranslation || editableTranscript;
    if (!text) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = 'transcript.txt';
    a.click();
  };

  const handleSaveTemplate = () => {
    if (!rewrittenText?.trim()) return;
    const templates = state.savedTemplates || [];
    saveTemplates([{ id: Date.now(), tone: selectedTone, text: rewrittenText, createdAt: new Date().toISOString() }, ...templates].slice(0, 20));
    showSuccess('Template saved');
  };

  const handleClear = () => {
    setField('englishText', '');
    setEditableTranscript('');
    setRewrittenText('');
    setSelectedTone(null);
    setSentiment(null);
    setSummary('');
    setMeetingNotes(null);
    setQaAnswer('');
    setShareLink('');
    setBackTranslation(null);
    setReadability(null);
    setToneConfidence(null);
    setMultiResults({});
    setField('nativeTranslation', '');
  };

  const handleSummarize = async () => {
    const text = editableTranscript || state.englishText;
    if (!text?.trim()) return;
    setIsSummarizing(true); setSummary('');
    try { setSummary(await api.summarizeTranscript(text)); addNotificationLog('Transcript summarized', 'success'); }
    catch { showError('Summarize failed'); }
    finally { setIsSummarizing(false); }
  };

  const handleMeetingNotes = async () => {
    const text = editableTranscript || state.englishText;
    if (!text?.trim()) return;
    setIsMeetingNotes(true); setMeetingNotes(null);
    try { setMeetingNotes(await api.getMeetingNotes(text)); }
    catch { showError('Meeting notes failed'); }
    finally { setIsMeetingNotes(false); }
  };

  const handleAskQuestion = async () => {
    const text = editableTranscript || state.englishText;
    if (!text?.trim() || !qaQuestion.trim()) return;
    setIsAsking(true); setQaAnswer('');
    try { setQaAnswer(await api.askQuestion(text, qaQuestion)); }
    catch { showError('Q&A failed'); }
    finally { setIsAsking(false); }
  };

  const handleShareLink = async () => {
    const text = editableTranscript || state.englishText;
    if (!text?.trim()) return;
    setIsSharing(true);
    try {
      const { link_id } = await api.createShareLink(text, 'Shared transcript');
      setShareLink(link_id);
      navigator.clipboard.writeText(link_id);
      showSuccess(`Link ID copied: ${link_id}`);
      addNotificationLog(`Share link created: ${link_id}`, 'success');
    } catch { showError('Share failed'); }
    finally { setIsSharing(false); }
  };

  const handleSmartTone = async () => {
    const text = editableTranscript || state.englishText;
    if (!text?.trim()) return;
    setIsSuggestingTone(true);
    try {
      const tone = await api.suggestTone(text);
      setSelectedTone(tone);
      handleRewrite(tone);
    } catch {
      showError('Tone suggestion failed');
    } finally {
      setIsSuggestingTone(false);
    }
  };

  const handleBackTranslate = async () => {
    if (!state.nativeTranslation?.trim()) return;
    setIsBackTranslating(true); setBackTranslation(null);
    try { setBackTranslation(await api.backTranslate(state.nativeTranslation, state.selectedLanguage)); }
    catch { showError('Back-translation failed'); }
    finally { setIsBackTranslating(false); }
  };

  const handleReadability = async () => {
    const text = rewrittenText || editableTranscript;
    if (!text?.trim()) return;
    try { setReadability(await api.getReadability(text)); }
    catch { /* silent */ }
  };

  const handleToneConfidence = async () => {
    if (!rewrittenText?.trim() || !selectedTone) return;
    setIsToneConfidence(true); setToneConfidence(null);
    try { setToneConfidence(await api.getToneConfidence(rewrittenText, selectedTone)); }
    catch { showError('Tone confidence check failed'); }
    finally { setIsToneConfidence(false); }
  };

  const handleMultiTranslate = async () => {
    const text = editableTranscript || state.englishText;
    if (!text?.trim() || multiLangs.length === 0) return;
    setIsMultiTranslating(true); setMultiResults({});
    try { setMultiResults(await api.multiTranslate(text, multiLangs)); }
    catch { showError('Multi-translate failed'); }
    finally { setIsMultiTranslating(false); }
  };

  const handleFileTranscribed = ({ transcript, confidence, error }) => {    if (error) { showError(error); return; }
    setFields({ englishText: transcript, confidenceScore: confidence ?? null });
    incrementUsage('sarvamCalls');
    showSuccess('File transcribed successfully');
  };

  const shareText = rewrittenText || state.nativeTranslation || editableTranscript;

  // ── File upload mode ──
  if (state.recordingMode === RECORDING_MODES.FILE_UPLOAD && !editableTranscript) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f8f8f8]">
        <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center gap-2 text-[13px]">
          <button onClick={() => setField('recordingMode', null)} className="text-gray-400 hover:text-gray-700 transition-colors font-medium">{L.home}</button>
          <span className="text-gray-200">/</span>
          <span className="text-gray-900 font-semibold">{L.uploadAudio || "Upload Audio"}</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-10 max-w-2xl w-full mx-auto">
          <FileUploadZone onTranscribed={handleFileTranscribed} />
        </div>
      </div>
    );
  }

  // ── Confidence badge values ──
  const confPct = state.confidenceScore != null ? Math.round(state.confidenceScore * 100) : null;
  const confColor = confPct == null ? '' : confPct >= 85 ? 'bg-green-50 text-green-600 border-green-100' : confPct >= 60 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-red-50 text-red-500 border-red-100';
  const confLabel = confPct == null ? '' : confPct >= 85 ? 'High confidence' : confPct >= 60 ? 'Medium confidence' : 'Low confidence — review';

  // ── Word / char counts ──
  const wc  = editableTranscript?.trim() ? editableTranscript.trim().split(/\s+/).length : 0;
  const cc  = editableTranscript?.length || 0;
  const rwc = rewrittenText?.trim() ? rewrittenText.trim().split(/\s+/).length : 0;
  const rcc = rewrittenText?.length || 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f8f8]">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px]">
          <button onClick={() => setField('recordingMode', null)} className="text-gray-400 hover:text-gray-700 transition-colors font-medium">Home</button>
          <span className="text-gray-200">/</span>
          <span className="text-gray-900 font-semibold">{L.speechToText || "Speech to Text"}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-gray-300 hidden sm:block">⌘↵ translate · ⌘R rewrite</span>
          <button onClick={() => setShowShortcuts(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all text-[12px]">
            <Keyboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{L.shortcuts || "Shortcuts"}</span>
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-[12px] text-gray-400 font-medium">SeedlingSpeaks v2.5</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col px-10 pt-10 pb-40 max-w-3xl w-full mx-auto">

        {editableTranscript ? (
          <div className="animate-fade-in-blur">

            {/* Transcript header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">{L.transcript || "Transcript"}</span>
                {confPct != null && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${confColor}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                    {confPct}% · {confLabel}
                  </span>
                )}
                <SentimentBadge {...(sentiment || {})} />
              </div>
              <div className="flex items-center gap-1.5">
                <SpeakBtn onClick={handleSpeakEnglish} isPlaying={isPlaying} disabled={!editableTranscript} />
                <CopyBtn text={editableTranscript} />
                <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-700 text-[13px] font-medium transition-all">
                  <Download className="w-3.5 h-3.5" />Save
                </button>
                <button onClick={handleClear} className="px-3 py-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 text-[13px] font-medium transition-all">
                  Clear
                </button>
              </div>
            </div>

            {/* Editable transcript */}
            <textarea
              value={editableTranscript}
              onChange={e => setEditableTranscript(e.target.value)}
              rows={Math.max(4, editableTranscript.split('\n').length + 1)}
              className="w-full text-[18px] text-gray-800 leading-[1.9] font-normal tracking-[-0.01em] bg-white rounded-xl px-4 py-3 border border-gray-100 focus:outline-none focus:border-gray-300 resize-none transition-all"
              spellCheck={false}
              placeholder="Your transcript will appear here..."
            />
            <div className="flex items-center gap-1 mt-1 mb-1">
              <Hash className="w-3 h-3 text-gray-300" />
              <span className="text-[11px] text-gray-300">{wc} words · {cc} chars</span>
            </div>

            {/* AI Tools panel */}
            <div className="mt-3 mb-1">
              <button onClick={() => setShowAIPanel(v => !v)}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-400 hover:text-gray-700 transition-colors">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                {L.aiTools || "AI Tools"}
                {showAIPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
              </button>

              {showAIPanel && (
                <div className="mt-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4 animate-fade-in-blur">
                  {/* Quick action buttons */}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={handleSummarize} disabled={isSummarizing || !editableTranscript?.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-[12px] font-semibold hover:bg-gray-50 disabled:opacity-40 transition-all">
                      {isSummarizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlignLeft className="w-3 h-3" />}
                      Summarize
                    </button>
                    <button onClick={handleMeetingNotes} disabled={isMeetingNotes || !editableTranscript?.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-[12px] font-semibold hover:bg-gray-50 disabled:opacity-40 transition-all">
                      {isMeetingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : <ClipboardList className="w-3 h-3" />}
                      Meeting notes
                    </button>
                    <button onClick={handleShareLink} disabled={isSharing || !editableTranscript?.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-[12px] font-semibold hover:bg-gray-50 disabled:opacity-40 transition-all">
                      {isSharing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link className="w-3 h-3" />}
                      Share link
                    </button>
                  </div>

                  {/* Summary output */}
                  {summary && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                      <p className="text-[11px] font-bold text-blue-400 uppercase tracking-widest mb-1.5">Summary</p>
                      <p className="text-[13px] text-gray-700 leading-relaxed">{summary}</p>
                    </div>
                  )}

                  {/* Meeting notes output */}
                  {meetingNotes && (
                    <div className="space-y-2">
                      {meetingNotes.summary && (
                        <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3">
                          <p className="text-[11px] font-bold text-purple-400 uppercase tracking-widest mb-1">Overview</p>
                          <p className="text-[13px] text-gray-700">{meetingNotes.summary}</p>
                        </div>
                      )}
                      {[
                        { key: 'action_items', label: 'Action items', color: 'text-red-400 bg-red-50 border-red-100' },
                        { key: 'decisions',    label: 'Decisions',    color: 'text-green-500 bg-green-50 border-green-100' },
                        { key: 'attendees',    label: 'Attendees',    color: 'text-sky-500 bg-sky-50 border-sky-100' },
                        { key: 'follow_ups',   label: 'Follow-ups',   color: 'text-amber-500 bg-amber-50 border-amber-100' },
                      ].map(({ key, label, color }) => meetingNotes[key]?.length > 0 && (
                        <div key={key} className={`border rounded-xl px-4 py-3 ${color.split(' ').slice(1).join(' ')}`}>
                          <p className={`text-[11px] font-bold uppercase tracking-widest mb-1.5 ${color.split(' ')[0]}`}>{label}</p>
                          <ul className="space-y-1">
                            {meetingNotes[key].map((item, i) => (
                              <li key={i} className="text-[13px] text-gray-700 flex items-start gap-1.5">
                                <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-400 shrink-0" />{item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Share link output */}
                  {shareLink && (
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                      <Link className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-[13px] text-gray-600 flex-1">Link ID: <span className="font-mono font-semibold text-gray-900">{shareLink}</span></span>
                      <button onClick={() => { navigator.clipboard.writeText(shareLink); showSuccess('Copied!'); }}
                        className="text-[12px] text-gray-400 hover:text-gray-700 transition-colors">Copy</button>
                    </div>
                  )}

                  {/* Q&A */}
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Ask about this transcript</p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <HelpCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input value={qaQuestion} onChange={e => setQaQuestion(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAskQuestion()}
                          placeholder="e.g. What was the main concern?"
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-[13px] focus:outline-none focus:border-gray-400 transition-all" />
                      </div>
                      <button onClick={handleAskQuestion} disabled={!qaQuestion.trim() || isAsking || !editableTranscript?.trim()}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 text-white text-[12px] font-semibold hover:bg-gray-700 disabled:opacity-40 transition-all">
                        {isAsking ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Ask'}
                      </button>
                    </div>
                    {qaAnswer && (
                      <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[13px] text-gray-700 leading-relaxed">
                        {qaAnswer}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Translate row */}
            <div className="mt-4 flex items-center gap-3">
              <div className="relative">
                <select value={state.selectedLanguage} onChange={(e) => handleLangChange(e.target.value)}
                  className="appearance-none bg-white border border-gray-200 rounded-xl pl-3 pr-7 py-2 text-[13px] font-medium text-gray-600 cursor-pointer focus:outline-none hover:border-gray-300 transition-all shadow-sm">
                  {Object.entries(TARGET_LANGUAGES).map(([name, code]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
              <button onClick={handleTranslate} disabled={!editableTranscript?.trim() || isTranslating}
                className="flex items-center gap-2 bg-gray-900 text-white rounded-xl px-4 py-2 text-[13px] font-semibold hover:bg-gray-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 shadow-sm">
                {isTranslating
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{L.translating}</>
                  : <><Languages className="w-3.5 h-3.5" />{L.translate}</>}
              </button>
            </div>

            {/* Translation output */}
            {state.nativeTranslation && (
              <div className="mt-5 pt-5 border-t border-gray-100 animate-fade-in-blur">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">
                    {L.translation} · {state.selectedLanguage}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <SpeakBtn onClick={handleSpeakNative} isPlaying={isPlaying} disabled={!state.nativeTranslation} />
                    <button onClick={handleBackTranslate} disabled={isBackTranslating}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 text-[12px] font-medium disabled:opacity-40 transition-all">
                      {isBackTranslating ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowLeftRight className="w-3 h-3" />}
                      Back-check
                    </button>
                  </div>
                </div>
                <p className="text-[18px] text-gray-700 leading-[1.9] whitespace-pre-wrap font-normal tracking-[-0.01em]">
                  {state.nativeTranslation}
                </p>
                {/* Back-translation result */}
                {backTranslation && (
                  <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 animate-fade-in-blur">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Back-translation (accuracy check)</p>
                      <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full border ${
                        backTranslation.accuracy_score >= 80 ? 'bg-green-50 text-green-600 border-green-100' :
                        backTranslation.accuracy_score >= 60 ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        'bg-red-50 text-red-500 border-red-100'
                      }`}>{backTranslation.accuracy_score}% accurate</span>
                    </div>
                    <p className="text-[13px] text-gray-700 italic">"{backTranslation.back_translation}"</p>
                    {backTranslation.notes && <p className="text-[12px] text-gray-400 mt-1">{backTranslation.notes}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Multi-language output */}
            <div className="mt-4">
              <button onClick={() => setShowMultiLang(v => !v)}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-400 hover:text-gray-700 transition-colors">
                <Globe2 className="w-3.5 h-3.5 text-blue-400" />
                {L.multiLangOutput || "Multi-language output"}
                {showMultiLang ? <ChevronUp className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
              </button>
              {showMultiLang && (
                <div className="mt-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 animate-fade-in-blur">
                  <p className="text-[12px] text-gray-400 mb-3">Select up to 3 languages to translate simultaneously</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {Object.entries(TARGET_LANGUAGES).map(([name, code]) => {
                      const sel = multiLangs.includes(code);
                      return (
                        <button key={code} onClick={() => setMultiLangs(prev =>
                          sel ? prev.filter(l => l !== code) : prev.length < 3 ? [...prev, code] : prev
                        )}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
                            sel ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                          }`}>
                          {name}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={handleMultiTranslate} disabled={multiLangs.length === 0 || isMultiTranslating || !editableTranscript?.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-700 disabled:opacity-40 transition-all mb-3">
                    {isMultiTranslating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Translating...</> : <><Languages className="w-3.5 h-3.5" />Translate all</>}
                  </button>
                  {Object.keys(multiResults).length > 0 && (
                    <div className="space-y-3">
                      {Object.entries(multiResults).map(([lang, text]) => {
                        const langName = Object.entries(TARGET_LANGUAGES).find(([, c]) => c === lang)?.[0] || lang;
                        return (
                          <div key={lang} className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{langName}</span>
                              <button onClick={() => navigator.clipboard.writeText(text)}
                                className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors">Copy</button>
                            </div>
                            <p className="text-[15px] text-gray-700 leading-relaxed">{text}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tone rewriting */}
            <div className="mt-5 pt-5 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">{L.rewriteTone || "Rewrite tone"}</span>
                  <button onClick={handleSmartTone} disabled={isSuggestingTone || !editableTranscript?.trim()}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-100 text-amber-600 text-[11px] font-semibold hover:bg-amber-100 disabled:opacity-40 transition-all">
                    {isSuggestingTone ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    Smart suggest
                  </button>
                </div>
                {rewrittenText && (
                  <button onClick={() => { setRewrittenText(''); setSelectedTone(null); }}
                    className="text-[12px] text-gray-400 hover:text-gray-700 transition-colors">↩ Reset</button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {TONE_OPTIONS.map(t => (
                  <button key={t} onClick={() => handleToneClick(t)} disabled={isRewriting}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all disabled:opacity-40 ${
                      selectedTone === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-800'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
              {selectedTone === 'Custom' && (
                <div className="flex gap-2 mb-3">
                  <input value={customToneInput} onChange={e => setCustomToneInput(e.target.value)}
                    placeholder="Describe your tone (e.g. friendly and brief)"
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-[13px] focus:outline-none focus:border-gray-400 transition-all" />
                  <button onClick={() => handleRewrite('Custom')} disabled={!customToneInput.trim() || isRewriting}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-700 disabled:opacity-40 transition-all">
                    {isRewriting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Apply
                  </button>
                </div>
              )}
              {isRewriting && (
                <div className="flex items-center gap-2 text-[13px] text-gray-400 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Rewriting with AI...
                </div>
              )}
              {rewrittenText && !isRewriting && (
                <div className="animate-fade-in-blur">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span className="text-[11px] font-bold text-amber-500 uppercase tracking-widest">{selectedTone} · Rewritten</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <SpeakBtn onClick={() => speak(rewrittenText, 'en-IN')} isPlaying={isPlaying} disabled={!rewrittenText} />
                      <CopyBtn text={rewrittenText} />
                      <button onClick={handleSaveTemplate}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-amber-50 text-gray-400 hover:text-amber-600 text-[13px] font-medium border border-gray-200 hover:border-amber-200 transition-all">
                        <BookmarkPlus className="w-3.5 h-3.5" />Save
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={rewrittenText}
                    onChange={e => setRewrittenText(e.target.value)}
                    rows={Math.max(6, rewrittenText.split('\n').length + 2)}
                    className="w-full text-[15px] text-gray-800 leading-[1.85] font-normal tracking-[-0.01em] bg-amber-50 rounded-xl px-4 py-3 border border-amber-100 focus:outline-none focus:border-amber-300 resize-none transition-all"
                    spellCheck={false}
                  />
                  <div className="flex items-center gap-1 mt-1 mb-2">
                    <Hash className="w-3 h-3 text-gray-300" />
                    <span className="text-[11px] text-gray-300">{rwc} words · {rcc} chars</span>
                    {readability && (
                      <span className="ml-2 text-[11px] text-gray-400 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        Readability: <span className="font-semibold">{readability.label}</span> · {readability.grade}
                      </span>
                    )}
                  </div>
                  {/* Tone confidence */}
                  <div className="flex items-center gap-2 mb-2">
                    <button onClick={handleToneConfidence} disabled={isToneConfidence}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 text-[11px] font-semibold disabled:opacity-40 transition-all">
                      {isToneConfidence ? <Loader2 className="w-3 h-3 animate-spin" /> : <BarChart2 className="w-3 h-3" />}
                      Check tone fit
                    </button>
                    {toneConfidence && (
                      <div className="flex items-center gap-1.5 animate-fade-in-blur">
                        <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full border ${
                          toneConfidence.score >= 80 ? 'bg-green-50 text-green-600 border-green-100' :
                          toneConfidence.score >= 60 ? 'bg-amber-50 text-amber-600 border-amber-100' :
                          'bg-red-50 text-red-500 border-red-100'
                        }`}>{toneConfidence.score}% tone match</span>
                        {toneConfidence.feedback && <span className="text-[11px] text-gray-400">{toneConfidence.feedback}</span>}
                      </div>
                    )}
                  </div>
                  {/* Send via — context-aware per tone */}
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-gray-300 uppercase tracking-widest mr-1">Send via</span>
                    {CHANNELS.filter(ch => (TONE_TO_CHANNELS[selectedTone] || []).includes(ch.id)).map((ch) => (
                      <button key={ch.id} onClick={() => setActiveChannel(ch)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-[13px] font-semibold transition-all hover:shadow-sm active:scale-95 ${ch.bg} ${ch.border} ${ch.color}`}>
                        <ch.icon className="w-4 h-4" />
                        Send to {ch.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
              <Mic className="w-5 h-5 text-gray-400" strokeWidth={1.8} />
            </div>
            <p className="text-[15px] text-gray-400 font-medium">Press <span className="text-gray-700 font-semibold">Start Speaking</span> to begin</p>
            <p className="text-[12px] text-gray-300">Your transcript will appear here</p>
          </div>
        )}
      </div>

      {/* Fixed bottom toolbar */}
      <div className="fixed bottom-0 inset-x-0 flex justify-center z-50 pb-6 pt-16 bg-gradient-to-t from-[#f8f8f8] via-[#f8f8f8]/90 to-transparent pointer-events-none" style={{ left: 220 }}>
        <div className="pointer-events-auto">
          <RecordingControls />
        </div>
      </div>

      {/* Channel modal */}
      {activeChannel && (
        <ChannelModal channel={activeChannel} text={shareText} onClose={() => setActiveChannel(null)} />
      )}

      {/* Keyboard shortcuts cheatsheet */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[15px] font-bold text-gray-900 flex items-center gap-2"><Keyboard className="w-4 h-4" />Keyboard shortcuts</p>
              <button onClick={() => setShowShortcuts(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-all"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {[
                { keys: '⌘ + Enter', action: 'Translate transcript' },
                { keys: '⌘ + R',     action: 'Rewrite with active tone' },
                { keys: '⌘ + K',     action: 'Open command palette' },
                { keys: 'Space',     action: 'Push-to-talk (hold)' },
                { keys: 'Esc',       action: 'Close modals / panels' },
              ].map(({ keys, action }) => (
                <div key={keys} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-[13px] text-gray-600">{action}</span>
                  <kbd className="px-2 py-1 rounded-lg bg-gray-100 text-gray-700 text-[12px] font-mono font-semibold">{keys}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
