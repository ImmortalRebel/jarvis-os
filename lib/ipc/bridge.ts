// lib/ipc/bridge.ts
// Electron IPC bridge — unified abstraction for renderer ↔ main process communication.
//
// Works in three environments without modification:
//   1. Electron (production desktop) — uses window.electronAPI from preload script
//   2. Browser (web mode)            — stubs all methods, emits CustomEvents for testing
//   3. Next.js SSR (server side)     — returns safely, never touches window
//
// USAGE:
//   import { ipc } from '@/lib/ipc'
//   const cleanup = ipc.on(IPC_CHANNELS.JARVIS_WAKE, handler)
//   ipc.send(IPC_CHANNELS.JARVIS_MODE_CHANGE, 'listening')
//   cleanup() // unsubscribe

import type { IPCChannelValue } from './channels';

// ─────────────────────────────────────────
// BRIDGE INTERFACE
// ─────────────────────────────────────────

export interface IPCBridge {
  /** Whether we are running inside Electron */
  readonly isElectron: boolean;

  /** Send a one-way message to the Electron main process */
  send: (channel: IPCChannelValue, ...args: unknown[]) => void;

  /** Subscribe to messages from the main process. Returns an unsubscribe function. */
  on: (channel: IPCChannelValue, callback: (...args: unknown[]) => void) => () => void;

  /** Subscribe once, auto-unsubscribe after first message. Returns an unsubscribe function. */
  once: (channel: IPCChannelValue, callback: (...args: unknown[]) => void) => () => void;

  /** Electron window management (no-ops in web mode) */
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    setAlwaysOnTop: (value: boolean) => void;
  };
}

// ─────────────────────────────────────────
// ENVIRONMENT DETECTION
// Only runs once — the result is cached in the module scope.
// ─────────────────────────────────────────

const isBrowser = typeof window !== 'undefined';
const isElectron = isBrowser && typeof window.electronAPI !== 'undefined';

// ─────────────────────────────────────────
// ELECTRON BRIDGE
// ─────────────────────────────────────────

const electronBridge: IPCBridge = {
  isElectron: true,

  send(channel, ...args) {
    window.electronAPI?.send(channel, ...args);
  },

  on(channel, callback) {
    const cleanup = window.electronAPI?.on(channel, callback);
    return cleanup ?? noop;
  },

  once(channel, callback) {
    let unsub: (() => void) | undefined;
    const wrapped = (...args: unknown[]) => {
      callback(...args);
      unsub?.();
    };
    unsub = window.electronAPI?.on(channel, wrapped) ?? noop;
    return unsub;
  },

  window: {
    minimize: () => window.electronAPI?.minimize(),
    maximize: () => window.electronAPI?.maximize(),
    close: () => window.electronAPI?.close(),
    setAlwaysOnTop: (v) => window.electronAPI?.setAlwaysOnTop(v),
  },
};

// ─────────────────────────────────────────
// WEB / SSR STUB BRIDGE
// In browser mode, we use CustomEvents to allow synthetic IPC for dev/testing.
// In SSR mode, everything is a no-op.
// ─────────────────────────────────────────

const webBridge: IPCBridge = {
  isElectron: false,

  send(channel, ...args) {
    if (process.env.NODE_ENV === 'development' && isBrowser) {
      // eslint-disable-next-line no-console
      console.debug(`[IPC:web] send "${channel}"`, ...args);
    }
  },

  on(channel, callback) {
    if (!isBrowser) return noop;
    const eventName = `_ipc:${channel}`;
    const handler = (e: Event) => {
      if (e instanceof CustomEvent) callback(...(e.detail ?? []));
    };
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  },

  once(channel, callback) {
    let unsub: (() => void) | undefined;
    const wrapped = (...args: unknown[]) => {
      callback(...args);
      unsub?.();
    };
    unsub = webBridge.on(channel, wrapped);
    return unsub;
  },

  window: {
    minimize: noop,
    maximize: noop,
    close: noop,
    setAlwaysOnTop: noop,
  },
};

// ─────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────

function noop() {}

/**
 * The unified IPC bridge instance.
 * Use this everywhere in the renderer — it is environment-agnostic.
 */
export const ipc: IPCBridge = isElectron ? electronBridge : webBridge;

/**
 * Emit a synthetic IPC event in browser/web mode.
 * Useful for development, testing, and Storybook.
 * Has no effect in Electron or SSR.
 *
 * @example
 * emitSyntheticIPC(IPC_CHANNELS.JARVIS_WAKE)
 * // → triggers all `ipc.on('jarvis:wake', ...)` listeners
 */
export function emitSyntheticIPC(channel: IPCChannelValue, ...args: unknown[]): void {
  if (!isBrowser) return;
  const event = new CustomEvent(`_ipc:${channel}`, { detail: args });
  window.dispatchEvent(event);
}
