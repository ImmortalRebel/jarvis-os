// lib/assistant/behavior.ts
// Jarvis OS Behavior System.
// Manages automatic mode transitions based on inactivity, errors, and rules.
//
// Rules managed:
//   - Idle timeout → auto-sleep after N minutes of no interaction
//   - Error recovery → auto-reset to idle after error timeout
//   - Activity tracking → last interaction time
//   - Wake word config → enable/disable detection on sleep/wake
//   - Speaking timeout → force-stop TTS if it hangs

import { sleepAssistant, resetToIdle, forceMode } from './modes';
import { wakeWordEngine } from '@/lib/voice/wakeword';
import { tts } from '@/lib/voice/tts';
import { stt } from '@/lib/voice/stt';
import { useAssistantStore } from '@/store/useAssistantStore';
import { useUIStore } from '@/store/useUIStore';

// ─────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────

export interface BehaviorConfig {
  /** Minutes of inactivity before auto-sleep (0 = disabled, default: 10) */
  idleTimeoutMinutes: number;
  /** Seconds before auto-recovering from error state (default: 5) */
  errorRecoverySeconds: number;
  /** Seconds before force-stopping a stuck TTS (default: 60) */
  speakingTimeoutSeconds: number;
  /** Auto-enable wake word when going to sleep (default: true) */
  wakeWordOnSleep: boolean;
  /** Show notification when auto-sleeping (default: true) */
  notifyOnSleep: boolean;
}

const DEFAULT_CONFIG: BehaviorConfig = {
  idleTimeoutMinutes: 10,
  errorRecoverySeconds: 5,
  speakingTimeoutSeconds: 60,
  wakeWordOnSleep: true,
  notifyOnSleep: false,
};

// ─────────────────────────────────────────
// BEHAVIOR ENGINE
// ─────────────────────────────────────────

class BehaviorEngine {
  private config: BehaviorConfig = { ...DEFAULT_CONFIG };
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private speakingTimer: ReturnType<typeof setTimeout> | null = null;
  private lastActivityTime = Date.now();
  private initialized = false;

  // ── Initialization ───────────────────────────────────────────────────

  init(config: Partial<BehaviorConfig> = {}): void {
    if (this.initialized) return;
    this.initialized = true;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.resetIdleTimer();
    this.startModeWatcher();

    if (process.env.NODE_ENV === 'development') {
      console.log('[Behavior] Initialized with config:', this.config);
    }
  }

  destroy(): void {
    this.clearIdleTimer();
    this.clearSpeakingTimer();
    this.initialized = false;
  }

  // ── Activity tracking ────────────────────────────────────────────────

  /**
   * Call this on any user interaction — resets idle timer.
   */
  recordActivity(): void {
    this.lastActivityTime = Date.now();
    this.resetIdleTimer();
  }

  get secondsSinceActivity(): number {
    return Math.floor((Date.now() - this.lastActivityTime) / 1000);
  }

  // ── Idle timer ───────────────────────────────────────────────────────

  private resetIdleTimer(): void {
    this.clearIdleTimer();
    if (this.config.idleTimeoutMinutes <= 0) return;

    const ms = this.config.idleTimeoutMinutes * 60_000;
    this.idleTimer = setTimeout(() => this.onIdleTimeout(), ms);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private onIdleTimeout(): void {
    const { mode } = useAssistantStore.getState();
    // Only auto-sleep if truly idle — not mid-conversation
    if (mode !== 'idle') return;

    if (this.config.notifyOnSleep) {
      useUIStore.getState().notify({
        type: 'info',
        title: 'Jarvis',
        message: 'Going to sleep after inactivity.',
        duration: 3000,
      });
    }

    sleepAssistant();

    // Enable wake word on sleep so user can wake hands-free
    if (this.config.wakeWordOnSleep) {
      const { wakeWordConfig } = useAssistantStore.getState();
      if (wakeWordConfig.enabled) {
        wakeWordEngine.start();
      }
    }
  }

  // ── Speaking timeout ─────────────────────────────────────────────────

  startSpeakingTimeout(): void {
    this.clearSpeakingTimer();
    if (this.config.speakingTimeoutSeconds <= 0) return;

    const ms = this.config.speakingTimeoutSeconds * 1000;
    this.speakingTimer = setTimeout(() => {
      const { mode } = useAssistantStore.getState();
      if (mode === 'speaking') {
        tts.stop();
        resetToIdle();
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Behavior] TTS timeout — force-stopped after', this.config.speakingTimeoutSeconds, 's');
        }
      }
    }, ms);
  }

  clearSpeakingTimer(): void {
    if (this.speakingTimer) {
      clearTimeout(this.speakingTimer);
      this.speakingTimer = null;
    }
  }

  // ── Error recovery ───────────────────────────────────────────────────

  scheduleErrorRecovery(): void {
    if (this.config.errorRecoverySeconds <= 0) return;
    setTimeout(() => {
      const { mode } = useAssistantStore.getState();
      if (mode === 'error') {
        resetToIdle();
      }
    }, this.config.errorRecoverySeconds * 1000);
  }

  // ── Mode watcher ─────────────────────────────────────────────────────

  private startModeWatcher(): void {
    // Subscribe to mode changes to trigger behavior rules
    let lastMode = useAssistantStore.getState().mode;

    useAssistantStore.subscribe((state) => {
      const { mode } = state;
      if (mode === lastMode) return;
      const prevMode = lastMode;
      lastMode = mode;

      this.onModeChange(prevMode, mode);
    });
  }

  private onModeChange(
    from: string,
    to: string,
  ): void {
    switch (to) {
      case 'idle':
        this.clearSpeakingTimer();
        this.resetIdleTimer();
        break;

      case 'listening':
        this.recordActivity();
        this.clearIdleTimer();
        break;

      case 'processing':
      case 'thinking':
        this.recordActivity();
        this.clearIdleTimer();
        break;

      case 'speaking':
        this.startSpeakingTimeout();
        break;

      case 'sleeping':
        this.clearIdleTimer();
        this.clearSpeakingTimer();
        stt.stop();
        tts.stop();
        break;

      case 'error':
        this.clearSpeakingTimer();
        this.scheduleErrorRecovery();
        break;
    }

    if (process.env.NODE_ENV === 'development') {
      console.debug(`[Behavior] Mode change: ${from} → ${to}`);
    }
  }

  // ── Config ────────────────────────────────────────────────────────────

  updateConfig(config: Partial<BehaviorConfig>): void {
    this.config = { ...this.config, ...config };
    this.resetIdleTimer();
  }

  getConfig(): BehaviorConfig { return { ...this.config }; }
}

export const behaviorEngine = new BehaviorEngine();
