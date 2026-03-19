import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Languages, Mic, MicOff, Ear, Square, Upload,
  Trash2, ChevronDown, Volume2, StopCircle,
  Sparkles, Mail, MessageSquare, Linkedin,
  X, Loader2, CheckCircle, AlertCircle, Copy, ClipboardPaste,
  Power, MousePointerClick, FileText, RotateCcw,
} from 'lucide-react';
import * as api from './services/api';

const TONES = ['Email Formal', 'Email Casual', 'Slack', 'LinkedIn', 'WhatsApp Business', 'User Override'];
const TARGET_LANGUAGES = {
  Hindi: 'hi-IN', Bengali: 'bn-IN', Tamil: 'ta-IN', Telugu: 'te-IN',
  Malayalam: 'ml-IN', Marathi: 'mr-IN', Gujarati: 'gu-IN',
  Kannada: 'kn-IN', Punjabi: 'pa-IN', Odia: 'or-IN',
};
const MODES = [
  { value: 'pushToTalk', label: 'Push-to-Talk', icon: Mic },
  { value: 'continuous', label: 'Continuous', icon: Ear },
  { value: 'fileUpload', label: 'File Upload', icon: Upload },
];

export default function App() {
  // State
  const [mode, setMode] = useState('pushToTalk');
  const [isRecording, setIsRecording] = useState(false);
  const [isPTTPressed, setIsPTTPressed] = useState(false);
  const [englishText, setEnglishText] = useState('');
  const [rewrittenText, setRewrittenText] = useState('');
  const [nativeText, setNativeText] = useState('');
  const [selectedTone, setSelectedTone] = useState('Email Formal');
  const [customTone, setCustomTone] = useState('');
  const [selectedLang, setSelectedLang] = useState('hi-IN');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [playingType, setPlayingType] = useState(null);
  const [activeTab, setActiveTab] = useState('dom');
  const [modal, setModal] = useState(null);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('Translated Message');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [domActive, setDomActive] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioRef = useRef(null);

  // Load DOM active state and check for pending actions
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['vtActive', 'vtLanguage', 'vtTone'], (result) => {
        setDomActive(!!result.vtActive);
        if (result.vtLanguage) setSelectedLang(result.vtLanguage);
        if (result.vtTone) setSelectedTone(result.vtTone);
      });

      // Listen for deactivation from page
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.vtActive) {
          setDomActive(!!changes.vtActive.newValue);
        }
      });
    }

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'GET_PENDING_ACTION' }, (action) => {
        if (action && Date.now() - action.timestamp < 30000) {
          setInputText(action.text);
          setEnglishText(action.text);
          if (action.type === 'translate') setActiveTab('translate');
          else setActiveTab('tone');
        }
      });
    }
  }, []);

  // Auto-clear notifications
  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(null), 5000); return () => clearTimeout(t); }
  }, [error]);
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(null), 4000); return () => clearTimeout(t); }
  }, [success]);

  // ========== DOM MODE ==========
  // Detect if running inside an iframe (inline popup panel)
  const isInIframe = window !== window.parent;

  // Send message to content script — use postMessage when in iframe, otherwise chrome.runtime
  const sendToContentScript = useCallback((msg) => {
    if (isInIframe) {
      window.parent.postMessage({ source: 'vt-popup', ...msg }, '*');
    } else if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage(msg);
    }
  }, [isInIframe]);

  // Sync language/tone to content script
  useEffect(() => {
    sendToContentScript({ type: 'UPDATE_SETTINGS', language: selectedLang, tone: selectedTone });
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ vtLanguage: selectedLang, vtTone: selectedTone });
    }
  }, [selectedLang, selectedTone, sendToContentScript]);

  const clearAll = useCallback(() => {
    setEnglishText(''); setRewrittenText(''); setNativeText('');
    setInputText(''); setPlayingType(null);
  }, []);

  const toggleDomMode = useCallback(() => {
    const newState = !domActive;
    setDomActive(newState);
    sendToContentScript({ type: 'TOGGLE_ACTIVE', active: newState });
  }, [domActive, sendToContentScript]);

  const translateAllPage = useCallback(() => {
    sendToContentScript({ type: 'TRANSLATE_ALL_PAGE' });
    setSuccess('Translating page...');
  }, [sendToContentScript]);

  const translateSelection = useCallback(() => {
    sendToContentScript({ type: 'TRANSLATE_SELECTION_FROM_POPUP' });
    setSuccess('Translating selection...');
  }, [sendToContentScript]);

  const stopTranslation = useCallback(() => {
    sendToContentScript({ type: 'STOP_TRANSLATION' });
    setSuccess('Translations restored to original.');
  }, [sendToContentScript]);

  // ========== RECORDING ==========
  const grabSelection = useCallback(async () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'GET_SELECTED_TEXT' }, (response) => {
        if (response?.text) {
          setInputText(response.text); setEnglishText(response.text);
          setSuccess('Text grabbed from page!');
        }
      });
    }
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start();
      setIsRecording(true);
    } catch { setError('Microphone permission denied.'); }
  }, []);

  const stopAndTranslate = useCallback(async () => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') { resolve(); return; }
      recorder.onstop = async () => {
        setIsRecording(false); stopStream();
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size === 0) { resolve(); return; }
        try {
          setLoading('Translating audio...');
          const transcript = await api.translateAudioFromBlob(blob);
          setEnglishText(transcript); setInputText(transcript);
          setLoading('Rewriting tone...');
          const rewritten = await api.rewriteTone(transcript, selectedTone);
          setRewrittenText(rewritten); setLoading(null);
        } catch (err) { setError(err.response?.data?.detail || err.message); setLoading(null); }
        resolve();
      };
      recorder.stop();
    });
  }, [selectedTone, stopStream]);

  const handlePTTDown = useCallback(async () => { setIsPTTPressed(true); clearAll(); await startRecording(); }, [clearAll, startRecording]);
  const handlePTTUp = useCallback(async () => { setIsPTTPressed(false); await stopAndTranslate(); }, [stopAndTranslate]);
  const toggleContinuous = useCallback(async () => {
    if (isRecording) { await stopAndTranslate(); } else { clearAll(); await startRecording(); }
  }, [isRecording, startRecording, stopAndTranslate, clearAll]);

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      clearAll(); setLoading('Uploading...');
      const transcript = await api.translateAudio(file);
      setEnglishText(transcript); setInputText(transcript); setLoading('Rewriting tone...');
      const rewritten = await api.rewriteTone(transcript, selectedTone);
      setRewrittenText(rewritten); setLoading(null);
    } catch (err) { setError(err.response?.data?.detail || err.message); setLoading(null); }
    e.target.value = '';
  }, [clearAll, selectedTone]);

  // ========== TONE ==========
  const handleToneChange = useCallback(async (tone) => {
    setSelectedTone(tone);
    if (englishText) {
      try {
        setLoading('Rewriting tone...');
        const rewritten = await api.rewriteTone(englishText, tone, tone === 'User Override' ? customTone : null);
        setRewrittenText(rewritten); setLoading(null);
      } catch (err) { setError(err.response?.data?.detail || err.message); setLoading(null); }
    }
  }, [englishText, customTone]);

  const applyCustomTone = useCallback(async () => {
    if (!englishText) return;
    try {
      setLoading('Rewriting tone...');
      const rewritten = await api.rewriteTone(englishText, 'User Override', customTone || null);
      setRewrittenText(rewritten); setLoading(null);
    } catch (err) { setError(err.response?.data?.detail || err.message); setLoading(null); }
  }, [englishText, customTone]);

  // ========== TRANSLATE ==========
  const handleTranslate = useCallback(async () => {
    const text = englishText || inputText; if (!text) return;
    try {
      setLoading('Translating...');
      const translated = await api.translateText(text, selectedLang);
      setNativeText(translated); setLoading(null);
    } catch (err) { setError(err.response?.data?.detail || err.message); setLoading(null); }
  }, [englishText, inputText, selectedLang]);

  // ========== TTS ==========
  const playTTS = useCallback(async (text, language, type) => {
    try {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      setPlayingType(type); setLoading('Generating speech...');
      const blob = await api.textToSpeech(text, language); setLoading(null);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url); audioRef.current = audio;
      audio.onended = () => { setPlayingType(null); URL.revokeObjectURL(url); };
      audio.play();
    } catch { setPlayingType(null); setLoading(null); setError('TTS Error'); }
  }, []);
  const stopTTS = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlayingType(null);
  }, []);

  // ========== SHARE ==========
  const handleEmail = useCallback(async () => {
    if (!emailTo) return; setModal(null);
    try { setLoading('Sending email...'); await api.sendEmail({ text: rewrittenText, toEmail: emailTo, subject: emailSubject, tone: selectedTone, language: 'en' }); setLoading(null); setSuccess('Email sent!'); }
    catch (err) { setLoading(null); setError(err.response?.data?.detail || 'Email error'); }
    setEmailTo(''); setEmailSubject('Translated Message');
  }, [emailTo, emailSubject, rewrittenText, selectedTone]);

  const handleSlack = useCallback(async () => {
    setModal(null);
    try { setLoading('Sending to Slack...'); await api.sendToSlack({ text: rewrittenText, webhookUrl: webhookUrl || null, tone: selectedTone, language: 'en' }); setLoading(null); setSuccess('Sent to Slack!'); }
    catch (err) { setLoading(null); setError(err.response?.data?.detail || 'Slack error'); }
    setWebhookUrl('');
  }, [webhookUrl, rewrittenText, selectedTone]);

  const handleLinkedIn = useCallback(async () => {
    setModal(null);
    try { setLoading('Sharing...'); const res = await api.shareToLinkedIn({ text: rewrittenText, tone: selectedTone, language: 'en' }); setLoading(null); setSuccess(res.message || 'Shared!'); }
    catch (err) { setLoading(null); setError(err.response?.data?.detail || 'LinkedIn error'); }
  }, [rewrittenText, selectedTone]);

  const copyText = useCallback((text) => {
    navigator.clipboard.writeText(text); setSuccess('Copied!');
  }, []);

  const insertIntoPage = useCallback((text) => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'INSERT_TEXT', text }, (response) => {
            if (response?.success) setSuccess('Inserted!');
            else setError('No active text input on page');
          });
        }
      });
    }
  }, []);

  // Output box helper
  const OutputBox = ({ label, content, language, type }) => {
    if (!content) return null;
    const isPlaying = playingType === type;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-white/40">{label}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => copyText(content)} className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white" title="Copy">
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => insertIntoPage(content)} className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white" title="Insert into page">
              <ClipboardPaste className="w-3.5 h-3.5" />
            </button>
            {language && type && (
              <button onClick={isPlaying ? stopTTS : () => playTTS(content, language, type)}
                className={`p-1.5 rounded-md transition-colors ${isPlaying ? 'bg-red-500/20 text-red-400' : 'hover:bg-blue-500/10 text-blue-400'}`}
                title={isPlaying ? 'Stop' : 'Listen'}>
                {isPlaying ? <StopCircle className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
          <p className="text-xs text-white/85 leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    );
  };

  const tabs = [
    { id: 'dom', label: 'Page', icon: MousePointerClick },
    { id: 'record', label: 'Record', icon: Mic },
    { id: 'tone', label: 'Tone', icon: Sparkles },
    { id: 'translate', label: 'Translate', icon: Languages },
  ];

  return (
    <div className="w-[400px] min-h-[500px] max-h-[600px] overflow-y-auto bg-slate-950 flex flex-col relative">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <Languages className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white">Voice Translation</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={grabSelection} className="p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white" title="Grab selected text">
              <ClipboardPaste className="w-4 h-4" />
            </button>
            <button onClick={clearAll} className="p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white" title="Clear all">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 bg-slate-900/50">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2 ${
              activeTab === id ? 'text-blue-400 border-blue-400 bg-blue-500/5' : 'text-white/40 border-transparent hover:text-white/60'
            }`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">

        {/* DOM / Page Tab */}
        {activeTab === 'dom' && (
          <>
            {/* ON/OFF Toggle */}
            <div className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Page Translation Mode</p>
                  <p className="text-[10px] text-white/40 mt-0.5">
                    {domActive ? 'Active — floating toolbar on page' : 'Inactive — turn on to translate page content'}
                  </p>
                </div>
                <button
                  onClick={toggleDomMode}
                  className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                    domActive
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/30'
                      : 'bg-white/10'
                  }`}
                >
                  <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-300 ${
                    domActive ? 'left-[30px]' : 'left-0.5'
                  }`} />
                </button>
              </div>
            </div>

            {/* Language selector for DOM translation */}
            <div>
              <p className="text-xs font-medium text-white/40 mb-1.5">Target Language:</p>
              <div className="relative">
                <select value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)} className="select-field pr-8">
                  {Object.entries(TARGET_LANGUAGES).map(([name, code]) => (
                    <option key={code} value={code} className="bg-slate-900">{name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
              </div>
            </div>

            {/* DOM Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={translateAllPage}
                disabled={!domActive}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  domActive
                    ? 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20 text-blue-300'
                    : 'bg-white/3 border-white/5 text-white/20 cursor-not-allowed'
                }`}
              >
                <div className={`p-2 rounded-lg ${domActive ? 'bg-blue-500/20' : 'bg-white/5'}`}>
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Translate Entire Page</p>
                  <p className="text-[10px] opacity-60">Translates all visible text on the page</p>
                </div>
              </button>

              <button
                onClick={translateSelection}
                disabled={!domActive}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  domActive
                    ? 'bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20 text-purple-300'
                    : 'bg-white/3 border-white/5 text-white/20 cursor-not-allowed'
                }`}
              >
                <div className={`p-2 rounded-lg ${domActive ? 'bg-purple-500/20' : 'bg-white/5'}`}>
                  <MousePointerClick className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Translate Selected Text</p>
                  <p className="text-[10px] opacity-60">Translates your current text selection</p>
                </div>
              </button>

              <button
                onClick={stopTranslation}
                disabled={!domActive}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  domActive
                    ? 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20 text-red-300'
                    : 'bg-white/3 border-white/5 text-white/20 cursor-not-allowed'
                }`}
              >
                <div className={`p-2 rounded-lg ${domActive ? 'bg-red-500/20' : 'bg-white/5'}`}>
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Stop Translation</p>
                  <p className="text-[10px] opacity-60">Restore all text to original</p>
                </div>
              </button>
            </div>

            {/* Info */}
            {domActive && (
              <div className="glass-card p-3 space-y-2">
                <p className="text-[10px] font-semibold text-white/50">When ON:</p>
                <ul className="text-[10px] text-white/40 space-y-1 list-disc pl-3.5">
                  <li>Select text on any page to see Translate / Restyle / Copy buttons</li>
                  <li>Use <strong>Pick</strong> mode for sites where text can't be selected (WhatsApp, etc.) — click any element to translate it</li>
                  <li>Use <strong>All</strong> to translate every text block on the page</li>
                  <li>Use <strong>Reset</strong> to remove all translations</li>
                </ul>
              </div>
            )}
          </>
        )}

        {/* Record Tab */}
        {activeTab === 'record' && (
          <>
            <div className="flex gap-1.5">
              {MODES.map(({ value, label, icon: Icon }) => (
                <button key={value} onClick={() => { setMode(value); clearAll(); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs transition-all ${
                    mode === value ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-white/50 border border-transparent hover:bg-white/10'
                  }`}>
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-col items-center gap-3 py-2">
              {mode === 'pushToTalk' && (
                <>
                  <button onMouseDown={handlePTTDown} onMouseUp={handlePTTUp}
                    onMouseLeave={() => { if (isPTTPressed) handlePTTUp(); }}
                    onTouchStart={(e) => { e.preventDefault(); handlePTTDown(); }}
                    onTouchEnd={(e) => { e.preventDefault(); handlePTTUp(); }}
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                      isPTTPressed ? 'bg-red-500 pulse-recording scale-110' : 'bg-gradient-to-br from-blue-500 to-purple-600 hover:scale-105'
                    }`}>
                    {isPTTPressed ? <Mic className="w-7 h-7 text-white" /> : <MicOff className="w-7 h-7 text-white" />}
                  </button>
                  <p className={`text-xs ${isPTTPressed ? 'text-red-400 font-semibold' : 'text-white/40'}`}>
                    {isPTTPressed ? 'Recording... Release to stop' : 'Hold to record'}
                  </p>
                </>
              )}
              {mode === 'continuous' && (
                <>
                  <button onClick={toggleContinuous}
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                      isRecording ? 'bg-red-500 pulse-recording' : 'bg-gradient-to-br from-green-500 to-emerald-600 hover:scale-105'
                    }`}>
                    {isRecording ? <Square className="w-6 h-6 text-white" /> : <Ear className="w-7 h-7 text-white" />}
                  </button>
                  <p className={`text-xs ${isRecording ? 'text-green-400 font-semibold' : 'text-white/40'}`}>
                    {isRecording ? 'Listening... Tap to stop' : 'Tap to listen'}
                  </p>
                </>
              )}
              {mode === 'fileUpload' && (
                <>
                  <label className="cursor-pointer">
                    <div className="flex items-center gap-2 btn-primary px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600">
                      <Upload className="w-4 h-4" /> <span>Select Audio File</span>
                    </div>
                    <input type="file" accept=".mp3,.wav,.m4a,.webm,.ogg,.flac" onChange={handleFileUpload} className="hidden" />
                  </label>
                  <p className="text-[10px] text-white/30">MP3, WAV, M4A, WebM, OGG, FLAC</p>
                </>
              )}
            </div>

            <OutputBox label="Translated English:" content={englishText} language="en" type="english" />
            <OutputBox label="Styled Text:" content={rewrittenText} language="en" type="rewritten" />

            {rewrittenText && (
              <div className="flex gap-2 justify-center">
                <button onClick={() => setModal('email')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20">
                  <Mail className="w-3.5 h-3.5" /> Email
                </button>
                <button onClick={() => setModal('slack')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs hover:bg-purple-500/20">
                  <MessageSquare className="w-3.5 h-3.5" /> Slack
                </button>
                <button onClick={() => setModal('linkedin')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/20">
                  <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                </button>
              </div>
            )}
          </>
        )}

        {/* Tone Tab */}
        {activeTab === 'tone' && (
          <>
            <div className="relative">
              <select value={selectedTone} onChange={(e) => handleToneChange(e.target.value)} className="select-field pr-8">
                {TONES.map((t) => <option key={t} value={t} className="bg-slate-900">{t}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            </div>

            {selectedTone === 'User Override' && (
              <div className="space-y-2">
                <input type="text" value={customTone} onChange={(e) => setCustomTone(e.target.value)}
                  placeholder="e.g. Formal with bullet points" className="input-field" />
                <button onClick={applyCustomTone} className="btn-primary flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-3.5 h-3.5" /> Apply Custom Tone
                </button>
              </div>
            )}

            <textarea value={inputText} onChange={(e) => { setInputText(e.target.value); setEnglishText(e.target.value); }}
              placeholder="Paste or type English text here..." rows={4} className="input-field resize-none" />

            {englishText && !rewrittenText && (
              <button onClick={() => handleToneChange(selectedTone)} className="btn-primary w-full flex items-center justify-center gap-1.5 text-xs">
                <Sparkles className="w-3.5 h-3.5" /> Apply Tone
              </button>
            )}
            <OutputBox label="Styled Text:" content={rewrittenText} language="en" type="rewritten" />
          </>
        )}

        {/* Translate Tab */}
        {activeTab === 'translate' && (
          <>
            <div className="relative">
              <select value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)} className="select-field pr-8">
                {Object.entries(TARGET_LANGUAGES).map(([name, code]) => (
                  <option key={code} value={code} className="bg-slate-900">{name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            </div>

            <textarea value={inputText} onChange={(e) => { setInputText(e.target.value); setEnglishText(e.target.value); }}
              placeholder="Type or paste English text..." rows={4} className="input-field resize-none" />

            <button onClick={handleTranslate} className="btn-primary w-full flex items-center justify-center gap-1.5 text-xs">
              <Languages className="w-3.5 h-3.5" /> Translate to Native
            </button>
            <OutputBox label="Native Translation:" content={nativeText} language={selectedLang} type="native" />
          </>
        )}
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card px-5 py-3 flex items-center gap-3">
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            <span className="text-xs text-white/80">{loading}</span>
          </div>
        </div>
      )}

      {/* Notifications */}
      {(error || success) && (
        <div className="absolute bottom-3 left-3 right-3 z-50">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
            error ? 'bg-red-500/15 border-red-500/30 text-red-300' : 'bg-green-500/15 border-green-500/30 text-green-300'
          }`}>
            {error ? <AlertCircle className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle className="w-3.5 h-3.5 shrink-0" />}
            <span className="flex-1">{error || success}</span>
            <button onClick={() => { setError(null); setSuccess(null); }} className="p-0.5 rounded hover:bg-white/10 shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {modal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card p-4 w-full space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                {modal === 'email' ? 'Send via Email' : modal === 'slack' ? 'Send to Slack' : 'Share to LinkedIn'}
              </h3>
              <button onClick={() => setModal(null)} className="p-1 rounded hover:bg-white/10 text-white/40">
                <X className="w-4 h-4" />
              </button>
            </div>

            {modal === 'email' && (
              <>
                <input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="recipient@email.com" className="input-field" />
                <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Subject" className="input-field" />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setModal(null)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                  <button onClick={handleEmail} className="btn-primary text-xs px-3 py-1.5">Send</button>
                </div>
              </>
            )}
            {modal === 'slack' && (
              <>
                <p className="text-[10px] text-white/30">Enter Slack Webhook URL or configure in backend .env</p>
                <input type="text" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://hooks.slack.com/... (optional)" className="input-field" />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setModal(null)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                  <button onClick={handleSlack} className="btn-primary text-xs px-3 py-1.5">Send</button>
                </div>
              </>
            )}
            {modal === 'linkedin' && (
              <>
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-[10px] text-amber-400">Mock mode — LinkedIn OAuth not configured.</p>
                </div>
                <div className="p-2 rounded-lg bg-white/5">
                  <p className="text-[10px] text-white/30 mb-1">Preview:</p>
                  <p className="text-xs text-white/60">{rewrittenText?.substring(0, 80)}{rewrittenText?.length > 80 ? '...' : ''}</p>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setModal(null)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                  <button onClick={handleLinkedIn} className="btn-primary text-xs px-3 py-1.5">Share</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
