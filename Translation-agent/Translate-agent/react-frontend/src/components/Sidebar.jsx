import { useNavigate, useLocation } from 'react-router-dom';
import { Mic2, Clock, BookOpen, BarChart2, Settings, X, Menu, LogOut, Globe } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getLabels } from '../services/uiLabels';

const NavBtn = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-all rounded-none border-l-2 ${
      active 
        ? 'bg-white border-l-black text-black' 
        : 'border-l-transparent text-gray-600 hover:text-black hover:bg-gray-50'
    }`}
  >
    <Icon className="w-4 h-4" strokeWidth={1.5} />
    <span>{label}</span>
  </button>
);

export default function Sidebar({ isOpen, onClose, onOpen }) {
  const { state, clearAll, logout } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const L = getLabels(state.uiLanguage);

  const nav = (path) => () => {
    clearAll();
    navigate(path);
    onClose?.();
  };

  const is = (path) => location.pathname === path;

  return (
    <>
      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="px-4 pb-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-black flex items-center justify-center text-white text-[10px] font-bold">SS</div>
            <span className="font-bold text-[13px] text-black">SeedlingSpeaks</span>
          </div>
          <button onClick={onClose} className="md:hidden p-1 rounded hover:bg-gray-200 text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-0 py-4 space-y-0">
          <NavBtn icon={Mic2} label="Translate" active={is('/app/home')} onClick={nav('/app/home')} />
          <NavBtn icon={Clock} label="History" active={is('/app/history')} onClick={nav('/app/history')} />
          <NavBtn icon={BookOpen} label="Dictionary" active={is('/app/dictionary')} onClick={nav('/app/dictionary')} />
          <NavBtn icon={BarChart2} label="Analytics" active={is('/app/analytics')} onClick={nav('/app/analytics')} />
        </nav>

        {/* Bottom */}
        <div className="px-0 py-4 border-t border-gray-200 space-y-0">
          <NavBtn icon={Globe} label="Language" active={is('/app/profile')} onClick={nav('/app/profile')} />
          <NavBtn icon={Settings} label="Settings" active={is('/app/settings')} onClick={nav('/app/settings')} />
          <button
            onClick={() => { logout(); navigate('/landing'); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 transition-all rounded-none border-l-2 border-l-transparent"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.5} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Backdrop */}
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      {/* Mobile hamburger */}
      {!isOpen && (
        <button
          onClick={onOpen}
          className={`md:hidden fixed z-[45] w-9 h-9 bg-white border border-gray-200 rounded flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-all ${!state.isOnline ? 'top-12 left-4' : 'top-4 left-4'}`}
        >
          <Menu className="w-4 h-4" />
        </button>
      )}

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        <button onClick={onOpen} className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 text-gray-600 hover:text-black">
          <Menu className="w-5 h-5" strokeWidth={1.5} />
          <span className="text-[9px] font-semibold">Menu</span>
        </button>
        <button onClick={nav('/app/home')} className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 ${is('/app/home') ? 'text-black' : 'text-gray-600 hover:text-black'}`}>
          <Mic2 className="w-5 h-5" strokeWidth={is('/app/home') ? 2 : 1.5} />
          <span className="text-[9px] font-semibold">Translate</span>
        </button>
        <button onClick={nav('/app/history')} className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 ${is('/app/history') ? 'text-black' : 'text-gray-600 hover:text-black'}`}>
          <Clock className="w-5 h-5" strokeWidth={is('/app/history') ? 2 : 1.5} />
          <span className="text-[9px] font-semibold">History</span>
        </button>
        <button onClick={nav('/app/analytics')} className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 ${is('/app/analytics') ? 'text-black' : 'text-gray-600 hover:text-black'}`}>
          <BarChart2 className="w-5 h-5" strokeWidth={is('/app/analytics') ? 2 : 1.5} />
          <span className="text-[9px] font-semibold">Analytics</span>
        </button>
        <button onClick={nav('/app/settings')} className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 ${is('/app/settings') ? 'text-black' : 'text-gray-600 hover:text-black'}`}>
          <Settings className="w-5 h-5" strokeWidth={is('/app/settings') ? 2 : 1.5} />
          <span className="text-[9px] font-semibold">Settings</span>
        </button>
      </nav>
    </>
  );
}
