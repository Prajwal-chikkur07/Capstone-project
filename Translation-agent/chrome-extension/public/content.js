// Content script for Voice Translation Extension — Full Featured
// API calls go through background.js proxy to bypass CSP restrictions.

let isActive = false;
let selectionPopup = null;
let floatingIcon = null;
let popupPanel = null;
let targetLanguage = 'kn-IN';
let selectedTone = 'Email Formal';
let customTone = '';
let panelActiveTab = 'page';
let expandedSections = { record: false, tone: false, translate: false };
let smartSelectActive = false;
let highlightedEl = null;
let stopTranslationFlag = false;

// Recording state
let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;
let isRecording = false;
let recordingMode = 'pushToTalk';
let isPTTPressed = false;

// Text state
let englishText = '';
let rewrittenText = '';
let nativeText = '';
let inputText = '';

// Audio playback
let currentAudio = null;
let playingType = null;
let loadingMessage = null;

const TONES = ['Email Formal', 'Email Casual', 'Slack', 'LinkedIn', 'WhatsApp Business', 'User Override'];
const TARGET_LANGUAGES = {
  Hindi: 'hi-IN', Bengali: 'bn-IN', Tamil: 'ta-IN', Telugu: 'te-IN',
  Malayalam: 'ml-IN', Marathi: 'mr-IN', Gujarati: 'gu-IN',
  Kannada: 'kn-IN', Punjabi: 'pa-IN', Odia: 'or-IN',
};

// ========== INIT ==========
createFloatingIcon();

chrome.storage.local.get(['vtActive', 'vtLanguage', 'vtTone', 'vtIconPos'], (result) => {
  targetLanguage = result.vtLanguage || 'kn-IN';
  selectedTone = result.vtTone || 'Email Formal';
  if (result.vtIconPos && floatingIcon) {
    floatingIcon.style.left = result.vtIconPos.x + 'px';
    floatingIcon.style.top = result.vtIconPos.y + 'px';
    floatingIcon.style.right = 'auto';
    floatingIcon.style.bottom = 'auto';
  }
  if (result.vtActive) activateMode();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SELECTION') { sendResponse({ text: getSmartSelection() }); return; }
  if (message.type === 'SHOW_NOTIFICATION') { showToast(message.message); return; }
  if (message.type === 'INSERT_TEXT') { sendResponse(insertTextIntoActive(message.text)); return; }
  if (message.type === 'TOGGLE_ACTIVE') {
    if (message.active) activateMode(); else deactivateMode();
    sendResponse({ active: isActive }); return;
  }
  if (message.type === 'UPDATE_SETTINGS') {
    if (message.language) targetLanguage = message.language;
    if (message.tone) selectedTone = message.tone; return;
  }
  if (message.type === 'TRANSLATE_ALL_PAGE') { translateAllVisibleText(); sendResponse({ started: true }); return; }
  if (message.type === 'TRANSLATE_SELECTION_FROM_POPUP') {
    const text = getSmartSelection();
    if (text) { translateAndShowInline(text, window.getSelection().getRangeAt(0)); }
    else { showToast('No text selected.'); }
    sendResponse({ started: true }); return;
  }
  if (message.type === 'STOP_TRANSLATION') {
    stopTranslationFlag = true; removeAllTranslationOverlays(); sendResponse({ done: true }); return;
  }
});

// ========== FLOATING ICON ==========
function createFloatingIcon() {
  if (floatingIcon) return;
  if (!document.body) { document.addEventListener('DOMContentLoaded', createFloatingIcon); return; }
  const iconURL = chrome.runtime.getURL('icons/icon48.png');
  floatingIcon = document.createElement('div');
  floatingIcon.id = 'vt-floating-icon';
  floatingIcon.innerHTML = `<img src="${iconURL}" width="28" height="28" style="border-radius:6px;pointer-events:none;" />`;
  document.body.appendChild(floatingIcon);

  let isDragging = false, hasMoved = false, dragStartX, dragStartY, iconStartX, iconStartY;
  floatingIcon.addEventListener('mousedown', (e) => {
    isDragging = true; hasMoved = false; dragStartX = e.clientX; dragStartY = e.clientY;
    const rect = floatingIcon.getBoundingClientRect(); iconStartX = rect.left; iconStartY = rect.top;
    floatingIcon.style.transition = 'none'; e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX, dy = e.clientY - dragStartY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
    floatingIcon.style.left = Math.max(0, Math.min(window.innerWidth - 48, iconStartX + dx)) + 'px';
    floatingIcon.style.top = Math.max(0, Math.min(window.innerHeight - 48, iconStartY + dy)) + 'px';
    floatingIcon.style.right = 'auto'; floatingIcon.style.bottom = 'auto';
  });
  document.addEventListener('mouseup', () => {
    if (!isDragging) return; isDragging = false; floatingIcon.style.transition = '';
    const rect = floatingIcon.getBoundingClientRect();
    chrome.storage.local.set({ vtIconPos: { x: rect.left, y: rect.top } });
  });
  floatingIcon.addEventListener('click', () => { if (!hasMoved) togglePopupPanel(); });
  updateIconState();
}

function updateIconState() {
  if (!floatingIcon) return;
  floatingIcon.title = 'Click to open Voice Translation';
  floatingIcon.classList.toggle('vt-icon-active', isActive);
}

// ========== PANEL ==========
function togglePopupPanel() {
  if (popupPanel) { popupPanel.remove(); popupPanel = null; return; }
  buildPanel();
}

