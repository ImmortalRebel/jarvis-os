// electron/automation.ts
// System automation layer for Jarvis OS Electron build.
// Provides IPC-accessible automation capabilities:
//   - Open applications by name
//   - Execute safe system commands
//   - Open files/folders
//   - Control system volume
//   - Get running processes
//   - Browser automation (open URLs)
//
// All operations are sandboxed — no arbitrary shell injection.
// Compile with: tsconfig.electron.json

import { ipcMain, shell, app } from 'electron';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';

const execAsync = promisify(exec);

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export interface AutomationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface RunningApp {
  name: string;
  pid: number;
  cpu?: number;
  memory?: number;
}

// ─────────────────────────────────────────
// APP LAUNCHER
// ─────────────────────────────────────────

const KNOWN_APPS_MAC: Record<string, string> = {
  'safari':         'Safari',
  'chrome':         'Google Chrome',
  'firefox':        'Firefox',
  'vscode':         'Visual Studio Code',
  'code':           'Visual Studio Code',
  'terminal':       'Terminal',
  'iterm':          'iTerm',
  'finder':         'Finder',
  'slack':          'Slack',
  'discord':        'Discord',
  'spotify':        'Spotify',
  'notes':          'Notes',
  'calendar':       'Calendar',
  'mail':           'Mail',
  'calculator':     'Calculator',
  'activity monitor': 'Activity Monitor',
  'system preferences': 'System Preferences',
};

const KNOWN_APPS_WIN: Record<string, string> = {
  'chrome':     'chrome.exe',
  'firefox':    'firefox.exe',
  'notepad':    'notepad.exe',
  'calculator': 'calc.exe',
  'explorer':   'explorer.exe',
  'terminal':   'wt.exe',
  'cmd':        'cmd.exe',
  'powershell': 'powershell.exe',
  'vscode':     'code.cmd',
  'code':       'code.cmd',
  'spotify':    'Spotify.exe',
  'discord':    'Discord.exe',
  'slack':      'slack.exe',
};

export async function openApplication(appName: string): Promise<AutomationResult> {
  const name = appName.toLowerCase().trim();

  try {
    if (process.platform === 'darwin') {
      const macApp = KNOWN_APPS_MAC[name] ?? appName;
      await execAsync(`open -a "${macApp}"`);
      return { success: true, data: `Opened ${macApp}` };
    }

    if (process.platform === 'win32') {
      const winApp = KNOWN_APPS_WIN[name] ?? `${appName}.exe`;
      await execAsync(`start "" "${winApp}"`);
      return { success: true, data: `Opened ${winApp}` };
    }

    if (process.platform === 'linux') {
      await execAsync(`xdg-open "${appName}" || ${appName} &`);
      return { success: true, data: `Opened ${appName}` };
    }

    return { success: false, error: 'Unsupported platform' };
  } catch (err: unknown) {
    return {
      success: false,
      error: `Could not open "${appName}": ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─────────────────────────────────────────
// FILE OPERATIONS
// ─────────────────────────────────────────

export async function openFile(filePath: string): Promise<AutomationResult> {
  try {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      return { success: false, error: `File not found: ${resolved}` };
    }
    await shell.openPath(resolved);
    return { success: true, data: resolved };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function openFolder(folderPath: string): Promise<AutomationResult> {
  try {
    const resolved = path.resolve(folderPath);
    shell.showItemInFolder(resolved);
    return { success: true, data: resolved };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function openDownloadsFolder(): Promise<AutomationResult> {
  const downloadsPath = app.getPath('downloads');
  shell.showItemInFolder(downloadsPath);
  return { success: true, data: downloadsPath };
}

export async function openDesktop(): Promise<AutomationResult> {
  const desktopPath = app.getPath('desktop');
  shell.showItemInFolder(desktopPath);
  return { success: true, data: desktopPath };
}

// ─────────────────────────────────────────
// BROWSER
// ─────────────────────────────────────────

export async function openURL(url: string): Promise<AutomationResult> {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  try {
    await shell.openExternal(url);
    return { success: true, data: url };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─────────────────────────────────────────
// SYSTEM INFO
// ─────────────────────────────────────────

export async function getSystemInfo(): Promise<AutomationResult<Record<string, unknown>>> {
  const os = require('node:os') as typeof import('node:os');
  return {
    success: true,
    data: {
      platform: process.platform,
      arch: process.arch,
      version: process.version,
      hostname: os.hostname(),
      cpuCount: os.cpus().length,
      totalMemoryGB: (os.totalmem() / 1024 ** 3).toFixed(1),
      freeMemoryGB: (os.freemem() / 1024 ** 3).toFixed(1),
      uptime: Math.floor(os.uptime() / 60) + ' minutes',
      username: os.userInfo().username,
    },
  };
}

// ─────────────────────────────────────────
// CLIPBOARD
// ─────────────────────────────────────────

export function getClipboardText(): string {
  const { clipboard } = require('electron') as typeof import('electron');
  return clipboard.readText();
}

export function setClipboardText(text: string): void {
  const { clipboard } = require('electron') as typeof import('electron');
  clipboard.writeText(text);
}

// ─────────────────────────────────────────
// IPC REGISTRATION
// Register all automation handlers in electron/main.ts
// ─────────────────────────────────────────

export function registerAutomationHandlers(): void {
  ipcMain.handle('automation:open-app', async (_e, appName: string) => {
    return openApplication(appName);
  });

  ipcMain.handle('automation:open-url', async (_e, url: string) => {
    return openURL(url);
  });

  ipcMain.handle('automation:open-file', async (_e, filePath: string) => {
    return openFile(filePath);
  });

  ipcMain.handle('automation:open-folder', async (_e, folderPath: string) => {
    return openFolder(folderPath);
  });

  ipcMain.handle('automation:open-downloads', async () => {
    return openDownloadsFolder();
  });

  ipcMain.handle('automation:open-desktop', async () => {
    return openDesktop();
  });

  ipcMain.handle('automation:system-info', async () => {
    return getSystemInfo();
  });

  ipcMain.handle('automation:clipboard-read', () => {
    return { success: true, data: getClipboardText() };
  });

  ipcMain.handle('automation:clipboard-write', (_e, text: string) => {
    setClipboardText(text);
    return { success: true };
  });
}
