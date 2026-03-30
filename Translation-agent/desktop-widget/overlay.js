const { ipcRenderer } = require('electron');
const API = 'http://127.0.0.1:8000/api';

const LANGS = {
  'hi-IN':'Hindi 🇮🇳','bn-IN':'Bengali','ta-IN':'Tamil','te-IN':'Telugu',
  'ml-IN':'Malayalam','mr-IN':'Marathi','gu-IN':'Gujarati',
  'kn-IN':'Kannada','pa-IN':'Punjabi','or-IN':'Odia',
};

const TONES = [
  { v:'',              l:'✨ Smart' },
  { v:'Email Formal',  l:'📧 Email' },
  { v:'Slack',         l:'🟣 Slack' },
  { v:'WhatsApp Business', l:'📱 WhatsApp' },
  { v:'LinkedIn',      l:'💼 LinkedIn' },
  { v:'custom',        l:'✏️ Custom' },
];

const DOMAIN_RULES = [
  { re:/mail\.google\.com/,           label:'Gmail',    icon:'✉️',  target:'gmail',    mode:'compose' },
  { re:/outlook\.(live|office)\.com/, label:'Outlook',  icon:'📧',  target:'outlook',  mode:'compose' },
  { re:/app\.slack\.com/,             label:'Slack',    icon:'🟣',  target:'slack',    mode:'compose' },
  { re:/web\.whatsapp\.com/,          label:'WhatsApp', icon:'📱',  target:'whatsapp', mode:'textbox' },
  { re:/www\.linkedin\.com/,          label:'LinkedIn', icon:'💼',  target:'linkedin', mode:'textbox' },
  { re:/twitter\.com|x\.com/,         label:'X',        icon:'🐦',  target:'twitter',  mode:'textbox' },
  { re:/teams\.microsoft\.com/,       label:'Teams',    icon:'🟣',  target:'teams',    mode:'textbox' },
  { re:/discord\.com/,                label:'Discord',  icon:'🎮',  target:'discord',  mode:'textbox' },
  { re:/notion\.so/,                  label:'Notion',   icon:'📝',  target:'notion',   mode:'textbox' },
  { re:/docs\.google\.com/,           label:'Docs',     icon:'📄',  target:'gdocs',    mode:'textbox' },
];

// ── State ─────────────────────────────────────────────────────────────────────
// state: 'idle' | 'rec' | 'proc' | 'ready' | 'error'
let state       = 'idle';
let lang        = 'hi-IN';
let cfgLangs    = Object.keys(LANGS);
let tone        = '';
let customTone  = '';
let rawText     = '';   // transcribed English
let tonedText   = '';   // after tone rewrite
let errorMsg    = '';
let domain      = null;
let recSec      = 0;
let recTimer    = null;
let mediaRec    = null;
let audioChunks = [];
let audioStream = null;
let waveInt     = null;

