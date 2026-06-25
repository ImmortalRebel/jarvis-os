'use client';
// hooks/useMicrophone.ts
// React hook for microphone capture and audio analysis.
// Bridges the microphone singleton into React component lifecycle.
// Feeds real-time waveform and VAD data from VoiceStore.

import { useEffect, useCallback, useState } from 'react';
import { microphone } from '@/lib/voice/microphone';
import { useVoiceStore } from '@/store/useVoiceStore';
import { useAssistantStore } from '@/store/useAssistantStore';
import type { MicrophoneConfig } from '@/lib/voice/microphone';

interface UseMicrophoneOptions {
  /** Start microphone automatically when hook mounts (default: false) */
  autoStart?: boolean;
  /** Mic config overrides */
  config?: MicrophoneConfig;
  /** Called when mic starts successfully */
  onStart?: () => void;
  /** Called when mic stops */
  onStop?: () => void;
  /** Called on mic error */
  onError?: (error: string) => void;
}

interface UseMicrophoneReturn {
  isActive: boolean;
  isPermissionGranted: boolean | null;
  waveformData: number[];
  frequencyData: number[];
  rms: number;
  isSpeaking: boolean;
  start: (config?: MicrophoneConfig) => Promise<void>;
  stop: () => void;
  toggle: (config?: MicrophoneConfig) => Promise<void>;
  requestPermission: () => Promise<boolean>;
}

export function useMicrophone(options: UseMicrophoneOptions = {}): UseMicrophoneReturn {
  const { autoStart = false, config, onStart, onStop, onError } = options;
  const [isActive, setIsActive] = useState(false);

  const waveformData = useVoiceStore((s) => s.waveformData);
  const frequencyData = useVoiceStore((s) => s.frequencyData);
  const audioAnalysis = useVoiceStore((s) => s.audioAnalysis);
  const isPermissionGranted = useVoiceStore((s) => s.isMicPermissionGranted);
  // sttConfig available for future STT language routing if needed

  const start = useCallback(async (overrideConfig?: MicrophoneConfig) => {
    if (microphone.active) return;
    try {
      await microphone.start({
        ...config,
        ...overrideConfig,
      });
      setIsActive(true);
      onStart?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Microphone failed to start';
      onError?.(msg);
    }
  }, [config, onStart, onError]);

  const stop = useCallback(() => {
    if (!microphone.active) return;
    microphone.stop();
    setIsActive(false);
    onStop?.();
  }, [onStop]);

  const toggle = useCallback(async (overrideConfig?: MicrophoneConfig) => {
    if (microphone.active) stop();
    else await start(overrideConfig);
  }, [start, stop]);

  const requestPermission = useCallback(async () => {
    return microphone.requestPermission();
  }, []);

  // Auto-start on mount if requested
  useEffect(() => {
    if (autoStart) {
      void start();
    }
    return () => {
      // Always stop mic on unmount to release resources
      if (microphone.active) {
        microphone.stop();
        setIsActive(false);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync isActive with actual microphone state
  useEffect(() => {
    setIsActive(microphone.active);
  }, []);

  return {
    isActive,
    isPermissionGranted,
    waveformData,
    frequencyData,
    rms: audioAnalysis.rms,
    isSpeaking: audioAnalysis.isSpeaking,
    start,
    stop,
    toggle,
    requestPermission,
  };
}