function buildPanel() {
  popupPanel = document.createElement('div');
  popupPanel.id = 'vt-popup-panel';

  const iconRect = floatingIcon.getBoundingClientRect();
  const spaceBottom = window.innerHeight - iconRect.bottom;
  const spaceRight = window.innerWidth - iconRect.right;

  if (spaceBottom > 540) popupPanel.style.top = (iconRect.bottom + 10) + 'px';
  else popupPanel.style.bottom = (window.innerHeight - iconRect.top + 10) + 'px';
  if (spaceRight > 370) popupPanel.style.left = Math.max(8, iconRect.left) + 'px';
  else popupPanel.style.right = '16px';

  popupPanel.style.opacity = '0';
  popupPanel.style.transform = 'scale(0.95)';
  popupPanel.style.transition = 'opacity 0.2s ease, transform 0.2s ease';

  renderPanel();
  document.body.appendChild(popupPanel);
  requestAnimationFrame(() => { popupPanel.style.opacity = '1'; popupPanel.style.transform = 'scale(1)'; });
}

function renderPanel() {
  if (!popupPanel) return;

  const tabs = [
    { id: 'page', label: 'Page', icon: '🖱' },
    { id: 'tools', label: 'Tools', icon: '🛠' },
  ];

  popupPanel.innerHTML = `
    <div id="vt-panel-header">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#3b82f6,#9333ea);display:flex;align-items:center;justify-content:center;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
        </div>
        <span style="font-size:13px;font-weight:700;color:white;">Voice Translation</span>
      </div>
      <div style="display:flex;align-items:center;gap:4px;">
        <button id="vt-panel-clear" style="background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:14px;padding:4px 6px;border-radius:6px;line-height:1;" title="Clear all">🗑</button>
        <button id="vt-panel-close" style="background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:16px;padding:4px 6px;border-radius:6px;line-height:1;">&times;</button>
      </div>
    </div>
    <div id="vt-tabs-bar">
      ${tabs.map(t => `<div class="vt-tab ${panelActiveTab === t.id ? 'active' : ''}" data-tab="${t.id}"><span class="tab-icon">${t.icon}</span><span>${t.label}</span></div>`).join('')}
    </div>
    <div id="vt-tab-content">${panelActiveTab === 'page' ? renderPageTab() : renderToolsTab()}</div>
    <div id="vt-loading-overlay" style="display:${loadingMessage ? 'flex' : 'none'};">
      <div style="background:rgba(30,41,59,0.95);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px 20px;display:flex;align-items:center;gap:10px;">
        <span class="vt-spinner"></span>
        <span id="vt-loading-text" style="font-size:12px;color:rgba(255,255,255,0.8);">${loadingMessage || ''}</span>
      </div>
    </div>
  `;

  // Wire events
  popupPanel.querySelector('#vt-panel-close').onclick = () => { popupPanel.remove(); popupPanel = null; };
  popupPanel.querySelector('#vt-panel-clear').onclick = () => {
    englishText = ''; rewrittenText = ''; nativeText = ''; inputText = ''; playingType = null;
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    renderPanel();
  };
  popupPanel.querySelectorAll('.vt-tab').forEach(btn => {
    btn.onclick = () => { panelActiveTab = btn.dataset.tab; renderPanel(); };
  });
  wireTabEvents();
}

function renderToolsTab() {
  return `
    ${sectionHeader('record', '🎙 Voice Record', expandedSections.record)}
    ${expandedSections.record ? `<div style="padding:8px 0;">${renderRecordSection()}</div>` : ''}
    ${sectionHeader('tone', '✨ Tone Rewrite', expandedSections.tone)}
    ${expandedSections.tone ? `<div style="padding:8px 0;">${renderToneSection()}</div>` : ''}
    ${sectionHeader('translate', '🌐 Translate Text', expandedSections.translate)}
    ${expandedSections.translate ? `<div style="padding:8px 0;">${renderTranslateSection()}</div>` : ''}
  `;
}

function sectionHeader(id, title, expanded) {
  return `<button class="vt-section-toggle" data-section="${id}" style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:8px 10px;margin-top:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:white;font-size:12px;font-weight:600;cursor:pointer;text-align:left;">
    <span>${title}</span>
    <span style="font-size:10px;color:rgba(255,255,255,0.4);">${expanded ? '▲' : '▼'}</span>
  </button>`;
}