const root = document.getElementById('root');
function esc(v) { return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(s) { return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
function parseEmail(text) {
  const lines = text.trim().split('\n');
  let subject='', body=[], inBody=false;
  for (const l of lines) {
    if (!inBody && /^subject\s*:/i.test(l)) { subject=l.replace(/^subject\s*:\s*/i,'').trim(); }
    else if (subject && !inBody && l.trim()==='') { inBody=true; }
    else { body.push(l); }
  }
  if (!subject) { subject=lines[0]||''; body=lines.slice(1); }
  return { subject:subject.trim(), body:body.join('\n').trim() };
}

function langOpts() {
  const list = cfgLangs.filter(c=>LANGS[c]);
  return (list.length?list:Object.keys(LANGS))
    .map(c=>`<option value="${c}" ${c===lang?'selected':''}>${LANGS[c]}</option>`).join('');
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  const display   = tonedText || rawText;
  const hasRaw    = !!rawText;
  const isToned   = !!tonedText;
  const toneInfo  = TONES.find(t=>t.v===tone);
  const toneLabel = isToned ? (toneInfo?.l||'English').replace(/^.{2}/,'').trim() : 'English';

  const statusMap = {
    idle:  { cls:'',      dot:'', text:'Ready to speak' },
    rec:   { cls:'rec',   dot:'', text:'Listening…'     },
    proc:  { cls:'proc',  dot:'', text:'Processing…'    },
    ready: { cls:'ready', dot:'', text:'Done'           },
    error: { cls:'',      dot:'', text:'Error'          },
  };
  const st = statusMap[state] || statusMap.idle;

  let sendLabel = 'Send to Textbox';
  let sendClass = '';
  let domainBadge = '';
  if (domain) {
    sendLabel = `Send to ${domain.label}`;
    sendClass = 'green';
    domainBadge = `<div class="domain-badge">${domain.icon} ${domain.label}</div>`;
  }

  root.innerHTML = `
    <!-- Top bar -->
    <div class="topbar">
      <div class="topbar-left">
        <div class="app-icon ${state==='rec'?'rec':state==='proc'?'proc':''}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
          </svg>
        </div>
        <div class="status-pill ${st.cls}">
          <div class="dot"></div>
          ${st.text}
        </div>
        ${domainBadge}
      </div>
      <div class="topbar-right">
        <select class="sel" id="langSel">${langOpts()}</select>
        <button class="close-btn" id="closeBtn">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>

    <!-- Body -->
    <div class="body">

      <!-- Mic -->
      ${state === 'rec' ? `
        <div class="rec-bar">
          <div class="rec-dot"></div>
          <span class="rec-timer" id="recTimer">${fmt(recSec)}</span>
          <div class="wave-wrap">${Array(26).fill(0).map(()=>`<div class="wave-bar"></div>`).join('')}</div>
          <button class="stop-btn" id="micBtn">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
            Stop
          </button>
        </div>
      ` : `
        <div class="mic-section">
          <div class="mic-wrap">
            <div class="mic-ring"></div>
            <div class="mic-ring"></div>
            <button class="mic-btn ${state==='proc'?'proc':''}" id="micBtn" ${state==='proc'?'disabled':''}>
              ${state === 'proc' ? `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              ` : `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              `}
            </button>
          </div>
          <span class="mic-label ${state}">
            ${state==='idle'  ? `Tap to speak in ${(LANGS[lang]||'').replace(/\s🇮🇳/,'')}` :
              state==='proc'  ? 'Transcribing…' :
              state==='ready' ? '✓ Tap to record again' :
              state==='error' ? '⚠ Try again' : ''}
          </span>
        </div>
      `}

      <!-- Error -->
      ${errorMsg ? `<div class="error-msg"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>${esc(errorMsg)}</div>` : ''}

      <!-- Transcript -->
      ${state === 'proc' ? `
        <div class="transcript-box">
          <div class="tx-header"><span class="tx-label">English</span></div>
          <div class="shimmer">
            <div class="shimmer-line" style="width:85%"></div>
            <div class="shimmer-line" style="width:65%"></div>
            <div class="shimmer-line" style="width:75%"></div>
          </div>
        </div>
      ` : hasRaw ? `
        <div class="transcript-box">
          <div class="tx-header">
            <span class="tx-label ${isToned?'toned':''}">${esc(toneLabel)}</span>
            <div class="tx-actions">
              <button class="icon-btn" id="clearBtn" title="Clear">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <button class="icon-btn" id="copyBtn" title="Copy">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>
          </div>
          <textarea class="tx-area" id="txArea" rows="3">${esc(display)}</textarea>
        </div>
      ` : ''}

      <!-- Tone pills (only when we have text) -->
      ${hasRaw && state !== 'proc' ? `
        <div class="tone-row">
          ${TONES.map(t=>`
            <button class="tone-pill ${tone===t.v?'active':''}" data-tone="${esc(t.v)}">${esc(t.l)}</button>
          `).join('')}
        </div>
        ${tone === 'custom' ? `
          <div class="custom-row">
            <input class="custom-in" id="customIn" placeholder="Describe your tone…" value="${esc(customTone)}">
            <button class="apply-btn" id="applyBtn">Apply</button>
          </div>
        ` : ''}
      ` : ''}

      <!-- Send -->
      ${hasRaw && state !== 'proc' ? `
        <div class="action-row">
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

// ── Bind ──────────────────────────────────────────────────────────────────────
function bind() {
  document.getElementById('closeBtn')?.addEventListener('click', () => ipcRenderer.send('hide-overlay'));
  document.getElementById('langSel')?.addEventListener('change', e => { lang = e.target.value; render(); });

  document.getElementById('micBtn')?.addEventListener('click', () => {
    if (state === 'rec') stopRec();
    else if (state !== 'proc') startRec();
  });

  document.getElementById('txArea')?.addEventListener('input', e => {
    if (tonedText) tonedText = e.target.value;
    else rawText = e.target.value;
  });

  document.getElementById('copyBtn')?.addEventListener('click', () => {
    const text = tonedText || rawText;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('copyBtn');
      if (!btn) return;
      btn.classList.add('ok');
      setTimeout(() => btn.classList.remove('ok'), 1800);
    });
  });

  document.getElementById('clearBtn')?.addEventListener('click', () => {
    rawText=''; tonedText=''; tone=''; errorMsg=''; state='idle'; render();
  });

  document.querySelectorAll('[data-tone]').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.getAttribute('data-tone');
      tone = t;
      if (t === 'custom') { tonedText=''; render(); return; }
      if (rawText.trim()) applyTone(t);
      else render();
    });
  });

  document.getElementById('customIn')?.addEventListener('input', e => { customTone = e.target.value; });
  document.getElementById('applyBtn')?.addEventListener('click', () => applyTone('custom'));
  document.getElementById('sendBtn')?.addEventListener('click', handleSend);
}

