// lib/voice/tts.ts
// Text-to-Speech engine for Jarvis OS.
// Currently uses browser SpeechSynthesis API.
// Architecture is provider-ready — swap to ElevenLabs/OpenAI TTS by
// implementing the TTSProvider interface and registering in the factory below.
//
// This is a pure singleton — no React. Use via hooks/useTTS.ts in components.

import { useVoiceStore } from '@/store/useVoiceStore';
import { useAssistantStore } from '@/store/useAssistantStore';
import { transitionMode } from '@/lib/assistant/modes';

// ─────────────────────────────────────────
// PROVIDER INTERFACE
// ─────────────────────────────────────────

export interface TTSSpeakOptions {
  text: string;
  voiceId?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  signal?: AbortSignal;
  onStart?: () => void;
  onEnd?: () => void;
  onWord?: (word: string, charIndex: number) => void;
}

export interface ITTSProvider {
  readonly name: string;
  readonly isAvailable: boolean;
  speak(options: TTSSpeakOptions): Promise<void>;
  stop(): void;
}

// ─────────────────────────────────────────
// BROWSER PROVIDER
// ─────────────────────────────────────────

class BrowserTTSProvider implements ITTSProvider {
  readonly name = 'browser';
  private utterance: SpeechSynthesisUtterance | null = null;

  get isAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  getVoices(): SpeechSynthesisVoice[] {
    if (!this.isAvailable) return [];
    return window.speechSynthesis.getVoices();
  }

  getEnglishVoices(): SpeechSynthesisVoice[] {
    return this.getVoices().filter((v) => v.lang.startsWith('en'));
  }

  speak(options: TTSSpeakOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isAvailable) {
        resolve();
        return;
      }

      const { text, rate = 1.0, pitch = 1.0, volume = 0.9, signal, onStart, onEnd, onWord, voiceId } = options;

      if (!text.trim()) {
        resolve();
        return;
      }

      // Cancel any current speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      this.utterance = utterance;

      utterance.rate = Math.max(0.1, Math.min(10, rate));
      utterance.pitch = Math.max(0, Math.min(2, pitch));
      utterance.volume = Math.max(0, Math.min(1, volume));
      utterance.lang = 'en-US';

      // Select voice by ID if provided
      if (voiceId && voiceId !== 'default') {
        const voices = this.getVoices();
        const match = voices.find((v) => v.voiceURI === voiceId || v.name === voiceId);
        if (match) utterance.voice = match;
      }

      // Handle abort signal
      if (signal) {
        if (signal.aborted) {
          resolve();
          return;
        }
        signal.addEventListener('abort', () => {
          window.speechSynthesis.cancel();
          resolve();
        });
      }

      utterance.onstart = () => onStart?.();
      utterance.onend = () => {
        this.utterance = null;
        onEnd?.();
        resolve();
      };
      utterance.onerror = (e) => {
        this.utterance = null;
        if (e.error === 'interrupted' || e.error === 'canceled') {
          resolve();
        } else {
          reject(new Error(`TTS error: ${e.error}`));
        }
      };
      utterance.onboundary = (e) => {
        if (e.name === 'word') {
          const word = text.substring(e.charIndex, e.charIndex + e.charLength);
          onWord?.(word, e.charIndex);
        }
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  stop(): void {
    if (this.isAvailable) {
      window.speechSynthesis.cancel();
    }
    this.utterance = null;
  }
}

// ─────────────────────────────────────────
// TTS ENGINE
// ─────────────────────────────────────────

class TTSEngine {
  private provider: ITTSProvider = new BrowserTTSProvider();
  private speaking = false;

  /**
   * Register a custom TTS provider (ElevenLabs, OpenAI, etc.)
   * Call this before first use.
   */
  setProvider(provider: ITTSProvider): void {
    this.stop();
    this.provider = provider;
  }

  get currentProvider(): string {
    return this.provider.name;
  }

  get isAvailable(): boolean {
    return this.provider.isAvailable;
  }

  get isSpeaking(): boolean {
    return this.speaking;
  }

  /**
   * Get voices (browser provider only).
   */
  getVoices(): SpeechSynthesisVoice[] {
    if (this.provider instanceof BrowserTTSProvider) {
      return this.provider.getEnglishVoices();
    }
    return [];
  }

  /**
   * Speak text through the current provider.
   * Manages VoiceStore queue and AssistantStore mode transitions.
   */
  async speak(text: string, signal?: AbortSignal): Promise<void> {
    if (!text.trim() || !this.provider.isAvailable) return;

    const { ttsConfig } = useAssistantStore.getState();
    const voiceStore = useVoiceStore.getState();

    // Add to TTS queue (tracked by visualizer)
    const itemId = voiceStore.enqueueTTS(text, 'normal');
    voiceStore.dequeueTTS();

    this.speaking = true;
    transitionMode('speaking', { force: true });

    try {
      await this.provider.speak({
        text,
        voiceId: ttsConfig.voiceId,
        rate: ttsConfig.speed,
        pitch: ttsConfig.pitch,
        volume: ttsConfig.volume,
        signal,
        onStart: () => {
          if (process.env.NODE_ENV === 'development') {
            console.debug('[TTS] Started speaking:', text.substring(0, 50) + '...');
          }
        },
        onEnd: () => {
          voiceStore.completeTTSItem();
        },
      });
    } finally {
      this.speaking = false;
      voiceStore.completeTTSItem();
    }
  }

  /**
   * Stop current TTS playback immediately.
   */
  stop(): void {
    this.provider.stop();
    this.speaking = false;
    useVoiceStore.getState().clearTTSQueue();
  }
}

// ─────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────

export const tts = new TTSEngine();
export { BrowserTTSProvider };
