'use client';
// components/providers/JarvisProvider.tsx

import { useEffect, type ReactNode } from 'react';
import { useAssistantStore } from '@/store/useAssistantStore';
import { useVoiceStore } from '@/store/useVoiceStore';
import { useUIStore } from '@/store/useUIStore';
import { useMemoryStore } from '@/store/useMemoryStore';
import { ipc } from '@/lib/ipc/bridge';
import { IPC_CHANNELS } from '@/lib/ipc/channels';
import type { AssistantMode } from '@/types/assistant';

// ─────────────────────────────────────────────────────────────────────────────
// STORE INITIALIZER
// Subscribes to ALL 4 stores immediately on mount.
// This is what registers them with Redux DevTools (triggers the @@INIT dispatch).
// Without this, stores that are never subscribed to will not appear in DevTools.
// ─────────────────────────────────────────────────────────────────────────────

function StoreInitializer(): null {
  // Subscribe to every store — this triggers devtools registration for each one.
  // We only need ONE selector per store to force the subscription.
  const assistantMode  = useAssistantStore((s) => s.mode);
  const voiceState     = useVoiceStore((s) => s.voiceState);
  const uiTheme        = useUIStore((s) => s.theme);
  const memoryTotal    = useMemoryStore((s) => s.totalEntries);

  useEffect(() => {
    // Force-call getState() on every store so Zustand's devtools middleware
    // immediately dispatches @@INIT to Redux DevTools.
    const a = useAssistantStore.getState();
    const v = useVoiceStore.getState();
    const u = useUIStore.getState();
    const m = useMemoryStore.getState();

    // ── CRITICAL: Force MemoryStore to write to localStorage ──────────────
    // Zustand persist only saves when setState is dispatched — getState() is
    // read-only and never triggers a save. MemoryStore has no actions called
    // on first load, so it never appears in localStorage.
    // Fix: call setStatus('idle') → dispatches setState → persist saves.
    if (!localStorage.getItem('jarvis-memory-store')) {
      m.setStatus('idle');
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(
        '[JarvisOS] Stores initialized ✓',
        '\n  AssistantStore mode:', a.mode,
        '\n  VoiceStore state:', v.voiceState,
        '\n  UIStore theme:', u.theme,
        '\n  MemoryStore entries:', m.totalEntries,
      );
    }
  }, []);

  // Silence unused variable warnings — the subscriptions above are intentional
  void assistantMode; void voiceState; void uiTheme; void memoryTotal;

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOTSTRAP COMPONENT
// Handles IPC, system preferences, keyboard shortcuts.
// ─────────────────────────────────────────────────────────────────────────────

function JarvisBootstrap(): null {
  const initialize      = useAssistantStore((s) => s.initialize);
  const setMode         = useAssistantStore((s) => s.setMode);
  const setError        = useAssistantStore((s) => s.setError);
  const setVoiceState   = useVoiceStore((s) => s.setVoiceState);
  const resetVoice      = useVoiceStore((s) => s.reset);
  const setMicPermission = useVoiceStore((s) => s.setMicPermission);
  const setReducedMotion = useUIStore((s) => s.setReducedMotion);

  useEffect(() => {
    // 1. Mark stores as initialized
    initialize();

    // 2. Reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(motionQuery.matches);
    const handleMotionChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    motionQuery.addEventListener('change', handleMotionChange);

    // 3. Microphone permission
    if (navigator.permissions) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((result) => {
          setMicPermission(result.state === 'granted');
          result.addEventListener('change', () =>
            setMicPermission(result.state === 'granted'),
          );
        })
        .catch(() => setMicPermission(null));
    }

    // 4. IPC — wake word
    const unsubWake = ipc.on(IPC_CHANNELS.JARVIS_WAKE, () => {
      setMode('wake');
      const t = window.setTimeout(() => setMode('listening'), 600);
      return () => window.clearTimeout(t);
    });

    // 5. IPC — sleep
    const unsubSleep = ipc.on(IPC_CHANNELS.JARVIS_SLEEP, () => {
      setMode('idle');
      setVoiceState('inactive');
    });

    // 6. IPC — mode change
    const unsubMode = ipc.on(
      IPC_CHANNELS.JARVIS_MODE_CHANGE,
      (rawMode: unknown) => {
        if (typeof rawMode === 'string') setMode(rawMode as AssistantMode);
      },
    );

    // 7. IPC — error
    const unsubError = ipc.on(
      IPC_CHANNELS.JARVIS_ERROR,
      (message: unknown) => {
        if (typeof message === 'string') setError(message);
      },
    );

    // 8. Keyboard shortcut: Ctrl+Shift+J = toggle, Escape = cancel
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        const current = useAssistantStore.getState().mode;
        setMode(current === 'idle' ? 'listening' : 'idle');
      }
      if (e.key === 'Escape') {
        const current = useAssistantStore.getState().mode;
        if (current !== 'idle' && current !== 'error') {
          setMode('idle');
          setVoiceState('inactive');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // 9. Visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const current = useAssistantStore.getState().mode;
        if (current === 'listening' || current === 'processing') {
          setMode('idle');
          setVoiceState('inactive');
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
      unsubWake();
      unsubSleep();
      unsubMode();
      unsubError();
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (process.env.NODE_ENV === 'development') resetVoice();
    };
  }, [
    initialize, setMode, setError, setVoiceState,
    resetVoice, setMicPermission, setReducedMotion,
  ]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

interface JarvisProviderProps {
  children: ReactNode;
}

export function JarvisProvider({ children }: JarvisProviderProps) {
  return (
    <>
      <StoreInitializer />
      <JarvisBootstrap />
      {children}
    </>
  );
}
