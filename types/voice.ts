// types/voice.ts
// Voice pipeline types — STT, TTS, wake word detection, audio analysis.
// Pure TypeScript — safe to import anywhere.

export interface AudioAnalysis {
  /** Root mean square volume level 0–1 */
  rms: number;
  /** Peak amplitude 0–1 */
  peak: number;
  /** Raw frequency band data for visualizer (null when mic inactive) */
  frequencies: Float32Array | null;
  /** Whether VAD (voice activity detection) is currently detecting speech */
  isSpeaking: boolean;
  /** Signal-to-noise ratio estimate (0 = silent, 1 = loud speech) */
  snr?: number;
}

export interface RecordingSession {
  id: string;
  startedAt: number;
  endedAt?: number;
  /** Raw audio blob — available only after recording ends */
  audioBlob?: Blob;
  /** Final transcription result */
  transcript?: string;
  /** Transcription confidence score 0–1 */
  confidence?: number;
  /** Duration of actual speech (excluding silence) */
  speechDuration?: number;
}

export interface VoiceVisualizerConfig {
  /** Number of frequency bars to render in the visualizer */
  barCount: number;
  /** Minimum bar height in px */
  minHeight: number;
  /** Maximum bar height in px */
  maxHeight: number;
  /** Waveform smoothing factor 0–1 (higher = smoother but less reactive) */
  smoothing: number;
  /** Visual color mode */
  colorMode: 'static' | 'dynamic' | 'gradient';
}

export interface TTSQueueItem {
  id: string;
  text: string;
  priority: 'high' | 'normal' | 'low';
  createdAt: number;
  /** Optional callback fired when this item starts playing */
  onStart?: () => void;
  /** Optional callback fired when this item finishes */
  onComplete?: () => void;
}

export interface WakeWordDetectionEvent {
  phrase: string;
  confidence: number;
  timestamp: number;
  source: 'electron' | 'browser' | 'custom';
}
