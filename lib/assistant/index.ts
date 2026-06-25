// lib/assistant/index.ts
export { runtime } from './runtime';
export type { RuntimeOptions, SubmitOptions } from './runtime';
export {
  transitionMode,
  forceMode,
  sleepAssistant,
  wakeAssistant,
  resetToIdle,
  isValidTransition,
  getValidNextModes,
} from './modes';
export type { TransitionResult } from './modes';
export { behaviorEngine } from './behavior';
export type { BehaviorConfig } from './behavior';
