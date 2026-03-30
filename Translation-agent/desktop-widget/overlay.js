const { ipcRenderer } = require('electron');

const API_BASE = 'http://127.0.0.1:8000/api';

const ALL_LANGUAGES = {
  'hi-IN': 'Hindi', 'bn-IN': 'Bengali', 'ta-IN': 'Tamil',
  'te-IN': 'Telugu', 'ml-IN': 'Malayalam', 'mr-IN': 'Marathi',
  'gu-IN': 'Gujarati', 'kn-IN': 'Kannada', 'pa-IN': 'Punjabi', 'or-IN': 'Odia',
};

const TONES = ['Email Formal', 'Email Casual', 'Slack', 'LinkedIn', 'WhatsApp', 'Custom'];

// Send button label per tone
const TONE_SEND_LABEL = {
  'Email Formal': 'Send to Gmail',
  'Email Casual': 'Send to Gmail',
  'Slack':        'Send to Slack',
  'LinkedIn':     'Send to LinkedIn',
  'WhatsApp':     'Send to WhatsApp',
  'Custom':       'Send',
};

// Domain detection
const DOMAIN_RULES = [
  { pattern: /mail\.google\.com/,                      label: 'Gmail',    target: 'gmail',    sendMode: 'compose' },
  { pattern: /outlook\.live\.com|outlook\.office\.com/,label: 'Outlook',  target: 'outlook',  sendMode: 'compose' },
  { pattern: /app\.slack\.com/,                        label: 'Slack',    target: 'slack',    sendMode: 'compose' },
  { pattern: /web\.whatsapp\.com/,                     label: 'WhatsApp', target: 'whatsapp', sendMode: 'textbox' },
  { pattern: /www\.linkedin\.com/,                     label: 'LinkedIn', target: 'linkedin', sendMode: 'textbox' },
  { pattern: /twitter\.com|x\.com/,                   label: 'X',        target: 'twitter',  sendMode: 'textbox' },
  { pattern: /discord\.com/,                           label: 'Discord',  target: 'discord',  sendMode: 'textbox' },
];

// ── State ─────────────────────────────────────────────────────────────────────
let selectedLang  = 'hi-IN';
let selectedTone  = 'Email Formal';
let customTone    = '';
let configuredLangs = Object.keys(ALL_LANGUAGES);
let outputText    = '';
let displayedText = ''; // typewriter progress
let isLoading     = false;
let isRecording   = false;
let detectedDomain = null;

let mediaRecorder = null;
let audioChunks   = [];
let audioStream   = null;
let waveInterval  = null;
let recTimerInt   = null;
let recSec        = 0;
let typewriterInt = null;

const root = document.getElementById('card');

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function toneOptions() {
  return TONES.map(t =>
    `<option value="${t}" ${t === selectedTone ? 'selected' : ''}>${t}</option>`
  ).join('');
}

function getSendLabel() {
  if (detectedDomain) return `Send to ${detectedDomain.label}`;
  return TONE_SEND_LABEL[selectedTone] || 'Send';
}

function fmtTime(s) {
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}

// ── Waveform bars ─────────────────────────────────────────────────────────────
function renderBars(active) {
  return Array.from({ length: 28 }, (_, i) => {
    const h = active
      ? Math.max(3, Math.round(Math.random() * 26 + 4))
      : Math.max(3, Math.round(Math.sin(i * 0.6) * 4 + 5));
    return `<div class="wbar" style="height:${h}px"></div>`;
  }).join('');
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  const hasOutput = !!displayedText;
  const charCount = displayedText.length;
  const sendLabel = getSendLabel();

  root.innerHTML = `
    <!-- Top bar -->
    <div class="topbar">
      <div class="brand">
        <span class="brand-dot ${isRecording ? 'recording' : ''}"></span>
        <div class="brand-info">
          <span class="brand-name">SeedlingSpeaks</span>
          <span class="brand-sub">Native → English</span>
        </div>
      </div>
      <button class="close-btn" id="closeBtn">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <!-- Controls row -->
    <div class="controls-row">
      <select id="langSel">${langOptions()}</select>
      <select id="toneSel">${toneOptions()}</select>
    </div>

    <!-- Waveform -->
    <div class="waveform" id="waveform">
      ${renderBars(false)}
    </div>

    <!-- Mic section -->
    <div class="mic-section">
      <button class="mic-btn ${isRecording ? 'recording' : ''}" id="micBtn">
        ${isRecording
          ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`
          : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`
        }
      </button>
      <div class="mic-status">
        <span class="status-dot ${isRecording ? 'visible' : ''}"></span>
        <span id="statusLabel">${isRecording ? `Listening… ${fmtTime(recSec)}` : isLoading ? 'Transcribing…' : 'Tap to speak'}</span>
      </div>
    </div>

    <!-- Divider -->
    <div class="divider"></div>

    <!-- Output box -->
    <div class="output-box">
      <div class="output-header">
        <span class="output-badge">English</span>
        <span class="char-count">${hasOutput ? charCount + ' chars' : ''}</span>
      </div>
      <div class="output-text" id="outputText">
        ${isLoading
          ? `<span style="color:#ccc;font-style:italic;">Transcribing…</span>`
          : hasOutput
            ? escHtml(displayedText)
            : `<span class="output-placeholder">Translation appears here</span>`
        }
      </div>
    </div>

    <!-- Action row -->
    <div class="action-row">
      <button class="btn btn-outline" id="copyBtn" ${!hasOutput ? 'disabled' : ''}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copy
      </button>
      <button class="btn btn-solid" id="sendBtn" ${!hasOutput ? 'disabled' : ''}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        ${sendLabel}
      </button>
    </div>
  `;

  bindEvents();
  if (isRecording) animateWaveform();
}

