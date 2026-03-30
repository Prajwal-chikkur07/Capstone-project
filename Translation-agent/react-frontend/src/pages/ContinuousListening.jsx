/**
 * ContinuousListening — Live conversation with Pause/Resume/End
 *
 * Strategy:
 * - Record continuously in 5s chunks
 * - Each chunk: transcribe → translate → append to conversation box
 * - Speaker detection runs on the FULL recording when session ends
 * - Controls fixed at bottom
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';
import {
  Ear, Square, Loader2, Download, Pause, Play,
  Volume2, ChevronDown, StopCircle, Mic
} from 'lucide-react';

const CHUNK_MS = 5000;

const SPEAKER_STYLES = [
  { bubble: 'bg-white border border-gray-200 text-gray-800',         avatar: 'bg-gray-200 text-gray-700',   name: 'text-gray-500' },
  { bubble: 'bg-gray-900 text-white',                                 avatar: 'bg-gray-700 text-white',      name: 'text-gray-300' },
  { bubble: 'bg-blue-50 border border-blue-100 text-blue-900',       avatar: 'bg-blue-200 text-blue-700',   name: 'text-blue-500' },
  { bubble: 'bg-purple-50 border border-purple-100 text-purple-900', avatar: 'bg-purple-200 text-purple-700', name: 'text-purple-500' },
  { bubble: 'bg-green-50 border border-green-100 text-green-900',    avatar: 'bg-green-200 text-green-700', name: 'text-green-500' },
];

export default function ContinuousListening() {
  const { state, showError, addHistory, incrementUsage } = useApp();

  const [sessionState, setSessionState] = useState('idle'); // idle | listening | paused | ended
  const [amplitude,    setAmplitude]    = useState(0);
  const [targetLang,   setTargetLang]   = useState('hi-IN');

  // Live lines: { id, text, translation, processing }
  const [lines,    setLines]    = useState([]);
  // After end: diarized segments with speaker info
  const [segments, setSegments] = useState([]);
  const [isDiarizing, setIsDiarizing] = useState(false);

  // Voice synthesis
  const [playLang,       setPlayLang]       = useState('hi-IN');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthSegments,  setSynthSegments]  = useState([]);
  const [playingIdx,     setPlayingIdx]     = useState(null);
  const audioRef = useRef(null);

  const streamRef        = useRef(null);
  const audioCtxRef      = useRef(null);
  const animFrameRef     = useRef(null);
  const chunkTimerRef    = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const allChunksRef     = useRef([]); // full session audio
  const boxEndRef        = useRef(null);

  useEffect(() => { boxEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lines, segments]);
  useEffect(() => { return () => { stopMic(); clearInterval(chunkTimerRef.current); }; }, []);

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

  const processChunk = useCallback(async (blob) => {
    if (blob.size < 800) return; // skip near-silent chunks
    allChunksRef.current.push(blob);
    const id = Date.now() + Math.random();
    setLines(prev => [...prev, { id, text: '', translation: '', processing: true }]);
    try {
      const stt = await api.translateAudioFromBlob(blob, 'chunk.webm');
      const text = stt.transcript?.trim();
      if (!text) { setLines(prev => prev.filter(l => l.id !== id)); return; }
      let translation = text;
      try { translation = await api.translateText(text, targetLang); } catch {}
      setLines(prev => prev.map(l => l.id === id ? { id, text, translation, processing: false } : l));
      incrementUsage('sarvamCalls');
    } catch {
      setLines(prev => prev.filter(l => l.id !== id));
    }
  }, [targetLang, incrementUsage]);

  const startChunkRecorder = useCallback((stream) => {
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    const mr = new MediaRecorder(stream, { mimeType: mime });
    mediaRecorderRef.current = mr;
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => processChunk(new Blob(chunksRef.current, { type: 'audio/webm' }));
    mr.start();
  }, [processChunk]);

  const initMic = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const src = ctx.createMediaStreamSource(stream);
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
    return stream;
  }, []);

  const handleStart = useCallback(async () => {
    try {
      const stream = await initMic();
      startChunkRecorder(stream);
      chunkTimerRef.current = setInterval(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
          setTimeout(() => { if (streamRef.current) startChunkRecorder(streamRef.current); }, 150);
        }
      }, CHUNK_MS);
      setSessionState('listening');
    } catch { showError('Microphone access denied'); }
  }, [initMic, startChunkRecorder, showError]);

  const handlePause = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    clearInterval(chunkTimerRef.current);
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setAmplitude(0);
    setSessionState('paused');
  }, []);

  const handleResume = useCallback(async () => {
    try {
      const stream = await initMic();
      startChunkRecorder(stream);
      chunkTimerRef.current = setInterval(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
          setTimeout(() => { if (streamRef.current) startChunkRecorder(streamRef.current); }, 150);
        }
      }, CHUNK_MS);
      setSessionState('listening');
    } catch { showError('Microphone access denied'); }
  }, [initMic, startChunkRecorder, showError]);

  const handleEnd = useCallback(async () => {
    stopMic();
    setSessionState('ended');
    // Build combined transcript from all live lines
    const combinedTranscript = lines
      .filter(l => !l.processing && l.text)
      .map(l => l.text)
      .join(' ');
    if (!combinedTranscript.trim()) return;
    setIsDiarizing(true);
    try {
      // Pass transcript directly — no need to re-transcribe broken multi-chunk blob
      const result = await api.diarizeAudio(null, 'session.webm', 0, combinedTranscript);
      setSegments(result.segments || []);
    } catch (e) {
      showError(e.response?.data?.detail || 'Speaker detection failed');
    } finally {
      setIsDiarizing(false);
    }
  }, [stopMic, lines, showError]);

  const handleClear = () => {
    stopMic();
    setLines([]); setSegments([]); setSynthSegments([]);
    setPlayingIdx(null); allChunksRef.current = [];
    setSessionState('idle');
  };

  const handleDownload = () => {
    const src = segments.length > 0 ? segments : lines.filter(l => !l.processing);
    const text = src.map(s => `${s.speaker || 'Speaker'}: ${s.text}\n→ ${s.translation || ''}`).join('\n\n');
    if (!text) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = 'conversation.txt'; a.click();
  };

  const handleSynthesize = async () => {
    const src = segments.length > 0 ? segments : lines.filter(l => !l.processing && l.text);
    if (!src.length) return;
    setIsSynthesizing(true); setSynthSegments([]);
    try {
      const mapped = src.map(s => ({
        speaker: s.speaker || 'Person 1',
        text:    s.text,
        translated_text: s.translation || s.text,
        emotion: s.emotion || 'neutral',
        voice:   s.voice || { sarvam: s.gender === 'female' ? 'anushka' : 'abhilash', gtts_gender: s.gender || 'male' },
      }));
      const result = await api.synthesizeConversation({ segments: mapped, target_language: playLang });
      setSynthSegments(result.segments || []);
    } catch (e) { showError(e.response?.data?.detail || 'Synthesis failed'); }
    finally { setIsSynthesizing(false); }
  };

  const playSegment = (idx) => {
    const seg = synthSegments[idx];
    if (!seg?.audio) return;
    audioRef.current?.pause();
    const audio = new Audio(`data:audio/wav;base64,${seg.audio}`);
    audioRef.current = audio;
    setPlayingIdx(idx);
    audio.onended = () => { setPlayingIdx(null); if (idx + 1 < synthSegments.length) playSegment(idx + 1); };
    audio.play();
  };

  const stopPlayback = () => { audioRef.current?.pause(); audioRef.current = null; setPlayingIdx(null); };

  const bars = Array.from({ length: 28 }, (_, i) =>
    sessionState === 'listening' ? Math.max(3, Math.min(32, amplitude * (0.4 + Math.sin(i * 0.9) * 0.4))) : 3
  );

  const isActive  = sessionState === 'listening';
  const isPaused  = sessionState === 'paused';
  const isEnded   = sessionState === 'ended';
  const isIdle    = sessionState === 'idle';

  // Display: after end show diarized segments, during session show live lines
  const displayItems = isEnded && segments.length > 0 ? segments : lines;
  const uniqueSpeakers = [...new Set(
    (isEnded && segments.length > 0 ? segments : []).map(s => s.speaker).filter(Boolean)
  )];

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f8f8]">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-8 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isActive ? 'bg-red-500' : 'bg-gray-900'}`}>
            <Ear className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-gray-900">Live Conversation</p>
            <p className="text-[11px] text-gray-400">
              {isActive ? 'Listening & translating…' : isPaused ? 'Paused' : isEnded ? 'Session ended' : 'Ready'}
            </p>
          </div>
          {isActive && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select value={targetLang} onChange={e => setTargetLang(e.target.value)} disabled={isActive}
              className="appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-[12px] font-semibold text-gray-700 cursor-pointer focus:outline-none pr-7 disabled:opacity-50">
              {[['Hindi','hi-IN'],['Kannada','kn-IN'],['Tamil','ta-IN'],['Telugu','te-IN'],['Malayalam','ml-IN'],['Bengali','bn-IN'],['English','en-IN']].map(([n,c]) => (
                <option key={c} value={c}>{n}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
          {(isEnded || isPaused) && lines.length > 0 && (
            <>
              <button onClick={handleDownload} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 text-[12px] font-medium transition-all">
                <Download className="w-3.5 h-3.5" />Save
              </button>
              <button onClick={handleClear} className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-gray-400 hover:text-red-400 hover:bg-red-50 transition-all">
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Conversation box (scrollable) ── */}
      <div className="flex-1 overflow-hidden flex flex-col px-4 md:px-10 pt-6 pb-2 max-w-3xl w-full mx-auto">

        {/* Speaker legend — shown after diarization */}
        {uniqueSpeakers.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 shrink-0">
            {uniqueSpeakers.map((spk, idx) => {
              const style = SPEAKER_STYLES[idx % SPEAKER_STYLES.length];
              const seg   = segments.find(s => s.speaker === spk);
              return (
                <span key={spk} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${style.bubble}`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${style.avatar}`}>{idx + 1}</span>
                  {spk}{seg?.gender && <span className="opacity-50 ml-0.5">{seg.gender === 'female' ? '♀' : '♂'}</span>}
                </span>
              );
            })}
          </div>
        )}

        {/* The single conversation container */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">

          {/* Empty state */}
          {displayItems.length === 0 && !isDiarizing && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                <Ear className="w-5 h-5 text-gray-300" />
              </div>
              <p className="text-[14px] text-gray-300 font-medium">
                {isIdle ? 'Press Start to begin' : isActive ? 'Listening…' : 'No conversation yet'}
              </p>
            </div>
          )}

          {isDiarizing && (
            <div className="flex-1 flex items-center justify-center gap-2 text-[13px] text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />Detecting speakers…
            </div>
          )}

          {/* Bubbles */}
          {displayItems.length > 0 && !isDiarizing && (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {displayItems.map((item, i) => {
                if (item.processing) {
                  return (
                    <div key={item.id} className="flex gap-2 items-center">
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                        <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
                      </div>
                      <div className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2.5">
                        <div className="flex gap-1">
                          {[0,1,2].map(d => <div key={d} className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: `${d*0.15}s` }} />)}
                        </div>
                      </div>
                    </div>
                  );
                }

                // For diarized segments, use speaker info; for live lines, no speaker
                const spkLabel  = item.speaker || null;
                const spkIdx    = spkLabel ? uniqueSpeakers.indexOf(spkLabel) : -1;
                const style     = spkIdx >= 0 ? SPEAKER_STYLES[spkIdx % SPEAKER_STYLES.length] : SPEAKER_STYLES[0];
                const isRight   = spkIdx > 0 && spkIdx % 2 !== 0;
                const synthSeg  = synthSegments[i];
                const isSegPlay = playingIdx === i;

                return (
                  <div key={item.id || i} className={`flex gap-2 ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
                    {spkLabel && (
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-1 ${style.avatar}`}>
                        {spkIdx + 1}
                      </div>
                    )}
                    <div className={`${spkLabel ? 'max-w-[75%]' : 'w-full'} flex flex-col gap-0.5 ${isRight ? 'items-end' : 'items-start'}`}>
                      {spkLabel && (
                        <span className={`text-[10px] font-semibold px-1 ${style.name}`}>
                          {spkLabel}{item.gender && <span className="ml-1 opacity-50">{item.gender === 'female' ? '♀' : '♂'}</span>}
                        </span>
                      )}
                      <div className={`rounded-2xl px-4 py-2.5 shadow-sm ${style.bubble} ${spkLabel && isRight ? 'rounded-tr-sm' : spkLabel ? 'rounded-tl-sm' : ''}`}>
                        <p className="text-[14px] leading-relaxed">{item.text}</p>
                        {item.translation && item.translation !== item.text && (
                          <p className="text-[12px] mt-1 opacity-60 italic border-t border-current/10 pt-1">{item.translation}</p>
                        )}
                      </div>
                      {synthSeg?.audio && (
                        <button onClick={() => isSegPlay ? stopPlayback() : playSegment(i)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold mt-0.5 transition-all ${
                            isSegPlay ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                          {isSegPlay ? <><Square className="w-2.5 h-2.5 fill-red-500" />Stop</> : <><Play className="w-2.5 h-2.5 fill-gray-500" />Play</>}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={boxEndRef} />
            </div>
          )}

          {/* Voice synthesis footer — only after ended */}
          {isEnded && displayItems.filter(d => !d.processing).length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center gap-3 flex-wrap shrink-0">
              <div className="relative">
                <select value={playLang} onChange={e => setPlayLang(e.target.value)}
                  className="appearance-none bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-[12px] font-semibold text-gray-700 cursor-pointer focus:outline-none pr-7">
                  {[['Hindi','hi-IN'],['Kannada','kn-IN'],['Tamil','ta-IN'],['Telugu','te-IN'],['Malayalam','ml-IN'],['Bengali','bn-IN'],['English','en-IN']].map(([n,c]) => (
                    <option key={c} value={c}>{n}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
              <button onClick={handleSynthesize} disabled={isSynthesizing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-xl text-[12px] font-semibold hover:bg-gray-700 disabled:opacity-40 transition-all">
                {isSynthesizing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating…</> : <><Volume2 className="w-3.5 h-3.5" />Play voices</>}
              </button>
              {synthSegments.length > 0 && (
                <button onClick={() => playingIdx !== null ? stopPlayback() : playSegment(0)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all ${
                    playingIdx !== null ? 'bg-red-500 text-white' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                  {playingIdx !== null ? <><Square className="w-3 h-3 fill-white" />Stop</> : <><Play className="w-3 h-3 fill-white" />Play all</>}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Fixed bottom controls ── */}
      <div className="bg-white border-t border-gray-100 px-4 py-4 flex flex-col items-center gap-3 shrink-0 md:left-[220px] left-0 sticky bottom-0">
        {/* Waveform */}
        <div className="flex items-end gap-[2px] h-7">
          {bars.map((h, i) => (
            <div key={i} className={`w-1 rounded-full transition-all duration-75 ${isActive ? 'bg-gray-900' : 'bg-gray-200'}`} style={{ height: `${h}px` }} />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          {isIdle && (
            <button onClick={handleStart}
              className="flex items-center gap-2 bg-gray-900 hover:bg-gray-700 text-white px-8 py-3 rounded-2xl text-[15px] font-bold transition-all active:scale-95 shadow-sm">
              <Mic className="w-5 h-5" />Start Listening
            </button>
          )}
          {isActive && (
            <>
              <button onClick={handlePause}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-2xl text-[14px] font-bold transition-all active:scale-95">
                <Pause className="w-4 h-4 fill-white" />Pause
              </button>
              <button onClick={handleEnd}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-2xl text-[14px] font-bold transition-all active:scale-95">
                <StopCircle className="w-4 h-4" />End
              </button>
            </>
          )}
          {isPaused && (
            <>
              <button onClick={handleResume}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-2xl text-[14px] font-bold transition-all active:scale-95">
                <Mic className="w-4 h-4" />Resume
              </button>
              <button onClick={handleEnd}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-2xl text-[14px] font-bold transition-all active:scale-95">
                <StopCircle className="w-4 h-4" />End
              </button>
            </>
          )}
          {isEnded && (
            <button onClick={handleClear}
              className="flex items-center gap-2 bg-gray-900 hover:bg-gray-700 text-white px-8 py-3 rounded-2xl text-[15px] font-bold transition-all active:scale-95">
              <Mic className="w-5 h-5" />New Session
            </button>
          )}
        </div>
        {isActive && <p className="text-[11px] text-gray-400">Translating every {CHUNK_MS/1000}s · speaker detection runs when you End</p>}
      </div>
    </div>
  );
}
