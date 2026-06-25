// electron/preload.ts
// Secure contextBridge preload — Phase 2B upgrade.
// Compiled with tsconfig.electron.json, NOT by Next.js.
// All channel names validated against whitelists before any IPC call.

import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI, AudioDeviceInfo } from '../types/ipc';

// ─────────────────────────────────────────
// CHANNEL WHITELISTS
// ─────────────────────────────────────────

const ALLOWED_SEND = new Set([
  'jarvis:wake',
  'jarvis:sleep',
  'jarvis:mode-change',
  'jarvis:recording-start',
  'jarvis:recording-stop',
  'jarvis:tts-start',
  'jarvis:tts-stop',
  'jarvis:memory-query',
  'jarvis:wake-word-detected',
  'window:minimize',
  'window:maximize',
  'window:close',
  'window:always-on-top',
] as const);

const ALLOWED_LISTEN = new Set([
  'jarvis:wake',
  'jarvis:sleep',
  'jarvis:mode-change',
  'jarvis:voice-state',
  'jarvis:error',
  'jarvis:memory-update',
  'jarvis:memory-result',
  'jarvis:memory-query',
  'jarvis:transcript-ready',
  'jarvis:tts-start',
  'jarvis:tts-stop',
  'jarvis:wake-word-detected',
  'system:tray-click',
  'system:shortcut',
  'system:theme-change',
] as const);

type SendChannel = typeof ALLOWED_SEND extends Set<infer T> ? T : never;
type ListenChannel = typeof ALLOWED_LISTEN extends Set<infer T> ? T : never;

// ─────────────────────────────────────────
// EXPOSED API
// ─────────────────────────────────────────

const api: ElectronAPI = {
  // ── Window ──────────────────────────────────────────────────────────
  minimize:       () => ipcRenderer.send('window:minimize'),
  maximize:       () => ipcRenderer.send('window:maximize'),
  close:          () => ipcRenderer.send('window:close'),
  setAlwaysOnTop: (v) => ipcRenderer.send('window:always-on-top', v),

  // ── System ──────────────────────────────────────────────────────────
  getPlatform: () => ipcRenderer.invoke('system:get-platform'),
  getVersion:  () => ipcRenderer.invoke('system:get-version'),

  // ── User data ────────────────────────────────────────────────────────
  readUserData:  (key)       => ipcRenderer.invoke('userdata:read', key),
  writeUserData: (key, val)  => ipcRenderer.invoke('userdata:write', key, val),

  // ── Wake word ────────────────────────────────────────────────────────
  startWakeWord: (config) => ipcRenderer.invoke('wakeword:start', config),
  stopWakeWord:  ()       => ipcRenderer.invoke('wakeword:stop'),
  onWakeWordDetected: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, conf: number) => cb(conf);
    ipcRenderer.on('jarvis:wake-word-detected', handler);
    return () => ipcRenderer.removeListener('jarvis:wake-word-detected', handler);
  },

  // ── Audio devices ─────────────────────────────────────────────────────
  getAudioDevices:     (): Promise<AudioDeviceInfo[]> => ipcRenderer.invoke('audio:get-devices'),
  setAudioInputDevice: (id) => ipcRenderer.invoke('audio:set-input', id),
  setAudioOutputDevice:(id) => ipcRenderer.invoke('audio:set-output', id),

  // ── Generic IPC ─────────────────────────────────────────────────────
  send: (channel, ...args) => {
    if (ALLOWED_SEND.has(channel as SendChannel)) {
      ipcRenderer.send(channel, ...args);
    } else if (process.env.NODE_ENV === 'development') {
      console.warn(`[preload] Blocked send on: "${channel}"`);
    }
  },

  on: (channel, callback) => {
    if (!ALLOWED_LISTEN.has(channel as ListenChannel)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[preload] Blocked listen on: "${channel}"`);
      }
      return () => {};
    }
    const handler = (_: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
