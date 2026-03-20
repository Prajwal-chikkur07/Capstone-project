import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Volume2, ChevronDown, Mic2, RefreshCw, Database, Trash2, Zap, BarChart2, Moon, Sun } from 'lucide-react';
import * as api from '../services/api';

// Lang prefix map for filtering voices
const LANG_PREFIXES = {
  'hi-IN': ['hi', 'hi-IN'],
  'bn-IN': ['bn', 'bn-IN'],
  'ta-IN': ['ta', 'ta-IN'],
  'te-IN': ['te', 'te-IN'],
  'ml-IN': ['ml', 'ml-IN'],
  'mr-IN': ['mr', 'mr-IN'],
  'gu-IN': ['gu', 'gu-IN'],
  'kn-IN': ['kn', 'kn-IN'],
  'pa-IN': ['pa', 'pa-IN'],
  'or-IN': ['or', 'or-IN'],
};

const LANG_LABELS = {
  'hi-IN': 'Hindi', 'bn-IN': 'Bengali', 'ta-IN': 'Tamil', 'te-IN': 'Telugu',
  'ml-IN': 'Malayalam', 'mr-IN': 'Marathi', 'gu-IN': 'Gujarati',
  'kn-IN': 'Kannada', 'pa-IN': 'Punjabi', 'or-IN': 'Odia',
};

function loadVoices() {
  return window.speechSynthesis?.getVoices() || [];
}

const LANG_NAMES = {
  'hi-IN': 'Hindi', 'bn-IN': 'Bengali', 'ta-IN': 'Tamil', 'te-IN': 'Telugu',
  'ml-IN': 'Malayalam', 'mr-IN': 'Marathi', 'gu-IN': 'Gujarati',
  'kn-IN': 'Kannada', 'pa-IN': 'Punjabi', 'or-IN': 'Odia',
};

