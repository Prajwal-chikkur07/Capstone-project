import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Menu } from 'lucide-react';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';
import { setAuthToken } from '../services/api';
import Sidebar from '../components/Sidebar';
import LoadingOverlay from '../components/LoadingOverlay';
import Notifications from '../components/Notifications';
import CommandPalette from '../components/CommandPalette';
import Onboarding from '../components/Onboarding';
import NotificationCenter from '../components/NotificationCenter';
import ToastContainer from '../components/Toast';
import MobileWidget from '../components/MobileWidget';

/**
 * AppShell — Master layout component for the entire authenticated app.
 * Provides consistent sidebar, error handling, offline detection, and nested route rendering.
 */
export default function AppShell({ children }) {
  const { state, setOnline } = useApp();
  const location = useLocation();
  const pollRef = useRef(null);
  const failCountRef = useRef(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { getToken, isLoaded } = useAuth();

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Apply dark mode class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.darkMode);
  }, [state.darkMode]);

  // Set Clerk auth token for API requests
  useEffect(() => {
    if (!isLoaded) return;
    const setToken = async () => {
      try {
        const token = await getToken();
        setAuthToken(token || null);
      } catch (err) {
        console.warn('Failed to get Clerk token:', err);
        setAuthToken(null);
      }
    };
    setToken();
  }, [isLoaded, getToken]);

  // Offline detection
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
    const initTimer = setTimeout(check, 3000);
    pollRef.current = setInterval(check, 30000);
    return () => {
      clearTimeout(initTimer);
      clearInterval(pollRef.current);
    };
  }, [setOnline]);

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

      {/* Sidebar */}
      {showSidebar && (
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onOpen={() => setSidebarOpen(true)}
        />
      )}

      {/* Mobile hamburger menu button */}
      {showSidebar && !sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden fixed top-3 left-3 z-[45] w-9 h-9 bg-white border border-gray-200 rounded-xl shadow-sm flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-all"
        >
          <Menu className="w-4 h-4" />
        </button>
      )}

      {/* Main content area */}
      <main
        className={`flex-1 overflow-y-auto ${showSidebar ? 'main-content' : ''} ${
          !state.isOnline ? 'mt-9' : ''
        }`}
      >
        {/* Routes render as children */}
        {children}
      </main>

      {/* Global overlays and modals */}
      <LoadingOverlay />
      <Notifications />
      <CommandPalette />
      <NotificationCenter />
      <ToastContainer />
      {!state.onboardingDone && <Onboarding />}
      {!isPublicPage && location.pathname !== '/widget-setup' && <MobileWidget />}
    </div>
  );
}
