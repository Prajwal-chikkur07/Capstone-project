import { useNavigate, useLocation } from 'react-router-dom';
import { Globe, User, LogOut, Mic2, Clock, BookmarkPlus, BookOpen, BarChart2, Moon, Sun, ScanText, Ear, Settings, X, Menu } from 'lucide-react';
import { useClerk } from '@clerk/clerk-react';
import { useApp } from '../context/AppContext';
import { getLabels } from '../services/uiLabels';

const SectionLabel = ({ label }) => (
  <p className="px-3 pt-4 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
);

const NavBtn = ({ icon: Icon, label, badge, active, onClick }) => (
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

// Bottom nav button for mobile
const BottomNavBtn = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-all ${
      active ? 'text-gray-900' : 'text-gray-400'
    }`}
  >
    <Icon className="w-5 h-5" strokeWidth={active ? 2 : 1.6} />
    <span className="text-[9px] font-semibold">{label}</span>
  </button>
);

export default function Sidebar({ isOpen, onClose, onOpen }) {
  const { state, clearAll, toggleDark, logout } = useApp();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const location = useLocation();
  const L = getLabels(state.uiLanguage);

  const nav = (path) => () => {
    clearAll();
    navigate(path);
    onClose?.();
  };

  const handleLogout = async () => {
    try {
      // First, sign out from Clerk
      await signOut();
    } catch (error) {
      console.error('Clerk signOut error:', error);
    }
    // Then logout from app context
    logout();
    // Navigate to auth page (login)
    navigate('/auth');
  };

  const is = (path) => location.pathname === path;

  return (
    <>
      {/* Sidebar drawer */}
      <aside className={`sidebar ${isOpen ? 'open' : ''} flex flex-col`}>
        {/* Logo + close button */}
        <div className="px-4 pt-6 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/seedlinglabs-logo.png" alt="SeedlingSpeaks" className="w-7 h-7 rounded-lg object-contain" />
            <span className="font-bold text-[15px] text-gray-900 tracking-tight">SeedlingSpeaks</span>
          </div>
          <button onClick={onClose} className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 overflow-y-auto">
          <div className="mt-3">
            <NavBtn icon={Mic2} label={L.home} active={is('/app')} onClick={nav('/app')} />
          </div>

          <SectionLabel label={L.translation} />
          <NavBtn icon={Mic2}     label={L.nativeToEnglish}     active={is('/app/home')}             onClick={nav('/app/home')} />
          <NavBtn icon={Ear}      label={L.continuousListening} active={is('/app/continuous')}       onClick={nav('/app/continuous')} />
          <NavBtn icon={Globe}    label={L.englishToNative}     active={is('/app/english-to-native')} onClick={nav('/app/english-to-native')} />
          <NavBtn icon={ScanText} label={L.visionTranslate}     active={is('/app/vision')}           onClick={nav('/app/vision')} />

          <SectionLabel label={L.library} />
          <NavBtn icon={Clock}        label={L.history}    active={is('/app/history')}    onClick={nav('/app/history')} />
          <NavBtn icon={BookmarkPlus} label={L.templates}  active={is('/app/templates')}  onClick={nav('/app/templates')} />
          <NavBtn icon={BookOpen}     label={L.dictionary} active={is('/app/dictionary')} onClick={nav('/app/dictionary')} />

          <SectionLabel label={L.insights} />
          <NavBtn icon={BarChart2} label={L.analytics} active={is('/app/analytics')} onClick={nav('/app/analytics')} />
        </nav>

        {/* Bottom */}
        <div className="px-2 pb-4 border-t border-gray-100 pt-3 space-y-0.5">
          <button
            onClick={toggleDark}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition-all group"
          >
            <div className="flex items-center gap-3">
              {state.darkMode
                ? <Sun className="w-4 h-4 text-amber-400" strokeWidth={1.6} />
                : <Moon className="w-4 h-4 text-gray-400" strokeWidth={1.6} />}
              <span className="text-[14px] text-gray-500 group-hover:text-gray-800 transition-colors">
                {state.darkMode ? L.lightMode : L.darkMode}
              </span>
            </div>
            <div className={`w-8 rounded-full flex items-center px-0.5 transition-colors ${state.darkMode ? 'bg-gray-900' : 'bg-gray-200'}`} style={{ height: '18px' }}>
              <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${state.darkMode ? 'translate-x-3' : 'translate-x-0'}`} />
            </div>
          </button>

          <button
            onClick={() => { navigate('/app/profile'); onClose?.(); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
              is('/app/profile') ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            <User className="w-4 h-4 shrink-0" strokeWidth={1.6} />
            <span className="text-[14px]">{L.profile}</span>
          </button>

          <button
            onClick={() => { navigate('/app/settings'); onClose?.(); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
              is('/app/settings') ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" strokeWidth={1.6} />
            <span className="text-[14px]">{L.settings}</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all"
          >
            <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.6} />
            <span className="text-[14px]">{L.logout}</span>
          </button>
        </div>
      </aside>

      {/* Backdrop (mobile only) */}
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        <button onClick={onOpen} className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 text-gray-400">
          <Menu className="w-5 h-5" strokeWidth={1.6} />
          <span className="text-[9px] font-semibold">Menu</span>
        </button>
        <BottomNavBtn icon={Mic2}     label="Translate" active={is('/app/home') || is('/app')} onClick={nav('/app/home')} />
        <BottomNavBtn icon={Ear}      label="Listen"    active={is('/app/continuous')}          onClick={nav('/app/continuous')} />
        <BottomNavBtn icon={Globe}    label="Native"    active={is('/app/english-to-native')}   onClick={nav('/app/english-to-native')} />
        <BottomNavBtn icon={Clock}    label="History"   active={is('/app/history')}             onClick={nav('/app/history')} />
        <BottomNavBtn icon={BarChart2} label="Analytics" active={is('/app/analytics')}          onClick={nav('/app/analytics')} />
      </nav>
    </>
  );
}
