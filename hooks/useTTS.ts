'use client';
// hooks/useTTS.ts
// React hook for text-to-speech.
// Bridges the TTS engine singleton into React component lifecycle.

import { useCallback, useState, useEffect } from 'react';
import { tts } from '@/lib/voice/tts';
import { useAssistantStore } from '@/store/useAssistantStore';
import { useUIStore } from '@/store/useUIStore';

interface UseTTSReturn {
  isSpeaking: boolean;
  isAvailable: boolean;
  voices: SpeechSynthesisVoice[];
  currentProvider: string;
  speak: (text: string) => Promise<void>;
  stop: () => void;
  toggle: (text: string) => Promise<void>;
}

export function useTTS(): UseTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const soundEffects = useUIStore((s) => s.soundEffects);

  // Load available voices — browser voices load asynchronously
  useEffect(() => {
    const loadVoices = () => {
      const available = tts.getVoices();
      if (available.length > 0) setVoices(available);
    };

    loadVoices();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
      return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    }
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!soundEffects) return; // Respect user's sound settings
    if (!text.trim()) return;

    setIsSpeaking(true);
    try {
      await tts.speak(text);
    } finally {
      setIsSpeaking(false);
    }
  }, [soundEffects]);

  const stop = useCallback(() => {
    tts.stop();
    setIsSpeaking(false);
  }, []);

  const toggle = useCallback(async (text: string) => {
    if (tts.isSpeaking) stop();
    else await speak(text);
  }, [speak, stop]);

  return {
    isSpeaking: isSpeaking || tts.isSpeaking,
    isAvailable: tts.isAvailable,
    voices,
    currentProvider: tts.currentProvider,
    speak,
    stop,
    toggle,
  };
}
