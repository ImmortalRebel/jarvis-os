// lib/utils/subscriptions.ts
// Optimized Zustand subscription utilities for Jarvis OS.
// Provides pre-built selectors for all stores that use shallow equality
// to minimize React re-renders from Zustand state changes.
//
// Rule: Components subscribe to the smallest possible slice of state.
// High-frequency stores (VoiceStore with 60fps waveform updates) need
// special selectors that skip renders when only waveform data changes.

import { useAssistantStore } from '@/store/useAssistantStore';
import { useVoiceStore } from '@/store/useVoiceStore';
import { useUIStore } from '@/store/useUIStore';
import { shallowEqual } from './memoize';
import type { AssistantMode, ConversationMessage, AIConfig } from '@/types/assistant';

// ─────────────────────────────────────────
// ASSISTANT STORE SELECTORS
// ─────────────────────────────────────────

/** Subscribe only to mode — re-renders only when mode changes */
export const selectMode = (s: ReturnType<typeof useAssistantStore.getState>) => s.mode;

/** Subscribe to derived mode flags as a shallow-compared object */
export function selectModeFlags(s: ReturnType<typeof useAssistantStore.getState>) {
  return {
    isIdle:       s.mode === 'idle',
    isSleeping:   s.mode === 'sleeping',
    isListening:  s.mode === 'listening',
    isProcessing: s.mode === 'processing',
    isThinking:   s.mode === 'thinking',
    isSpeaking:   s.mode === 'speaking',
    isWaking:     s.mode === 'wake',
    hasError:     s.mode === 'error',
    isActive:     s.mode !== 'idle' && s.mode !== 'sleeping' && s.mode !== 'error',
  };
}

/** Subscribe only to messages — re-renders when message array reference changes */
export const selectMessages = (s: ReturnType<typeof useAssistantStore.getState>) => s.messages;

/** Subscribe to last message only */
export const selectLastMessage = (
  s: ReturnType<typeof useAssistantStore.getState>,
): ConversationMessage | null => s.messages.at(-1) ?? null;

/** Subscribe to conversation metadata (not the messages themselves) */
export function selectConversationMeta(s: ReturnType<typeof useAssistantStore.getState>) {
  return {
    messageCount: s.messages.length,
    sessionId: s.sessionId,
    interactionCount: s.interactionCount,
    isStreaming: s.isStreaming,
    currentTranscript: s.currentTranscript,
  };
}

/** Subscribe to AI config */
export const selectAIConfig = (s: ReturnType<typeof useAssistantStore.getState>): AIConfig => s.aiConfig;

/** Subscribe to error state */
export function selectErrorState(s: ReturnType<typeof useAssistantStore.getState>) {
  return { hasError: s.mode === 'error', error: s.error };
}

// ─────────────────────────────────────────
// VOICE STORE SELECTORS
// ─────────────────────────────────────────

/**
 * Subscribe only to voice state — NOT to waveform (60fps).
 * Use this for components that need mode info but not visualizer data.
 */
export const selectVoiceState = (s: ReturnType<typeof useVoiceStore.getState>) => s.voiceState;

/**
 * Subscribe only to waveform data — for visualizer components only.
 * Isolated so non-visualizer components don't re-render at 60fps.
 */
export const selectWaveformData = (s: ReturnType<typeof useVoiceStore.getState>) => s.waveformData;
export const selectFrequencyData = (s: ReturnType<typeof useVoiceStore.getState>) => s.frequencyData;

/**
 * Subscribe to audio analysis as a shallow-compared object.
 * Prevents re-render when rms changes by tiny amounts.
 */
export function selectAudioAnalysis(s: ReturnType<typeof useVoiceStore.getState>) {
  return {
    rms: Math.round(s.audioAnalysis.rms * 100) / 100, // 2 decimal places
    peak: s.audioAnalysis.peak,
    isSpeaking: s.audioAnalysis.isSpeaking,
  };
}

/** Subscribe to mic permission state */
export const selectMicPermission = (
  s: ReturnType<typeof useVoiceStore.getState>,
) => s.isMicPermissionGranted;

/** Subscribe to TTS state (is something playing?) */
export function selectTTSState(s: ReturnType<typeof useVoiceStore.getState>) {
  return {
    isPlaying: s.currentTTSItem !== null,
    queueLength: s.ttsQueue.length,
    currentItem: s.currentTTSItem,
  };
}

// ─────────────────────────────────────────
// UI STORE SELECTORS
// ─────────────────────────────────────────

/** Subscribe only to theme */
export const selectTheme = (s: ReturnType<typeof useUIStore.getState>) => s.theme;

/** Subscribe only to reducedMotion */
export const selectReducedMotion = (s: ReturnType<typeof useUIStore.getState>) => s.reducedMotion;

/** Subscribe to notifications array */
export const selectNotifications = (s: ReturnType<typeof useUIStore.getState>) => s.notifications;

/** Subscribe to UI preferences as shallow-compared object */
export function selectUIPreferences(s: ReturnType<typeof useUIStore.getState>) {
  return {
    theme: s.theme,
    reducedMotion: s.reducedMotion,
    soundEffects: s.soundEffects,
    isCompactMode: s.isCompactMode,
  };
}

// ─────────────────────────────────────────
// SUBSCRIPTION EQUALITY HELPERS
// ─────────────────────────────────────────

/**
 * Use as the equality function in useStore(selector, shallowEqual)
 * to prevent re-renders when the selected object has the same values.
 *
 * @example
 * const flags = useAssistantStore(selectModeFlags, strictShallowEqual)
 */
export function strictShallowEqual<T extends object>(a: T, b: T): boolean {
  return shallowEqual(a, b);
}

/**
 * Equality function that ignores waveform/frequency data changes.
 * Prevents re-renders in non-visualizer components from 60fps updates.
 */
export function voiceStateEquality(
  a: { voiceState: string; isMicPermissionGranted: boolean | null },
  b: { voiceState: string; isMicPermissionGranted: boolean | null },
): boolean {
  return a.voiceState === b.voiceState &&
    a.isMicPermissionGranted === b.isMicPermissionGranted;
}
