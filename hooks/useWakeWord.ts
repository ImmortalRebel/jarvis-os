'use client';
// hooks/useWakeWord.ts
// Wake word detection hook — prepares the pipeline for voice activation.
//
// Two detection backends are supported transparently:
//
//   1. ELECTRON (production desktop):
//      The main process runs a native wake-word engine (e.g. Porcupine/Picovoice).
//      This hook listens for IPC_CHANNELS.WAKE_WORD_DETECTED events from the main process.
//      Start/stop control messages are sent back via IPC.
//
//   2. BROWSER (web / development):
//      Uses a keyword-spotter built on the Web Speech API interim results.
//      Lower accuracy but works in any browser without native dependencies.
//      Useful for development and web deployments.
//
// The hook selects the backend automatically based on ipc.isElectron.
// Consumers never need to care which backend is active.

import { useEffect, useRef, useCallback, useState } from 'react';
import { ipc } from '@/lib/ipc/bridge';
import { IPC_CHANNELS } from '@/lib/ipc/channels';
import { useAssistantStore } from '@/store/useAssistantStore';
import { useVoiceStore } from '@/store/useVoiceStore';
import type { WakeWordDetectionEvent } from '@/types/voice';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

interface UseWakeWordOptions {
  /** Called when the wake word is detected */
  onDetected?: (event: WakeWordDetectionEvent) => void;
  /** Start detection automatically when the hook mounts (default: false) */
  autoStart?: boolean;
}

interface UseWakeWordReturn {
  /** Whether wake word detection is actively running */
  isListening: boolean;
  /** Whether the hardware/API supports wake word detection */
  isSupported: boolean;
  /** Start listening for the wake word */
  start: () => void;
  /** Stop wake word detection */
  stop: () => void;
  /** Toggle detection on/off */
  toggle: () => void;
  /** Timestamp of the last detection event (null if never detected) */
  lastDetectedAt: number | null;
}

// Browser globals for SpeechRecognition — same augmentation as useVoiceInput.ts
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

// ─────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────

export function useWakeWord({
  onDetected,
  autoStart = false,
}: UseWakeWordOptions = {}): UseWakeWordReturn {
  const [isListening, setIsListening] = useState(false);
  const [lastDetectedAt, setLastDetectedAt] = useState<number | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Stable ref for callback — avoids stale closures in event handlers
  const onDetectedRef = useRef(onDetected);
  useEffect(() => { onDetectedRef.current = onDetected; });

  const { wakeWordConfig } = useAssistantStore();
  const setVoiceState = useVoiceStore((s) => s.setVoiceState);
  const setMode = useAssistantStore((s) => s.setMode);

  // ── Environment detection ──────────────────────────────────────

  const isElectron = ipc.isElectron;

  const isBrowserSpeechSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const isSupported = isElectron || isBrowserSpeechSupported;

  // ── Shared detection handler ───────────────────────────────────

  const handleDetection = useCallback(
    (confidence: number, source: WakeWordDetectionEvent['source']) => {
      const event: WakeWordDetectionEvent = {
        phrase: wakeWordConfig.phrase,
        confidence,
        timestamp: Date.now(),
        source,
      };

      setLastDetectedAt(event.timestamp);
      setMode('wake');
      setVoiceState('detecting');

      // Fire user callback
      onDetectedRef.current?.(event);

      // Notify main process (Electron: redundant but harmless; web: no-op)
      ipc.send(IPC_CHANNELS.WAKE_WORD_DETECTED);
    },
    [wakeWordConfig.phrase, setMode, setVoiceState],
  );

  // ── ELECTRON BACKEND ────────────────────────────────────────────

  useEffect(() => {
    if (!isElectron) return;

    // The main process sends WAKE_WORD_DETECTED when it detects the phrase
    const unsub = ipc.on(
      IPC_CHANNELS.WAKE_WORD_DETECTED,
      (confidence: unknown) => {
        handleDetection(
          typeof confidence === 'number' ? confidence : 1.0,
          'electron',
        );
      },
    );

    return () => {
      unsub();
    };
  }, [isElectron, handleDetection]);

  // ── BROWSER BACKEND ─────────────────────────────────────────────
  // Uses continuous SpeechRecognition to listen for the wake phrase in interim results.
  // Less accurate than a dedicated engine but works with zero native dependencies.

  useEffect(() => {
    if (isElectron || !isBrowserSpeechSupported) return;

    const SpeechRecognitionAPI =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // Cooldown to prevent double-triggers (min 2s between detections)
    let lastTriggerTime = 0;
    const COOLDOWN_MS = 2000;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const phrase = wakeWordConfig.phrase.toLowerCase();
      const now = Date.now();

      // Check all results (final and interim) for the wake phrase
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase().trim();
        const confidence = event.results[i][0].confidence ?? 0.7;

        if (
          transcript.includes(phrase) &&
          confidence >= wakeWordConfig.threshold &&
          now - lastTriggerTime > COOLDOWN_MS
        ) {
          lastTriggerTime = now;
          handleDetection(confidence, 'browser');
          // Clear the recognition session so it doesn't keep processing old audio
          recognition.stop();
          setTimeout(() => {
            if (recognitionRef.current) {
              try { recognition.start(); } catch { /* already started */ }
            }
          }, 500);
          break;
        }
      }
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      // 'no-speech' and 'aborted' are normal — don't treat as errors
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn('[useWakeWord] SpeechRecognition error:', e.error);
      }
    };

    // Auto-restart on end so detection is continuous
    recognition.onend = () => {
      if (recognitionRef.current && isListening) {
        try { recognition.start(); } catch { /* ignore */ }
      }
    };

    recognitionRef.current = recognition;

    if (autoStart && wakeWordConfig.enabled) {
      try { recognition.start(); setIsListening(true); } catch { /* ignore */ }
    }

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
    // Re-initialise only if the wake phrase / threshold changes
  }, [
    isElectron,
    isBrowserSpeechSupported,
    wakeWordConfig.phrase,
    wakeWordConfig.threshold,
    wakeWordConfig.enabled,
  ]);

  // ── Controls ────────────────────────────────────────────────────

  const start = useCallback(() => {
    if (!isSupported || isListening) return;
    setIsListening(true);
    setVoiceState('detecting');

    if (isElectron) {
      // Tell main process to start the native wake-word engine
      ipc.send(IPC_CHANNELS.WAKE_WORD_DETECTED, {
        phrase: wakeWordConfig.phrase,
        threshold: wakeWordConfig.threshold,
      });
    } else if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch { /* already running */ }
    }
  }, [isSupported, isListening, isElectron, wakeWordConfig, setVoiceState]);

  const stop = useCallback(() => {
    if (!isListening) return;
    setIsListening(false);
    setVoiceState('inactive');

    if (isElectron) {
      ipc.send(IPC_CHANNELS.JARVIS_SLEEP);
    } else if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
  }, [isListening, isElectron, setVoiceState]);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else start();
  }, [isListening, start, stop]);

  return {
    isListening,
    isSupported,
    start,
    stop,
    toggle,
    lastDetectedAt,
  };
}
