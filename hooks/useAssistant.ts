'use client';
// hooks/useAssistant.ts
// High-level hook that composes the three core stores into a clean, semantic API.
// Components should use this hook rather than calling stores directly.
// This provides a stable abstraction boundary for testing and future refactors.

import { useCallback } from 'react';
import { useAssistantStore } from '@/store/useAssistantStore';
import { useVoiceStore } from '@/store/useVoiceStore';
import { useUIStore } from '@/store/useUIStore';
import { pipeline } from '@/lib/pipeline';
import type { AssistantMode } from '@/types/assistant';

export function useAssistant() {
  // ── Store slices ───────────────────────────────────────
  const mode = useAssistantStore((s) => s.mode);
  const isInitialized = useAssistantStore((s) => s.isInitialized);
  const error = useAssistantStore((s) => s.error);
  const messages = useAssistantStore((s) => s.messages);
  const currentTranscript = useAssistantStore((s) => s.currentTranscript);
  const isStreaming = useAssistantStore((s) => s.isStreaming);
  const sessionId = useAssistantStore((s) => s.sessionId);
  const interactionCount = useAssistantStore((s) => s.interactionCount);

  const setMode = useAssistantStore((s) => s.setMode);
  const setError = useAssistantStore((s) => s.setError);
  const addMessage = useAssistantStore((s) => s.addMessage);
  const clearMessages = useAssistantStore((s) => s.clearMessages);
  const setCurrentTranscript = useAssistantStore((s) => s.setCurrentTranscript);
  const resetSession = useAssistantStore((s) => s.resetSession);

  const voiceState = useVoiceStore((s) => s.voiceState);
  const setVoiceState = useVoiceStore((s) => s.setVoiceState);

  const notify = useUIStore((s) => s.notify);

  // ── Derived state ──────────────────────────────────────
  const isActive = mode !== 'idle' && mode !== 'error';
  const isListening = mode === 'listening';
  const isProcessing = mode === 'processing' || mode === 'thinking';
  const isSpeaking = mode === 'speaking';
  const isWaking = mode === 'wake';
  const hasError = mode === 'error';

  const lastMessage = messages.at(-1) ?? null;
  const lastUserMessage = messages.filter((m) => m.role === 'user').at(-1) ?? null;
  const lastAssistantMessage = messages.filter((m) => m.role === 'assistant').at(-1) ?? null;

  // ── Actions ────────────────────────────────────────────

  /**
   * Transition to a new assistant mode, keeping voice state in sync.
   */
  const transitionMode = useCallback(
    (nextMode: AssistantMode) => {
      setMode(nextMode);

      // Keep VoiceStore in sync with AssistantStore mode changes
      if (nextMode === 'listening') {
        setVoiceState('recording');
      } else if (nextMode === 'speaking') {
        setVoiceState('playing');
      } else if (nextMode === 'idle' || nextMode === 'error') {
        setVoiceState('inactive');
      }
    },
    [setMode, setVoiceState],
  );

  /**
   * Centralised error handler — updates mode, voice state, and shows notification.
   */
  const handleError = useCallback(
    (message: string) => {
      setError(message);
      setVoiceState('inactive');
      notify({
        type: 'error',
        title: 'Jarvis Error',
        message,
        duration: 6000,
      });
    },
    [setError, setVoiceState, notify],
  );

  /**
   * Submit a text query through the full AI pipeline.
   */
  const submitQuery = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      await pipeline.run({ text: text.trim(), isVoice: false });
    },
    [],
  );

  /**
   * Submit a voice-captured transcript through the full AI pipeline.
   */
  const submitVoiceQuery = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      await pipeline.run({ text: text.trim(), isVoice: true });
    },
    [],
  );

  /**
   * Cancel the currently running pipeline and return to idle.
   */
  const cancel = useCallback(() => {
    pipeline.cancel();
    transitionMode('idle');
  }, [transitionMode]);

  /**
   * Manually add a message to the conversation (for system messages, tool results, etc.)
   */
  const addSystemMessage = useCallback(
    (content: string) => {
      addMessage({ role: 'system', content, isVoice: false });
    },
    [addMessage],
  );

  return {
    // ── State ──────────────────────────────
    mode,
    voiceState,
    isInitialized,
    isActive,
    isListening,
    isProcessing,
    isSpeaking,
    isWaking,
    hasError,
    error,
    messages,
    currentTranscript,
    isStreaming,
    sessionId,
    interactionCount,
    lastMessage,
    lastUserMessage,
    lastAssistantMessage,

    // ── Actions ────────────────────────────
    transitionMode,
    handleError,
    submitQuery,
    submitVoiceQuery,
    cancel,
    addSystemMessage,
    setCurrentTranscript,
    clearMessages,
    resetSession,
  };
}
