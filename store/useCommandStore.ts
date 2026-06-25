'use client';
// store/useCommandStore.ts
// Command execution state for Jarvis OS.
// Tracks which commands are running, their results, and command history.

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { CommandCategory } from '@/lib/commands/registry';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export interface CommandExecution {
  id: string;
  commandId: string;
  input: string;
  category: CommandCategory;
  startedAt: number;
  completedAt?: number;
  response?: string;
  success: boolean;
  error?: string;
}

export interface CommandStoreState {
  // Active execution
  isExecuting: boolean;
  activeCommandId: string | null;

  // History (current session)
  history: CommandExecution[];

  // Registered command count (mirror from registry for UI)
  registeredCount: number;

  // Actions
  startExecution: (commandId: string, input: string, category: CommandCategory) => string;
  completeExecution: (id: string, response: string, success: boolean, error?: string) => void;
  clearHistory: () => void;
  setRegisteredCount: (count: number) => void;
}

// ─────────────────────────────────────────
// ID GENERATION
// ─────────────────────────────────────────

let _cmdCounter = 0;
function generateId(): string {
  return `cmd_${Date.now()}_${++_cmdCounter}`;
}

// ─────────────────────────────────────────
// STORE
// ─────────────────────────────────────────

export const useCommandStore = create<CommandStoreState>()(
  devtools(
    (set) => ({
      isExecuting: false,
      activeCommandId: null,
      history: [],
      registeredCount: 0,

      startExecution: (commandId, input, category) => {
        const id = generateId();
        set(
          (s) => ({
            isExecuting: true,
            activeCommandId: commandId,
            history: [
              { id, commandId, input, category, startedAt: Date.now(), success: false },
              ...s.history,
            ].slice(0, 100), // keep last 100
          }),
          false,
          'commands/startExecution',
        );
        return id;
      },

      completeExecution: (id, response, success, error) => {
        set(
          (s) => ({
            isExecuting: false,
            activeCommandId: null,
            history: s.history.map((h) =>
              h.id === id
                ? { ...h, completedAt: Date.now(), response, success, error }
                : h,
            ),
          }),
          false,
          'commands/completeExecution',
        );
      },

      clearHistory: () => set({ history: [] }, false, 'commands/clearHistory'),

      setRegisteredCount: (registeredCount) =>
        set({ registeredCount }, false, 'commands/setRegisteredCount'),
    }),
    { name: 'JarvisCommandStore', enabled: process.env.NODE_ENV === 'development' },
  ),
);