// ========== PAGE TAB ==========
function renderPageTab() {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;margin-bottom:10px;">
      <div>
        <div style="font-size:12px;font-weight:600;color:white;">Page Translation</div>
        <div id="vt-panel-status" style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:2px;">${isActive ? 'Active' : 'Inactive'}</div>
      </div>
      <button id="vt-panel-toggle" style="width:44px;height:24px;border-radius:12px;border:none;cursor:pointer;position:relative;transition:background 0.3s;${isActive ? 'background:linear-gradient(90deg,#10b981,#059669);' : 'background:rgba(255,255,255,0.1);'}">
        <div style="width:20px;height:20px;border-radius:10px;background:white;position:absolute;top:2px;transition:left 0.3s;${isActive ? 'left:22px;' : 'left:2px;'}"></div>
      </button>
    </div>
    <div style="margin-bottom:10px;">
      <div style="font-size:10px;font-weight:500;color:rgba(255,255,255,0.4);margin-bottom:4px;">Target Language</div>
      <select id="vt-panel-lang" style="width:100%;padding:7px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:white;font-size:12px;outline:none;cursor:pointer;">
        ${Object.entries(TARGET_LANGUAGES).map(([n, c]) => `<option value="${c}" ${c === targetLanguage ? 'selected' : ''} style="background:#1e293b;">${n}</option>`).join('')}
      </select>
    </div>
    ${actionBtn('vt-btn-all', 'Translate Entire Page', 'All visible text', '59,130,246', pageIcon)}
    ${actionBtn('vt-btn-sel', 'Translate Selection', 'Select text first', '147,51,234', selIcon)}
    ${actionBtn('vt-btn-click', smartSelectActive ? 'Click Mode ON' : 'Click to Translate', 'Click any text', '16,185,129', clickIcon)}
    ${actionBtn('vt-btn-stop', 'Stop / Restore', 'Restore original text', '239,68,68', stopIcon)}
  `;
}

const pageIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`;
const selIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 9 5 12"/><path d="m14 9-5 12"/><path d="M3 15h18"/></svg>`;
const clickIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 15l-2 5L9 9l11 4-5 2z"/></svg>`;
const stopIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;

function actionBtn(id, title, sub, rgb, icon) {
  return `<button id="${id}" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;background:rgba(${rgb},0.1);border:1px solid rgba(${rgb},0.2);border-radius:10px;color:rgba(${rgb},0.9);font-size:11px;font-weight:600;cursor:pointer;text-align:left;margin-bottom:6px;">
    <div style="width:28px;height:28px;border-radius:7px;background:rgba(${rgb},0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">${icon}</div>
    <div><div>${title}</div><div style="font-size:9px;font-weight:400;opacity:0.6;margin-top:1px;">${sub}</div></div>
  </button>`;
}

// ========== RECORD SECTION ==========
function renderRecordSection() {
  const modes = [
    { v: 'pushToTalk', l: 'PTT', i: '🎤' },
    { v: 'continuous', l: 'Listen', i: '👂' },
    { v: 'fileUpload', l: 'Upload', i: '📁' },
  ];
  let recUI = '';
  if (recordingMode === 'pushToTalk') {
    recUI = `<button id="vt-ptt-btn" style="width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;${isPTTPressed ? 'background:#ef4444;' : 'background:linear-gradient(135deg,#3b82f6,#9333ea);'}">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
    </button><p style="font-size:10px;color:${isPTTPressed ? '#f87171' : 'rgba(255,255,255,0.4)'};">${isPTTPressed ? 'Recording...' : 'Hold to record'}</p>`;
  } else if (recordingMode === 'continuous') {
    recUI = `<button id="vt-cont-btn" style="width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;${isRecording ? 'background:#ef4444;' : 'background:linear-gradient(135deg,#10b981,#059669);'}">
      ${isRecording ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12"/></svg>' : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>'}
    </button><p style="font-size:10px;color:${isRecording ? '#34d399' : 'rgba(255,255,255,0.4)'};">${isRecording ? 'Listening... tap to stop' : 'Tap to listen'}</p>`;
  } else {
    recUI = `<label style="cursor:pointer;display:flex;align-items:center;gap:6px;padding:10px 18px;background:linear-gradient(135deg,#9333ea,#ec4899);border-radius:10px;color:white;font-size:12px;font-weight:600;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
      Select Audio File<input type="file" id="vt-file-input" accept=".mp3,.wav,.m4a,.webm,.ogg,.flac" style="display:none;" />
    </label><p style="font-size:9px;color:rgba(255,255,255,0.3);">MP3, WAV, M4A, WebM, OGG, FLAC</p>`;
  }

  return `
    <div style="display:flex;gap:4px;margin-bottom:10px;">
      ${modes.map(m => `<button class="vt-mode-btn" data-mode="${m.v}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:4px;padding:6px;border-radius:8px;font-size:10px;font-weight:500;cursor:pointer;border:1px solid ${recordingMode === m.v ? 'rgba(59,130,246,0.3)' : 'transparent'};background:${recordingMode === m.v ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)'};color:${recordingMode === m.v ? '#60a5fa' : 'rgba(255,255,255,0.5)'};">${m.i} ${m.l}</button>`).join('')}
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 0;">${recUI}</div>
    ${outputBox('Translated English:', englishText, 'en', 'english')}
    ${outputBox('Styled Text:', rewrittenText, 'en', 'rewritten')}
    ${rewrittenText ? shareButtons() : ''}
  `;
}

// ========== TONE SECTION ==========
function renderToneSection() {
  return `
    <div style="margin-bottom:10px;">
      <select id="vt-tone-sel" style="width:100%;padding:7px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:white;font-size:12px;outline:none;cursor:pointer;">
        ${TONES.map(t => `<option value="${t}" ${t === selectedTone ? 'selected' : ''} style="background:#1e293b;">${t}</option>`).join('')}
      </select>
    </div>
    ${selectedTone === 'User Override' ? `<div style="margin-bottom:10px;display:flex;gap:6px;">
      <input type="text" id="vt-custom-tone" value="${esc(customTone)}" placeholder="e.g. Formal with bullet points" style="flex:1;padding:7px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:white;font-size:11px;outline:none;" />
      <button id="vt-apply-custom" style="padding:7px 12px;background:linear-gradient(135deg,#3b82f6,#9333ea);border:none;border-radius:8px;color:white;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;">Apply</button>
    </div>` : ''}
    <textarea id="vt-tone-input" placeholder="Paste or type English text..." rows="3" style="width:100%;padding:8px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:white;font-size:12px;outline:none;resize:none;box-sizing:border-box;margin-bottom:8px;">${escapeHtml(inputText)}</textarea>
    ${englishText && !rewrittenText ? `<button id="vt-apply-tone" style="width:100%;padding:8px;background:linear-gradient(135deg,#3b82f6,#9333ea);border:none;border-radius:8px;color:white;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:8px;">✨ Apply Tone</button>` : ''}
    ${outputBox('Styled Text:', rewrittenText, 'en', 'rewritten')}
  `;
}

// ========== TRANSLATE SECTION ==========
function renderTranslateSection() {
  return `
    <div style="margin-bottom:10px;">
      <select id="vt-trans-lang" style="width:100%;padding:7px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:white;font-size:12px;outline:none;cursor:pointer;">
        ${Object.entries(TARGET_LANGUAGES).map(([n, c]) => `<option value="${c}" ${c === targetLanguage ? 'selected' : ''} style="background:#1e293b;">${n}</option>`).join('')}
      </select>
    </div>
    <textarea id="vt-trans-input" placeholder="Type or paste English text..." rows="3" style="width:100%;padding:8px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:white;font-size:12px;outline:none;resize:none;box-sizing:border-box;margin-bottom:8px;">${escapeHtml(inputText)}</textarea>
    <button id="vt-trans-btn" style="width:100%;padding:8px;background:linear-gradient(135deg,#3b82f6,#9333ea);border:none;border-radius:8px;color:white;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:8px;">🌐 Translate to Native</button>
    ${outputBox('Native Translation:', nativeText, targetLanguage, 'native')}
  `;
}

// ========== OUTPUT BOX ==========
function outputBox(label, content, lang, type) {
  if (!content) return '';
  const isP = playingType === type;
  return `<div style="margin-bottom:8px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
      <span style="font-size:10px;font-weight:500;color:rgba(255,255,255,0.4);">${label}</span>
      <div style="display:flex;align-items:center;gap:2px;">
        <button class="vt-act" data-a="copy" data-t="${esc(content)}" style="background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;padding:3px 5px;border-radius:4px;font-size:12px;line-height:1;" title="Copy">📋</button>
        <button class="vt-act" data-a="insert" data-t="${esc(content)}" style="background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;padding:3px 5px;border-radius:4px;font-size:12px;line-height:1;" title="Insert">📌</button>
        ${lang ? `<button class="vt-act" data-a="tts" data-t="${esc(content)}" data-l="${lang}" data-type="${type}" style="background:none;border:none;color:${isP ? '#f87171' : '#60a5fa'};cursor:pointer;padding:3px 5px;border-radius:4px;font-size:12px;line-height:1;" title="${isP ? 'Stop' : 'Listen'}">${isP ? '⏹' : '🔊'}</button>` : ''}
      </div>
    </div>
    <div style="padding:8px 10px;border-radius:8px;background:rgba(59,130,246,0.05);border:1px solid rgba(59,130,246,0.1);">
      <p style="font-size:12px;line-height:1.5;color:rgba(255,255,255,0.85);white-space:pre-wrap;margin:0;word-break:break-word;">${escapeHtml(content)}</p>
    </div>
  </div>`;
}

function shareButtons() {
  return `<div style="display:flex;gap:6px;justify-content:center;margin:4px 0 8px;">
    <button class="vt-share" data-s="email" style="display:flex;align-items:center;gap:4px;padding:5px 10px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#fca5a5;font-size:10px;cursor:pointer;">📧 Email</button>
    <button class="vt-share" data-s="slack" style="display:flex;align-items:center;gap:4px;padding:5px 10px;border-radius:8px;background:rgba(147,51,234,0.1);border:1px solid rgba(147,51,234,0.2);color:#c4b5fd;font-size:10px;cursor:pointer;">💬 Slack</button>
    <button class="vt-share" data-s="linkedin" style="display:flex;align-items:center;gap:4px;padding:5px 10px;border-radius:8px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);color:#93c5fd;font-size:10px;cursor:pointer;">💼 LinkedIn</button>
  </div>`;
}

// ========== WIRE EVENTS ==========
function wireTabEvents() {
  if (!popupPanel) return;
  const c = popupPanel.querySelector('#vt-tab-content');
  if (!c) return;

  // Section toggles
  c.querySelectorAll('.vt-section-toggle').forEach(btn => {
    btn.onclick = () => { expandedSections[btn.dataset.section] = !expandedSections[btn.dataset.section]; renderPanel(); };
  });

  // Output actions
  c.querySelectorAll('.vt-act').forEach(b => {
    b.onclick = () => {
      if (b.dataset.a === 'copy') { navigator.clipboard.writeText(b.dataset.t); showToast('Copied!'); }
      else if (b.dataset.a === 'insert') { insertTextIntoActive(b.dataset.t); }
      else if (b.dataset.a === 'tts') {
        if (playingType === b.dataset.type) stopTTS(); else playTTS(b.dataset.t, b.dataset.l, b.dataset.type);
      }
    };
  });
  c.querySelectorAll('.vt-share').forEach(b => { b.onclick = () => showShareModal(b.dataset.s); });

  // Page section (always visible)
  const toggle = c.querySelector('#vt-panel-toggle');
  if (toggle) toggle.onclick = () => { if (isActive) deactivateMode(); else activateMode(); renderPanel(); };
  const lang = c.querySelector('#vt-panel-lang');
  if (lang) lang.onchange = (e) => { targetLanguage = e.target.value; chrome.storage.local.set({ vtLanguage: targetLanguage }); };
  const btnAll = c.querySelector('#vt-btn-all');
  if (btnAll) btnAll.onclick = () => { if (!isActive) activateMode(); translateAllVisibleText(); };
  const btnSel = c.querySelector('#vt-btn-sel');
  if (btnSel) btnSel.onclick = () => {
    if (!isActive) activateMode();
    const t = getSmartSelection();
    if (t) { try { translateAndShowInline(t, window.getSelection().getRangeAt(0)); } catch { translateAndShowInline(t, null); } }
    else showToast('No text selected.');
  };
  const btnClick = c.querySelector('#vt-btn-click');
  if (btnClick) btnClick.onclick = () => { if (!isActive) activateMode(); toggleSmartSelect(); renderPanel(); };
  const btnStop = c.querySelector('#vt-btn-stop');
  if (btnStop) btnStop.onclick = () => { stopTranslationFlag = true; if (smartSelectActive) toggleSmartSelect(); removeAllTranslationOverlays(); renderPanel(); };

  // Record section
  c.querySelectorAll('.vt-mode-btn').forEach(b => { b.onclick = () => { recordingMode = b.dataset.mode; englishText = ''; rewrittenText = ''; renderPanel(); }; });
  const ptt = c.querySelector('#vt-ptt-btn');
  if (ptt) {
    ptt.onmousedown = async () => { isPTTPressed = true; englishText = ''; rewrittenText = ''; renderPanel(); await startRecording(); };
    ptt.onmouseup = async () => { isPTTPressed = false; await stopAndProcess(); };
    ptt.onmouseleave = async () => { if (isPTTPressed) { isPTTPressed = false; await stopAndProcess(); } };
  }
  const cont = c.querySelector('#vt-cont-btn');
  if (cont) cont.onclick = async () => {
    if (isRecording) { await stopAndProcess(); } else { englishText = ''; rewrittenText = ''; await startRecording(); renderPanel(); }
  };
  const fi = c.querySelector('#vt-file-input');
  if (fi) fi.onchange = async (e) => { const f = e.target.files?.[0]; if (f) { englishText = ''; rewrittenText = ''; await handleFile(f); } e.target.value = ''; };

  // Tone section
  const sel = c.querySelector('#vt-tone-sel');
  if (sel) sel.onchange = async (e) => { selectedTone = e.target.value; chrome.storage.local.set({ vtTone: selectedTone }); renderPanel(); if (englishText) await doTone(englishText, selectedTone); };
  const ci = c.querySelector('#vt-custom-tone');
  if (ci) ci.oninput = (e) => { customTone = e.target.value; };
  const ac = c.querySelector('#vt-apply-custom');
  if (ac) ac.onclick = async () => { if (englishText) await doTone(englishText, 'User Override', customTone); };
  const ti = c.querySelector('#vt-tone-input');
  if (ti) ti.oninput = (e) => { inputText = e.target.value; englishText = e.target.value; };
  const at = c.querySelector('#vt-apply-tone');
  if (at) at.onclick = async () => { if (englishText) await doTone(englishText, selectedTone); };

  // Translate section
  const ls = c.querySelector('#vt-trans-lang');
  if (ls) ls.onchange = (e) => { targetLanguage = e.target.value; chrome.storage.local.set({ vtLanguage: targetLanguage }); };
  const tiTrans = c.querySelector('#vt-trans-input');
  if (tiTrans) tiTrans.oninput = (e) => { inputText = e.target.value; englishText = e.target.value; };
  const tb = c.querySelector('#vt-trans-btn');
  if (tb) tb.onclick = async () => { const t = englishText || inputText; if (t) await doTranslate(t); };
}

// ========== API CALLS ==========
function sendMsg(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(res);
    });
  });
}

