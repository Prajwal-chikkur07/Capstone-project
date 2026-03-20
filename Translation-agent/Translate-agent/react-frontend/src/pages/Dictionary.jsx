import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Trash2, BookOpen, Search, X, Check } from 'lucide-react';

import { getLabels } from '../services/uiLabels';

export default function Dictionary() {
  const { state, saveDictionary, showSuccess } = useApp();
  const L = getLabels(state.uiLanguage);
  const [search, setSearch] = useState('');
  const [native, setNative] = useState('');
  const [english, setEnglish] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const dict = state.customDictionary || [];

  const filtered = dict.filter(d =>
    !search || d.native.toLowerCase().includes(search.toLowerCase()) || d.english.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!native.trim() || !english.trim()) return;
    const exists = dict.some(d => d.native.toLowerCase() === native.trim().toLowerCase());
    if (exists) { showSuccess('Term already exists — updated'); }
    const updated = [
      { id: Date.now(), native: native.trim(), english: english.trim() },
      ...dict.filter(d => d.native.toLowerCase() !== native.trim().toLowerCase()),
    ];
    saveDictionary(updated);
    setNative(''); setEnglish('');
  };

  const handleDelete = (id) => saveDictionary(dict.filter(d => d.id !== id));

  const handleClear = () => { saveDictionary([]); setConfirmClear(false); showSuccess('Dictionary cleared'); };

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-extrabold text-gray-900 tracking-tight">{L.customDictionary}</h2>
          <p className="text-[13px] text-gray-400 mt-0.5">{L.termsPreserved}</p>
        </div>
        {dict.length > 0 && (
          confirmClear ? (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-gray-500">Clear all?</span>
              <button onClick={handleClear} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[12px] font-semibold hover:bg-red-600 transition-all">Yes</button>
              <button onClick={() => setConfirmClear(false)} className="px-3 py-1.5 rounded-lg text-gray-400 hover:bg-gray-100 text-[12px] transition-all">No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmClear(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 text-[12px] font-medium transition-all">
              <Trash2 className="w-3.5 h-3.5" />Clear all
            </button>
          )
        )}
      </div>

      <div className="px-8 py-6 max-w-2xl space-y-4">

        {/* Info card */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 text-[13px] text-amber-700 leading-relaxed">
          Add terms here that should be preserved exactly when Gemini rewrites your text. For example: brand names, technical terms, or proper nouns.
        </div>

        {/* Add new term */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[13px] font-semibold text-gray-700 mb-3">{L.addTerm}</p>
          <div className="flex gap-2">
            <input value={native} onChange={e => setNative(e.target.value)} placeholder="Native / original term"
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-[14px] focus:outline-none focus:border-gray-400 transition-all" />
            <input value={english} onChange={e => setEnglish(e.target.value)} placeholder="Keep as (English)"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-[14px] focus:outline-none focus:border-gray-400 transition-all" />
            <button onClick={handleAdd} disabled={!native.trim() || !english.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-700 disabled:opacity-30 transition-all">
              <Plus className="w-4 h-4" />Add
            </button>
          </div>
        </div>

        {/* Search */}
        {dict.length > 3 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dictionary…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-[14px] focus:outline-none focus:border-gray-400 bg-white transition-all" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>}
          </div>
        )}

        {/* List */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-gray-300" />
            </div>
            <p className="text-[14px] text-gray-300 font-medium">{dict.length === 0 ? L.dictionaryEmpty : L.noResults}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_auto] px-5 py-2.5 border-b border-gray-100 bg-gray-50">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Original term</span>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Keep as</span>
              <span />
            </div>
            {filtered.map((d, i) => (
              <div key={d.id} className={`grid grid-cols-[1fr_1fr_auto] items-center px-5 py-3 ${i < filtered.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <span className="text-[14px] text-gray-800 font-medium truncate pr-3">{d.native}</span>
                <span className="text-[14px] text-gray-500 truncate pr-3">{d.english}</span>
                <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {dict.length > 0 && (
          <p className="text-[12px] text-gray-400 text-center">{dict.length} term{dict.length !== 1 ? 's' : ''} · applied automatically during tone rewriting</p>
        )}
      </div>
    </div>
  );
}
