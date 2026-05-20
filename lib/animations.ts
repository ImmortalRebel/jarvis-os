// lib/animations.ts
// Centralized animation variant library for Jarvis OS.
// All framer-motion v12 Variants are defined here.
// Components import from this file instead of defining motion props inline.
// This ensures visual consistency and makes global animation tuning trivial.
//
// CRITICAL: This file has NO side effects. Safe to import in any component.
// It does NOT import from framer-motion at runtime for types (import type only).

import type { Variants, Transition } from 'framer-motion';

// ─────────────────────────────────────────
// SHARED TRANSITIONS
// ─────────────────────────────────────────

export const transitions = {
  /** Snappy spring — quick UI micro-interactions */
  spring: {
    type: 'spring',
    stiffness: 400,
    damping: 30,
  } as Transition,

  /** Smooth spring — panels, drawers, overlays */
  smoothSpring: {
    type: 'spring',
    stiffness: 200,
    damping: 25,
  } as Transition,

  /** Eased tween — opacity, color, subtle transforms */
  ease: {
    type: 'tween',
    duration: 0.2,
    ease: [0.4, 0, 0.2, 1], // Material Design standard easing
  } as Transition,

  /** Slow ease — dramatic reveals, hero animations */
  slowEase: {
    type: 'tween',
    duration: 0.5,
    ease: [0.4, 0, 0.2, 1],
  } as Transition,

  /** Near-instant — state indicators, toggles */
  instant: {
    type: 'tween',
    duration: 0.08,
  } as Transition,

  /** Dramatic entrance — fullscreen transitions */
  dramatic: {
    type: 'spring',
    stiffness: 120,
    damping: 20,
    mass: 1.2,
  } as Transition,
} as const;

// ─────────────────────────────────────────
// CORE UI VARIANTS
// ─────────────────────────────────────────

/** Standard fade — modals, tooltips, overlays */
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.ease },
  exit: { opacity: 0, transition: transitions.instant },
};

/** Slide up from bottom — panels, bottom sheets */
export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: transitions.smoothSpring,
  },
  exit: {
    opacity: 0,
    y: 16,
    scale: 0.97,
    transition: transitions.ease,
  },
};

/** Slide down from top — dropdown menus, banners */
export const slideDownVariants: Variants = {
  hidden: { opacity: 0, y: -16 },
  visible: { opacity: 1, y: 0, transition: transitions.smoothSpring },
  exit: { opacity: 0, y: -10, transition: transitions.ease },
};

/** Slide in from left — sidebars, navigation drawers */
export const slideInLeftVariants: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0, transition: transitions.smoothSpring },
  exit: { opacity: 0, x: -20, transition: transitions.ease },
};

/** Slide in from right — panels, detail views */
export const slideInRightVariants: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: transitions.smoothSpring },
  exit: { opacity: 0, x: 20, transition: transitions.ease },
};

/** Scale from center — cards, pop-over elements */
export const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: transitions.spring },
  exit: { opacity: 0, scale: 0.95, transition: transitions.ease },
};

/** Scale from bottom-right — FABs, action buttons */
export const popVariants: Variants = {
  hidden: { opacity: 0, scale: 0.7, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: transitions.spring },
  exit: { opacity: 0, scale: 0.85, transition: transitions.instant },
};

// ─────────────────────────────────────────
// JARVIS ORB / PRESENCE ANIMATIONS
// ─────────────────────────────────────────

