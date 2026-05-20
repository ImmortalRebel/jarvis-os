// types/ipc.ts
// Electron IPC bridge types.
// Describes the contract between the renderer process (Next.js) and main process (Electron).
// Safe to import in web-only mode — all Electron specifics are optional/guarded.

// ─────────────────────────────────────────
// IPC CHANNEL NAMES (string union)
// ─────────────────────────────────────────
// These are the event channel names used over the IPC bridge.
// The canonical constants live in lib/ipc/channels.ts.
// This union MUST stay in sync with IPC_CHANNELS in channels.ts.
// If you add a channel to channels.ts, add it here too.

export type IPCChannel =
  | 'jarvis:wake'
  | 'jarvis:sleep'
  | 'jarvis:mode-change'
  | 'jarvis:voice-state'
  | 'jarvis:error'
  | 'jarvis:memory-update'
  | 'jarvis:memory-query'       // ← was missing — caused bridge.ts TS2345 errors
  | 'jarvis:memory-result'      // ← was missing — caused bridge.ts TS2345 errors
  | 'jarvis:wake-word-detected'
  | 'jarvis:recording-start'
  | 'jarvis:recording-stop'
  | 'jarvis:transcript-ready'
  | 'jarvis:tts-start'
  | 'jarvis:tts-stop'
  | 'system:tray-click'
  | 'system:shortcut'
  | 'system:theme-change'
  | 'window:minimize'
  | 'window:maximize'
  | 'window:close'
  | 'window:always-on-top';

// ─────────────────────────────────────────
// AUDIO DEVICE INFO
// ─────────────────────────────────────────

export interface AudioDeviceInfo {
  id: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
  isDefault: boolean;
}

// ─────────────────────────────────────────
// ELECTRON API SURFACE
// This is what the Electron preload script exposes via contextBridge.
// ─────────────────────────────────────────

export interface ElectronAPI {
  // ── Window management ────────────────────
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  setAlwaysOnTop: (value: boolean) => void;

  // ── System information ───────────────────
  getPlatform: () => Promise<'darwin' | 'win32' | 'linux'>;
  getVersion: () => Promise<string>;

  // ── Persistent user data ─────────────────
  readUserData: (key: string) => Promise<string | null>;
  writeUserData: (key: string, value: string) => Promise<void>;

  // ── Wake word engine control ─────────────
  startWakeWord: (config: { phrase: string; threshold: number }) => Promise<void>;
  stopWakeWord: () => Promise<void>;
  onWakeWordDetected: (callback: (confidence: number) => void) => () => void;

  // ── Audio device routing (native) ────────
  getAudioDevices: () => Promise<AudioDeviceInfo[]>;
  setAudioInputDevice: (deviceId: string) => Promise<void>;
  setAudioOutputDevice: (deviceId: string) => Promise<void>;

  // ── Generic IPC event bus ─────────────────
  on: (channel: IPCChannel, callback: (...args: unknown[]) => void) => () => void;
  send: (channel: IPCChannel, ...args: unknown[]) => void;
}

// ─────────────────────────────────────────
// GLOBAL WINDOW AUGMENTATION
// Electron preload scripts inject `electronAPI` onto window.
// This declaration allows TypeScript to recognise window.electronAPI everywhere.
// ─────────────────────────────────────────

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
