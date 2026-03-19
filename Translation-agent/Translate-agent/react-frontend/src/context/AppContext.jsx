import { createContext, useContext, useReducer, useCallback } from 'react';

const AppContext = createContext();

const RECORDING_MODES = {
  PUSH_TO_TALK: 'pushToTalk',
  CONTINUOUS: 'continuous',
  FILE_UPLOAD: 'fileUpload',
};

const TARGET_LANGUAGES = {
  Hindi: 'hi-IN',
  Bengali: 'bn-IN',
  Tamil: 'ta-IN',
  Telugu: 'te-IN',
  Malayalam: 'ml-IN',
  Marathi: 'mr-IN',
  Gujarati: 'gu-IN',
  Kannada: 'kn-IN',
  Punjabi: 'pa-IN',
  Odia: 'or-IN',
};

const TONES = ['Email Formal', 'Email Casual', 'Slack', 'LinkedIn', 'WhatsApp Business', 'User Override'];

const initialState = {
  currentView: 'home',
  recordingMode: null,
  isRecording: false,
  isPushToTalkPressed: false,
  isSpeechDetected: false,
  currentAmplitude: 0,
  englishText: '',
  rewrittenText: '',
  nativeTranslation: '',
  selectedTone: 'Email Formal',
  customTone: '',
  selectedLanguage: 'hi-IN',
  isPlayingEnglish: false,
  isPlayingRewritten: false,
  isPlayingNative: false,
  loading: null, // null or string message
  error: null,
  success: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'SET_FIELDS':
      return { ...state, ...action.fields };
    case 'CLEAR_ALL':
      return {
        ...state,
        englishText: '',
        rewrittenText: '',
        nativeTranslation: '',
        isPlayingEnglish: false,
        isPlayingRewritten: false,
        isPlayingNative: false,
      };
    case 'CLEAR_NOTIFICATION':
      return { ...state, error: null, success: null };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setField = useCallback((field, value) => {
    dispatch({ type: 'SET_FIELD', field, value });
  }, []);

  const setFields = useCallback((fields) => {
    dispatch({ type: 'SET_FIELDS', fields });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const showError = useCallback((msg) => {
    dispatch({ type: 'SET_FIELD', field: 'error', value: msg });
    setTimeout(() => dispatch({ type: 'CLEAR_NOTIFICATION' }), 5000);
  }, []);

  const showSuccess = useCallback((msg) => {
    dispatch({ type: 'SET_FIELD', field: 'success', value: msg });
    setTimeout(() => dispatch({ type: 'CLEAR_NOTIFICATION' }), 4000);
  }, []);

  const setLoading = useCallback((msg) => {
    dispatch({ type: 'SET_FIELD', field: 'loading', value: msg });
  }, []);

  return (
    <AppContext.Provider
      value={{
        state,
        setField,
        setFields,
        clearAll,
        showError,
        showSuccess,
        setLoading,
        RECORDING_MODES,
        TARGET_LANGUAGES,
        TONES,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
