import { useState, useCallback } from 'react';
import RecordingControls from '../components/RecordingControls';
import { useApp } from '../context/AppContext';
import {
  Mic, Ear, Copy, Check, Download, Sparkles, Volume2, Square,
  Languages, Loader2, ChevronDown, Mail, Slack, Linkedin,
  MessageSquare, X, Send, ExternalLink
} from 'lucide-react';
import { useSpeech } from '../hooks/useSpeech';
import * as api from '../services/api';

const MODES = (RM) => [
  { id: RM.PUSH_TO_TALK, icon: Mic, title: 'Start Speaking', desc: 'Record live with push-to-talk', color: 'from-gray-900 to-gray-700' },
  { id: RM.CONTINUOUS,   icon: Ear, title: 'Continuous Listening', desc: 'Hands-free with silence detection', color: 'from-gray-700 to-gray-500' },
];

const CHANNELS = [
  { id: 'email',    label: 'Email',     icon: Mail,         color: 'text-blue-500',   bg: 'bg-blue-50',   border: 'border-blue-100'   },
  { id: 'slack',    label: 'Slack',     icon: Slack,        color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-100' },
  { id: 'linkedin', label: 'LinkedIn',  icon: Linkedin,     color: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-100'    },
  { id: 'whatsapp', label: 'WhatsApp',  icon: MessageSquare,color: 'text-green-500',  bg: 'bg-green-50',  border: 'border-green-100'  },
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
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
        isPlaying ? 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100'
                  : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 hover:text-gray-800'}`}>
      {isPlaying ? <><Square className="w-3.5 h-3.5 fill-red-500" /> Stop</> : <><Volume2 className="w-3.5 h-3.5" /> Speak</>}
    </button>
  );
}

/* ── Channel tone map — used for tone-to-channel mapping only ── */

const TONE_OPTIONS = ['Email Formal', 'Email Casual', 'Slack', 'LinkedIn', 'WhatsApp Business', 'Custom'];

/* ── Which channels to show per tone ── */
const TONE_TO_CHANNELS = {
  'Email Formal':      ['email'],
  'Email Casual':      ['email'],
  'Slack':             ['slack'],
  'LinkedIn':          ['linkedin'],
  'WhatsApp Business': ['whatsapp'],
  'Custom':            ['email', 'slack', 'linkedin', 'whatsapp'], // show all for custom
};

function ChannelModal({ channel, text, onClose }) {
  const { state, setField } = useApp();
  const creds = state.channelCredentials || {};
  const [toEmail, setToEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [errMsg, setErrMsg] = useState('');

  const hasCredentials = {
    email:    true,
    slack:    !!creds.slackWebhook?.trim(),
    linkedin: true,
    whatsapp: !!creds.whatsappPhone?.trim(),
  }[channel.id];

  const goToProfile = () => { onClose(); setField('currentView', 'profile'); };
  const canSend = channel.id === 'email' ? !!toEmail.trim() : true;

  const handleSend = async () => {
    setStatus('sending');
    try {
      if (channel.id === 'email') {
        const subject = encodeURIComponent(creds.emailSubject || 'Message from TransUI');
        const body = encodeURIComponent(text);
        window.open(`mailto:${toEmail.trim()}?subject=${subject}&body=${body}`, '_blank');
        setStatus('ok');
        return;
      } else if (channel.id === 'slack') {
        await api.sendToSlack({ text, webhookUrl: creds.slackWebhook });
      } else if (channel.id === 'linkedin') {
        await api.shareToLinkedIn({ text, addHashtags: true });
      } else if (channel.id === 'whatsapp') {
        const encoded = encodeURIComponent(text);
        const num = creds.whatsappPhone.replace(/\D/g, '');
        window.open(`https://wa.me/${num}?text=${encoded}`, '_blank');
        setStatus('ok');
        return;
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
        {/* Header */}
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
            {/* Message preview */}
            <div className="mb-4">
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">Message preview</label>
              <div className="px-4 py-3 rounded-xl border border-amber-100 bg-amber-50 text-[13px] text-gray-700 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                {text.slice(0, 400) + (text.length > 400 ? '…' : '')}
              </div>
            </div>

            {/* Channel-specific fields */}
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
  const { state, setField, setFields, RECORDING_MODES, TARGET_LANGUAGES, showError } = useApp();
  const { isPlaying, speak } = useSpeech();
  const [isTranslating, setIsTranslating] = useState(false);
  const [activeChannel, setActiveChannel] = useState(null);
  const [selectedTone, setSelectedTone] = useState(null);
  const [rewrittenText, setRewrittenText] = useState('');
  const [customToneInput, setCustomToneInput] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);

  const handleSpeakEnglish = useCallback(() => speak(rewrittenText || state.englishText, 'en-IN'), [speak, rewrittenText, state.englishText]);
  const handleSpeakNative  = useCallback(() => speak(state.nativeTranslation, state.selectedLanguage), [speak, state.nativeTranslation, state.selectedLanguage]);

  const handleRewrite = useCallback(async (tone) => {
    if (!state.englishText?.trim()) return;
    setIsRewriting(true);
    setRewrittenText('');
    try {
      const result = await api.rewriteTone(
        state.englishText,
        tone === 'Custom' ? 'User Override' : tone,
        tone === 'Custom' ? customToneInput : null
      );
      setRewrittenText(result);
    } catch (err) {
      showError(err.response?.data?.detail || 'Rewrite failed');
    } finally {
      setIsRewriting(false);
    }
  }, [state.englishText, customToneInput, showError]);

  const handleToneClick = (tone) => {
    setSelectedTone(tone);
    if (tone !== 'Custom') handleRewrite(tone);
  };

  const handleTranslate = useCallback(async () => {
    if (!state.englishText?.trim()) return;
    setIsTranslating(true);
    try {
      const translated = await api.translateText(state.englishText, state.selectedLanguage);
      setField('nativeTranslation', translated);
    } catch (err) {
      showError(err.response?.data?.detail || 'Translation error');
    } finally {
      setIsTranslating(false);
    }
  }, [state.englishText, state.selectedLanguage, setField, showError]);

  const handleLangChange = useCallback((lang) => {
    setFields({ selectedLanguage: lang, nativeTranslation: '' });
  }, [setFields]);

  const handleDownload = () => {
    const text = rewrittenText || state.nativeTranslation || state.englishText;
    if (!text) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = 'transcript.txt';
    a.click();
  };

  // Clear rewrite when transcript changes
  const handleClear = () => {
    setField('englishText', '');
    setRewrittenText('');
    setSelectedTone(null);
  };

  const shareText = rewrittenText || state.nativeTranslation || state.englishText;

  if (!state.recordingMode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 bg-[#f8f8f8]">
        <div className="text-center mb-12 max-w-xl">
          <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-1.5 mb-6 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider">Powered by Seedlinglabs</span>
          </div>
          <h1 className="text-[2.6rem] font-extrabold text-gray-900 leading-[1.15] tracking-tight mb-4">
            Transcribe speech,<br />
            <span className="text-gray-400">get instant transcripts</span>
          </h1>
          <p className="text-gray-400 text-[16px] leading-relaxed">
            Record live or upload audio to transcribe in multiple Indian languages
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-[500px]">
          {MODES(RECORDING_MODES).map((m) => (
            <button key={m.id} onClick={() => setField('recordingMode', m.id)}
              className="group relative bg-white rounded-2xl border border-gray-200 p-6 text-left hover:border-gray-300 hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${m.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform shadow-sm">
                <m.icon className="w-4.5 h-4.5 text-white" strokeWidth={2} />
              </div>
              <p className="text-[15px] font-bold text-gray-900 mb-1">{m.title}</p>
              <p className="text-[13px] text-gray-400 leading-relaxed">{m.desc}</p>
              <div className="mt-4 flex items-center gap-1 text-[12px] font-semibold text-gray-400 group-hover:text-gray-700 transition-colors">
                Get started <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f8f8]">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px]">
          <button onClick={() => setField('recordingMode', null)} className="text-gray-400 hover:text-gray-700 transition-colors font-medium">Home</button>
          <span className="text-gray-200">/</span>
          <span className="text-gray-900 font-semibold">Speech to Text</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-[12px] text-gray-400 font-medium">Saaras v2.5</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-10 pt-10 pb-40 max-w-3xl w-full mx-auto">
        {state.englishText ? (
          <div className="animate-fade-in-blur">

            {/* Label + actions */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">Transcript</span>
              <div className="flex items-center gap-1.5">
                <SpeakBtn onClick={handleSpeakEnglish} isPlaying={isPlaying} disabled={!state.englishText} />
                <CopyBtn text={rewrittenText || state.englishText} />
                <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-700 text-[13px] font-medium transition-all">
                  <Download className="w-3.5 h-3.5" />Save
                </button>
                <button onClick={handleClear} className="px-3 py-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 text-[13px] font-medium transition-all">
                  Clear
                </button>
              </div>
            </div>

            {/* Transcript text */}
            <p className="text-[18px] text-gray-800 leading-[1.9] whitespace-pre-wrap font-normal tracking-[-0.01em]">
              {state.englishText}
            </p>

            {/* ── Tone rewriting ── */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">Rewrite tone</span>
                {rewrittenText && (
                  <button onClick={() => { setRewrittenText(''); setSelectedTone(null); }}
                    className="text-[12px] text-gray-400 hover:text-gray-700 transition-colors">
                    ↩ Reset
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {TONE_OPTIONS.map(t => (
                  <button key={t} onClick={() => handleToneClick(t)}
                    disabled={isRewriting}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all disabled:opacity-40 ${
                      selectedTone === t
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-800'
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
                    </div>
                  </div>
                  <textarea
                    value={rewrittenText}
                    onChange={e => setRewrittenText(e.target.value)}
                    rows={Math.max(6, rewrittenText.split('\n').length + 2)}
                    className="w-full text-[15px] text-gray-800 leading-[1.85] font-normal tracking-[-0.01em] bg-amber-50 rounded-xl px-4 py-3 border border-amber-100 focus:outline-none focus:border-amber-300 resize-none transition-all whitespace-pre-wrap"
                    spellCheck={false}
                  />
                  {/* Send via row — context-aware based on selected tone */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
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

            {/* Translate row */}
            <div className="mt-8 flex items-center gap-3">
              <div className="relative">
                <select value={state.selectedLanguage} onChange={(e) => handleLangChange(e.target.value)}
                  className="appearance-none bg-white border border-gray-200 rounded-xl pl-3 pr-7 py-2 text-[13px] font-medium text-gray-600 cursor-pointer focus:outline-none hover:border-gray-300 transition-all shadow-sm">
                  {Object.entries(TARGET_LANGUAGES).map(([name, code]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
              <button onClick={handleTranslate} disabled={!state.englishText?.trim() || isTranslating}
                className="flex items-center gap-2 bg-gray-900 text-white rounded-xl px-4 py-2 text-[13px] font-semibold hover:bg-gray-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 shadow-sm">
                {isTranslating
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Translating...</>
                  : <><Languages className="w-3.5 h-3.5" />Translate</>}
              </button>
            </div>

            {/* Translation output */}
            {state.nativeTranslation && (
              <div className="mt-8 pt-8 border-t border-gray-100 animate-fade-in-blur">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">
                    Translation · {state.selectedLanguage}
                  </span>
                  <SpeakBtn onClick={handleSpeakNative} isPlaying={isPlaying} disabled={!state.nativeTranslation} />
                </div>
                <p className="text-[18px] text-gray-700 leading-[1.9] whitespace-pre-wrap font-normal tracking-[-0.01em]">
                  {state.nativeTranslation}
                </p>
              </div>
            )}



          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
              <Mic className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-[15px] text-gray-300 font-medium">Start speaking to see transcript</p>
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
    </div>
  );
}
