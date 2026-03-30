import { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';
import {
  Ear, Square, Loader2, Copy, Check, Download,
  Users, Play, Volume2, ChevronDown, Hash
} from 'lucide-react';

const SILENCE_THRESHOLD = 10;
const SILENCE_DURATION  = 5000; // 5s — gives time between speakers

// Up to 5 speaker colour schemes
const SPEAKER_STYLES = [
  { bubble: 'bg-white border border-gray-200 text-gray-800',         avatar: 'bg-gray-200 text-gray-700',   name: 'text-gray-500'   },
  { bubble: 'bg-gray-900 text-white',                                 avatar: 'bg-gray-700 text-white',      name: 'text-gray-400'   },
  { bubble: 'bg-blue-50 border border-blue-100 text-blue-900',       avatar: 'bg-blue-200 text-blue-700',   name: 'text-blue-500'   },
  { bubble: 'bg-purple-50 border border-purple-100 text-purple-900', avatar: 'bg-purple-200 text-purple-700', name: 'text-purple-500' },
  { bubble: 'bg-green-50 border border-green-100 text-green-900',    avatar: 'bg-green-200 text-green-700', name: 'text-green-500'  },
];

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={copy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 text-[13px] font-medium transition-all">
      {copied ? <><Check className="w-3.5 h-3.5 text-green-500" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
    </button>
  );
}

export default function ContinuousListening() {
  const { state, showError, addHistory, incrementUsage } = useApp();

  // ── Recording state ───────────────────────────────────────────────────────
  const [isListening,  setIsListening]  = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [amplitude,    setAmplitude]    = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const animFrameRef     = useRef(null);
  const silenceTimerRef  = useRef(null);
  const streamRef        = useRef(null);
  const audioCtxRef      = useRef(null);
  const recordedBlobRef  = useRef(null);

  // ── Transcript + conversation ─────────────────────────────────────────────
  const [transcript,  setTranscript]  = useState('');
  const [segments,    setSegments]    = useState([]);   // [{speaker, text, emotion}]
  const [isDiarizing, setIsDiarizing] = useState(false);
  const [diarizeError, setDiarizeError] = useState('');
  const [diarizeMethod, setDiarizeMethod] = useState('');

  // ── Voice synthesis ───────────────────────────────────────────────────────
  const [playLang,      setPlayLang]      = useState('hi-IN');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthSegments,  setSynthSegments]  = useState([]);
  const [playingIdx,     setPlayingIdx]     = useState(null);
  const audioRef = useRef(null);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(animFrameRef.current);
      clearTimeout(silenceTimerRef.current);
      audioCtxRef.current?.close();
    };
  }, []);

  // ── Stop listening ────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    cancelAnimationFrame(animFrameRef.current);
    clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
    setAmplitude(0);
    setIsListening(false);
  }, []);

  // ── Start listening ───────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source   = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArr = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(dataArr);
        const avg = dataArr.reduce((a, b) => a + b, 0) / dataArr.length;
        setAmplitude(avg);
        if (avg < SILENCE_THRESHOLD) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
            }, SILENCE_DURATION);
          }
        } else {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);

      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        cancelAnimationFrame(animFrameRef.current);
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
        setAmplitude(0);
        setIsListening(false);
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        recordedBlobRef.current = blob;
        if (blob.size < 1000) return;

        // Step 1: Transcribe
        setIsProcessing(true);
        let finalTranscript = '';
        try {
          const result = await api.translateAudioFromBlob(blob, 'recording.webm');
          finalTranscript = result.transcript || '';
          if (finalTranscript) {
            setTranscript(finalTranscript);
            incrementUsage('sarvamCalls');
            addHistory({ text: finalTranscript, lang: state.selectedLanguage, timestamp: new Date().toISOString(), confidence: result.confidence || null });
          }
        } catch (e) {
          showError(e.response?.data?.detail || 'Transcription failed');
          setIsProcessing(false);
          return;
        } finally {
          setIsProcessing(false);
        }

        // Step 2: Auto-diarize immediately after transcription
        if (!finalTranscript) return;
        setIsDiarizing(true);
        setDiarizeError('');
        setSegments([]);
        setSynthSegments([]);
        try {
          const dResult = await api.diarizeAudio(blob);
          const segs = (dResult.segments || []).slice(0, 100);
          setSegments(segs);
          setDiarizeMethod(dResult.method || 'fallback');
        } catch (e) {
          setDiarizeError(e.response?.data?.detail || 'Speaker detection failed');
        } finally {
          setIsDiarizing(false);
        }
      };
      mr.start();
      setIsListening(true);
    } catch {
      showError('Microphone access denied');
    }
  }, [state.selectedLanguage, showError, incrementUsage, addHistory]);

  // ── Voice synthesis ───────────────────────────────────────────────────────
  const handleSynthesize = async () => {
    if (!segments.length) return;
    setIsSynthesizing(true); setSynthSegments([]);
    try {
      const translated = await Promise.all(segments.map(async seg => {
        try {
          const t = await api.translateText(seg.text, playLang);
          return { ...seg, translated_text: t };
        } catch {
          return { ...seg, translated_text: seg.text };
        }
      }));
      const result = await api.synthesizeConversation({ segments: translated, target_language: playLang });
      setSynthSegments(result.segments || []);
    } catch (e) {
      setDiarizeError(e.response?.data?.detail || 'Voice synthesis failed');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const playSegment = (idx) => {
    const seg = synthSegments[idx];
    if (!seg?.audio) return;
    audioRef.current?.pause();
    audioRef.current = null;
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

  const handleClear = () => {
    setTranscript(''); setSegments([]); setSynthSegments([]);
    setPlayingIdx(null); setDiarizeError('');
    recordedBlobRef.current = null;
  };

  const handleDownload = () => {
    if (!transcript) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([transcript], { type: 'text/plain' }));
    a.download = 'transcript.txt'; a.click();
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const wc   = transcript?.trim() ? transcript.trim().split(/\s+/).length : 0;
  const bars = Array.from({ length: 20 }, (_, i) =>
    isListening ? Math.max(4, Math.min(40, amplitude * (0.5 + Math.sin(i * 0.8) * 0.5))) : 4
  );
  const uniqueSpeakers = [...new Set(segments.map(s => s.speaker))].slice(0, 5);

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f8f8]">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center">
            <Ear className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-gray-900">Continuous Listening</p>
            <p className="text-[11px] text-gray-400">Auto-stops after {SILENCE_DURATION / 1000}s of silence</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {transcript && (
            <button onClick={handleClear} className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-gray-400 hover:text-red-400 hover:bg-red-50 transition-all">
              Clear
            </button>
          )}
          <button onClick={handleDownload} disabled={!transcript}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 text-[12px] font-medium disabled:opacity-30 transition-all">
            <Download className="w-3.5 h-3.5" />Save
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 md:px-10 pt-8 pb-10 max-w-3xl w-full mx-auto gap-6">

        {/* ── Record button + waveform ── */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-end gap-0.5 h-10">
            {bars.map((h, i) => (
              <div key={i} className={`w-1.5 rounded-full transition-all duration-75 ${isListening ? 'bg-gray-900' : 'bg-gray-200'}`} style={{ height: `${h}px` }} />
            ))}
          </div>
          <button onClick={isListening ? stopListening : startListening}
            className={`flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-[15px] font-bold transition-all shadow-sm active:scale-95 ${
              isListening ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-900 hover:bg-gray-700 text-white'}`}>
            {isListening
              ? <><Square className="w-4 h-4 fill-white" />Stop Listening</>
              : <><Ear className="w-4 h-4" />Start Listening</>}
          </button>
          {isProcessing && (
            <div className="flex items-center gap-2 text-[13px] text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />Transcribing…
            </div>
          )}
          {isDiarizing && (
            <div className="flex items-center gap-2 text-[13px] text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />Detecting speakers…
            </div>
          )}
          {isListening && (
            <p className="text-[12px] text-gray-400 animate-pulse">
              Listening… auto-stops after {SILENCE_DURATION / 1000}s of silence
            </p>
          )}
        </div>

        {/* ── Transcript ── */}
        {transcript ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Transcript</span>
                <span className="flex items-center gap-1 text-[11px] text-gray-300">
                  <Hash className="w-3 h-3" />{wc} words
                </span>
              </div>
              <CopyBtn text={transcript} />
            </div>
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              rows={Math.max(3, transcript.split('\n').length + 1)}
              className="w-full text-[15px] text-gray-800 leading-relaxed bg-transparent focus:outline-none resize-none"
              spellCheck={false}
            />
          </div>
        ) : (
          !isListening && !isProcessing && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
                <Ear className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-[15px] text-gray-300 font-medium">Press Start Listening</p>
              <p className="text-[12px] text-gray-300">Supports up to 5 speakers</p>
            </div>
          )
        )}

        {/* ── Conversation panel ── */}
        {transcript && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <p className="text-[14px] font-bold text-gray-900">Conversation</p>
                {uniqueSpeakers.length > 0 && (
                  <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {uniqueSpeakers.length} speaker{uniqueSpeakers.length > 1 ? 's' : ''}
                  </span>
                )}
                {diarizeMethod === 'gemini' && (
                  <span className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                    ✨ AI detected
                  </span>
                )}
              </div>
              {isDiarizing && (
                <div className="flex items-center gap-1.5 text-[12px] text-gray-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />Detecting speakers…
                </div>
              )}
            </div>

            {diarizeError && (
              <div className="px-5 py-3 bg-red-50 border-b border-red-100">
                <p className="text-[12px] text-red-500">{diarizeError}</p>
              </div>
            )}

            {/* Speaker legend */}
            {uniqueSpeakers.length > 0 && (
              <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50">
                {uniqueSpeakers.map((spk, idx) => {
                  const style = SPEAKER_STYLES[idx % SPEAKER_STYLES.length];
                  return (
                    <span key={spk} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${style.bubble}`}>
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${style.avatar}`}>
                        {idx + 1}
                      </span>
                      {spk}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Bubbles */}
            {segments.length > 0 ? (
              <>
                <div className="px-4 py-4 space-y-3 max-h-96 overflow-y-auto bg-[#f8f8f8]">
                  {segments.map((seg, i) => {
                    const speakerIdx = uniqueSpeakers.indexOf(seg.speaker);
                    const style   = SPEAKER_STYLES[speakerIdx % SPEAKER_STYLES.length];
                    const isRight = speakerIdx % 2 !== 0;
                    const synthSeg  = synthSegments[i];
                    const isSegPlaying = playingIdx === i;

                    return (
                      <div key={i} className={`flex gap-2 ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Avatar */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-1 ${style.avatar}`}>
                          {speakerIdx + 1}
                        </div>
                        {/* Bubble */}
                        <div className={`max-w-[75%] flex flex-col gap-1 ${isRight ? 'items-end' : 'items-start'}`}>
                          <span className={`text-[10px] font-semibold px-1 ${style.name}`}>{seg.speaker}</span>
                          <div className={`rounded-2xl px-4 py-2.5 shadow-sm ${style.bubble} ${isRight ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
                            <p className="text-[13px] leading-relaxed">{seg.text}</p>
                          </div>
                          <div className={`flex items-center gap-2 px-1 ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
                            {seg.emotion && <span className="text-[10px] text-gray-400 capitalize">{seg.emotion}</span>}
                            {seg.confidence && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                seg.confidence >= 0.85 ? 'bg-green-50 text-green-600' :
                                seg.confidence >= 0.7  ? 'bg-amber-50 text-amber-600' :
                                'bg-gray-100 text-gray-400'}`}>
                                {Math.round(seg.confidence * 100)}%
                              </span>
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
                </div>

                {/* Voice playback controls */}
                <div className="px-5 py-4 border-t border-gray-100 bg-white">
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
                      {isSynthesizing
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating voices…</>
                        : <><Volume2 className="w-3.5 h-3.5" />Generate voices</>}
                    </button>

                    {synthSegments.length > 0 && (
                      <button onClick={() => playingIdx !== null ? stopPlayback() : playSegment(0)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all ${
                          playingIdx !== null ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                        {playingIdx !== null
                          ? <><Square className="w-3.5 h-3.5 fill-white" />Stop</>
                          : <><Play className="w-3.5 h-3.5 fill-white" />Play conversation</>}
                      </button>
                    )}
                  </div>
                  {synthSegments.length > 0 && (
                    <p className="text-[11px] text-gray-400 mt-2">Each speaker plays in a different voice · auto-advances</p>
                  )}
                </div>
              </>
            ) : (
              !isDiarizing && (
                <div className="px-5 py-8 text-center">
                  <p className="text-[13px] text-gray-400">Record a conversation — speakers will be detected automatically.</p>
                  <p className="text-[12px] text-gray-300 mt-1">Supports up to 5 speakers</p>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
