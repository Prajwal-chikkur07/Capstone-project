import { useState, useEffect } from 'react';
import { Mic2, Ear, Globe, ScanText, Sparkles, ArrowRight, Radio, Bell, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getLabels } from '../services/uiLabels';

const WIDGET_URL = 'http://127.0.0.1:27182';

const CARD_COLORS = {
  '/app/home':              'var(--surface-peach)',
  '/app/continuous':        'var(--surface-blue)',
  '/app/english-to-native': 'var(--surface-teal)',
  '/app/vision':            'var(--surface-lime)',
  '/app/video':             'var(--surface-lavender)',
};

export default function AppHome() {
  const { state, clearAll } = useApp();
  const navigate = useNavigate();
  const L = getLabels(state.uiLanguage);
  const [widgetOn, setWidgetOn] = useState(false);
  const [widgetLoading, setWidgetLoading] = useState(false);

  useEffect(() => {
    fetch(`${WIDGET_URL}/status`, { signal: AbortSignal.timeout(800) })
      .then(r => r.json()).then(d => setWidgetOn(d.enabled)).catch(() => {});
  }, []);

  const toggleWidget = async () => {
    setWidgetLoading(true);
    try {
      const res = await fetch(`${WIDGET_URL}/toggle`, { signal: AbortSignal.timeout(1500) });
      const d = await res.json();
      setWidgetOn(d.enabled);
    } catch {}
    setWidgetLoading(false);
  };

  const FEATURES = [
    { icon: Mic2,     title: L.nativeToEnglish,     desc: L.nativeToEnglishDesc,     path: '/app/home' },
    { icon: Ear,      title: L.continuousListening, desc: L.continuousListeningDesc, path: '/app/continuous' },
    { icon: Globe,    title: L.englishToNative,     desc: L.englishToNativeDesc,     path: '/app/english-to-native' },
    { icon: ScanText, title: L.visionTranslate,     desc: L.visionTranslateDesc,     path: '/app/vision' },
  ];

  const go = (path) => { clearAll(); navigate(path); };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      {/* Header */}
      <div className="app-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/seedlinglabs-logo.png" alt="SeedlingSpeaks" style={{ width: 36, height: 36, borderRadius: 12, objectFit: 'contain' }} />
          <div>
            <h1 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>SeedlingSpeaks</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Multilingual AI Translation</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', borderRadius: 'var(--radius-pill)', boxShadow: 'var(--shadow-card)', padding: '10px 18px', width: 220 }} className="hidden md:flex">
            <Search className="w-4 h-4" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input placeholder="Search features…" style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.875rem', color: 'var(--text-primary)', width: '100%', boxShadow: 'none' }} />
          </div>
          <button style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface)', boxShadow: 'var(--shadow-card)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            <Bell className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 80px' }}>
        {/* Hero */}
        <div style={{ marginBottom: 36 }}>
          <div className="accent-badge" style={{ marginBottom: 14 }}>
            <Sparkles className="w-3 h-3" />
            Powered by Team ARTiculate
          </div>
          <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, margin: '0 0 12px', letterSpacing: '-0.02em' }}>
            Break language barriers<br />with AI-powered translation.
          </h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 460, margin: 0 }}>
            Speak, type, or scan — translate between Indian regional languages and English with professional tone styling.
          </p>
        </div>

        {/* Choose mode */}
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 16 }}>{L.chooseMode}</p>

        {/* Feature cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
          {FEATURES.map(({ icon: Icon, title, desc, path }) => (
            <button key={path} className="feature-card" onClick={() => go(path)} style={{ background: CARD_COLORS[path] }}>
              <div className="card-deco" />
              <div className="card-icon"><Icon className="w-5 h-5" strokeWidth={2} /></div>
              <ArrowRight className="card-arrow" />
              <p style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>{title}</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{desc}</p>
            </button>
          ))}
        </div>

        {/* Desktop Widget */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-inner)', boxShadow: 'var(--shadow-card)', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Radio className="w-5 h-5" style={{ color: 'var(--accent)' }} strokeWidth={1.8} />
            </div>
            <div>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Desktop Widget</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>{widgetOn ? 'Active — floating bubble is visible' : 'Disabled — toggle to enable'}</p>
            </div>
          </div>
          <button onClick={toggleWidget} disabled={widgetLoading}
            className={widgetOn ? 'toggle-on' : 'toggle-off'}
            style={{ width: 46, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', padding: '0 3px', display: 'flex', alignItems: 'center', transition: 'all 0.2s', opacity: widgetLoading ? 0.5 : 1 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transform: widgetOn ? 'translateX(20px)' : 'translateX(0)', transition: 'transform 0.2s' }} />
          </button>
        </div>

        {/* Languages */}
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 14 }}>{L.supportedLanguages}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {['Hindi', 'Bengali', 'Tamil', 'Telugu', 'Malayalam', 'Marathi', 'Gujarati', 'Kannada', 'Punjabi', 'Odia'].map(lang => (
            <span key={lang} className="lang-pill">{lang}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
