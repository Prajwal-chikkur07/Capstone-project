const { ipcRenderer } = require('electron');

const API_BASE = 'http://127.0.0.1:8000/api';
const WIDGET_BASE = 'http://127.0.0.1:27182';

const ALL_LANGUAGES = {
  'hi-IN': 'Hindi',
  'bn-IN': 'Bengali',
  'ta-IN': 'Tamil',
  'te-IN': 'Telugu',
  'ml-IN': 'Malayalam',
  'mr-IN': 'Marathi',
  'gu-IN': 'Gujarati',
  'kn-IN': 'Kannada',
  'pa-IN': 'Punjabi',
  'or-IN': 'Odia',
};

let widgetConfig = { mode: 'englishToNative', languages: ['hi-IN'] };
let selectedLanguage = 'hi-IN';
let inputValue = '';
let outputValue = '';
let isTranslating = false;

const appRoot = document.getElementById('appRoot');
const tabEn = document.getElementById('tabEn');
const tabNative = document.getElementById('tabNative');
const closeBtn = document.getElementById('closeBtn');

function getLanguages() {
  const langs = (widgetConfig.languages || []).filter(c => ALL_LANGUAGES[c]);
  return langs.length > 0 ? langs : Object.keys(ALL_LANGUAGES);
}

function escapeHtml(v) {
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function updateTabs() {
  const isEn = widgetConfig.mode === 'englishToNative';
  tabEn.className = 'tab' + (isEn ? ' active-en' : '');
  tabNative.className = 'tab' + (!isEn ? ' active-native' : '');
}

function render() {
  const isEn = widgetConfig.mode === 'englishToNative';
  const langs = getLanguages();
  const isNativeMode = !isEn;

  const langLabel = isEn ? 'Translate to' : 'Translate from';
  const inputPlaceholder = isEn
    ? 'Type or paste English text…'
    : 'Type or paste native language text…';
  const btnLabel = isEn ? 'Translate to Native' : 'Translate to English';
  const outputTitle = isEn ? 'Native Translation' : 'English Translation';

  const hasOutput = outputValue && !isTranslating;

  appRoot.innerHTML = `
    <div class="lang-row">
      <span class="lang-label">${langLabel}</span>
      <select class="lang-select" id="langSelect">
        ${langs.map(c => `<option value="${c}" ${c === selectedLanguage ? 'selected' : ''}>${ALL_LANGUAGES[c]}</option>`).join('')}
      </select>
    </div>

    <div class="input-wrap">
      <div class="input-label">${isEn ? 'English Text' : 'Native Text'}</div>
      <textarea id="inputText" placeholder="${inputPlaceholder}" maxlength="2000">${escapeHtml(inputValue)}</textarea>
      <span class="char-count" id="charCount">${inputValue.length}/2000</span>
    </div>

    <button class="translate-btn ${isNativeMode ? 'native' : ''}" id="translateBtn" ${isTranslating ? 'disabled' : ''}>
      ${isTranslating
        ? `<div class="spinner"></div> Translating…`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg> ${btnLabel}`
      }
    </button>

    <div class="output-wrap ${hasOutput ? 'has-content' + (isNativeMode ? ' native-mode' : '') : ''}">
      <div class="output-header">
        <span class="output-title">${outputTitle}</span>
        ${hasOutput ? `<button class="copy-btn" id="copyBtn">Copy</button>` : ''}
      </div>
      <div class="output-text" id="outputText">
        ${hasOutput
          ? escapeHtml(outputValue)
          : `<span class="output-placeholder">Translation will appear here…</span>`
        }
      </div>
    </div>
  `;

  updateTabs();
  bindEvents();
}

function bindEvents() {
  const langSelect = document.getElementById('langSelect');
  const inputText = document.getElementById('inputText');
  const charCount = document.getElementById('charCount');
  const translateBtn = document.getElementById('translateBtn');
  const copyBtn = document.getElementById('copyBtn');

  if (langSelect) {
    langSelect.addEventListener('change', e => { selectedLanguage = e.target.value; });
  }

  if (inputText) {
    inputText.addEventListener('input', e => {
      inputValue = e.target.value;
      if (charCount) charCount.textContent = `${inputValue.length}/2000`;
    });
    inputText.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') translateBtn && translateBtn.click();
    });
    // focus on render
    setTimeout(() => inputText.focus(), 50);
  }

  if (translateBtn) {
    translateBtn.addEventListener('click', handleTranslate);
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(outputValue).then(() => {
        copyBtn.textContent = '✓ Copied';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.textContent = 'Copy';
          copyBtn.classList.remove('copied');
        }, 1800);
      });
    });
  }
}

async function handleTranslate() {
  const text = inputValue.trim();
  if (!text) return;

  isTranslating = true;
  outputValue = '';
  render();

  try {
    const isEn = widgetConfig.mode === 'englishToNative';
    const payload = {
      text,
      source_language: isEn ? 'en-IN' : selectedLanguage,
      target_language: isEn ? selectedLanguage : 'en-IN',
    };

    const res = await fetch(`${API_BASE}/translate-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    outputValue = data.translated_text || 'No output returned.';
  } catch {
    outputValue = '⚠ Translation failed. Make sure the backend is running.';
  } finally {
    isTranslating = false;
    render();
  }
}

async function persistConfig() {
  try {
    await fetch(`${WIDGET_BASE}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(widgetConfig),
    });
  } catch { /* ignore */ }
}

async function loadConfig() {
  try {
    const res = await fetch(`${WIDGET_BASE}/config`);
    if (res.ok) widgetConfig = { ...widgetConfig, ...(await res.json()) };
  } catch { /* use defaults */ }

  const langs = getLanguages();
  if (!langs.includes(selectedLanguage)) selectedLanguage = langs[0] || 'hi-IN';
  render();
}

// Tab clicks
tabEn.addEventListener('click', async () => {
  if (widgetConfig.mode === 'englishToNative') return;
  widgetConfig.mode = 'englishToNative';
  inputValue = ''; outputValue = ''; isTranslating = false;
  render();
  await persistConfig();
});

tabNative.addEventListener('click', async () => {
  if (widgetConfig.mode === 'nativeToEnglish') return;
  widgetConfig.mode = 'nativeToEnglish';
  inputValue = ''; outputValue = ''; isTranslating = false;
  render();
  await persistConfig();
});

closeBtn.addEventListener('click', () => ipcRenderer.send('hide-panel'));

ipcRenderer.on('widget-config', (_, cfg) => {
  widgetConfig = { ...widgetConfig, ...cfg };
  const langs = getLanguages();
  if (!langs.includes(selectedLanguage)) selectedLanguage = langs[0] || 'hi-IN';
  render();
});

loadConfig();
