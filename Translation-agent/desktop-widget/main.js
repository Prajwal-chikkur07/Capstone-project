const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('path');
const http = require('http');

let floatingIcon = null;
let panelWindow = null;
let isPanelOpen = false;
let isBubbleEnabled = false;  // hidden by default — React app enables it

// ── Local control server (React app talks to this) ────────────────────────────
function startControlServer() {
  const server = http.createServer((req, res) => {
    // CORS headers so React app can call it
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    const url = req.url;

    if (url === '/status') {
      res.writeHead(200);
      res.end(JSON.stringify({ enabled: isBubbleEnabled, panelOpen: isPanelOpen }));

    } else if (url === '/enable') {
      isBubbleEnabled = true;
      if (floatingIcon) floatingIcon.show();
      res.writeHead(200);
      res.end(JSON.stringify({ enabled: true }));

    } else if (url === '/disable') {
      isBubbleEnabled = false;
      if (floatingIcon) floatingIcon.hide();
      if (isPanelOpen) hidePanel();
      if (panelWindow) panelWindow.hide();
      res.writeHead(200);
      res.end(JSON.stringify({ enabled: false }));

    } else if (url === '/toggle') {
      isBubbleEnabled = !isBubbleEnabled;
      if (isBubbleEnabled) { if (floatingIcon) floatingIcon.show(); }
      else { if (floatingIcon) floatingIcon.hide(); if (isPanelOpen) hidePanel(); }
      res.writeHead(200);
      res.end(JSON.stringify({ enabled: isBubbleEnabled }));

    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  server.listen(27182, '127.0.0.1', () => {
    console.log('Widget control server running on http://127.0.0.1:27182');
  });
}

// ── Floating icon bubble ──────────────────────────────────────────────────────
function createFloatingIcon() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  floatingIcon = new BrowserWindow({
    width: 56,
    height: 56,
    x: width - 76,
    y: height - 80,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    hasShadow: false,
    show: false,   // hidden by default — only shown when user enables via app
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  floatingIcon.loadFile('bubble.html');
  floatingIcon.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  floatingIcon.setAlwaysOnTop(true, 'screen-saver'); // highest level — above everything

  floatingIcon.on('closed', () => { floatingIcon = null; });
}

// ── Panel window ──────────────────────────────────────────────────────────────
function createPanel() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  panelWindow = new BrowserWindow({
    width: 360,
    height: height,
    x: width - 360,
    y: 0,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  panelWindow.loadFile('index.html');
  panelWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  panelWindow.setAlwaysOnTop(true, 'screen-saver');

  panelWindow.on('blur', () => {
    // Close panel when user clicks outside
    hidePanel();
  });

  panelWindow.on('closed', () => { panelWindow = null; isPanelOpen = false; });
}

function showPanel() {
  if (!panelWindow) createPanel();
  panelWindow.show();
  panelWindow.focus();
  isPanelOpen = true;
  // Tell bubble to show active state
  if (floatingIcon) floatingIcon.webContents.send('panel-state', true);
}

function hidePanel() {
  if (panelWindow) {
    panelWindow.hide();
    isPanelOpen = false;
    if (floatingIcon) floatingIcon.webContents.send('panel-state', false);
  }
}

function togglePanel() {
  if (!isBubbleEnabled) return;  // respect the enabled state
  if (isPanelOpen) hidePanel();
  else showPanel();
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  startControlServer();
  createFloatingIcon();
  createPanel();

  // Global shortcut to toggle panel from anywhere
  const shortcut = process.platform === 'darwin' ? 'Command+Shift+Space' : 'Control+Shift+Space';
  globalShortcut.register(shortcut, togglePanel);
  console.log(`Shortcut registered: ${shortcut}`);
});

app.on('window-all-closed', (e) => e.preventDefault()); // keep running

app.on('will-quit', () => globalShortcut.unregisterAll());

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.on('toggle-panel', () => { if (isBubbleEnabled) togglePanel(); });
ipcMain.on('hide-panel', () => hidePanel());

// Bubble drag — update position
ipcMain.on('bubble-drag', (e, { x, y }) => {
  if (floatingIcon) floatingIcon.setPosition(Math.round(x), Math.round(y));
});

// Return current bubble window position
ipcMain.handle('get-bubble-pos', () => {
  if (!floatingIcon) return { x: 0, y: 0 };
  const [x, y] = floatingIcon.getPosition();
  return { x, y };
});
