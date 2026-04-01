import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Trash2, BookOpen, Search, X } from 'lucide-react';
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
    if (exists) showSuccess('Term updated');
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
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', padding: '24px', maxWidth: 760, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{L.customDictionary}</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>{L.termsPreserved} · {dict.length} terms</p>
        </div>
        {dict.length > 0 && (
          confirmClear ? (
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-gray-500">Clear all?</span>
              <button onClick={handleClear} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[12px] font-semibold hover:bg-red-600 transition-all">Yes</button>
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

      {/* Add term */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', padding: '20px 24px', marginBottom: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>{L.addTerm}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} className="sm:flex-row">
          <input value={native} onChange={e => setNative(e.target.value)} placeholder="Original term"
            style={{ flex: 1, padding: '12px 16px', borderRadius: 'var(--radius-inner)', border: '1.5px solid transparent', background: 'var(--page-bg)', fontSize: '0.9rem', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', transition: 'all 0.2s' }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.1)'; }}
            onBlur={e => { e.target.style.borderColor = 'transparent'; e.target.style.background = 'var(--page-bg)'; e.target.style.boxShadow = 'none'; }} />
          <input value={english} onChange={e => setEnglish(e.target.value)} placeholder="Keep as (English)"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            style={{ flex: 1, padding: '12px 16px', borderRadius: 'var(--radius-inner)', border: '1.5px solid transparent', background: 'var(--page-bg)', fontSize: '0.9rem', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', transition: 'all 0.2s' }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.1)'; }}
            onBlur={e => { e.target.style.borderColor = 'transparent'; e.target.style.background = 'var(--page-bg)'; e.target.style.boxShadow = 'none'; }} />
          <button onClick={handleAdd} disabled={!native.trim() || !english.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 20px', borderRadius: 'var(--radius-inner)', background: 'var(--accent)', color: '#fff', fontSize: '0.875rem', fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-orange)', opacity: (!native.trim() || !english.trim()) ? 0.4 : 1, transition: 'background 0.15s' }}
            onMouseEnter={e => { if (native.trim() && english.trim()) e.currentTarget.style.background = 'var(--accent-hover)'; }}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}>
            <Plus style={{ width: 16, height: 16 }} />Add
          </button>
        </div>
      </div>

      {/* Search */}
      {dict.length > 3 && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dictionary..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-[14px] focus:outline-none focus:border-gray-300 transition-all" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>}
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-gray-300" />
          </div>
          <p className="text-[14px] text-gray-300 font-medium">{dict.length === 0 ? L.dictionaryEmpty : L.noResults}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_40px] px-5 py-3 border-b border-gray-50 bg-gray-50">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Original</span>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Keep as</span>
            <span />
          </div>
          {filtered.map((d, i) => (
            <div key={d.id} className={`grid grid-cols-[1fr_1fr_40px] items-center px-5 py-3.5 hover:bg-gray-50 transition-colors ${i < filtered.length - 1 ? 'border-b border-gray-50' : ''}`}>
              <span className="text-[14px] text-gray-800 font-medium truncate pr-4">{d.native}</span>
              <span className="text-[14px] text-gray-500 truncate pr-4">{d.english}</span>
              <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {dict.length > 0 && (
        <p className="text-[12px] text-gray-300 text-center mt-4">{dict.length} term{dict.length !== 1 ? 's' : ''} · applied automatically during tone rewriting</p>
      )}
    </div>
  );
}
