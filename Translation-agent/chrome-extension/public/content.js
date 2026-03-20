// Content script for Voice Translation Extension
// All chrome.* calls are guarded against context invalidation.

// ========== CONTEXT GUARD ==========
function isContextValid() {
  try { return !!chrome.runtime?.id; } catch { return false; }
}
function safeStorage(data) {
  if (isContextValid()) try { chrome.storage.local.set(data); } catch {}
}
function sendMsg(msg) {
  return new Promise((resolve, reject) => {
    if (!isContextValid()) { reject(new Error('Extension context invalidated')); return; }
    try {
      chrome.runtime.sendMessage(msg, (res) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(res);
      });
    } catch (e) { reject(e); }
  });
}

// ========== STATE ==========
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
let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;
let isRecording = false;
let recordingMode = 'pushToTalk';
let isPTTPressed = false;
let englishText = '';
let rewrittenText = '';
let nativeText = '';
let inputText = '';
let currentAudio = null;
let playingType = null;
let loadingMessage = null;
let _lastRange = null;

const TONES = ['Email Formal', 'Email Casual', 'Slack', 'LinkedIn', 'WhatsApp Business', 'User Override'];
const TARGET_LANGUAGES = {
  Hindi: 'hi-IN', Bengali: 'bn-IN', Tamil: 'ta-IN', Telugu: 'te-IN',
  Malayalam: 'ml-IN', Marathi: 'mr-IN', Gujarati: 'gu-IN',
  Kannada: 'kn-IN', Punjabi: 'pa-IN', Odia: 'or-IN',
};

// ========== INIT (guarded) ==========
if (isContextValid()) {
  createFloatingIcon();

  chrome.storage.local.get(['vtActive', 'vtLanguage', 'vtTone', 'vtIconPos'], (result) => {
    if (!isContextValid()) return;
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
      if (text) { try { translateAndShowInline(text, window.getSelection().getRangeAt(0)); } catch { translateAndShowInline(text, null); } }
      else showToast('No text selected.');
      sendResponse({ started: true }); return;
    }
    if (message.type === 'STOP_TRANSLATION') {
      stopTranslationFlag = true; removeAllTranslationOverlays(); sendResponse({ done: true }); return;
    }
  });
} // end init guard

// ========== FLOATING ICON ==========
function createFloatingIcon() {
  if (floatingIcon) return;
  if (!isContextValid()) return;
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
    safeStorage({ vtIconPos: { x: rect.left, y: rect.top } });
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
  if (popupPanel) { closeSidebar(); return; }
  buildPanel();
}

function closeSidebar() {
  if (!popupPanel) return;
  popupPanel.style.transform = 'translateX(100%)';
  // Restore page layout
  document.documentElement.style.marginRight = '';
  document.documentElement.style.width = '';
  document.documentElement.style.overflowX = '';
  // remove overlay if any
  const overlay = document.getElementById('vt-sidebar-overlay');
  if (overlay) { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 300); }
  setTimeout(() => {
    if (popupPanel) { popupPanel.remove(); popupPanel = null; }
    // Restore floating icon
    if (floatingIcon) floatingIcon.style.display = '';
  }, 300);
}

function buildPanel() {
  const PANEL_WIDTH = 360;

  // Push page content to the left
  document.documentElement.style.transition = 'margin-right 0.3s cubic-bezier(0.4,0,0.2,1), width 0.3s cubic-bezier(0.4,0,0.2,1)';
  document.documentElement.style.marginRight = PANEL_WIDTH + 'px';
  document.documentElement.style.width = `calc(100% - ${PANEL_WIDTH}px)`;
  document.documentElement.style.overflowX = 'hidden';

  popupPanel = document.createElement('div');
  popupPanel.id = 'vt-popup-panel';
  // Start off-screen
  popupPanel.style.cssText = 'transform:translateX(100%);';

  renderPanel();
  document.body.appendChild(popupPanel);
  // Hide floating icon while panel is open
  if (floatingIcon) floatingIcon.style.display = 'none';
  // Slide in on next frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      popupPanel.style.transform = 'translateX(0)';
    });
  });
}

function getIconURL() {
  if (!isContextValid()) return '';
  try { return chrome.runtime.getURL('icons/icon48.png'); } catch { return ''; }
}

