import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { BarChart2, TrendingUp, Mic2, Globe, Zap, Star } from 'lucide-react';

import { getLabels } from '../services/uiLabels';

const LANG_NAMES = {
  'hi-IN': 'Hindi', 'bn-IN': 'Bengali', 'ta-IN': 'Tamil', 'te-IN': 'Telugu',
  'ml-IN': 'Malayalam', 'mr-IN': 'Marathi', 'gu-IN': 'Gujarati',
  'kn-IN': 'Kannada', 'pa-IN': 'Punjabi', 'or-IN': 'Odia',
};

function StatCard({ icon: Icon, label, value, sub, color = 'text-gray-900' }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-gray-600" />
        </div>
        <span className="text-[13px] text-gray-500 font-medium">{label}</span>
      </div>
      <p className={`text-[28px] font-extrabold tracking-tight ${color}`}>{value}</p>
      {sub && <p className="text-[12px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function BarRow({ label, value, max, color = 'bg-gray-900' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[13px] text-gray-600 w-24 shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12px] text-gray-400 w-6 text-right shrink-0">{value}</span>
    </div>
  );
}

function ConfidenceTrend({ history }) {
  const points = history.filter(h => h.confidence != null).slice(0, 20).reverse();
  if (points.length < 2) return <p className="text-[13px] text-gray-400 py-4 text-center">Not enough data yet</p>;

  const max = 100;
  const w = 100 / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = i * w;
    const y = 100 - Math.round(p.confidence * 100);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="relative h-24 w-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <polyline points={coords} fill="none" stroke="#111827" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={i * w} cy={100 - Math.round(p.confidence * 100)} r="2"
            fill="#111827" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-gray-400">
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

  // This week
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thisWeek = history.filter(h => new Date(h.timestamp).getTime() > weekAgo);

  // Language breakdown
  const langCounts = useMemo(() => {
    const counts = {};
    history.forEach(h => { if (h.lang) counts[h.lang] = (counts[h.lang] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [history]);
  const maxLang = langCounts[0]?.[1] || 1;

  // Avg confidence
  const confScores = history.filter(h => h.confidence != null).map(h => h.confidence);
  const avgConf = confScores.length ? Math.round((confScores.reduce((a, b) => a + b, 0) / confScores.length) * 100) : null;

  // Confidence trend color
  const confColor = avgConf == null ? 'text-gray-400' : avgConf >= 85 ? 'text-green-600' : avgConf >= 60 ? 'text-amber-500' : 'text-red-500';

  // Daily activity (last 7 days)
  const dailyCounts = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end = new Date(d); end.setHours(23, 59, 59, 999);
      const count = history.filter(h => {
        const t = new Date(h.timestamp).getTime();
        return t >= start.getTime() && t <= end.getTime();
      }).length;
      days.push({ label, count });
    }
    return days;
  }, [history]);
  const maxDay = Math.max(...dailyCounts.map(d => d.count), 1);

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <div className="bg-white border-b border-gray-100 px-8 py-4">
        <h2 className="text-[20px] font-extrabold text-gray-900 tracking-tight">{L.analyticsTitle}</h2>
        <p className="text-[13px] text-gray-400 mt-0.5">{L.usageInsights}</p>
      </div>

      <div className="px-8 py-8 max-w-3xl space-y-5">

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Mic2}       label={L.totalTranscripts} value={history.length}          sub="all time" />
          <StatCard icon={TrendingUp} label={L.thisWeek}         value={thisWeek.length}         sub="transcripts" />
          <StatCard icon={Zap}        label={L.avgConfidence}    value={avgConf != null ? `${avgConf}%` : '—'} color={confColor} sub="speech clarity" />
          <StatCard icon={Star}       label={L.starred}          value={state.starredIds?.length || 0} sub="saved items" />
        </div>

        {/* API usage */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[13px] font-bold text-gray-400 uppercase tracking-widest mb-4">{L.apiCalls}</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Sarvam',  value: usage.sarvamCalls  || 0, color: 'text-blue-600'  },
              { label: 'Gemini',  value: usage.geminiCalls  || 0, color: 'text-amber-500' },
              { label: 'Cache hits', value: usage.cacheHits || 0, color: 'text-green-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center bg-gray-50 rounded-xl py-3 border border-gray-100">
                <p className={`text-[22px] font-extrabold ${color}`}>{value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Daily activity */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[13px] font-bold text-gray-400 uppercase tracking-widest mb-4">{L.dailyActivity}</p>
          <div className="flex items-end gap-2 h-20">
            {dailyCounts.map(({ label, count }) => (
              <div key={label} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-gray-100 rounded-t-lg overflow-hidden flex items-end" style={{ height: 56 }}>
                  <div className="w-full bg-gray-900 rounded-t-lg transition-all duration-500"
                    style={{ height: `${Math.round((count / maxDay) * 100)}%`, minHeight: count > 0 ? 4 : 0 }} />
                </div>
                <span className="text-[10px] text-gray-400">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Confidence trend */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[13px] font-bold text-gray-400 uppercase tracking-widest mb-4">{L.confidenceTrend}</p>
          <ConfidenceTrend history={history} />
        </div>

        {/* Language breakdown */}
        {langCounts.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-[13px] font-bold text-gray-400 uppercase tracking-widest mb-4">{L.languageUsage}</p>
            <div className="space-y-3">
              {langCounts.map(([lang, count]) => (
                <BarRow key={lang} label={LANG_NAMES[lang] || lang} value={count} max={maxLang} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