function CacheStatsCard() {
  const [stats, setStats] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = async () => {
    try { setStats(await api.getCacheStats()); } catch { /* backend may not be up */ }
  };

  useEffect(() => { load(); }, []);

  const handleClear = async () => {
    setClearing(true);
    try { await api.clearCache(); await load(); setConfirmClear(false); }
    finally { setClearing(false); }
  };

  const hitRate = stats && stats.total_entries > 0
    ? Math.round((stats.total_hits / (stats.total_hits + stats.total_entries)) * 100)
    : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
            <Database className="w-4 h-4 text-gray-600" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-gray-900">Translation Cache</p>
            <p className="text-[12px] text-gray-400 mt-0.5">Semantic cache — skips Sarvam API on repeated phrases</p>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {stats == null ? (
        <p className="text-[13px] text-gray-300 py-2">Loading stats...</p>
      ) : (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Cached entries', value: stats.total_entries },
              { label: 'Total hits', value: stats.total_hits },
              { label: 'Hit rate', value: `${hitRate}%` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 text-center">
                <p className="text-[18px] font-extrabold text-gray-900">{value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Per-language breakdown */}
          {Object.keys(stats.by_language).length > 0 && (
            <div className="space-y-1.5 mb-4">
              <p className="text-[11px] font-bold text-gray-300 uppercase tracking-widest mb-2">By language</p>
              {Object.entries(stats.by_language).map(([lang, d]) => (
                <div key={lang} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span className="text-[13px] font-medium text-gray-700">{LANG_NAMES[lang] || lang}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[12px] text-gray-400">
                    <span>{d.entries} entries</span>
                    <span className="text-green-500 font-semibold">{d.hits} hits</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Clear button */}
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-gray-500 flex-1">Clear all cached translations?</span>
              <button onClick={handleClear} disabled={clearing}
                className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[13px] font-semibold hover:bg-red-600 disabled:opacity-40 transition-all">
                {clearing ? 'Clearing...' : 'Yes, clear'}
              </button>
              <button onClick={() => setConfirmClear(false)}
                className="px-3 py-1.5 rounded-lg text-gray-400 hover:bg-gray-100 text-[13px] transition-all">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-red-100 transition-all">
              <Trash2 className="w-3.5 h-3.5" />Clear cache
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function Settings() {
  const { state, setField, toggleDark } = useApp();
  const [allVoices, setAllVoices] = useState([]);
  const [previewLang, setPreviewLang] = useState(state.selectedLanguage);

  const refreshVoices = () => {
    const v = loadVoices();
    setAllVoices(v);
  };

  useEffect(() => {
    refreshVoices();
    // voices load async in some browsers
    window.speechSynthesis.onvoiceschanged = refreshVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // Filter voices for the preview language
  const prefixes = LANG_PREFIXES[previewLang] || [previewLang.split('-')[0]];
  const filteredVoices = allVoices.filter(v =>
    prefixes.some(p => v.lang === p || v.lang.startsWith(p + '-') || v.lang.startsWith(p))
  );

  // Also show "any" voices as fallback if none found
  const displayVoices = filteredVoices.length > 0 ? filteredVoices : allVoices.slice(0, 12);

  const activeVoice = allVoices.find(v => v.voiceURI === state.selectedVoice);

  const handlePreview = (voice) => {
    window.speechSynthesis.cancel();
    const sample = {
      'hi-IN': 'नमस्ते, यह एक परीक्षण है।',
      'ta-IN': 'வணக்கம், இது ஒரு சோதனை.',
      'te-IN': 'నమస్కారం, ఇది ఒక పరీక్ష.',
      'bn-IN': 'হ্যালো, এটি একটি পরীক্ষা।',
      'ml-IN': 'ഹലോ, ഇത് ഒരു പരീക്ഷണമാണ്.',
      'mr-IN': 'नमस्कार, हे एक चाचणी आहे.',
      'gu-IN': 'નમસ્તે, આ એક પરીક્ષણ છે.',
      'kn-IN': 'ನಮಸ್ಕಾರ, ಇದು ಒಂದು ಪರೀಕ್ಷೆ.',
    };
    const text = sample[previewLang] || 'Hello, this is a voice preview.';
    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = voice;
    utter.lang = voice.lang;
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
  };

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <div className="bg-white border-b border-gray-100 px-8 py-4">
        <h2 className="text-[20px] font-extrabold text-gray-900 tracking-tight">Settings</h2>
        <p className="text-[13px] text-gray-400 mt-0.5">Manage your preferences</p>
      </div>

      <div className="px-8 py-8 max-w-2xl space-y-4">

        {/* Voice setting */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">

          {/* Header row */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                <Volume2 className="w-4 h-4 text-gray-600" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-gray-900">Text-to-Speech Voice</p>
                <p className="text-[12px] text-gray-400 mt-0.5">Real voices from your device — click any to preview</p>
              </div>
            </div>
            <button onClick={refreshVoices} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all" title="Refresh voices">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Language filter */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[13px] text-gray-500 font-medium shrink-0">Filter by language</span>
            <div className="relative flex-1">
              <select
                value={previewLang}
                onChange={e => setPreviewLang(e.target.value)}
                className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl pl-3 pr-8 py-2 text-[13px] font-medium text-gray-700 cursor-pointer focus:outline-none hover:border-gray-300 transition-all"
              >
                {Object.entries(LANG_LABELS).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Voice list */}
          {displayVoices.length === 0 ? (
            <div className="text-center py-8 text-gray-300 text-[14px]">
              No voices found. Click refresh or check browser settings.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {displayVoices.map((voice) => {
                const isSelected = state.selectedVoice === voice.voiceURI;
                return (
                  <div
                    key={voice.voiceURI}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-gray-900 border-gray-900'
                        : 'bg-gray-50 border-gray-100 hover:border-gray-300 hover:bg-white'
                    }`}
                    onClick={() => setField('selectedVoice', voice.voiceURI)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {voice.name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-[13px] font-semibold truncate ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                          {voice.name}
                        </p>
                        <p className={`text-[11px] ${isSelected ? 'text-white/60' : 'text-gray-400'}`}>
                          {voice.lang} {voice.localService ? '· Local' : '· Network'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePreview(voice); }}
                      className={`shrink-0 p-1.5 rounded-lg transition-all ${
                        isSelected ? 'hover:bg-white/20 text-white' : 'hover:bg-gray-200 text-gray-400 hover:text-gray-700'
                      }`}
                      title="Preview voice"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Active indicator */}
          <div className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
            <Mic2 className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[13px] text-gray-500">
              Active: <span className="font-semibold text-gray-800">
                {activeVoice ? activeVoice.name : 'Auto (best match for language)'}
              </span>
            </span>
          </div>
        </div>

        {/* Translation Cache Stats */}
        <CacheStatsCard />

        {/* Dark Mode */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                {state.darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-gray-600" />}
              </div>
              <div>
                <p className="text-[14px] font-semibold text-gray-900">Dark mode</p>
                <p className="text-[12px] text-gray-400 mt-0.5">{state.darkMode ? 'Currently on' : 'Currently off'}</p>
              </div>
            </div>
            <button onClick={toggleDark}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${state.darkMode ? 'bg-gray-900' : 'bg-gray-200'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${state.darkMode ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        {/* Usage Dashboard */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
              <BarChart2 className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-gray-900">API Usage</p>
              <p className="text-[12px] text-gray-400 mt-0.5">Calls made this session (stored locally)</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Sarvam calls',  value: state.usageStats?.sarvamCalls  || 0, color: 'text-blue-600'  },
              { label: 'Gemini calls',  value: state.usageStats?.geminiCalls  || 0, color: 'text-amber-600' },
              { label: 'Cache hits',    value: state.usageStats?.cacheHits    || 0, color: 'text-green-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 text-center">
                <p className={`text-[20px] font-extrabold ${color}`}>{value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
