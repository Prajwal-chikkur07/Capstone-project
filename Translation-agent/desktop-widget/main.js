const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const http = require('http');
const { spawnSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

let bubbleWin = null;
let modeMenuWin = null;
let overlayWin = null;
let toastWin = null;
let screenOverlayWin = null;
let regionSelectWin = null;
let isModeMenuOpen = false;
let isOverlayOpen = false;
let isBubbleEnabled = true;
let toastTimer = null;
let isClickModeActive = false;
let clickModeLang = 'hi-IN';

let widgetConfig = { mode: 'englishToNative', languages: ['hi-IN'] };
let lastFrontApp = null; // track which app was active before overlay opened

// ── Control server ────────────────────────────────────────────────────────────
function startControlServer() {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
    res.setHeader('Content-Type', 'application/json');

    if (req.url === '/status') {
      res.writeHead(200); res.end(JSON.stringify({ enabled: isBubbleEnabled }));
    } else if (req.url === '/config' && req.method === 'GET') {
      res.writeHead(200); res.end(JSON.stringify(widgetConfig));
    } else if (req.url === '/config' && req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const inc = JSON.parse(body);
          widgetConfig = {
            mode: inc.mode === 'nativeToEnglish' ? 'nativeToEnglish' : 'englishToNative',
            languages: Array.isArray(inc.languages) && inc.languages.length > 0 ? inc.languages : ['hi-IN'],
          };
          if (overlayWin) overlayWin.webContents.send('set-config', widgetConfig);
          res.writeHead(200); res.end(JSON.stringify(widgetConfig));
        } catch { res.writeHead(400); res.end(JSON.stringify({ error: 'bad payload' })); }
      });
      return;
    } else if (req.url === '/enable') {
      isBubbleEnabled = true; if (bubbleWin) bubbleWin.show();
      res.writeHead(200); res.end(JSON.stringify({ enabled: true }));
    } else if (req.url === '/disable') {
      isBubbleEnabled = false; if (bubbleWin) bubbleWin.hide();
      hideModeMenu(); hideOverlay();
      res.writeHead(200); res.end(JSON.stringify({ enabled: false }));
    } else if (req.url === '/toggle') {
      isBubbleEnabled = !isBubbleEnabled;
      if (isBubbleEnabled) { if (bubbleWin) bubbleWin.show(); }
      else { if (bubbleWin) bubbleWin.hide(); hideModeMenu(); hideOverlay(); }
      res.writeHead(200); res.end(JSON.stringify({ enabled: isBubbleEnabled }));
    } else {
      res.writeHead(404); res.end(JSON.stringify({ error: 'not found' }));
    }
  });
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.warn('Port 27182 in use — killing old process and retrying…');
      const { spawnSync: sp } = require('child_process');
      sp('sh', ['-c', 'lsof -ti :27182 | xargs kill -9'], { encoding: 'utf8' });
      setTimeout(() => server.listen(27182, '127.0.0.1'), 500);
    }
  });
  server.listen(27182, '127.0.0.1', () => console.log('Control server: http://127.0.0.1:27182'));
}

// ── Screenshot helper — uses macOS screencapture ──────────────────────────────
async function captureScreen() {
  const tmpFile = path.join(os.tmpdir(), `vt_ss_${Date.now()}.png`);
  const r = spawnSync('screencapture', ['-x', '-t', 'png', tmpFile], {
    encoding: 'utf8', timeout: 10000,
  });
  const stderr = (r.stderr || '').toLowerCase();
  const permissionError =
    stderr.includes('could not create image') ||
    stderr.includes('no displays') ||
    stderr.includes('permission') ||
    (r.status !== 0 && !fs.existsSync(tmpFile));

  if (permissionError) {
    const err = new Error('SCREEN_PERMISSION');
    err.isPermission = true;
    throw err;
  }
  if (r.error || !fs.existsSync(tmpFile)) {
    throw new Error('screencapture failed: ' + (r.stderr || r.error?.message || 'unknown'));
  }
  const buf = fs.readFileSync(tmpFile);
  try { fs.unlinkSync(tmpFile); } catch {}
  return buf;
}

