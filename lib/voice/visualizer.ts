// lib/voice/visualizer.ts
// Waveform visualization sync layer for Jarvis OS.
// Bridges raw AudioContext frequency/waveform data from microphone.ts
// into smooth animation-ready values for the existing UI.
//
// This does NOT render anything. It processes data and pushes
// to VoiceStore, which UI components read via hooks.
//
// Features:
//   - Smoothing algorithm to prevent jittery animation
//   - Peak detection with decay
//   - Frequency band grouping for bar visualizers
//   - Voice activity level (0–1) for orb scaling
//   - Normalized values ready for framer-motion custom props

import { useVoiceStore } from '@/store/useVoiceStore';

// ─────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────

export interface VisualizerConfig {
  /** Number of frequency bars to output (default: 32) */
  barCount: number;
  /** Smoothing factor 0–1 — higher = slower/smoother (default: 0.7) */
  smoothing: number;
  /** Peak hold time in ms before decay starts (default: 800) */
  peakHoldMs: number;
  /** Peak decay rate per frame (default: 0.015) */
  peakDecayRate: number;
}

const DEFAULT_CONFIG: VisualizerConfig = {
  barCount: 32,
  smoothing: 0.7,
  peakHoldMs: 800,
  peakDecayRate: 0.015,
};

// ─────────────────────────────────────────
// VISUALIZER
// ─────────────────────────────────────────

class VoiceVisualizer {
  private config: VisualizerConfig = { ...DEFAULT_CONFIG };
  private smoothedBars: number[] = [];
  private peakValues: number[] = [];
  private peakHoldTimers: number[] = [];
  private rafId: number | null = null;
  private active = false;

  // Reuse these arrays to avoid GC pressure at 60fps
  private _barBuffer: number[] = [];
  private _peakBuffer: number[] = [];

  configure(config: Partial<VisualizerConfig>): void {
    this.config = { ...this.config, ...config };
    this.reset();
  }

  // ── Lifecycle ────────────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    this.reset();
    this.tick();
  }

  stop(): void {
    this.active = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    // Push zeroed data so visualizer gracefully fades out
    const zeros = new Array(this.config.barCount).fill(0);
    useVoiceStore.getState().updateWaveform(zeros);
    useVoiceStore.getState().updateFrequency(zeros);
  }

  private reset(): void {
    this.smoothedBars = new Array(this.config.barCount).fill(0);
    this.peakValues = new Array(this.config.barCount).fill(0);
    this.peakHoldTimers = new Array(this.config.barCount).fill(0);
    this._barBuffer = new Array(this.config.barCount).fill(0);
    this._peakBuffer = new Array(this.config.barCount).fill(0);
  }

  // ── Main tick ────────────────────────────────────────────────────────

  private tick(): void {
    if (!this.active) return;

    const store = useVoiceStore.getState();
    const rawFreq = store.frequencyData;
    const rawWave = store.waveformData;

    if (rawFreq.length > 0) {
      this.processFrequency(rawFreq);
    }

    this.rafId = requestAnimationFrame(() => this.tick());
  }

  // ── Frequency processing ─────────────────────────────────────────────

  private processFrequency(rawFreq: number[]): void {
    const { barCount, smoothing, peakHoldMs, peakDecayRate } = this.config;
    const srcLen = rawFreq.length;
    const now = Date.now();

    for (let i = 0; i < barCount; i++) {
      // Map bar index to frequency bin range (log scale for natural feel)
      const startBin = Math.floor((i / barCount) * srcLen);
      const endBin = Math.floor(((i + 1) / barCount) * srcLen);
      let avg = 0;
      for (let j = startBin; j < endBin && j < srcLen; j++) {
        avg += rawFreq[j];
      }
      avg = endBin > startBin ? avg / (endBin - startBin) : 0;

      // Smoothing
      this.smoothedBars[i] =
        smoothing * this.smoothedBars[i] + (1 - smoothing) * avg;

      const val = this.smoothedBars[i];
      this._barBuffer[i] = val;

      // Peak detection with hold + decay
      if (val >= this.peakValues[i]) {
        this.peakValues[i] = val;
        this.peakHoldTimers[i] = now + peakHoldMs;
      } else if (now > this.peakHoldTimers[i]) {
        this.peakValues[i] = Math.max(0, this.peakValues[i] - peakDecayRate);
      }
      this._peakBuffer[i] = this.peakValues[i];
    }

    // Push processed data — create new arrays to trigger React re-renders
    const store = useVoiceStore.getState();
    store.updateFrequency([...this._barBuffer]);
  }

  // ── Computed values for UI ────────────────────────────────────────────

  /**
   * Returns the current voice activity level (0–1).
   * Use this to drive orb scale animations.
   */
  getActivityLevel(): number {
    if (this.smoothedBars.length === 0) return 0;
    const sum = this.smoothedBars.reduce((a, b) => a + b, 0);
    return Math.min(1, sum / this.smoothedBars.length / 0.3);
  }

  /**
   * Returns peak values for each bar.
   */
  getPeaks(): number[] {
    return [...this._peakBuffer];
  }

  get isActive(): boolean { return this.active; }
}

export const voiceVisualizer = new VoiceVisualizer();
