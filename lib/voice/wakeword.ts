// lib/voice/wakeword.ts
// Wake word detection engine for Jarvis OS.
//
// Two backends selected automatically:
//   Browser: Keyword matching on Web Speech API interim results (dev/web)
//   Electron: Routes to native engine via IPC (production desktop)
//
// Usage:
//   wakeWordEngine.start()     — begin detection
//   wakeWordEngine.stop()      — stop detection
//   wakeWordEngine.onDetected  — callback when phrase is spotted

import { ipc } from '@/lib/ipc/bridge';
import { IPC_CHANNELS } from '@/lib/ipc/channels';
import { useAssistantStore } from '@/store/useAssistantStore';
import { useVoiceStore } from '@/store/useVoiceStore';
import { wakeAssistant } from '@/lib/assistant/modes';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export interface WakeWordEvent {
  phrase: string;
  confidence: number;
  timestamp: number;
  source: 'browser' | 'electron' | 'manual';
}

export type WakeWordCallback = (event: WakeWordEvent) => void;

// ─────────────────────────────────────────
// ENGINE
// ─────────────────────────────────────────

class WakeWordEngine {
  private isListening = false;
  private callbacks: WakeWordCallback[] = [];
  private browserRecognition: SpeechRecognition | null = null;
  private ipcCleanup: (() => void) | null = null;
  private lastTriggerTime = 0;
  private readonly COOLDOWN_MS = 2_000;

  // ── Subscription ────────────────────────────────────────────────────

  onDetected(callback: WakeWordCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter((c) => c !== callback);
    };
  }

  private fire(event: WakeWordEvent): void {
    const now = Date.now();
    if (now - this.lastTriggerTime < this.COOLDOWN_MS) return;
    this.lastTriggerTime = now;

    this.callbacks.forEach((cb) => cb(event));

    // Transition assistant to wake → listening
    wakeAssistant(400);
    useVoiceStore.getState().setVoiceState('detecting');
    ipc.send(IPC_CHANNELS.WAKE_WORD_DETECTED);
  }

  // ── Controls ────────────────────────────────────────────────────────

  start(): void {
    if (this.isListening) return;
    this.isListening = true;

    if (ipc.isElectron) {
      this.startElectronMode();
    } else {
      this.startBrowserMode();
    }

    useVoiceStore.getState().setVoiceState('detecting');
  }

  stop(): void {
    if (!this.isListening) return;
    this.isListening = false;

    this.browserRecognition?.abort();
    this.browserRecognition = null;
    this.ipcCleanup?.();
    this.ipcCleanup = null;

    useVoiceStore.getState().setVoiceState('inactive');
  }

  get active(): boolean { return this.isListening; }

  // ── Electron backend ─────────────────────────────────────────────────

  private startElectronMode(): void {
    const { wakeWordConfig } = useAssistantStore.getState();

    // Tell Electron main process to start the native engine
    ipc.send(IPC_CHANNELS.WAKE_WORD_DETECTED, {
      phrase: wakeWordConfig.phrase,
      threshold: wakeWordConfig.threshold,
    });

    // Listen for detections from main process
    this.ipcCleanup = ipc.on(
      IPC_CHANNELS.WAKE_WORD_DETECTED,
      (confidence: unknown) => {
        this.fire({
          phrase: wakeWordConfig.phrase,
          confidence: typeof confidence === 'number' ? confidence : 1.0,
          timestamp: Date.now(),
          source: 'electron',
        });
      },
    );
  }

  // ── Browser backend ──────────────────────────────────────────────────

  private startBrowserMode(): void {
    const isBrowserAvailable =
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    if (!isBrowserAvailable) return;

    const { wakeWordConfig } = useAssistantStore.getState();
    const phrase = wakeWordConfig.phrase.toLowerCase();
    const threshold = wakeWordConfig.threshold;

    const API = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const rec = new API();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    this.browserRecognition = rec;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase().trim();
        const confidence = event.results[i][0].confidence ?? 0.7;

        if (transcript.includes(phrase) && confidence >= threshold) {
          this.fire({
            phrase: wakeWordConfig.phrase,
            confidence,
            timestamp: Date.now(),
            source: 'browser',
          });
        }
      }
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn('[WakeWord] SpeechRecognition error:', e.error);
      }
    };

    // Auto-restart for continuous detection
    rec.onend = () => {
      if (this.isListening) {
        setTimeout(() => {
          try { this.browserRecognition?.start(); } catch { /* ignore */ }
        }, 300);
      }
    };

    try { rec.start(); } catch { /* ignore */ }
  }

  // ── Manual trigger (testing) ─────────────────────────────────────────

  simulateDetection(confidence = 0.95): void {
    const { wakeWordConfig } = useAssistantStore.getState();
    this.fire({
      phrase: wakeWordConfig.phrase,
      confidence,
      timestamp: Date.now(),
      source: 'manual',
    });
  }
}

export const wakeWordEngine = new WakeWordEngine();
