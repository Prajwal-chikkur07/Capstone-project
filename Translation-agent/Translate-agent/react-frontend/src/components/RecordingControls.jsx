import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Ear, Square, Upload } from 'lucide-react';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';

export default function RecordingControls() {
  const { state, setField, setFields, setLoading, showError, clearAll, RECORDING_MODES } = useApp();
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const stopFuncRef = useRef(null);
  const SILENCE_THRESHOLD = -60; // dB
  const SILENCE_DURATION = 2000; // ms

  const stopMediaStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Timer logic
  useEffect(() => {
    let interval;
    if (state.isRecording || state.isPushToTalkPressed) {
      setRecordingTime(0);
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [state.isRecording, state.isPushToTalkPressed]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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

      // Setup Silence Detection (Safely)
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
          console.warn('AudioContext not supported');
          return;
        }

        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }
        const audioContext = audioContextRef.current;
        
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);

        const checkSilence = () => {
          if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;

          analyser.getFloatTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i] * dataArray[i];
          }
          const rms = Math.sqrt(sum / bufferLength);
          if (rms === 0) {
             // Absolute silence
          }
          const db = rms > 0 ? 20 * Math.log10(rms) : -100;

          if (db < SILENCE_THRESHOLD) {
            if (!silenceTimeoutRef.current && state.recordingMode === 'continuous') {
              silenceTimeoutRef.current = setTimeout(() => {
                console.log('Silence detected, stopping automatically...');
                if (stopFuncRef.current) stopFuncRef.current();
              }, SILENCE_DURATION);
            }
          } else {
            if (silenceTimeoutRef.current) {
              clearTimeout(silenceTimeoutRef.current);
              silenceTimeoutRef.current = null;
            }
          }

          requestAnimationFrame(checkSilence);
        };

        checkSilence();
      } catch (err) {
        console.error('Silence detection setup failed:', err);
      }
    } catch {
      showError('Microphone permission denied.');
    }
  }, [setField, showError]);

  const stopRecordingAndTranslate = useCallback(async () => {
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
          setLoading('Translating audio...');
          const transcript = await api.translateAudioFromBlob(blob);
          setFields({ englishText: transcript });
          setLoading(null);

          // Auto-rewrite tone
          setLoading('Rewriting tone...');
          const rewritten = await api.rewriteTone(transcript, state.selectedTone);
          setFields({ rewrittenText: rewritten });
          setLoading(null);
        } catch (err) {
          showError(err.response?.data?.detail || err.message);
          setLoading(null);
        }
        resolve();
      };

      recorder.stop();
    });
  }, [setField, setFields, setLoading, showError, stopMediaStream, state.selectedTone]);

  // Update stopFuncRef whenever stopRecordingAndTranslate changes
  useEffect(() => {
    stopFuncRef.current = stopRecordingAndTranslate;
  }, [stopRecordingAndTranslate]);

  // Push-to-Talk handlers
  const handlePushDown = useCallback(async () => {
    setField('isPushToTalkPressed', true);
    clearAll();
    await startRecording();
  }, [setField, clearAll, startRecording]);

  const handlePushUp = useCallback(async () => {
    setField('isPushToTalkPressed', false);
    await stopRecordingAndTranslate();
  }, [setField, stopRecordingAndTranslate]);

  // Continuous mode toggle
  const toggleContinuous = useCallback(async () => {
    if (state.isRecording) {
      await stopRecordingAndTranslate();
    } else {
      clearAll();
      await startRecording();
    }
  }, [state.isRecording, startRecording, stopRecordingAndTranslate, clearAll]);

  // File upload logic
  const processFile = async (file) => {
    try {
      clearAll();
      setLoading('Uploading & Processing...');
      const transcript = await api.translateAudio(file);
      setFields({ englishText: transcript });
      setLoading(null);

      setLoading('Rewriting tone...');
      const rewritten = await api.rewriteTone(transcript, state.selectedTone);
      setFields({ rewrittenText: rewritten });
      setLoading(null);
    } catch (err) {
      showError(err.response?.data?.detail || err.message);
      setLoading(null);
    }
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      processFile(file);
    } else if (file) {
      showError('Please upload a valid audio file.');
    }
  }, [clearAll, setLoading, setFields, showError, state.selectedTone]);

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [clearAll, setLoading, setFields, showError, state.selectedTone]);

  const modeConfig = {
    pushToTalk: {
      title: 'Push-to-Talk Mode',
      description: 'Hold the button to record, release to stop',
      icon: Mic,
    },
    continuous: {
      title: 'Continuous Listening Mode',
      description: 'Automatically records until you press stop',
      icon: Ear,
    },
    fileUpload: {
      title: 'File Upload Mode',
      description: 'Select an audio file from your device',
      icon: Upload,
    },
  };

  const config = modeConfig[state.recordingMode];
  const ModeIcon = config.icon;
  const isCurrentlyRecording = state.isRecording || state.isPushToTalkPressed;

  return (
    <div className="glass-card space-y-6 relative overflow-hidden">
      {/* Recording Indicator Overlay */}
      {isCurrentlyRecording && (
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-50 px-3 py-1 rounded-full border border-red-100 z-10 animate-fade-in-top">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-blink" />
          <span className="text-[10px] font-bold text-red-600 tracking-wider">LIVE</span>
          <span className="text-[10px] font-mono text-red-600 tabular-nums">{formatTime(recordingTime)}</span>
        </div>
      )}

      {/* Mode Info */}
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl border transition-colors duration-500 ${isCurrentlyRecording ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
          <ModeIcon className={`w-5 h-5 transition-colors duration-500 ${isCurrentlyRecording ? 'text-red-500' : 'text-blue-600'}`} />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-sm">{config.title}</h3>
          <p className="text-xs text-slate-500">{config.description}</p>
        </div>
      </div>



      {/* Controls */}
      <div className="flex flex-col items-center gap-4 py-2">
        {state.recordingMode === 'pushToTalk' && (
          <>
            <button
              onMouseDown={handlePushDown}
              onMouseUp={handlePushUp}
              onMouseLeave={() => { if (state.isPushToTalkPressed) handlePushUp(); }}
              onTouchStart={(e) => { e.preventDefault(); handlePushDown(); }}
              onTouchEnd={(e) => { e.preventDefault(); handlePushUp(); }}
              className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 ${
                state.isPushToTalkPressed
                  ? 'bg-blue-600 shadow-[0_0_40px_rgba(37,99,235,0.4)] pulse-recording scale-105'
                  : 'bg-slate-900 shadow-xl shadow-slate-200 hover:scale-105 hover:bg-slate-800'
              }`}
            >
              {state.isPushToTalkPressed ? (
                <Mic className="w-10 h-10 text-white" />
              ) : (
                <Mic className="w-10 h-10 text-white" />
              )}
            </button>
            <p className="text-xs uppercase tracking-widest font-bold text-slate-500">
              {state.isPushToTalkPressed ? 'Listening...' : 'Hold to Speak'}
            </p>
          </>
        )}

        {state.recordingMode === 'continuous' && (
          <>
            <button
              onClick={toggleContinuous}
              className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 ${
                state.isRecording
                  ? 'bg-blue-600 shadow-[0_0_40px_rgba(37,99,235,0.4)] pulse-recording scale-105'
                  : 'bg-slate-900 shadow-xl shadow-slate-200 hover:scale-105 hover:bg-slate-800'
              }`}
            >
              {state.isRecording ? (
                <Square className="w-8 h-8 text-white fill-current" />
              ) : (
                <Mic className="w-10 h-10 text-white" />
              )}
            </button>
            <p className="text-xs uppercase tracking-widest font-bold text-slate-500">
              {state.isRecording ? 'Listening...' : 'Tap to Speak'}
            </p>
          </>
        )}

        {state.recordingMode === 'fileUpload' && (
          <div 
            className="w-full space-y-3"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <label className="cursor-pointer block w-full">
              <div className={`flex flex-col items-center justify-center gap-4 p-8 border-2 border-dashed rounded-3xl transition-all duration-200 group ${
                isDragging ? 'border-blue-500 bg-blue-50/50 scale-[1.02]' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
              }`}>
                <div className={`p-4 rounded-full transition-colors ${isDragging ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                  <Upload className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold text-slate-700 block mb-1">
                    {isDragging ? 'Drop Audio Here' : 'Click or drag audio file to upload'}
                  </span>
                  <span className="text-xs text-slate-500">MP3, WAV, M4A up to 25MB</span>
                </div>
              </div>
              <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        )}
      </div>

      {state.englishText && (
        <button onClick={clearAll} className="w-full text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest pt-2 border-t border-slate-50">
          Reset All Fields
        </button>
      )}
    </div>
  );
}
