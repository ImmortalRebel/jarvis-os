// lib/voice/stt.ts
// Speech-to-Text abstraction layer for Jarvis OS.
//
// Provider hierarchy (auto-selected):
//   1. Whisper API (via /api/stt route) — if configured
//   2. Browser Web Speech API          — default, zero cost
//   3. Deepgram                        — future integration slot
//
// This module is a singleton. Components use hooks/useVoiceInput.ts.
// The pipeline uses this directly via pipeline/executor.ts.

import { useVoiceStore } from '@/store/useVoiceStore';
import { useAssistantStore } from '@/store/useAssistantStore';
import { microphone } from './microphone';

// ─────────────────────────────────────────
// PROVIDER INTERFACE
// ─────────────────────────────────────────

export interface STTResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  language: string;
}

export interface STTOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxDuration?: number;
  silenceThreshold?: number;
  onInterim?: (text: string) => void;
  onFinal?: (result: STTResult) => void;
  onError?: (error: string) => void;
  signal?: AbortSignal;
}

export interface ISTTProvider {
  readonly name: string;
  readonly isAvailable: boolean;
  transcribe(options: STTOptions): Promise<STTResult>;
  startContinuous(options: STTOptions): () => void;
  stop(): void;
}

// ─────────────────────────────────────────
// BROWSER WEB SPEECH PROVIDER
// ─────────────────────────────────────────

class BrowserSTTProvider implements ISTTProvider {
  readonly name = 'browser';
  private recognition: SpeechRecognition | null = null;

  get isAvailable(): boolean {
    return typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  }

  private createRecognition(lang: string): SpeechRecognition {
    const API = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const rec = new API();
    rec.lang = lang;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.interimResults = true;
    return rec;
  }

  transcribe(options: STTOptions): Promise<STTResult> {
    return new Promise((resolve, reject) => {
      if (!this.isAvailable) {
        reject(new Error('Web Speech API not available'));
        return;
      }

      const {
        language = 'en-US',
        maxDuration = 30_000,
        onInterim,
        onFinal,
        signal,
      } = options;

      const rec = this.createRecognition(language);
      this.recognition = rec;
      let finalTranscript = '';
      let finalConfidence = 0;

      const timeout = setTimeout(() => {
        rec.stop();
      }, maxDuration);

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          rec.abort();
          resolve({ transcript: finalTranscript, confidence: finalConfidence, isFinal: true, language });
        });
      }

      rec.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) {
            finalTranscript += r[0].transcript;
            finalConfidence = r[0].confidence ?? 0.9;
            onFinal?.({ transcript: finalTranscript, confidence: finalConfidence, isFinal: true, language });
          } else {
            interim += r[0].transcript;
            onInterim?.(interim);
          }
        }
      };

      rec.onerror = (e: SpeechRecognitionErrorEvent) => {
        clearTimeout(timeout);
        if (e.error === 'aborted' || e.error === 'no-speech') {
          resolve({ transcript: finalTranscript, confidence: finalConfidence, isFinal: true, language });
        } else {
          reject(new Error(`STT error: ${e.error}`));
        }
      };

      rec.onend = () => {
        clearTimeout(timeout);
        this.recognition = null;
        resolve({ transcript: finalTranscript, confidence: finalConfidence, isFinal: true, language });
      };

      try {
        rec.start();
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  startContinuous(options: STTOptions): () => void {
    if (!this.isAvailable) return () => {};

    const { language = 'en-US', onInterim, onFinal, onError } = options;
    let active = true;

    const startSession = () => {
      if (!active) return;
      const rec = this.createRecognition(language);
      rec.continuous = false;
      rec.interimResults = true;
      this.recognition = rec;

      rec.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) {
            const result: STTResult = {
              transcript: r[0].transcript,
              confidence: r[0].confidence ?? 0.9,
              isFinal: true,
              language,
            };
            onFinal?.(result);
          } else {
            interim += r[0].transcript;
            onInterim?.(interim);
          }
        }
      };

      rec.onerror = (e: SpeechRecognitionErrorEvent) => {
        if (e.error !== 'aborted' && e.error !== 'no-speech') {
          onError?.(`STT error: ${e.error}`);
        }
      };

      rec.onend = () => {
        if (active) setTimeout(startSession, 300);
      };

      try { rec.start(); } catch { /* already started */ }
    };

    startSession();

    return () => {
      active = false;
      this.recognition?.abort();
      this.recognition = null;
    };
  }

  stop(): void {
    this.recognition?.stop();
    this.recognition = null;
  }
}

// ─────────────────────────────────────────
// WHISPER PROVIDER (via Next.js Route Handler)
// ─────────────────────────────────────────