function showLoading(msg) {
  loadingMessage = msg;
  const o = popupPanel?.querySelector('#vt-loading-overlay');
  const t = popupPanel?.querySelector('#vt-loading-text');
  if (o) o.style.display = 'flex';
  if (t) t.textContent = msg;
}
function hideLoading() {
  loadingMessage = null;
  const o = popupPanel?.querySelector('#vt-loading-overlay');
  if (o) o.style.display = 'none';
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioStream = stream;
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    audioChunks = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.start();
    isRecording = true;
  } catch { showToast('Microphone permission denied.'); }
}

async function stopAndProcess() {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') { resolve(); return; }
    mediaRecorder.onstop = async () => {
      isRecording = false;
      if (audioStream) { audioStream.getTracks().forEach(t => t.stop()); audioStream = null; }
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      if (blob.size === 0) { renderPanel(); resolve(); return; }
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          showLoading('Translating audio...');
          const r = await sendMsg({ type: 'API_TRANSLATE_AUDIO', audioData: reader.result, mimeType: 'audio/webm' });
          if (!r.success) throw new Error(r.error);
          englishText = r.data.transcript || r.data.translated_text || '';
          inputText = englishText;
          showLoading('Rewriting tone...');
          const tr = await sendMsg({ type: 'API_REWRITE_TONE', text: englishText, tone: selectedTone });
          if (tr.success) rewrittenText = tr.data.rewritten_text || '';
          hideLoading(); renderPanel();
        } catch (err) { hideLoading(); showToast('Audio failed: ' + err.message); renderPanel(); }
        resolve();
      };
      reader.readAsDataURL(blob);
    };
    mediaRecorder.stop();
  });
}

