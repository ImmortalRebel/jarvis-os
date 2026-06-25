'use client';
// hooks/useVoiceState.ts
// Goal 4 — Voice system state hook.
// Provides a unified interface for all voice-related state:
//   - Mic active/permission state
//   - Voice activity detection (VAD)
//   - Waveform and frequency data for visualizer
//   - TTS queue state
//   - Recording session state
//   - Mute/unmute control
//
// Components subscribe only to the slices they need — prevents
// unnecessary re-renders when unrelated voice data changes.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoiceStore } from '@/store/useVoiceStore';
import { useUIStore } from '@/store/useUIStore';
import { microphone } from '@/lib/voice/microphone';
import { tts } from '@/lib/voice/tts';
import { stt } from '@/lib/voice/stt';
import { voiceVisualizer } from '@/lib/voice/visualizer';

// ─────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────

export interface UseVoiceStateReturn {
  // ── Mic state ──────────────────────────────
  isMicActive: boolean;
  isMicPermissionGranted: boolean | null;
  isMuted: boolean;

  // ── Voice activity ─────────────────────────
  isSpeaking: boolean;       // user is speaking (VAD)
  rms: number;               // volume 0–1
  peak: number;              // peak volume 0–1

  // ── Visualizer data ────────────────────────
  waveformData: number[];    // time-domain for waveform
  frequencyData: number[];   // frequency bins for bars
  activityLevel: number;     // 0–1 for orb scaling

  // ── Recording ──────────────────────────────
  isRecording: boolean;
  activeSessionId: string | null;

  // ── TTS state ──────────────────────────────
  isTTSPlaying: boolean;
  ttsQueueLength: number;

  // ── STT state ──────────────────────────────
  isTranscribing: boolean;
  currentProvider: string;

  // ── Voice state machine ────────────────────
  voiceState: string;

  // ── Controls ───────────────────────────────
  mute: () => void;
  unmute: () => void;
  toggleMute: () => void;
  startMic: () => Promise<void>;
  stopMic: () => void;
  stopTTS: () => void;
  stopSTT: () => void;
  requestMicPermission: () => Promise<boolean>;
}

export function useVoiceState(): UseVoiceStateReturn {
  // ── Store subscriptions (granular to minimize re-renders) ────────────
  const voiceState         = useVoiceStore((s) => s.voiceState);
  const audioAnalysis      = useVoiceStore((s) => s.audioAnalysis);
  const waveformData       = useVoiceStore((s) => s.waveformData);
  const frequencyData      = useVoiceStore((s) => s.frequencyData);
  const activeSession      = useVoiceStore((s) => s.activeSession);
  const ttsQueue           = useVoiceStore((s) => s.ttsQueue);
  const currentTTSItem     = useVoiceStore((s) => s.currentTTSItem);
  const isMicPermission    = useVoiceStore((s) => s.isMicPermissionGranted);
  const setVoiceState      = useVoiceStore((s) => s.setVoiceState);
  const setMicPermission   = useVoiceStore((s) => s.setMicPermission);

  const reducedMotion      = useUIStore((s) => s.reducedMotion);

  // ── Local state ───────────────────────────────────────────────────────
  const [isMicActive, setIsMicActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const mutedRef = useRef(false);

  // Sync mic active state
  useEffect(() => {
    setIsMicActive(microphone.active);
  });

  // Start visualizer when mic is active
  useEffect(() => {
    if (isMicActive && !reducedMotion) {
      voiceVisualizer.start();
    } else {
      voiceVisualizer.stop();
    }
  }, [isMicActive, reducedMotion]);

  // ── Controls ──────────────────────────────────────────────────────────

  const mute = useCallback(() => {
    mutedRef.current = true;
    setIsMuted(true);
    setVoiceState('muted');
    microphone.stop();
  }, [setVoiceState]);

  const unmute = useCallback(() => {
    mutedRef.current = false;
    setIsMuted(false);
    setVoiceState('inactive');
  }, [setVoiceState]);

  const toggleMute = useCallback(() => {
    if (mutedRef.current) unmute();
    else mute();
  }, [mute, unmute]);

  const startMic = useCallback(async () => {
    if (microphone.active) return;
    try {
      await microphone.start();
      setIsMicActive(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Mic failed';
      console.error('[useVoiceState] startMic error:', msg);
    }
  }, []);

  const stopMic = useCallback(() => {
    microphone.stop();
    setIsMicActive(false);
  }, []);

  const stopTTS = useCallback(() => {
    tts.stop();
  }, []);

  const stopSTT = useCallback(() => {
    stt.stop();
  }, []);

  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    const granted = await microphone.requestPermission();
    setMicPermission(granted);
    return granted;
  }, [setMicPermission]);

  // ── Derived values ────────────────────────────────────────────────────
  const activityLevel = voiceVisualizer.getActivityLevel();

  return {
    // Mic
    isMicActive,
    isMicPermissionGranted: isMicPermission,
    isMuted,

    // Voice activity
    isSpeaking: audioAnalysis.isSpeaking,
    rms: audioAnalysis.rms,
    peak: audioAnalysis.peak,

    // Visualizer
    waveformData,
    frequencyData,
    activityLevel,

    // Recording
    isRecording: voiceState === 'recording',
    activeSessionId: activeSession?.id ?? null,

    // TTS
    isTTSPlaying: voiceState === 'playing' || currentTTSItem !== null,
    ttsQueueLength: ttsQueue.length,

    // STT
    isTranscribing: stt.active,
    currentProvider: stt.currentProvider,

    // State machine
    voiceState,

    // Controls
    mute,
    unmute,
    toggleMute,
    startMic,
    stopMic,
    stopTTS,
    stopSTT,
    requestMicPermission,
  };
}
