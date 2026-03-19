import { Sparkles, ChevronDown } from 'lucide-react';
import { useCallback } from 'react';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';

export default function ToneSection() {
  const { state, setField, setFields, setLoading, showError, TONES } = useApp();

  const handleToneChange = useCallback(async (tone) => {
    setField('selectedTone', tone);
    if (state.englishText) {
      try {
        setLoading('Rewriting tone...');
        const userOverride = tone === 'User Override' ? state.customTone : null;
        const rewritten = await api.rewriteTone(state.englishText, tone, userOverride);
        setFields({ rewrittenText: rewritten });
        setLoading(null);
      } catch (err) {
        setLoading(null);
        showError(err.response?.data?.detail || 'Tone rewrite error');
      }
    }
  }, [state.englishText, state.customTone, setField, setFields, setLoading, showError]);

  const handleCustomApply = useCallback(async () => {
    if (!state.englishText) return;
    try {
      setLoading('Rewriting tone...');
      const rewritten = await api.rewriteTone(
        state.englishText,
        'User Override',
        state.customTone || null
      );
      setFields({ rewrittenText: rewritten });
      setLoading(null);
    } catch (err) {
      setLoading(null);
      showError(err.response?.data?.detail || 'Tone rewrite error');
    }
  }, [state.englishText, state.customTone, setFields, setLoading, showError]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
        <span className="text-blue-500">2.</span> Apply Tone Style
      </h2>

      <div className="flex flex-wrap gap-2">
        {TONES.map((tone) => (
          <button
            key={tone}
            onClick={() => handleToneChange(tone)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              state.selectedTone === tone
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tone}
          </button>
        ))}
      </div>

      {state.selectedTone === 'User Override' && (
        <div className="space-y-3">
          <input
            type="text"
            value={state.customTone}
            onChange={(e) => setField('customTone', e.target.value)}
            placeholder="e.g. Formal but with bullet points"
            className="input-field"
          />
          <button onClick={handleCustomApply} className="btn-primary flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Apply Custom Tone
          </button>
        </div>
      )}
    </div>
  );
}
