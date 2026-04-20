import axios from 'axios';

// For iOS simulator: localhost points to the Mac host
// For real device: use your deployed backend URL or Mac's local IP
const API_BASE_URL = __DEV__
  ? 'http://localhost:8000/api'
  : 'https://your-backend.onrender.com/api';

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
});

let authToken = null;

export const setAuthToken = (token) => {
  authToken = token;
  if (token) {
    API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete API.defaults.headers.common['Authorization'];
  }
};

// ── Translation ──────────────────────────────────────────────────────────────

export const translateText = async (text, targetLanguage, userId = null) => {
  const { data } = await API.post('/translate-text', {
    text,
    target_language: targetLanguage,
    user_id: userId,
  });
  return data.translated_text;
};

export const translateAudioFromBlob = async (uri, filename = 'recording.m4a') => {
  const formData = new FormData();
  formData.append('file', {
    uri,
    name: filename,
    type: 'audio/m4a',
  });
  const { data } = await API.post('/translate-audio', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const rewriteTone = async (text, tone) => {
  const { data } = await API.post('/rewrite-tone', { text, tone });
  return data.rewritten_text;
};

export const textToSpeech = async (text, language) => {
  const { data } = await API.post('/text-to-speech', {
    text,
    language,
    use_sarvam: true,
    speaker: 'meera',
  }, { responseType: 'arraybuffer' });
  return data;
};

// ── Sessions ─────────────────────────────────────────────────────────────────

export const syncUser = async ({ id, email, first_name, last_name, avatar_url, consent_given = false }) => {
  const { data } = await API.post('/auth/sync-user', { id, email, first_name, last_name, avatar_url, consent_given });
  return data;
};

export const saveNativeToEnglishSession = async ({ userId, originalLanguage, originalText, translatedText }) => {
  const { data } = await API.post('/native-to-english/session', {
    user_id: userId,
    original_language: originalLanguage,
    original_text: originalText,
    translated_text: translatedText,
  });
  return data;
};

export const saveEnglishToNativeSession = async ({ userId, targetLanguage }) => {
  const { data } = await API.post('/english-to-native/session', {
    user_id: userId,
    target_language: targetLanguage,
  });
  return data;
};

export const saveEnglishToNativeTranslation = async ({ sessionId, inputText, translatedText }) => {
  const { data } = await API.post('/english-to-native/translation', {
    session_id: sessionId,
    input_text: inputText,
    translated_text: translatedText,
  });
  return data;
};

// ── Analysis ─────────────────────────────────────────────────────────────────

export const analyzeSentiment = async (text) => {
  const { data } = await API.post('/analyze-sentiment', { text });
  return data;
};

export const suggestTone = async (text) => {
  const { data } = await API.post('/suggest-tone', { text });
  return data.suggested_tone;
};

// ── Health ───────────────────────────────────────────────────────────────────

export const checkHealth = async () => {
  try {
    await API.get('/health', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
};

// ── Cache ────────────────────────────────────────────────────────────────────

export const getCacheStats = async () => {
  const { data } = await API.get('/cache/stats');
  return data;
};

export const clearCache = async (lang = null) => {
  const params = lang ? `?lang=${lang}` : '';
  const { data } = await API.delete(`/cache/clear${params}`);
  return data;
};

// ── Video Translation ────────────────────────────────────────────────────────

export const uploadVideo = async (uri, filename = 'video.mp4') => {
  const formData = new FormData();
  formData.append('file', { uri, name: filename, type: 'video/mp4' });
  const { data } = await API.post('/video/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
  return data; // { video_id, filename, size_kb }
};

export const translateVideo = async ({ video_id, target_language, voice_type = 'female', tone = 'neutral' }) => {
  const { data } = await API.post('/video/translate', { video_id, target_language, voice_type, tone });
  return data;
};

export const getVideoStatus = async (videoId) => {
  const { data } = await API.get(`/video/status/${videoId}`);
  return data;
};
