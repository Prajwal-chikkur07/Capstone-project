import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  Mic2, Globe, Clock, BookmarkPlus, BookOpen, User, Settings,
  Languages, BarChart2, Moon, Sun, Search, ArrowRight, Zap
} from 'lucide-react';

const COMMANDS = (state, actions) => [
  { id: 'home',            label: 'Native to English',  icon: Mic2,         group: 'Navigate', action: () => actions.nav('home') },
  { id: 'englishToNative', label: 'English to Native',  icon: Globe,        group: 'Navigate', action: () => actions.nav('englishToNative') },
  { id: 'history',         label: 'History',            icon: Clock,        group: 'Navigate', action: () => actions.nav('history') },
  { id: 'templates',       label: 'Templates',          icon: BookmarkPlus, group: 'Navigate', action: () => actions.nav('templates') },
  { id: 'dictionary',      label: 'Dictionary',         icon: BookOpen,     group: 'Navigate', action: () => actions.nav('dictionary') },
  { id: 'analytics',       label: 'Analytics',          icon: BarChart2,    group: 'Navigate', action: () => actions.nav('analytics') },
  { id: 'profile',         label: 'Profile',            icon: User,         group: 'Navigate', action: () => actions.nav('profile') },
  { id: 'settings',        label: 'Settings',           icon: Settings,     group: 'Navigate', action: () => actions.nav('settings') },
  {
    id: 'darkmode',
    label: state.darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode',
    icon: state.darkMode ? Sun : Moon,
    group: 'Actions',
    action: actions.toggleDark,
  },
  { id: 'translate',  label: 'Translate transcript',  icon: Languages, group: 'Actions', action: actions.translate },
];

export default function CommandPalette() {
  const { state, setField, toggleDark } = useApp();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);

  const close = useCallback(() => { setOpen(false); setQuery(''); setSelected(0); }, []);

  // ⌘K / Ctrl+K to open
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [close]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  const actions = {
    nav: (view) => { setField('currentView', view); close(); },
    toggleDark: () => { toggleDark(); close(); },
    translate: () => { close(); },
  };

  const commands = COMMANDS(state, actions);
  const filtered = query.trim()
    ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  // Group
  const groups = [...new Set(filtered.map(c => c.group))];

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); filtered[selected]?.action(); }
  };

  if (!open) return null;

  return (
    <div className="cmd-backdrop" onClick={close}>
      <div className="w-full max-w-lg mx-4 bg-white dark:bg-[#1c1c1f] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={handleKey}
            placeholder="Search commands…"
            className="flex-1 text-[14px] bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400" />
          <kbd className="text-[11px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="text-center text-[13px] text-gray-400 py-8">No commands found</p>
          ) : (
            groups.map(group => {
              const items = filtered.filter(c => c.group === group);
              return (
                <div key={group}>
                  <p className="px-4 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">{group}</p>
                  {items.map((cmd) => {
                    const idx = filtered.indexOf(cmd);
                    const isSelected = idx === selected;
                    return (
                      <button key={cmd.id} onClick={cmd.action}
                        onMouseEnter={() => setSelected(idx)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${
                          isSelected ? 'bg-gray-900 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}>
                        <cmd.icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                        <span className="text-[14px] font-medium flex-1">{cmd.label}</span>
                        {isSelected && <ArrowRight className="w-3.5 h-3.5 text-white/60" />}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-400" />Powered by Seedlinglabs</span>
          <span className="ml-auto flex items-center gap-2">
            <kbd className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono">↑↓</kbd> navigate
            <kbd className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono">↵</kbd> select
          </span>
        </div>
      </div>
    </div>
  );
}
