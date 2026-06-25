'use client';
// hooks/useVoiceInput.ts
// Browser Web Speech API hook for real-time speech-to-text.
// Gracefully degrades when the browser does not support SpeechRecognition.
// Integrates with VoiceStore for centralised recording session management.
//
// Bug fix from planning phase:
// - The `transcript` state used inside `recognition.onend` was captured in a
//   stale closure. Fixed by mirroring transcript into a ref.

import { useEffect, useRef, useCallback, useState } from 'react';
import { useVoiceStore } from '@/store/useVoiceStore';
import { useAssistantStore } from '@/store/useAssistantStore';

// ─────────────────────────────────────────
// BROWSER API TYPES
// ─────────────────────────────────────────
// SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent and
// Window.webkitSpeechRecognition are declared globally in:
//   types/speech-recognition.d.ts
// No local declare global needed here.

// ─────────────────────────────────────────
// OPTIONS & RETURN TYPES
// ─────────────────────────────────────────

interface UseVoiceInputOptions {
  /** Called with the final transcript when recognition ends */
  onTranscript?: (transcript: string, confidence: number) => void;
  /** Called when a recoverable recognition error occurs */
  onError?: (error: string) => void;
  /** Start listening immediately on mount (default: false) */
  autoStart?: boolean;
  /** BCP 47 language tag — overrides STT config if provided */
  language?: string;
}

interface UseVoiceInputReturn {
  /** Whether the browser supports the Web Speech API */
  isSupported: boolean;
  /** Whether the mic is actively recording */
  isListening: boolean;
  /** Start recording */
  start: () => void;
  /** Stop recording gracefully (fires onTranscript if there's a result) */
  stop: () => void;
  /** Toggle recording on/off */
  toggle: () => void;
  /** The most recent final transcript */
  transcript: string;
  /** In-progress interim transcript (updates in real-time) */
  interimTranscript: string;
  /** Confidence of the last final transcript (0–1) */
  confidence: number;
  /** Clear the stored transcript */
  clearTranscript: () => void;
}

// ─────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────

export function useVoiceInput({
  onTranscript,
  onError,
  autoStart = false,
  language,
}: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);

  // Refs to avoid stale closures inside recognition event handlers
  const transcriptRef = useRef('');
  const confidenceRef = useRef(0);
  const sessionIdRef = useRef<string | undefined>(undefined);

  const { setVoiceState, startRecordingSession, endRecordingSession } = useVoiceStore();
  const { sttConfig } = useAssistantStore();

  const lang = language ?? sttConfig.language;

  // ── Support check ──────────────────────────────────────

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // ── Initialise recognition instance ───────────────────

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionAPI =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = lang;

    recognition.onstart = () => {
      sessionIdRef.current = startRecordingSession();
      setIsListening(true);
      setVoiceState('recording');
      transcriptRef.current = '';
      confidenceRef.current = 0;
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let finalText = '';
      let finalConfidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
          finalConfidence = result[0].confidence ?? 0.85;
        } else {
          interim += result[0].transcript;
        }
      }

      if (interim) {
        setInterimTranscript(interim);
      }
      if (finalText) {
        transcriptRef.current = finalText;
        confidenceRef.current = finalConfidence;
        setTranscript(finalText);
        setConfidence(finalConfidence);
        setInterimTranscript('');
        onTranscript?.(finalText, finalConfidence);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsListening(false);
      setVoiceState('inactive');

      if (sessionIdRef.current) {
        endRecordingSession(sessionIdRef.current, {
          transcript: transcriptRef.current || undefined,
          confidence: confidenceRef.current || undefined,
        });
        sessionIdRef.current = undefined;
      }

      // 'aborted' is not an error — it's triggered by calling .abort() manually
      if (event.error !== 'aborted') {
        const msg = `Voice input error: ${event.error}`;
        onError?.(msg);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setVoiceState('inactive');
      setInterimTranscript('');

      // Use refs here to avoid stale closure — this is the bug fix
      if (sessionIdRef.current) {
        endRecordingSession(sessionIdRef.current, {
          transcript: transcriptRef.current || undefined,
          confidence: confidenceRef.current || undefined,
        });
        sessionIdRef.current = undefined;
      }
    };

    recognitionRef.current = recognition;

    if (autoStart) {
      try {
        recognition.start();
      } catch {
        // No-op: already started or permission denied
      }
    }

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [lang, isSupported]); // Re-init only when language changes

  // ── Controls ───────────────────────────────────────────

  const start = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    setTranscript('');
    setInterimTranscript('');
    setConfidence(0);
    transcriptRef.current = '';
    confidenceRef.current = 0;
    try {
      recognitionRef.current.start();
    } catch {
      // Ignore "already started" errors
    }
  }, [isListening]);

  const stop = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;
    recognitionRef.current.stop();
  }, [isListening]);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else start();
  }, [isListening, start, stop]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setConfidence(0);
    transcriptRef.current = '';
    confidenceRef.current = 0;
  }, []);

  return {
    isSupported,
    isListening,
    start,
    stop,
    toggle,
    transcript,
    interimTranscript,
    confidence,
    clearTranscript,
  };
}
