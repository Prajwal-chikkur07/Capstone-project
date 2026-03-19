import { Languages, ChevronDown } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';

export default function TranslationSection() {
  const { state, setField, setFields, setLoading, showError, TARGET_LANGUAGES } = useApp();
  const [inputText, setInputText] = useState('');

  // Sync inputText when englishText changes from recording
  const displayText = state.englishText || inputText;

  const handleTranslate = useCallback(async () => {
    const text = state.englishText || inputText;
    if (!text) return;

    try {
      setLoading('Translating to Native Language...');
      const translated = await api.translateText(text, state.selectedLanguage);
      setFields({ nativeTranslation: translated });
      setLoading(null);
    } catch (err) {
      setLoading(null);
      showError(err.response?.data?.detail || 'Translation error');
    }
  }, [state.englishText, state.selectedLanguage, inputText, setFields, setLoading, showError]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
        <span className="text-blue-500">3.</span> English to Native Language
      </h2>

      <div>
        <p className="text-sm font-medium text-slate-500 mb-2">Select Target Language:</p>
        <div className="relative">
          <select
            value={state.selectedLanguage}
            onChange={(e) => setField('selectedLanguage', e.target.value)}
            className="select-field pr-10"
          >
            {Object.entries(TARGET_LANGUAGES).map(([name, code]) => (
              <option key={code} value={code} className="bg-slate-900">
                {name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      <textarea
        value={displayText}
        onChange={(e) => {
          setInputText(e.target.value);
          setField('englishText', e.target.value);
        }}
        placeholder="Type or paste English text here..."
        rows={3}
        className="input-field resize-none"
      />

      <button
        onClick={handleTranslate}
        className="btn-primary flex items-center gap-2"
      >
        <Languages className="w-4 h-4" />
        Translate to Native
      </button>
    </div>
  );
}
