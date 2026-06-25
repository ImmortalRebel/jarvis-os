// electron/main.ts
// Jarvis OS Electron main process — Phase 2B upgrade.
// Compile with: pnpm electron:build (uses tsconfig.electron.json)
// NOT compiled by Next.js (electron/ is in tsconfig.json "exclude" array).

import {
  app, BrowserWindow, ipcMain, Tray, Menu,
  nativeImage, shell, globalShortcut, systemPreferences,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { IPC_CHANNELS } from '../lib/ipc/channels';

// ─────────────────────────────────────────
// ENVIRONMENT
// ─────────────────────────────────────────

const isDev = process.env.NODE_ENV === 'development';
const NEXT_DEV_URL = 'http://localhost:3000';
const NEXT_PROD_FILE = path.join(__dirname, '../out/index.html');

// ─────────────────────────────────────────
// GLOBALS
// ─────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let wakeWordActive = false;

// ─────────────────────────────────────────
// WINDOW
// ─────────────────────────────────────────

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    transparent: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#09090b',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    show: false,
  });

  if (isDev) {
    win.loadURL(NEXT_DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(NEXT_PROD_FILE);
  }

  win.once('ready-to-show', () => { win.show(); win.focus(); });

  win.on('closed', () => { mainWindow = null; });

  // Block new window creation — open externally instead
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

// ─────────────────────────────────────────
// TRAY
// ─────────────────────────────────────────

function createTray(): Tray {
  const iconPath = path.join(__dirname, '../public/tray-icon.png');
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16 })
    : nativeImage.createEmpty();

  const t = new Tray(icon);

  const rebuild = () => {
    const menuItems = [
      {
        label: 'Show Jarvis',
        click: () => { mainWindow?.show(); mainWindow?.focus(); },
      },
      { type: 'separator' as const },
      {
        label: wakeWordActive ? 'Disable Wake Word' : 'Enable Wake Word',
        click: () => {
          wakeWordActive ? stopWakeWord() : startWakeWord({ phrase: 'Hey Jarvis', threshold: 0.6 });
          rebuild();
        },
      },
      { type: 'separator' as const },
      { label: 'Quit Jarvis', click: () => app.quit() },
    ];
    t.setContextMenu(Menu.buildFromTemplate(menuItems));
  };

  rebuild();
  t.setToolTip('Jarvis OS');
  t.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
    mainWindow?.webContents.send(IPC_CHANNELS.SYSTEM_TRAY_CLICK);
  });

  return t;
}

// ─────────────────────────────────────────
// WAKE WORD
// ─────────────────────────────────────────

function startWakeWord(config: { phrase: string; threshold: number }): void {
  wakeWordActive = true;
  console.log(`[Jarvis] Wake word started: "${config.phrase}" (${config.threshold})`);

  // ─────────────────────────────────────────────────────────────────────
  // TODO: Replace this stub with a real wake word engine.
  //
  // Option A — Porcupine (recommended):
  //   const { Porcupine } = require('@picovoice/porcupine-node')
  //   porcupine = new Porcupine(accessKey, [BuiltInKeyword.JARVIS], [config.threshold])
  //   // In audio loop: if (porcupine.process(pcmFrame) >= 0) fireWake()
  //
  // Option B — Snowboy (legacy):
  //   const Snowboy = require('snowboy')
  //
  // When detected, call:
  //   mainWindow?.webContents.send(IPC_CHANNELS.WAKE_WORD_DETECTED, 0.9)
  // ─────────────────────────────────────────────────────────────────────
}

function stopWakeWord(): void {
  wakeWordActive = false;
  console.log('[Jarvis] Wake word stopped');
  // TODO: Clean up your wake word engine instance here
}

function fireWakeWord(confidence: number): void {
  if (!mainWindow) return;
  mainWindow.webContents.send(IPC_CHANNELS.WAKE_WORD_DETECTED, confidence);
  mainWindow.webContents.send(IPC_CHANNELS.JARVIS_WAKE);
  if (!mainWindow.isVisible()) {
    mainWindow.show();
    mainWindow.focus();
  }
}

