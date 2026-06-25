// lib/assistant/runtime.ts
// Jarvis OS Assistant Runtime — Phase 3 complete.
// Central coordination layer for the full assistant lifecycle.
//
// Orchestrates:
//   - Mode state machine (modes.ts)
//   - Full pipeline execution via executor (pipeline/executor.ts)
//   - IPC event handling (Electron ↔ renderer)
//   - Behavior rules (behavior.ts — idle timeout, error recovery)
//   - Wake word detection routing (voice/wakeword.ts)
//   - Error recovery with auto-reset
//
// NO React dependency — pure TypeScript singleton.
// Components interact through hooks/useRuntime.ts, never directly.

import { transitionMode, forceMode, sleepAssistant, wakeAssistant, resetToIdle } from './modes';
import { behaviorEngine } from './behavior';
import { pipeline } from '@/lib/pipeline';
import { executor } from '@/lib/pipeline/executor';
import { wakeWordEngine } from '@/lib/voice/wakeword';
import { tts } from '@/lib/voice/tts';
import { ipc } from '@/lib/ipc/bridge';
import { IPC_CHANNELS } from '@/lib/ipc/channels';
import { useAssistantStore } from '@/store/useAssistantStore';
import { useVoiceStore } from '@/store/useVoiceStore';
import { useUIStore } from '@/store/useUIStore';
import type { AssistantMode } from '@/types/assistant';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export interface RuntimeOptions {
  /** Auto-register IPC listeners on init (default: true) */
  registerIPC?: boolean;
  /** Auto-register keyboard shortcuts (default: true) */
  registerShortcuts?: boolean;
}

export interface SubmitOptions {
  text: string;
  isVoice?: boolean;
  speakResponse?: boolean;
  signal?: AbortSignal;
}

// ─────────────────────────────────────────
// RUNTIME CLASS
// ─────────────────────────────────────────

class JarvisRuntime {
  private initialized = false;
  private ipcCleanups: Array<() => void> = [];
  private shortcutCleanup: (() => void) | null = null;

  // ── Initialization ────────────────────────────────────────────────────────

