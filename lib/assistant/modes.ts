// lib/assistant/modes.ts
// Assistant mode transition state machine.
// Validates and enforces legal state transitions.
// Used by the runtime to prevent illegal mode jumps (e.g. sleeping → speaking).

import {
  type AssistantMode,
  VALID_TRANSITIONS,
  ASSISTANT_MODE_CONFIG,
} from '@/types/assistant';
import { useAssistantStore } from '@/store/useAssistantStore';
import { useVoiceStore } from '@/store/useVoiceStore';
import type { VoiceState } from '@/types/assistant';

// ─────────────────────────────────────────
// TRANSITION VALIDATION
// ─────────────────────────────────────────

/**
 * Returns true if transitioning from `from` to `to` is a legal move.
 * Always allows transitioning to 'error' or 'idle' from any state.
 */
export function isValidTransition(from: AssistantMode, to: AssistantMode): boolean {
  if (to === 'error' || to === 'idle') return true;
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Returns the next legal modes from the current mode.
 */
export function getValidNextModes(current: AssistantMode): AssistantMode[] {
  return VALID_TRANSITIONS[current] ?? [];
}

// ─────────────────────────────────────────
// VOICE STATE SYNC MAP
// Which VoiceState each AssistantMode implies
// ─────────────────────────────────────────

const MODE_TO_VOICE_STATE: Record<AssistantMode, VoiceState> = {
  idle:       'inactive',
  sleeping:   'inactive',
  wake:       'inactive',
  listening:  'recording',
  processing: 'processing',
  thinking:   'processing',
  speaking:   'playing',
  error:      'inactive',
};

// ─────────────────────────────────────────
// TRANSITION EXECUTOR
// Single function that transitions mode + syncs voice state atomically
// ─────────────────────────────────────────

export interface TransitionResult {
  success: boolean;
  from: AssistantMode;
  to: AssistantMode;
  reason?: string;
}

/**
 * Perform a validated mode transition.
 * Updates both AssistantStore and VoiceStore atomically.
 * Logs invalid transitions in development without throwing.
 *
 * @example
 * const result = transitionMode('listening')
 * if (!result.success) console.warn(result.reason)
 */
export function transitionMode(
  to: AssistantMode,
  options: { force?: boolean; reason?: string } = {},
): TransitionResult {
  const currentMode = useAssistantStore.getState().mode;

  if (!options.force && !isValidTransition(currentMode, to)) {
    const reason = `Invalid transition: ${currentMode} → ${to}. Valid next: [${getValidNextModes(currentMode).join(', ')}]`;
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[JarvisRuntime] ${reason}`);
    }
    return { success: false, from: currentMode, to, reason };
  }

  // Update assistant mode
  useAssistantStore.getState().setMode(to);

  // Sync voice state
  const nextVoiceState = MODE_TO_VOICE_STATE[to];
  useVoiceStore.getState().setVoiceState(nextVoiceState);

  if (process.env.NODE_ENV === 'development') {
    const config = ASSISTANT_MODE_CONFIG[to];
    console.debug(`[JarvisRuntime] Mode: ${currentMode} → ${to} (${config.label})`);
  }

  return { success: true, from: currentMode, to };
}

/**
 * Force a mode transition regardless of current state.
 * Use only for error recovery and external IPC events.
 */
export function forceMode(to: AssistantMode): TransitionResult {
  return transitionMode(to, { force: true });
}

/**
 * Sleep the assistant — transitions to 'sleeping' and resets voice state.
 * Voice will still listen for wake word if wakeWordConfig.enabled = true.
 */
export function sleepAssistant(): TransitionResult {
  useVoiceStore.getState().reset();
  useAssistantStore.getState().setCurrentTranscript('');
  return transitionMode('sleeping', { force: true });
}

/**
 * Wake the assistant — brief 'wake' state then transitions to 'listening'.
 * @param delayMs - how long to stay in 'wake' state before listening (default 600ms)
 */
export function wakeAssistant(delayMs = 600): void {
  transitionMode('wake', { force: true });
  setTimeout(() => {
    transitionMode('listening', { force: true });
  }, delayMs);
}

/**
 * Reset to idle — clears error state, resets voice, keeps config intact.
 */
export function resetToIdle(): void {
  useVoiceStore.getState().reset();
  useAssistantStore.getState().setCurrentTranscript('');
  useAssistantStore.getState().setIsStreaming(false);
  useAssistantStore.getState().setError(null);
  forceMode('idle');
}
