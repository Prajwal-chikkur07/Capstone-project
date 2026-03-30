/**
 * ContinuousListening — Live conversation mode
 *
 * Flow:
 *  Start → records in 4s chunks → each chunk: transcribe → translate → show bubble
 *  Pause → stops mic, keeps session open
 *  Resume → continues adding bubbles
 *  End → finalises session, shows full conversation
 *
 * Speaker detection: audio-based via backend (librosa pitch/MFCC)
 * Translation: live per chunk in selected language
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';
import {
  Ear, Square, Loader2, Download, Pause, Play,
  Users, Volume2, ChevronDown, StopCircle, Mic
} from 'lucide-react';

const CHUNK_MS = 4000;   // record 4s chunks for live translation
const SILENCE_THRESHOLD = 8;

// Up to 5 speaker colour schemes
const SPEAKER_STYLES = [
  { bubble: 'bg-white border border-gray-200 text-gray-800',         avatar: 'bg-gray-200 text-gray-700',   name: 'text-gray-500'   },
  { bubble: 'bg-gray-900 text-white',                                 avatar: 'bg-gray-700 text-white',      name: 'text-gray-300'   },
  { bubble: 'bg-blue-50 border border-blue-100 text-blue-900',       avatar: 'bg-blue-200 text-blue-700',   name: 'text-blue-500'   },
  { bubble: 'bg-purple-50 border border-purple-100 text-purple-900', avatar: 'bg-purple-200 text-purple-700', name: 'text-purple-500' },
  { bubble: 'bg-green-50 border border-green-100 text-green-900',    avatar: 'bg-green-200 text-green-700', name: 'text-green-500'  },
];

// Assign a stable colour index per speaker label
const speakerIndex = (label, uniqueList) => {
  const idx = uniqueList.indexOf(label);
  return idx === -1 ? 0 : idx;
};

export default function ContinuousListening() {
  const { state, showError, addHistory, incrementUsage } = useApp();

  // ── Session state ─────────────────────────────────────────────────────────
  // 'idle' | 'listening' | 'paused' | 'ended'
  const [sessionState, setSessionState] = useState('idle');
  const [amplitude,    setAmplitude]    = useState(0);

  // ── Live bubbles ──────────────────────────────────────────────────────────
  // Each bubble: { id, speaker, gender, text, translation, emotion, processing }
  const [bubbles,       setBubbles]       = useState([]);
  const [targetLang,    setTargetLang]    = useState('hi-IN');
  const bubblesEndRef = useRef(null);

  // ── Recording refs ────────────────────────────────────────────────────────
  const streamRef        = useRef(null);
  const audioCtxRef      = useRef(null);
  const animFrameRef     = useRef(null);
  const chunkTimerRef    = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const sessionBlobsRef  = useRef([]);  // all chunks for final diarization
  const uniqueSpeakersRef = useRef([]); // stable speaker list across chunks

  // ── Voice synthesis ───────────────────────────────────────────────────────
  const [playLang,       setPlayLang]       = useState('hi-IN');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthSegments,  setSynthSegments]  = useState([]);
  const [playingIdx,     setPlayingIdx]     = useState(null);
  const audioRef = useRef(null);

  // Auto-scroll to latest bubble
  useEffect(() => {
    bubblesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [bubbles]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMic();
      clearInterval(chunkTimerRef.current);
    };
  }, []);

  // ── Mic helpers ───────────────────────────────────────────────────────────
  const stopMic = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    cancelAnimationFrame(animFrameRef.current);
    clearInterval(chunkTimerRef.current);
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setAmplitude(0);
  }, []);

  // ── Process one audio chunk ───────────────────────────────────────────────
  const processChunk = useCallback(async (blob) => {
    if (blob.size < 500) return;
    sessionBlobsRef.current.push(blob);

    // Add a "processing" placeholder bubble
    const id = Date.now();
    setBubbles(prev => [...prev, { id, speaker: '…', text: '', translation: '', processing: true }]);

    try {
      // Transcribe
      const stt = await api.translateAudioFromBlob(blob, 'chunk.webm');
      const text = stt.transcript?.trim();
      if (!text) {
        setBubbles(prev => prev.filter(b => b.id !== id));
        return;
      }

      // Translate live
      let translation = '';
      try {
        translation = await api.translateText(text, targetLang);
      } catch { translation = text; }

      // Quick speaker guess from chunk (use diarize endpoint)
      let speaker = 'Person 1';
      let gender  = 'male';
      try {
        const d = await api.diarizeAudio(blob, 'chunk.webm', 0);
        const segs = d.segments || [];
        if (segs.length > 0) {
          speaker = segs[0].speaker || 'Person 1';
          gender  = segs[0].gender  || 'male';
        }
        // Track unique speakers
        if (!uniqueSpeakersRef.current.includes(speaker)) {
          uniqueSpeakersRef.current = [...uniqueSpeakersRef.current, speaker];
        }
      } catch { /* keep defaults */ }

      setBubbles(prev => prev.map(b =>
        b.id === id
          ? { id, speaker, gender, text, translation, emotion: 'neutral', processing: false }
          : b
      ));
      incrementUsage('sarvamCalls');
      addHistory({ text, lang: targetLang, timestamp: new Date().toISOString() });
    } catch (e) {
      setBubbles(prev => prev.filter(b => b.id !== id));
      showError(e.response?.data?.detail || 'Chunk processing failed');
    }
  }, [targetLang, showError, incrementUsage, addHistory]);

  // ── Start a new MediaRecorder for one chunk ───────────────────────────────
  const startChunkRecorder = useCallback((stream) => {
    chunksRef.current = [];
    const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm' });
    mediaRecorderRef.current = mr;
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      processChunk(blob);
    };
    mr.start();
  }, [processChunk]);

  // ── Start session ─────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Waveform analyser
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src      = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setAmplitude(data.reduce((a, b) => a + b, 0) / data.length);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);

      // Start first chunk
      startChunkRecorder(stream);

      // Rotate chunks every CHUNK_MS
      chunkTimerRef.current = setInterval(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
          // Small delay then start next chunk
          setTimeout(() => {
            if (streamRef.current) startChunkRecorder(streamRef.current);
          }, 100);
        }
      }, CHUNK_MS);

      setSessionState('listening');
    } catch {
      showError('Microphone access denied');
    }
  }, [startChunkRecorder, showError]);

  // ── Pause ─────────────────────────────────────────────────────────────────
  const handlePause = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    clearInterval(chunkTimerRef.current);
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setAmplitude(0);
    setSessionState('paused');
  }, []);

  // ── Resume ────────────────────────────────────────────────────────────────
  const handleResume = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src      = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setAmplitude(data.reduce((a, b) => a + b, 0) / data.length);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);

      startChunkRecorder(stream);
      chunkTimerRef.current = setInterval(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
          setTimeout(() => {
            if (streamRef.current) startChunkRecorder(streamRef.current);
          }, 100);
        }
      }, CHUNK_MS);

      setSessionState('listening');
    } catch {
      showError('Microphone access denied');
    }
  }, [startChunkRecorder, showError]);

  // ── End session ───────────────────────────────────────────────────────────
  const handleEnd = useCallback(() => {
    stopMic();
    setSessionState('ended');
  }, [stopMic]);

  // ── Clear ─────────────────────────────────────────────────────────────────
  const handleClear = () => {
    stopMic();
    setBubbles([]);
    setSynthSegments([]);
    setPlayingIdx(null);
    sessionBlobsRef.current = [];
    uniqueSpeakersRef.current = [];
    setSessionState('idle');
  };

  // ── Download ──────────────────────────────────────────────────────────────
  const handleDownload = () => {
    const text = bubbles.filter(b => !b.processing).map(b =>
      `${b.speaker}: ${b.text}\n[${targetLang}]: ${b.translation}`
    ).join('\n\n');
    if (!text) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = 'conversation.txt'; a.click();
  };

  // ── Voice synthesis ───────────────────────────────────────────────────────
  const handleSynthesize = async () => {
    const segs = bubbles.filter(b => !b.processing && b.text);
    if (!segs.length) return;
    setIsSynthesizing(true); setSynthSegments([]);
    try {
      const mapped = segs.map(b => ({
        speaker: b.speaker,
        text:    b.text,
        translated_text: b.translation || b.text,
        emotion: b.emotion || 'neutral',
        voice:   { sarvam: b.gender === 'female' ? 'anushka' : 'abhilash', gtts_gender: b.gender || 'male' },
      }));
      const result = await api.synthesizeConversation({ segments: mapped, target_language: playLang });
      setSynthSegments(result.segments || []);
    } catch (e) {
      showError(e.response?.data?.detail || 'Voice synthesis failed');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const playSegment = (idx) => {
    const seg = synthSegments[idx];
    if (!seg?.audio) return;
    audioRef.current?.pause();
    const audio = new Audio(`data:audio/wav;base64,${seg.audio}`);
    audioRef.current = audio;
    setPlayingIdx(idx);
    audio.onended = () => {
      setPlayingIdx(null);
      if (idx + 1 < synthSegments.length) playSegment(idx + 1);
    };
    audio.play();
  };

  const stopPlayback = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingIdx(null);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const bars = Array.from({ length: 24 }, (_, i) =>
    sessionState === 'listening'
      ? Math.max(4, Math.min(36, amplitude * (0.5 + Math.sin(i * 0.8) * 0.5)))
      : 4
  );
  const uniqueSpeakers = [...new Set(bubbles.filter(b => !b.processing).map(b => b.speaker))];
  const hasBubbles     = bubbles.length > 0;
  const isActive       = sessionState === 'listening';
  const isPaused       = sessionState === 'paused';
  const isEnded        = sessionState === 'ended';
  const isIdle         = sessionState === 'idle';

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f8f8]">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isActive ? 'bg-red-500' : 'bg-gray-900'}`}>
            <Ear className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-gray-900">Live Conversation</p>
            <p className="text-[11px] text-gray-400">
              {isActive ? 'Listening & translating live…' : isPaused ? 'Paused' : isEnded ? 'Session ended' : 'Ready to start'}
            </p>
          </div>
          {isActive && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
        </div>
        <div className="flex items-center gap-2">
          {/* Language selector */}
          <div className="relative">
            <select value={targetLang} onChange={e => setTargetLang(e.target.value)}
              disabled={isActive}
              className="appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-[12px] font-semibold text-gray-700 cursor-pointer focus:outline-none pr-7 disabled:opacity-50">
              {Object.entries({ Hindi: 'hi-IN', Kannada: 'kn-IN', Tamil: 'ta-IN', Telugu: 'te-IN', Malayalam: 'ml-IN', Bengali: 'bn-IN', English: 'en-IN' }).map(([n, c]) => (
                <option key={c} value={c}>{n}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
          {hasBubbles && (
            <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 text-[12px] font-medium transition-all">
              <Download className="w-3.5 h-3.5" />Save
            </button>
          )}
          {(isEnded || isPaused) && hasBubbles && (
            <button onClick={handleClear} className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-gray-400 hover:text-red-400 hover:bg-red-50 transition-all">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Waveform + controls ── */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex flex-col items-center gap-3">
        {/* Waveform */}
        <div className="flex items-end gap-[2px] h-8">
          {bars.map((h, i) => (
            <div key={i} className={`w-1 rounded-full transition-all duration-75 ${isActive ? 'bg-gray-900' : 'bg-gray-200'}`} style={{ height: `${h}px` }} />
          ))}
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-3">
          {isIdle && (
            <button onClick={handleStart}
              className="flex items-center gap-2 bg-gray-900 hover:bg-gray-700 text-white px-6 py-2.5 rounded-2xl text-[14px] font-bold transition-all active:scale-95 shadow-sm">
              <Mic className="w-4 h-4" />Start Listening
            </button>
          )}

          {isActive && (
            <>
              <button onClick={handlePause}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-2xl text-[13px] font-bold transition-all active:scale-95">
                <Pause className="w-4 h-4 fill-white" />Pause
              </button>
              <button onClick={handleEnd}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-2xl text-[13px] font-bold transition-all active:scale-95">
                <StopCircle className="w-4 h-4" />End
              </button>
            </>
          )}

          {isPaused && (
            <>
              <button onClick={handleResume}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-2xl text-[13px] font-bold transition-all active:scale-95">
                <Mic className="w-4 h-4" />Resume
              </button>
              <button onClick={handleEnd}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-2xl text-[13px] font-bold transition-all active:scale-95">
                <StopCircle className="w-4 h-4" />End
              </button>
            </>
          )}

          {isEnded && (
            <button onClick={handleClear}
              className="flex items-center gap-2 bg-gray-900 hover:bg-gray-700 text-white px-6 py-2.5 rounded-2xl text-[14px] font-bold transition-all active:scale-95">
              <Mic className="w-4 h-4" />New Session
            </button>
          )}
        </div>

        {isActive && (
          <p className="text-[11px] text-gray-400 animate-pulse">
            Translating every {CHUNK_MS / 1000}s · {Object.entries({ 'hi-IN': 'Hindi', 'kn-IN': 'Kannada', 'ta-IN': 'Tamil', 'te-IN': 'Telugu', 'ml-IN': 'Malayalam', 'bn-IN': 'Bengali', 'en-IN': 'English' })[targetLang] || targetLang}
          </p>
        )}
      </div>

      {/* ── Conversation bubbles ── */}
      <div className="flex-1 overflow-y-auto px-4 md:px-10 py-6 max-w-3xl w-full mx-auto">

        {isIdle && !hasBubbles && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
              <Ear className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-[15px] text-gray-300 font-medium">Press Start Listening</p>
            <p className="text-[12px] text-gray-300">Live translation · up to 5 speakers · gender-matched voices</p>
          </div>
        )}

        {/* Speaker legend */}
        {uniqueSpeakers.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {uniqueSpeakers.map((spk, idx) => {
              const style = SPEAKER_STYLES[idx % SPEAKER_STYLES.length];
              const bubble = bubbles.find(b => b.speaker === spk);
              return (
                <span key={spk} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${style.bubble}`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${style.avatar}`}>{idx + 1}</span>
                  {spk}
                  {bubble?.gender && <span className="opacity-50">{bubble.gender === 'female' ? '♀' : '♂'}</span>}
                </span>
              );
            })}
          </div>
        )}

        {/* Bubbles */}
        <div className="space-y-3">
          {bubbles.map((b, i) => {
            const spkIdx  = uniqueSpeakers.indexOf(b.speaker);
            const style   = SPEAKER_STYLES[Math.max(0, spkIdx) % SPEAKER_STYLES.length];
            const isRight = spkIdx % 2 !== 0;
            const synthSeg = synthSegments[i];
            const isSegPlaying = playingIdx === i;

            if (b.processing) {
              return (
                <div key={b.id} className="flex gap-2 items-center">
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                    <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                  </div>
                  <div className="bg-white border border-gray-100 rounded-2xl px-4 py-2.5 shadow-sm">
                    <div className="flex gap-1">
                      {[0,1,2].map(d => <div key={d} className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: `${d * 0.15}s` }} />)}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={b.id} className={`flex gap-2 ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-1 ${style.avatar}`}>
                  {Math.max(0, spkIdx) + 1}
                </div>
                <div className={`max-w-[75%] flex flex-col gap-1 ${isRight ? 'items-end' : 'items-start'}`}>
                  <span className={`text-[10px] font-semibold px-1 ${style.name}`}>
                    {b.speaker}
                    {b.gender && <span className="ml-1 opacity-50">{b.gender === 'female' ? '♀' : '♂'}</span>}
                  </span>
                  <div className={`rounded-2xl px-4 py-2.5 shadow-sm ${style.bubble} ${isRight ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
                    <p className="text-[13px] leading-relaxed">{b.text}</p>
                    {b.translation && b.translation !== b.text && (
                      <p className="text-[11px] mt-1 opacity-60 italic">{b.translation}</p>
                    )}
                  </div>
                  <div className={`flex items-center gap-2 px-1 ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
                    {b.emotion && b.emotion !== 'neutral' && (
                      <span className="text-[10px] text-gray-400 capitalize">{b.emotion}</span>
                    )}
                    {synthSeg?.audio && (
                      <button onClick={() => isSegPlaying ? stopPlayback() : playSegment(i)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                          isSegPlaying ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {isSegPlaying
                          ? <><Square className="w-2.5 h-2.5 fill-red-500" />Stop</>
                          : <><Play className="w-2.5 h-2.5 fill-gray-500" />Play</>}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bubblesEndRef} />
        </div>

        {/* Voice synthesis panel — shown after session ends */}
        {isEnded && bubbles.filter(b => !b.processing).length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-3">Play back in translated voice</p>
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
                {isSynthesizing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating…</> : <><Volume2 className="w-3.5 h-3.5" />Generate voices</>}
              </button>
              {synthSegments.length > 0 && (
                <button onClick={() => playingIdx !== null ? stopPlayback() : playSegment(0)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all ${
                    playingIdx !== null ? 'bg-red-500 text-white' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                  {playingIdx !== null
                    ? <><Square className="w-3.5 h-3.5 fill-white" />Stop</>
                    : <><Play className="w-3.5 h-3.5 fill-white" />Play all</>}
                </button>
              )}
            </div>
            {synthSegments.length > 0 && (
              <p className="text-[11px] text-gray-400 mt-2">Each speaker plays in their detected gender voice</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
