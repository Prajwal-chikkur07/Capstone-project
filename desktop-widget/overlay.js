const { ipcRenderer } = require('electron');

const API_BASE = 'http://127.0.0.1:8000/api';

const ALL_LANGUAGES = {
  'hi-IN': 'Hindi', 'bn-IN': 'Bengali', 'ta-IN': 'Tamil',
  'te-IN': 'Telugu', 'ml-IN': 'Malayalam', 'mr-IN': 'Marathi',
  'gu-IN': 'Gujarati', 'kn-IN': 'Kannada', 'pa-IN': 'Punjabi', 'or-IN': 'Odia',
};

const TONES = ['Smart Suggest', 'Email Formal', 'Email Casual', 'Slack', 'LinkedIn', 'WhatsApp Business', 'User Override'];

let mode = 'englishToNative';
let selectedLang = 'hi-IN';
let configuredLangs = Object.keys(ALL_LANGUAGES);
let inputText = '';
let outputText = '';
let isLoading = false;
let activeAction = null;

// Native→English mic state
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let selectedTone = 'Smart Suggest';
let customTone = '';
let toneOutput = '';
let isToneLoading = false;

const root = document.getElementById('overlay');

function escHtml(v) {
  return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Parse "Subject: ...\n\nBody..." format from Gemini email rewrites
function parseEmailParts(text) {
  const lines = text.trim().split('\n');
  let subject = '';
  let bodyLines = [];
  let inBody = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inBody && /^subject\s*:/i.test(line)) {
      subject = line.replace(/^subject\s*:\s*/i, '').trim();
    } else if (subject && !inBody && line.trim() === '') {
      inBody = true; // blank line after subject = start of body
    } else if (inBody || subject) {
      bodyLines.push(line);
    }
  }

  // If no Subject: line found, use first line as subject, rest as body
  if (!subject) {
    subject = lines[0] || '';
    bodyLines = lines.slice(1);
  }

  return {
    subject: subject.trim(),
    body: bodyLines.join('\n').trim(),
  };
}

function langOptions() {
  const langs = configuredLangs.filter(c => ALL_LANGUAGES[c]);
  const list = langs.length > 0 ? langs : Object.keys(ALL_LANGUAGES);
  return list.map(c =>
    `<option value="${c}" ${c === selectedLang ? 'selected' : ''}>${ALL_LANGUAGES[c]}</option>`
  ).join('');
}

const SCREEN_ACTIONS = [
  {
    id: 'page', label: 'Translate Page',
    bg: 'rgba(99,102,241,0.18)',
    icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  },
  {
    id: 'selection', label: 'Selection',
    bg: 'rgba(16,185,129,0.15)',
    icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round"><path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M14 14h7v7h-7z"/><path d="M3 14h7v7H3z"/></svg>`,
  },
  {
    id: 'click', label: 'Click Text',
    bg: 'rgba(245,158,11,0.15)',
    icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"><path d="M15 15l-2 5L9 9l11 4-5 2z"/><path d="M15 15l5 5"/></svg>`,
  },
  {
    id: 'restore', label: 'Restore',
    bg: 'rgba(239,68,68,0.13)',
    icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
  },
];

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  if (mode === 'nativeToEnglish') {
    renderNativeMode();
  } else {
    renderEnglishMode();
  }
}

