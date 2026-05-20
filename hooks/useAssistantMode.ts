'use client';
// hooks/useAssistantMode.ts
// Lightweight convenience hook for components that only need mode-derived
// state — avoids subscribing to the full assistant store.
//
// Optimised for animation components: returns stable boolean flags and
// framer-motion variant keys so components never have to switch on mode strings.

import { useAssistantStore } from '@/store/useAssistantStore';
import { useUIStore } from '@/store/useUIStore';
import {
  orbIdleVariants,
  orbListeningVariants,
  orbProcessingVariants,
  orbThinkingVariants,
  orbWakeVariants,
  orbSpeakingVariants,
  getSafeVariants,
} from '@/lib/animations';
import type { Variants } from 'framer-motion';
import type { AssistantMode } from '@/types/assistant';

// ─────────────────────────────────────────
// RETURN TYPE
// ─────────────────────────────────────────

interface AssistantModeState {
  // ── Raw mode ──────────────────────────
  mode: AssistantMode;

  // ── Boolean flags (cheap equality checks) ──
  isIdle: boolean;
  isListening: boolean;
  isProcessing: boolean;
  isThinking: boolean;
  isSpeaking: boolean;
  isWaking: boolean;
  hasError: boolean;
  isActive: boolean;    // any non-idle, non-error state

  // ── Animation helpers ─────────────────
  /** framer-motion Variants for the current mode's orb animation */
  orbVariants: Variants;
  /** The animate key to use with the returned orbVariants */
  orbAnimateKey: string;
  /** CSS colour class for the current mode */
  modeColorClass: string;
  /** Human-readable status label */
  statusLabel: string;
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

const MODE_COLORS: Record<AssistantMode, string> = {
  idle:       'text-muted-foreground',
  listening:  'text-cyan-400',
  processing: 'text-blue-400',
  thinking:   'text-purple-400',
  speaking:   'text-emerald-400',
  wake:       'text-yellow-300',
  error:      'text-red-400',
};

const MODE_LABELS: Record<AssistantMode, string> = {
  idle:       'Ready',
  listening:  'Listening…',
  processing: 'Processing…',
  thinking:   'Thinking…',
  speaking:   'Speaking…',
  wake:       'Waking…',
  error:      'Error',
};

function getOrbVariantsForMode(mode: AssistantMode): { variants: Variants; key: string } {
  switch (mode) {
    case 'listening':  return { variants: orbListeningVariants,   key: 'animate' };
    case 'processing': return { variants: orbProcessingVariants,  key: 'animate' };
    case 'thinking':   return { variants: orbThinkingVariants,    key: 'animate' };
    case 'speaking':   return { variants: orbSpeakingVariants,    key: 'animate' };
    case 'wake':       return { variants: orbWakeVariants,        key: 'animate' };
    case 'idle':
    case 'error':
    default:           return { variants: orbIdleVariants,        key: 'animate' };
  }
}

// ─────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────

/**
 * Subscribe to mode-derived state for animation components.
 * Uses granular selectors — only re-renders when mode actually changes.
 *
 * @example
 * const { isListening, orbVariants, orbAnimateKey } = useAssistantMode()
 * <motion.div variants={orbVariants} animate={orbAnimateKey} />
 */
export function useAssistantMode(): AssistantModeState {
  const mode = useAssistantStore((s) => s.mode);
  const reducedMotion = useUIStore((s) => s.reducedMotion);

  const isIdle = mode === 'idle';
  const isListening = mode === 'listening';
  const isProcessing = mode === 'processing';
  const isThinking = mode === 'thinking';
  const isSpeaking = mode === 'speaking';
  const isWaking = mode === 'wake';
  const hasError = mode === 'error';
  const isActive = !isIdle && !hasError;

  const { variants: rawOrbVariants, key: orbAnimateKey } = getOrbVariantsForMode(mode);
  const orbVariants = getSafeVariants(rawOrbVariants, reducedMotion);

  return {
    mode,
    isIdle,
    isListening,
    isProcessing,
    isThinking,
    isSpeaking,
    isWaking,
    hasError,
    isActive,
    orbVariants,
    orbAnimateKey,
    modeColorClass: MODE_COLORS[mode],
    statusLabel: MODE_LABELS[mode],
  };
}
