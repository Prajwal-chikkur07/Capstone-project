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

// Load persisted channel credentials from localStorage
function loadCredentials() {
  try { return JSON.parse(localStorage.getItem('channelCredentials') || '{}'); }
  catch { return {}; }
}

// Load transcript history from localStorage
function loadHistory() {
  try { return JSON.parse(localStorage.getItem('transcriptHistory') || '[]'); }
  catch { return []; }
}

// Load custom dictionary from localStorage
function loadDictionary() {
  try { return JSON.parse(localStorage.getItem('customDictionary') || '[]'); }
  catch { return []; }
}

function loadAuth() {
  try { return JSON.parse(localStorage.getItem('saaras_auth') || 'null'); } catch { return null; }
}

const initialState = {
  currentView: 'splash',
  authUser: loadAuth(), // { name, email } or null
  recordingMode: null,
  isRecording: false,
  isPushToTalkPressed: false,
  isSpeechDetected: false,
  currentAmplitude: 0,
  englishText: '',
  rewrittenText: '',
  nativeTranslation: '',
  confidenceScore: null,       // 0-1 float from Sarvam
  selectedTone: 'Email Formal',
  customTone: '',
  selectedLanguage: 'hi-IN',
  selectedVoice: null,
  isSpeaking: false,
  isPlayingEnglish: false,
  isPlayingRewritten: false,
  isPlayingNative: false,
  loading: null,
  error: null,
  success: null,
  channelCredentials: loadCredentials(),
  transcriptHistory: loadHistory(),   // [{ id, text, lang, timestamp, confidence }]
  customDictionary: loadDictionary(), // [{ native, english }]
  savedTemplates: JSON.parse(localStorage.getItem('savedTemplates') || '[]'),
  usageStats: JSON.parse(localStorage.getItem('usageStats') || '{"sarvamCalls":0,"geminiCalls":0,"cacheHits":0}'),
  darkMode: localStorage.getItem('darkMode') === 'true',
  onboardingDone: localStorage.getItem('onboardingDone') === 'true',
  starredIds: JSON.parse(localStorage.getItem('starredIds') || '[]'),
  pinnedTemplateIds: JSON.parse(localStorage.getItem('pinnedTemplateIds') || '[]'),
  historyTags: JSON.parse(localStorage.getItem('historyTags') || '{}'), // { entryId: ['tag1','tag2'] }
  notificationLog: JSON.parse(localStorage.getItem('notificationLog') || '[]'), // [{ id, msg, type, ts }]
  focusMode: false,
  isOnline: true,
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      localStorage.setItem('saaras_auth', JSON.stringify(action.user));
      // Also persist name to userProfile for sidebar display
      localStorage.setItem('userProfile', JSON.stringify({ name: action.user.name, email: action.user.email }));
      return { ...state, authUser: action.user };
    case 'LOGOUT':
      localStorage.removeItem('saaras_auth');
      return { ...state, authUser: null, currentView: 'landing' };
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
        confidenceScore: null,
        isPlayingEnglish: false,
        isPlayingRewritten: false,
        isPlayingNative: false,
      };
    case 'SAVE_CREDENTIALS':
      localStorage.setItem('channelCredentials', JSON.stringify(action.credentials));
      return { ...state, channelCredentials: action.credentials };
    case 'ADD_HISTORY': {
      const entry = { id: Date.now(), ...action.entry };
      const updated = [entry, ...state.transcriptHistory].slice(0, 50); // keep last 50
      localStorage.setItem('transcriptHistory', JSON.stringify(updated));
      return { ...state, transcriptHistory: updated };
    }
    case 'DELETE_HISTORY': {
      const updated = state.transcriptHistory.filter(h => h.id !== action.id);
      localStorage.setItem('transcriptHistory', JSON.stringify(updated));
      return { ...state, transcriptHistory: updated };
    }
    case 'CLEAR_HISTORY':
      localStorage.removeItem('transcriptHistory');
      return { ...state, transcriptHistory: [] };
    case 'SAVE_DICTIONARY':
      localStorage.setItem('customDictionary', JSON.stringify(action.dictionary));
      return { ...state, customDictionary: action.dictionary };
    case 'SAVE_TEMPLATES':
      localStorage.setItem('savedTemplates', JSON.stringify(action.templates));
      return { ...state, savedTemplates: action.templates };
    case 'INCREMENT_USAGE': {
      const updated = { ...state.usageStats, [action.key]: (state.usageStats[action.key] || 0) + 1 };
      localStorage.setItem('usageStats', JSON.stringify(updated));
      return { ...state, usageStats: updated };
    }
    case 'TOGGLE_DARK': {
      const next = !state.darkMode;
      localStorage.setItem('darkMode', String(next));
      return { ...state, darkMode: next };
    }
    case 'SET_ONBOARDING_DONE':
      localStorage.setItem('onboardingDone', 'true');
      return { ...state, onboardingDone: true };
    case 'TOGGLE_STAR': {
      const starred = state.starredIds.includes(action.id)
        ? state.starredIds.filter(i => i !== action.id)
        : [...state.starredIds, action.id];
      localStorage.setItem('starredIds', JSON.stringify(starred));
      return { ...state, starredIds: starred };
    }
    case 'TOGGLE_PIN_TEMPLATE': {
      const pinned = state.pinnedTemplateIds.includes(action.id)
        ? state.pinnedTemplateIds.filter(i => i !== action.id)
        : [...state.pinnedTemplateIds, action.id].slice(0, 3); // max 3 pinned
      localStorage.setItem('pinnedTemplateIds', JSON.stringify(pinned));
      return { ...state, pinnedTemplateIds: pinned };
    }
    case 'SET_HISTORY_TAGS': {
      const updated = { ...state.historyTags, [action.entryId]: action.tags };
      localStorage.setItem('historyTags', JSON.stringify(updated));
      return { ...state, historyTags: updated };
    }
    case 'ADD_NOTIFICATION_LOG': {
      const entry = { id: Date.now(), msg: action.msg, type: action.notifType || 'info', ts: new Date().toISOString() };
      const updated = [entry, ...state.notificationLog].slice(0, 50);
      localStorage.setItem('notificationLog', JSON.stringify(updated));
      return { ...state, notificationLog: updated };
    }
    case 'CLEAR_NOTIFICATION_LOG':
      localStorage.removeItem('notificationLog');
      return { ...state, notificationLog: [] };
    case 'TOGGLE_FOCUS_MODE':
      return { ...state, focusMode: !state.focusMode };
    case 'SET_ONLINE':
      return { ...state, isOnline: action.value };
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

  const saveCredentials = useCallback((credentials) => {
    dispatch({ type: 'SAVE_CREDENTIALS', credentials });
  }, []);

  const addHistory = useCallback((entry) => {
    dispatch({ type: 'ADD_HISTORY', entry });
  }, []);

  const deleteHistory = useCallback((id) => {
    dispatch({ type: 'DELETE_HISTORY', id });
  }, []);

  const clearHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_HISTORY' });
  }, []);

  const saveDictionary = useCallback((dictionary) => {
    dispatch({ type: 'SAVE_DICTIONARY', dictionary });
  }, []);

  const saveTemplates = useCallback((templates) => {
    dispatch({ type: 'SAVE_TEMPLATES', templates });
  }, []);

  const incrementUsage = useCallback((key) => {
    dispatch({ type: 'INCREMENT_USAGE', key });
  }, []);

  const toggleDark = useCallback(() => dispatch({ type: 'TOGGLE_DARK' }), []);
  const setOnboardingDone = useCallback(() => dispatch({ type: 'SET_ONBOARDING_DONE' }), []);
  const toggleStar = useCallback((id) => dispatch({ type: 'TOGGLE_STAR', id }), []);
  const togglePinTemplate = useCallback((id) => dispatch({ type: 'TOGGLE_PIN_TEMPLATE', id }), []);
  const setHistoryTags = useCallback((entryId, tags) => dispatch({ type: 'SET_HISTORY_TAGS', entryId, tags }), []);
  const addNotificationLog = useCallback((msg, notifType = 'info') => dispatch({ type: 'ADD_NOTIFICATION_LOG', msg, notifType }), []);
  const clearNotificationLog = useCallback(() => dispatch({ type: 'CLEAR_NOTIFICATION_LOG' }), []);
  const toggleFocusMode = useCallback(() => dispatch({ type: 'TOGGLE_FOCUS_MODE' }), []);
  const setOnline = useCallback((value) => dispatch({ type: 'SET_ONLINE', value }), []);
  const login = useCallback((user) => dispatch({ type: 'LOGIN', user }), []);
  const logout = useCallback(() => dispatch({ type: 'LOGOUT' }), []);

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
        saveCredentials,
        addHistory,
        deleteHistory,
        clearHistory,
        saveDictionary,
        saveTemplates,
        incrementUsage,
        toggleDark,
        setOnboardingDone,
        toggleStar,
        togglePinTemplate,
        setHistoryTags,
        addNotificationLog,
        clearNotificationLog,
        toggleFocusMode,
        setOnline,
        login,
        logout,
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
