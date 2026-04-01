import { useState, useEffect } from 'react';
import { Mic2, Ear, Globe, ScanText, Sparkles, ArrowRight, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getLabels } from '../services/uiLabels';

const WIDGET_URL = 'http://127.0.0.1:27182';

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
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden' }}>
      {/* Hero glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 40% at 40% 20%, rgba(249,115,22,0.08) 0%, transparent 70%)',
      }} />

      {/* Header */}
      <div className="app-header" style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img src="/seedlinglabs-logo.png" alt="SeedlingSpeaks" style={{ width: 32, height: 32, borderRadius: 10, objectFit: 'contain' }} />
        <div>
          <h1 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>SeedlingSpeaks</h1>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Multilingual AI Translation</p>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 80px' }}>
        {/* Hero */}
        <div style={{ marginBottom: 40 }}>
          <div className="accent-badge" style={{ marginBottom: 16 }}>
            <Sparkles className="w-3 h-3" />
            Powered by Team ARTiculate
          </div>
          <h2 style={{
            fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 600,
            color: 'var(--text-primary)', lineHeight: 1.15, margin: '0 0 12px',
            letterSpacing: '-0.02em',
          }}>
            Break language barriers<br />with AI-powered translation.
          </h2>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 480, margin: 0 }}>
            Speak, type, or scan — translate between Indian regional languages and English with professional tone styling.
          </p>
        </div>

        {/* Choose mode label */}
        <p style={{ fontSize: '11px', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 16, fontFamily: "'JetBrains Mono', monospace" }}>
          {L.chooseMode}
        </p>

        {/* Feature cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
          {FEATURES.map(({ icon: Icon, title, desc, path }) => (
            <button key={path} className="feature-card" onClick={() => go(path)} style={{ textAlign: 'left', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div className="card-icon">
                  <Icon className="w-5 h-5" strokeWidth={1.8} />
                </div>
                <ArrowRight className="card-arrow w-4 h-4" style={{ marginTop: 4 }} />
              </div>
              <p style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 6px' }}>{title}</p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{desc}</p>
            </button>
          ))}
        </div>

        {/* Desktop Widget toggle */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '16px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: widgetOn ? 'rgba(249,115,22,0.15)' : 'var(--bg-elevated)',
              border: `1px solid ${widgetOn ? 'rgba(249,115,22,0.3)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Radio className="w-5 h-5" style={{ color: widgetOn ? 'var(--accent-primary)' : 'var(--text-muted)' }} strokeWidth={1.8} />
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Desktop Widget</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                {widgetOn ? 'Active — floating bubble is visible' : 'Disabled — toggle to enable'}
              </p>
            </div>
          </div>
          <button onClick={toggleWidget} disabled={widgetLoading}
            className={widgetOn ? 'toggle-on' : 'toggle-off'}
            style={{ width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', padding: '0 3px', display: 'flex', alignItems: 'center', transition: 'all 0.2s', opacity: widgetLoading ? 0.5 : 1 }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: '50%', background: '#fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
              transform: widgetOn ? 'translateX(20px)' : 'translateX(0)',
              transition: 'transform 0.2s',
            }} />
          </button>
        </div>

        {/* Supported languages */}
        <p style={{ fontSize: '11px', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12, fontFamily: "'JetBrains Mono', monospace" }}>
          {L.supportedLanguages}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['Hindi', 'Bengali', 'Tamil', 'Telugu', 'Malayalam', 'Marathi', 'Gujarati', 'Kannada', 'Punjabi', 'Odia'].map(lang => (
            <span key={lang} className="lang-pill">{lang}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
