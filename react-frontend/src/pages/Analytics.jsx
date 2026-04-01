import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { TrendingUp, Mic2, Zap, Star } from 'lucide-react';
import { getLabels } from '../services/uiLabels';

const LANG_NAMES = {
  'hi-IN': 'Hindi', 'bn-IN': 'Bengali', 'ta-IN': 'Tamil', 'te-IN': 'Telugu',
  'ml-IN': 'Malayalam', 'mr-IN': 'Marathi', 'gu-IN': 'Gujarati',
  'kn-IN': 'Kannada', 'pa-IN': 'Punjabi', 'or-IN': 'Odia',
};

function ConfidenceTrend({ history }) {
  const points = history.filter(h => h.confidence != null).slice(0, 20).reverse();
  if (points.length < 2) return <p className="text-[13px] text-gray-300 py-6 text-center">Not enough data yet</p>;
  const w = 100 / (points.length - 1);
  const coords = points.map((p, i) => `${i * w},${100 - Math.round(p.confidence * 100)}`).join(' ');
  return (
    <div className="relative h-20 w-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <polyline points={coords} fill="none" stroke="#111827" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={i * w} cy={100 - Math.round(p.confidence * 100)} r="2" fill="#111827" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-gray-300">
        <span>oldest</span><span>latest</span>
      </div>
    </div>
  );
}

export default function Analytics() {
  const { state } = useApp();
  const L = getLabels(state.uiLanguage);
  const history = state.transcriptHistory || [];
  const usage = state.usageStats || {};

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thisWeek = history.filter(h => new Date(h.timestamp).getTime() > weekAgo);

  const langCounts = useMemo(() => {
    const counts = {};
    history.forEach(h => { if (h.lang) counts[h.lang] = (counts[h.lang] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [history]);
  const maxLang = langCounts[0]?.[1] || 1;

  const confScores = history.filter(h => h.confidence != null).map(h => h.confidence);
  const avgConf = confScores.length ? Math.round((confScores.reduce((a, b) => a + b, 0) / confScores.length) * 100) : null;
  const confColor = avgConf == null ? 'text-gray-400' : avgConf >= 85 ? 'text-green-600' : avgConf >= 60 ? 'text-amber-500' : 'text-red-500';

  const dailyCounts = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end = new Date(d); end.setHours(23, 59, 59, 999);
      const count = history.filter(h => { const t = new Date(h.timestamp).getTime(); return t >= start.getTime() && t <= end.getTime(); }).length;
      days.push({ label, count });
    }
    return days;
  }, [history]);
  const maxDay = Math.max(...dailyCounts.map(d => d.count), 1);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', padding: '24px', maxWidth: 760, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{L.analyticsTitle}</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>{L.usageInsights}</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { icon: Mic2,       label: L.totalTranscripts, value: history.length,                          sub: 'all time',      color: 'var(--text-primary)' },
          { icon: TrendingUp, label: L.thisWeek,          value: thisWeek.length,                         sub: 'transcripts',   color: 'var(--text-primary)' },
          { icon: Zap,        label: L.avgConfidence,     value: avgConf != null ? `${avgConf}%` : '—',   sub: 'speech clarity', color: avgConf == null ? 'var(--text-muted)' : avgConf >= 85 ? '#16A34A' : avgConf >= 60 ? '#D97706' : '#DC2626' },
          { icon: Star,       label: L.starred,           value: state.starredIds?.length || 0,           sub: 'saved items',   color: 'var(--text-primary)' },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', padding: 20, transition: 'transform 0.15s, box-shadow 0.15s', cursor: 'default' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-card)'; }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Icon style={{ width: 18, height: 18, color: 'var(--accent)' }} />
            </div>
            <p style={{ fontSize: '2rem', fontWeight: 700, color, margin: 0, lineHeight: 1 }}>{value}</p>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', margin: '6px 0 2px' }}>{label}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* API calls */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', padding: 24, marginBottom: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 16 }}>{L.apiCalls}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Sarvam',     value: usage.sarvamCalls || 0, color: '#2563EB'  },
            { label: 'Gemini',     value: usage.geminiCalls || 0, color: 'var(--accent)' },
            { label: 'Cache hits', value: usage.cacheHits   || 0, color: '#16A34A' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'var(--page-bg)', borderRadius: 'var(--radius-inner)', padding: '16px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color, margin: 0 }}>{value}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Daily activity */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', padding: 24, marginBottom: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 16 }}>{L.dailyActivity}</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 68 }}>
          {dailyCounts.map(({ label, count }, i) => (
            <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: '100%', background: 'rgba(0,0,0,0.06)', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'flex-end', height: 48 }}>
                <div style={{ width: '100%', background: i === dailyCounts.length - 1 ? 'var(--surface-dark)' : 'var(--text-muted)', borderRadius: 8, height: `${Math.round((count / maxDay) * 100)}%`, minHeight: count > 0 ? 4 : 0, transition: 'height 0.5s' }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Confidence trend */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', padding: 24, marginBottom: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 16 }}>{L.confidenceTrend}</p>
        <ConfidenceTrend history={history} />
      </div>

      {/* Language breakdown */}
      {langCounts.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', padding: 24 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 16 }}>{L.languageUsage}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {langCounts.map(([lang, count], i) => {
              const gradients = [
                'linear-gradient(90deg, #2563EB, #60A5FA)',
                'linear-gradient(90deg, #F97316, #FDB07C)',
                'linear-gradient(90deg, #16A34A, #4ADE80)',
                'linear-gradient(90deg, #7C3AED, #A78BFA)',
                'linear-gradient(90deg, #DB2777, #F472B6)',
              ];
              return (
                <div key={lang} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', width: 80, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{LANG_NAMES[lang] || lang}</span>
                  <div style={{ flex: 1, background: 'rgba(0,0,0,0.06)', borderRadius: 'var(--radius-pill)', height: 8, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: gradients[i % gradients.length], borderRadius: 'var(--radius-pill)', width: `${Math.round((count / maxLang) * 100)}%`, transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', width: 20, textAlign: 'right', flexShrink: 0 }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
