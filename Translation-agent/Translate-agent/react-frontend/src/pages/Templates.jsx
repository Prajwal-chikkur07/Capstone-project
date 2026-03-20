import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BookmarkPlus, Copy, Check, Trash2, Search, Sparkles, X, Mail, Slack, Linkedin, MessageSquare, Hash, Pin } from 'lucide-react';

const TONE_ICONS = {
  'Email Formal':      { icon: Mail,          color: 'text-blue-500',   bg: 'bg-blue-50',   border: 'border-blue-100'   },
  'Email Casual':      { icon: Mail,          color: 'text-blue-400',   bg: 'bg-blue-50',   border: 'border-blue-100'   },
  'Slack':             { icon: Slack,         color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-100' },
  'LinkedIn':          { icon: Linkedin,      color: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-100'    },
  'WhatsApp Business': { icon: MessageSquare, color: 'text-green-500',  bg: 'bg-green-50',  border: 'border-green-100'  },
  'Custom':            { icon: Sparkles,      color: 'text-amber-500',  bg: 'bg-amber-50',  border: 'border-amber-100'  },
};

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={copy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 text-[12px] font-medium transition-all">
      {copied ? <><Check className="w-3 h-3 text-green-500" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
    </button>
  );
}

export default function Templates() {
  const { state, saveTemplates, setField, showSuccess, togglePinTemplate } = useApp();
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

  const handleDelete = (id) => {
    saveTemplates(templates.filter(t => t.id !== id));
  };

  const handleClearAll = () => {
    saveTemplates([]);
    setConfirmClear(false);
    showSuccess('All templates cleared');
  };

  const handleUseTemplate = (text) => {
    setField('englishText', text);
    setField('currentView', 'home');
    showSuccess('Template loaded into editor');
  };

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-extrabold text-gray-900 tracking-tight">Templates</h2>
          <p className="text-[13px] text-gray-400 mt-0.5">Saved rewrites you can reuse anytime</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-gray-400">{templates.length} saved</span>
          {templates.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-gray-500">Clear all?</span>
                <button onClick={handleClearAll} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[12px] font-semibold hover:bg-red-600 transition-all">Yes</button>
                <button onClick={() => setConfirmClear(false)} className="px-3 py-1.5 rounded-lg text-gray-400 hover:bg-gray-100 text-[12px] transition-all">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmClear(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 text-[12px] font-medium transition-all">
                <Trash2 className="w-3.5 h-3.5" />Clear all
              </button>
            )
          )}
        </div>
      </div>

      <div className="px-8 py-6 max-w-3xl">
        {/* Search + filter */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-[14px] focus:outline-none focus:border-gray-400 bg-white transition-all" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {tones.map(t => (
              <button key={t} onClick={() => setFilterTone(t)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${filterTone === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Pinned templates */}
        {(state.pinnedTemplateIds?.length > 0) && filterTone === 'All' && !search && (
          <div className="mb-5">
            <p className="text-[11px] font-bold text-gray-300 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Pin className="w-3 h-3 fill-gray-300" />Pinned
            </p>
            <div className="grid grid-cols-1 gap-2">
              {templates.filter(t => state.pinnedTemplateIds.includes(t.id)).map(t => {
                const meta = TONE_ICONS[t.tone] || TONE_ICONS['Custom'];
                const Icon = meta.icon;
                return (
                  <div key={t.id} className="bg-amber-50 rounded-2xl border border-amber-100 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-6 h-6 rounded-lg ${meta.bg} ${meta.border} border flex items-center justify-center shrink-0`}>
                        <Icon className={`w-3 h-3 ${meta.color}`} />
                      </div>
                      <p className="text-[13px] text-gray-700 truncate">{t.text.slice(0, 80)}{t.text.length > 80 ? '…' : ''}</p>
                    </div>
                    <button onClick={() => handleUseTemplate(t.text)}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-[12px] font-semibold hover:bg-gray-700 transition-all">
                      Use
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {filtered.length === 0 ? (          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
              <BookmarkPlus className="w-5 h-5 text-gray-300" />
            </div>
            <p className="text-[14px] text-gray-300 font-medium">{templates.length === 0 ? 'No templates saved yet' : 'No results'}</p>
            {templates.length === 0 && <p className="text-[12px] text-gray-300">Rewrite a tone and click Save to store it here</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => {
              const meta = TONE_ICONS[t.tone] || TONE_ICONS['Custom'];
              const Icon = meta.icon;
              const wc = t.text.trim().split(/\s+/).length;
              return (
                <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg ${meta.bg} ${meta.border} border flex items-center justify-center shrink-0`}>
                        <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                      </div>
                      <span className="text-[13px] font-semibold text-gray-700">{t.tone || 'Custom'}</span>
                      <span className="text-[11px] text-gray-300">·</span>
                      <span className="text-[11px] text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</span>
                      {state.pinnedTemplateIds?.includes(t.id) && (
                        <span className="flex items-center gap-0.5 text-[11px] text-amber-500 font-semibold">
                          <Pin className="w-3 h-3 fill-amber-400" />Pinned
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => togglePinTemplate(t.id)}
                        title={state.pinnedTemplateIds?.includes(t.id) ? 'Unpin' : 'Pin to home'}
                        className={`p-1.5 rounded-lg transition-all ${state.pinnedTemplateIds?.includes(t.id) ? 'text-amber-400 hover:bg-amber-50' : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'}`}>
                        <Pin className={`w-3.5 h-3.5 ${state.pinnedTemplateIds?.includes(t.id) ? 'fill-amber-400' : ''}`} />
                      </button>
                      <button onClick={() => handleUseTemplate(t.text)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-[12px] font-semibold hover:bg-gray-700 transition-all">
                        Use
                      </button>
                      <CopyBtn text={t.text} />
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[14px] text-gray-700 leading-relaxed whitespace-pre-wrap line-clamp-4">{t.text}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <Hash className="w-3 h-3 text-gray-300" />
                    <span className="text-[11px] text-gray-300">{wc} words</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
