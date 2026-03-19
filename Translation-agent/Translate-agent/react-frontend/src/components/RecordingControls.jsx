import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Info, ChevronUp, Copy, Download, ChevronLeft, Square, Languages, ChevronDown, Upload as UploadIcon, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';

export default function RecordingControls() {
  const { state, setField, setFields, setLoading, showError, clearAll, TARGET_LANGUAGES, RECORDING_MODES } = useApp();
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [activeMode, setActiveMode] = useState('Transcribe'); // 'Transcribe' or 'Translate'

  const stopMediaStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Timer logic
  useEffect(() => {
    let interval;
    if (state.isRecording) {
      setRecordingTime(0);
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [state.isRecording]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start();
      setField('isRecording', true);
    } catch (err) {
      showError('Microphone permission denied.');
    }
  }, [setField, showError]);

  const stopRecordingAndProcess = useCallback(async () => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve();
        return;
      }

      recorder.onstop = async () => {
        setField('isRecording', false);
        stopMediaStream();
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        if (blob.size === 0) {
          resolve();
          return;
        }

        try {
          setLoading(activeMode === 'Transcribe' ? 'Transcribing...' : 'Translating...');
          const transcript = await api.translateAudioFromBlob(blob);
          setFields({ englishText: transcript });
          
          if (activeMode === 'Translate') {
            setLoading('Translating to regional language...');
            const translated = await api.translateText(transcript, state.selectedLanguage);
            setFields({ nativeTranslation: translated });
          }
          
          setLoading(null);
        } catch (err) {
          showError(err.response?.data?.detail || err.message);
          setLoading(null);
        }
        resolve();
      };

      recorder.stop();
    });
  }, [setField, setFields, setLoading, showError, stopMediaStream, activeMode, state.selectedLanguage]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      clearAll();
      setLoading('Transcribing Audio File...');
      const transcript = await api.translateAudioFromBlob(file);
      setFields({ englishText: transcript });
      
      if (activeMode === 'Translate') {
        setLoading('Translating to regional language...');
        const translated = await api.translateText(transcript, state.selectedLanguage);
        setFields({ nativeTranslation: translated });
      }
      setLoading(null);
    } catch (err) {
      showError(err.response?.data?.detail || err.message);
      setLoading(null);
    }
  };

  const handleMainAction = useCallback(async () => {
    if (state.recordingMode === RECORDING_MODES.FILE_UPLOAD) {
      fileInputRef.current?.click();
      return;
    }

    if (state.isRecording) {
      await stopRecordingAndProcess();
    } else {
       if (activeMode === 'Transcribe') clearAll();
       await startRecording();
    }
  }, [state.isRecording, state.recordingMode, RECORDING_MODES.FILE_UPLOAD, startRecording, stopRecordingAndProcess, clearAll, activeMode]);

  const handleCopy = useCallback(() => {
    const text = state.nativeTranslation || state.englishText;
    if (!text) return;
    navigator.clipboard.writeText(text);
  }, [state.englishText, state.nativeTranslation]);

  const handleDownload = useCallback(() => {
    const text = state.nativeTranslation || state.englishText;
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcript.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [state.englishText, state.nativeTranslation]);

  const isFileUploadMode = state.recordingMode === RECORDING_MODES.FILE_UPLOAD;

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
        accept="audio/*"
      />

      <div className="flex items-center gap-4 animate-fade-in-top">
        {/* Reset Button */}
        <button 
          onClick={clearAll}
          className="w-14 h-14 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-all group"
          title="Reset"
        >
          <ChevronLeft className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
        </button>

        {/* Main Toolbar Pill */}
        <div className="bg-[#F8F9FA]/90 backdrop-blur-xl rounded-full px-4 py-2 flex items-center gap-4 shadow-lg shadow-slate-200/50 border border-white/50">
          <div className="pl-2">
            <div className="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center">
              <span className="text-[10px] font-serif font-bold text-slate-400 italic">i</span>
            </div>
          </div>

          <div className="h-6 w-[1px] bg-slate-200" />

          {/* Mode Selector */}
          <div className="relative">
            <button 
              onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
              className="flex items-center gap-2 text-slate-800 font-bold text-sm hover:text-blue-600 transition-colors px-2 py-1 rounded-lg"
            >
              {activeMode}
              <ChevronUp className={`w-4 h-4 text-slate-300 transition-transform ${isModeMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isModeMenuOpen && (
              <div className="absolute bottom-full mb-4 left-0 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 min-w-[140px] animate-fade-in-top z-[60]">
                {['Transcribe', 'Translate'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setActiveMode(mode);
                      setIsModeMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeMode === mode ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}
          </div>

          {activeMode === 'Translate' && (
            <div className="flex items-center gap-3 animate-fade-in-right">
              <div className="h-6 w-[1px] bg-slate-200" />
              <div className="relative group">
                <select
                  value={state.selectedLanguage}
                  onChange={(e) => setField('selectedLanguage', e.target.value)}
                  className="appearance-none bg-transparent pl-2 pr-8 py-1 text-xs font-bold text-blue-600 cursor-pointer focus:outline-none"
                >
                  {Object.entries(TARGET_LANGUAGES).map(([name, code]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Action Button */}
          <button 
            onClick={handleMainAction}
            className={`rounded-full pl-4 pr-6 py-2.5 flex items-center gap-3 transition-all duration-300 ${
              state.isRecording 
              ? 'bg-red-500 text-white shadow-lg shadow-red-200 animate-pulse-slow' 
              : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-200'
            }`}
          >
            {state.isRecording ? (
               <>
                 <Square className="w-4 h-4 fill-current" />
                 <span className="text-sm font-bold tracking-tight">Stop</span>
               </>
            ) : (
              <>
                {isFileUploadMode 
                 ? <UploadIcon className="w-4 h-4" /> 
                 : (activeMode === 'Translate' ? <Languages className="w-4 h-4" /> : <Mic className="w-4 h-4" />)}
                <span className="text-sm font-bold tracking-tight">
                  {isFileUploadMode ? 'Upload' : 'Record'}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Actions Pill */}
        <div className="bg-[#F8F9FA]/90 backdrop-blur-xl rounded-full px-6 py-2.5 flex items-center gap-6 shadow-lg shadow-slate-200/50 border border-white/50">
          <button 
            onClick={handleCopy}
            disabled={!state.englishText}
            className={`transition-all ${state.englishText ? 'text-slate-600 hover:text-slate-900 hover:scale-110' : 'text-slate-200 cursor-not-allowed'}`}
          >
            <Copy className="w-5 h-5" />
          </button>
          <button 
            onClick={handleDownload}
            disabled={!state.englishText}
            className={`transition-all ${state.englishText ? 'text-slate-600 hover:text-slate-900 hover:scale-110' : 'text-slate-200 cursor-not-allowed'}`}
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Recording Status Overlay */}
      {state.isRecording && (
        <div className="flex items-center gap-3 text-red-500 bg-red-50 px-4 py-1.5 rounded-full border border-red-100 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-xs font-bold font-mono tracking-widest tabular-nums font-bold">
            {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
          </span>
        </div>
      )}
    </div>
  );
}
