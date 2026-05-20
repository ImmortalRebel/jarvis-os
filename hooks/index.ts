// store/index.ts
// Barrel export for all Jarvis OS Zustand stores.
// Usage: import { useAssistantStore, useVoiceStore } from '@/store'

// Correct relative path to the store implementations (these live in ../store)
export { useAssistantStore } from '../store/useAssistantStore';
export type { AssistantState } from '../store/useAssistantStore';

export { useVoiceStore } from '../store/useVoiceStore';
export type { VoiceStoreState } from '../store/useVoiceStore';

export { useUIStore } from '../store/useUIStore';
export type { UIStoreState, PanelId, UINotification, JarvisTheme } from '../store/useUIStore';

export { useMemoryStore } from '../store/useMemoryStore';
export type { MemoryStoreState, MemoryQuery, MemorySearchResult, MemoryStatus } from '../store/useMemoryStore';