async function handleFile(file) {
  const reader = new FileReader();
  reader.onloadend = async () => {
    try {
      showLoading('Translating audio...');
      const r = await sendMsg({ type: 'API_TRANSLATE_AUDIO', audioData: reader.result, mimeType: file.type });
      if (!r.success) throw new Error(r.error);
      englishText = r.data.transcript || r.data.translated_text || '';
      inputText = englishText;
      showLoading('Rewriting tone...');
      const tr = await sendMsg({ type: 'API_REWRITE_TONE', text: englishText, tone: selectedTone });
      if (tr.success) rewrittenText = tr.data.rewritten_text || '';
      hideLoading(); renderPanel();
    } catch (err) { hideLoading(); showToast('Upload failed: ' + err.message); renderPanel(); }
  };
  reader.readAsDataURL(file);
}

async function doTone(text, tone, override) {
  try {
    showLoading('Rewriting tone...');
    const r = await sendMsg({ type: 'API_REWRITE_TONE', text, tone, userOverride: override || null });
    if (!r.success) throw new Error(r.error);
    rewrittenText = r.data.rewritten_text || '';
    hideLoading(); renderPanel();
  } catch (err) { hideLoading(); showToast('Tone failed: ' + err.message); }
}

async function doTranslate(text) {
  try {
    showLoading('Translating...');
    const r = await sendMsg({ type: 'API_TRANSLATE_TEXT', text, targetLanguage });
    if (!r.success) throw new Error(r.error);
    nativeText = r.data.translated_text || '';
    hideLoading(); renderPanel();
  } catch (err) { hideLoading(); showToast('Translation failed: ' + err.message); }
}

async function playTTS(text, lang, type) {
  try {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    playingType = type; renderPanel();
    showLoading('Generating speech...');
    const r = await sendMsg({ type: 'API_TEXT_TO_SPEECH', text, language: lang });
    hideLoading();
    if (!r.success) throw new Error(r.error);
    const audio = new Audio(r.dataUrl);
    currentAudio = audio;
    audio.onended = () => { playingType = null; currentAudio = null; renderPanel(); };
    audio.play();
  } catch (err) { playingType = null; hideLoading(); showToast('TTS failed'); renderPanel(); }
}
function stopTTS() { if (currentAudio) { currentAudio.pause(); currentAudio = null; } playingType = null; renderPanel(); }

