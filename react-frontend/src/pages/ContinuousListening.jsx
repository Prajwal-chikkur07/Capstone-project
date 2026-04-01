import { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';
import {
  useContinuousSession,
  sessionStart, sessionResume, sessionPause, sessionEnd,
  sessionClear, sessionSetLang,
} from '../hooks/useContinuousSession';
import {
  Mic, Square, Loader2, Pause, Play,
  Volume2, ChevronDown, StopCircle
} from 'lucide-react';

const CHUNK_MS = 5000;

const SPEAKER_COLORS = [
  { bg: 'bg-violet-500',  light: 'bg-violet-50 text-violet-900',  text: 'text-violet-500'  },
  { bg: 'bg-sky-500',     light: 'bg-sky-50 text-sky-900',        text: 'text-sky-500'     },
  { bg: 'bg-emerald-500', light: 'bg-emerald-50 text-emerald-900',text: 'text-emerald-500' },
  { bg: 'bg-amber-500',   light: 'bg-amber-50 text-amber-900',    text: 'text-amber-500'   },
  { bg: 'bg-rose-500',    light: 'bg-rose-50 text-rose-900',      text: 'text-rose-500'    },
];

const LANGS = [['Hindi','hi-IN'],['Kannada','kn-IN'],['Tamil','ta-IN'],['Telugu','te-IN'],['Malayalam','ml-IN'],['Bengali','bn-IN'],['English','en-IN']];

export default function ContinuousListening() {
  const { state, showError, incrementUsage } = useApp();

  // Singleton session state — persists across navigation
  const session = useContinuousSession();
  const { state: sessionState, lines, segments, amplitude, targetLang } = session;

  // Sync default language into the session when it changes in Profile
  useEffect(() => {
    if (sessionState === 'idle') sessionSetLang(state.selectedLanguage);
  }, [state.selectedLanguage]);

  const [isDiarizing,    setIsDiarizing]    = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthSegments,  setSynthSegments]  = useState([]);
  const [playingIdx,     setPlayingIdx]     = useState(null);
  const audioRef  = useRef(null);
  const boxEndRef = useRef(null);

  useEffect(() => { boxEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lines, segments]);

  const handleStart = useCallback(async () => {
    try { await sessionStart(incrementUsage); }
    catch { showError('Microphone access denied'); }
  }, [incrementUsage, showError]);

  const handlePause = useCallback(() => sessionPause(), []);

  const handleResume = useCallback(async () => {
    try { await sessionResume(incrementUsage); }
    catch { showError('Microphone access denied'); }
  }, [incrementUsage, showError]);

  const handleEnd = useCallback(async () => {
    setIsDiarizing(true);
    await sessionEnd(showError);
    setIsDiarizing(false);
  }, [showError]);

  const handleClear = useCallback(() => {
    sessionClear();
    setSynthSegments([]);
    setPlayingIdx(null);
  }, []);

  const handleLangChange = useCallback((lang) => {
    sessionSetLang(lang);
  }, []);

  const handleSynthesize = async () => {
    const src = segments.length > 0 ? segments : lines.filter(l => !l.processing && l.text);
    if (!src.length) return;
    setIsSynthesizing(true); setSynthSegments([]);
    try {
      const mapped = src.map(s => ({
        speaker: s.speaker || 'Person 1', text: s.text,
        translated_text: s.translation || s.text, emotion: s.emotion || 'neutral',
        voice: s.voice || { sarvam: s.gender === 'female' ? 'anushka' : 'abhilash', gtts_gender: s.gender || 'male' },
      }));
      const result = await api.synthesizeConversation({ segments: mapped, target_language: targetLang });
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

  const isActive = sessionState === 'listening';
  const isPaused = sessionState === 'paused';
  const isEnded  = sessionState === 'ended';
  const isIdle   = sessionState === 'idle';

  const displayItems   = isEnded && segments.length > 0 ? segments : lines;
  const uniqueSpeakers = [...new Set((isEnded && segments.length > 0 ? segments : []).map(s => s.speaker).filter(Boolean))];

  const bars = Array.from({ length: 32 }, (_, i) =>
    isActive ? Math.max(3, Math.min(28, amplitude * (0.35 + Math.sin(i * 0.9) * 0.35))) : 3
  );

  return (
    <div className="h-screen flex flex-col bg-[#f8f8f8]">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isActive ? 'bg-red-500 shadow-md shadow-red-200' : 'bg-gray-900'}`}>
            <Mic className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-gray-900">Live Conversation</p>
            <p className="text-[11px] text-gray-400">
              {isActive ? 'Listening & translating…' : isPaused ? 'Paused — session still active' : isEnded ? 'Session ended' : 'Ready to start'}
            </p>
          </div>
          {isActive && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          {isPaused && <span className="w-2 h-2 rounded-full bg-amber-400" />}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <select value={targetLang} onChange={e => handleLangChange(e.target.value)} disabled={isActive}
              className="appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-[12px] font-semibold text-gray-700 cursor-pointer focus:outline-none pr-7 disabled:opacity-50">
              {LANGS.map(([n,c]) => <option key={c} value={c}>{n}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
          {isEnded && displayItems.filter(d => !d.processing).length > 0 && (
            <>
              <button onClick={handleSynthesize} disabled={isSynthesizing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-xl text-[12px] font-semibold hover:bg-gray-700 disabled:opacity-40 transition-all">
                {isSynthesizing ? <><Loader2 className="w-3 h-3 animate-spin" />Generating…</> : <><Volume2 className="w-3 h-3" />Generate voices</>}
              </button>
              {synthSegments.length > 0 && (
                <button onClick={() => playingIdx !== null ? stopPlayback() : playSegment(0)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all ${
                    playingIdx !== null ? 'bg-red-500 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                  {playingIdx !== null ? <><Square className="w-3 h-3 fill-white" />Stop</> : <><Play className="w-3 h-3 fill-white" />Play all</>}
                </button>
              )}
            </>
          )}
          {(isEnded || isPaused) && lines.length > 0 && (
            <button onClick={handleClear} className="px-3 py-1.5 rounded-xl text-[12px] font-medium text-gray-400 hover:text-red-400 hover:bg-red-50 transition-all">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Speaker legend ── */}
      {uniqueSpeakers.length > 0 && (
        <div className="flex flex-wrap gap-2 px-5 py-2.5 bg-white border-b border-gray-100 shrink-0">
          {uniqueSpeakers.map((spk, idx) => {
            const c = SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
            const seg = segments.find(s => s.speaker === spk);
            return (
              <span key={spk} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${c.light}`}>
                <span className={`w-3.5 h-3.5 rounded-full ${c.bg} flex items-center justify-center text-[8px] font-bold text-white`}>{idx+1}</span>
                {spk}{seg?.gender && <span className="opacity-50">{seg.gender === 'female' ? '♀' : '♂'}</span>}
              </span>
            );
          })}
        </div>
      )}

      {/* ── Conversation area ── */}
      <div className="flex-1 px-4 py-4 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3 min-h-0">

        {displayItems.length === 0 && !isDiarizing && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
              <Mic className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-[15px] text-gray-400 font-medium">
              {isIdle ? 'Press Start to begin' : 'Listening…'}
            </p>

          </div>
        )}

        {isDiarizing && (
          <div className="flex items-center justify-center h-32 gap-2 text-[13px] text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />Detecting speakers…
          </div>
        )}

        {!isDiarizing && displayItems.map((item, i) => {
          if (item.processing) {
            return (
              <div key={item.id} className="flex gap-2.5 items-end">
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm">
                  <div className="flex gap-1 items-center h-4">
                    {[0,1,2].map(d => <div key={d} className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: `${d*0.15}s` }} />)}
                  </div>
                </div>
              </div>
            );
          }

          const spkLabel = item.speaker || null;
          const spkIdx   = spkLabel ? uniqueSpeakers.indexOf(spkLabel) : -1;
          const color    = SPEAKER_COLORS[Math.max(0, spkIdx) % SPEAKER_COLORS.length];
          const isRight  = spkIdx > 0 && spkIdx % 2 !== 0;
          const synthSeg = synthSegments[i];
          const isPlay   = playingIdx === i;

          return (
            <div key={item.id || i} className={`flex gap-2.5 items-end ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${spkLabel ? `${color.bg} text-white` : 'bg-gray-200 text-gray-500'}`}>
                {spkLabel ? (Math.max(0, spkIdx) + 1) : <Mic className="w-3 h-3" />}
              </div>
              <div className={`max-w-[72%] flex flex-col gap-1 ${isRight ? 'items-end' : 'items-start'}`}>
                {spkLabel && (
                  <span className={`text-[10px] font-semibold px-1 ${color.text}`}>
                    {spkLabel}{item.gender && <span className="ml-1 opacity-50">{item.gender === 'female' ? '♀' : '♂'}</span>}
                  </span>
                )}
                <div className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                  isRight ? 'bg-gray-900 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  <p className="text-[14px] leading-relaxed">{item.text}</p>
                  {item.translation && item.translation !== item.text && (
                    <p className={`text-[12px] mt-1 italic border-t pt-1 ${isRight ? 'text-white/50 border-white/10' : 'text-gray-400 border-gray-100'}`}>
                      {item.translation}
                    </p>
                  )}
                </div>
                {synthSeg?.audio && (
                  <button onClick={() => isPlay ? stopPlayback() : playSegment(i)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                      isPlay ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {isPlay ? <><Square className="w-2.5 h-2.5 fill-red-500" />Stop</> : <><Play className="w-2.5 h-2.5 fill-gray-500" />Play</>}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <div ref={boxEndRef} />
        </div>{/* end scrollable box */}
      </div>{/* end conversation area */}

      {/* ── Bottom controls ── */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 left-0 md:left-[220px]">
        {isActive && (
          <div className="flex items-end justify-center gap-[2px] h-7 mb-4">
            {bars.map((h, i) => (
              <div key={i} className="w-[3px] rounded-full bg-gray-900 transition-all duration-75" style={{ height: `${h}px` }} />
            ))}
          </div>
        )}
        <div className="flex items-center justify-center gap-3">
          {isIdle && (
            <button onClick={handleStart}
              className="flex items-center gap-2.5 bg-gray-900 hover:bg-gray-700 text-white px-8 py-3.5 rounded-2xl text-[15px] font-bold transition-all active:scale-95 shadow-sm">
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
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl text-[14px] font-bold transition-all active:scale-95">
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
              className="flex items-center gap-2.5 bg-gray-900 hover:bg-gray-700 text-white px-8 py-3.5 rounded-2xl text-[15px] font-bold transition-all active:scale-95">
              <Mic className="w-5 h-5" />New Session
            </button>
          )}
        </div>
        {isActive && <p className="text-center text-[11px] text-gray-400 mt-2">Translating every {CHUNK_MS/1000}s · keeps running while you navigate</p>}
      </div>
    </div>
  );
}
