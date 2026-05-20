// electron/main.ts
// Electron main process — application entry point for the desktop build.
//
// Responsibilities:
//   - Create and manage the BrowserWindow
//   - Serve the Next.js build (or dev server)
//   - Handle IPC messages from the renderer via ipcMain.handle / ipcMain.on
//   - Manage system tray
//   - Route wake-word engine events to the renderer
//
// IMPORTANT: This file is NOT compiled by Next.js.
// It must be compiled by electron-vite / electron-builder separately.
// Suggested tsconfig for electron: tsconfig.electron.json (see SETUP.md)
//
// Dependency note: This file only imports from 'electron' and Node built-ins.
// No Next.js or browser APIs are used here.

import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } from 'electron';
import path from 'node:path';
import { IPC_CHANNELS } from '../lib/ipc/channels';

// ─────────────────────────────────────────
// ENVIRONMENT FLAGS
// ─────────────────────────────────────────

const isDev = process.env.NODE_ENV === 'development';
const NEXT_DEV_URL = 'http://localhost:3000';
// In production, Next.js exports to /out — adjust if you use a custom output dir
const NEXT_PROD_URL = path.join(__dirname, '../out/index.html');

// ─────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// ─────────────────────────────────────────
// WINDOW CREATION
// ─────────────────────────────────────────

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    // Frameless for the Jarvis OS aesthetic — custom title bar in renderer
    frame: false,
    transparent: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#09090b', // Matches --background in globals.css dark theme
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Security hardening
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      // Allow media access for microphone
      webviewTag: false,
    },
    show: false, // Use 'ready-to-show' to prevent white flash
  });

  // ── Load the app ──────────────────────────────────────────────
  if (isDev) {
    win.loadURL(NEXT_DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(NEXT_PROD_URL);
  }

  // ── Show window only when fully loaded (prevents flash) ───────
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  // ── Window events ──────────────────────────────────────────────
  win.on('closed', () => {
    mainWindow = null;
  });

  // Intercept external link clicks — open in system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

// ─────────────────────────────────────────
// SYSTEM TRAY
// ─────────────────────────────────────────

function createTray(): Tray {
  const iconPath = path.join(__dirname, '../public/tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  const t = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Jarvis',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ]);

  t.setToolTip('Jarvis OS');
  t.setContextMenu(contextMenu);

  t.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
    mainWindow?.webContents.send(IPC_CHANNELS.SYSTEM_TRAY_CLICK);
  });

  return t;
}

// ─────────────────────────────────────────
// IPC HANDLERS — Window controls
// ─────────────────────────────────────────

function registerWindowHandlers() {
  ipcMain.on('window:minimize', () => mainWindow?.minimize());

  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('window:close', () => mainWindow?.close());

  ipcMain.on('window:always-on-top', (_event, value: boolean) => {
    mainWindow?.setAlwaysOnTop(value);
  });
}

// ─────────────────────────────────────────
// IPC HANDLERS — System info
// ─────────────────────────────────────────

function registerSystemHandlers() {
  ipcMain.handle('system:get-platform', () => process.platform);
  ipcMain.handle('system:get-version', () => app.getVersion());
}

// ─────────────────────────────────────────
// IPC HANDLERS — User data (simple key-value persistence)
// ─────────────────────────────────────────

function registerUserDataHandlers() {
  // Simple implementation using Electron's app.getPath('userData')
  // In production, replace with electron-store or similar
  const fs = require('node:fs');
  const dataDir = app.getPath('userData');
  const dataFile = path.join(dataDir, 'jarvis-data.json');

  function readStore(): Record<string, string> {
    try {
      return JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    } catch {
      return {};
    }
  }

  function writeStore(data: Record<string, string>) {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  ipcMain.handle('userdata:read', (_event, key: string) => {
    const store = readStore();
    return store[key] ?? null;
  });

  ipcMain.handle('userdata:write', (_event, key: string, value: string) => {
    const store = readStore();
    store[key] = value;
    writeStore(store);
  });
}

// ─────────────────────────────────────────
// IPC HANDLERS — Wake word (stub — replace with Porcupine/Picovoice)
// ─────────────────────────────────────────

function registerWakeWordHandlers() {
  let wakeWordActive = false;

  ipcMain.handle('wakeword:start', (_event, config: { phrase: string; threshold: number }) => {
    wakeWordActive = true;
    console.log(`[main] Wake word detection started: "${config.phrase}" (threshold: ${config.threshold})`);
    // TODO: Initialise your chosen wake word engine here:
    //   - Porcupine: require('@picovoice/porcupine-node')
    //   - Snowboy: (deprecated, use Porcupine)
    //   - Custom: implement your own detector
    //
    // When the phrase is detected, call:
    //   mainWindow?.webContents.send(IPC_CHANNELS.WAKE_WORD_DETECTED, confidence)
  });

  ipcMain.handle('wakeword:stop', () => {
    wakeWordActive = false;
    console.log('[main] Wake word detection stopped');
    // TODO: Stop and clean up your wake word engine
  });

  // For development — simulate a wake word detection via a menu item or shortcut
  if (isDev) {
    // You can call this from the terminal via: mainWindow.webContents.send(...)
    // Or expose it via a dev menu item
  }

  return { get isActive() { return wakeWordActive; } };
}

// ─────────────────────────────────────────
// IPC HANDLERS — Audio devices
// ─────────────────────────────────────────

function registerAudioHandlers() {
  ipcMain.handle('audio:get-devices', async () => {
    // Electron doesn't have a direct API for device enumeration in main.
    // The renderer handles this via navigator.mediaDevices.enumerateDevices().
    // This handler is a stub — return empty and let renderer enumerate.
    return [];
  });

  ipcMain.handle('audio:set-input', (_event, _deviceId: string) => {
    // Audio routing is handled in the renderer via AudioContext constraints.
    // This stub exists for future native audio routing on macOS/Windows.
  });

  ipcMain.handle('audio:set-output', (_event, _deviceId: string) => {
    // Same as above.
  });
}

// ─────────────────────────────────────────
// APP LIFECYCLE
// ─────────────────────────────────────────

app.whenReady().then(() => {
  // Register all IPC handlers before creating the window
  registerWindowHandlers();
  registerSystemHandlers();
  registerUserDataHandlers();
  registerWakeWordHandlers();
  registerAudioHandlers();

  mainWindow = createMainWindow();
  tray = createTray();

  // macOS: Re-create window when dock icon is clicked and no windows exist
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    } else {
      mainWindow?.show();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: prevent new window creation
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (!isDev && !url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
});