function renderEnglishMode() {
  root.innerHTML = `
    <div class="topbar">
      <div class="mode-pill">
        <span class="mode-dot" style="background:#818cf8;box-shadow:0 0 5px #818cf899"></span>
        <span class="mode-text">English → Native</span>
      </div>
      <span class="drag-hint">⠿ drag to move</span>
      <div class="topbar-right">
        <select class="lang-select" id="langSel">${langOptions()}</select>
        <button class="close-btn" id="closeBtn">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>

    <div class="blocks">
      <div class="block">
        <div class="block-header">
          <div class="block-label"><span class="block-dot" style="background:#60a5fa"></span><span class="block-title">English</span></div>
        </div>
        <textarea id="inputArea" placeholder="Type English here…">${escHtml(inputText)}</textarea>
      </div>
      <div class="block">
        <div class="block-header">
          <div class="block-label"><span class="block-dot" style="background:#fbbf24"></span><span class="block-title">${ALL_LANGUAGES[selectedLang] || 'Native'}</span></div>
          ${outputText ? `<button class="copy-btn" id="copyBtn">Copy</button>` : ''}
        </div>
        <div class="output-text" id="outputArea">
          ${isLoading
            ? `<span style="color:rgba(255,255,255,0.3);display:flex;align-items:center;gap:6px;"><div class="spinner"></div> Translating…</span>`
            : outputText ? escHtml(outputText) : `<span class="output-placeholder">Translation appears here</span>`}
        </div>
      </div>
    </div>

    <div class="translate-row">
      <button class="translate-btn en" id="translateBtn" ${isLoading ? 'disabled' : ''}>
        ${isLoading ? `<div class="spinner"></div> Translating…` : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Translate`}
      </button>
    </div>

    <div class="actions">
      ${SCREEN_ACTIONS.map(a => `
        <button class="action-btn ${activeAction === a.id ? 'active' : ''}" data-action="${a.id}" title="${a.label}">
          <div class="action-icon" style="background:${a.bg}">${a.icon}</div>
          <span class="action-label">${a.label}</span>
        </button>
      `).join('')}
    </div>
  `;
  bindEnglishEvents();
}

function renderNativeMode() {
  const micActive = isRecording;
  // The displayed text: toneOutput if a tone was applied, else raw outputText
  const displayText = toneOutput || outputText;
  const hasOutput = !!outputText;
  // Show selected tone name in label whenever a tone chip is active
  const toneLabel = selectedTone && selectedTone !== 'Smart Suggest' ? selectedTone : 'English';
  const dotColor = (selectedTone && selectedTone !== 'Smart Suggest') ? '#a78bfa' : '#fbbf24';

  root.innerHTML = `
    <div class="topbar">
      <div class="mode-pill">
        <span class="mode-dot" style="background:#34d399;box-shadow:0 0 5px #34d39999"></span>
        <span class="mode-text">Native → English</span>
      </div>
      <span class="drag-hint">⠿ drag to move</span>
      <div class="topbar-right">
        <select class="lang-select" id="langSel">${langOptions()}</select>
        <button class="close-btn" id="closeBtn">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>

    <!-- Mic section -->
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:6px 0 2px;">
      ${micActive ? `
        <div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:10px 14px;width:100%;">
          <div style="width:9px;height:9px;border-radius:50%;background:#ef4444;box-shadow:0 0 8px rgba(239,68,68,0.7);flex-shrink:0;animation:recPulse 1s ease-in-out infinite;"></div>
          <span id="recTimer" style="font-size:12px;font-family:monospace;font-weight:700;color:rgba(255,255,255,0.6);flex-shrink:0;">${fmtTime(recordingTimeSec)}</span>
          <div style="display:flex;align-items:center;gap:2px;flex:1;height:28px;">
            ${Array(36).fill(0).map(() => `<div class="wave-bar" style="width:2px;height:3px;border-radius:2px;background:#e5e7eb;transition:height 0.07s;"></div>`).join('')}
          </div>
          <button id="micBtn" style="display:flex;align-items:center;gap:6px;background:#ef4444;border:none;border-radius:10px;color:#fff;font-size:12px;font-weight:700;padding:7px 14px;cursor:pointer;flex-shrink:0;">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
            Stop
          </button>
        </div>
      ` : `
        <button id="micBtn" class="mic-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        </button>
        <span style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.35);letter-spacing:0.04em;">Tap mic to speak in ${ALL_LANGUAGES[selectedLang] || 'native language'}</span>
      `}
    </div>

    <!-- Single output block — editable textarea, updates when tone changes -->
    <div class="block" style="margin:0;">
      <div class="block-header">
        <div class="block-label">
          <span class="block-dot" style="background:${dotColor};transition:background 0.2s;"></span>
          <span class="block-title">${escHtml(toneLabel)}</span>
        </div>
        ${displayText ? `<button class="copy-btn" id="copyOutputBtn">Copy</button>` : ''}
      </div>
      ${isLoading || isToneLoading ? `
        <div class="output-text" style="min-height:80px;display:flex;align-items:center;gap:6px;">
          <div class="spinner"></div>
          <span style="color:rgba(255,255,255,0.3);">${isLoading ? 'Transcribing…' : 'Rewriting…'}</span>
        </div>
      ` : `
        <textarea id="outputTextarea"
          style="flex:1;background:transparent;border:none;outline:none;color:rgba(255,255,255,0.88);font-family:inherit;font-size:12.5px;line-height:1.65;resize:none;min-height:80px;width:100%;"
          placeholder="English translation appears here…"
        >${escHtml(displayText)}</textarea>
      `}
    </div>

    <!-- Tone chips — clicking immediately rewrites -->
    <div style="border-top:1px solid rgba(255,255,255,0.05);padding-top:8px;display:flex;flex-direction:column;gap:7px;">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        ${TONES.map(t => `
          <button class="tone-chip ${selectedTone === t ? 'active' : ''}" data-tone="${t}">${t === 'User Override' ? 'Custom' : t}</button>
        `).join('')}
      </div>
      ${selectedTone === 'User Override' ? `
        <div style="display:flex;gap:6px;">
          <input id="customToneInput" class="custom-tone-input" style="flex:1;" placeholder="Describe your tone…" value="${escHtml(customTone)}">
          ${hasOutput ? `<button class="translate-btn native" id="applyCustomBtn" style="padding:6px 14px;font-size:11px;white-space:nowrap;">Apply</button>` : ''}
        </div>
      ` : ''}
    </div>

    <!-- Send to Textbox / Smart Send -->
    ${displayText ? `
      <div style="display:flex;gap:6px;justify-content:center;margin-top:2px;flex-wrap:wrap;">
        <button class="translate-btn en" id="sendToBoxBtn" style="background:linear-gradient(135deg,#059669,#10b981);box-shadow:0 4px 14px rgba(16,185,129,0.3);padding:8px 28px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          Send to Textbox
        </button>
      </div>
    ` : ''}
  `;
  bindNativeEvents();
}

// ── English mode events ───────────────────────────────────────────────────────
function bindEnglishEvents() {
  document.getElementById('closeBtn').addEventListener('click', () => ipcRenderer.send('hide-overlay'));

  document.getElementById('langSel')?.addEventListener('change', e => { selectedLang = e.target.value; render(); });

  const inputArea = document.getElementById('inputArea');
  if (inputArea) {
    inputArea.addEventListener('input', e => { inputText = e.target.value; });
    inputArea.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') document.getElementById('translateBtn')?.click();
    });
    setTimeout(() => inputArea.focus(), 60);
  }

  document.getElementById('translateBtn')?.addEventListener('click', handleEnglishTranslate);
  document.getElementById('copyBtn')?.addEventListener('click', () => copyText(outputText, 'copyBtn'));

  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleScreenAction(btn.getAttribute('data-action')));
  });
}

// ── Native mode events ────────────────────────────────────────────────────────
function bindNativeEvents() {
  document.getElementById('closeBtn').addEventListener('click', () => ipcRenderer.send('hide-overlay'));
  document.getElementById('langSel')?.addEventListener('change', e => { selectedLang = e.target.value; render(); });

  document.getElementById('micBtn')?.addEventListener('click', () => {
    if (isRecording) stopRecording(); else startRecording();
  });

  // Editable output textarea — keep in sync
  document.getElementById('outputTextarea')?.addEventListener('input', e => {
    if (toneOutput) toneOutput = e.target.value;
    else outputText = e.target.value;
  });

  document.getElementById('copyOutputBtn')?.addEventListener('click', () => {
    copyText(toneOutput || outputText, 'copyOutputBtn');
  });

  // Tone chips — click immediately rewrites (no Apply button needed)
  document.querySelectorAll('[data-tone]').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.getAttribute('data-tone');
      selectedTone = t;
      if (t === 'User Override') {
        toneOutput = ''; // clear until user types and hits Apply
        render();
      } else {
        handleApplyTone(t);
      }
    });
  });

  document.getElementById('customToneInput')?.addEventListener('input', e => { customTone = e.target.value; });
  document.getElementById('applyCustomBtn')?.addEventListener('click', () => handleApplyTone('User Override'));

  document.getElementById('sendToBoxBtn')?.addEventListener('click', () => {
    const text = toneOutput || outputText;
    if (!text) return;

    const isEmail = selectedTone === 'Email Formal' || selectedTone === 'Email Casual';
    const isSlack = selectedTone === 'Slack';

    if (isEmail || isSlack) {
      // Route through backend bridge → Chrome extension fills the compose box
      const { subject, body } = parseEmailParts(text);
      const target = isEmail ? 'gmail' : 'slack';
      ipcRenderer.send('send-to-compose', { subject, body, target });
    } else {
      // For native apps (VS Code, Notes, etc.) use AX insert
      ipcRenderer.send('send-to-textbox', { text });
    }
  });

  document.getElementById('openGmailBtn')?.addEventListener('click', () => {
    const text = toneOutput || outputText;
    if (!text) return;
    const { subject, body } = parseEmailParts(text);
    ipcRenderer.send('open-gmail-compose', { subject, body });
  });
}

// ── Recording — mirrors exactly how the React app does it ────────────────────
let audioStream = null;
let waveformInterval = null;
let recordingTimeSec = 0;
let recordingTimer = null;

async function startRecording() {
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];

    // Use same mimeType as the app
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm';

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

    // Timer counter
    recordingTimer = setInterval(() => {
      recordingTimeSec++;
      // Update just the timer text without full re-render
      const el = document.getElementById('recTimer');
      if (el) el.textContent = fmtTime(recordingTimeSec);
    }, 1000);

    startWaveform(audioStream);
    render();
  } catch (e) {
    console.error('mic error', e);
    ipcRenderer.send('show-toast', { type: 'error', message: '⚠ Microphone access denied.' });
  }
}

function stopRecording() {
  if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null; }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
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
      const bars = document.querySelectorAll('.wave-bar');
      bars.forEach((bar, i) => {
        const val = data[Math.floor((i / bars.length) * data.length)] || 0;
        const h = Math.max(3, Math.round((val / 255) * 28));
        bar.style.height = h + 'px';
      });
    }, 60);
  } catch {}
}

function stopWaveform() {
  if (waveformInterval) { clearInterval(waveformInterval); waveformInterval = null; }
}

function fmtTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
}

async function processAudio() {
  try {
    const blob = new Blob(audioChunks, { type: 'audio/webm' });
    if (blob.size === 0) {
      outputText = '⚠ No audio recorded. Please try again.';
      isLoading = false; render(); return;
    }

    const formData = new FormData();
    formData.append('file', blob, 'recording.webm');

    const res = await fetch(`${API_BASE}/translate-audio`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();
    outputText = data.transcript || '';
    if (!outputText) outputText = '⚠ Could not transcribe. Please speak clearly and try again.';

  } catch (e) {
    console.error('processAudio error', e);
    outputText = `⚠ ${e.message || 'Backend not reachable.'}`;
  }
  isLoading = false;
  toneOutput = '';
  selectedTone = null;
  render();
}

// ── Tone rewrite ──────────────────────────────────────────────────────────────
async function handleApplyTone(tone) {
  const text = outputText.trim();
  if (!text) {
    console.warn('[tone] No outputText to rewrite');
    return;
  }
  isToneLoading = true; toneOutput = ''; render();

  try {
    let resolvedTone = tone;

    // Smart Suggest: ask backend which tone fits best, then rewrite with that tone
    if (tone === 'Smart Suggest') {
      console.log('[tone] calling suggest-tone for:', text.slice(0, 60));
      const suggestRes = await fetch(`${API_BASE}/suggest-tone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!suggestRes.ok) throw new Error(`suggest-tone HTTP ${suggestRes.status}`);
      const suggestData = await suggestRes.json();
      resolvedTone = suggestData.suggested_tone || 'Email Formal';
      console.log('[tone] suggested:', resolvedTone);
      // Update the selected tone chip to reflect what was suggested
      selectedTone = resolvedTone;
    }

    const userOverride = tone === 'User Override' ? customTone : null;
    console.log('[tone] calling rewrite-tone with tone:', resolvedTone);
    const res = await fetch(`${API_BASE}/rewrite-tone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        tone: resolvedTone,
        user_override: userOverride,
      }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.detail || `rewrite-tone HTTP ${res.status}`);
    }
    const data = await res.json();
    console.log('[tone] rewrite result:', data);
    toneOutput = data.rewritten_text || text;
  } catch (e) {
    console.error('[tone] error:', e);
    toneOutput = `⚠ ${e.message || 'Backend not reachable.'}`;
  }
  isToneLoading = false; render();
}

// ── English translate ─────────────────────────────────────────────────────────
async function handleEnglishTranslate() {
  const text = inputText.trim();
  if (!text) return;
  isLoading = true; outputText = ''; render();

  try {
    const res = await fetch(`${API_BASE}/translate-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source_language: 'en-IN', target_language: selectedLang }),
    });
    const data = await res.json();
    outputText = data.translated_text || 'No output returned.';
  } catch {
    outputText = '⚠ Backend not reachable.';
  }
  isLoading = false; render();
}