// ========== SHARE MODAL ==========
function showShareModal(type) {
  if (!popupPanel) return;
  let html = '';
  if (type === 'email') {
    html = `<h3 style="font-size:13px;font-weight:600;color:white;margin:0 0 10px;">Send via Email</h3>
      <input type="email" id="vt-m-email" placeholder="recipient@email.com" style="width:100%;padding:7px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:white;font-size:11px;outline:none;box-sizing:border-box;margin-bottom:6px;" />
      <input type="text" id="vt-m-subj" value="Translated Message" style="width:100%;padding:7px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:white;font-size:11px;outline:none;box-sizing:border-box;margin-bottom:10px;" />
      <div style="display:flex;gap:6px;justify-content:flex-end;">
        <button id="vt-m-cancel" style="padding:6px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:rgba(255,255,255,0.6);font-size:11px;cursor:pointer;">Cancel</button>
        <button id="vt-m-send" style="padding:6px 14px;background:linear-gradient(135deg,#3b82f6,#9333ea);border:none;border-radius:8px;color:white;font-size:11px;font-weight:600;cursor:pointer;">Send</button>
      </div>`;
  } else if (type === 'slack') {
    html = `<h3 style="font-size:13px;font-weight:600;color:white;margin:0 0 10px;">Send to Slack</h3>
      <input type="text" id="vt-m-webhook" placeholder="https://hooks.slack.com/... (optional)" style="width:100%;padding:7px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:white;font-size:11px;outline:none;box-sizing:border-box;margin-bottom:10px;" />
      <div style="display:flex;gap:6px;justify-content:flex-end;">
        <button id="vt-m-cancel" style="padding:6px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:rgba(255,255,255,0.6);font-size:11px;cursor:pointer;">Cancel</button>
        <button id="vt-m-send" style="padding:6px 14px;background:linear-gradient(135deg,#3b82f6,#9333ea);border:none;border-radius:8px;color:white;font-size:11px;font-weight:600;cursor:pointer;">Send</button>
      </div>`;
  } else {
    html = `<h3 style="font-size:13px;font-weight:600;color:white;margin:0 0 10px;">Share to LinkedIn</h3>
      <div style="padding:6px 8px;border-radius:8px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);margin-bottom:10px;"><p style="font-size:9px;color:#fbbf24;margin:0;">Mock mode — LinkedIn OAuth not configured.</p></div>
      <div style="display:flex;gap:6px;justify-content:flex-end;">
        <button id="vt-m-cancel" style="padding:6px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:rgba(255,255,255,0.6);font-size:11px;cursor:pointer;">Cancel</button>
        <button id="vt-m-send" style="padding:6px 14px;background:linear-gradient(135deg,#3b82f6,#9333ea);border:none;border-radius:8px;color:white;font-size:11px;font-weight:600;cursor:pointer;">Share</button>
      </div>`;
  }
  const overlay = document.createElement('div');
  overlay.id = 'vt-share-modal';
  overlay.style.cssText = 'position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);padding:16px;';
  overlay.innerHTML = `<div style="background:linear-gradient(135deg,#1e293b,#0f172a);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px;width:100%;">${html}</div>`;
  popupPanel.appendChild(overlay);

  const emailEl = overlay.querySelector('#vt-m-email');
  const subjEl = overlay.querySelector('#vt-m-subj');
  const webhookEl = overlay.querySelector('#vt-m-webhook');

  overlay.querySelector('#vt-m-cancel').onclick = () => overlay.remove();
  overlay.querySelector('#vt-m-send').onclick = async () => {
    overlay.remove();
    try {
      if (type === 'email') {
        if (!emailEl?.value) { showToast('Enter email'); return; }
        showLoading('Sending email...');
        const r = await sendMsg({ type: 'API_SEND_EMAIL', data: { text: rewrittenText, to_email: emailEl.value, subject: subjEl?.value || 'Translated Message', tone: selectedTone, language: 'en' } });
        hideLoading(); showToast(r.success ? 'Email sent!' : 'Failed: ' + r.error);
      } else if (type === 'slack') {
        showLoading('Sending to Slack...');
        const r = await sendMsg({ type: 'API_SEND_SLACK', data: { text: rewrittenText, webhook_url: webhookEl?.value || null, tone: selectedTone, language: 'en' } });
        hideLoading(); showToast(r.success ? 'Sent to Slack!' : 'Failed: ' + r.error);
      } else {
        showLoading('Sharing...');
        const r = await sendMsg({ type: 'API_SHARE_LINKEDIN', data: { text: rewrittenText, tone: selectedTone, language: 'en' } });
        hideLoading(); showToast(r.success ? 'Shared!' : 'Failed: ' + r.error);
      }
    } catch { hideLoading(); showToast('Error sharing'); }
  };
}

// ========== ACTIVATE / DEACTIVATE ==========
function activateMode() {
  isActive = true;
  chrome.storage.local.set({ vtActive: true });
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('touchend', onTouchEnd);
  updateIconState();
  showToast('Translation mode ON');
}
function deactivateMode() {
  isActive = false;
  chrome.storage.local.set({ vtActive: false });
  removeSelectionPopup();
  removeAllTranslationOverlays();
  if (smartSelectActive) toggleSmartSelect();
  document.removeEventListener('mouseup', onMouseUp);
  document.removeEventListener('touchend', onTouchEnd);
  updateIconState();
  showToast('Translation mode OFF');
}

