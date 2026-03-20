import { Mic2, Ear, Globe, ScanText, Sparkles, Languages, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';

const FEATURES = [
  {
    icon: Mic2,
    color: 'bg-violet-50 text-violet-600 border-violet-100',
    title: 'Native to English',
    desc: 'Speak in any Indian language and get an instant English transcript with AI tone rewriting.',
    view: 'home',
  },
  {
    icon: Ear,
    color: 'bg-blue-50 text-blue-600 border-blue-100',
    title: 'Continuous Listening',
    desc: 'Hands-free recording with automatic silence detection — no button pressing needed.',
    view: 'continuous',
  },
  {
    icon: Globe,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    title: 'English to Native',
    desc: 'Type or paste English text and translate it into 10+ Indian regional languages.',
    view: 'englishToNative',
  },
  {
    icon: ScanText,
    color: 'bg-amber-50 text-amber-600 border-amber-100',
    title: 'Vision Translate',
    desc: 'Upload an image with text and translate it into your preferred language instantly.',
    view: 'vision',
  },
];

export default function AppHome() {
  const { setField, setFields, clearAll, RECORDING_MODES } = useApp();

  const go = (view) => {
    clearAll();
    if (view === 'home') setFields({ currentView: 'home', recordingMode: RECORDING_MODES.PUSH_TO_TALK });
    else setField('currentView', view);
  };

  return (
    <div className="min-h-screen bg-[#f8f8f8] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-10 py-5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center">
          <Languages className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-[16px] font-bold text-gray-900 leading-tight">SeedlingSpeaks</h1>
          <p className="text-[12px] text-gray-400">Multilingual AI Translation</p>
        </div>
      </div>

      {/* Hero */}
      <div className="px-10 pt-14 pb-10 max-w-3xl w-full mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-[12px] font-semibold text-amber-500 uppercase tracking-widest">Powered by Team ARTiculate</span>
        </div>
        <h2 className="text-[32px] font-bold text-gray-900 leading-tight tracking-tight mb-3">
          Break language barriers<br />with AI-powered translation.
        </h2>
        <p className="text-[15px] text-gray-400 leading-relaxed max-w-lg">
          Speak, type, or scan — translate between Indian regional languages and English with professional tone styling.
        </p>
      </div>

      {/* Feature cards */}
      <div className="px-10 max-w-3xl w-full mx-auto">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">Choose a mode to get started</p>
        <div className="grid grid-cols-2 gap-4">
          {FEATURES.map(({ icon: Icon, color, title, desc, view }) => (
            <button
              key={view}
              onClick={() => go(view)}
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
      <div className="px-10 pt-10 pb-16 max-w-3xl w-full mx-auto">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Supported languages</p>
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
