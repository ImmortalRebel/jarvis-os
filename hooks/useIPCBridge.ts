'use client';
// hooks/useIPCBridge.ts
// React hooks for Electron IPC event subscriptions.
// Automatically subscribes on mount and unsubscribes on unmount.
// Safe to call in both Electron and web environments — no-ops gracefully.

import { useEffect, useRef, useCallback } from 'react';
import { ipc } from '@/lib/ipc/bridge';
import type { IPCChannelValue } from '@/lib/ipc/channels';

/**
 * Subscribe to an IPC channel for the lifetime of the component.
 * The callback is stabilised via a ref — it always reflects the latest closure
 * without triggering re-subscriptions.
 *
 * @example
 * useIPCChannel(IPC_CHANNELS.JARVIS_WAKE, () => {
 *   transitionMode('wake');
 * });
 */
export function useIPCChannel(
  channel: IPCChannelValue,
  callback: (...args: unknown[]) => void,
): void {
  // Store latest callback in a ref to avoid re-subscriptions on each render
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const handler = (...args: unknown[]) => callbackRef.current(...args);
    const unsubscribe = ipc.on(channel, handler);
    return unsubscribe;
  }, [channel]); // Only re-subscribe when the channel name changes
}

/**
 * Subscribe to an IPC channel once — auto-unsubscribes after the first message.
 *
 * @example
 * useIPCChannelOnce(IPC_CHANNELS.JARVIS_WAKE, () => {
 *   showWelcomeAnimation();
 * });
 */
export function useIPCChannelOnce(
  channel: IPCChannelValue,
  callback: (...args: unknown[]) => void,
): void {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const unsubscribe = ipc.once(channel, (...args) => callbackRef.current(...args));
    return unsubscribe;
  }, [channel]);
}

/**
 * Returns a stable send function for a specific IPC channel.
 * The returned function never changes identity (safe for dependency arrays).
 *
 * @example
 * const sendMode = useIPCSend(IPC_CHANNELS.JARVIS_MODE_CHANGE);
 * sendMode('listening');
 */
export function useIPCSend(channel: IPCChannelValue) {
  return useCallback(
    (...args: unknown[]) => ipc.send(channel, ...args),
    [channel],
  );
}

/**
 * Returns whether the app is currently running inside Electron.
 * Computed once and stable — does not react to changes.
 */
export function useIsElectron(): boolean {
  return ipc.isElectron;
}