class WhisperSTTProvider implements ISTTProvider {
  readonly name = 'whisper';

  get isAvailable(): boolean {
    return typeof process !== 'undefined' &&
      !!(process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY);
  }

  async transcribe(options: STTOptions): Promise<STTResult> {
    const { language = 'en', signal } = options;

    // Capture audio using the microphone manager
    if (!microphone.active) {
      throw new Error('Microphone not active — start recording first');
    }

    // For Whisper, we capture audio blob from the mic stream
    // then POST to /api/stt which calls OpenAI Whisper
    const stream = microphone.stream_;
    if (!stream) throw new Error('No active media stream');

    return new Promise((resolve, reject) => {
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const form = new FormData();
        form.append('audio', blob, 'audio.webm');
        form.append('language', language);

        try {
          const res = await fetch('/api/stt', { method: 'POST', body: form, signal });
          if (!res.ok) throw new Error(`Whisper API error: ${res.status}`);
          const data = await res.json() as { transcript: string; confidence?: number };
          resolve({ transcript: data.transcript, confidence: data.confidence ?? 0.95, isFinal: true, language });
        } catch (err) {
          reject(err);
        }
      };

      recorder.onerror = (e) => reject(new Error(`MediaRecorder error: ${(e as ErrorEvent).message}`));

      recorder.start();
      // Max 30s then auto-stop
      setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 30_000);

      signal?.addEventListener('abort', () => {
        if (recorder.state === 'recording') recorder.stop();
      });
    });
  }

  startContinuous(_options: STTOptions): () => void {
    // Whisper is not continuous — fall back to browser for continuous mode
    return () => {};
  }

  stop(): void {
    // Handled via signal abort
  }
}

// ─────────────────────────────────────────
// STT ENGINE
// ─────────────────────────────────────────

class STTEngine {
  private browserProvider = new BrowserSTTProvider();
  private whisperProvider = new WhisperSTTProvider();
  private activeProvider: ISTTProvider;
  private isRecording = false;
  private stopContinuous: (() => void) | null = null;

  constructor() {
    this.activeProvider = this.browserProvider;
  }

  get currentProvider(): string { return this.activeProvider.name; }
  get isAvailable(): boolean { return this.activeProvider.isAvailable; }
  get active(): boolean { return this.isRecording; }

  /**
   * Select STT provider. Auto-selects Whisper if API key is present
   * and the request came from a component that opts into Whisper.
   */
  selectProvider(prefer: 'browser' | 'whisper' | 'auto' = 'auto'): void {
    if (prefer === 'whisper' && this.whisperProvider.isAvailable) {
      this.activeProvider = this.whisperProvider;
    } else if (prefer === 'browser') {
      this.activeProvider = this.browserProvider;
    } else {
      // Auto: prefer whisper if available
      this.activeProvider = this.whisperProvider.isAvailable
        ? this.whisperProvider
        : this.browserProvider;
    }
  }

  /**
   * Transcribe a single utterance and return the result.
   * Used by the main pipeline after wake word detection.
   */
  async transcribe(options: STTOptions = {}): Promise<STTResult> {
    const store = useVoiceStore.getState();
    const { sttConfig } = useAssistantStore.getState();
    const sessionId = store.startRecordingSession();
    this.isRecording = true;

    const finalOptions: STTOptions = {
      language: sttConfig.language,
      maxDuration: sttConfig.maxDuration,
      ...options,
      onInterim: (text) => {
        store.updateAudioAnalysis({ isSpeaking: true });
        useAssistantStore.getState().setCurrentTranscript(text);
        options.onInterim?.(text);
      },
      onFinal: (result) => {
        useAssistantStore.getState().setCurrentTranscript(result.transcript);
        options.onFinal?.(result);
      },
    };

    try {
      const result = await this.activeProvider.transcribe(finalOptions);
      store.endRecordingSession(sessionId, {
        transcript: result.transcript,
        confidence: result.confidence,
      });
      return result;
    } finally {
      this.isRecording = false;
      store.updateAudioAnalysis({ isSpeaking: false });
    }
  }

  /**
   * Start continuous listening (wake-word-free mode).
   * Every final utterance calls options.onFinal.
   */
  startContinuous(options: STTOptions): void {
    this.stopContinuous?.();
    this.isRecording = true;
    this.stopContinuous = this.browserProvider.startContinuous(options);
  }

  /**
   * Stop all active recognition.
   */
  stop(): void {
    this.stopContinuous?.();
    this.stopContinuous = null;
    this.activeProvider.stop();
    this.isRecording = false;
    useAssistantStore.getState().setCurrentTranscript('');
  }
}

export const stt = new STTEngine();
export { BrowserSTTProvider, WhisperSTTProvider };
