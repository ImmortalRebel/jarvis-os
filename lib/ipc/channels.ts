// lib/ipc/channels.ts
// IPC channel name constants — shared between renderer and main process.
// Always import these instead of raw strings to prevent typos and
// enable IDE auto-complete + rename refactoring.

export const IPC_CHANNELS = {
  // ── Assistant lifecycle ─────────────────────────────
  JARVIS_WAKE: 'jarvis:wake',
  JARVIS_SLEEP: 'jarvis:sleep',
  JARVIS_MODE_CHANGE: 'jarvis:mode-change',
  JARVIS_ERROR: 'jarvis:error',

  // ── Voice pipeline ──────────────────────────────────
  VOICE_STATE_CHANGE: 'jarvis:voice-state',
  WAKE_WORD_DETECTED: 'jarvis:wake-word-detected',
  RECORDING_START: 'jarvis:recording-start',
  RECORDING_STOP: 'jarvis:recording-stop',
  TRANSCRIPT_READY: 'jarvis:transcript-ready',
  TTS_START: 'jarvis:tts-start',
  TTS_STOP: 'jarvis:tts-stop',

  // ── Memory system ───────────────────────────────────
  MEMORY_UPDATE: 'jarvis:memory-update',
  MEMORY_QUERY: 'jarvis:memory-query',
  MEMORY_RESULT: 'jarvis:memory-result',

  // ── System / Electron ───────────────────────────────
  SYSTEM_TRAY_CLICK: 'system:tray-click',
  SYSTEM_SHORTCUT: 'system:shortcut',
  SYSTEM_THEME_CHANGE: 'system:theme-change',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_ALWAYS_ON_TOP: 'window:always-on-top',
} as const;

/** All valid IPC channel keys */
export type IPCChannelKey = keyof typeof IPC_CHANNELS;

/** All valid IPC channel values (the string names used at runtime) */
export type IPCChannelValue = (typeof IPC_CHANNELS)[IPCChannelKey];
