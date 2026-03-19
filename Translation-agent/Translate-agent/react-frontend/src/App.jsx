import { AppProvider } from './context/AppContext';
import Sidebar from './components/Sidebar';
import LoadingOverlay from './components/LoadingOverlay';
import Notifications from './components/Notifications';
import Home from './pages/Home';
import EnglishToNativeView from './pages/EnglishToNativeView';
import { useApp } from './context/AppContext';

function MainContent() {
  const { state } = useApp();
  return (
    <div className="max-w-[1600px] w-full mx-auto p-6 lg:p-8">
      {state.currentView === 'home' ? <Home /> : <EnglishToNativeView />}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <div className="min-h-screen bg-slate-50 flex">
        <Sidebar />
        <main className="main-content flex-1 overflow-y-auto bg-slate-50/50">
          <MainContent />
        </main>
        <LoadingOverlay />
        <Notifications />
      </div>
    </AppProvider>
  );
}
