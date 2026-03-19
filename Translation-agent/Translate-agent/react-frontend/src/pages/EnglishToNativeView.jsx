import TranslationSection from '../components/TranslationSection';
import OutputBox from '../components/OutputBox';
import { useApp } from '../context/AppContext';
import { Languages } from 'lucide-react';

export default function EnglishToNativeView() {
  const { state } = useApp();

  return (
    <div className="pb-20 animate-fade-in-top">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">English to Native Language</h1>
        <p className="text-slate-500 mt-1">Translate your English messages seamlessly into regional languages.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Left Column: Input */}
        <div className="space-y-6">
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                <Languages className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Translation Input</h2>
            </div>
            
            <TranslationSection />
          </section>
        </div>

        {/* Right Column: Output */}
        <div className="space-y-6">
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                <Languages className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Translation Output</h2>
            </div>
            
            {state.nativeTranslation ? (
              <OutputBox
                label="Regional Translation"
                content={state.nativeTranslation}
                language={state.selectedLanguage}
                type="native"
              />
            ) : (
               <div className="h-48 flex flex-col items-center justify-center p-8 bg-white border border-dashed border-slate-300 rounded-3xl text-slate-400">
                 <Languages className="w-8 h-8 mb-3 text-slate-300" />
                 <p className="text-sm font-medium">Your translation will appear here...</p>
               </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