/** Idle breathing — subtle, continuous pulse */
export const orbIdleVariants: Variants = {
  animate: {
    scale: [1, 1.04, 1],
    opacity: [0.75, 1, 0.75],
    transition: {
      duration: 3.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/** Listening — faster, tighter pulse to signal active capture */
export const orbListeningVariants: Variants = {
  animate: {
    scale: [1, 1.1, 1],
    opacity: [0.85, 1, 0.85],
    transition: {
      duration: 1.0,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/** Processing — smooth rotation indicating computation */
export const orbProcessingVariants: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

/** Thinking — slow wobble to indicate extended deliberation */
export const orbThinkingVariants: Variants = {
  animate: {
    scale: [1, 1.06, 0.97, 1.03, 1],
    transition: {
      duration: 2.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/** Wake — surge effect when wake word is detected */
export const orbWakeVariants: Variants = {
  initial: { scale: 1, opacity: 0.75 },
  animate: {
    scale: [1, 1.4, 1.15],
    opacity: [0.75, 1, 0.95],
    transition: {
      duration: 0.45,
      ease: [0.25, 0.46, 0.45, 0.94], // easeOutQuart
    },
  },
};

/** Speaking — rhythmic wave to indicate vocal output */
export const orbSpeakingVariants: Variants = {
  animate: {
    scaleX: [1, 1.05, 0.97, 1.03, 1],
    scaleY: [1, 0.97, 1.05, 0.98, 1],
    transition: {
      duration: 0.8,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// ─────────────────────────────────────────
// VOICE VISUALIZER VARIANTS
// ─────────────────────────────────────────

/** Single waveform bar — custom prop is the target scaleY value */
export const waveBarVariants: Variants = {
  inactive: { scaleY: 0.08, opacity: 0.25 },
  active: (targetScale: number) => ({
    scaleY: Math.max(0.08, targetScale),
    opacity: 0.6 + Math.min(0.4, targetScale * 0.4),
    transition: { duration: 0.06, ease: 'easeOut' },
  }),
};

// ─────────────────────────────────────────
// NOTIFICATION / TOAST VARIANTS
// ─────────────────────────────────────────

export const notificationVariants: Variants = {
  hidden: { opacity: 0, x: 40, scale: 0.95 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    x: 40,
    scale: 0.95,
    transition: transitions.ease,
  },
};

// ─────────────────────────────────────────
// LIST / STAGGER VARIANTS
// ─────────────────────────────────────────

/** Container — staggers children animation */
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.08,
    },
  },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/** Individual stagger child */
export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.spring,
  },
  exit: { opacity: 0, y: 5, transition: transitions.instant },
};

// ─────────────────────────────────────────
// PAGE TRANSITION VARIANTS
// ─────────────────────────────────────────

export const pageTransitionVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { ...transitions.smoothSpring, delay: 0.05 },
  },
  exit: { opacity: 0, y: -4, transition: transitions.ease },
};

// ─────────────────────────────────────────
// UTILITY: Reduced-motion safe wrapper
// ─────────────────────────────────────────

/**
 * Strips positional transforms from variants when the user has
 * `prefers-reduced-motion: reduce` enabled.
 * Returns only opacity-based transitions — animation is preserved
 * but motion is eliminated.
 *
 * @example
 * const safeVariants = getSafeVariants(slideUpVariants, reducedMotion);
 * <motion.div variants={safeVariants} initial="hidden" animate="visible" />
 */
export function getSafeVariants(variants: Variants, reducedMotion: boolean): Variants {
  if (!reducedMotion) return variants;

  const safe: Variants = {};
  for (const [key, val] of Object.entries(variants)) {
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      // Remove all transform properties, keep opacity + transition
      const {
        x: _x,
        y: _y,
        scale: _scale,
        rotate: _rotate,
        scaleX: _scaleX,
        scaleY: _scaleY,
        ...rest
      } = val as Record<string, unknown>;
      safe[key] = { ...rest, transition: { type: 'tween', duration: 0.12 } };
    } else {
      safe[key] = val;
    }
  }
  return safe;
}

/**
 * Returns the correct orb animation variant key for the current assistant mode.
 * Use with the appropriate orbVariants object.
 */
export function getOrbAnimationKey(
  mode: 'idle' | 'listening' | 'processing' | 'speaking' | 'thinking' | 'wake' | 'error',
): string {
  if (mode === 'idle' || mode === 'error') return 'animate';
  return 'animate';
}