// ─────────────────────────────────────────
// GLOBAL SHORTCUTS (Electron-registered)
// ─────────────────────────────────────────

function registerGlobalShortcuts(): void {
  // Ctrl+Shift+J — toggle Jarvis from anywhere on the system
  const registered = globalShortcut.register('CommandOrControl+Shift+J', () => {
    if (!mainWindow) return;
    if (!mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
    mainWindow.webContents.send(IPC_CHANNELS.JARVIS_WAKE);
  });

  if (!registered) {
    console.warn('[Jarvis] Global shortcut Ctrl+Shift+J could not be registered (may be in use)');
  }
}

// ─────────────────────────────────────────
// IPC HANDLERS
// ─────────────────────────────────────────

function registerIPCHandlers(): void {

  // ── Window controls ──────────────────────────────────────────────────
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.close());
  ipcMain.on('window:always-on-top', (_e, value: boolean) => {
    mainWindow?.setAlwaysOnTop(value);
  });

  // ── System info ──────────────────────────────────────────────────────
  ipcMain.handle('system:get-platform', () => process.platform);
  ipcMain.handle('system:get-version', () => app.getVersion());

  // ── Microphone permission (macOS) ────────────────────────────────────
  ipcMain.handle('system:request-mic-permission', async () => {
    if (process.platform === 'darwin') {
      const status = systemPreferences.getMediaAccessStatus('microphone');
      if (status === 'not-determined') {
        return await systemPreferences.askForMediaAccess('microphone');
      }
      return status === 'granted';
    }
    return true; // Windows/Linux — handled by browser
  });

  // ── User data (key-value persistence) ───────────────────────────────
  const dataDir = app.getPath('userData');
  const dataFile = path.join(dataDir, 'jarvis-data.json');

  const readStore = (): Record<string, string> => {
    try { return JSON.parse(fs.readFileSync(dataFile, 'utf-8')); }
    catch { return {}; }
  };
  const writeStore = (data: Record<string, string>) => {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf-8');
  };

  ipcMain.handle('userdata:read', (_e, key: string) => readStore()[key] ?? null);
  ipcMain.handle('userdata:write', (_e, key: string, value: string) => {
    const s = readStore(); s[key] = value; writeStore(s);
  });

  // ── Wake word engine ─────────────────────────────────────────────────
  ipcMain.handle('wakeword:start', (_e, config: { phrase: string; threshold: number }) => {
    startWakeWord(config);
  });
  ipcMain.handle('wakeword:stop', () => stopWakeWord());

  // Dev tool: simulate wake word via IPC (for testing without a mic)
  ipcMain.handle('wakeword:simulate', (_e, confidence = 0.95) => {
    if (isDev) fireWakeWord(confidence);
  });

  // ── Audio devices ───────────────────────────────────────────────────
  // Device enumeration is handled in the renderer via navigator.mediaDevices.
  // These stubs exist for future native audio routing.
  ipcMain.handle('audio:get-devices', async () => []);
  ipcMain.handle('audio:set-input', () => {});
  ipcMain.handle('audio:set-output', () => {});

  // ── Jarvis mode changes from renderer ───────────────────────────────
  ipcMain.on(IPC_CHANNELS.JARVIS_SLEEP, () => {
    stopWakeWord();
  });

  // ── App info ─────────────────────────────────────────────────────────
  ipcMain.handle('app:is-dev', () => isDev);
}

// ─────────────────────────────────────────
// APP LIFECYCLE
// ─────────────────────────────────────────

app.whenReady().then(() => {
  registerIPCHandlers();
  mainWindow = createWindow();
  tray = createTray();
  registerGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    globalShortcut.unregisterAll();
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopWakeWord();
});

// Security: prevent navigation away from the app
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-navigate', (event, url) => {
    const allowed = isDev
      ? [NEXT_DEV_URL]
      : [`file://${path.resolve(__dirname, '../out')}`];
    if (!allowed.some((base) => url.startsWith(base))) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
});
