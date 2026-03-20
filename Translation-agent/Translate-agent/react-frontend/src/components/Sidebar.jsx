import { Languages, Globe, User, LogOut, Mic2, Zap, Clock, BookmarkPlus, BookOpen, BarChart2, Moon, Sun, Command, Maximize2, Minimize2, ScanText, Ear } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Sidebar() {
  const { state, setField, setFields, clearAll, toggleDark, toggleFocusMode, RECORDING_MODES } = useApp();

  const navItems = [
    { view: 'home',            icon: Mic2,         label: 'Native to English' },
    { view: 'continuous',      icon: Ear,          label: 'Continuous Listening' },
    { view: 'englishToNative', icon: Globe,        label: 'English to Native' },
    { view: 'history',         icon: Clock,        label: 'History'           },
    { view: 'templates',       icon: BookmarkPlus, label: 'Templates'         },
    { view: 'dictionary',      icon: BookOpen,     label: 'Dictionary'        },
    { view: 'analytics',       icon: BarChart2,    label: 'Analytics'         },
    { view: 'vision',          icon: ScanText,     label: 'Vision Translate'  },
  ];

  // Read user profile from localStorage
  let userProfile = {};
  try { userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}'); } catch { /* */ }
  const displayName = userProfile.name || 'Your Name';
  const initials = displayName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center shrink-0 shadow-sm">
          <Languages className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-[15px] text-gray-900 tracking-tight">Saaras</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        <p className="px-2 mb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Menu</p>
        {navItems.map(({ view, icon: Icon, label }) => (
          <button
            key={view}
            onClick={() => {
              if (state.currentView !== view) clearAll();
              if (view === 'home') {
                setFields({ currentView: 'home', recordingMode: RECORDING_MODES.PUSH_TO_TALK });
              } else {
                setField('currentView', view);
              }
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] transition-all duration-150 ${
              state.currentView === view
                ? 'bg-gray-900 text-white font-medium shadow-sm'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Icon className="w-[15px] h-[15px] shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-5">
        {/* ⌘K hint */}
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
          className="w-full flex items-center gap-2 px-3 py-2 mb-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all text-[13px]"
        >
          <Command className="w-3.5 h-3.5 shrink-0" />
          <span>Command palette</span>
          <span className="ml-auto text-[11px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-mono">⌘K</span>
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          className="w-full flex items-center gap-2 px-3 py-2 mb-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all text-[13px]"
        >
          {state.darkMode
            ? <Sun className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            : <Moon className="w-3.5 h-3.5 shrink-0" />}
          <span>{state.darkMode ? 'Light mode' : 'Dark mode'}</span>
        </button>

        {/* Focus mode toggle */}
        <button
          onClick={toggleFocusMode}
          className="w-full flex items-center gap-2 px-3 py-2 mb-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all text-[13px]"
        >
          {state.focusMode
            ? <Minimize2 className="w-3.5 h-3.5 shrink-0" />
            : <Maximize2 className="w-3.5 h-3.5 shrink-0" />}
          <span>{state.focusMode ? 'Exit focus' : 'Focus mode'}</span>
        </button>

        <div className="mx-1 mb-3 h-px bg-gray-100" />

        <button
          onClick={() => setField('currentView', 'profile')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-[14px] rounded-xl transition-all ${
            state.currentView === 'profile' || state.currentView === 'settings'
              ? 'bg-gray-900 text-white font-medium'
              : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
          }`}
        >
          <User className="w-[15px] h-[15px] shrink-0" />
          Profile
        </button>

        <div className="mt-3 flex items-center gap-2.5 px-3 py-3 rounded-xl bg-gray-50 border border-gray-100">
          <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-[11px] shrink-0">{initials}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-gray-800 truncate">{displayName}</p>
            <p className="text-[11px] text-gray-400 truncate flex items-center gap-1">
              <Zap className="w-2.5 h-2.5 text-amber-400" />Pro Account
            </p>
          </div>
          <button className="text-gray-300 hover:text-red-400 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
