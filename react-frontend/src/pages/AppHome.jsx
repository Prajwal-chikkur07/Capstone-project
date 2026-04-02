import { useState, useEffect } from 'react';
import { Mic2, Ear, Globe, ScanText, Sparkles, ArrowRight, Radio, Bell, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getLabels } from '../services/uiLabels';

const WIDGET_URL = 'http://127.0.0.1:27182';

const CARD_COLORS = {
  '/app/home':              '#FAF0E4',   /* warm peach-cream */
  '/app/continuous':        '#E8EEF8',   /* soft periwinkle */
  '/app/english-to-native': '#E8F4ED',   /* soft sage */
  '/app/vision':            '#F5EEF8',   /* soft lavender */
  '/app/video':             '#FDF4E3',   /* soft turmeric */
};

const CARD_BORDERS = {
  '/app/home':              'rgba(232,130,12,0.15)',
  '/app/continuous':        'rgba(61,79,138,0.15)',
  '/app/english-to-native': 'rgba(45,106,79,0.15)',
  '/app/vision':            'rgba(107,70,150,0.15)',
  '/app/video':             'rgba(212,160,23,0.20)',
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
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <h1 className="page-header-title">SeedlingSpeaks</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-faded)', margin: 0 }}>Multilingual AI Translation</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', borderRadius: 'var(--r-pill)', boxShadow: 'var(--shadow-sm)', padding: '9px 18px', width: 220 }} className="hidden md:flex">
            <Search className="w-4 h-4" style={{ color: 'var(--text-faded)', flexShrink: 0 }} />
            <input placeholder="Search features…" style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem', color: 'var(--text-ink)', width: '100%', boxShadow: 'none' }} />
          </div>
          <button style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faded)' }}>
            <Bell className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 80px' }} className="page-content">
        {/* Hero */}
        <div style={{ marginBottom: 36 }}>
          <div className="accent-badge" style={{ marginBottom: 14 }}>
            <Sparkles className="w-3 h-3" />
            Powered by Team ARTiculate
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 600, color: 'var(--text-ink)', lineHeight: 1.1, margin: '0 0 12px', letterSpacing: '-0.03em' }}>
            Break language <em style={{ fontStyle: 'italic' }}>barriers</em><br />with AI-powered <em style={{ fontStyle: 'italic' }}>translation</em>.
          </h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-warm)', lineHeight: 1.7, maxWidth: 460, margin: 0 }}>
            Speak, type, or scan — translate between Indian regional languages and English with professional tone styling.
          </p>
        </div>

        {/* Choose mode */}
        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', color: 'var(--text-faded)', textTransform: 'uppercase', marginBottom: 16 }}>{L.chooseMode}</p>

        {/* Feature cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
          {FEATURES.map(({ icon: Icon, title, desc, path }) => (
            <button key={path} className="feature-card stagger-child" onClick={() => go(path)} style={{ background: CARD_COLORS[path], border: `1px solid ${CARD_BORDERS[path]}` }}>
              <div className="card-deco" />
              <div className="card-icon"><Icon className="w-5 h-5" strokeWidth={2} /></div>
              <ArrowRight className="card-arrow" />
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 500, color: 'var(--text-ink)', margin: '0 0 4px', letterSpacing: '-0.01em' }}>{title}</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-warm)', lineHeight: 1.6, margin: 0 }}>{desc}</p>
            </button>
          ))}
        </div>

        {/* Desktop Widget */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-warm)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', background: 'var(--saffron-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Radio className="w-5 h-5" style={{ color: 'var(--saffron)' }} strokeWidth={1.8} />
            </div>
            <div>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-ink)', margin: 0 }}>Desktop Widget</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-faded)', margin: 0 }}>{widgetOn ? 'Active — floating bubble is visible' : 'Disabled — toggle to enable'}</p>
            </div>
          </div>
          <button onClick={toggleWidget} disabled={widgetLoading}
            className={widgetOn ? 'toggle-on' : 'toggle-off'}
            style={{ width: 46, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', padding: '0 3px', display: 'flex', alignItems: 'center', transition: 'all 0.2s', opacity: widgetLoading ? 0.5 : 1 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transform: widgetOn ? 'translateX(20px)' : 'translateX(0)', transition: 'transform 0.2s' }} />
          </button>
        </div>

        {/* Languages */}
        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', color: 'var(--text-faded)', textTransform: 'uppercase', marginBottom: 14 }}>{L.supportedLanguages}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {['Hindi', 'Bengali', 'Tamil', 'Telugu', 'Malayalam', 'Marathi', 'Gujarati', 'Kannada', 'Punjabi', 'Odia'].map(lang => (
            <span key={lang} className="lang-pill">{lang}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
