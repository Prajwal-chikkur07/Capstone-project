import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Volume2, ChevronDown, Mic2, RefreshCw } from 'lucide-react';

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

export default function Settings() {
  const { state, setField } = useApp();
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

      </div>
    </div>
  );
}
