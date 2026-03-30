import { Mic2, Ear, Globe, ScanText, Sparkles, Languages, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getLabels } from '../services/uiLabels';

export default function AppHome() {
  const { state, clearAll, RECORDING_MODES } = useApp();
  const navigate = useNavigate();
  const L = getLabels(state.uiLanguage);

  const FEATURES = [
    { icon: Mic2,     color: 'bg-violet-50 text-violet-600 border-violet-100', title: L.nativeToEnglish, desc: L.nativeToEnglishDesc,       path: '/app/home' },
    { icon: Ear,      color: 'bg-blue-50 text-blue-600 border-blue-100',       title: L.continuousListening, desc: L.continuousListeningDesc, path: '/app/continuous' },
    { icon: Globe,    color: 'bg-emerald-50 text-emerald-600 border-emerald-100', title: L.englishToNative, desc: L.englishToNativeDesc,     path: '/app/english-to-native' },
    { icon: ScanText, color: 'bg-amber-50 text-amber-600 border-amber-100',    title: L.visionTranslate, desc: L.visionTranslateDesc,        path: '/app/vision' },
  ];

  const go = (path) => {
    clearAll();
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-[#f8f8f8] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-10 py-4 md:py-5 flex items-center gap-3">
        <img src="/seedlinglabs-logo.png" alt="SeedlingSpeaks" className="w-8 h-8 rounded-xl object-contain" />
        <div>
          <h1 className="text-[16px] font-bold text-gray-900 leading-tight">SeedlingSpeaks</h1>
          <p className="text-[12px] text-gray-400">Multilingual AI Translation</p>
        </div>
      </div>

      {/* Hero */}
      <div className="px-4 md:px-10 pt-10 md:pt-14 pb-8 md:pb-10 max-w-3xl w-full mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-[12px] font-semibold text-amber-500 uppercase tracking-widest">Powered by Team ARTiculate</span>
        </div>
        <h2 className="text-[24px] md:text-[32px] font-bold text-gray-900 leading-tight tracking-tight mb-3">
          Break language barriers<br />with AI-powered translation.
        </h2>
        <p className="text-[15px] text-gray-400 leading-relaxed max-w-lg">
          Speak, type, or scan — translate between Indian regional languages and English with professional tone styling.
        </p>
      </div>

      {/* Feature cards */}
      <div className="px-4 md:px-10 max-w-3xl w-full mx-auto">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">{L.chooseMode}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {FEATURES.map(({ icon: Icon, color, title, desc, path }) => (
            <button
              key={path}
              onClick={() => go(path)}
              className="group bg-white border border-gray-100 rounded-2xl p-5 text-left hover:border-gray-300 hover:shadow-md transition-all active:scale-[0.98]"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${color}`}>
                  <Icon className="w-5 h-5" strokeWidth={1.8} />
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all mt-1" />
              </div>
              <p className="text-[14px] font-semibold text-gray-900 mb-1">{title}</p>
              <p className="text-[12px] text-gray-400 leading-relaxed">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Supported languages */}
      <div className="px-4 md:px-10 pt-8 md:pt-10 pb-16 max-w-3xl w-full mx-auto">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">{L.supportedLanguages}</p>
        <div className="flex flex-wrap gap-2">
          {['Hindi', 'Bengali', 'Tamil', 'Telugu', 'Malayalam', 'Marathi', 'Gujarati', 'Kannada', 'Punjabi', 'Odia'].map(lang => (
            <span key={lang} className="px-3 py-1 rounded-full bg-white border border-gray-200 text-[12px] text-gray-500 font-medium">
              {lang}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
