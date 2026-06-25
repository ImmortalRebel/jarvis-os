// electron/permissions.ts
// Native permission management for Jarvis OS Electron build.
// Handles OS-level permissions: microphone, notifications, accessibility, filesystem.
// Called from electron/main.ts — NOT compiled by Next.js.
//
// Compile with: tsconfig.electron.json

import { systemPreferences, shell, app, Notification } from 'electron';
import type { BrowserWindow } from 'electron';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export type PermissionStatus = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown';

export interface PermissionCheckResult {
  microphone: PermissionStatus;
  notifications: PermissionStatus;
  accessibility: PermissionStatus;
  screenCapture: PermissionStatus;
}

// ─────────────────────────────────────────
// MICROPHONE
// ─────────────────────────────────────────

export async function getMicrophonePermission(): Promise<PermissionStatus> {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('microphone');
    return status as PermissionStatus;
  }
  // Windows/Linux — permissions are handled by the browser renderer
  return 'granted';
}

export async function requestMicrophonePermission(): Promise<boolean> {
  if (process.platform === 'darwin') {
    const current = systemPreferences.getMediaAccessStatus('microphone');
    if (current === 'granted') return true;
    if (current === 'denied') {
      // Can't request again — open System Preferences
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
      return false;
    }
    return await systemPreferences.askForMediaAccess('microphone');
  }
  return true;
}

// ─────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────

export function getNotificationPermission(): PermissionStatus {
  if (process.platform === 'darwin') {
    // macOS: Check if notifications are allowed
    const status = Notification.isSupported() ? 'granted' : 'denied';
    return status;
  }
  return Notification.isSupported() ? 'granted' : 'denied';
}

// ─────────────────────────────────────────
// ACCESSIBILITY (macOS only — for automation)
// ─────────────────────────────────────────

export function getAccessibilityPermission(): PermissionStatus {
  if (process.platform === 'darwin') {
    const trusted = systemPreferences.isTrustedAccessibilityClient(false);
    return trusted ? 'granted' : 'denied';
  }
  return 'granted'; // Windows/Linux don't require this
}

export async function requestAccessibilityPermission(): Promise<boolean> {
  if (process.platform === 'darwin') {
    const trusted = systemPreferences.isTrustedAccessibilityClient(true);
    if (!trusted) {
      // Opens System Preferences → Security & Privacy → Accessibility
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
    }
    return trusted;
  }
  return true;
}

// ─────────────────────────────────────────
// SCREEN CAPTURE (for future screen-aware features)
// ─────────────────────────────────────────

export function getScreenCapturePermission(): PermissionStatus {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('screen');
    return status as PermissionStatus;
  }
  return 'granted';
}

// ─────────────────────────────────────────
// FULL STATUS CHECK
// ─────────────────────────────────────────

export async function getAllPermissions(): Promise<PermissionCheckResult> {
  const [microphone] = await Promise.all([getMicrophonePermission()]);
  return {
    microphone,
    notifications: getNotificationPermission(),
    accessibility: getAccessibilityPermission(),
    screenCapture: getScreenCapturePermission(),
  };
}

// ─────────────────────────────────────────
// IPC HANDLERS
// Register these in electron/main.ts
// ─────────────────────────────────────────

import { ipcMain } from 'electron';

export function registerPermissionHandlers(): void {
  ipcMain.handle('permissions:get-all', async () => {
    return getAllPermissions();
  });

  ipcMain.handle('permissions:request-microphone', async () => {
    return requestMicrophonePermission();
  });

  ipcMain.handle('permissions:request-accessibility', async () => {
    return requestAccessibilityPermission();
  });

  ipcMain.handle('permissions:open-settings', async (_event, section: string) => {
    const urls: Record<string, string> = {
      microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
      accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
      notifications: 'x-apple.systempreferences:com.apple.preference.notifications',
    };
    const url = urls[section];
    if (url) await shell.openExternal(url);
  });
}

// ─────────────────────────────────────────
// STARTUP PERMISSION CHECK
// Call on app ready — notifies user if mic is denied
// ─────────────────────────────────────────

export async function runStartupPermissionCheck(mainWindow: BrowserWindow): Promise<void> {
  const perms = await getAllPermissions();

  if (perms.microphone === 'denied') {
    // Send to renderer so it can show a permission prompt UI
    mainWindow.webContents.send('permissions:mic-denied');
    console.warn('[Jarvis] Microphone permission denied — voice features unavailable');
  }

  if (perms.notifications === 'denied') {
    console.warn('[Jarvis] Notifications permission denied');
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[Jarvis] Permissions on startup:', perms);
  }
}
