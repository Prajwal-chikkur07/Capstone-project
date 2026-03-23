import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { BookmarkPlus, Copy, Check, Trash2, Search, Sparkles, X, Hash, Pin } from 'lucide-react';
import { getLabels } from '../services/uiLabels';

const TONE_COLORS = {
  'Email Formal':      'bg-blue-50 text-blue-600 border-blue-100',
  'Email Casual':      'bg-blue-50 text-blue-500 border-blue-100',
  'Slack':             'bg-purple-50 text-purple-600 border-purple-100',
  'LinkedIn':          'bg-sky-50 text-sky-600 border-sky-100',
  'WhatsApp Business': 'bg-green-50 text-green-600 border-green-100',
  'Custom':            'bg-amber-50 text-amber-600 border-amber-100',
};

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={copy} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-600 transition-all">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function Templates() {
  const { state, saveTemplates, setField, showSuccess, togglePinTemplate } = useApp();
  const navigate = useNavigate();
  const L = getLabels(state.uiLanguage);
  const [search, setSearch] = useState('');
  const [filterTone, setFilterTone] = useState('All');
  const [confirmClear, setConfirmClear] = useState(false);

  const templates = state.savedTemplates || [];
  const tones = ['All', ...new Set(templates.map(t => t.tone).filter(Boolean))];

  const filtered = templates.filter(t => {
    const matchSearch = !search || t.text.toLowerCase().includes(search.toLowerCase());
    const matchTone = filterTone === 'All' || t.tone === filterTone;
    return matchSearch && matchTone;
  });

  const handleDelete = (id) => saveTemplates(templates.filter(t => t.id !== id));
  const handleClearAll = () => { saveTemplates([]); setConfirmClear(false); showSuccess('All templates cleared'); };
  const handleUseTemplate = (text) => { setField('englishText', text); navigate('/app/home'); showSuccess('Template loaded'); };

  return (
    <div className="min-h-screen bg-[#f8f8f8] px-10 pt-10 pb-16 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">{L.templatesTitle}</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">{templates.length} saved</p>
        </div>
        <div className="flex items-center gap-2">
          {templates.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-gray-500">Clear all?</span>
                <button onClick={handleClearAll} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[12px] font-semibold hover:bg-red-600 transition-all">Yes</button>
                <button onClick={() => setConfirmClear(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-all"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <button onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 text-[12px] font-medium transition-all">
                <Trash2 className="w-3.5 h-3.5" />Clear all
              </button>
            )
          )}
        </div>
      </div>

      {/* Search */}
      {templates.length > 0 && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-[14px] focus:outline-none focus:border-gray-300 transition-all" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>}
        </div>
      )}

      {/* Tone filter */}
      {tones.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-5">
          {tones.map(t => (
            <button key={t} onClick={() => setFilterTone(t)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${filterTone === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
            <BookmarkPlus className="w-5 h-5 text-gray-300" />
          </div>
          <p className="text-[14px] text-gray-300 font-medium">{templates.length === 0 ? L.noTemplates : L.noResults}</p>
          {templates.length === 0 && <p className="text-[12px] text-gray-300">Rewrite a tone and click Save to store it here</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const toneClass = TONE_COLORS[t.tone] || TONE_COLORS['Custom'];
            const wc = t.text.trim().split(/\s+/).length;
            const isPinned = state.pinnedTemplateIds?.includes(t.id);
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${toneClass}`}>{t.tone || 'Custom'}</span>
                      {isPinned && <span className="flex items-center gap-0.5 text-[11px] text-amber-500 font-semibold"><Pin className="w-2.5 h-2.5 fill-amber-400" />Pinned</span>}
                      <span className="text-[11px] text-gray-300">{new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <p className="text-[14px] text-gray-700 leading-relaxed line-clamp-4">{t.text}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <Hash className="w-3 h-3 text-gray-300" />
                      <span className="text-[11px] text-gray-300">{wc} words</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => togglePinTemplate(t.id)} title={isPinned ? 'Unpin' : 'Pin'}
                      className={`p-1.5 rounded-lg transition-all ${isPinned ? 'text-amber-400 hover:bg-amber-50' : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'}`}>
                      <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-amber-400' : ''}`} />
                    </button>
                    <button onClick={() => handleUseTemplate(t.text)}
                      className="px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-[12px] font-semibold hover:bg-gray-700 transition-all">
                      Use
                    </button>
                    <CopyBtn text={t.text} />
                    <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
