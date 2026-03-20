import { Languages, Globe, User, LogOut, Mic2, Clock, BookmarkPlus, BookOpen, BarChart2, Moon, Sun, ScanText, Ear } from 'lucide-react';
import { useApp } from '../context/AppContext';

const SectionLabel = ({ label }) => (
  <p className="px-3 pt-4 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
);

const NavBtn = ({ view, icon: Icon, label, badge, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] transition-all duration-150 ${
      active ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
    }`}
  >
    <Icon className="w-[16px] h-[16px] shrink-0" strokeWidth={1.6} />
    <span className="flex-1 text-left">{label}</span>
    {badge && <span className="text-[10px] font-bold bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">{badge}</span>}
  </button>
);

export default function Sidebar() {
  const { state, setField, setFields, clearAll, toggleDark, RECORDING_MODES, logout } = useApp();

  const nav = (view) => () => {
    if (state.currentView !== view) clearAll();
    if (view === 'home') setFields({ currentView: 'home', recordingMode: RECORDING_MODES.PUSH_TO_TALK });
    else setField('currentView', view);
  };

  return (
    <aside className="sidebar flex flex-col">
      {/* Logo */}
      <div className="px-4 pt-6 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center shrink-0">
            <Languages className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-[15px] text-gray-900 tracking-tight">SeedlingSpeaks</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 overflow-y-auto">

        {/* Home */}
        <div className="mt-3">
          <NavBtn view="appHome" icon={Mic2} label="Home" active={state.currentView === 'appHome' || (!state.currentView || state.currentView === 'appHome')} onClick={nav('appHome')} />
        </div>

        {/* Translation */}
        <SectionLabel label="Translation" />
        <NavBtn view="home"            icon={Mic2}  label="Native to English"     active={state.currentView === 'home'}            onClick={nav('home')} />
        <NavBtn view="continuous"      icon={Ear}   label="Continuous Listening"  active={state.currentView === 'continuous'}      onClick={nav('continuous')} />
        <NavBtn view="englishToNative" icon={Globe} label="English to Native"     active={state.currentView === 'englishToNative'} onClick={nav('englishToNative')} />
        <NavBtn view="vision"          icon={ScanText} label="Vision Translate"   active={state.currentView === 'vision'}          onClick={nav('vision')} />

        {/* Library */}
        <SectionLabel label="Library" />
        <NavBtn view="history"   icon={Clock}        label="History"    active={state.currentView === 'history'}   onClick={nav('history')} />
        <NavBtn view="templates" icon={BookmarkPlus} label="Templates"  active={state.currentView === 'templates'} onClick={nav('templates')} />
        <NavBtn view="dictionary" icon={BookOpen}    label="Dictionary" active={state.currentView === 'dictionary'} onClick={nav('dictionary')} />

        {/* Insights */}
        <SectionLabel label="Insights" />
        <NavBtn view="analytics" icon={BarChart2} label="Analytics" active={state.currentView === 'analytics'} onClick={nav('analytics')} />

      </nav>

      {/* Bottom */}
      <div className="px-2 pb-4 border-t border-gray-100 pt-3 space-y-0.5">
        {/* Dark mode */}
        <button
          onClick={toggleDark}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition-all group"
        >
          <div className="flex items-center gap-3">
            {state.darkMode
              ? <Sun className="w-4 h-4 text-amber-400" strokeWidth={1.6} />
              : <Moon className="w-4 h-4 text-gray-400" strokeWidth={1.6} />}
            <span className="text-[14px] text-gray-500 group-hover:text-gray-800 transition-colors">
              {state.darkMode ? 'Light mode' : 'Dark mode'}
            </span>
          </div>
          <div className={`w-8 rounded-full flex items-center px-0.5 transition-colors ${state.darkMode ? 'bg-gray-900' : 'bg-gray-200'}`} style={{ height: '18px' }}>
            <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${state.darkMode ? 'translate-x-3' : 'translate-x-0'}`} />
          </div>
        </button>

        {/* Profile */}
        <button
          onClick={() => setField('currentView', 'profile')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
            state.currentView === 'profile' ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
          }`}
        >
          <User className="w-4 h-4 shrink-0" strokeWidth={1.6} />
          <span className="text-[14px]">Profile</span>
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.6} />
          <span className="text-[14px]">Logout</span>
        </button>
      </div>
    </aside>
  );
}
