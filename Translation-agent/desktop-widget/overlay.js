const { ipcRenderer } = require('electron');
const API = 'http://127.0.0.1:8000/api';

const LANGS = {
  'hi-IN':'Hindi','bn-IN':'Bengali','ta-IN':'Tamil','te-IN':'Telugu',
  'ml-IN':'Malayalam','mr-IN':'Marathi','gu-IN':'Gujarati',
  'kn-IN':'Kannada','pa-IN':'Punjabi','or-IN':'Odia',
};

const TONES = [
  { value: '',                label: '✨ Smart Suggest' },
  { value: 'Email Formal',   label: '📧 Email Formal'  },
  { value: 'Email Casual',   label: '💬 Email Casual'  },
  { value: 'Slack',          label: '🟣 Slack'          },
  { value: 'LinkedIn',       label: '💼 LinkedIn'       },
  { value: 'WhatsApp Business', label: '📱 WhatsApp'   },
  { value: 'custom',         label: '✏️ Custom…'        },
];

const DOMAIN_RULES = [
  { re: /mail\.google\.com/,                    label: 'Gmail',    icon: '✉️',  target: 'gmail',    mode: 'compose' },
  { re: /outlook\.(live|office)\.com/,          label: 'Outlook',  icon: '📧',  target: 'outlook',  mode: 'compose' },
  { re: /app\.slack\.com/,                      label: 'Slack',    icon: '🟣',  target: 'slack',    mode: 'compose' },
  { re: /web\.whatsapp\.com/,                   label: 'WhatsApp', icon: '📱',  target: 'whatsapp', mode: 'textbox' },
  { re: /www\.linkedin\.com/,                   label: 'LinkedIn', icon: '💼',  target: 'linkedin', mode: 'textbox' },
  { re: /twitter\.com|x\.com/,                  label: 'X',        icon: '🐦',  target: 'twitter',  mode: 'textbox' },
  { re: /teams\.microsoft\.com/,                label: 'Teams',    icon: '🟣',  target: 'teams',    mode: 'textbox' },
  { re: /discord\.com/,                         label: 'Discord',  icon: '🎮',  target: 'discord',  mode: 'textbox' },
  { re: /notion\.so/,                           label: 'Notion',   icon: '📝',  target: 'notion',   mode: 'textbox' },
  { re: /docs\.google\.com/,                    label: 'Docs',     icon: '📄',  target: 'gdocs',    mode: 'textbox' },
];

// ── State ─────────────────────────────────────────────────────────────────────
let lang         = 'hi-IN';
let configLangs  = Object.keys(LANGS);
let selectedTone = '';       // '' = smart suggest
let customTone   = '';
let outputText   = '';
let toneOutput   = '';
let isLoading    = false;
let isToneLoad   = false;
let isRec        = false;
let recSec       = 0;
let recTimer     = null;
let mediaRec     = null;
let audioChunks  = [];
let audioStream  = null;
let waveInt      = null;
let domain       = null;

const root = document.getElementById('root');

