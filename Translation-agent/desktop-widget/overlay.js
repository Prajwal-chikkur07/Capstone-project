const { ipcRenderer } = require('electron');

const API_BASE = 'http://127.0.0.1:8000/api';

const ALL_LANGUAGES = {
  'hi-IN': 'Hindi', 'bn-IN': 'Bengali', 'ta-IN': 'Tamil',
  'te-IN': 'Telugu', 'ml-IN': 'Malayalam', 'mr-IN': 'Marathi',
  'gu-IN': 'Gujarati', 'kn-IN': 'Kannada', 'pa-IN': 'Punjabi', 'or-IN': 'Odia',
};

const TONES = ['Smart Suggest', 'Email Formal', 'Email Casual', 'Slack', 'LinkedIn', 'WhatsApp Business', 'Custom'];

// ── Domain detection ──────────────────────────────────────────────────────────
// Maps URL patterns → { label, icon, target, sendMode }
const DOMAIN_RULES = [
  { pattern: /mail\.google\.com/,        label: 'Gmail',     icon: '✉️',  target: 'gmail',    sendMode: 'compose' },
  { pattern: /outlook\.live\.com|outlook\.office\.com/, label: 'Outlook', icon: '📧', target: 'outlook', sendMode: 'compose' },
  { pattern: /app\.slack\.com/,          label: 'Slack',     icon: '💬',  target: 'slack',    sendMode: 'compose' },
  { pattern: /web\.whatsapp\.com/,       label: 'WhatsApp',  icon: '📱',  target: 'whatsapp', sendMode: 'textbox' },
  { pattern: /www\.linkedin\.com/,       label: 'LinkedIn',  icon: '💼',  target: 'linkedin', sendMode: 'textbox' },
  { pattern: /twitter\.com|x\.com/,     label: 'X / Twitter', icon: '🐦', target: 'twitter', sendMode: 'textbox' },
  { pattern: /teams\.microsoft\.com/,   label: 'Teams',     icon: '🟣',  target: 'teams',    sendMode: 'textbox' },
  { pattern: /discord\.com/,            label: 'Discord',   icon: '🎮',  target: 'discord',  sendMode: 'textbox' },
  { pattern: /notion\.so/,              label: 'Notion',    icon: '📝',  target: 'notion',   sendMode: 'textbox' },
  { pattern: /docs\.google\.com/,       label: 'Google Docs', icon: '📄', target: 'gdocs',  sendMode: 'textbox' },
];

let detectedDomain = null; // { label, icon, target, sendMode }

// Ask main process for the active browser URL, then detect domain
function detectActiveDomain() {
  ipcRenderer.send('get-active-url');
}

ipcRenderer.on('active-url', (_, url) => {
  if (!url) { detectedDomain = null; render(); return; }
  detectedDomain = null;
  for (const rule of DOMAIN_RULES) {
    if (rule.pattern.test(url)) { detectedDomain = rule; break; }
  }
  render();
});

// ── State ─────────────────────────────────────────────────────────────────────
let selectedLang = 'hi-IN';
let configuredLangs = Object.keys(ALL_LANGUAGES);
let outputText = '';
let isLoading = false;
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;
let waveformInterval = null;
let recordingTimeSec = 0;
let recordingTimer = null;
let selectedTone = null;
let customTone = '';
let toneOutput = '';
let isToneLoading = false;

const root = document.getElementById('overlay');

