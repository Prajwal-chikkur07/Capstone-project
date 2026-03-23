import { useEffect, useRef } from 'react';
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
import Templates from './pages/Templates';
import Dictionary from './pages/Dictionary';
import Analytics from './pages/Analytics';
import ShareView from './pages/ShareView';
import VisionTranslate from './pages/VisionTranslate';
import { useApp } from './context/AppContext';
import * as api from './services/api';

import AppHome from './pages/AppHome';
import WidgetSetup from './pages/WidgetSetup';

function MainContent() {
  const { state } = useApp();
  if (state.currentView === 'landing')         return <LandingPage />;
  if (state.currentView === 'appHome')         return <AppHome />;
  if (state.currentView === 'continuous')      return <ContinuousListening />;
  if (state.currentView === 'settings')        return <Settings />;
  if (state.currentView === 'profile')         return <Profile />;
  if (state.currentView === 'history')         return <History />;
  if (state.currentView === 'templates')       return <Templates />;
  if (state.currentView === 'dictionary')      return <Dictionary />;
  if (state.currentView === 'analytics')       return <Analytics />;
  if (state.currentView === 'share')           return <ShareView />;
  if (state.currentView === 'vision')          return <VisionTranslate />;
  if (state.currentView === 'englishToNative') return <EnglishToNativeView />;
  if (state.currentView === 'home')            return <Home />;
  return <AppHome />;
}

function AppShell() {
  const { state, setOnline } = useApp();
  const pollRef = useRef(null);

  // Apply dark mode class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.darkMode);
  }, [state.darkMode]);

  // Offline detection — poll backend every 30s, only mark offline after 2 consecutive failures
  const failCountRef = useRef(0);
  useEffect(() => {
    const check = async () => {
      const online = await api.checkHealth();
      if (online) {
        failCountRef.current = 0;
        setOnline(true);
      } else {
        failCountRef.current += 1;
        if (failCountRef.current >= 2) setOnline(false);
      }
    };
    // Delay first check by 3s to let backend warm up
    const initTimer = setTimeout(check, 3000);
    pollRef.current = setInterval(check, 30000);
    return () => { clearTimeout(initTimer); clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Public pages — no auth required
  if (state.currentView === 'landing') return <LandingPage />;
  if (state.currentView === 'splash')  return <SplashScreen />;
  if (state.currentView === 'auth')    return <AuthPage />;

  // All other views require login
  if (!state.authUser) return <LandingPage />;

  // First-time widget setup
  if (!state.widgetSetupDone) return <WidgetSetup />;

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* Offline banner */}
      {!state.isOnline && (
        <div className="fixed top-0 inset-x-0 z-[9999] bg-red-500 text-white text-center text-[13px] font-semibold py-2 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          Backend unreachable — some features may not work
        </div>
      )}

      {/* Focus mode hides sidebar; landing page also hides sidebar */}
      {!state.focusMode && state.currentView !== 'landing' && <Sidebar />}

      <main className={`flex-1 overflow-y-auto ${(!state.focusMode && state.currentView !== 'landing') ? 'main-content' : ''} ${!state.isOnline ? 'mt-9' : ''}`}>
        <MainContent />
      </main>
      <LoadingOverlay />
      <Notifications />
      <CommandPalette />
      <NotificationCenter />
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
