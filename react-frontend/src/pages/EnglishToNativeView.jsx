import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  ChevronDown, Volume2, Square, Loader2, Languages,
  Mail, Slack, Linkedin, MessageSquare, X, Send, ExternalLink, Check
} from 'lucide-react';
import * as api from '../services/api';
import { getLabels } from '../services/uiLabels';
import { useSpeech } from '../hooks/useSpeech';

const TONES = ['Email', 'LinkedIn', 'Formal', 'Casual'];
const TONE_MAP = { Email: 'Email Formal', LinkedIn: 'LinkedIn', Formal: 'Email Formal', Casual: 'Email Casual' };

/* Which channel to show per tone */
const TONE_TO_CHANNEL = {
  'Email':    'email',
  'Formal':   'email',
  'Casual':   'email',
  'LinkedIn': 'linkedin',
};

const LANG_LABELS = {
  'hi-IN': 'Hindi', 'bn-IN': 'Bengali', 'ta-IN': 'Tamil', 'te-IN': 'Telugu',
  'ml-IN': 'Malayalam', 'mr-IN': 'Marathi', 'gu-IN': 'Gujarati',
  'kn-IN': 'Kannada', 'pa-IN': 'Punjabi', 'or-IN': 'Odia',
};

const LANG_DOT_COLORS = {
  'hi-IN': '#f97316', 'bn-IN': '#8b5cf6', 'ta-IN': '#ec4899', 'te-IN': '#06b6d4',
  'ml-IN': '#10b981', 'mr-IN': '#f59e0b', 'gu-IN': '#3b82f6',
  'kn-IN': '#ef4444', 'pa-IN': '#84cc16', 'or-IN': '#6366f1',
};

const CHANNELS = [
  { id: 'email',    label: 'Email',    icon: Mail,          color: 'text-blue-500',   bg: 'bg-blue-50',   border: 'border-blue-100'   },
  { id: 'slack',    label: 'Slack',    icon: Slack,         color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-100' },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin,      color: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-100'    },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: 'text-green-500',  bg: 'bg-green-50',  border: 'border-green-100'  },
];

