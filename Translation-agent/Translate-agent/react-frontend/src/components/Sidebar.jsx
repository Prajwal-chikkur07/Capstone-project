import { 
  Home, 
  Mic, 
  Languages, 
  History, 
  Settings, 
  User,
  ChevronRight,
  LogOut,
  ChevronDown,
  Ear,
  Upload,
  Globe
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useState } from 'react';

export default function Sidebar() {
  const { state, setField, RECORDING_MODES } = useApp();
  const [isNativeExpanded, setIsNativeExpanded] = useState(true);

  const nativeSubItems = [
    { id: RECORDING_MODES.PUSH_TO_TALK, icon: Mic, label: 'Push to Talk' },
    { id: RECORDING_MODES.CONTINUOUS, icon: Ear, label: 'Continuous Listening' },
    { id: RECORDING_MODES.FILE_UPLOAD, icon: Upload, label: 'Upload audio file' },
  ];

  const bottomItems = [
    { icon: Settings, label: 'Settings' },
    { icon: User, label: 'Profile' },
  ];

  return (
    <aside className="sidebar flex flex-col">
      {/* Brand */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <Languages className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-xl tracking-tight text-slate-900">TransUI</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-2 mt-4">
        <p className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Menu</p>
        
        {/* Expandable Native to English Menu */}
        <div className="space-y-1">
          <button
            onClick={() => {
              setIsNativeExpanded(!isNativeExpanded);
              setField('currentView', 'home');
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group ${
              state.currentView === 'home' 
                ? 'bg-blue-50 text-blue-600' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <Languages className="w-5 h-5" />
              <span className="font-medium text-sm">Native to English</span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isNativeExpanded ? 'rotate-180' : ''}`} />
          </button>

          {/* Sub-menu items */}
          <div className={`space-y-1 overflow-hidden transition-all duration-300 ${isNativeExpanded ? 'max-h-48 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
            {nativeSubItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setField('recordingMode', item.id);
                  setField('currentView', 'home');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 pl-11 rounded-lg transition-all text-sm ${
                  state.recordingMode === item.id && state.currentView === 'home'
                    ? 'text-blue-600 bg-blue-50/50 font-semibold'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
                {state.recordingMode === item.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />}
              </button>
            ))}
          </div>
        </div>

        {/* English to Native Menu Item */}
        <div className="space-y-1 mt-2">
          <button
            onClick={() => {
              setField('currentView', 'englishToNative');
              setIsNativeExpanded(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
              state.currentView === 'englishToNative'
                ? 'bg-blue-50 text-blue-600 font-semibold'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Globe className="w-5 h-5" />
            <span className="font-medium text-sm">English to Native</span>
          </button>
        </div>
      </nav>

      {/* Bottom section */}
      <div className="p-4 border-t border-slate-100 space-y-2">
        {bottomItems.map((item, i) => (
          <button
            key={i}
            className="w-full flex items-center gap-3 px-3 py-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"
          >
            <item.icon className="w-5 h-5" />
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        ))}
        
        <div className="pt-4 mt-2">
          <div className="flex items-center gap-3 px-3 py-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
              PC
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">Prajwal C</p>
              <p className="text-[10px] text-slate-500 truncate">Pro Account</p>
            </div>
            <button className="text-slate-400 hover:text-red-500 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
