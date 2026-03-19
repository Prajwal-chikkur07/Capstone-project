import RecordingControls from '../components/RecordingControls';
import OutputBox from '../components/OutputBox';
import ToneSection from '../components/ToneSection';
import ShareButtons from '../components/ShareButtons';
import { useApp } from '../context/AppContext';
import { Sparkles, Mic } from 'lucide-react';

export default function Home() {
  const { state } = useApp();

  return (
    <div className="pb-20 animate-fade-in-top">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome, Prajwal</h1>
        <p className="text-slate-500 mt-1">Ready to translate and restyle your communications.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Left Column: Voice Input & Live Transcript */}
        <div className="space-y-6">
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <Mic className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Voice Input</h2>
            </div>

            <RecordingControls />

            {state.englishText ? (
              <OutputBox
                label="Live Transcript"
                content={state.englishText}
                language="en"
                type="english"
              />
            ) : (
              <div className="h-48 flex flex-col items-center justify-center p-8 bg-white border border-dashed border-slate-300 rounded-3xl text-slate-400">
                <Mic className="w-8 h-8 mb-3 text-slate-300" />
                <p className="text-sm font-medium">Your speech will appear here...</p>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Tone & Regional Translation */}
        <div className="space-y-6">
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Tone & Delivery</h2>
            </div>

            <ToneSection />

            {state.rewrittenText && (
              <>
                <OutputBox
                  label="Styled Communication"
                  content={state.rewrittenText}
                  language="en"
                  type="rewritten"
                />
                <ShareButtons />
              </>
            )}
            {!state.rewrittenText && state.englishText && (
              <div className="p-8 bg-white border border-dashed border-slate-300 rounded-3xl text-slate-400 flex flex-col items-center justify-center h-32">
                <Sparkles className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm font-medium">Select a tone above to polish your message</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