// ── Send ──────────────────────────────────────────────────────────────────────
function handleSend() {
  const text = tonedText || rawText;
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
async function applyTone(t) {
  const text = rawText.trim();
  if (!text) return;
  state = 'proc'; tonedText = ''; render();
  try {
    let resolved = t;
    if (t === '') {
      const r = await fetch(`${API}/suggest-tone`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ text }),
      });
      const d = await r.json();
      resolved = d.suggested_tone || 'Email Formal';
      tone = resolved;
    }
    const override = t === 'custom' ? customTone : null;
    const r = await fetch(`${API}/rewrite-tone`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ text, tone: resolved, user_override: override }),
    });
    const d = await r.json();
    tonedText = d.rewritten_text || text;
    state = 'ready';
  } catch (e) {
    errorMsg = e.message || 'Backend not reachable.';
    state = 'ready';
  }
  render();
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
    state = 'rec'; recSec = 0; errorMsg = '';
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
  state = 'proc'; render();
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
        const v = data[Math.floor((i/26)*data.length)]||0;
        b.style.height = Math.max(3, Math.round((v/255)*20))+'px';
      });
    }, 60);
  } catch {}
}

function stopWave() { if (waveInt) { clearInterval(waveInt); waveInt = null; } }

async function processAudio() {
  try {
    const blob = new Blob(audioChunks, { type:'audio/webm' });
    if (blob.size === 0) { errorMsg='No audio recorded.'; state='error'; render(); return; }
    const fd = new FormData();
    fd.append('file', blob, 'recording.webm');
    const r = await fetch(`${API}/translate-audio`, { method:'POST', body:fd });
    if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.detail||`HTTP ${r.status}`); }
    const d = await r.json();
    rawText = d.transcript || '';
    if (!rawText) { errorMsg='No speech detected. Try again.'; state='error'; render(); return; }
    tonedText = ''; state = 'ready';
    detectDomain();
    render();
    // Auto-apply tone if one was pre-selected
    if (tone && tone !== 'custom') applyTone(tone);
  } catch (e) {
    errorMsg = e.message || 'Backend not reachable.';
    state = 'error'; render();
  }
}

// ── Domain detection ──────────────────────────────────────────────────────────
function detectDomain() { ipcRenderer.send('get-active-url'); }

ipcRenderer.on('active-url', (_, url) => {
  domain = null;
  if (url) { for (const rule of DOMAIN_RULES) { if (rule.re.test(url)) { domain = rule; break; } } }
  render();
});

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcRenderer.on('set-mode', () => {
  state='idle'; rawText=''; tonedText=''; tone=''; errorMsg=''; domain=null;
  render(); detectDomain();
});

ipcRenderer.on('set-config', (_, cfg) => {
  if (cfg.languages?.length > 0) {
    cfgLangs = cfg.languages.filter(c=>LANGS[c]);
    if (cfgLangs.length > 0 && !cfgLangs.includes(lang)) lang = cfgLangs[0];
  }
  render();
});

render();
detectDomain();