function escHtml(v) {
  return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function parseEmailParts(text) {
  const lines = text.trim().split('\n');
  let subject = '', bodyLines = [], inBody = false;
  for (const line of lines) {
    if (!inBody && /^subject\s*:/i.test(line)) {
      subject = line.replace(/^subject\s*:\s*/i, '').trim();
    } else if (subject && !inBody && line.trim() === '') {
      inBody = true;
    } else if (inBody || subject) {
      bodyLines.push(line);
    }
  }
  if (!subject) { subject = lines[0] || ''; bodyLines = lines.slice(1); }
  return { subject: subject.trim(), body: bodyLines.join('\n').trim() };
}

function langOptions() {
  const langs = configuredLangs.filter(c => ALL_LANGUAGES[c]);
  const list = langs.length > 0 ? langs : Object.keys(ALL_LANGUAGES);
  return list.map(c =>
    `<option value="${c}" ${c === selectedLang ? 'selected' : ''}>${ALL_LANGUAGES[c]}</option>`
  ).join('');
}

function fmtTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  const displayText = toneOutput || outputText;
  const hasOutput   = !!outputText;
  const toneLabel   = (selectedTone && selectedTone !== 'Smart Suggest') ? selectedTone : 'English';
  const dotColor    = (selectedTone && selectedTone !== 'Smart Suggest') ? '#8b5cf6' : '#111827';

  // Send button label based on detected domain
  let sendLabel = 'Send to Textbox';
  let sendClass = '';
  let domainBadge = '';
  if (detectedDomain) {
    sendLabel = `Send to ${detectedDomain.label}`;
    sendClass = 'detected';
    domainBadge = `<span class="domain-badge">${detectedDomain.icon} ${detectedDomain.label} detected</span>`;
  }

  root.innerHTML = `
    <!-- Top bar -->
    <div class="topbar">
      <div class="brand">
        <span class="brand-dot ${isRecording ? 'recording' : ''}"></span>
        <div>
          <div class="brand-name">SeedlingSpeaks</div>
          <div class="brand-sub">${isRecording ? 'Recording…' : 'Native → English'}</div>
        </div>
      </div>
      <span class="drag-hint">⠿ drag</span>
      <div class="topbar-right">
        <select class="lang-select" id="langSel">${langOptions()}</select>
        <button class="close-btn" id="closeBtn">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>

    <!-- Mic section -->
    <div class="mic-section">
      ${isRecording ? `
        <div class="rec-bar">
          <div class="rec-dot"></div>
          <span class="rec-timer" id="recTimer">${fmtTime(recordingTimeSec)}</span>
          <div class="wave-wrap">
            ${Array(32).fill(0).map(() => `<div class="wave-bar"></div>`).join('')}
          </div>
          <button class="stop-btn" id="micBtn">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
            Stop
          </button>
        </div>
      ` : `
        <button class="mic-btn" id="micBtn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        </button>
        <span class="mic-hint">Tap to speak in ${ALL_LANGUAGES[selectedLang] || 'native language'}</span>
      `}
    </div>

    <!-- Output block -->
    <div class="output-block">
      <div class="output-header">
        <div class="output-label">
          <span class="output-dot" style="background:${dotColor}"></span>
          <span class="output-title">${escHtml(toneLabel)}</span>
        </div>
        ${displayText ? `<button class="copy-btn" id="copyBtn">Copy</button>` : ''}
      </div>
      ${isLoading || isToneLoading ? `
        <div style="display:flex;align-items:center;gap:8px;min-height:80px;color:#9ca3af;font-size:13px;">
          <div class="spinner"></div>
          ${isLoading ? 'Transcribing…' : 'Rewriting…'}
        </div>
      ` : `
        <textarea class="output-ta" id="outputTa" placeholder="English translation appears here…">${escHtml(displayText)}</textarea>
      `}
    </div>

    <!-- Tone chips -->
    <div class="tone-row">
      ${TONES.map(t => `
        <button class="tone-chip ${selectedTone === t ? 'active' : ''}" data-tone="${t}">
          ${t === 'Custom' ? 'Custom' : t}
        </button>
      `).join('')}
    </div>
    ${selectedTone === 'Custom' ? `
      <div style="display:flex;gap:6px;margin-top:2px;">
        <input id="customInput" class="custom-input" placeholder="Describe your tone…" value="${escHtml(customTone)}">
        ${hasOutput ? `<button class="send-btn" id="applyCustomBtn" style="width:auto;padding:10px 16px;white-space:nowrap;">Apply</button>` : ''}
      </div>
    ` : ''}

    <!-- Domain badge + Send button -->
    ${displayText ? `
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:2px;">
        ${domainBadge}
        <button class="send-btn ${sendClass}" id="sendBtn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          ${sendLabel}
        </button>
      </div>
    ` : ''}
  `;

  bindEvents();
}

// ── Events ────────────────────────────────────────────────────────────────────
function bindEvents() {
  document.getElementById('closeBtn')?.addEventListener('click', () => ipcRenderer.send('hide-overlay'));
  document.getElementById('langSel')?.addEventListener('change', e => { selectedLang = e.target.value; render(); });

  document.getElementById('micBtn')?.addEventListener('click', () => {
    if (isRecording) stopRecording(); else startRecording();
  });

  document.getElementById('outputTa')?.addEventListener('input', e => {
    if (toneOutput) toneOutput = e.target.value;
    else outputText = e.target.value;
  });

  document.getElementById('copyBtn')?.addEventListener('click', () => {
    const text = toneOutput || outputText;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('copyBtn');
      if (!btn) return;
      btn.textContent = '✓ Copied';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1800);
    });
  });

  document.querySelectorAll('[data-tone]').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.getAttribute('data-tone');
      selectedTone = t;
      if (t === 'Custom') { toneOutput = ''; render(); }
      else handleApplyTone(t);
    });
  });

  document.getElementById('customInput')?.addEventListener('input', e => { customTone = e.target.value; });
  document.getElementById('applyCustomBtn')?.addEventListener('click', () => handleApplyTone('Custom'));

  document.getElementById('sendBtn')?.addEventListener('click', handleSend);
}

