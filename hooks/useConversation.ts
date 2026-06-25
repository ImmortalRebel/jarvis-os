'use client';
// hooks/useConversation.ts
// Conversation management hook for Jarvis OS.
// Combines AssistantStore messages + ConversationStore session metadata
// into a single clean API for conversation-rendering components.

import { useCallback } from 'react';
import { useAssistantStore } from '@/store/useAssistantStore';
import { useConversationStore } from '@/store/useConversationStore';
import { contextManager } from '@/lib/memory/context';
import { runtime } from '@/lib/assistant/runtime';
import type { ConversationMessage } from '@/types/assistant';

export function useConversation() {
  // ── Messages from AssistantStore ──────────────────────────────────────
  const messages        = useAssistantStore((s) => s.messages);
  const currentTranscript = useAssistantStore((s) => s.currentTranscript);
  const isStreaming     = useAssistantStore((s) => s.isStreaming);
  const clearMessages   = useAssistantStore((s) => s.clearMessages);

  // ── Session metadata from ConversationStore ───────────────────────────
  const sessionId           = useConversationStore((s) => s.currentSessionId);
  const sessionStartedAt    = useConversationStore((s) => s.sessionStartedAt);
  const turnCount           = useConversationStore((s) => s.turnCount);
  const status              = useConversationStore((s) => s.status);
  const contextUsagePercent = useConversationStore((s) => s.contextUsagePercent);
  const isContextNearLimit  = useConversationStore((s) => s.isContextNearLimit);
  const pastSessions        = useConversationStore((s) => s.pastSessions);
  const startNewSession     = useConversationStore((s) => s.startNewSession);
  const archiveCurrentSession = useConversationStore((s) => s.archiveCurrentSession);

  // ── Derived values ────────────────────────────────────────────────────
  const userMessages      = messages.filter((m) => m.role === 'user');
  const assistantMessages = messages.filter((m) => m.role === 'assistant');
  const lastMessage       = messages.at(-1) ?? null;
  const lastUserMessage   = userMessages.at(-1) ?? null;
  const lastAssistantMessage = assistantMessages.at(-1) ?? null;
  const hasMessages       = messages.length > 0;
  const isEmpty           = messages.length === 0;

  // The streaming message (last assistant message still being written)
  const streamingMessage: ConversationMessage | null =
    isStreaming && lastMessage?.role === 'assistant' ? lastMessage : null;

  // ── Actions ───────────────────────────────────────────────────────────

  const newSession = useCallback(() => {
    // Archive current session before clearing
    const preview = userMessages[0]?.content ?? '';
    if (hasMessages) {
      archiveCurrentSession(preview);
    }
    runtime.newSession();
    startNewSession();
  }, [hasMessages, userMessages, archiveCurrentSession, startNewSession]);

  const clearConversation = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  const getContextUsage = useCallback((): number => {
    return contextManager.getContextUsagePercent();
  }, []);

  const getModelLimit = useCallback((): number => {
    return contextManager.getModelLimit();
  }, []);

  return {
    // ── Messages ──────────────────────────────────────────────────────
    messages,
    userMessages,
    assistantMessages,
    lastMessage,
    lastUserMessage,
    lastAssistantMessage,
    streamingMessage,
    currentTranscript,
    hasMessages,
    isEmpty,
    isStreaming,

    // ── Session ───────────────────────────────────────────────────────
    sessionId,
    sessionStartedAt,
    turnCount,
    status,
    pastSessions,

    // ── Context health ─────────────────────────────────────────────────
    contextUsagePercent,
    isContextNearLimit,

    // ── Actions ───────────────────────────────────────────────────────
    newSession,
    clearConversation,
    getContextUsage,
    getModelLimit,
  };
}