function handleCaptureError(e) {
  if (e.isPermission || e.message === 'SCREEN_PERMISSION') {
    showToast({
      type: 'error',
      message: '⚠ Screen Recording permission needed.\nGo to: System Settings → Privacy & Security → Screen Recording → enable Electron',
    }, 8000);
  } else {
    showToast({ type: 'error', message: '⚠ Capture failed. ' + e.message }, 5000);
  }
}

// Crop a PNG buffer using macOS sips
function cropPng(srcPath, x, y, w, h) {
  const dstPath = path.join(os.tmpdir(), `vt_crop_${Date.now()}.png`);
  const r = spawnSync('sips', [
    '-c', String(Math.round(h)), String(Math.round(w)),
    '--cropOffset', String(Math.round(y)), String(Math.round(x)),
    srcPath, '-o', dstPath,
  ], { encoding: 'utf8', timeout: 8000 });
  if (!r.error && fs.existsSync(dstPath)) return dstPath;
  return null;
}

// Call vision-translate API
function visionTranslate(imgPath, lang) {
  const r = spawnSync('curl', [
    '-s', '-X', 'POST',
    'http://127.0.0.1:8000/api/vision-translate',
    '-F', `file=@${imgPath};type=image/png`,
    '-F', `target_language=${lang}`,
  ], { encoding: 'utf8', timeout: 60000 });
  if (r.error || r.status !== 0) throw new Error(r.stderr || 'curl failed');
  return JSON.parse(r.stdout);
}

