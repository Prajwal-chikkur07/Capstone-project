import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useSpeech } from '../hooks/useSpeech';
import * as api from '../services/api';
import {
  Mic, Square, Upload, Copy, Check, Download, Volume2,
  Languages, Loader2, Mail, Slack, Linkedin, MessageSquare,
  X, Send, ExternalLink, Sparkles, AlignLeft, ClipboardList,
  HelpCircle, Globe2, ChevronRight, Smile, Frown, Minus,
  MoreHorizontal, Wand2, FileAudio, Hash
} from 'lucide-react';

// ── Tone chips ──────────────────────────────────────────────────────────────
const TONES = ['Email Formal', 'Email Casual', 'Slack', 'LinkedIn', 'WhatsApp Business'];

// ── Send channels ───────────────────────────────────────────────────────────
const CHANNELS = [
  { id: 'email',    label: 'Email',    icon: Mail,          color: 'text-blue-500',   bg: 'bg-blue-50',   border: 'border-blue-100'   },
  { id: 'slack',    label: 'Slack',    icon: Slack,         color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-100' },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin,      color: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-100'    },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: 'text-green-500',  bg: 'bg-green-50',  border: 'border-green-100'  },
];

// ── Small utility components ─────────────────────────────────────────────────
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={copy} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 text-[12px] font-medium transition-all">
      {copied ? <><Check className="w-3 h-3 text-green-500" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
    </button>
  );
}

