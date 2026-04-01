import { useNavigate, useLocation } from 'react-router-dom';
import { Globe, User, LogOut, Mic2, Clock, BookmarkPlus, BookOpen, BarChart2, Moon, Sun, ScanText, Ear, Settings, X, Menu, Film } from 'lucide-react';
import { useClerk } from '@clerk/clerk-react';
import { useApp } from '../context/AppContext';
import { getLabels } from '../services/uiLabels';
import { useContinuousSession } from '../hooks/useContinuousSession';

const SectionLabel = ({ label }) => <span className="section-label">{label}</span>;

const NavBtn = ({ icon: Icon, label, badge, active, onClick }) => (
  <button onClick={onClick} className={`nav-item${active ? ' active' : ''}`}>
    <Icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
    <span style={{ flex: 1 }}>{label}</span>
    {badge && <span style={{ fontSize: 9, fontWeight: 700, background: active ? 'rgba(255,255,255,0.25)' : 'var(--accent-light)', color: active ? '#fff' : 'var(--accent)', padding: '2px 7px', borderRadius: 999 }}>{badge}</span>}
  </button>
);

const BottomNavBtn = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, flex: 1, padding: '4px 0', color: active ? 'var(--accent)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
    <Icon className="w-5 h-5" strokeWidth={active ? 2.2 : 1.6} />
    <span style={{ fontSize: 9, fontWeight: 600 }}>{label}</span>
  </button>
);

export default function Sidebar({ isOpen, onClose, onOpen }) {
  const { state, clearAll, toggleDark, logout } = useApp();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const location = useLocation();
  const L = getLabels(state.uiLanguage);
  const is = (p) => location.pathname === p;
  const nav = (p) => () => { clearAll(); navigate(p); onClose?.(); };
  const handleLogout = async () => {
    try { await signOut(); } catch {}
    logout(); navigate('/auth');
  };
  const session = useContinuousSession();
  const isLive = session.state === 'listening' || session.state === 'paused';

  return (
    <>
      <aside className={`sidebar${isOpen ? ' open' : ''}`} style={{ padding: '24px 12px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, padding: '0 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, boxShadow: '0 0 8px rgba(249,115,22,0.5)' }} />
            <img src="/seedlinglabs-logo.png" alt="" style={{ width: 26, height: 26, borderRadius: 8, objectFit: 'contain' }} />
            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>SeedlingSpeaks</span>
          </div>
          <button onClick={onClose} className="md:hidden" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X className="w-4 h-4" /></button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto' }}>
          <NavBtn icon={Mic2} label={L.home} active={is('/app')} onClick={nav('/app')} />
          <SectionLabel label={L.translation} />
          <NavBtn icon={Mic2}     label={L.nativeToEnglish}     active={is('/app/home')}              onClick={nav('/app/home')} />
          <NavBtn icon={Ear}      label={L.continuousListening} active={is('/app/continuous')}        onClick={nav('/app/continuous')} badge={isLive ? (session.state === 'listening' ? '● LIVE' : '⏸') : null} />
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
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 16, marginTop: 16 }}>
          <button onClick={toggleDark} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 'var(--radius-inner)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {state.darkMode ? <Sun className="w-4 h-4" style={{ color: 'var(--accent)' }} /> : <Moon className="w-4 h-4" />}
              <span>{state.darkMode ? L.lightMode : L.darkMode}</span>
            </div>
            <div className={state.darkMode ? 'toggle-on' : 'toggle-off'} style={{ width: 34, height: 20, borderRadius: 999, display: 'flex', alignItems: 'center', padding: '0 2px', transition: 'all 0.2s' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transform: state.darkMode ? 'translateX(14px)' : 'translateX(0)', transition: 'transform 0.2s' }} />
            </div>
          </button>
          <NavBtn icon={User}     label={L.profile}  active={is('/app/profile')}  onClick={() => { navigate('/app/profile'); onClose?.(); }} />
          <NavBtn icon={Settings} label={L.settings} active={is('/app/settings')} onClick={() => { navigate('/app/settings'); onClose?.(); }} />
          <button onClick={handleLogout} className="nav-item" style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FEE8E8'; e.currentTarget.style.color = '#EF4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
            <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.8} /><span>{L.logout}</span>
          </button>
        </div>
      </aside>

      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      <nav className="mobile-nav">
        <button onClick={onOpen} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, flex: 1, padding: '4px 0', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
          <Menu className="w-5 h-5" strokeWidth={1.6} /><span style={{ fontSize: 9, fontWeight: 600 }}>Menu</span>
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
