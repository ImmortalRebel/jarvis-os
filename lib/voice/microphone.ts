// lib/voice/microphone.ts
// Microphone capture layer for Jarvis OS.
// Manages MediaStream, AudioContext, and real-time audio analysis.
// Feeds waveform/frequency data to VoiceStore for visualizer components.
// Handles VAD (Voice Activity Detection) via RMS threshold.
//
// This is a pure class — no React. Use via hooks/useMicrophone.ts in components.

import { useVoiceStore } from '@/store/useVoiceStore';

// ─────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────

export interface MicrophoneConfig {
  /** Sample rate in Hz (default: 16000 — optimal for speech) */
  sampleRate?: number;
  /** FFT size for frequency analysis — must be power of 2 (default: 256) */
  fftSize?: number;
  /** Smoothing for analyser node 0–1 (default: 0.7) */
  smoothingTimeConstant?: number;
  /** RMS threshold above which speech is detected (0–1, default: 0.02) */
  vadThreshold?: number;
  /** Device ID for input selection (default: system default) */
  deviceId?: string;
}

// ─────────────────────────────────────────
// MICROPHONE MANAGER
// ─────────────────────────────────────────

class MicrophoneManager {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrameId: number | null = null;
  private isActive = false;

  private config: Required<MicrophoneConfig> = {
    sampleRate: 16000,
    fftSize: 256,
    smoothingTimeConstant: 0.7,
    vadThreshold: 0.02,
    deviceId: 'default',
  };

  // ── Permission ────────────────────────────────────────────────────────

  /**
   * Request microphone permission without starting capture.
   * Updates VoiceStore.isMicPermissionGranted.
   */
  async requestPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop()); // Release immediately
      useVoiceStore.getState().setMicPermission(true);
      return true;
    } catch {
      useVoiceStore.getState().setMicPermission(false);
      return false;
    }
  }

  /**
   * Enumerate available audio input devices.
   * Requires permission to have been granted first.
   */
  async getDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'audioinput');
  }

  // ── Start / Stop ──────────────────────────────────────────────────────

  /**
   * Start microphone capture and audio analysis loop.
   * Feeds VoiceStore with real-time waveform, frequency, and VAD data.
   */
  async start(config: MicrophoneConfig = {}): Promise<void> {
    if (this.isActive) return;

    this.config = { ...this.config, ...config };

    try {
      // Get media stream
      const constraints: MediaStreamConstraints = {
        audio: {
          sampleRate: this.config.sampleRate,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...(this.config.deviceId !== 'default' && {
            deviceId: { exact: this.config.deviceId },
          }),
        },
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      useVoiceStore.getState().setMicPermission(true);

      // Build AudioContext pipeline
      this.context = new AudioContext({ sampleRate: this.config.sampleRate });
      this.source = this.context.createMediaStreamSource(this.stream);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = this.config.fftSize;
      this.analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;

      this.source.connect(this.analyser);
      this.isActive = true;

      // Start analysis loop
      this.startAnalysisLoop();

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied';
      useVoiceStore.getState().setMicPermission(false);
      throw new Error(`[Microphone] ${msg}`);
    }
  }

  /**
   * Stop microphone capture, release all resources, reset VoiceStore audio data.
   */
  stop(): void {
    if (!this.isActive) return;

    // Stop animation loop
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Disconnect audio graph
    this.source?.disconnect();
    this.analyser?.disconnect();

    // Stop media tracks
    this.stream?.getTracks().forEach((t) => t.stop());

    // Close AudioContext
    if (this.context?.state !== 'closed') {
      void this.context?.close();
    }

    // Reset references
    this.stream = null;
    this.context = null;
    this.source = null;
    this.analyser = null;
    this.isActive = false;

    // Clear store data
    const store = useVoiceStore.getState();
    store.updateWaveform([]);
    store.updateFrequency([]);
    store.updateAudioAnalysis({ rms: 0, peak: 0, frequencies: null, isSpeaking: false });
  }

  // ── Analysis Loop ─────────────────────────────────────────────────────

  private startAnalysisLoop(): void {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount; // fftSize / 2
    const timeData = new Float32Array(bufferLength);
    const freqData = new Uint8Array(bufferLength);

    const tick = () => {
      if (!this.isActive || !this.analyser) return;

      this.analyser.getFloatTimeDomainData(timeData);
      this.analyser.getByteFrequencyData(freqData);

      // ── RMS (volume level) ─────────────────
      let sumSq = 0;
      let peak = 0;
      for (let i = 0; i < timeData.length; i++) {
        const s = timeData[i];
        sumSq += s * s;
        if (Math.abs(s) > peak) peak = Math.abs(s);
      }
      const rms = Math.sqrt(sumSq / timeData.length);

      // ── VAD ────────────────────────────────
      const isSpeaking = rms > this.config.vadThreshold;

      // ── Waveform (normalised 0–1) ──────────
      const waveform = Array.from(timeData).map((v) => (v + 1) / 2);

      // ── Frequency (normalised 0–1) ─────────
      const frequency = Array.from(freqData).map((v) => v / 255);

      // ── Push to store ──────────────────────
      const store = useVoiceStore.getState();
      store.updateAudioAnalysis({ rms, peak, isSpeaking });
      store.updateWaveform(waveform);
      store.updateFrequency(frequency);

      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  // ── Accessors ─────────────────────────────────────────────────────────

  get active(): boolean { return this.isActive; }

  get stream_(): MediaStream | null { return this.stream; }
}

// ─────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────

export const microphone = new MicrophoneManager();