// ── Waveform animation ────────────────────────────────────────────────────────
function animateWaveform() {
  if (waveInterval) clearInterval(waveInterval);
  waveInterval = setInterval(() => {
    const bars = document.querySelectorAll('.wbar');
    bars.forEach(bar => {
      const h = Math.max(3, Math.round(Math.random() * 26 + 4));
      bar.style.height = h + 'px';
    });
  }, 80);
}

function stopWaveformAnim() {
  if (waveInterval) { clearInterval(waveInterval); waveInterval = null; }
  document.querySelectorAll('.wbar').forEach((bar, i) => {
    bar.style.height = Math.max(3, Math.round(Math.sin(i * 0.6) * 4 + 5)) + 'px';
  });
}

// ── Typewriter ────────────────────────────────────────────────────────────────
function typewrite(text) {
  if (typewriterInt) clearInterval(typewriterInt);
  displayedText = '';
  let i = 0;
  typewriterInt = setInterval(() => {
    displayedText = text.slice(0, ++i);
    const el = document.getElementById('outputText');
    if (el) el.innerHTML = escHtml(displayedText);
    const cc = document.querySelector('.char-count');
    if (cc) cc.textContent = displayedText.length + ' chars';
    if (i >= text.length) {
      clearInterval(typewriterInt);
      typewriterInt = null;
      // Re-render to enable buttons
      render();
    }
  }, 18);
}

// ── Events ────────────────────────────────────────────────────────────────────
function bindEvents() {
  document.getElementById('closeBtn')?.addEventListener('click', () => ipcRenderer.send('hide-overlay'));

  document.getElementById('langSel')?.addEventListener('change', e => {
    selectedLang = e.target.value;
  });

  document.getElementById('toneSel')?.addEventListener('change', e => {
    selectedTone = e.target.value;
    // Update send button label without full re-render
    const btn = document.getElementById('sendBtn');
    if (btn) {
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> ${getSendLabel()}`;
    }
  });

  document.getElementById('micBtn')?.addEventListener('click', () => {
    if (isRecording) stopRecording(); else startRecording();
  });

  document.getElementById('copyBtn')?.addEventListener('click', () => {
    if (!displayedText) return;
    navigator.clipboard.writeText(displayedText).then(() => {
      const btn = document.getElementById('copyBtn');
      if (!btn) return;
      btn.textContent = '✓ Copied';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
        btn.classList.remove('copied');
      }, 1800);
    });
  });

  document.getElementById('sendBtn')?.addEventListener('click', handleSend);
}

// ── Smart send ────────────────────────────────────────────────────────────────
function handleSend() {
  const text = displayedText;
  if (!text) return;

  if (detectedDomain) {
    const { target, sendMode } = detectedDomain;
    if (sendMode === 'compose') {
      const { subject, body } = parseEmailParts(text);
      ipcRenderer.send('send-to-compose', { subject, body, target });
    } else {
      ipcRenderer.send('send-to-active-textbox', { text, target });
    }
    return;
  }

  // Tone-based routing
  if (selectedTone === 'Email Formal' || selectedTone === 'Email Casual') {
    const { subject, body } = parseEmailParts(text);
    ipcRenderer.send('send-to-compose', { subject, body, target: 'gmail' });
  } else if (selectedTone === 'Slack') {
    ipcRenderer.send('send-to-compose', { subject: '', body: text, target: 'slack' });
  } else {
    ipcRenderer.send('send-to-textbox', { text });
  }
}

// ── Recording ─────────────────────────────────────────────────────────────────
async function startRecording() {
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    mediaRecorder = new MediaRecorder(audioStream, { mimeType: mime });
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = async () => {
      audioStream.getTracks().forEach(t => t.stop());
      audioStream = null;
      stopWaveformAnim();
      await processAudio();
    };
    mediaRecorder.start();
    isRecording = true;
    recSec = 0;
    recTimerInt = setInterval(() => {
      recSec++;
      const el = document.getElementById('statusLabel');
      if (el) el.textContent = `Listening… ${fmtTime(recSec)}`;
    }, 1000);
    render();
  } catch {
    ipcRenderer.send('show-toast', { type: 'error', message: '⚠ Microphone access denied.' });
  }
}

function stopRecording() {
  if (recTimerInt) { clearInterval(recTimerInt); recTimerInt = null; }
  if (mediaRecorder?.state !== 'inactive') mediaRecorder.stop();
  isRecording = false;
  isLoading = true;
  stopWaveformAnim();
  render();
}

async function processAudio() {
  try {
    const blob = new Blob(audioChunks, { type: 'audio/webm' });
    if (blob.size === 0) {
      outputText = '⚠ No audio recorded.';
      isLoading = false; displayedText = outputText; render(); return;
    }
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
  render();
  // Typewriter effect
  typewrite(outputText);
  // Detect domain for smart send
  detectActiveDomain();
}

// ── Domain detection ──────────────────────────────────────────────────────────
function detectActiveDomain() {
  ipcRenderer.send('get-active-url');
}

ipcRenderer.on('active-url', (_, url) => {
  if (!url) { detectedDomain = null; return; }
  detectedDomain = null;
  for (const rule of DOMAIN_RULES) {
    if (rule.pattern.test(url)) { detectedDomain = rule; break; }
  }
  // Update send button label
  const btn = document.getElementById('sendBtn');
  if (btn && displayedText) {
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> ${getSendLabel()}`;
  }
});

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcRenderer.on('set-mode', () => {
  outputText = ''; displayedText = ''; isLoading = false;
  isRecording = false; detectedDomain = null;
  if (typewriterInt) { clearInterval(typewriterInt); typewriterInt = null; }
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
