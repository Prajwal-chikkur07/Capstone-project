import { AppProvider } from './context/AppContext';
import Sidebar from './components/Sidebar';
import LoadingOverlay from './components/LoadingOverlay';
import Notifications from './components/Notifications';
import Home from './pages/Home';
import EnglishToNativeView from './pages/EnglishToNativeView';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import { useApp } from './context/AppContext';

function MainContent() {
  const { state } = useApp();
  if (state.currentView === 'settings') return <Settings />;
  if (state.currentView === 'profile') return <Profile />;
  if (state.currentView === 'englishToNative') return <EnglishToNativeView />;
  return <Home />;
}

export default function App() {
  return (
    <AppProvider>
      <div className="min-h-screen bg-white flex">
        <Sidebar />
        <main className="main-content flex-1 overflow-y-auto">
          <MainContent />
        </main>
        <LoadingOverlay />
        <Notifications />
      </div>
    </AppProvider>
  );
}