/* ── Minimal send modal (reuses translated text directly) ── */
function SendModal({ channel, text, onClose }) {
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
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-all"><X className="w-4 h-4" /></button>
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
                <input type="email" value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="recipient@example.com" autoFocus
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-[14px] focus:outline-none focus:border-gray-400 transition-all" />
              </div>
            )}
            {(channel.id === 'slack' || channel.id === 'whatsapp') && (
              <div className="mb-4 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 text-[12px] text-gray-400">
                {channel.id === 'slack' && <>Webhook: <span className="font-semibold text-gray-700">{creds.slackWebhook?.slice(0, 35)}…</span></>}
                {channel.id === 'whatsapp' && <>To: <span className="font-semibold text-gray-700">+{creds.whatsappPhone}</span></>}
                <button onClick={goToProfile} className="ml-2 underline underline-offset-2 hover:text-gray-700">Change →</button>
              </div>
            )}
            {status === 'ok' && (
              <div className="mb-4 px-4 py-2.5 bg-green-50 border border-green-100 rounded-xl text-[13px] text-green-700 flex items-center gap-2">
                <Check className="w-4 h-4" /> Sent successfully
              </div>
            )}
            {status === 'err' && <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">{errMsg}</div>}
            <div className="flex items-center justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-[13px] font-medium text-gray-500 hover:bg-gray-100 transition-all">Cancel</button>
              {status !== 'ok' && (
                <button onClick={handleSend} disabled={status === 'sending' || !canSend}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    channel.id === 'whatsapp' ? 'bg-green-500 hover:bg-green-600' :
                    channel.id === 'linkedin' ? 'bg-sky-600 hover:bg-sky-700' :
                    channel.id === 'slack'    ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {status === 'sending' ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Sending...</> :
                    (channel.id === 'whatsapp' || channel.id === 'email')
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

export default function EnglishToNativeView() {
  const { state, setField, setFields, showError, TARGET_LANGUAGES } = useApp();
  const L = getLabels(state.uiLanguage);
  const [selectedTone, setSelectedTone] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [activeChannel, setActiveChannel] = useState(null);
  const { isPlaying, speak } = useSpeech();

  const doTranslate = useCallback(async (text, lang) => {
    if (!text?.trim()) return;
    setIsTranslating(true);
    try {
      const translated = await api.translateText(text, lang);
      setFields({ nativeTranslation: translated, rewrittenText: '' });
    } catch (err) {
      showError(err.response?.data?.detail || 'Translation error');
    } finally {
      setIsTranslating(false);
    }
  }, [setFields, showError]);

  const doToneTranslate = useCallback(async (text, lang, tone) => {
    if (!text?.trim()) return;
    setIsTranslating(true);
    try {
      const rewritten = await api.rewriteTone(text, TONE_MAP[tone] || tone);
      const translated = await api.translateText(rewritten, lang);
      setFields({ rewrittenText: rewritten, nativeTranslation: translated });
    } catch (err) {
      showError(err.response?.data?.detail || 'Tone rewrite error');
    } finally {
      setIsTranslating(false);
    }
  }, [setFields, showError]);

  const handleTranslateClick = () => { setSelectedTone(null); doTranslate(state.englishText, state.selectedLanguage); };
  const handleToneClick = (tone) => { setSelectedTone(tone); doToneTranslate(state.englishText, state.selectedLanguage, tone); };
  const handleLangChange = (lang) => {
    setField('selectedLanguage', lang);
    if (!state.englishText?.trim()) return;
    if (selectedTone) doToneTranslate(state.englishText, lang, selectedTone);
    else doTranslate(state.englishText, lang);
  };

  const handleSpeak = useCallback(() => {
    speak(state.nativeTranslation, state.selectedLanguage);
  }, [speak, state.nativeTranslation, state.selectedLanguage]);

  const langName = LANG_LABELS[state.selectedLanguage] || 'Hindi';
  const dotColor = LANG_DOT_COLORS[state.selectedLanguage] || '#f97316';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '16px 24px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{L.textTranslate}</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>{L.translationsNative}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '24px', gap: 16, maxWidth: 1100, width: '100%', margin: '0 auto' }} className="md:flex-row">

        {/* LEFT — English input */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', border: '2px solid transparent', transition: 'border-color 0.2s, box-shadow 0.2s' }}
          onFocusCapture={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(249,115,22,0.1)'; }}
          onBlurCapture={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = 'var(--shadow-card)'; }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>English</span>
          </div>
          <textarea
            value={state.englishText}
            onChange={(e) => setField('englishText', e.target.value)}
            placeholder={L.typeEnglishHere}
            style={{ flex: 1, width: '100%', padding: '20px', fontSize: '1rem', color: 'var(--text-primary)', background: 'transparent', border: 'none', outline: 'none', resize: 'none', lineHeight: 1.8, minHeight: 300, fontFamily: 'var(--font)' }}
          />
          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button onClick={handleTranslateClick} disabled={!state.englishText?.trim() || isTranslating}
              className="btn-primary" style={{ opacity: (!state.englishText?.trim() || isTranslating) ? 0.4 : 1, cursor: (!state.englishText?.trim() || isTranslating) ? 'not-allowed' : 'pointer' }}>
              {isTranslating ? <><Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />{L.translating}</> : <><Languages style={{ width: 16, height: 16 }} />{L.translate}</>}
            </button>
          </div>
        </div>

        {/* RIGHT — Native output */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface-teal)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{langName}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={handleSpeak} disabled={!state.nativeTranslation || isTranslating}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.7)', borderRadius: 'var(--radius-pill)', padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', backdropFilter: 'blur(4px)', opacity: (!state.nativeTranslation || isTranslating) ? 0.4 : 1 }}>
                {isPlaying ? <><Square style={{ width: 12, height: 12 }} />Stop</> : <><Volume2 style={{ width: 12, height: 12 }} />Speak</>}
              </button>
              <div style={{ position: 'relative' }}>
                <select value={state.selectedLanguage} onChange={(e) => handleLangChange(e.target.value)}
                  style={{ appearance: 'none', background: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '6px 28px 6px 12px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
                  {Object.entries(TARGET_LANGUAGES).map(([name, code]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
                <ChevronDown style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: 'var(--text-muted)', pointerEvents: 'none' }} />
              </div>
            </div>
          </div>

          <div style={{ flex: 1, padding: '20px', overflowY: 'auto', minHeight: 300 }}>
            {isTranslating ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
                <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '0.9rem' }}>Translating...</span>
              </div>
            ) : state.nativeTranslation ? (
              <p style={{ fontSize: '1rem', color: 'var(--text-primary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }} className="animate-fade-in-blur">{state.nativeTranslation}</p>
            ) : (
              <p style={{ fontSize: '1rem', color: 'var(--text-muted)', margin: 0 }}>{L.translationAppears}</p>
            )}
          </div>

          <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {TONES.map((tone) => (
                <button key={tone} onClick={() => handleToneClick(tone)}
                  disabled={!state.englishText?.trim() || isTranslating}
                  style={{ padding: '6px 16px', borderRadius: 'var(--radius-pill)', fontSize: '0.8rem', fontWeight: 600, border: selectedTone === tone ? 'none' : '1px solid rgba(255,255,255,0.8)', background: selectedTone === tone ? 'var(--accent)' : 'rgba(255,255,255,0.6)', color: selectedTone === tone ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s', opacity: (!state.englishText?.trim() || isTranslating) ? 0.4 : 1 }}>
                  {tone}
                </button>
              ))}
            </div>
            {selectedTone && state.nativeTranslation && (() => {
              const chId = TONE_TO_CHANNEL[selectedTone];
              const ch = chId ? CHANNELS.find(c => c.id === chId) : null;
              if (!ch) return null;
              return (
                <button onClick={() => setActiveChannel(ch)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-[13px] font-semibold transition-all hover:shadow-sm active:scale-95 ${ch.bg} ${ch.border} ${ch.color}`}>
                  <ch.icon className="w-4 h-4" />
                  Send to {ch.label}
                </button>
              );
            })()}
          </div>
        </div>
      </div>

      {activeChannel && (
        <SendModal channel={activeChannel} text={state.nativeTranslation} onClose={() => setActiveChannel(null)} />
      )}
    </div>
  );
}
