'use client';
// store/useConversationStore.ts
// Conversation session management state for Jarvis OS.
// Handles session lifecycle, turn tracking, and context window health.

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export type ConversationStatus = 'active' | 'idle' | 'error' | 'archived';

export interface SessionSummary {
  id: string;
  title: string;
  startedAt: number;
  endedAt: number;
  turnCount: number;
  preview: string; // first user message truncated
}

export interface ConversationStoreState {
  // Current session
  currentSessionId: string;
  sessionStartedAt: number;
  turnCount: number;
  status: ConversationStatus;

  // Context health
  contextUsagePercent: number;   // 0–100
  isContextNearLimit: boolean;   // true when > 80%

  // Session history (persisted)
  pastSessions: SessionSummary[];

  // Actions
  startNewSession: () => void;
  recordTurn: () => void;
  setStatus: (status: ConversationStatus) => void;
  updateContextUsage: (percent: number) => void;
  archiveCurrentSession: (preview: string) => void;
  clearHistory: () => void;
}

// ─────────────────────────────────────────
// STORE
// ─────────────────────────────────────────

function newSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export const useConversationStore = create<ConversationStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        currentSessionId: newSessionId(),
        sessionStartedAt: Date.now(),
        turnCount: 0,
        status: 'idle',
        contextUsagePercent: 0,
        isContextNearLimit: false,
        pastSessions: [],

        startNewSession: () => {
          set(
            {
              currentSessionId: newSessionId(),
              sessionStartedAt: Date.now(),
              turnCount: 0,
              status: 'idle',
              contextUsagePercent: 0,
              isContextNearLimit: false,
            },
            false,
            'conversation/startNewSession',
          );
        },

        recordTurn: () => {
          set(
            (s) => ({ turnCount: s.turnCount + 1, status: 'active' }),
            false,
            'conversation/recordTurn',
          );
        },

        setStatus: (status) => {
          set({ status }, false, 'conversation/setStatus');
        },

        updateContextUsage: (percent) => {
          set(
            { contextUsagePercent: percent, isContextNearLimit: percent >= 80 },
            false,
            'conversation/updateContextUsage',
          );
        },

        archiveCurrentSession: (preview) => {
          const { currentSessionId, sessionStartedAt, turnCount, pastSessions } = get();
          if (turnCount === 0) return; // don't archive empty sessions

          const summary: SessionSummary = {
            id: currentSessionId,
            title: preview.substring(0, 40) || 'Untitled session',
            startedAt: sessionStartedAt,
            endedAt: Date.now(),
            turnCount,
            preview: preview.substring(0, 100),
          };

          set(
            {
              pastSessions: [summary, ...pastSessions].slice(0, 50),
              currentSessionId: newSessionId(),
              sessionStartedAt: Date.now(),
              turnCount: 0,
              status: 'idle',
              contextUsagePercent: 0,
              isContextNearLimit: false,
            },
            false,
            'conversation/archiveCurrentSession',
          );
        },

        clearHistory: () => {
          set({ pastSessions: [] }, false, 'conversation/clearHistory');
        },
      }),
      {
        name: 'jarvis-conversation-store',
        partialize: (s) => ({
          pastSessions: s.pastSessions,
        }),
      },
    ),
    { name: 'JarvisConversationStore', enabled: process.env.NODE_ENV === 'development' },
  ),
);
