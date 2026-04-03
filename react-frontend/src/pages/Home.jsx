import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import RecordingControls from '../components/RecordingControls';
import PushToTalkRecorder from '../components/PushToTalkRecorder';
import { useApp } from '../context/AppContext';
import {
  Mic, Ear, Copy, Check, Download, Sparkles, Volume2, Square,
  Languages, Loader2, ChevronDown, Mail, Slack, Linkedin,
  MessageSquare, X, Send, ExternalLink, BookmarkPlus, Hash,
  Upload, Smile, Frown, Minus, Wand2, FileAudio, Trash2,
  AlignLeft, ClipboardList, HelpCircle, Link, ChevronUp, ChevronDown as ChevronDownIcon,
  ArrowLeftRight, BookOpen, BarChart2, Globe2, Tag, Keyboard, Pin, RotateCcw
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
      <Icon className="w-3 h-3" />Sentiment: {sentiment} · {score}%
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
        let subject = creds.emailSubject || 'Message from SeedlingSpeaks';
        let body = text;
        const subjectMatch = text.match(/^Subject:\s*(.+?)[\r\n]/i);
        if (subjectMatch) {
          subject = subjectMatch[1].trim();
          body = text.replace(/^Subject:\s*.+?[\r\n]+/i, '').trim();
        }
        window.open(`mailto:${toEmail.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
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
  // New UI changes - for comprehensive output box redesign
  const [showOriginalTranscript, setShowOriginalTranscript] = useState(true);
  const [showRetoneDropdown, setShowRetoneDropdown] = useState(false);
  const [selectedRetoneForDropdown, setSelectedRetoneForDropdown] = useState(null);
  const [translatedOriginal, setTranslatedOriginal] = useState('');
  const [translatedRetone, setTranslatedRetone] = useState('');
  const [showTranslation, setShowTranslation] = useState(false);
  const prevEnglishText = useRef('');

  // Reset playback state on unmount to avoid stuck "playing" indicators
  useEffect(() => {
    return () => {
      setFields({ isPlayingEnglish: false, isPlayingRewritten: false, isPlayingNative: false });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setShowOriginalTranscript(false);
    setShowTranslation(false);
    try {
      const result = await api.rewriteTone(
        text,
        tone === 'Custom' ? 'User Override' : tone,
        tone === 'Custom' ? customToneInput : null,
        state.customDictionary?.length ? state.customDictionary : null,
      );
      if (!result || !result.trim()) {
        showError('Retone returned empty. Please try again.');
        setShowOriginalTranscript(true);
        return;
      }
      setRewrittenText(result);
      incrementUsage('geminiCalls');
      api.getReadability(result).then(setReadability).catch(() => {});
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Rewrite failed';
      showError(msg);
      setShowOriginalTranscript(true);
    } finally {
      setIsRewriting(false);
    }
  }, [editableTranscript, state.englishText, state.customDictionary, customToneInput, showError, incrementUsage]);

  const handleToneClick = (tone) => {
    setSelectedTone(tone);
    setShowOriginalTranscript(false);
    setShowTranslation(false);
    if (tone !== 'Custom') handleRewrite(tone);
  };

  const handleRetoneDropdownApply = useCallback(async () => {
    if (!selectedRetoneForDropdown) return;
    setShowRetoneDropdown(false);
    setSelectedTone(selectedRetoneForDropdown);
    await handleRewrite(selectedRetoneForDropdown);
  }, [selectedRetoneForDropdown]);

  const handleTranslate = useCallback(async () => {
    // Translate the currently displayed version (Original or Retoned)
    const textToTranslate = showOriginalTranscript ? editableTranscript : (rewrittenText || editableTranscript);
    if (!textToTranslate?.trim()) return;
    
    setIsTranslating(true);
    try {
      const translated = await api.translateText(textToTranslate, state.selectedLanguage);
      // Store translation in appropriate state based on current view
      if (showOriginalTranscript) {
        setTranslatedOriginal(translated);
      } else {
        setTranslatedRetone(translated);
      }
      setShowTranslation(true);
      incrementUsage('sarvamCalls');
    } catch (err) {
      showError(err.response?.data?.detail || 'Translation error');
    } finally {
      setIsTranslating(false);
    }
  }, [editableTranscript, rewrittenText, showOriginalTranscript, state.selectedLanguage, showError, incrementUsage]);

  const handleLangChange = useCallback((lang) => {
    setFields({ selectedLanguage: lang });
    // Clear translations when language changes
    setTranslatedOriginal('');
    setTranslatedRetone('');
    setShowTranslation(false);
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
    setTranslatedOriginal('');
    setTranslatedRetone('');
    setShowTranslation(false);
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

  const handleSendClick = useCallback(() => {
    if (!shareText?.trim()) return;
    const inferredChannelId = selectedTone ? (TONE_TO_CHANNELS[selectedTone]?.[0] || 'email') : 'email';
    const trimmedText = shareText.trim();

    if (inferredChannelId === 'email') {
      let subject = 'Message from SeedlingSpeaks';
      let body = trimmedText;
      const subjectMatch = trimmedText.match(/^Subject:\s*(.+?)[\r\n]/i);
      if (subjectMatch) {
        subject = subjectMatch[1].trim();
        body = trimmedText.replace(/^Subject:\s*.+?[\r\n]+/i, '').trim();
      }
      window.open(
        `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
        '_blank'
      );
      return;
    }

    if (inferredChannelId === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(trimmedText)}`, '_blank');
      return;
    }

    if (inferredChannelId === 'slack') {
      navigator.clipboard.writeText(trimmedText).catch(() => {});
      const slackWindow = window.open('slack://open', '_blank');
      if (!slackWindow) {
        window.open('https://app.slack.com/client', '_blank');
      }
      showSuccess('Message copied. Paste it into Slack.');
      return;
    }

    if (inferredChannelId === 'linkedin') {
      navigator.clipboard.writeText(trimmedText).catch(() => {});
      window.open('https://www.linkedin.com/feed/', '_blank');
      showSuccess('Post copied. Paste it into LinkedIn.');
      return;
    }
  }, [shareText, selectedTone, showSuccess]);

  // ── File upload mode ──
  if (state.recordingMode === RECORDING_MODES.FILE_UPLOAD && !editableTranscript) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <button onClick={() => setField('recordingMode', null)} style={{ color: 'var(--text-faded)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>Home</button>
          <span style={{ color: 'var(--text-faded)' }}>/</span>
          <span style={{ color: 'var(--text-ink)', fontWeight: 600 }}>{L.uploadAudio || "Upload Audio"}</span>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', maxWidth: 600, margin: '0 auto' }}>
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

  // Unified mode state
  const activeMode = showTranslation ? 'translation' : (rewrittenText && !showOriginalTranscript) ? 'retoned' : 'transcript';
  
  const getModeTitle = () => {
    if (activeMode === 'translation') return `Translation · ${state.selectedLanguage}`;
    if (activeMode === 'retoned') return `Retoned · ${selectedTone || 'Select tone'}`;
    return 'Transcript';
  };

  const getModeContent = () => {
    if (activeMode === 'translation') return translatedRetone || translatedOriginal;
    if (activeMode === 'retoned') return rewrittenText;
    return editableTranscript;
  };

  const getModeWordCount = () => {
    const content = getModeContent();
    if (!content) return { words: 0, chars: 0 };
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const chars = content.length;
    return { words, chars };
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Top bar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'var(--surface-ink)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Mic style={{ width: '24px', height: '24px', color: 'var(--saffron)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ color: 'var(--text-ink)', fontWeight: 600, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', fontSize: '1.05rem' }}>
              {L.speechToText || "Speech to Text"}
            </span>
            <span style={{ color: 'var(--text-faded)', fontSize: '0.82rem', fontWeight: 500 }}>
              {editableTranscript?.trim() ? 'Transcript ready to edit' : 'Ready to start'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--text-faded)', display: 'none' }}>⌘↵ translate · ⌘R rewrite</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--saffron-light)', color: 'var(--saffron)', borderRadius: 'var(--r-pill)', padding: '4px 12px', fontSize: 11, fontWeight: 700 }}>
            SeedlingSpeaks v2.5
          </span>
        </div>
      </div>

      {/* Main content - REFACTORED: No max-width constraint, full workspace */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', width: '100%', minHeight: 0 }}>

        {editableTranscript ? (
          <div className="animate-fade-in-blur" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', flex: 1, gap: '24px' }}>
            
            {/* ===== UNIFIED TOOLBAR (Language, Translate, Retone) ===== */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Language selector */}
              <div style={{ position: 'relative' }}>
                <select value={state.selectedLanguage} onChange={(e) => handleLangChange(e.target.value)}
                  style={{ appearance: 'none', background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '6px', paddingLeft: '10px', paddingRight: '28px', paddingTop: '6px', paddingBottom: '6px', fontSize: '12px', fontWeight: 500, color: 'rgb(75, 85, 99)', cursor: 'pointer', outline: 'none', transition: 'all 0.2s' }}>
                  {Object.entries(TARGET_LANGUAGES).map(([name, code]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
                <ChevronDown style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', color: 'rgb(156, 163, 175)', pointerEvents: 'none' }} />
              </div>

              {/* Translate button */}
              <button onClick={handleTranslate} disabled={!(showOriginalTranscript ? editableTranscript?.trim() : (rewrittenText || editableTranscript)?.trim()) || isTranslating}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: isTranslating ? 'rgb(107, 114, 128)' : 'rgb(17, 24, 39)', color: 'white', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: (showOriginalTranscript ? editableTranscript?.trim() : (rewrittenText || editableTranscript)?.trim()) && !isTranslating ? 'pointer' : 'not-allowed', opacity: !(showOriginalTranscript ? editableTranscript?.trim() : (rewrittenText || editableTranscript)?.trim()) || isTranslating ? 0.3 : 1, transition: 'all 0.2s' }}
                onMouseEnter={e => { if ((showOriginalTranscript ? editableTranscript?.trim() : (rewrittenText || editableTranscript)?.trim()) && !isTranslating) e.target.style.background = 'rgb(31, 41, 55)'; }}
                onMouseLeave={e => { e.target.style.background = isTranslating ? 'rgb(107, 114, 128)' : 'rgb(17, 24, 39)'; }}>
                {isTranslating ? <Loader2 style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} /> : <ArrowLeftRight style={{ width: '12px', height: '12px' }} />}
                Translate
              </button>

              {/* Retone dropdown button */}
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowRetoneDropdown(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1px solid rgba(0,0,0,0.06)', color: 'rgb(75, 85, 99)', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', outline: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.target.style.borderColor = 'rgba(0,0,0,0.12)'}
                  onMouseLeave={e => e.target.style.borderColor = 'rgba(0,0,0,0.06)'}>
                  Retone
                  {showRetoneDropdown ? <ChevronUp style={{ width: '14px', height: '14px' }} /> : <ChevronDown style={{ width: '14px', height: '14px' }} />}
                </button>

                {/* Retone dropdown menu */}
                {showRetoneDropdown && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', background: 'white', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '180px' }}>
                    <div style={{ padding: '4px' }}>
                      {TONE_OPTIONS.map(t => (
                        <button key={t} onClick={() => { handleToneClick(t); setShowRetoneDropdown(false); }} disabled={isRewriting}
                          style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '13px', fontWeight: 500, color: selectedTone === t ? 'var(--saffron)' : 'rgb(75, 85, 99)', background: selectedTone === t ? 'rgba(232, 130, 12, 0.1)' : 'transparent', border: 'none', cursor: isRewriting ? 'not-allowed' : 'pointer', opacity: isRewriting ? 0.4 : 1, transition: 'all 0.2s', borderRadius: '4px' }}
                          onMouseEnter={e => { if (!isRewriting) e.target.style.background = 'rgba(0,0,0,0.03)'; }}
                          onMouseLeave={e => { if (selectedTone !== t) e.target.style.background = 'transparent'; }}>
                          {t}
                        </button>
                      ))}
                    </div>
                    {selectedTone === 'Custom' && (
                      <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', padding: '8px' }}>
                        <input value={customToneInput} onChange={e => setCustomToneInput(e.target.value)}
                          placeholder="Describe tone..."
                          style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '4px', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }} />
                        <button onClick={() => { handleRewrite('Custom'); setShowRetoneDropdown(false); }} disabled={!customToneInput.trim() || isRewriting}
                          style={{ width: '100%', padding: '6px 8px', fontSize: '12px', fontWeight: 600, background: 'rgb(17, 24, 39)', color: 'white', border: 'none', borderRadius: '4px', cursor: customToneInput.trim() && !isRewriting ? 'pointer' : 'not-allowed', opacity: !customToneInput.trim() || isRewriting ? 0.4 : 1, transition: 'all 0.2s' }}>
                          {isRewriting ? 'Applying...' : 'Apply'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ===== UNIFIED MODE TOGGLE (Transcript | Retoned | Translation) ===== */}
            {(rewrittenText || translatedOriginal || translatedRetone) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(0,0,0,0.06)' }}>
                <button onClick={() => {  setShowOriginalTranscript(true); setShowTranslation(false); }}
                  style={{ flex: 1, padding: '8px 12px', fontSize: '12px', fontWeight: 600, background: activeMode === 'transcript' ? 'rgb(17, 24, 39)' : 'transparent', color: activeMode === 'transcript' ? 'white' : 'rgb(75, 85, 99)', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}>
                  Transcript
                </button>
                {rewrittenText && (
                  <button onClick={() => { setShowOriginalTranscript(false); setShowTranslation(false); }}
                    style={{ flex: 1, padding: '8px 12px', fontSize: '12px', fontWeight: 600, background: activeMode === 'retoned' ? 'rgb(17, 24, 39)' : 'transparent', color: activeMode === 'retoned' ? 'white' : 'rgb(75, 85, 99)', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}>
                    Retoned
                  </button>
                )}
                {(translatedOriginal || translatedRetone) && (
                  <button onClick={() => setShowTranslation(true)}
                    style={{ flex: 1, padding: '8px 12px', fontSize: '12px', fontWeight: 600, background: activeMode === 'translation' ? 'rgb(17, 24, 39)' : 'transparent', color: activeMode === 'translation' ? 'white' : 'rgb(75, 85, 99)', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}>
                    Translation
                  </button>
                )}
              </div>
            )}

            {/* ===== OUTPUT PANEL (Structured: Header/Content/Footer) ===== */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--surface)', borderRadius: 'var(--r-xl)', border: '2px solid transparent', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', transition: 'border-color 0.2s', position: 'relative' }}
              onMouseEnter={e => e.target.style.borderColor = 'rgba(232, 130, 12, 0.2)'}
              onMouseLeave={e => e.target.style.borderColor = 'transparent'}>
              
              {/* Retoning overlay */}
              {isRewriting && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(253, 250, 244, 0.88)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: 'var(--r-xl)', padding: '24px' }}>
                  <div style={{ width: 'min(320px, 100%)', background: '#FFFFFF', borderRadius: '24px', boxShadow: '0 14px 42px rgba(60,40,20,0.12)', border: '1px solid rgba(232,130,12,0.14)', padding: '26px 24px 22px', display: 'grid', justifyItems: 'center', gap: '12px', textAlign: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', position: 'relative', display: 'grid', placeItems: 'center', background: 'rgba(232,130,12,0.06)' }}>
                      <div style={{ position: 'absolute', inset: '8px', borderRadius: '50%', border: '1px solid rgba(232,130,12,0.18)', animation: 'retoneOrbit 1.2s linear infinite' }}>
                        <span style={{ position: 'absolute', top: '-3px', left: '50%', transform: 'translateX(-50%)', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--saffron)', boxShadow: '0 0 0 4px rgba(232,130,12,0.10)' }} />
                      </div>
                      <Loader2 style={{ width: '20px', height: '20px', color: 'var(--saffron)', opacity: 0.9 }} />
                    </div>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.12rem', fontWeight: 600, color: 'var(--text-ink)', letterSpacing: '-0.02em' }}>Shaping your message</span>
                      <span style={{ fontSize: '14px', color: 'var(--text-warm)', lineHeight: 1.55 }}>
                        Retoning for {selectedTone || 'your selected tone'}...
                      </span>
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', marginTop: '2px' }}>
                      {[0, 1, 2].map((index) => (
                        <span
                          key={index}
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: index === 1 ? 'rgba(232,130,12,0.72)' : 'rgba(232,130,12,0.32)',
                            animation: `retoneDotPulse 1s ease-in-out ${index * 0.14}s infinite`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* HEADER: Title, confidence, sentiment, and actions */}
              <div style={{ padding: '20px 20px 12px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  {/* Mode title with confidence badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-ink)' }}>{getModeTitle()}</span>
                    {confPct != null && activeMode !== 'translation' && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '4px', border: `1px solid currentColor`, fontSize: '11px', fontWeight: 600, color: confColor.includes('green') ? 'rgb(34, 197, 94)' : confColor.includes('amber') ? 'rgb(217, 119, 6)' : 'rgb(239, 68, 68)' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', opacity: 0.7 }} />
                        {confPct}%
                      </span>
                    )}
                  </div>
                  {sentiment && activeMode !== 'translation' && <SentimentBadge {...sentiment} />}
                </div>

                {/* Header actions: Speak, Copy, Save, Clear */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <SpeakBtn onClick={activeMode === 'translation' ? handleSpeakNative : () => speak(getModeContent())} isPlaying={isPlaying} disabled={!getModeContent()} />
                  <CopyBtn text={getModeContent()} />
                  <button onClick={() => { setField('englishText', editableTranscript); showSuccess('Saved to history'); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.1)', color: 'rgb(107, 114, 128)', fontSize: '12px', fontWeight: 500, background: 'white', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => e.target.style.background = 'rgba(0,0,0,0.03)'}
                    onMouseLeave={e => e.target.style.background = 'white'}>
                    <Download style={{ width: '12px', height: '12px' }} />
                    Save
                  </button>
                  <button onClick={handleClear}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.1)', color: 'rgb(239, 68, 68)', fontSize: '12px', fontWeight: 500, background: 'white', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => e.target.style.background = 'rgba(239, 68, 68, 0.05)'}
                    onMouseLeave={e => e.target.style.background = 'white'}>
                    <Trash2 style={{ width: '12px', height: '12px' }} />
                    Clear
                  </button>
                </div>
              </div>

              {/* CONTENT: Textarea with text output */}
              <textarea
                value={getModeContent()}
                onChange={e => {
                  if (activeMode === 'retoned') setRewrittenText(e.target.value);
                  else if (activeMode === 'transcript') setEditableTranscript(e.target.value);
                }}
                readOnly={activeMode === 'translation'}
                style={{ flex: 1, width: '100%', fontSize: '16px', lineHeight: 1.8, color: 'var(--text-ink)', background: 'transparent', padding: '20px', border: 'none', outline: 'none', resize: 'none', fontFamily: 'var(--font)', overflow: 'auto', cursor: activeMode === 'translation' ? 'default' : 'text' }}
                spellCheck={false}
                placeholder="Your transcript will appear here..."
              />

              {/* FOOTER: Language, Translate link, Send button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid rgba(0,0,0,0.06)', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <Hash style={{ width: '12px', height: '12px', color: 'var(--text-faded)' }} />
                  <span style={{ fontSize: '11px', color: 'var(--text-faded)' }}>{getModeWordCount().words} words · {getModeWordCount().chars} chars</span>
                </div>

                {/* Send button (right-aligned) */}
                <button
                  onClick={handleSendClick}
                  disabled={!shareText?.trim()}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', background: 'var(--saffron)', color: 'white', border: 'none', cursor: shareText?.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.2s', flexShrink: 0, opacity: shareText?.trim() ? 1 : 0.45 }}
                  onMouseEnter={e => { if (shareText?.trim()) e.target.style.background = 'rgb(217, 119, 6)'; }}
                  onMouseLeave={e => { e.target.style.background = 'var(--saffron)'; }}
                  title="Send">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </div>
            </div>

            {/* ===== SECONDARY ACTION: Record Again (Bottom center button) ===== */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '24px', paddingBottom: '24px' }}>
              <button onClick={handleClear} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '24px', background: 'rgb(17, 24, 39)', color: 'white', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                onMouseEnter={e => { e.target.style.background = 'rgb(31, 41, 55)'; e.target.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)'; }}
                onMouseLeave={e => { e.target.style.background = 'rgb(17, 24, 39)'; e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; }}>
                <Mic style={{ width: '18px', height: '18px' }} />
                Record Again
              </button>
            </div>

          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '24px' }}>
            {/* Empty state content - centered vertically */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
              {/* Empty state icon */}
              <div style={{ width: 72, height: 72, borderRadius: 20, background: state.isRecording ? 'var(--saffron-light)' : 'var(--surface)', boxShadow: state.isRecording ? '0 8px 24px rgba(232,130,12,0.18)' : 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mic style={{ width: 28, height: 28, color: state.isRecording ? 'var(--saffron)' : 'var(--text-faded)' }} strokeWidth={1.8} />
              </div>

              {/* Empty state text */}
              <div style={{ textAlign: 'center' }}>
                {state.isRecording ? (
                  <>
                    <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-ink)', margin: 0 }}>
                      Your voice is turning into text in real time
                    </p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-faded)', margin: '6px 0 0 0', maxWidth: '360px', lineHeight: 1.6 }}>
                      Keep talking naturally. We are listening for the important parts and shaping a clean transcript for you.
                    </p>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-ink)', margin: 0 }}>Press <span style={{ color: 'var(--saffron)' }}>Start Speaking</span> to begin</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-faded)', margin: '4px 0 0 0' }}>Your transcript will appear here</p>
                  </>
                )}
              </div>
            </div>
            
            {/* Recording controls - bottom section */}
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              <RecordingControls />
            </div>
          </div>
        )}
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
