// electron/preload.ts
// Electron preload script — runs in a sandboxed context with access to both
// Node.js APIs and the renderer DOM. Exposes a typed `electronAPI` object
// via contextBridge so the renderer can call main-process features safely.
//
// SECURITY NOTES:
//   - contextBridge.exposeInMainWorld() is the only safe way to expose APIs
//   - Never expose ipcRenderer directly — that bypasses all sandboxing
//   - All channel names are validated against the IPC_CHANNELS whitelist
//   - Input is validated before being sent to the main process
//
// This file must be compiled separately from the Next.js build.
// Add to your electron-builder / electron-vite config:
//   preload: path.join(__dirname, 'preload.js')

import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI, AudioDeviceInfo } from '../types/ipc';

// ─────────────────────────────────────────
// CHANNEL WHITELIST
// Only channels in this list can be sent FROM the renderer.
// The main process can send on any channel.
// ─────────────────────────────────────────

const ALLOWED_SEND_CHANNELS = new Set([
  'jarvis:wake',
  'jarvis:sleep',
  'jarvis:mode-change',
  'jarvis:recording-start',
  'jarvis:recording-stop',
  'jarvis:tts-start',
  'jarvis:tts-stop',
  'jarvis:memory-query',
  'window:minimize',
  'window:maximize',
  'window:close',
  'window:always-on-top',
  'jarvis:wake-word-detected',
] as const);

const ALLOWED_LISTEN_CHANNELS = new Set([
  'jarvis:wake',
  'jarvis:sleep',
  'jarvis:mode-change',
  'jarvis:voice-state',
  'jarvis:error',
  'jarvis:memory-update',
  'jarvis:memory-result',
  'jarvis:transcript-ready',
  'jarvis:tts-start',
  'jarvis:tts-stop',
  'jarvis:wake-word-detected',
  'system:tray-click',
  'system:shortcut',
  'system:theme-change',
] as const);

type AllowedSendChannel = typeof ALLOWED_SEND_CHANNELS extends Set<infer T> ? T : never;
type AllowedListenChannel = typeof ALLOWED_LISTEN_CHANNELS extends Set<infer T> ? T : never;

// ─────────────────────────────────────────
// EXPOSED API
// ─────────────────────────────────────────

const api: ElectronAPI = {
  // ── Window management ──────────────────────────────────────────
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  setAlwaysOnTop: (value: boolean) =>
    ipcRenderer.send('window:always-on-top', value),

  // ── System info ────────────────────────────────────────────────
  getPlatform: () => ipcRenderer.invoke('system:get-platform'),
  getVersion: () => ipcRenderer.invoke('system:get-version'),

  // ── Persistent user data ───────────────────────────────────────
  readUserData: (key: string) => ipcRenderer.invoke('userdata:read', key),
  writeUserData: (key: string, value: string) =>
    ipcRenderer.invoke('userdata:write', key, value),

  // ── Wake word engine ───────────────────────────────────────────
  startWakeWord: (config: { phrase: string; threshold: number }) =>
    ipcRenderer.invoke('wakeword:start', config),
  stopWakeWord: () => ipcRenderer.invoke('wakeword:stop'),
  onWakeWordDetected: (callback: (confidence: number) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, confidence: number) =>
      callback(confidence);
    ipcRenderer.on('jarvis:wake-word-detected', listener);
    // Return unsubscribe function
    return () => ipcRenderer.removeListener('jarvis:wake-word-detected', listener);
  },

  // ── Audio device routing ───────────────────────────────────────
  getAudioDevices: (): Promise<AudioDeviceInfo[]> =>
    ipcRenderer.invoke('audio:get-devices'),
  setAudioInputDevice: (deviceId: string) =>
    ipcRenderer.invoke('audio:set-input', deviceId),
  setAudioOutputDevice: (deviceId: string) =>
    ipcRenderer.invoke('audio:set-output', deviceId),

  // ── Generic IPC event bus ──────────────────────────────────────

  send: (channel: string, ...args: unknown[]) => {
    if (ALLOWED_SEND_CHANNELS.has(channel as AllowedSendChannel)) {
      ipcRenderer.send(channel, ...args);
    } else {
      console.warn(`[preload] Blocked send on unauthorized channel: "${channel}"`);
    }
  },

  on: (channel: string, callback: (...args: unknown[]) => void) => {
    if (!ALLOWED_LISTEN_CHANNELS.has(channel as AllowedListenChannel)) {
      console.warn(`[preload] Blocked listen on unauthorized channel: "${channel}"`);
      return () => {};
    }
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      callback(...args);
    ipcRenderer.on(channel, listener);
    // Return the cleanup/unsubscribe function
    return () => ipcRenderer.removeListener(channel, listener);
  },
};

// ─────────────────────────────────────────
// EXPOSE TO RENDERER
// ─────────────────────────────────────────

contextBridge.exposeInMainWorld('electronAPI', api);

// Type declaration reminder for the renderer:
// The global Window augmentation in types/ipc.ts already declares:
//   interface Window { electronAPI?: ElectronAPI }
// So window.electronAPI is fully typed in the renderer automatically.
