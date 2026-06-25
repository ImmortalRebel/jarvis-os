// hooks/index.ts
// Barrel export for all Jarvis OS custom hooks.
// All hooks are 'use client' — never import into Server Components.

// ── Primary runtime interface ──────────────────────────────────
export { useRuntime } from './useRuntime';

// ── Assistant state ────────────────────────────────────────────
export { useAssistant } from './useAssistant';
export { useAssistantMode } from './useAssistantMode';

// ── Conversation ───────────────────────────────────────────────
export { useConversation } from './useConversation';

// ── Voice pipeline (Goal 4) ────────────────────────────────────
export { useVoiceState } from './useVoiceState';
export { useMicrophone } from './useMicrophone';
export { useTTS } from './useTTS';
export { useVoiceInput } from './useVoiceInput';
export { useWakeWord } from './useWakeWord';

// ── Performance selectors (Goal 7) ────────────────────────────
export {
  useOptimizedSelector,
  useAssistantSelector,
  useVoiceSelector,
  useUISelector,
  useModeFlags,
  useConversationMeta,
  useAudioAnalysis,
  useTTSState,
  useUIPreferences,
} from './useOptimizedSelector';

// ── Electron IPC ───────────────────────────────────────────────
export { useIPCChannel, useIPCChannelOnce, useIPCSend, useIsElectron } from './useIPCBridge';