// ── Smart send — detects domain and routes accordingly ────────────────────────
function handleSend() {
  const text = toneOutput || outputText;
  if (!text) return;

  if (!detectedDomain) {
    // No domain detected — copy to clipboard with paste hint
    ipcRenderer.send('send-to-textbox', { text });
    return;
  }

  const { target, sendMode } = detectedDomain;

  if (sendMode === 'compose') {
    // Gmail / Outlook / Slack — fill compose box via shell script
    const { subject, body } = parseEmailParts(text);
    ipcRenderer.send('send-to-compose', { subject, body, target });
  } else {
    // WhatsApp Web, LinkedIn, Twitter, Discord, Notion, etc.
    // Use AX insert to fill the visible textbox
    ipcRenderer.send('send-to-active-textbox', { text, target });
  }
}

// ── Recording ─────────────────────────────────────────────────────────────────
async function startRecording() {
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    mediaRecorder = new MediaRecorder(audioStream, { mimeType });
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = async () => {
      audioStream.getTracks().forEach(t => t.stop());
      audioStream = null;
      stopWaveform();
      await processAudio();
    };
    mediaRecorder.start();
    isRecording = true;
    recordingTimeSec = 0;
    recordingTimer = setInterval(() => {
      recordingTimeSec++;
      const el = document.getElementById('recTimer');
      if (el) el.textContent = fmtTime(recordingTimeSec);
    }, 1000);
    startWaveform(audioStream);
    render();
  } catch (e) {
    ipcRenderer.send('show-toast', { type: 'error', message: '⚠ Microphone access denied.' });
  }
}

function stopRecording() {
  if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null; }
  if (mediaRecorder?.state !== 'inactive') mediaRecorder.stop();
  isRecording = false;
  isLoading = true;
  render();
}

function startWaveform(stream) {
  try {
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    waveformInterval = setInterval(() => {
      analyser.getByteFrequencyData(data);
      document.querySelectorAll('.wave-bar').forEach((bar, i) => {
        const val = data[Math.floor((i / 32) * data.length)] || 0;
        bar.style.height = Math.max(3, Math.round((val / 255) * 26)) + 'px';
      });
    }, 60);
  } catch {}
}

function stopWaveform() {
  if (waveformInterval) { clearInterval(waveformInterval); waveformInterval = null; }
}

async function processAudio() {
  try {
    const blob = new Blob(audioChunks, { type: 'audio/webm' });
    if (blob.size === 0) { outputText = '⚠ No audio recorded.'; isLoading = false; render(); return; }
    const formData = new FormData();
    formData.append('file', blob, 'recording.webm');
    const res = await fetch(`${API_BASE}/translate-audio`, { method: 'POST', body: formData });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`); }
    const data = await res.json();
    outputText = data.transcript || '⚠ Could not transcribe. Speak clearly and try again.';
  } catch (e) {
    outputText = `⚠ ${e.message || 'Backend not reachable.'}`;
  }
  isLoading = false;
  toneOutput = '';
  selectedTone = null;
  // After transcription, detect domain for smart send
  detectActiveDomain();
  render();
}

// ── Tone rewrite ──────────────────────────────────────────────────────────────
async function handleApplyTone(tone) {
  const text = outputText.trim();
  if (!text) return;
  isToneLoading = true; toneOutput = ''; render();
  try {
    let resolvedTone = tone;
    if (tone === 'Smart Suggest') {
      const r = await fetch(`${API_BASE}/suggest-tone`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) throw new Error(`suggest-tone HTTP ${r.status}`);
      const d = await r.json();
      resolvedTone = d.suggested_tone || 'Email Formal';
      selectedTone = resolvedTone;
    }
    const userOverride = tone === 'Custom' ? customTone : null;
    const r = await fetch(`${API_BASE}/rewrite-tone`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, tone: resolvedTone, user_override: userOverride }),
    });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${r.status}`); }
    const d = await r.json();
    toneOutput = d.rewritten_text || text;
  } catch (e) {
    toneOutput = `⚠ ${e.message || 'Backend not reachable.'}`;
  }
  isToneLoading = false; render();
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcRenderer.on('set-mode', (_, m) => {
  outputText = ''; toneOutput = ''; isLoading = false;
  isToneLoading = false; isRecording = false; selectedTone = null;
  detectedDomain = null;
  render();
  detectActiveDomain();
});

ipcRenderer.on('set-config', (_, cfg) => {
  if (cfg.languages?.length > 0) {
    configuredLangs = cfg.languages.filter(c => ALL_LANGUAGES[c]);
    if (configuredLangs.length > 0 && !configuredLangs.includes(selectedLang)) {
      selectedLang = configuredLangs[0];
    }
  }
  render();
});

render();
detectActiveDomain();