  init(options: RuntimeOptions = {}): void {
    if (this.initialized) return;
    this.initialized = true;

    const { registerIPC = true, registerShortcuts = true } = options;

    if (registerIPC) this.registerIPCListeners();
    if (registerShortcuts) this.registerKeyboardShortcuts();

    // Initialize behavior engine (idle timeout, error recovery, mode watching)
    behaviorEngine.init();

    // Subscribe wake word detection to record activity
    wakeWordEngine.onDetected(() => {
      behaviorEngine.recordActivity();
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[JarvisRuntime] Initialized ✓', {
        electron: ipc.isElectron,
        mode: useAssistantStore.getState().mode,
      });
    }
  }

  destroy(): void {
    this.ipcCleanups.forEach((fn) => fn());
    this.ipcCleanups = [];
    this.shortcutCleanup?.();
    this.shortcutCleanup = null;
    behaviorEngine.destroy();
    wakeWordEngine.stop();
    executor.cancel();
    this.initialized = false;
  }

  // ── IPC LISTENERS ─────────────────────────────────────────────────────────

  private registerIPCListeners(): void {
    this.ipcCleanups.push(
      ipc.on(IPC_CHANNELS.JARVIS_WAKE, () => {
        wakeAssistant(600);
        ipc.send(IPC_CHANNELS.VOICE_STATE_CHANGE, 'detecting');
      }),
    );

    this.ipcCleanups.push(
      ipc.on(IPC_CHANNELS.JARVIS_SLEEP, () => {
        sleepAssistant();
      }),
    );

    this.ipcCleanups.push(
      ipc.on(IPC_CHANNELS.JARVIS_MODE_CHANGE, (rawMode: unknown) => {
        if (typeof rawMode === 'string') {
          forceMode(rawMode as AssistantMode);
        }
      }),
    );

    this.ipcCleanups.push(
      ipc.on(IPC_CHANNELS.JARVIS_ERROR, (message: unknown) => {
        if (typeof message === 'string') {
          this.handleError(message);
        }
      }),
    );

    this.ipcCleanups.push(
      ipc.on(IPC_CHANNELS.TRANSCRIPT_READY, (text: unknown, isVoice: unknown) => {
        if (typeof text === 'string' && text.trim()) {
          void this.submit({ text: text.trim(), isVoice: isVoice === true, speakResponse: isVoice === true });
        }
      }),
    );
  }

  // ── KEYBOARD SHORTCUTS ────────────────────────────────────────────────────

  private registerKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return;

    const handler = (e: KeyboardEvent) => {
      // Ctrl+Shift+J — toggle listening (single setState — no double dispatch)
      if (e.ctrlKey && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        const mode = useAssistantStore.getState().mode;
        if (mode === 'idle' || mode === 'sleeping') {
          transitionMode('listening', { force: true });
        } else {
          executor.cancel();
          resetToIdle();
        }
        return;
      }

      // Escape — cancel / return to idle
      if (e.key === 'Escape') {
        const mode = useAssistantStore.getState().mode;
        if (mode !== 'idle' && mode !== 'error' && mode !== 'sleeping') {
          executor.cancel();
          resetToIdle();
        }
        return;
      }

      // Ctrl+Shift+S — sleep toggle
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        const mode = useAssistantStore.getState().mode;
        if (mode === 'sleeping') {
          forceMode('idle');
        } else {
          sleepAssistant();
        }
      }
    };

    window.addEventListener('keydown', handler);
    this.shortcutCleanup = () => window.removeEventListener('keydown', handler);
  }

  // ── CORE SUBMIT ───────────────────────────────────────────────────────────

  /**
   * Submit a user query through the full execution pipeline.
   * Routes: text/voice input → command check → AI pipeline → TTS → idle.
   * Records activity with behaviorEngine to reset idle timer.
   */
  async submit(options: SubmitOptions): Promise<void> {
    const { text, isVoice = false, speakResponse = false, signal } = options;

    if (!text.trim()) return;

    const currentMode = useAssistantStore.getState().mode;
    if (currentMode === 'processing' || currentMode === 'thinking') {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[JarvisRuntime] Submit blocked — pipeline already running');
      }
      return;
    }

    // Record activity — resets behavior engine idle timer
    behaviorEngine.recordActivity();

    // Use the full executor (STT→command→AI→TTS flow)
    await executor.execute({ text, isVoice, speakResponse, signal });
  }

  // ── TTS ───────────────────────────────────────────────────────────────────

  /**
   * Speak text using the configured TTS provider.
   */
  async speak(text: string, signal?: AbortSignal): Promise<void> {
    const { ttsConfig } = useAssistantStore.getState();
    useVoiceStore.getState().enqueueTTS(text, 'normal');

    if (ttsConfig.provider === 'browser' || !ipc.isElectron) {
      await this.browserSpeak(text, ttsConfig.speed, ttsConfig.volume, ttsConfig.pitch, signal);
    }

    useVoiceStore.getState().completeTTSItem();
  }

  private browserSpeak(
    text: string,
    rate = 1.0,
    volume = 0.9,
    pitch = 1.0,
    signal?: AbortSignal,
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate   = rate;
      utterance.volume = volume;
      utterance.pitch  = pitch;
      utterance.lang   = 'en-US';

      utterance.onend   = () => resolve();
      utterance.onerror = () => resolve();

      if (signal) {
        signal.addEventListener('abort', () => {
          window.speechSynthesis.cancel();
          resolve();
        });
      }

      window.speechSynthesis.speak(utterance);
    });
  }

  stopSpeaking(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    tts.stop();
    useVoiceStore.getState().clearTTSQueue();
  }

  // ── ERROR HANDLING ────────────────────────────────────────────────────────

  handleError(message: string, recoverable = true): void {
    useAssistantStore.getState().setError(message);
    forceMode('error');
    useVoiceStore.getState().reset();

    useUIStore.getState().notify({
      type: 'error',
      title: 'Jarvis Error',
      message,
      duration: recoverable ? 5000 : 0,
    });

    if (process.env.NODE_ENV === 'development') {
      console.error('[JarvisRuntime] Error:', message);
    }

    if (recoverable) {
      setTimeout(() => {
        const mode = useAssistantStore.getState().mode;
        if (mode === 'error') resetToIdle();
      }, 5000);
    }
  }

  // ── SESSION ───────────────────────────────────────────────────────────────

  newSession(): void {
    executor.cancel();
    this.stopSpeaking();
    useAssistantStore.getState().resetSession();
    resetToIdle();
  }

  // ── ACCESSORS ─────────────────────────────────────────────────────────────

  get mode(): AssistantMode {
    return useAssistantStore.getState().mode;
  }

  get isRunning(): boolean {
    return pipeline.isRunning;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }
}

// ─────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────

export const runtime = new JarvisRuntime();