function esc(v) { return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(s) { return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }

function parseEmail(text) {
  const lines = text.trim().split('\n');
  let subject = '', body = [], inBody = false;
  for (const l of lines) {
    if (!inBody && /^subject\s*:/i.test(l)) { subject = l.replace(/^subject\s*:\s*/i,'').trim(); }
    else if (subject && !inBody && l.trim() === '') { inBody = true; }
    else { body.push(l); }
  }
  if (!subject) { subject = lines[0]||''; body = lines.slice(1); }
  return { subject: subject.trim(), body: body.join('\n').trim() };
}

function langOpts() {
  const list = configLangs.filter(c => LANGS[c]);
  return (list.length ? list : Object.keys(LANGS))
    .map(c => `<option value="${c}" ${c===lang?'selected':''}>${LANGS[c]}</option>`).join('');
}

function toneOpts() {
  return TONES.map(t =>
    `<option value="${esc(t.value)}" ${t.value===selectedTone?'selected':''}>${esc(t.label)}</option>`
  ).join('');
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  const display  = toneOutput || outputText;
  const hasOut   = !!outputText;
  const toneInfo = TONES.find(t => t.value === selectedTone);
  const toneLabel = toneInfo ? toneInfo.label.replace(/^.{2}/,'').trim() : 'English';
  const isToned  = !!toneOutput;

  let sendLabel = 'Send to Textbox';
  let sendClass = '';
  let domainBadge = '';
  if (domain) {
    sendLabel = `Send to ${domain.label}`;
    sendClass = 'green';
    domainBadge = `<div class="domain-badge">${domain.icon} ${domain.label} detected</div>`;
  }

  root.innerHTML = `
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <div class="logo-dot ${isRec?'rec':''}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
          </svg>
        </div>
        <div>
          <div class="header-title">SeedlingSpeaks</div>
          <div class="header-sub">${isRec ? '● Recording…' : 'Native → English'}</div>
        </div>
      </div>
      <div class="sel-row header-right">
        <select class="pill" id="langSel">${langOpts()}</select>
        <select class="pill" id="toneSel" style="max-width:130px;">${toneOpts()}</select>
        <button class="close-btn" id="closeBtn">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>

    <!-- Body -->
    <div class="body">

      <!-- Mic -->
      ${isRec ? `
        <div class="rec-bar">
          <div class="rec-dot"></div>
          <span class="rec-timer" id="recTimer">${fmt(recSec)}</span>
          <div class="wave-wrap">${Array(28).fill(0).map(()=>`<div class="wave-bar"></div>`).join('')}</div>
          <button class="stop-btn" id="micBtn">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
            Stop
          </button>
        </div>
      ` : `
        <div class="mic-area">
          <button class="mic-btn" id="micBtn">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>
          <span class="mic-label">Tap to speak in ${LANGS[lang]||'native language'}</span>
        </div>
      `}

      <!-- Output -->
      <div class="output-box">
        <div class="output-top">
          <span class="output-tag ${isToned?'toned':''}">${esc(isToned ? toneLabel : 'English')}</span>
          ${display ? `<button class="copy-btn" id="copyBtn">Copy</button>` : ''}
        </div>
        ${isLoading || isToneLoad ? `
          <div class="loading-row">
            <div class="spinner"></div>
            ${isLoading ? 'Transcribing…' : 'Rewriting…'}
          </div>
        ` : display ? `
          <textarea class="out-ta" id="outTa">${esc(display)}</textarea>
        ` : `
          <div class="out-placeholder">Translation appears here…</div>
        `}
      </div>

      <!-- Custom tone input -->
      ${selectedTone === 'custom' ? `
        <div class="custom-row">
          <input class="custom-in" id="customIn" placeholder="Describe your tone…" value="${esc(customTone)}">
          ${hasOut ? `<button class="apply-btn" id="applyBtn">Apply</button>` : ''}
        </div>
      ` : ''}

      <!-- Domain + Send -->
      ${display ? `
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${domainBadge}
          <button class="send-btn ${sendClass}" id="sendBtn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            ${sendLabel}
          </button>
        </div>
      ` : ''}

    </div>
  `;

  bind();
}

// ── Bind events ───────────────────────────────────────────────────────────────
function bind() {
  document.getElementById('closeBtn')?.addEventListener('click', () => ipcRenderer.send('hide-overlay'));

  document.getElementById('langSel')?.addEventListener('change', e => { lang = e.target.value; render(); });

  document.getElementById('toneSel')?.addEventListener('change', e => {
    selectedTone = e.target.value;
    if (selectedTone === 'custom') { toneOutput = ''; render(); return; }
    if (outputText.trim()) handleTone(selectedTone);
    else render();
  });

  document.getElementById('micBtn')?.addEventListener('click', () => {
    if (isRec) stopRec(); else startRec();
  });

  document.getElementById('outTa')?.addEventListener('input', e => {
    if (toneOutput) toneOutput = e.target.value;
    else outputText = e.target.value;
  });

  document.getElementById('copyBtn')?.addEventListener('click', () => {
    const text = toneOutput || outputText;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('copyBtn');
      if (!btn) return;
      btn.textContent = '✓ Copied'; btn.classList.add('ok');
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('ok'); }, 1800);
    });
  });

  document.getElementById('customIn')?.addEventListener('input', e => { customTone = e.target.value; });
  document.getElementById('applyBtn')?.addEventListener('click', () => handleTone('custom'));

  document.getElementById('sendBtn')?.addEventListener('click', handleSend);
}

// ── Send ──────────────────────────────────────────────────────────────────────
function handleSend() {
  const text = toneOutput || outputText;
  if (!text) return;
  if (!domain) { ipcRenderer.send('send-to-textbox', { text }); return; }
  if (domain.mode === 'compose') {
    const { subject, body } = parseEmail(text);
    ipcRenderer.send('send-to-compose', { subject, body, target: domain.target });
  } else {
    ipcRenderer.send('send-to-active-textbox', { text, target: domain.target });
  }
}

