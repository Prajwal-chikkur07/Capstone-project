import { Mic, Ear, FileAudio, ScanText, ArrowRight, Globe, Zap, Shield } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function LandingPage() {
  const { setField, setFields, RECORDING_MODES } = useApp();

  const features = [
    {
      icon: Mic,
      title: 'Start Speaking',
      desc: 'Record live with push-to-talk. Speak in any Indian language and get an instant English transcript.',
      tag: 'Push-to-talk',
      action: () => setFields({ currentView: 'home', recordingMode: RECORDING_MODES.PUSH_TO_TALK }),
    },
    {
      icon: Ear,
      title: 'Continuous Listening',
      desc: 'Hands-free recording with automatic silence detection. Perfect for meetings and long sessions.',
      tag: 'Hands-free',
      action: () => setField('currentView', 'continuous'),
    },
    {
      icon: FileAudio,
      title: 'Upload Audio File',
      desc: 'Transcribe pre-recorded audio. Supports MP3, WAV, M4A, OGG up to 100MB.',
      tag: 'File upload',
      action: () => setFields({ currentView: 'home', recordingMode: RECORDING_MODES.FILE_UPLOAD }),
    },
    {
      icon: ScanText,
      title: 'Vision Translate',
      desc: 'Upload a photo of a document, sign, or menu. Gemini reads and translates all text instantly.',
      tag: 'Image OCR',
      action: () => setField('currentView', 'vision'),
    },
  ];

  const highlights = [
    { icon: Globe,  label: '10 Indian languages' },
    { icon: Zap,    label: 'AI-powered rewrites'  },
    { icon: Shield, label: 'Privacy first'         },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#faf8f4]">
      {/* Nav */}
      <div className="flex items-center justify-between px-10 py-5">
        <div className="flex items-center gap-2.5">
          <img src="/seedlinglabs-logo.png" alt="Seedlinglabs" className="w-8 h-8 rounded-full object-cover" />
          <span className="text-[15px] font-bold text-[#3b1f0e] tracking-tight">Saaras</span>
        </div>
        <div className="flex items-center gap-2 border border-[#c9a84c]/40 bg-white rounded-full px-4 py-1.5">
          <img src="/seedlinglabs-logo.png" alt="" className="w-4 h-4 rounded-full object-cover" />
          <span className="text-[11px] font-semibold text-[#8a6a1f] uppercase tracking-widest">Powered by Seedlinglabs</span>
        </div>
      </div>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pt-10 pb-12">
        {/* Logo mark */}
        <div className="mb-8">
          <img src="/seedlinglabs-logo.png" alt="Seedlinglabs" className="w-20 h-20 rounded-full object-cover shadow-md" style={{ boxShadow: '0 4px 24px rgba(201,168,76,0.25)' }} />
        </div>

        {/* Headline */}
        <h1 className="text-[3.2rem] font-extrabold text-[#1a0f00] leading-[1.1] tracking-tight text-center mb-4 max-w-2xl">
          Transcribe speech,<br />
          <span className="text-[#c9a84c]">get instant transcripts</span>
        </h1>
        <p className="text-[#7a6a55] text-[17px] text-center leading-relaxed max-w-md mb-12">
          Record live or upload audio in any Indian language — then translate, rewrite, and send.
        </p>

        {/* Mode cards */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-[660px] mb-12">
          {features.map((f) => (
            <button
              key={f.title}
              onClick={f.action}
              className="group relative bg-white hover:bg-[#fdf6e8] border border-[#e8dcc8] hover:border-[#c9a84c]/60 rounded-2xl p-6 text-left transition-all duration-150 shadow-sm hover:shadow-md"
            >
              <div className="flex items-start justify-between mb-5">
                <div className="w-9 h-9 rounded-xl bg-[#f5ede0] group-hover:bg-[#f0e0c0] flex items-center justify-center transition-colors">
                  <f.icon className="w-4 h-4 text-[#8a5c2e]" strokeWidth={1.8} />
                </div>
                <span className="text-[10px] font-bold text-[#c9a84c] uppercase tracking-widest">
                  {f.tag}
                </span>
              </div>
              <p className="text-[15px] font-bold text-[#1a0f00] mb-1.5">{f.title}</p>
              <p className="text-[13px] text-[#9a8a75] leading-relaxed mb-5">{f.desc}</p>
              <div className="flex items-center gap-1 text-[12px] font-semibold text-[#c9a84c] group-hover:text-[#8a5c2e] transition-colors">
                Get started
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          ))}
        </div>

        {/* Highlights */}
        <div className="flex items-center gap-8 flex-wrap justify-center">
          {highlights.map((h) => (
            <div key={h.label} className="flex items-center gap-2">
              <h.icon className="w-3.5 h-3.5 text-[#c9a84c]" />
              <span className="text-[13px] text-[#7a6a55] font-medium">{h.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pb-6 pt-4">
        <p className="text-[11px] text-[#c4b49a]">Saaras v2.5 · Built by Seedlinglabs</p>
      </div>
    </div>
  );
}
