import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Clock, Trash2, RotateCcw, X, Search, Download, Star, Tag, Plus } from 'lucide-react';
import * as api from '../services/api';
import { getLabels } from '../services/uiLabels';

const LANG_NAMES = {
  'hi-IN': 'Hindi', 'bn-IN': 'Bengali', 'ta-IN': 'Tamil', 'te-IN': 'Telugu',
  'ml-IN': 'Malayalam', 'mr-IN': 'Marathi', 'gu-IN': 'Gujarati',
  'kn-IN': 'Kannada', 'pa-IN': 'Punjabi', 'or-IN': 'Odia',
};

function ConfidencePill({ score }) {
  if (score == null) return null;
  const pct = Math.round(score * 100);
  const cls = pct >= 85 ? 'bg-green-50 text-green-600 border-green-100'
            : pct >= 60 ? 'bg-amber-50 text-amber-600 border-amber-100'
            :             'bg-red-50 text-red-500 border-red-100';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {pct}%
    </span>
  );
}

export default function History() {
  const { state, setField, setFields, deleteHistory, clearHistory, toggleStar, setHistoryTags } = useApp();
  const navigate = useNavigate();
  const L = getLabels(state.uiLanguage);
  const [search, setSearch] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [showStarred, setShowStarred] = useState(false);
  const [filterTag, setFilterTag] = useState('');
  const [editingTagsFor, setEditingTagsFor] = useState(null);
  const [tagInput, setTagInput] = useState('');

  const PRESET_TAGS = ['meeting', 'call', 'note', 'important', 'follow-up'];

  const allItems = state.transcriptHistory || [];
  const allTags = [...new Set(Object.values(state.historyTags || {}).flat())];

  const items = allItems.filter(h => {
    const matchSearch = !search.trim() || h.text.toLowerCase().includes(search.toLowerCase());
    const matchStar = !showStarred || (state.starredIds || []).includes(h.id);
    const entryTags = (state.historyTags || {})[h.id] || [];
    const matchTag = !filterTag || entryTags.includes(filterTag);
    return matchSearch && matchStar && matchTag;
  });

  const getEntryTags = (id) => (state.historyTags || {})[id] || [];

  const addTag = (entryId, tag) => {
    const current = getEntryTags(entryId);
    if (!tag.trim() || current.includes(tag.trim())) return;
    setHistoryTags(entryId, [...current, tag.trim()]);
  };

  const removeTag = (entryId, tag) => {
    setHistoryTags(entryId, getEntryTags(entryId).filter(t => t !== tag));
  };

  const handleRestore = (entry) => {
    setFields({ englishText: entry.text, selectedLanguage: entry.lang || 'hi-IN' });
    navigate('/app/home');
  };

  const handleExport = async (format) => {
    try { await api.exportHistory(state.transcriptHistory || [], format); }
    catch { /* silent */ }
  };

  const fmt = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      + ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-[#f8f8f8] px-4 md:px-10 pt-6 md:pt-10 pb-10 md:pb-16 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-[18px] md:text-[22px] font-extrabold text-gray-900 tracking-tight">{L.transcriptHistory}</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">{state.transcriptHistory?.length || 0} saved · last 50 kept</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowStarred(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all ${
              showStarred ? 'bg-amber-50 border-amber-200 text-amber-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}>
            <Star className={`w-3.5 h-3.5 ${showStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
            {L.starred}
          </button>
          {(state.transcriptHistory?.length > 0) && (
            <>
              <button onClick={() => handleExport('csv')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 text-[12px] font-medium transition-all">
                <Download className="w-3.5 h-3.5" />CSV
              </button>
              <button onClick={() => handleExport('txt')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 text-[12px] font-medium transition-all">
                <Download className="w-3.5 h-3.5" />TXT
              </button>
            </>
          )}
          {(state.transcriptHistory?.length > 0) && (
            confirmClear ? (
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-gray-500">Clear all?</span>
                <button onClick={() => { clearHistory(); setConfirmClear(false); }}
                  className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[13px] font-semibold hover:bg-red-600 transition-all">
                  Yes, clear
                </button>
                <button onClick={() => setConfirmClear(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-200 hover:border-red-100 transition-all">
                <Trash2 className="w-3.5 h-3.5" />Clear all
              </button>
            )
          )}
        </div>
      </div>

      {/* Search */}
      {(state.transcriptHistory?.length > 0) && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search transcripts..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-[14px] focus:outline-none focus:border-gray-300 transition-all"
          />
        </div>
      )}

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <Tag className="w-3.5 h-3.5 text-gray-300 shrink-0" />
          <button onClick={() => setFilterTag('')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${!filterTag ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
            All
          </button>
          {allTags.map(tag => (
            <button key={tag} onClick={() => setFilterTag(filterTag === tag ? '' : tag)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${filterTag === tag ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
            <Clock className="w-5 h-5 text-gray-300" />
          </div>
          <p className="text-[14px] text-gray-300 font-medium">
            {search ? L.noResults : L.noHistory}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((entry) => (
            <div key={entry.id}
              className="bg-white rounded-2xl border border-gray-100 px-5 py-4 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">
                      {LANG_NAMES[entry.lang] || entry.lang || 'Unknown'}
                    </span>
                    <ConfidencePill score={entry.confidence} />
                    <span className="text-[11px] text-gray-300">{fmt(entry.timestamp)}</span>
                  </div>
                  <p className="text-[14px] text-gray-700 leading-relaxed line-clamp-3">
                    {entry.text}
                  </p>
                  {/* Tags */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {getEntryTags(entry.id).map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[11px] font-semibold border border-gray-200">
                        #{tag}
                        <button onClick={() => removeTag(entry.id, tag)} className="hover:text-red-400 transition-colors ml-0.5">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                    {editingTagsFor === entry.id ? (
                      <div className="flex items-center gap-1">
                        <div className="flex gap-1 flex-wrap">
                          {PRESET_TAGS.filter(t => !getEntryTags(entry.id).includes(t)).map(t => (
                            <button key={t} onClick={() => { addTag(entry.id, t); }}
                              className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-500 text-[11px] font-semibold border border-blue-100 hover:bg-blue-100 transition-all">
                              +{t}
                            </button>
                          ))}
                        </div>
                        <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { addTag(entry.id, tagInput); setTagInput(''); } if (e.key === 'Escape') setEditingTagsFor(null); }}
                          placeholder="custom tag"
                          className="px-2 py-0.5 rounded-lg border border-gray-200 text-[11px] w-24 focus:outline-none focus:border-gray-400" autoFocus />
                        <button onClick={() => setEditingTagsFor(null)} className="text-gray-300 hover:text-gray-600 transition-colors"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingTagsFor(entry.id); setTagInput(''); }}
                        className="flex items-center gap-0.5 px-2 py-0.5 rounded-full border border-dashed border-gray-200 text-gray-300 hover:text-gray-500 hover:border-gray-400 text-[11px] transition-all">
                        <Plus className="w-2.5 h-2.5" />tag
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button onClick={() => toggleStar(entry.id)}
                    title={state.starredIds?.includes(entry.id) ? 'Unstar' : 'Star'}
                    className={`p-2 rounded-lg transition-all ${
                      state.starredIds?.includes(entry.id)
                        ? 'text-amber-400 hover:bg-amber-50'
                        : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'
                    }`}>
                    <Star className={`w-3.5 h-3.5 ${state.starredIds?.includes(entry.id) ? 'fill-amber-400' : ''}`} />
                  </button>
                  <button onClick={() => handleRestore(entry)}
                    title="Restore to editor"
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteHistory(entry.id)}
                    title="Delete"
                    className="p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
