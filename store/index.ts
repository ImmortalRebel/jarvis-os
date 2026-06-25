// store/index.ts
// Barrel export for all Jarvis OS Zustand stores.

export { useAssistantStore } from './useAssistantStore';
export type { AssistantState } from './useAssistantStore';

export { useVoiceStore } from './useVoiceStore';
export type { VoiceStoreState } from './useVoiceStore';

export { useUIStore } from './useUIStore';
export type { UIStoreState, PanelId, UINotification, JarvisTheme } from './useUIStore';

export { useMemoryStore } from './useMemoryStore';
export type { MemoryStoreState, MemoryQuery, MemorySearchResult, MemoryStatus } from './useMemoryStore';

export { useToolStore } from './useToolStore';
export type { ToolStoreState } from './useToolStore';

export { useCommandStore } from './useCommandStore';
export type { CommandStoreState, CommandExecution } from './useCommandStore';

export { useConversationStore } from './useConversationStore';
export type { ConversationStoreState, ConversationStatus, SessionSummary } from './useConversationStore';
