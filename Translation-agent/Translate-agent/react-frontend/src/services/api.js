import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
  timeout: 120000,
});

// ── JWT token helpers ─────────────────────────────────────────────────────────
export const getToken = () => localStorage.getItem('auth_token');
export const setToken = (t) => localStorage.setItem('auth_token', t);
export const clearToken = () => localStorage.removeItem('auth_token');

// Attach JWT to every request if present
API.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth endpoints ────────────────────────────────────────────────────────────
export const authSignup = async ({ name, email, password }) => {
  const { data } = await API.post('/auth/signup', { name, email, password });
  return data; // { token, user }
};

export const authLogin = async ({ email, password }) => {
  const { data } = await API.post('/auth/login', { email, password });
  return data; // { token, user }
};

export const authMe = async () => {
  const { data } = await API.get('/auth/me');
  return data; // { id, name, email, created_at }
};


export const translateAudio = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await API.post('/translate-audio', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.transcript;
};

export const translateAudioFromBlob = async (blob, filename = 'recording.webm') => {
  const formData = new FormData();
  formData.append('file', blob, filename);
  const { data } = await API.post('/translate-audio', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  // Returns { transcript, confidence } — confidence may be null
  return data;
};

export const rewriteTone = async (text, tone, userOverride = null, customVocabulary = null) => {
  const { data } = await API.post('/rewrite-tone', {
    text,
    tone,
    user_override: userOverride,
    custom_vocabulary: customVocabulary,
  });
  return data.rewritten_text;
};

export const translateText = async (text, targetLanguage) => {
  const { data } = await API.post('/translate-text', {
    text,
    target_language: targetLanguage,
  });
  return data.translated_text;
};

export const textToSpeech = async (text, language, speaker = 'meera') => {
  const { data } = await API.post(
    '/text-to-speech',
    { text, language, use_sarvam: true, speaker },
    { responseType: 'blob' }
  );
  return data;
};

export const sendEmail = async ({ text, toEmail, subject, tone, language, smtpUsername, smtpPassword }) => {
  const { data } = await API.post('/send/email', {
    text,
    to_email: toEmail,
    subject,
    tone,
    language,
    use_sendgrid: false,
    smtp_username: smtpUsername || undefined,
    smtp_password: smtpPassword || undefined,
  });
  return data;
};

export const sendToSlack = async ({ text, webhookUrl, tone, language }) => {
  const { data } = await API.post('/send/slack', {
    text,
    webhook_url: webhookUrl || null,
    tone,
    language,
    use_api: false,
  });
  return data;
};

export const shareToLinkedIn = async ({ text, tone, language, addHashtags = true }) => {
  const { data } = await API.post('/send/linkedin', {
    text,
    tone,
    language,
    add_hashtags: addHashtags,
    use_mock: true,
  });
  return data;
};

export const getCacheStats = async () => {
  const { data } = await API.get('/cache/stats');
  return data;
};

export const clearCache = async (lang = null) => {
  const params = lang ? `?lang=${lang}` : '';
  const { data } = await API.delete(`/cache/clear${params}`);
  return data;
};

export const analyzeSentiment = async (text) => {
  const { data } = await API.post('/analyze-sentiment', { text });
  return data; // { sentiment, score, summary }
};

export const suggestTone = async (text) => {
  const { data } = await API.post('/suggest-tone', { text });
  return data.suggested_tone;
};

export const exportHistory = async (entries, format = 'csv') => {
  const response = await API.post('/export', { entries, format }, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = format === 'csv' ? 'transcripts.csv' : 'transcripts.txt';
  a.click();
  URL.revokeObjectURL(url);
};

export const summarizeTranscript = async (text) => {
  const { data } = await API.post('/summarize', { text });
  return data.summary;
};

export const getMeetingNotes = async (text) => {
  const { data } = await API.post('/meeting-notes', { text });
  return data; // { summary, action_items, decisions, attendees, follow_ups }
};

export const askQuestion = async (transcript, question) => {
  const { data } = await API.post('/qa', { transcript, question });
  return data.answer;
};

export const createShareLink = async (text, title = '') => {
  const { data } = await API.post('/share/create', { text, title });
  return data; // { link_id, url }
};

export const getShareLink = async (linkId) => {
  const { data } = await API.get(`/share/${linkId}`);
  return data;
};

export const backTranslate = async (text, sourceLang) => {
  const { data } = await API.post('/back-translate', { text, source_lang: sourceLang });
  return data; // { back_translation, accuracy_score, notes }
};

export const getReadability = async (text) => {
  const { data } = await API.post('/readability', { text });
  return data; // { score, grade, label }
};

export const getToneConfidence = async (text, tone) => {
  const { data } = await API.post('/tone-confidence', { text, tone });
  return data; // { score, feedback }
};

export const multiTranslate = async (text, languages) => {
  const { data } = await API.post('/multi-translate', { text, languages });
  return data.translations; // { 'hi-IN': '...', 'ta-IN': '...' }
};

// Health check — resolves true if backend is reachable
export const checkHealth = async () => {
  try {
    await API.get('/health', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
};

export const visionTranslate = async (imageFile, targetLanguage) => {
  const formData = new FormData();
  formData.append('file', imageFile);
  formData.append('target_language', targetLanguage);
  const { data } = await API.post('/vision-translate', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return data; // { regions: [{original, translated, x, y, w, h, font_size, bg_color, text_color}], count }
};