// ── Screen actions (English mode only) ───────────────────────────────────────
function handleScreenAction(actionId) {
  activeAction = actionId;
  if (actionId === 'page') {
    ipcRenderer.send('hide-overlay');
    ipcRenderer.send('action-translate-screen', { lang: selectedLang, mode });
  } else if (actionId === 'selection') {
    ipcRenderer.send('hide-overlay');
    ipcRenderer.send('action-translate-region', { lang: selectedLang, mode });
  } else if (actionId === 'click') {
    ipcRenderer.send('hide-overlay');
    ipcRenderer.send('action-click-mode', { lang: selectedLang, mode });
  } else if (actionId === 'restore') {
    ipcRenderer.send('hide-overlay');
    ipcRenderer.send('action-restore');
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function copyText(text, btnId) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = '✓ Copied';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1800);
  });
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcRenderer.on('set-mode', (_, m) => {
  mode = m;
  inputText = ''; outputText = ''; toneOutput = '';
  isLoading = false; isToneLoading = false; activeAction = null;
  isRecording = false;
  render();
});

ipcRenderer.on('set-config', (_, cfg) => {
  if (cfg.languages && cfg.languages.length > 0) {
    configuredLangs = cfg.languages.filter(c => ALL_LANGUAGES[c]);
    if (configuredLangs.length > 0 && !configuredLangs.includes(selectedLang)) {
      selectedLang = configuredLangs[0];
    }
  }
  render();
});

render();
