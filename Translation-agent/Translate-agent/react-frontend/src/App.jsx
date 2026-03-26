import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Sidebar from './components/Sidebar';
import LoadingOverlay from './components/LoadingOverlay';
import Notifications from './components/Notifications';
import CommandPalette from './components/CommandPalette';
import Onboarding from './components/Onboarding';
import NotificationCenter from './components/NotificationCenter';
import SplashScreen from './components/SplashScreen';
import Home from './pages/Home';
import LandingPage from './pages/LandingPage';
import ContinuousListening from './pages/ContinuousListening';
import AuthPage from './pages/AuthPage';
import EnglishToNativeView from './pages/EnglishToNativeView';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import History from './pages/History';
import Dictionary from './pages/Dictionary';
import Analytics from './pages/Analytics';
import ShareView from './pages/ShareView';
import VisionTranslate from './pages/VisionTranslate';
import AppHome from './pages/AppHome';
import WidgetSetup from './pages/WidgetSetup';
import { useApp } from './context/AppContext';
import * as api from './services/api';
import ToastContainer from './components/Toast';
import { Menu } from 'lucide-react';

// Guard: redirect to /auth if not logged in
function RequireAuth({ children }) {
  const { state } = useApp();
  if (!state.authUser) return <Navigate to="/auth" replace />;
  return children;
}

// Guard: redirect to /widget-setup if setup not done
function RequireSetup({ children }) {
  const { state } = useApp();
  if (!state.authUser) return <Navigate to="/auth" replace />;
  if (!state.widgetSetupDone) return <Navigate to="/widget-setup" replace />;
  return children;
}

function AppShell() {
  const { state, setOnline } = useApp();
  const location = useLocation();
  const pollRef = useRef(null);
  const failCountRef = useRef(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // Apply dark mode class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.darkMode);
  }, [state.darkMode]);

  // Offline detection
  useEffect(() => {
    const check = async () => {
      const online = await api.checkHealth();
      if (online) { failCountRef.current = 0; setOnline(true); }
      else { failCountRef.current += 1; if (failCountRef.current >= 2) setOnline(false); }
    };
    const initTimer = setTimeout(check, 8000);
    pollRef.current = setInterval(check, 60000);
    return () => { clearTimeout(initTimer); clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPublicPage = ['/', '/landing', '/auth', '/splash'].includes(location.pathname);
  const showSidebar = !state.focusMode && !isPublicPage && location.pathname !== '/widget-setup';

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* Offline banner */}
      {!state.isOnline && (
        <div className="fixed top-0 inset-x-0 z-[9999] bg-red-500 text-white text-center text-[13px] font-semibold py-2 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          Backend unreachable — some features may not work
        </div>
      )}

      {showSidebar && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onOpen={() => setSidebarOpen(true)} />}

      {/* Mobile hamburger — top-left floating button */}
      {showSidebar && !sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className={`md:hidden fixed z-[45] w-9 h-9 bg-white border border-gray-200 rounded-xl shadow-sm flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-all ${!state.isOnline ? 'top-12 left-3' : 'top-3 left-3'}`}
        >
          <Menu className="w-4 h-4" />
        </button>
      )}

      <main className={`flex-1 overflow-y-auto ${showSidebar ? 'main-content' : ''} ${!state.isOnline ? 'mt-9' : ''}`}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<SplashScreen />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/splash" element={<SplashScreen />} />

          {/* Widget setup (auth required, setup not done) */}
          <Route path="/widget-setup" element={
            <RequireAuth><WidgetSetup /></RequireAuth>
          } />

          {/* App routes (auth + setup required) */}
          <Route path="/app" element={<RequireSetup><AppHome /></RequireSetup>} />
          <Route path="/app/home" element={<RequireSetup><Home /></RequireSetup>} />
          <Route path="/app/continuous" element={<RequireSetup><ContinuousListening /></RequireSetup>} />
          <Route path="/app/english-to-native" element={<RequireSetup><EnglishToNativeView /></RequireSetup>} />
          <Route path="/app/vision" element={<RequireSetup><VisionTranslate /></RequireSetup>} />
          <Route path="/app/history" element={<RequireSetup><History /></RequireSetup>} />
          <Route path="/app/dictionary" element={<RequireSetup><Dictionary /></RequireSetup>} />
          <Route path="/app/analytics" element={<RequireSetup><Analytics /></RequireSetup>} />
          <Route path="/app/settings" element={<RequireSetup><Settings /></RequireSetup>} />
          <Route path="/app/profile" element={<RequireSetup><Profile /></RequireSetup>} />
          <Route path="/app/share" element={<RequireSetup><ShareView /></RequireSetup>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <LoadingOverlay />
      <Notifications />
      <CommandPalette />
      <NotificationCenter />
      <ToastContainer />
      {!state.onboardingDone && <Onboarding />}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
