import { Mic, Ear, FileAudio, ScanText, ArrowRight, Languages, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();
  const goAuth = () => navigate('/auth');

  const features = [
    { icon: Mic,       title: 'Live Transcription',    desc: 'Push-to-talk recording in 10 Indian languages with instant English output.',  tag: 'Push-to-talk' },
    { icon: Ear,       title: 'Continuous Listening',  desc: 'Hands-free mode with silence detection — ideal for meetings and lectures.',    tag: 'Hands-free'   },
    { icon: FileAudio, title: 'Audio Upload',          desc: 'Transcribe MP3, WAV, M4A, OGG files up to 100MB in seconds.',                 tag: 'File upload'  },
    { icon: ScanText,  title: 'Vision Translate',      desc: 'Point your camera at any text — signs, menus, docs — and get it translated.', tag: 'Image OCR'    },
    { icon: Languages, title: 'Native Translation',    desc: 'Translate output into any Indian language with one tap.',                      tag: 'Multilingual' },
    { icon: Sparkles,  title: 'AI Tone Rewriting',     desc: 'Rewrite transcripts in Email, Slack, or LinkedIn tone using Gemini AI.',      tag: 'AI-powered'   },
  ];

  const stats = [
    { value: '10+', label: 'Indian languages' },
    { value: '4',   label: 'Input modes'       },
    { value: '3',   label: 'AI tone styles'    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#faf8f4] overflow-x-hidden">

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 md:px-14 py-5 sticky top-0 z-50 bg-[#faf8f4]/90 backdrop-blur-sm border-b border-[#ede5d8]">
        <div className="flex items-center gap-2.5">
          <img src="/seedlinglabs-logo.png" alt="Seedlinglabs" className="w-8 h-8 rounded-full object-cover" />
          <span className="text-[15px] font-bold text-[#1a0f00] tracking-tight">SeedlingSpeaks</span>
        </div>
        <button onClick={goAuth}
          className="flex items-center gap-2 bg-[#1a0f00] hover:bg-[#2d1a00] text-white text-[13px] font-semibold px-5 py-2.5 rounded-full transition-all">
          Get started <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-20 pb-16">
        {/* Badge */}
        <div className="flex items-center gap-2 bg-[#f5ede0] border border-[#e8d5b8] rounded-full px-4 py-1.5 mb-8">
          <Sparkles className="w-3.5 h-3.5 text-[#c9a84c]" />
          <span className="text-[12px] font-semibold text-[#8a5c2e] tracking-wide">Powered by Team ARTiculate</span>
        </div>

        <h1 className="text-[2.2rem] md:text-[4rem] font-extrabold text-[#1a0f00] leading-[1.08] tracking-tight max-w-3xl mb-6">
          Speak in any language.<br />
          <span className="text-[#c9a84c]">Understood everywhere.</span>
        </h1>

        <p className="text-[#7a6a55] text-[17px] leading-relaxed max-w-lg mb-10">
          Transcribe, translate, and rewrite speech across 10 Indian languages — then send it anywhere in seconds.
        </p>

        <div className="flex items-center gap-4 flex-wrap justify-center">
          <button onClick={goAuth}
            className="flex items-center gap-2 bg-[#1a0f00] hover:bg-[#2d1a00] text-white text-[15px] font-bold px-8 py-3.5 rounded-full transition-all shadow-lg shadow-[#1a0f00]/20">
            Start for free <ArrowRight className="w-4 h-4" />
          </button>
          <button onClick={goAuth}
            className="flex items-center gap-2 border border-[#d4c4a8] hover:border-[#c9a84c] text-[#3b1f0e] text-[15px] font-semibold px-8 py-3.5 rounded-full transition-all">
            Try demo
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-10 mt-14 flex-wrap justify-center">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-[2rem] font-extrabold text-[#1a0f00]">{s.value}</p>
              <p className="text-[12px] text-[#9a8a75] font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="w-full max-w-5xl mx-auto px-8 mb-16">
        <div className="h-px bg-gradient-to-r from-transparent via-[#e0d0b8] to-transparent" />
      </div>

      {/* Features */}
      <section className="px-6 md:px-14 pb-20 max-w-6xl mx-auto w-full">
        <p className="text-[11px] font-bold text-[#c9a84c] uppercase tracking-widest text-center mb-3">Everything you need</p>
        <h2 className="text-[2rem] font-extrabold text-[#1a0f00] text-center mb-12">One tool, every language task</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title}
              className="group bg-white border border-[#ede5d8] rounded-2xl p-6 hover:border-[#c9a84c]/50 hover:shadow-md transition-all cursor-default">
              <div className="flex items-start justify-between mb-5">
                <div className="w-10 h-10 rounded-xl bg-[#f5ede0] flex items-center justify-center group-hover:bg-[#c9a84c]/15 transition-colors">
                  <f.icon className="w-4.5 h-4.5 text-[#8a5c2e]" strokeWidth={1.8} />
                </div>
                <span className="text-[10px] font-bold text-[#c9a84c] uppercase tracking-widest bg-[#fdf6e8] px-2 py-0.5 rounded-full">{f.tag}</span>
              </div>
              <p className="text-[15px] font-bold text-[#1a0f00] mb-2">{f.title}</p>
              <p className="text-[13px] text-[#9a8a75] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="mx-4 md:mx-14 mb-20 rounded-3xl bg-[#1a0f00] px-6 md:px-10 py-10 md:py-14 flex flex-col md:flex-row items-center justify-between gap-8 max-w-6xl xl:mx-auto">
        <div>
          <h3 className="text-[1.8rem] font-extrabold text-white leading-tight mb-2">
            Ready to break the<br />language barrier?
          </h3>
          <p className="text-[14px] text-white/50">No setup needed. Works right in your browser.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={goAuth}
            className="flex items-center gap-2 bg-[#c9a84c] hover:bg-[#b8943e] text-[#1a0f00] text-[15px] font-bold px-8 py-3.5 rounded-full transition-all shadow-lg">
            Get started free <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center pb-8 pt-2">
        <div className="flex items-center justify-center gap-2 mb-2">
          <img src="/seedlinglabs-logo.png" alt="Seedlinglabs" className="w-5 h-5 rounded-full object-cover opacity-60" />
          <span className="text-[12px] text-[#c4b49a] font-medium">SeedlingSpeaks</span>
        </div>
        <p className="text-[11px] text-[#d4c4a8]">v2.5 · Built by Seedlinglabs</p>
      </footer>
    </div>
  );
}