function renderPanel() {
  if (!popupPanel) return;
  popupPanel.innerHTML = `
    <div id="vt-panel-header">
      <div style="display:flex;align-items:center;gap:10px;">
        <img src="${getIconURL()}" width="28" height="28" style="border-radius:8px;flex-shrink:0;" />
        <div>
          <div style="font-size:13px;font-weight:700;color:#ffffff;line-height:1.2;">SeedlingSpeaks</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.45);margin-top:1px;">AI Translation</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <button id="vt-panel-toggle" title="${isActive ? 'Deactivate' : 'Activate'}" style="width:44px;height:24px;border-radius:12px;border:none;cursor:pointer;position:relative;transition:background 0.25s;background:${isActive ? '#10b981' : 'rgba(255,255,255,0.15)'};">
          <div style="width:20px;height:20px;border-radius:10px;background:white;position:absolute;top:2px;transition:left 0.25s;box-shadow:0 1px 4px rgba(0,0,0,0.3);${isActive ? 'left:22px;' : 'left:2px;'}"></div>
        </button>
        <button id="vt-panel-clear" title="Clear all" style="width:30px;height:30px;background:rgba(255,255,255,0.08);border:none;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.5);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
        <button id="vt-panel-close" title="Close" style="width:30px;height:30px;background:rgba(255,255,255,0.08);border:none;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.5);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
    <div id="vt-tab-content">${renderMainContent()}</div>
    <div id="vt-action-bar">
      ${iconActionBtn('vt-btn-all',   'Translate Page',      '#6366f1', `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`)}
      ${iconActionBtn('vt-btn-sel',   'Selection',           '#8b5cf6', `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M14 14h7v7h-7z"/><path d="M3 14h7v7H3z"/></svg>`)}
      ${iconActionBtn('vt-btn-click', smartSelectActive ? 'Click: ON' : 'Click Mode', smartSelectActive ? '#10b981' : '#06b6d4', `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 15l-2 5L9 9l11 4-5 2z"/><path d="M15 15l5 5"/></svg>`)}
      ${iconActionBtn('vt-btn-stop',  'Restore',             '#f43f5e', `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`)}
    </div>
    <div id="vt-loading-overlay" style="display:${loadingMessage ? 'flex' : 'none'};">
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:14px 20px;display:flex;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,0.1);">
        <span class="vt-spinner"></span>
        <span id="vt-loading-text" style="font-size:12px;font-weight:500;color:#374151;">${loadingMessage || ''}</span>
      </div>
    </div>`;

  popupPanel.querySelector('#vt-panel-close').onclick = () => { closeSidebar(); };
  popupPanel.querySelector('#vt-panel-clear').onclick = () => {
    englishText = ''; rewrittenText = ''; nativeText = ''; inputText = ''; playingType = null;
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    renderPanel();
  };
  wireTabEvents();
}

function iconActionBtn(id, label, color, svg) {
  return `<button id="${id}" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;padding:10px 4px;background:none;border:none;cursor:pointer;border-radius:10px;transition:background 0.15s;" title="${label}">
    <div style="width:38px;height:38px;border-radius:12px;background:${color}18;display:flex;align-items:center;justify-content:center;color:${color};">${svg}</div>
    <span style="font-size:9px;font-weight:600;color:#6b7280;text-align:center;line-height:1.2;">${label}</span>
  </button>`;
}

function renderMainContent() {
  const s = 'width:100%;padding:9px 12px;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;color:#111827;font-size:12px;font-weight:500;outline:none;box-shadow:0 1px 3px rgba(0,0,0,0.05);';
  return `
    <div style="margin-bottom:12px;">
      <div style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;">Target Language</div>
      <div style="position:relative;">
        <select id="vt-panel-lang" style="${s}cursor:pointer;appearance:none;padding-right:36px;">
          ${Object.entries(TARGET_LANGUAGES).map(([n, c]) => `<option value="${c}" ${c === targetLanguage ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none;"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
    </div>
    ${sectionHeader('record', '🎙 Voice Record', expandedSections.record)}
    ${expandedSections.record ? `<div style="padding:8px 0;">${renderRecordSection()}</div>` : ''}
    ${sectionHeader('tone', '✨ Tone Rewrite', expandedSections.tone)}
    ${expandedSections.tone ? `<div style="padding:8px 0;">${renderToneSection()}</div>` : ''}
    ${sectionHeader('translate', '🌐 Translate Text', expandedSections.translate)}
    ${expandedSections.translate ? `<div style="padding:8px 0;">${renderTranslateSection()}</div>` : ''}`;
}

function sectionHeader(id, title, expanded) {
  return `<button class="vt-section-toggle" data-section="${id}" style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:10px 12px;margin-top:8px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;color:#111827;font-size:12px;font-weight:600;cursor:pointer;text-align:left;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    <span>${title}</span>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" style="transform:${expanded ? 'rotate(180deg)' : 'rotate(0deg)'};transition:transform 0.2s;flex-shrink:0;"><polyline points="6 9 12 15 18 9"/></svg>
  </button>`;
}

function renderRecordSection() {
  const modes = [{ v: 'pushToTalk', l: 'PTT', i: '🎤' }, { v: 'continuous', l: 'Listen', i: '👂' }, { v: 'fileUpload', l: 'Upload', i: '📁' }];
  let recUI = '';
  if (recordingMode === 'pushToTalk') {
    recUI = `<button id="vt-ptt-btn" style="width:64px;height:64px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;${isPTTPressed ? 'background:#ef4444;box-shadow:0 0 0 8px rgba(239,68,68,0.15),0 8px 24px rgba(239,68,68,0.4);transform:scale(1.05);' : 'background:#111827;box-shadow:0 8px 24px rgba(0,0,0,0.2);'}">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
    </button>
    <p style="font-size:11px;font-weight:500;color:${isPTTPressed ? '#ef4444' : '#9ca3af'};margin:0;">${isPTTPressed ? '● Recording...' : 'Hold to record'}</p>`;
  } else if (recordingMode === 'continuous') {
    recUI = `<button id="vt-cont-btn" style="width:64px;height:64px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;${isRecording ? 'background:#ef4444;box-shadow:0 0 0 8px rgba(239,68,68,0.15),0 8px 24px rgba(239,68,68,0.4);' : 'background:#111827;box-shadow:0 8px 24px rgba(0,0,0,0.2);'}">
      ${isRecording ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>` : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`}
    </button>
    <p style="font-size:11px;font-weight:500;color:${isRecording ? '#ef4444' : '#9ca3af'};margin:0;">${isRecording ? '● Listening...' : 'Tap to start'}</p>`;
  } else {
    recUI = `<label style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:11px 20px;background:#111827;border-radius:12px;color:white;font-size:12px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.15);">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
      Select Audio File
      <input type="file" id="vt-file-input" accept=".mp3,.wav,.m4a,.webm,.ogg,.flac" style="display:none;" />
    </label>
    <p style="font-size:10px;color:#9ca3af;margin:0;">MP3 · WAV · M4A · WebM · OGG</p>`;
  }
  return `
    <div style="display:flex;gap:4px;margin-bottom:12px;">
      ${modes.map(m => `<button class="vt-mode-btn" data-mode="${m.v}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:8px 4px;border-radius:10px;font-size:11px;font-weight:600;cursor:pointer;transition:all 0.15s;border:1px solid ${recordingMode === m.v ? '#111827' : '#e5e7eb'};background:${recordingMode === m.v ? '#111827' : '#ffffff'};color:${recordingMode === m.v ? '#ffffff' : '#9ca3af'};">${m.i} ${m.l}</button>`).join('')}
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 0 8px;">${recUI}</div>
    ${outputBox('Translated English', englishText, 'en', 'english')}
    ${outputBox('Styled Text', rewrittenText, 'en', 'rewritten')}
    ${rewrittenText ? shareButtons() : ''}`;
}

function renderToneSection() {
  const s = 'width:100%;padding:9px 12px;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;color:#111827;font-size:12px;font-weight:500;outline:none;box-shadow:0 1px 3px rgba(0,0,0,0.05);';
  return `
    <div style="position:relative;margin-bottom:10px;">
      <select id="vt-tone-sel" style="${s}cursor:pointer;appearance:none;padding-right:36px;">
        ${TONES.map(t => `<option value="${t}" ${t === selectedTone ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none;"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
    ${selectedTone === 'User Override' ? `<div style="margin-bottom:10px;display:flex;gap:6px;">
      <input type="text" id="vt-custom-tone" value="${esc(customTone)}" placeholder="e.g. Formal with bullet points" style="${s}flex:1;" />
      <button id="vt-apply-custom" style="padding:9px 14px;background:#111827;border:none;border-radius:10px;color:white;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;">Apply</button>
    </div>` : ''}
    <textarea id="vt-tone-input" placeholder="Paste or type English text..." rows="3" style="${s}resize:none;margin-bottom:8px;">${escapeHtml(inputText)}</textarea>
    ${englishText && !rewrittenText ? `<button id="vt-apply-tone" style="width:100%;padding:10px;background:#111827;border:none;border-radius:10px;color:white;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:8px;">Apply Tone</button>` : ''}
    ${outputBox('Styled Text', rewrittenText, 'en', 'rewritten')}`;
}

function renderTranslateSection() {
  const s = 'width:100%;padding:9px 12px;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;color:#111827;font-size:12px;font-weight:500;outline:none;box-shadow:0 1px 3px rgba(0,0,0,0.05);';
  return `
    <div style="position:relative;margin-bottom:10px;">
      <select id="vt-trans-lang" style="${s}cursor:pointer;appearance:none;padding-right:36px;">
        ${Object.entries(TARGET_LANGUAGES).map(([n, c]) => `<option value="${c}" ${c === targetLanguage ? 'selected' : ''}>${n}</option>`).join('')}
      </select>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none;"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
    <textarea id="vt-trans-input" placeholder="Type or paste English text..." rows="3" style="${s}resize:none;margin-bottom:8px;">${escapeHtml(inputText)}</textarea>
    <button id="vt-trans-btn" style="width:100%;padding:10px;background:#111827;border:none;border-radius:10px;color:white;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:8px;">Translate to Native</button>
    ${outputBox('Native Translation', nativeText, targetLanguage, 'native')}`;
}

function outputBox(label, content, lang, type) {
  if (!content) return '';
  const isP = playingType === type;
  const iconBtn = (a, t, title, svg) => `<button class="vt-act" data-a="${a}" data-t="${esc(t)}" ${a === 'tts' ? `data-l="${lang}" data-type="${type}"` : ''} style="width:26px;height:26px;background:none;border:none;color:#9ca3af;cursor:pointer;border-radius:6px;display:flex;align-items:center;justify-content:center;" title="${title}">${svg}</button>`;
  return `<div style="margin-bottom:10px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
      <span style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.6px;">${label}</span>
      <div style="display:flex;align-items:center;gap:1px;">
        ${iconBtn('copy', content, 'Copy', `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`)}
        ${iconBtn('insert', content, 'Insert into page', `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>`)}
        ${lang ? iconBtn('tts', content, isP ? 'Stop' : 'Listen', isP
          ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="#ef4444"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`
          : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`) : ''}
      </div>
    </div>
    <div style="padding:10px 12px;border-radius:10px;background:#ffffff;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <p style="font-size:12px;line-height:1.6;color:#374151;white-space:pre-wrap;margin:0;word-break:break-word;">${escapeHtml(content)}</p>
    </div>
  </div>`;
}

function shareButtons() {
  return `<div style="display:flex;gap:6px;justify-content:center;margin:4px 0 8px;">
    <button class="vt-share" data-s="email" style="display:flex;align-items:center;gap:4px;padding:5px 10px;border-radius:8px;background:#ffffff;border:1px solid #ececec;color:#374151;font-size:10px;font-weight:600;cursor:pointer;">📧 Email</button>
    <button class="vt-share" data-s="slack" style="display:flex;align-items:center;gap:4px;padding:5px 10px;border-radius:8px;background:#ffffff;border:1px solid #ececec;color:#374151;font-size:10px;font-weight:600;cursor:pointer;">💬 Slack</button>
    <button class="vt-share" data-s="linkedin" style="display:flex;align-items:center;gap:4px;padding:5px 10px;border-radius:8px;background:#ffffff;border:1px solid #ececec;color:#374151;font-size:10px;font-weight:600;cursor:pointer;">💼 LinkedIn</button>
  </div>`;
}

// ========== WIRE TAB EVENTS ==========
function wireTabEvents() {
  if (!popupPanel) return;

  // Toggle active
  const toggleBtn = popupPanel.querySelector('#vt-panel-toggle');
  if (toggleBtn) toggleBtn.onclick = () => { isActive ? deactivateMode() : activateMode(); };

  // Language selector
  const langSel = popupPanel.querySelector('#vt-panel-lang');
  if (langSel) langSel.onchange = () => {
    targetLanguage = langSel.value;
    safeStorage({ vtLanguage: targetLanguage });
  };

  // Bottom icon action buttons
  const btnAll = popupPanel.querySelector('#vt-btn-all');
  if (btnAll) btnAll.onclick = () => { translateAllVisibleText(); };

  const btnSel = popupPanel.querySelector('#vt-btn-sel');
  if (btnSel) btnSel.onclick = () => {
    const text = getSmartSelection();
    if (!text) { showToast('Select some text first.'); return; }
    try { translateAndShowInline(text, window.getSelection().getRangeAt(0)); }
    catch { translateAndShowInline(text, null); }
  };

  const btnClick = popupPanel.querySelector('#vt-btn-click');
  if (btnClick) btnClick.onclick = () => { toggleSmartSelect(); renderPanel(); wireTabEvents(); };

  const btnStop = popupPanel.querySelector('#vt-btn-stop');
  if (btnStop) btnStop.onclick = () => { stopTranslationFlag = true; removeAllTranslationOverlays(); showToast('Translations removed.'); };

  // Section toggles (tools tab)
  popupPanel.querySelectorAll('.vt-section-toggle').forEach(btn => {
    btn.onclick = () => {
      const sec = btn.dataset.section;
      expandedSections[sec] = !expandedSections[sec];
      renderPanel(); wireTabEvents();
    };
  });

  // Recording mode buttons
  popupPanel.querySelectorAll('.vt-mode-btn').forEach(btn => {
    btn.onclick = () => { recordingMode = btn.dataset.mode; renderPanel(); wireTabEvents(); };
  });

  // PTT button
  const pttBtn = popupPanel.querySelector('#vt-ptt-btn');
  if (pttBtn) {
    pttBtn.addEventListener('mousedown', () => { isPTTPressed = true; startRecording(); renderPanel(); wireTabEvents(); });
    pttBtn.addEventListener('mouseup', () => { isPTTPressed = false; stopAndProcess(); renderPanel(); wireTabEvents(); });
    pttBtn.addEventListener('mouseleave', () => { if (isPTTPressed) { isPTTPressed = false; stopAndProcess(); renderPanel(); wireTabEvents(); } });
  }

  // Continuous record button
  const contBtn = popupPanel.querySelector('#vt-cont-btn');
  if (contBtn) contBtn.onclick = () => {
    if (isRecording) { stopAndProcess(); } else { startRecording(); }
    renderPanel(); wireTabEvents();
  };

  // File upload
  const fileInput = popupPanel.querySelector('#vt-file-input');
  if (fileInput) fileInput.onchange = (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); };

  // Tone section
  const toneSel = popupPanel.querySelector('#vt-tone-sel');
  if (toneSel) toneSel.onchange = () => {
    selectedTone = toneSel.value;
    safeStorage({ vtTone: selectedTone });
    renderPanel(); wireTabEvents();
  };
  const customToneInput = popupPanel.querySelector('#vt-custom-tone');
  if (customToneInput) customToneInput.oninput = () => { customTone = customToneInput.value; };
  const applyCustom = popupPanel.querySelector('#vt-apply-custom');
  if (applyCustom) applyCustom.onclick = () => { customTone = customToneInput?.value || ''; };

  const toneInput = popupPanel.querySelector('#vt-tone-input');
  if (toneInput) toneInput.oninput = () => { inputText = toneInput.value; };

  const applyToneBtn = popupPanel.querySelector('#vt-apply-tone');
  if (applyToneBtn) applyToneBtn.onclick = () => {
    const txt = toneInput?.value || inputText;
    if (!txt.trim()) { showToast('Enter some text first.'); return; }
    inputText = txt;
    doTone(txt);
  };

  // Translate section
  const transLang = popupPanel.querySelector('#vt-trans-lang');
  if (transLang) transLang.onchange = () => {
    targetLanguage = transLang.value;
    safeStorage({ vtLanguage: targetLanguage });
  };
  const transInput = popupPanel.querySelector('#vt-trans-input');
  if (transInput) transInput.oninput = () => { inputText = transInput.value; };
  const transBtn = popupPanel.querySelector('#vt-trans-btn');
  if (transBtn) transBtn.onclick = () => {
    const txt = transInput?.value || inputText;
    if (!txt.trim()) { showToast('Enter some text first.'); return; }
    inputText = txt;
    doTranslate(txt);
  };

  // Output action buttons (copy, insert, tts)
  popupPanel.querySelectorAll('.vt-act').forEach(btn => {
    btn.onclick = () => {
      const action = btn.dataset.a;
      const text = btn.dataset.t;
      if (action === 'copy') { navigator.clipboard.writeText(text).then(() => showToast('Copied!')); }
      else if (action === 'insert') { insertTextIntoActive(text); showToast('Inserted!'); }
      else if (action === 'tts') {
        const lang = btn.dataset.l;
        const type = btn.dataset.type;
        if (playingType === type) { stopTTS(); } else { playTTS(text, lang, type); }
      }
    };
  });

  // Share buttons
  popupPanel.querySelectorAll('.vt-share').forEach(btn => {
    btn.onclick = () => showShareModal(btn.dataset.s);
  });
}

// ========== RECORDING ==========
async function startRecording() {
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(audioStream);
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.start(250);
    isRecording = true;
  } catch (err) {
    showToast('Microphone access denied.');
    isRecording = false;
  }
}

async function stopAndProcess() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
  return new Promise((resolve) => {
    mediaRecorder.onstop = async () => {
      isRecording = false;
      if (audioStream) { audioStream.getTracks().forEach(t => t.stop()); audioStream = null; }
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result;
        loadingMessage = 'Transcribing audio…';
        renderPanel(); wireTabEvents();
        try {
          const res = await sendMsg({ type: 'API_TRANSLATE_AUDIO', audioData: base64, mimeType: 'audio/webm' });
          if (res?.success) {
            englishText = res.data.english_text || '';
            rewrittenText = res.data.rewritten_text || '';
            nativeText = res.data.native_text || '';
          } else { showToast('Audio processing failed.'); }
        } catch { showToast('Audio processing failed.'); }
        loadingMessage = null;
        renderPanel(); wireTabEvents();
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
    const base64 = reader.result;
    loadingMessage = 'Processing audio file…';
    renderPanel(); wireTabEvents();
    try {
      const res = await sendMsg({ type: 'API_TRANSLATE_AUDIO', audioData: base64, mimeType: file.type });
      if (res?.success) {
        englishText = res.data.english_text || '';
        rewrittenText = res.data.rewritten_text || '';
        nativeText = res.data.native_text || '';
      } else { showToast('File processing failed.'); }
    } catch { showToast('File processing failed.'); }
    loadingMessage = null;
    renderPanel(); wireTabEvents();
  };
  reader.readAsDataURL(file);
}

// ========== TONE / TRANSLATE ==========
async function doTone(text) {
  loadingMessage = 'Rewriting tone…';
  renderPanel(); wireTabEvents();
  try {
    const res = await sendMsg({ type: 'API_REWRITE_TONE', text, tone: selectedTone, userOverride: customTone });
    if (res?.success) { rewrittenText = res.data.rewritten_text || ''; }
    else { showToast('Tone rewrite failed.'); }
  } catch { showToast('Tone rewrite failed.'); }
  loadingMessage = null;
  renderPanel(); wireTabEvents();
}

async function doTranslate(text) {
  loadingMessage = 'Translating…';
  renderPanel(); wireTabEvents();
  try {
    const res = await sendMsg({ type: 'API_TRANSLATE_TEXT', text, targetLanguage });
    if (res?.success) { nativeText = res.data.translated_text || ''; }
    else { showToast('Translation failed.'); }
  } catch { showToast('Translation failed.'); }
  loadingMessage = null;
  renderPanel(); wireTabEvents();
}

// ========== TTS ==========
async function playTTS(text, lang, type) {
  stopTTS();
  try {
    const res = await sendMsg({ type: 'API_TEXT_TO_SPEECH', text, language: lang });
    if (res?.success && res.dataUrl) {
      currentAudio = new Audio(res.dataUrl);
      playingType = type;
      renderPanel(); wireTabEvents();
      currentAudio.onended = () => { playingType = null; currentAudio = null; renderPanel(); wireTabEvents(); };
      currentAudio.play();
    } else { showToast('TTS failed.'); }
  } catch { showToast('TTS failed.'); }
}

function stopTTS() {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  playingType = null;
}

// ========== SHARE ==========
function showShareModal(service) {
  const text = rewrittenText || englishText;
  if (!text) { showToast('No text to share.'); return; }
  if (service === 'email') {
    sendMsg({ type: 'API_SEND_EMAIL', data: { subject: 'Shared via SeedlingSpeaks', body: text } })
      .then(r => showToast(r?.success ? 'Email sent!' : 'Email failed.'))
      .catch(() => showToast('Email failed.'));
  } else if (service === 'slack') {
    sendMsg({ type: 'API_SEND_SLACK', data: { message: text } })
      .then(r => showToast(r?.success ? 'Sent to Slack!' : 'Slack failed.'))
      .catch(() => showToast('Slack failed.'));
  } else if (service === 'linkedin') {
    sendMsg({ type: 'API_SHARE_LINKEDIN', data: { text } })
      .then(r => showToast(r?.success ? 'Shared on LinkedIn!' : 'LinkedIn failed.'))
      .catch(() => showToast('LinkedIn failed.'));
  }
}

// ========== ACTIVATE / DEACTIVATE ==========
function activateMode() {
  isActive = true;
  safeStorage({ vtActive: true });
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('touchend', onTouchEnd);
  updateIconState();
  if (popupPanel) renderPanel();
}

function deactivateMode() {
  isActive = false;
  safeStorage({ vtActive: false });
  document.removeEventListener('mouseup', onMouseUp);
  document.removeEventListener('touchend', onTouchEnd);
  removeSelectionPopup();
  if (smartSelectActive) toggleSmartSelect();
  updateIconState();
  if (popupPanel) renderPanel();
  if (isContextValid()) {
    try { chrome.runtime.sendMessage({ type: 'DEACTIVATED_FROM_PAGE' }); } catch {}
  }
}

// ========== SMART SELECT ==========
function toggleSmartSelect() {
  smartSelectActive = !smartSelectActive;
  if (smartSelectActive) {
    document.addEventListener('mouseover', onSmartHover);
    document.addEventListener('click', onSmartClick, true);
    document.body.style.cursor = 'crosshair';
  } else {
    document.removeEventListener('mouseover', onSmartHover);
    document.removeEventListener('click', onSmartClick, true);
    document.body.style.cursor = '';
    if (highlightedEl) { highlightedEl.style.outline = ''; highlightedEl = null; }
  }
}

function onSmartHover(e) {
  if (!smartSelectActive) return;
  const el = e.target;
  if (el === floatingIcon || el === popupPanel || el?.closest?.('#vt-popup-panel') || el?.closest?.('#vt-floating-icon')) return;
  if (highlightedEl && highlightedEl !== el) highlightedEl.style.outline = '';
  highlightedEl = el;
  el.style.outline = '2px solid #6366f1';
}

function onSmartClick(e) {
  if (!smartSelectActive) return;
  const el = e.target;
  if (el === floatingIcon || el?.closest?.('#vt-popup-panel') || el?.closest?.('#vt-floating-icon')) return;
  e.preventDefault(); e.stopPropagation();
  const text = extractText(el);
  if (text) translateInPlace(el, text);
  if (highlightedEl) { highlightedEl.style.outline = ''; highlightedEl = null; }
}

async function translateInPlace(el, text) {
  el.classList.add('vt-translated-element');
  const original = el.innerHTML;
  el.dataset.vtOriginal = original;
  try {
    const res = await sendMsg({ type: 'API_TRANSLATE_TEXT', text, targetLanguage });
    if (res?.success) {
      const translated = res.data.translated_text || text;
      el.innerHTML = escapeHtml(translated);
      const undoBtn = document.createElement('button');
      undoBtn.className = 'vt-undo-btn';
      undoBtn.textContent = '↩';
      undoBtn.title = 'Undo translation';
      undoBtn.onclick = () => { el.innerHTML = original; el.classList.remove('vt-translated-element'); delete el.dataset.vtOriginal; };
      el.appendChild(undoBtn);
    }
  } catch { el.classList.remove('vt-translated-element'); }
}

// ========== SELECTION HELPERS ==========
function getSmartSelection() {
  const sel = window.getSelection();
  if (sel && sel.toString().trim()) return sel.toString().trim();
  return '';
}

function extractText(el) {
  return (el.innerText || el.textContent || '').trim();
}

// ========== TEXT SELECTION POPUP ==========
function handleTextSelection() {
  if (!isActive) return;
  const sel = window.getSelection();
  const text = sel?.toString().trim();
  if (!text || text.length < 2) { removeSelectionPopup(); return; }
  try {
    const range = sel.getRangeAt(0);
    _lastRange = range.cloneRange();
    showSelectionPopup(range, text);
  } catch { removeSelectionPopup(); }
}

function onMouseUp(e) {
  if (e.target?.closest?.('#vt-selection-popup') || e.target?.closest?.('#vt-popup-panel') || e.target?.closest?.('#vt-floating-icon')) return;
  setTimeout(handleTextSelection, 10);
}

function onTouchEnd(e) {
  if (e.target?.closest?.('#vt-selection-popup') || e.target?.closest?.('#vt-popup-panel') || e.target?.closest?.('#vt-floating-icon')) return;
  setTimeout(handleTextSelection, 100);
}

function showSelectionPopup(range, text) {
  removeSelectionPopup();
  const rect = range.getBoundingClientRect();
  selectionPopup = document.createElement('div');
  selectionPopup.id = 'vt-selection-popup';

  selectionPopup.innerHTML = `
    <button id="vt-sel-translate">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      Translate
    </button>
    <button id="vt-sel-copy">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      Copy
    </button>`;

  const top = rect.top + window.scrollY - 52;
  const left = rect.left + window.scrollX + rect.width / 2 - 80;
  selectionPopup.style.top = Math.max(4, top) + 'px';
  selectionPopup.style.left = Math.max(4, Math.min(window.innerWidth - 180, left)) + 'px';

  document.body.appendChild(selectionPopup);

  selectionPopup.querySelector('#vt-sel-translate').onclick = () => {
    const savedRange = _lastRange;
    removeSelectionPopup();
    if (savedRange) translateAndShowInline(text, savedRange);
  };
  selectionPopup.querySelector('#vt-sel-copy').onclick = () => {
    navigator.clipboard.writeText(text).then(() => showToast('Copied!'));
    removeSelectionPopup();
  };

  // Auto-dismiss on outside click
  setTimeout(() => {
    document.addEventListener('mousedown', dismissPopup, { once: true });
  }, 0);
}

function dismissPopup(e) {
  if (e?.target?.closest?.('#vt-selection-popup')) return;
  removeSelectionPopup();
}

function removeSelectionPopup() {
  if (selectionPopup) { selectionPopup.remove(); selectionPopup = null; }
}

// ========== INLINE TRANSLATION (replaces selected text in-place) ==========
async function translateAndShowInline(text, range) {
  if (!range) { showToast('Could not locate selection.'); return; }

  // Wrap selection in a pulsing mark while loading
  let mark;
  try {
    mark = document.createElement('mark');
    mark.className = 'vt-translating-mark';
    range.surroundContents(mark);
  } catch {
    // surroundContents fails on cross-element selections — fall back to toast
    showToast('Translating…');
    mark = null;
  }

  try {
    const res = await sendMsg({ type: 'API_TRANSLATE_TEXT', text, targetLanguage });
    if (!res?.success) throw new Error('API error');
    const translated = res.data.translated_text || text;
    replaceSelectionWithTranslation(mark, text, translated, range);
  } catch {
    if (mark) unwrapMark(mark);
    showToast('Translation failed.');
  }
}

function replaceSelectionWithTranslation(mark, originalText, translatedText, range) {
  // Build the inline span
  const span = document.createElement('span');
  span.className = 'vt-translated-inline';
  span.textContent = translatedText;

  const undoBtn = document.createElement('button');
  undoBtn.className = 'vt-undo-btn';
  undoBtn.textContent = '↩';
  undoBtn.title = 'Undo — restore original text';
  undoBtn.onclick = () => {
    const textNode = document.createTextNode(originalText);
    span.replaceWith(textNode);
  };

  span.appendChild(undoBtn);

  if (mark) {
    mark.replaceWith(span);
  } else {
    // Fallback: delete range contents and insert span
    try {
      range.deleteContents();
      range.insertNode(span);
    } catch {
      showToast(translatedText);
    }
  }
}

function unwrapMark(mark) {
  if (!mark || !mark.parentNode) return;
  const parent = mark.parentNode;
  while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
  parent.removeChild(mark);
}

// ========== TRANSLATE ALL VISIBLE ==========
async function translateAllVisibleText() {
  stopTranslationFlag = false;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      const tag = p.tagName?.toUpperCase();
      if (['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT','CODE','PRE'].includes(tag)) return NodeFilter.FILTER_REJECT;
      if (p.closest('#vt-popup-panel, #vt-floating-icon, #vt-selection-popup')) return NodeFilter.FILTER_REJECT;
      if (p.classList?.contains('vt-translated-inline') || p.classList?.contains('vt-undo-btn')) return NodeFilter.FILTER_REJECT;
      const text = node.textContent.trim();
      if (text.length < 3) return NodeFilter.FILTER_REJECT;
      const rect = p.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);

  for (const node of nodes) {
    if (stopTranslationFlag) break;
    const text = node.textContent.trim();
    if (!text) continue;
    try {
      const res = await sendMsg({ type: 'API_TRANSLATE_TEXT', text, targetLanguage });
      if (res?.success && node.parentNode) {
        const span = document.createElement('span');
        span.className = 'vt-translated-inline';
        span.textContent = res.data.translated_text || text;
        const undoBtn = document.createElement('button');
        undoBtn.className = 'vt-undo-btn';
        undoBtn.textContent = '↩';
        undoBtn.title = 'Undo';
        undoBtn.onclick = () => {
          const t = document.createTextNode(text);
          span.replaceWith(t);
        };
        span.appendChild(undoBtn);
        node.parentNode.replaceChild(span, node);
      }
    } catch { /* skip node */ }
  }
  showToast(stopTranslationFlag ? 'Translation stopped.' : 'Page translated.');
}

function removeAllTranslationOverlays() {
  document.querySelectorAll('.vt-translated-inline').forEach(span => {
    const original = span.textContent.replace(/↩$/, '').trim();
    span.replaceWith(document.createTextNode(original));
  });
  document.querySelectorAll('.vt-translated-element').forEach(el => {
    if (el.dataset.vtOriginal) { el.innerHTML = el.dataset.vtOriginal; delete el.dataset.vtOriginal; }
    el.classList.remove('vt-translated-element');
  });
}

// ========== HELPERS ==========
function insertTextIntoActive(text) {
  const el = document.activeElement;
  if (!el) return false;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, start) + text + el.value.slice(end);
    el.selectionStart = el.selectionEnd = start + text.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  if (el.isContentEditable) {
    document.execCommand('insertText', false, text);
    return true;
  }
  return false;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function esc(str) {
  if (!str) return '';
  return str.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

function showToast(msg) {
  const existing = document.getElementById('vt-ext-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'vt-ext-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(8px)'; setTimeout(() => toast.remove(), 300); }, 2500);
}