// ── Bubble ────────────────────────────────────────────────────────────────────
function createBubble() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const bw = 56, bh = 56;
  bubbleWin = new BrowserWindow({
    width: bw, height: bh,
    x: Math.round(width / 2 - bw / 2), y: height - bh - 20,
    frame: false, transparent: true, alwaysOnTop: true,
    skipTaskbar: true, resizable: false, movable: true, hasShadow: false,
    show: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  bubbleWin.loadFile('bubble.html');
  bubbleWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  bubbleWin.setAlwaysOnTop(true, 'screen-saver');
  bubbleWin.on('closed', () => { bubbleWin = null; });
}

// ── Mode menu ─────────────────────────────────────────────────────────────────
function createModeMenu() {
  modeMenuWin = new BrowserWindow({
    width: 230, height: 116,
    frame: false, transparent: true, alwaysOnTop: true,
    skipTaskbar: true, resizable: false, movable: false, hasShadow: false,
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  modeMenuWin.loadFile('mode-menu.html');
  modeMenuWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  modeMenuWin.setAlwaysOnTop(true, 'screen-saver');
  modeMenuWin.on('blur', () => { if (!isOverlayOpen) hideModeMenu(); });
  modeMenuWin.on('closed', () => { modeMenuWin = null; isModeMenuOpen = false; });
}

function positionModeMenu() {
  if (!modeMenuWin || !bubbleWin) return;
  const [bx, by] = bubbleWin.getPosition();
  const [bw] = bubbleWin.getSize();
  const [mw, mh] = modeMenuWin.getSize();
  const display = screen.getDisplayNearestPoint({ x: bx, y: by });
  const wa = display.workArea;
  let x = bx - Math.round((mw - bw) / 2);
  let y = by - mh - 12;
  x = Math.max(wa.x + 8, Math.min(x, wa.x + wa.width - mw - 8));
  y = Math.max(wa.y + 8, y);
  modeMenuWin.setPosition(Math.round(x), Math.round(y));
}

function showModeMenu() {
  if (!isBubbleEnabled) return;
  if (!modeMenuWin) createModeMenu();
  positionModeMenu();
  modeMenuWin.show(); modeMenuWin.focus();
  isModeMenuOpen = true;
  if (bubbleWin) bubbleWin.webContents.send('panel-state', true);
}

function hideModeMenu() {
  if (modeMenuWin && isModeMenuOpen) {
    modeMenuWin.hide(); isModeMenuOpen = false;
    if (!isOverlayOpen && bubbleWin) bubbleWin.webContents.send('panel-state', false);
  }
}

// ── Overlay (translation panel) ───────────────────────────────────────────────
function createOverlay() {
  overlayWin = new BrowserWindow({
    width: 680, height: 500,
    frame: false, transparent: true, alwaysOnTop: true,
    skipTaskbar: true, resizable: false, movable: true, hasShadow: false,
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  overlayWin.loadFile('overlay.html');
  overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.on('closed', () => { overlayWin = null; isOverlayOpen = false; });
}

function positionOverlay() {
  if (!overlayWin || !bubbleWin) return;
  const [bx, by] = bubbleWin.getPosition();
  const [bw] = bubbleWin.getSize();
  const [ow, oh] = overlayWin.getSize();
  const display = screen.getDisplayNearestPoint({ x: bx, y: by });
  const wa = display.workArea;
  let x = bx - Math.round((ow - bw) / 2);
  let y = by - oh - 20;
  x = Math.max(wa.x + 8, Math.min(x, wa.x + wa.width - ow - 8));
  y = Math.max(wa.y + 8, y);
  overlayWin.setPosition(Math.round(x), Math.round(y));
}

function showOverlay(mode) {
  if (!overlayWin) createOverlay();
  hideModeMenu();
  positionOverlay();
  overlayWin.show(); overlayWin.focus();
  isOverlayOpen = true;
  widgetConfig.mode = mode;
  overlayWin.webContents.send('set-mode', mode);
  overlayWin.webContents.send('set-config', widgetConfig);
  if (bubbleWin) bubbleWin.webContents.send('panel-state', true);
}

function hideOverlay() {
  if (overlayWin && isOverlayOpen) {
    overlayWin.hide(); isOverlayOpen = false;
    if (bubbleWin) bubbleWin.webContents.send('panel-state', false);
  }
}

// ── Screen overlay — ALWAYS click-through, only shows labels ─────────────────
function createScreenOverlay() {
  const { bounds } = screen.getPrimaryDisplay();
  screenOverlayWin = new BrowserWindow({
    x: bounds.x, y: bounds.y,
    width: bounds.width, height: bounds.height,
    frame: false, transparent: true, alwaysOnTop: true,
    skipTaskbar: true, resizable: false, movable: false, hasShadow: false,
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  screenOverlayWin.loadFile('screen-overlay.html');
  screenOverlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  screenOverlayWin.setAlwaysOnTop(true, 'screen-saver');
  // ALWAYS ignore mouse events — this window NEVER blocks the screen
  screenOverlayWin.setIgnoreMouseEvents(true, { forward: true });
  screenOverlayWin.on('closed', () => { screenOverlayWin = null; });
}

function ensureScreenOverlay() {
  if (!screenOverlayWin) createScreenOverlay();
  if (!screenOverlayWin.isVisible()) screenOverlayWin.show();
}

function clearScreenOverlay() {
  if (screenOverlayWin) {
    screenOverlayWin.webContents.send('clear');
  }
}

// ── Region select window — temporary, closes after drag ──────────────────────
let regionSelectorTimeout = null;

function openRegionSelector(lang) {
  if (regionSelectWin) { try { regionSelectWin.close(); } catch {} regionSelectWin = null; }
  if (regionSelectorTimeout) { clearTimeout(regionSelectorTimeout); regionSelectorTimeout = null; }

  const { bounds } = screen.getPrimaryDisplay();
  regionSelectWin = new BrowserWindow({
    x: bounds.x, y: bounds.y,
    width: bounds.width, height: bounds.height,
    frame: false, transparent: true, alwaysOnTop: true,
    skipTaskbar: true, resizable: false, movable: false, hasShadow: false,
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  regionSelectWin.loadFile('region-select.html');
  regionSelectWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  regionSelectWin.setAlwaysOnTop(true, 'screen-saver');
  regionSelectWin.setIgnoreMouseEvents(false);
  regionSelectWin.on('closed', () => {
    regionSelectWin = null;
    if (regionSelectorTimeout) { clearTimeout(regionSelectorTimeout); regionSelectorTimeout = null; }
  });
  regionSelectWin.once('ready-to-show', () => {
    regionSelectWin.show();
    regionSelectWin.focus();
    regionSelectWin.webContents.send('init', { lang });
    // Safety timeout — if user doesn't select within 30s, auto-close to unfreeze screen
    regionSelectorTimeout = setTimeout(() => {
      closeRegionSelector();
      showToast({ type: 'info', message: 'Region selection timed out.' }, 3000);
    }, 30000);
  });
}

function closeRegionSelector() {
  if (regionSelectorTimeout) { clearTimeout(regionSelectorTimeout); regionSelectorTimeout = null; }
  if (regionSelectWin) {
    try { regionSelectWin.close(); } catch {}
    regionSelectWin = null;
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function createToast() {
  toastWin = new BrowserWindow({
    width: 360, height: 100,
    frame: false, transparent: true, alwaysOnTop: true,
    skipTaskbar: true, resizable: false, movable: false, hasShadow: false,
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  toastWin.loadFile('toast.html');
  toastWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  toastWin.setAlwaysOnTop(true, 'screen-saver');
  toastWin.on('closed', () => { toastWin = null; });
}

function positionToast() {
  if (!toastWin || !bubbleWin) return;
  const [bx, by] = bubbleWin.getPosition();
  const [bw] = bubbleWin.getSize();
  const [tw, th] = toastWin.getSize();
  const display = screen.getDisplayNearestPoint({ x: bx, y: by });
  const wa = display.workArea;
  let x = bx - Math.round((tw - bw) / 2);
  let y = by - th - 14;
  x = Math.max(wa.x + 8, Math.min(x, wa.x + wa.width - tw - 8));
  y = Math.max(wa.y + 8, y);
  toastWin.setPosition(Math.round(x), Math.round(y));
}

function showToast(data, autoDismissMs = 4000) {
  if (!toastWin) createToast();
  const lines = Math.ceil((data.message || '').length / 38);
  const h = Math.min(Math.max(80, 60 + lines * 20), 180);
  toastWin.setSize(360, h);
  positionToast();
  toastWin.showInactive();
  toastWin.webContents.send('toast-data', data);
  if (toastTimer) clearTimeout(toastTimer);
  if (autoDismissMs > 0) {
    toastTimer = setTimeout(() => { if (toastWin) toastWin.hide(); }, autoDismissMs);
  }
}

// ── Startup permission check ──────────────────────────────────────────────────
function checkScreenPermission() {
  const testFile = path.join(os.tmpdir(), `vt_permcheck_${Date.now()}.png`);
  const r = spawnSync('screencapture', ['-x', '-t', 'png', testFile], {
    encoding: 'utf8', timeout: 5000,
  });
  const ok = !r.error && fs.existsSync(testFile);
  try { if (ok) fs.unlinkSync(testFile); } catch {}
  return ok;
}

// ── App ready ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  startControlServer();
  createBubble();
  createModeMenu();
  createOverlay();
  createToast();
  createScreenOverlay();

  // Main toggle shortcut
  const toggleShortcut = process.platform === 'darwin' ? 'Command+Shift+Space' : 'Control+Shift+Space';
  globalShortcut.register(toggleShortcut, () => {
    if (!isBubbleEnabled) return;
    if (isModeMenuOpen) hideModeMenu();
    else if (isOverlayOpen) hideOverlay();
    else showModeMenu();
  });
});

app.on('window-all-closed', e => e.preventDefault());
app.on('will-quit', () => globalShortcut.unregisterAll());

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.on('toggle-panel', () => {
  if (!isBubbleEnabled) return;
  if (isModeMenuOpen) hideModeMenu();
  else if (isOverlayOpen) hideOverlay();
  else showModeMenu();
});

ipcMain.on('select-mode', (_, mode) => { showOverlay(mode); });
ipcMain.on('hide-overlay', () => hideOverlay());

// Dev: Cmd+Shift+I opens DevTools on overlay
ipcMain.on('open-devtools', () => { if (overlayWin) overlayWin.webContents.openDevTools({ mode: 'detach' }); });

ipcMain.on('show-toast', (_, data) => {
  const ms = data.type === 'info' ? 6000 : data.type === 'loading' ? 0 : 4000;
  showToast(data, ms);
});

ipcMain.on('hide-toast', () => {
  if (toastWin) toastWin.hide();
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
});

ipcMain.on('bubble-drag', (_, { x, y }) => {
  if (bubbleWin) {
    bubbleWin.setPosition(Math.round(x), Math.round(y));
    if (isModeMenuOpen) positionModeMenu();
    if (isOverlayOpen) positionOverlay();
  }
});

ipcMain.handle('get-bubble-pos', () => {
  if (!bubbleWin) return { x: 0, y: 0 };
  const [x, y] = bubbleWin.getPosition();
  return { x, y };
});

// ── Screen translation actions ────────────────────────────────────────────────

// TRANSLATE FULL SCREEN
ipcMain.on('action-translate-screen', async (_, { lang, mode }) => {
  const tgtLang = mode === 'nativeToEnglish' ? 'en-IN' : (lang || 'hi-IN');

  if (overlayWin) overlayWin.hide();
  if (toastWin) toastWin.hide();
  if (screenOverlayWin) screenOverlayWin.hide();
  await new Promise(r => setTimeout(r, 300));

  showToast({ type: 'loading', message: 'Scanning screen…' }, 0);

  try {
    const pngBuf = await captureScreen();
    const tmpImg = path.join(os.tmpdir(), `vt_screen_${Date.now()}.png`);
    fs.writeFileSync(tmpImg, pngBuf);

    showToast({ type: 'loading', message: 'Translating screen text…' }, 0);

    const data = visionTranslate(tmpImg, tgtLang);
    try { fs.unlinkSync(tmpImg); } catch {}

    const regions = data.regions || [];
    if (regions.length === 0) {
      showToast({ type: 'info', message: 'No text found on screen.' }, 4000);
      return;
    }

    ensureScreenOverlay();
    const { bounds } = screen.getPrimaryDisplay();
    screenOverlayWin.webContents.send('show-translations', {
      regions, offsetX: 0, offsetY: 0,
      screenWidth: bounds.width, screenHeight: bounds.height,
    });
    showToast({ type: 'success', message: `✓ Translated ${regions.length} text regions on screen` }, 5000);

  } catch (e) {
    console.error('action-translate-screen error:', e);
    handleCaptureError(e);
  }
});

// SELECT REGION — opens a temporary full-screen selector window
ipcMain.on('action-translate-region', (_, { lang, mode }) => {
  const tgtLang = mode === 'nativeToEnglish' ? 'en-IN' : (lang || 'hi-IN');
  if (toastWin) toastWin.hide();
  // Show a hint toast so user knows what to do
  showToast({ type: 'info', message: 'Drag to select a region. Press Esc to cancel.' }, 0);
  openRegionSelector(tgtLang);
});

// Region selector sends this when drag is complete
ipcMain.on('region-selected', async (_, { x, y, w, h, lang }) => {
  closeRegionSelector();
  if (toastWin) toastWin.hide();
  await new Promise(r => setTimeout(r, 200)); // let region window fully close
  showToast({ type: 'loading', message: 'Translating selected region…' }, 0);

  try {
    const pngBuf = await captureScreen();
    const tmpImg = path.join(os.tmpdir(), `vt_full_${Date.now()}.png`);
    fs.writeFileSync(tmpImg, pngBuf);

    const croppedPath = cropPng(tmpImg, x, y, w, h);
    try { fs.unlinkSync(tmpImg); } catch {}

    const imgToSend = croppedPath || tmpImg;
    const data = visionTranslate(imgToSend, lang);
    if (croppedPath) try { fs.unlinkSync(croppedPath); } catch {}

    const regions = data.regions || [];
    if (regions.length === 0) {
      showToast({ type: 'info', message: 'No text found in selected region.' }, 4000);
      return;
    }

    ensureScreenOverlay();
    screenOverlayWin.webContents.send('show-translations', {
      regions, offsetX: x, offsetY: y,
      screenWidth: w, screenHeight: h,
    });
    showToast({ type: 'success', message: `✓ Translated ${regions.length} text regions` }, 4000);

  } catch (e) {
    console.error('region-selected error:', e);
    handleCaptureError(e);
  }
});

// Region selector cancelled (Esc or timeout)
ipcMain.on('region-cancelled', () => {
  closeRegionSelector();
  if (toastWin) toastWin.hide();
});

// CLICK MODE — transparent full-screen overlay captures real mouse clicks
// User just clicks on any text in any app — no keyboard shortcut needed
let clickOverlayWin = null;

function openClickOverlay(lang) {
  if (clickOverlayWin) { try { clickOverlayWin.close(); } catch {} clickOverlayWin = null; }

  const { bounds } = screen.getPrimaryDisplay();
  clickOverlayWin = new BrowserWindow({
    x: bounds.x, y: bounds.y,
    width: bounds.width, height: bounds.height,
    frame: false, transparent: true, alwaysOnTop: true,
    skipTaskbar: true, resizable: false, movable: false, hasShadow: false,
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  clickOverlayWin.loadFile('click-overlay.html');
  clickOverlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  clickOverlayWin.setAlwaysOnTop(true, 'screen-saver');
  // Captures clicks but forwards everything else
  clickOverlayWin.setIgnoreMouseEvents(false);
  clickOverlayWin.on('closed', () => {
    clickOverlayWin = null;
    isClickModeActive = false;
    if (bubbleWin) bubbleWin.webContents.send('screen-mode', false);
  });
  clickOverlayWin.once('ready-to-show', () => {
    clickOverlayWin.show();
    clickOverlayWin.webContents.send('init', { lang });
  });
}

function closeClickOverlay() {
  if (clickOverlayWin) { try { clickOverlayWin.close(); } catch {} clickOverlayWin = null; }
}

ipcMain.on('action-click-mode', (_, { lang, mode }) => {
  const tgtLang = mode === 'nativeToEnglish' ? 'en-IN' : (lang || 'hi-IN');
  isClickModeActive = true;
  clickModeLang = tgtLang;
  openClickOverlay(tgtLang);
  if (bubbleWin) bubbleWin.webContents.send('screen-mode', true);
});

// ── Accessibility text reader (macOS AX API — works on ANY app, no screenshot) ──
const AX_HELPER = path.join(__dirname, 'ax_text_at_cursor');

function getTextViaAX(x, y) {
  try {
    const r = spawnSync(AX_HELPER, [String(x), String(y)], { encoding: 'utf8', timeout: 3000 });
    if (r.error || r.status !== 0) return null;
    const parsed = JSON.parse(r.stdout.trim());
    return parsed.text && parsed.text.trim() ? parsed.text.trim() : null;
  } catch { return null; }
}

// Translate plain text via backend
function translateText(text, lang) {
  const body = JSON.stringify({
    text,
    source_language: 'en-IN',
    target_language: lang,
  });
  const r = spawnSync('curl', [
    '-s', '-X', 'POST',
    'http://127.0.0.1:8000/api/translate-text',
    '-H', 'Content-Type: application/json',
    '-d', body,
  ], { encoding: 'utf8', timeout: 30000 });
  if (r.error || r.status !== 0) throw new Error(r.stderr || 'curl failed');
  return JSON.parse(r.stdout);
}

// Called from click-overlay.html when user clicks on screen
ipcMain.on('click-translate', async (_, { x, y, lang }) => {
  try {
    // ── FAST PATH: try Accessibility API first (instant, no screenshot needed) ──
    const axText = getTextViaAX(x, y);

    if (axText) {
      // Got text directly from the app — translate it immediately
      const data = translateText(axText, lang);
      const translated = data.translated_text || axText;

      if (clickOverlayWin) {
        clickOverlayWin.webContents.send('show-result', {
          regions: [{ translated, original: axText, x: 0.5, y: 0.5 }],
          offsetX: x - 150, offsetY: y - 60,
          regionW: 300, regionH: 120,
          clickX: x, clickY: y,
        });
      }
      return;
    }

    // ── FALLBACK: screenshot + OCR (for apps that block AX, like games, PDFs) ──
    if (clickOverlayWin) clickOverlayWin.hide();
    await new Promise(r => setTimeout(r, 180));

    const REGION_W = 480, REGION_H = 220;
    const { bounds } = screen.getPrimaryDisplay();
    const rx = Math.max(0, Math.min(Math.round(x - REGION_W / 2), bounds.width - REGION_W));
    const ry = Math.max(0, Math.min(Math.round(y - REGION_H / 2), bounds.height - REGION_H));

    const pngBuf = await captureScreen();
    const tmpImg = path.join(os.tmpdir(), `vt_click_${Date.now()}.png`);
    fs.writeFileSync(tmpImg, pngBuf);

    const croppedPath = cropPng(tmpImg, rx, ry, REGION_W, REGION_H);
    try { fs.unlinkSync(tmpImg); } catch {}

    const imgToSend = croppedPath || tmpImg;
    const data = visionTranslate(imgToSend, lang);
    if (croppedPath) try { fs.unlinkSync(croppedPath); } catch {}

    if (clickOverlayWin) {
      clickOverlayWin.show();
      const regions = data.regions || [];
      clickOverlayWin.webContents.send('show-result', {
        regions, offsetX: rx, offsetY: ry,
        regionW: REGION_W, regionH: REGION_H,
        clickX: x, clickY: y,
        message: regions.length === 0 ? 'No text found here' : null,
      });
    }
  } catch (e) {
    if (clickOverlayWin) clickOverlayWin.show();
    console.error('click-translate error:', e);
    handleCaptureError(e);
  }
});

ipcMain.on('stop-click-mode', () => {
  isClickModeActive = false;
  closeClickOverlay();
  if (bubbleWin) bubbleWin.webContents.send('screen-mode', false);
  if (toastWin) toastWin.hide();
});

// RESTORE — clear all screen overlays
ipcMain.on('action-restore', () => {
  isClickModeActive = false;
  closeClickOverlay();
  clearScreenOverlay();
  if (bubbleWin) bubbleWin.webContents.send('screen-mode', false);
  showToast({ type: 'success', message: '✓ Screen restored' }, 3000);
});

// Stop screen mode from overlay's stop button
ipcMain.on('stop-screen-mode', () => {
  isClickModeActive = false;
  closeClickOverlay();
  clearScreenOverlay();
  if (bubbleWin) bubbleWin.webContents.send('screen-mode', false);
  if (toastWin) toastWin.hide();
});

// ── Open Gmail compose with pre-filled subject + body ────────────────────────
ipcMain.on('open-gmail-compose', (_, { subject, body }) => {
  const su = encodeURIComponent(subject || '');
  const bd = encodeURIComponent(body || '');
  const url = `https://mail.google.com/mail/?view=cm&fs=1&su=${su}&body=${bd}`;

  // Open in the default browser
  const { shell } = require('electron');
  shell.openExternal(url);

  showToast({ type: 'success', message: '✓ Opened Gmail compose with subject & body' }, 3000);
});

// ── Send to compose — fills Gmail/Slack directly via external shell script ──
ipcMain.on('send-to-compose', (_, { subject, body, target }) => {
  hideOverlay();
  if (toastWin) toastWin.hide();

  setTimeout(() => {
    const scriptPath = path.join(__dirname, 'fill_compose.sh');
    const r = spawnSync('bash', [scriptPath, target || 'gmail', subject || '', body || ''], {
      encoding: 'utf8', timeout: 12000,
    });
    console.log('[fill_compose] stdout:', r.stdout?.trim(), 'stderr:', r.stderr?.trim());
    if (r.error) {
      showToast({ type: 'error', message: '⚠ Could not fill compose box.' }, 4000);
    } else {
      const label = target === 'gmail' ? 'Gmail' : target === 'slack' ? 'Slack' : 'compose';
      showToast({ type: 'success', message: `✓ ${label} compose filled` }, 3000);
    }
  }, 400);
});

// ── Get active browser URL for domain detection ───────────────────────────────
ipcMain.on('get-active-url', (event) => {
  // Try to get URL from frontmost Chrome/Safari/Firefox window via AppleScript
  const script = `
    tell application "System Events"
      set frontApp to name of first application process whose frontmost is true
    end tell
    if frontApp is "Google Chrome" then
      tell application "Google Chrome" to return URL of active tab of front window
    else if frontApp is "Safari" then
      tell application "Safari" to return URL of current tab of front window
    else if frontApp is "Firefox" then
      tell application "Firefox" to return URL of active tab of front window
    else
      return ""
    end if
  `;
  const r = spawnSync('osascript', ['-e', script], { encoding: 'utf8', timeout: 3000 });
  const url = (r.stdout || '').trim();
  event.reply('active-url', url || null);
});

// ── Send text to visible textbox on active page (WhatsApp, LinkedIn, etc.) ────
ipcMain.on('send-to-active-textbox', (_, { text, target }) => {
  if (!text) return;
  hideOverlay();
  if (toastWin) toastWin.hide();

  // Domain-specific selectors for common apps
  const SELECTORS = {
    whatsapp:  `document.querySelector('div[contenteditable="true"][data-tab="10"], footer div[contenteditable="true"]')`,
    linkedin:  `document.querySelector('div.msg-form__contenteditable, div[contenteditable="true"].ql-editor, div[role="textbox"]')`,
    twitter:   `document.querySelector('div[data-testid="tweetTextarea_0"], div[contenteditable="true"][role="textbox"]')`,
    discord:   `document.querySelector('div[role="textbox"][contenteditable="true"]')`,
    teams:     `document.querySelector('div[contenteditable="true"][role="textbox"]')`,
    notion:    `document.querySelector('div[contenteditable="true"].notranslate, div[data-content-editable-leaf="true"]')`,
    gdocs:     `document.querySelector('.kix-appview-editor div[contenteditable="true"]')`,
    default:   `document.querySelector('textarea:not([readonly]):not([disabled]), input[type="text"]:not([readonly]):not([disabled]), div[contenteditable="true"]')`,
  };

  const selector = SELECTORS[target] || SELECTORS.default;

  // Inject via AppleScript → Chrome execute script
  const jsCode = `
    (function() {
      const el = ${selector};
      if (!el) return 'NOT_FOUND';
      el.focus();
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value') ||
                             Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        if (nativeSetter) nativeSetter.set.call(el, ${JSON.stringify(text)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        // contenteditable
        el.textContent = ${JSON.stringify(text)};
        el.dispatchEvent(new InputEvent('input', { bubbles: true, data: ${JSON.stringify(text)} }));
      }
      return 'OK';
    })()
  `;

  const appleScript = `
    tell application "Google Chrome"
      set result to execute active tab of front window javascript "${jsCode.replace(/"/g, '\\"').replace(/\n/g, ' ')}"
    end tell
    return result
  `;

  setTimeout(() => {
    const r = spawnSync('osascript', ['-e', appleScript], { encoding: 'utf8', timeout: 5000 });
    const out = (r.stdout || '').trim();
    if (out === 'NOT_FOUND' || r.error) {
      // Fallback: clipboard paste
      const { clipboard } = require('electron');
      clipboard.writeText(text);
      showToast({ type: 'success', message: '✓ Copied! Press ⌘V to paste' }, 4000);
    } else {
      const label = target ? target.charAt(0).toUpperCase() + target.slice(1) : 'Textbox';
      showToast({ type: 'success', message: `✓ Sent to ${label}` }, 3000);
    }
  }, 400);
});
