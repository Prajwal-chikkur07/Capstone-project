import { useNavigate, useLocation } from 'react-router-dom';
import { Globe, User, LogOut, Mic2, Clock, BookmarkPlus, BookOpen, BarChart2, Moon, Sun, ScanText, Ear, Settings, X, Menu, Film } from 'lucide-react';
import { useClerk } from '@clerk/clerk-react';
import { useApp } from '../context/AppContext';
import { getLabels } from '../services/uiLabels';
import { useContinuousSession } from '../hooks/useContinuousSession';

const SectionLabel = ({ label }) => (
  <p className="section-label">{label}</p>
);

const NavBtn = ({ icon: Icon, label, badge, active, onClick }) => (
  <button onClick={onClick} className={`nav-item ${active ? 'active' : ''}`}>
    <Icon className="w-4 h-4 shrink-0" strokeWidth={1.6} />
    <span className="flex-1 text-left text-[13px]">{label}</span>
    {badge && (
      <span style={{
        fontSize: '9px', fontWeight: 700,
        background: 'rgba(249,115,22,0.15)',
        color: 'var(--accent-primary)',
        border: '1px solid rgba(249,115,22,0.3)',
        padding: '2px 6px', borderRadius: '999px',
        fontFamily: "'JetBrains Mono', monospace",
      }}>{badge}</span>
    )}
  </button>
);

const BottomNavBtn = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick} style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '2px', flex: 1, padding: '4px 0',
    color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
    background: 'none', border: 'none', cursor: 'pointer',
  }}>
    <Icon className="w-5 h-5" strokeWidth={active ? 2 : 1.6} />
    <span style={{ fontSize: '9px', fontWeight: 600 }}>{label}</span>
  </button>
);

export default function Sidebar({ isOpen, onClose, onOpen }) {
  const { state, clearAll, toggleDark, logout } = useApp();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const location = useLocation();
  const L = getLabels(state.uiLanguage);

  const is = (path) => location.pathname === path;

  const nav = (path) => () => {
    clearAll();
    navigate(path);
    onClose?.();
  };

  const handleLogout = async () => {
    try { await signOut(); } catch (error) { console.error('Clerk signOut error:', error); }
    logout();
    navigate('/auth');
  };

  const session = useContinuousSession();
  const isSessionLive = session.state === 'listening' || session.state === 'paused';

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div style={{ padding: '24px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/seedlinglabs-logo.png" alt="SeedlingSpeaks" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'contain' }} />
            <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>SeedlingSpeaks</span>
            <span className="glow-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0, boxShadow: '0 0 8px var(--accent-primary)' }} />
          </div>
          <button onClick={onClose} className="md:hidden" style={{ padding: '6px', borderRadius: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0 8px', overflowY: 'auto' }}>
          <div style={{ marginTop: '4px' }}>
            <NavBtn icon={Mic2} label={L.home} active={is('/app')} onClick={nav('/app')} />
          </div>

          <SectionLabel label={L.translation} />
          <NavBtn icon={Mic2}     label={L.nativeToEnglish}     active={is('/app/home')}              onClick={nav('/app/home')} />
          <NavBtn icon={Ear}      label={L.continuousListening} active={is('/app/continuous')}        onClick={nav('/app/continuous')} badge={isSessionLive ? (session.state === 'listening' ? '● LIVE' : '⏸') : null} />
          <NavBtn icon={Globe}    label={L.englishToNative}     active={is('/app/english-to-native')} onClick={nav('/app/english-to-native')} />
          <NavBtn icon={ScanText} label={L.visionTranslate}     active={is('/app/vision')}            onClick={nav('/app/vision')} />
          <NavBtn icon={Film}     label="Video Translate"        active={is('/app/video')}             onClick={nav('/app/video')} />

          <SectionLabel label={L.library} />
          <NavBtn icon={Clock}        label={L.history}    active={is('/app/history')}    onClick={nav('/app/history')} />
          <NavBtn icon={BookmarkPlus} label={L.templates}  active={is('/app/templates')}  onClick={nav('/app/templates')} />
          <NavBtn icon={BookOpen}     label={L.dictionary} active={is('/app/dictionary')} onClick={nav('/app/dictionary')} />

          <SectionLabel label={L.insights} />
          <NavBtn icon={BarChart2} label={L.analytics} active={is('/app/analytics')} onClick={nav('/app/analytics')} />
        </nav>

        {/* Bottom */}
        <div style={{ padding: '12px 8px 16px', borderTop: '1px solid var(--border)' }}>
          {/* Dark mode toggle */}
          <button onClick={toggleDark} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', borderRadius: '8px', background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-secondary)',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {state.darkMode
                ? <Sun className="w-4 h-4" style={{ color: '#F97316' }} strokeWidth={1.6} />
                : <Moon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} strokeWidth={1.6} />}
              <span style={{ fontSize: '13px' }}>{state.darkMode ? L.lightMode : L.darkMode}</span>
            </div>
            <div className={state.darkMode ? 'toggle-on' : 'toggle-off'} style={{
              width: 32, height: 18, borderRadius: 999, display: 'flex', alignItems: 'center',
              padding: '0 2px', transition: 'all 0.2s',
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%', background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                transform: state.darkMode ? 'translateX(14px)' : 'translateX(0)',
                transition: 'transform 0.2s',
              }} />
            </div>
          </button>

          <NavBtn icon={User}     label={L.profile}  active={is('/app/profile')}  onClick={() => { navigate('/app/profile'); onClose?.(); }} />
          <NavBtn icon={Settings} label={L.settings} active={is('/app/settings')} onClick={() => { navigate('/app/settings'); onClose?.(); }} />
          <button onClick={handleLogout} className="nav-item" style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; }}
          >
            <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.6} />
            <span className="text-[13px]">{L.logout}</span>
          </button>
        </div>
      </aside>

      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        <button onClick={onOpen} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', flex: 1, padding: '4px 0', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
          <Menu className="w-5 h-5" strokeWidth={1.6} />
          <span style={{ fontSize: '9px', fontWeight: 600 }}>Menu</span>
        </button>
        <BottomNavBtn icon={Mic2}      label="Translate" active={is('/app/home') || is('/app')} onClick={nav('/app/home')} />
        <BottomNavBtn icon={Ear}       label="Listen"    active={is('/app/continuous')}          onClick={nav('/app/continuous')} />
        <BottomNavBtn icon={Globe}     label="Native"    active={is('/app/english-to-native')}   onClick={nav('/app/english-to-native')} />
        <BottomNavBtn icon={Clock}     label="History"   active={is('/app/history')}             onClick={nav('/app/history')} />
        <BottomNavBtn icon={BarChart2} label="Analytics" active={is('/app/analytics')}           onClick={nav('/app/analytics')} />
      </nav>
    </>
  );
}
