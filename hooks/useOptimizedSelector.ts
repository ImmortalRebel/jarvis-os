'use client';
// hooks/useOptimizedSelector.ts
// Optimized Zustand subscription hook using shallow equality.
// Prevents unnecessary re-renders when store state changes but
// the selected slice is structurally identical.
//
// Also provides pre-built hooks for common high-performance patterns.

import { useShallow } from 'zustand/react/shallow';
import { useAssistantStore } from '@/store/useAssistantStore';
import { useVoiceStore } from '@/store/useVoiceStore';
import { useUIStore } from '@/store/useUIStore';
import {
  selectModeFlags,
  selectConversationMeta,
  selectAudioAnalysis,
  selectUIPreferences,
  selectTTSState,
  strictShallowEqual,
} from '@/lib/utils/subscriptions';

// ─────────────────────────────────────────
// PRIMARY HOOK
// ─────────────────────────────────────────

/**
 * Subscribe to AssistantStore with shallow equality on the selected slice.
 * The selector function is called on every store update but the component
 * only re-renders when the returned value is not shallowly equal.
 *
 * @example
 * // Only re-renders when mode, error, or isStreaming changes
 * const { mode, error } = useAssistantSelector(s => ({
 *   mode: s.mode,
 *   error: s.error,
 *   isStreaming: s.isStreaming
 * }))
 */
export function useAssistantSelector<T extends object>(
  selector: (state: ReturnType<typeof useAssistantStore.getState>) => T,
): T {
  return useAssistantStore(useShallow(selector));
}

/**
 * Subscribe to VoiceStore with shallow equality.
 * Critical for preventing 60fps re-renders from waveform updates.
 */
export function useVoiceSelector<T extends object>(
  selector: (state: ReturnType<typeof useVoiceStore.getState>) => T,
): T {
  return useVoiceStore(useShallow(selector));
}

/**
 * Subscribe to UIStore with shallow equality.
 */
export function useUISelector<T extends object>(
  selector: (state: ReturnType<typeof useUIStore.getState>) => T,
): T {
  return useUIStore(useShallow(selector));
}

// ─────────────────────────────────────────
// PRE-BUILT HIGH-PERFORMANCE HOOKS
// ─────────────────────────────────────────

/**
 * Returns boolean flags for the current assistant mode.
 * Only re-renders when a flag value changes.
 * Does NOT subscribe to messages, config, or voice data.
 */
export function useModeFlags() {
  return useAssistantStore(useShallow(selectModeFlags));
}

/**
 * Returns conversation metadata (count, streaming state, transcript).
 * Does NOT subscribe to the full messages array — prevents re-render
 * on every token during streaming.
 */
export function useConversationMeta() {
  return useAssistantStore(useShallow(selectConversationMeta));
}

/**
 * Returns rounded audio analysis values.
 * RMS is rounded to 2dp — prevents re-renders on tiny float changes.
 * Only use in components that actually display audio levels.
 */
export function useAudioAnalysis() {
  return useVoiceStore(useShallow(selectAudioAnalysis));
}

/**
 * Returns TTS playback state.
 * Isolated so non-audio components don't re-render during TTS.
 */
export function useTTSState() {
  return useVoiceStore(useShallow(selectTTSState));
}

/**
 * Returns UI preferences (theme, reducedMotion, soundEffects, compactMode).
 * Only re-renders when a preference actually changes.
 */
export function useUIPreferences() {
  return useUIStore(useShallow(selectUIPreferences));
}

/**
 * Generic optimized selector — alias for useAssistantSelector.
 * Exported as useOptimizedSelector for generic usage patterns.
 */
export function useOptimizedSelector<T extends object>(
  selector: (state: ReturnType<typeof import('@/store/useAssistantStore').useAssistantStore.getState>) => T,
): T {
  return useAssistantSelector(selector);
}
