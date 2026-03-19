import { Volume2, StopCircle, Copy, Check, Trash2 } from 'lucide-react';
import { useRef, useCallback, useState } from 'react';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';

export default function OutputBox({ label, content, language, type }) {
  const { state, setField, setLoading, showError } = useApp();
  const [copied, setCopied] = useState(false);
  const audioRef = useRef(null);

  const playingKey = {
    english: 'isPlayingEnglish',
    rewritten: 'isPlayingRewritten',
    native: 'isPlayingNative',
  }[type];

  const isPlaying = state[playingKey];

  const handlePlay = useCallback(async () => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      setField(playingKey, true);
      setLoading('Generating speech...');

      const blob = await api.textToSpeech(content, language);
      setLoading(null);

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setField(playingKey, false);
        URL.revokeObjectURL(url);
      };

      audio.play();
    } catch (err) {
      setField(playingKey, false);
      setLoading(null);
      showError(err.response?.data?.detail || 'TTS Error');
    }
  }, [content, language, playingKey, setField, setLoading, showError]);

  const handleStop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setField(playingKey, false);
  }, [playingKey, setField]);

  const handleClear = useCallback(() => {
    const textKey = {
      english: 'englishText',
      rewritten: 'rewrittenText',
      native: 'nativeTranslation',
    }[type];
    if (textKey) setField(textKey, '');
  }, [type, setField]);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  if (!content) return null;

  return (
    <div className="glass-card shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-1 bg-blue-600 h-4 rounded-full" />
          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">{label}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={copyToClipboard}
            className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-blue-600 transition-all"
            title="Copy"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
          {language && type && (
            <button
              onClick={isPlaying ? handleStop : handlePlay}
              className={`p-1.5 rounded-lg transition-all ${
                isPlaying
                  ? 'bg-red-50 text-red-500 hover:bg-red-100'
                  : 'hover:bg-slate-50 text-slate-400 hover:text-blue-600'
              }`}
              title={isPlaying ? 'Stop' : 'Listen'}
            >
              {isPlaying ? <StopCircle className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={handleClear}
            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
            title="Clear text"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative group min-h-[80px]">
        <p className="text-slate-700 text-base leading-relaxed font-medium whitespace-pre-wrap">
          {content}
        </p>
        
        <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">
            {language}
          </span>
          <span className="text-[10px] text-slate-300 font-medium italic">
            Translation Verified
          </span>
        </div>
      </div>
    </div>
  );
}