// ── Tone ──────────────────────────────────────────────────────────────────────
async function handleTone(tone) {
  const text = outputText.trim();
  if (!text) return;
  isToneLoad = true; toneOutput = ''; render();
  try {
    let resolved = tone;
    if (tone === '' || tone === 'smart') {
      const r = await fetch(`${API}/suggest-tone`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ text }),
      });
      const d = await r.json();
      resolved = d.suggested_tone || 'Email Formal';
      selectedTone = resolved;
    }
    const override = tone === 'custom' ? customTone : null;
    const r = await fetch(`${API}/rewrite-tone`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ text, tone: resolved, user_override: override }),
    });
    const d = await r.json();
    toneOutput = d.rewritten_text || text;
  } catch (e) {
    toneOutput = `⚠ ${e.message || 'Backend not reachable.'}`;
  }
  isToneLoad = false; render();
}

// ── Recording ─────────────────────────────────────────────────────────────────
async function startRec() {
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    mediaRec = new MediaRecorder(audioStream, { mimeType: mime });
    mediaRec.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRec.onstop = async () => {
      audioStream.getTracks().forEach(t => t.stop());
      audioStream = null;
      stopWave();
      await processAudio();
    };
    mediaRec.start();
    isRec = true; recSec = 0;
    recTimer = setInterval(() => {
      recSec++;
      const el = document.getElementById('recTimer');
      if (el) el.textContent = fmt(recSec);
    }, 1000);
    startWave(audioStream);
    render();
  } catch {
    ipcRenderer.send('show-toast', { type:'error', message:'⚠ Microphone access denied.' });
  }
}

function stopRec() {
  if (recTimer) { clearInterval(recTimer); recTimer = null; }
  if (mediaRec?.state !== 'inactive') mediaRec.stop();
  isRec = false; isLoading = true; render();
}

function startWave(stream) {
  try {
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser(); an.fftSize = 64;
    src.connect(an);
    const data = new Uint8Array(an.frequencyBinCount);
    waveInt = setInterval(() => {
      an.getByteFrequencyData(data);
      document.querySelectorAll('.wave-bar').forEach((b, i) => {
        const v = data[Math.floor((i/28)*data.length)]||0;
        b.style.height = Math.max(3, Math.round((v/255)*22))+'px';
      });
    }, 60);
  } catch {}
}

function stopWave() { if (waveInt) { clearInterval(waveInt); waveInt = null; } }

async function processAudio() {
  try {
    const blob = new Blob(audioChunks, { type:'audio/webm' });
    if (blob.size === 0) { outputText = '⚠ No audio recorded.'; isLoading = false; render(); return; }
    const fd = new FormData();
    fd.append('file', blob, 'recording.webm');
    const r = await fetch(`${API}/translate-audio`, { method:'POST', body:fd });
    if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.detail||`HTTP ${r.status}`); }
    const d = await r.json();
    outputText = d.transcript || '⚠ Could not transcribe. Speak clearly and try again.';
  } catch (e) {
    outputText = `⚠ ${e.message||'Backend not reachable.'}`;
  }
  isLoading = false; toneOutput = ''; selectedTone = '';
  // Auto-apply smart suggest if tone was pre-selected
  detectDomain();
  render();
  // If a tone was already selected, auto-apply it
  if (selectedTone && selectedTone !== 'custom' && outputText && !outputText.startsWith('⚠')) {
    handleTone(selectedTone);
  }
}

// ── Domain detection ──────────────────────────────────────────────────────────
function detectDomain() {
  ipcRenderer.send('get-active-url');
}

ipcRenderer.on('active-url', (_, url) => {
  domain = null;
  if (url) {
    for (const rule of DOMAIN_RULES) {
      if (rule.re.test(url)) { domain = rule; break; }
    }
  }
  render();
});

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcRenderer.on('set-mode', () => {
  outputText = ''; toneOutput = ''; isLoading = false; isToneLoad = false;
  isRec = false; selectedTone = ''; domain = null;
  render(); detectDomain();
});

ipcRenderer.on('set-config', (_, cfg) => {
  if (cfg.languages?.length > 0) {
    configLangs = cfg.languages.filter(c => LANGS[c]);
    if (configLangs.length > 0 && !configLangs.includes(lang)) lang = configLangs[0];
  }
  render();
});

render();
detectDomain();
