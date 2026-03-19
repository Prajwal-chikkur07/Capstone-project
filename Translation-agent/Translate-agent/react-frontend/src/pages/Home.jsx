import RecordingControls from '../components/RecordingControls';
import OutputBox from '../components/OutputBox';
import { useApp } from '../context/AppContext';
import { Mic, Ear, Upload, Sparkles, Languages } from 'lucide-react';

export default function Home() {
  const { state, setField, RECORDING_MODES } = useApp();

  // Mode Selection Screen
  if (!state.recordingMode) {
    const modes = [
      { 
        id: RECORDING_MODES.PUSH_TO_TALK, 
        icon: Mic, 
        title: 'Start Speaking', 
        desc: 'Record live with push-to-talk convenience' 
      },
      { 
        id: RECORDING_MODES.CONTINUOUS, 
        icon: Ear, 
        title: 'Continuous Listening', 
        desc: 'Hands-free recording with auto-silence detection' 
      },
      { 
        id: RECORDING_MODES.FILE_UPLOAD, 
        icon: Upload, 
        title: 'Upload Audio', 
        desc: 'Transcibe existing MP3, WAV or M4A files' 
      },
    ];

    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center animate-fade-in-blur px-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">Transcribe speech and get transcripts</h1>
          <p className="text-slate-500 text-lg">Record live or upload audio to transcribe in multiple languages</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setField('recordingMode', mode.id)}
              className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group text-left flex flex-col h-full"
            >
              <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                <mode.icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{mode.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{mode.desc}</p>
              <div className="mt-auto pt-6 flex items-center text-blue-600 font-bold text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                Select Aspect
                <Sparkles className="ml-2 w-3 h-3" />
              </div>
            </button>
          ))}
        </div>
        
        <div className="mt-16 text-slate-300 flex items-center gap-4">
           <div className="h-[1px] w-20 bg-slate-200" />
           <span className="text-xs font-bold uppercase tracking-[0.2em]">Powered by Sarvam AI</span>
           <div className="h-[1px] w-20 bg-slate-200" />
        </div>
      </div>
    );
  }

  // Active Workspace (when a mode is selected)
  return (
    <div className="pb-20 animate-fade-in-top">
      {/* Header */}
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Voice Workspace</h1>
          <p className="text-slate-500 mt-1 uppercase text-[10px] font-bold tracking-widest tracking-tighter">
            {state.recordingMode.replace(/([A-Z])/g, ' $1')} Mode
          </p>
        </div>
        <button 
          onClick={() => setField('recordingMode', null)}
          className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-white hover:text-slate-900 transition-all flex items-center gap-2"
        >
          <Languages className="w-4 h-4" />
          Switch Mode
        </button>
      </header>

      {/* Centered Content Area */}
      <div className="max-w-4xl mx-auto mt-12 px-6">
        <div className="relative group transition-all duration-500">
          <section className="space-y-8">
            {/* Dynamic Content Rendering */}
            {state.englishText ? (
              <div className="animate-fade-in-blur">
                <OutputBox
                  label="Live English Transcript"
                  content={state.englishText}
                  language="en"
                  type="english"
                  className="shadow-2xl shadow-slate-200/50 border border-white/50 bg-white/70 backdrop-blur-xl"
                />
                
                {state.nativeTranslation && (
                   <div className="mt-8 animate-fade-in-top">
                     <OutputBox
                        label="Regional Translation"
                        content={state.nativeTranslation}
                        language={state.selectedLanguage}
                        type="native"
                        className="shadow-2xl shadow-indigo-100/30 border border-white/50 bg-indigo-50/10 backdrop-blur-xl"
                      />
                   </div>
                )}
              </div>
            ) : (
              <div className="h-[400px] flex flex-col items-center justify-center p-12 bg-white/40 border border-dashed border-slate-200 rounded-[40px] text-slate-400 group-hover:border-slate-300 transition-colors">
                <div className="w-16 h-16 rounded-3xl bg-white shadow-sm flex items-center justify-center mb-6 transform group-hover:scale-110 transition-transform duration-500">
                  <Mic className="w-8 h-8 text-slate-300" />
                </div>
                <h2 className="text-xl font-bold text-slate-500 mb-2">{state.recordingMode === 'fileUpload' ? 'Drop Audio File' : 'Start Speaking'}</h2>
                <p className="text-sm font-medium text-slate-400 text-center max-w-sm">
                  {state.recordingMode === 'fileUpload' 
                   ? 'Drag and drop your audio file here or use the toolbar below.' 
                   : 'Click the record button in the toolbar below to start transcribing your speech in real-time.'}
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Floating Toolbar at Bottom Center */}
      <div className="fixed bottom-12 inset-x-0 flex justify-center z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <RecordingControls />
        </div>
      </div>

      {/* Extra Padding for Bottom Content */}
      <div className="h-40" />
    </div>
  );
}