function SpeakBtn({ onClick, isPlaying, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border transition-all disabled:opacity-30 ${
        isPlaying ? 'bg-red-50 text-red-500 border-red-200' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'}`}>
      {isPlaying ? <><Square className="w-3 h-3 fill-red-500" />Stop</> : <><Volume2 className="w-3 h-3" />Speak</>}
    </button>
  );
}

function SentimentBadge({ sentiment, score }) {
  if (!sentiment) return null;
  const map = {
    positive: { icon: Smile, color: 'text-green-600 bg-green-50 border-green-100' },
    neutral:  { icon: Minus, color: 'text-gray-500 bg-gray-50 border-gray-200'   },
    negative: { icon: Frown, color: 'text-red-500 bg-red-50 border-red-100'      },
  };
  const { icon: Icon, color } = map[sentiment] || map.neutral;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${color}`}>
      <Icon className="w-3 h-3" />{sentiment} · {score}%
    </span>
  );
}

function Skeleton({ lines = 3 }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`h-4 bg-gray-200 rounded-full ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

// ── Send Modal ───────────────────────────────────────────────────────────────
function SendModal({ text, onClose }) {
  const { state } = useApp();
  const navigate = useNavigate();
  const [active, setActive] = useState(null);
  const [toEmail, setToEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [errMsg, setErrMsg] = useState('');
  const creds = state.channelCredentials || {};

  const channel = CHANNELS.find(c => c.id === active);

  const hasCredentials = active ? {
    email: true, slack: !!creds.slackWebhook?.trim(),
    linkedin: true, whatsapp: !!creds.whatsappPhone?.trim(),
  }[active] : false;

  const handleSend = async () => {
    setStatus('sending');
    try {
      if (active === 'email') {
        const subject = encodeURIComponent(creds.emailSubject || 'Message from SeedlingSpeaks');
        window.open(`mailto:${toEmail.trim()}?subject=${subject}&body=${encodeURIComponent(text)}`, '_blank');
        setStatus('ok'); return;
      } else if (active === 'slack') {
        await api.sendToSlack({ text, webhookUrl: creds.slackWebhook });
      } else if (active === 'linkedin') {
        await api.shareToLinkedIn({ text, addHashtags: true });
      } else if (active === 'whatsapp') {
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-100 w-full sm:max-w-md mx-0 sm:mx-4 p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[15px] font-bold text-gray-900">Send via…</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        {!active ? (
          <div className="grid grid-cols-2 gap-2">
            {CHANNELS.map(ch => (
              <button key={ch.id} onClick={() => { setActive(ch.id); setStatus(null); setErrMsg(''); }}
                className={`flex items-center gap-2.5 p-3 rounded-xl border ${ch.border} ${ch.bg} hover:opacity-80 transition-all`}>
                <ch.icon className={`w-4 h-4 ${ch.color}`} />
                <span className="text-[13px] font-semibold text-gray-800">{ch.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <button onClick={() => { setActive(null); setStatus(null); }} className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-gray-700 mb-3 transition-colors">
              ← Back
            </button>
            {!hasCredentials ? (
              <div className="text-center py-4">
                <p className="text-[14px] text-gray-500 mb-4">No {channel?.label} credentials saved.</p>
                <button onClick={() => { onClose(); navigate('/app/profile'); }}
                  className="flex items-center gap-2 mx-auto bg-gray-900 text-white rounded-xl px-5 py-2.5 text-[13px] font-semibold hover:bg-gray-700 transition-all">
                  <ExternalLink className="w-3.5 h-3.5" /> Go to Profile
                </button>
              </div>
            ) : (
              <>
                <div className="mb-3 px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-[13px] text-gray-600 max-h-28 overflow-y-auto whitespace-pre-wrap">
                  {text.slice(0, 300)}{text.length > 300 ? '…' : ''}
                </div>
                {active === 'email' && (
                  <input type="email" value={toEmail} onChange={e => setToEmail(e.target.value)}
                    placeholder="recipient@example.com" autoFocus
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[14px] focus:outline-none focus:border-gray-400 mb-3 transition-all" />
                )}
                {status === 'ok' && <p className="text-[13px] text-green-600 mb-3 flex items-center gap-1"><Check className="w-3.5 h-3.5" />Sent</p>}
                {status === 'err' && <p className="text-[13px] text-red-500 mb-3">{errMsg}</p>}
                <div className="flex gap-2 justify-end">
                  <button onClick={onClose} className="px-4 py-2 rounded-xl text-[13px] text-gray-500 hover:bg-gray-100 transition-all">Cancel</button>
                  {status !== 'ok' && (
                    <button onClick={handleSend} disabled={status === 'sending' || (active === 'email' && !toEmail.trim())}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40 transition-all ${
                        active === 'whatsapp' ? 'bg-green-500' : active === 'linkedin' ? 'bg-sky-600' : active === 'slack' ? 'bg-purple-600' : 'bg-blue-600'}`}>
                      {status === 'sending' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      {active === 'email' || active === 'whatsapp' ? 'Open App' : 'Send'}
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── More Drawer (slide-in right) ─────────────────────────────────────────────
function MoreDrawer({ open, onClose, transcript, onResult }) {
  const { showError } = useApp();
  const [activeTab, setActiveTab] = useState('sentiment');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [qaQ, setQaQ] = useState('');
  const [multiLangs, setMultiLangs] = useState([]);
  const { TARGET_LANGUAGES } = useApp();

  const tabs = [
    { id: 'sentiment',  label: 'Sentiment',     icon: Smile },
    { id: 'qa',         label: 'Q&A',           icon: HelpCircle },
    { id: 'meeting',    label: 'Meeting Notes',  icon: ClipboardList },
    { id: 'multi',      label: 'Multi-Translate',icon: Globe2 },
  ];

  const run = async () => {
    if (!transcript?.trim()) return;
    setLoading(true); setResult(null);
    try {
      if (activeTab === 'sentiment') {
        const r = await api.analyzeSentiment(transcript);
        setResult(r);
      } else if (activeTab === 'qa') {
        if (!qaQ.trim()) return;
        const r = await api.askQuestion(transcript, qaQ);
        setResult({ answer: r });
      } else if (activeTab === 'meeting') {
        const r = await api.getMeetingNotes(transcript);
        setResult(r);
      } else if (activeTab === 'multi') {
        if (multiLangs.length === 0) return;
        const r = await api.multiTranslate(transcript, multiLangs);
        setResult(r);
      }
    } catch { showError('Action failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { setResult(null); }, [activeTab]);

  const langOptions = Object.entries(TARGET_LANGUAGES || {});

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-[14px] font-bold text-gray-900">AI Tools</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-3 pt-2 gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-[12px] font-semibold whitespace-nowrap transition-all ${
                activeTab === t.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>
              <t.icon className="w-3 h-3" />{t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'qa' && (
            <input value={qaQ} onChange={e => setQaQ(e.target.value)} placeholder="Ask a question about the transcript…"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] focus:outline-none focus:border-gray-400 transition-all" />
          )}
          {activeTab === 'multi' && (
            <div className="space-y-2">
              <p className="text-[12px] text-gray-500 font-medium">Select languages</p>
              <div className="flex flex-wrap gap-2">
                {langOptions.map(([name, code]) => (
                  <button key={code} onClick={() => setMultiLangs(p => p.includes(code) ? p.filter(l => l !== code) : [...p, code])}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                      multiLangs.includes(code) ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={run} disabled={loading || !transcript?.trim()}
            className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white rounded-xl py-2.5 text-[13px] font-semibold hover:bg-gray-700 disabled:opacity-40 transition-all">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Running…' : 'Run'}
          </button>

          {/* Results */}
          {result && (
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 text-[13px] text-gray-700 space-y-2 animate-fade-in-blur">
              {activeTab === 'sentiment' && (
                <>
                  <SentimentBadge sentiment={result.sentiment} score={result.score} />
                  {result.summary && <p className="text-gray-500 mt-2">{result.summary}</p>}
                </>
              )}
              {activeTab === 'qa' && <p className="leading-relaxed">{result.answer}</p>}
              {activeTab === 'meeting' && (
                <div className="space-y-3">
                  {result.summary && <div><p className="font-semibold text-gray-800 mb-1">Summary</p><p>{result.summary}</p></div>}
                  {result.action_items?.length > 0 && (
                    <div><p className="font-semibold text-gray-800 mb-1">Action Items</p>
                      <ul className="list-disc list-inside space-y-0.5">{result.action_items.map((a, i) => <li key={i}>{a}</li>)}</ul>
                    </div>
                  )}
                  {result.decisions?.length > 0 && (
                    <div><p className="font-semibold text-gray-800 mb-1">Decisions</p>
                      <ul className="list-disc list-inside space-y-0.5">{result.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul>
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'multi' && (
                <div className="space-y-2">
                  {Object.entries(result).map(([lang, text]) => (
                    <div key={lang} className="border-b border-gray-100 pb-2 last:border-0">
                      <p className="text-[11px] font-bold text-gray-400 uppercase mb-0.5">{lang}</p>
                      <p>{text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Input Bar ────────────────────────────────────────────────────────────────
function InputBar({ onTranscribed, onTextSubmit }) {
  const { state, setField, setFields, setLoading, showError, clearAll } = useApp();
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const fileInputRef = useRef(null);
  const [bars, setBars] = useState(Array(24).fill(3));
  const [recTime, setRecTime] = useState(0);
  const [text, setText] = useState('');

  const stopStream = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, []);

  useEffect(() => {
    let iv;
    if (state.isRecording) { setRecTime(0); iv = setInterval(() => setRecTime(p => p + 1), 1000); }
    else setBars(Array(24).fill(3));
    return () => clearInterval(iv);
  }, [state.isRecording]);

  const startWaveform = useCallback((stream) => {
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      setBars(Array.from({ length: 24 }, (_, i) => Math.max(3, Math.round((data[Math.floor(i / 24 * data.length)] / 255) * 22))));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      startWaveform(stream);
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start();
      setField('isRecording', true);
    } catch { showError('Microphone permission denied.'); }
  }, [setField, showError, startWaveform]);

  const stopRecording = useCallback(async () => {
    return new Promise(resolve => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') { resolve(); return; }
      recorder.onstop = async () => {
        setField('isRecording', false);
        stopStream();
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size === 0) { resolve(); return; }
        try {
          setLoading('Transcribing…');
          const result = await api.translateAudioFromBlob(blob);
          setFields({ englishText: result.transcript, confidenceScore: result.confidence ?? null });
          onTranscribed?.(result.transcript);
          setLoading(null);
        } catch (err) {
          showError(err.response?.data?.detail || err.message);
          setLoading(null);
        }
        resolve();
      };
      recorder.stop();
    });
  }, [setField, setFields, setLoading, showError, stopStream, onTranscribed]);

  const handleMic = useCallback(async () => {
    if (state.isRecording) await stopRecording();
    else { clearAll(); await startRecording(); }
  }, [state.isRecording, startRecording, stopRecording, clearAll]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    clearAll();
    setLoading('Transcribing audio file…');
    try {
      const result = await api.translateAudioFromBlob(file);
      setFields({ englishText: result.transcript, confidenceScore: result.confidence ?? null });
      onTranscribed?.(result.transcript);
    } catch (err) { showError(err.response?.data?.detail || err.message); }
    finally { setLoading(null); }
  };

  const handleTextSubmit = () => {
    if (!text.trim()) return;
    setField('englishText', text.trim());
    onTextSubmit?.(text.trim());
    setText('');
  };

  const fmt = s => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />

      {state.isRecording ? (
        /* Recording state */
        <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-lg border border-gray-100">
          <div className="w-2 h-2 rounded-full bg-red-500 pulse-recording shrink-0" />
          <span className="text-[12px] font-mono text-gray-500 shrink-0">{fmt(recTime)}</span>
          <div className="flex items-center gap-[2px] flex-1 h-6">
            {bars.map((h, i) => <div key={i} className="w-[2px] rounded-full bg-gray-700 transition-all duration-75" style={{ height: `${h}px` }} />)}
          </div>
          <button onClick={handleMic} className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors shrink-0">
            <Square className="w-3 h-3 fill-white" />Stop
          </button>
        </div>
      ) : (
        /* Idle input bar */
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextSubmit(); } }}
            placeholder="Type something or press the mic to speak…"
            rows={3}
            className="w-full px-4 pt-4 pb-2 text-[15px] text-gray-800 placeholder-gray-300 resize-none focus:outline-none bg-transparent"
          />
          <div className="flex items-center justify-between px-3 pb-3 pt-1">
            <div className="flex items-center gap-2">
              {/* Mic */}
              <button onClick={handleMic}
                className="flex items-center gap-2 bg-gray-900 hover:bg-gray-700 text-white rounded-xl px-4 py-2.5 sm:py-2 text-[14px] sm:text-[13px] font-semibold active:scale-95 transition-all">
                <Mic className="w-4 h-4" />Speak
              </button>
              {/* Upload */}
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl px-3 py-2.5 sm:py-2 text-[13px] font-medium transition-all">
                <Upload className="w-3.5 h-3.5" />Upload
              </button>
            </div>
            {text.trim() && (
              <button onClick={handleTextSubmit}
                className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-700 text-white rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all">
                <Send className="w-3.5 h-3.5" />Submit
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Output Area ──────────────────────────────────────────────────────────────
function OutputArea({ transcript, rewritten, translation, loading, sentiment, onEdit }) {
  const { isPlaying, speak } = useSpeech();

  if (loading) return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <Skeleton lines={4} />
    </div>
  );

  if (!transcript) return null;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-3 animate-fade-in-blur">
      {/* Transcript */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Transcript</span>
            <SentimentBadge sentiment={sentiment?.sentiment} score={sentiment?.score} />
          </div>
          <div className="flex items-center gap-1.5">
            <SpeakBtn onClick={() => speak(transcript, 'en-IN')} isPlaying={isPlaying} disabled={!transcript} />
            <CopyBtn text={transcript} />
          </div>
        </div>
        <textarea
          value={transcript}
          onChange={e => onEdit?.(e.target.value)}
          rows={Math.max(3, transcript.split('\n').length + 1)}
          className="w-full text-[15px] text-gray-800 leading-relaxed bg-transparent focus:outline-none resize-none"
          spellCheck={false}
        />
        <div className="flex items-center gap-1 mt-1">
          <Hash className="w-3 h-3 text-gray-300" />
          <span className="text-[11px] text-gray-300">{transcript.trim().split(/\s+/).length} words</span>
        </div>
      </div>

      {/* Rewritten */}
      {rewritten && (
        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4 animate-fade-in-blur">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Rewritten</span>
            <div className="flex items-center gap-1.5">
              <SpeakBtn onClick={() => speak(rewritten, 'en-IN')} isPlaying={isPlaying} disabled={!rewritten} />
              <CopyBtn text={rewritten} />
            </div>
          </div>
          <p className="text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap">{rewritten}</p>
        </div>
      )}

      {/* Translation */}
      {translation && (
        <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4 animate-fade-in-blur">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Translation</span>
            <div className="flex items-center gap-1.5">
              <CopyBtn text={translation} />
            </div>
          </div>
          <p className="text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap">{translation}</p>
        </div>
      )}
    </div>
  );
}

// ── Action Bar ───────────────────────────────────────────────────────────────
function ActionBar({ transcript, onRewrite, onTranslate, onSummarize, onSend, onMore, isRewriting, isTranslating, isSummarizing, selectedTone, onToneSelect, rewritten }) {
  const [showTones, setShowTones] = useState(false);

  const actions = [
    { id: 'rewrite',   label: 'Rewrite',   icon: Wand2,      loading: isRewriting,   onClick: () => setShowTones(v => !v) },
    { id: 'translate', label: 'Translate', icon: Languages,  loading: isTranslating, onClick: onTranslate },
    { id: 'summarize', label: 'Summarize', icon: AlignLeft,  loading: isSummarizing, onClick: onSummarize },
    { id: 'send',      label: 'Send',      icon: Send,       loading: false,         onClick: onSend },
    { id: 'more',      label: 'More',      icon: MoreHorizontal, loading: false,     onClick: onMore },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto space-y-2">
      {/* Tone chips (shown when Rewrite is clicked) */}
      {showTones && (
        <div className="flex flex-wrap gap-1.5 px-1 animate-fade-in-blur">
          {TONES.map(tone => (
            <button key={tone} onClick={() => { onToneSelect(tone); setShowTones(false); }}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all ${
                selectedTone === tone ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900'}`}>
              {tone}
            </button>
          ))}
        </div>
      )}

      {/* Language selector (shown when Translate is active) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 action-bar-scroll">
        {actions.map(a => (
          <button key={a.id} onClick={a.onClick} disabled={a.loading || !transcript?.trim()}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold border whitespace-nowrap transition-all disabled:opacity-40 ${
              a.id === 'send' ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-700' :
              a.id === 'more' ? 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900' :
              'bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:text-gray-900'}`}>
            {a.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <a.icon className="w-3.5 h-3.5" />}
            {a.label}
          </button>
        ))}
      </div>


    </div>
  );
}

// ── Main Home Page ───────────────────────────────────────────────────────────
export default function Home() {
  const { state, setField, setFields, showError, showSuccess, addHistory, incrementUsage, TARGET_LANGUAGES } = useApp();

  const [editableTranscript, setEditableTranscript] = useState('');
  const [rewrittenText, setRewrittenText] = useState('');
  const [selectedTone, setSelectedTone] = useState(null);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [sentiment, setSentiment] = useState(null);
  const [showSend, setShowSend] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [selectedLang, setSelectedLang] = useState(state.selectedLanguage || 'hi-IN');
  const prevText = useRef('');

  // Sync transcript from context (from recording)
  useEffect(() => {
    if (state.englishText) setEditableTranscript(state.englishText);
  }, [state.englishText]);

  // Auto-save history + sentiment on new transcript
  useEffect(() => {
    if (editableTranscript?.trim() && editableTranscript !== prevText.current) {
      prevText.current = editableTranscript;
      addHistory({ text: editableTranscript, lang: selectedLang, timestamp: new Date().toISOString(), confidence: state.confidenceScore });
      api.analyzeSentiment(editableTranscript).then(setSentiment).catch(() => {});
    }
  }, [editableTranscript]);

  const handleTranscribed = (text) => {
    setEditableTranscript(text);
    setRewrittenText('');
    setSelectedTone(null);
    setSentiment(null);
    setField('nativeTranslation', '');
  };

  const handleRewrite = useCallback(async (tone) => {
    const text = editableTranscript || state.englishText;
    if (!text?.trim()) return;
    setIsRewriting(true); setRewrittenText(''); setSelectedTone(tone);
    try {
      const result = await api.rewriteTone(text, tone);
      setRewrittenText(result);
      incrementUsage('geminiCalls');
    } catch (err) { showError(err.response?.data?.detail || 'Rewrite failed'); }
    finally { setIsRewriting(false); }
  }, [editableTranscript, state.englishText, showError, incrementUsage]);

  const handleTranslate = useCallback(async () => {
    const text = editableTranscript || state.englishText;
    if (!text?.trim()) return;
    setIsTranslating(true);
    try {
      const translated = await api.translateText(text, selectedLang);
      setField('nativeTranslation', translated);
      incrementUsage('sarvamCalls');
    } catch (err) { showError(err.response?.data?.detail || 'Translation failed'); }
    finally { setIsTranslating(false); }
  }, [editableTranscript, state.englishText, selectedLang, setField, showError, incrementUsage]);

  const handleSummarize = useCallback(async () => {
    const text = editableTranscript || state.englishText;
    if (!text?.trim()) return;
    setIsSummarizing(true);
    try {
      const summary = await api.summarizeTranscript(text);
      setRewrittenText(summary);
      setSelectedTone('Summary');
    } catch (err) { showError('Summarize failed'); }
    finally { setIsSummarizing(false); }
  }, [editableTranscript, state.englishText, showError]);

  const handleClear = () => {
    setEditableTranscript('');
    setRewrittenText('');
    setSelectedTone(null);
    setSentiment(null);
    setField('englishText', '');
    setField('nativeTranslation', '');
  };

  const hasOutput = !!editableTranscript;
  const shareText = rewrittenText || state.nativeTranslation || editableTranscript;

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f8f8]">
      {/* Main scrollable area */}
      <div className="flex-1 flex flex-col items-center px-4 py-6 gap-5 overflow-y-auto pb-48 md:pb-36">

        {/* Empty state */}
        {!hasOutput && (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-2">
              <Mic className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-[16px] font-semibold text-gray-700">Speak or type to get started</p>
            <p className="text-[13px] text-gray-400 max-w-xs">Record your voice, upload audio, or type text — then translate, rewrite, or summarize.</p>
          </div>
        )}

        {/* Output */}
        {hasOutput && (
          <>
            <OutputArea
              transcript={editableTranscript}
              rewritten={rewrittenText}
              translation={state.nativeTranslation}
              loading={state.loading != null}
              sentiment={sentiment}
              onEdit={setEditableTranscript}
            />
            {/* Clear button */}
            <button onClick={handleClear} className="text-[12px] text-gray-300 hover:text-red-400 transition-colors">
              Clear all
            </button>
          </>
        )}
      </div>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 md:left-[220px] right-0 bg-white/90 backdrop-blur-md border-t border-gray-100 px-4 pt-3 pb-3 space-y-2 z-30 fixed-bottom-bar" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        {hasOutput && (
          <ActionBar
            transcript={editableTranscript}
            onRewrite={() => {}}
            onTranslate={handleTranslate}
            onSummarize={handleSummarize}
            onSend={() => setShowSend(true)}
            onMore={() => setShowMore(true)}
            isRewriting={isRewriting}
            isTranslating={isTranslating}
            isSummarizing={isSummarizing}
            selectedTone={selectedTone}
            onToneSelect={handleRewrite}
            rewritten={rewrittenText}
          />
        )}
        <InputBar onTranscribed={handleTranscribed} onTextSubmit={handleTranscribed} />
      </div>

      {/* Modals */}
      {showSend && <SendModal text={shareText} onClose={() => setShowSend(false)} />}
      <MoreDrawer open={showMore} onClose={() => setShowMore(false)} transcript={editableTranscript} />
    </div>
  );
}