// ========== SMART SELECT ==========
function toggleSmartSelect() {
  smartSelectActive = !smartSelectActive;
  if (smartSelectActive) {
    document.addEventListener('mouseover', onSmartHover);
    document.addEventListener('click', onSmartClick, true);
    showToast('Pick mode ON');
  } else {
    document.removeEventListener('mouseover', onSmartHover);
    document.removeEventListener('click', onSmartClick, true);
    clearSmartHighlight();
    showToast('Pick mode OFF');
  }
}
function onSmartHover(e) {
  if (!smartSelectActive) return;
  const el = e.target;
  if (el.id?.startsWith('vt-') || el.closest('#vt-selection-popup') || el.closest('#vt-popup-panel')) return;
  clearSmartHighlight();
  if (el.textContent?.trim() && el.children.length < 3) {
    highlightedEl = el; el.style.outline = '2px solid rgba(59,130,246,0.6)'; el.style.outlineOffset = '2px'; el.style.cursor = 'pointer';
  }
}
function onSmartClick(e) {
  if (!smartSelectActive) return;
  const el = e.target;
  if (el.id?.startsWith('vt-') || el.closest('#vt-selection-popup') || el.closest('#vt-popup-panel')) return;
  e.preventDefault(); e.stopPropagation();
  const text = extractText(el);
  if (text && text.length >= 2) { clearSmartHighlight(); translateInPlace(el, text); }
}
async function translateInPlace(el, text) {
  if (el.dataset.vtOriginal) return;
  el.dataset.vtOriginal = text; el.classList.add('vt-translated-element');
  const origColor = el.style.color; el.style.color = '#93c5fd';
  try {
    const r = await sendMsg({ type: 'API_TRANSLATE_TEXT', text, targetLanguage });
    if (!r.success) throw new Error(r.error);
    el.innerText = r.data.translated_text; el.style.color = origColor || '';
  } catch (err) { el.style.color = origColor || ''; delete el.dataset.vtOriginal; el.classList.remove('vt-translated-element'); showToast('Failed: ' + err.message); }
}
function clearSmartHighlight() {
  if (highlightedEl) { highlightedEl.style.outline = ''; highlightedEl.style.outlineOffset = ''; highlightedEl.style.cursor = ''; highlightedEl = null; }
}

// ========== TEXT HELPERS ==========
function extractText(el) {
  let target = el;
  if (target.textContent.trim().length < 3 && target.parentElement) target = target.parentElement;
  let text = '';
  for (const n of target.childNodes) {
    if (n.nodeType === Node.TEXT_NODE) text += n.textContent;
    else if (n.nodeType === Node.ELEMENT_NODE && ['span','em','strong','b','i','a','small'].includes(n.tagName.toLowerCase())) text += n.textContent;
  }
  return text.trim() || target.textContent?.trim() || '';
}
function getSmartSelection() {
  const sel = window.getSelection().toString().trim();
  if (sel) return sel;
  const a = document.activeElement;
  if (a) { if (a.value) return a.value.trim(); if (a.textContent) return a.textContent.trim(); }
  return '';
}

// ========== SELECTION POPUP ==========
function onMouseUp(e) { if (!isActive || smartSelectActive) return; setTimeout(() => handleTextSelection(e), 100); }
function onTouchEnd(e) { if (!isActive || smartSelectActive) return; setTimeout(() => handleTextSelection(e), 300); }
function handleTextSelection(e) {
  const selection = window.getSelection(); const text = selection.toString().trim();
  removeSelectionPopup();
  if (!text || text.length < 2) return;
  if (e.target?.closest('#vt-selection-popup')) return;
  const range = selection.getRangeAt(0); const rect = range.getBoundingClientRect();
  selectionPopup = document.createElement('div'); selectionPopup.id = 'vt-selection-popup';
  selectionPopup.innerHTML = `
    <button id="vt-sel-translate" title="Translate"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg> Translate</button>
    <button id="vt-sel-rewrite" title="Restyle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg> Restyle</button>
    <button id="vt-sel-copy" title="Copy"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</button>`;
  selectionPopup.style.top = (rect.top + window.scrollY - 48) + 'px';
  selectionPopup.style.left = Math.max(8, rect.left + window.scrollX + rect.width / 2 - 120) + 'px';
  document.body.appendChild(selectionPopup);
  document.getElementById('vt-sel-translate').onclick = () => { removeSelectionPopup(); translateAndShowInline(text, range); };
  document.getElementById('vt-sel-rewrite').onclick = () => { removeSelectionPopup(); rewriteAndShowInline(text, range); };
  document.getElementById('vt-sel-copy').onclick = () => { navigator.clipboard.writeText(text); removeSelectionPopup(); showToast('Copied!'); };
  setTimeout(() => document.addEventListener('mousedown', dismissPopup), 200);
}
function dismissPopup(e) { if (selectionPopup && !selectionPopup.contains(e.target)) removeSelectionPopup(); document.removeEventListener('mousedown', dismissPopup); }
function removeSelectionPopup() { if (selectionPopup) { selectionPopup.remove(); selectionPopup = null; } }

// ========== INLINE TRANSLATE ==========
async function translateAndShowInline(text, range, element) {
  const lid = showInlineLoading(range, element);
  try {
    const r = await sendMsg({ type: 'API_TRANSLATE_TEXT', text, targetLanguage });
    if (!r.success) throw new Error(r.error);
    removeInlineLoading(lid); showTranslationBubble(r.data.translated_text, text, range, element);
  } catch (err) { removeInlineLoading(lid); showToast('Translation failed: ' + err.message); }
}
async function rewriteAndShowInline(text, range, element) {
  const lid = showInlineLoading(range, element);
  try {
    const r = await sendMsg({ type: 'API_REWRITE_TONE', text, tone: selectedTone });
    if (!r.success) throw new Error(r.error);
    removeInlineLoading(lid); showTranslationBubble(r.data.rewritten_text, text, range, element, true);
  } catch (err) { removeInlineLoading(lid); showToast('Rewrite failed: ' + err.message); }
}

