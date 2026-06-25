'use client';
// store/useToolStore.ts
// UI state for the tool system — tracks active tool calls and their results.
// The actual tool registry (lib/tools/registry.ts) is a non-React singleton.
// This store bridges tool execution state into the React/UI layer.

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ToolCall, ToolResult, ToolDefinition } from '@/types/tools';

// ─────────────────────────────────────────
// STATE INTERFACE
// ─────────────────────────────────────────

export interface ToolStoreState {
  // Active tool calls (in-flight during pipeline run)
  activeCalls: ToolCall[];
  // Results from completed tool calls (current run)
  results: ToolResult[];
  // Names of all registered tools (mirror from registry for UI display)
  registeredToolNames: string[];
  // Whether the tool execution panel is visible
  isExecuting: boolean;
  // Total tools executed this session
  totalExecuted: number;

  // Actions
  addActiveCall: (call: ToolCall) => void;
  resolveCall: (result: ToolResult) => void;
  clearRun: () => void;
  setRegisteredTools: (names: string[]) => void;
  setIsExecuting: (value: boolean) => void;
}

// ─────────────────────────────────────────
// STORE
// ─────────────────────────────────────────

export const useToolStore = create<ToolStoreState>()(
  devtools(
    (set) => ({
      activeCalls: [],
      results: [],
      registeredToolNames: [],
      isExecuting: false,
      totalExecuted: 0,

      addActiveCall: (call) => {
        set(
          (state) => ({ activeCalls: [...state.activeCalls, call], isExecuting: true }),
          false,
          'tools/addActiveCall',
        );
      },

      resolveCall: (result) => {
        set(
          (state) => ({
            activeCalls: state.activeCalls.filter((c) => c.id !== result.toolCallId),
            results: [...state.results, result],
            totalExecuted: state.totalExecuted + 1,
            isExecuting: state.activeCalls.length > 1,
          }),
          false,
          'tools/resolveCall',
        );
      },

      clearRun: () => {
        set(
          { activeCalls: [], results: [], isExecuting: false },
          false,
          'tools/clearRun',
        );
      },

      setRegisteredTools: (registeredToolNames) => {
        set({ registeredToolNames }, false, 'tools/setRegisteredTools');
      },

      setIsExecuting: (isExecuting) => {
        set({ isExecuting }, false, 'tools/setIsExecuting');
      },
    }),
    {
      name: 'JarvisToolStore',
      enabled: process.env.NODE_ENV === 'development',
    },
  ),
);
