import { Languages, Mic, Ear, Upload, Trash2, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';

const modeOptions = [
  { value: 'pushToTalk', label: 'Push-to-Talk', icon: Mic },
  { value: 'continuous', label: 'Continuous Listening', icon: Ear },
  { value: 'fileUpload', label: 'File Upload', icon: Upload },
];

export default function Navbar() {
  const { state, setField, clearAll, RECORDING_MODES } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleModeChange = (mode) => {
    setField('recordingMode', mode);
    clearAll();
    setMenuOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 bg-gradient-to-r from-slate-900/95 via-blue-950/95 to-slate-900/95 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
            <Languages className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white">Voice Translation</h1>
            <p className="text-xs text-white/40 hidden sm:block">Translate, Restyle & Share</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={clearAll}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
            title="Clear All"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm text-white/80"
            >
              {(() => {
                const current = modeOptions.find((m) => m.value === state.recordingMode);
                const Icon = current.icon;
                return (
                  <>
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{current.label}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                  </>
                );
              })()}
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 glass-card p-2 space-y-1">
                {modeOptions.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => handleModeChange(value)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      state.recordingMode === value
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