// ========== TRANSLATE ALL ==========
async function translateAllVisibleText() {
  const lang = targetLanguage; stopTranslationFlag = false;
  const skipTags = new Set(['SCRIPT','STYLE','NOSCRIPT','IFRAME','SVG','IMG','INPUT','TEXTAREA','SELECT','OPTION','CODE','PRE','KBD','SAMP','VAR','META','LINK']);
  function skip(t) {
    if (/^\d[\d\s,.\-/:]*$/.test(t)) return true;
    if (/^[\w.-]+@[\w.-]+\.\w+$/.test(t)) return true;
    if (/^https?:\/\//i.test(t)) return true;
    if (/^[A-Z]{1,5}$/.test(t)) return true;
    return false;
  }
  const collected = []; const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  let tn;
  while ((tn = walker.nextNode())) {
    const t = tn.textContent.trim();
    if (t.length < 2 || t.length > 1900) continue;
    const p = tn.parentElement; if (!p) continue;
    if (p.closest('[id^="vt-"]') || p.closest('#vt-popup-panel')) continue;
    if (skipTags.has(p.tagName)) continue;
    if (p.closest('[aria-hidden="true"]')) continue;
    if (p.dataset.vtOriginal || p.closest('.vt-translated-element')) continue;
    if (skip(t)) continue;
    const r = p.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
    if (seen.has(p)) continue; seen.add(p);
    collected.push({ node: tn, text: t });
  }
  if (!collected.length) { showToast('No translatable text.'); return; }
  showToast(`Translating ${collected.length} blocks...`);
  let ok = 0, fail = 0;
  for (let i = 0; i < collected.length; i += 2) {
    if (stopTranslationFlag) { showToast(`Stopped. ${ok} translated.`); return; }
    const batch = collected.slice(i, i + 2);
    await Promise.all(batch.map(async ({ node, text }) => {
      if (stopTranslationFlag) return;
      try {
        const r = await sendMsg({ type: 'API_TRANSLATE_TEXT', text, targetLanguage: lang });
        if (!r.success) throw new Error(r.error);
        if (!node.parentElement || stopTranslationFlag) return;
        node.parentElement.dataset.vtOriginal = node.parentElement.dataset.vtOriginal || text;
        node.textContent = r.data.translated_text;
        node.parentElement.classList.add('vt-translated-element');
        ok++;
      } catch { fail++; }
    }));
  }
  showToast(`Done! ${ok} translated${fail ? `, ${fail} failed` : ''}.`);
}

function removeAllTranslationOverlays() {
  document.querySelectorAll('[data-vt-original]').forEach(el => {
    el.innerText = el.dataset.vtOriginal; delete el.dataset.vtOriginal; delete el.dataset.vtTranslated;
    el.classList.remove('vt-translated-element');
  });
  document.querySelectorAll('.vt-translation-bubble, .vt-inline-translation, .vt-inline-loading').forEach(el => el.remove());
  showToast('Restored to original');
}

// ========== INLINE LOADING / BUBBLES ==========
let loadingCounter = 0;
function showInlineLoading(range, element) {
  const id = 'vt-loading-' + (++loadingCounter);
  const el = document.createElement('span'); el.id = id; el.className = 'vt-inline-loading';
  el.innerHTML = '<span class="vt-spinner"></span> Translating...';
  if (element) element.appendChild(el);
  else if (range) { range.collapse(false); range.insertNode(el); }
  return id;
}
function removeInlineLoading(id) { const el = document.getElementById(id); if (el) el.remove(); }

function showTranslationBubble(translatedText, originalText, range, element, isRewrite) {
  const bubble = document.createElement('div'); bubble.className = 'vt-translation-bubble';
  bubble.innerHTML = `
    <div class="vt-bubble-header"><span class="vt-bubble-label">${isRewrite ? 'Restyled' : 'Translated'}</span>
      <div class="vt-bubble-actions">
        <button class="vt-bubble-btn vt-copy-btn" title="Copy"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button class="vt-bubble-btn vt-close-btn" title="Close">&times;</button>
      </div>
    </div><div class="vt-bubble-text">${escapeHtml(translatedText)}</div>`;
  if (element) { element.style.position = element.style.position || 'relative'; element.appendChild(bubble); }
  else if (range) { range.collapse(false); range.insertNode(bubble); }
  else document.body.appendChild(bubble);
  bubble.querySelector('.vt-close-btn').onclick = () => bubble.remove();
  bubble.querySelector('.vt-copy-btn').onclick = () => { navigator.clipboard.writeText(translatedText); showToast('Copied!'); };
}

// ========== HELPERS ==========
function insertTextIntoActive(text) {
  const a = document.activeElement;
  if (a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT' || a.isContentEditable)) {
    if (a.isContentEditable) { document.execCommand('insertText', false, text); }
    else { const s = a.selectionStart, e = a.selectionEnd; a.value = a.value.substring(0, s) + text + a.value.substring(e); a.selectionStart = a.selectionEnd = s + text.length; a.dispatchEvent(new Event('input', { bubbles: true })); }
    return { success: true };
  }
  return { success: false, error: 'No active input' };
}
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function showToast(msg) {
  const ex = document.getElementById('vt-ext-toast'); if (ex) ex.remove();
  const t = document.createElement('div'); t.id = 'vt-ext-toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

// Legacy postMessage support
window.addEventListener('message', (event) => {
  if (!event.data || event.data.source !== 'vt-popup') return;
  const msg = event.data;
  if (msg.type === 'TOGGLE_ACTIVE') { if (msg.active) activateMode(); else deactivateMode(); }
  else if (msg.type === 'TRANSLATE_ALL_PAGE') translateAllVisibleText();
  else if (msg.type === 'STOP_TRANSLATION') { stopTranslationFlag = true; removeAllTranslationOverlays(); }
  else if (msg.type === 'UPDATE_SETTINGS') { if (msg.language) targetLanguage = msg.language; if (msg.tone) selectedTone = msg.tone; }
});
