// store/index.ts
// Barrel export for all Jarvis OS Zustand stores.
// Usage: import { useAssistantStore, useVoiceStore } from '@/store'

export { useAssistantStore } from './useAssistantStore';
export type { AssistantState } from './useAssistantStore';

export { useVoiceStore } from './useVoiceStore';
export type { VoiceStoreState } from './useVoiceStore';

export { useUIStore } from './useUIStore';
export type { UIStoreState, PanelId, UINotification, JarvisTheme } from './useUIStore';

export { useMemoryStore } from './useMemoryStore';
export type { MemoryStoreState, MemoryQuery, MemorySearchResult, MemoryStatus } from './useMemoryStore';
