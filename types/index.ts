// types/index.ts
// Single barrel export for all Jarvis OS type definitions.
// Usage: import type { AssistantMode, ConversationMessage } from '@/types'

// NOTE: speech-recognition.d.ts is a pure ambient declaration file (no exports).
// It is loaded automatically by TypeScript — no import needed here.
// The triple-slash reference below ensures it is always included.
/// <reference path="./speech-recognition.d.ts" />

export * from './assistant';
export * from './voice';
export * from './ipc';
export * from './tools';
