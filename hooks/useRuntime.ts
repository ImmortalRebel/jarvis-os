'use client';
// hooks/useRuntime.ts
// Primary React hook — bridges the JarvisRuntime singleton and all stores
// into a single clean API for components.
// This is the recommended hook for most components.

import { useCallback } from 'react';
import { useAssistantStore } from '@/store/useAssistantStore';
import { useVoiceStore } from '@/store/useVoiceStore';
import { useUIStore } from '@/store/useUIStore';
import { useToolStore } from '@/store/useToolStore';
import { runtime } from '@/lib/assistant/runtime';
import { pipeline } from '@/lib/pipeline';
import { transitionMode, sleepAssistant, wakeAssistant, resetToIdle } from '@/lib/assistant/modes';
import { openAIClient } from '@/lib/openai/client';
import type { AssistantMode } from '@/types/assistant';

export function useRuntime() {
  // ── Store slices ───────────────────────────────────────────────────────
  const mode               = useAssistantStore((s) => s.mode);
  const isInitialized      = useAssistantStore((s) => s.isInitialized);
  const error              = useAssistantStore((s) => s.error);
  const messages           = useAssistantStore((s) => s.messages);
  const currentTranscript  = useAssistantStore((s) => s.currentTranscript);
  const isStreaming         = useAssistantStore((s) => s.isStreaming);
  const sessionId          = useAssistantStore((s) => s.sessionId);
  const interactionCount   = useAssistantStore((s) => s.interactionCount);
  const aiConfig           = useAssistantStore((s) => s.aiConfig);

  const voiceState           = useVoiceStore((s) => s.voiceState);
  const isMicPermissionGranted = useVoiceStore((s) => s.isMicPermissionGranted);
  const waveformData         = useVoiceStore((s) => s.waveformData);
  const audioAnalysis        = useVoiceStore((s) => s.audioAnalysis);

  const reducedMotion  = useUIStore((s) => s.reducedMotion);
  const soundEffects   = useUIStore((s) => s.soundEffects);
  const notifications  = useUIStore((s) => s.notifications);
  const notify         = useUIStore((s) => s.notify);

  const registeredToolNames = useToolStore((s) => s.registeredToolNames);
  const isToolExecuting     = useToolStore((s) => s.isExecuting);
  const activeToolCalls     = useToolStore((s) => s.activeCalls);

  // ── Derived state ──────────────────────────────────────────────────────
  const isIdle        = mode === 'idle';
  const isSleeping    = mode === 'sleeping';
  const isListening   = mode === 'listening';
  const isProcessing  = mode === 'processing';
  const isThinking    = mode === 'thinking';
  const isSpeaking    = mode === 'speaking';
  const isWaking      = mode === 'wake';
  const hasError      = mode === 'error';
  const isActive      = !isIdle && !isSleeping && !hasError;
  const isPipelineRunning = pipeline.isRunning;
  const isOpenAIConfigured = openAIClient.isConfigured;

  const lastMessage           = messages.at(-1) ?? null;
  const lastUserMessage       = messages.filter((m) => m.role === 'user').at(-1) ?? null;
  const lastAssistantMessage  = messages.filter((m) => m.role === 'assistant').at(-1) ?? null;

  // ── Stable callbacks ───────────────────────────────────────────────────

  const submit = useCallback(
    (text: string, options?: { isVoice?: boolean; speakResponse?: boolean }) =>
      runtime.submit({
        text,
        isVoice: options?.isVoice ?? false,
        speakResponse: options?.speakResponse ?? false,
      }),
    [],
  );

  const submitVoice = useCallback(
    (text: string) => runtime.submit({ text, isVoice: true, speakResponse: true }),
    [],
  );

  const cancelRun = useCallback(() => {
    pipeline.cancel();
    resetToIdle();
  }, []);

  const sleep = useCallback(() => sleepAssistant(), []);

  const wake = useCallback((delayMs = 0) => wakeAssistant(delayMs), []);

  const setMode = useCallback((nextMode: AssistantMode) => {
    transitionMode(nextMode, { force: false });
  }, []);

  const forceMode = useCallback((nextMode: AssistantMode) => {
    transitionMode(nextMode, { force: true });
  }, []);

  const newSession = useCallback(() => runtime.newSession(), []);

  const updateApiKey = useCallback((apiKey: string) => {
    openAIClient.updateConfig({ apiKey });
  }, []);

  const stopSpeaking = useCallback(() => runtime.stopSpeaking(), []);

  return {
    // ── Mode state ─────────────────────────────────────────────────────
    mode,
    voiceState,
    isInitialized,
    isIdle,
    isSleeping,
    isListening,
    isProcessing,
    isThinking,
    isSpeaking,
    isWaking,
    hasError,
    isActive,
    isPipelineRunning,
    isOpenAIConfigured,

    // ── Conversation ────────────────────────────────────────────────────
    messages,
    currentTranscript,
    isStreaming,
    sessionId,
    interactionCount,
    lastMessage,
    lastUserMessage,
    lastAssistantMessage,
    error,
    aiConfig,

    // ── Voice / Audio ───────────────────────────────────────────────────
    isMicPermissionGranted,
    waveformData,
    audioAnalysis,

    // ── UI ──────────────────────────────────────────────────────────────
    reducedMotion,
    soundEffects,
    notifications,
    notify,

    // ── Tools ───────────────────────────────────────────────────────────
    registeredToolNames,
    isToolExecuting,
    activeToolCalls,

    // ── Actions ─────────────────────────────────────────────────────────
    submit,
    submitVoice,
    cancelRun,
    sleep,
    wake,
    setMode,
    forceMode,
    newSession,
    updateApiKey,
    stopSpeaking,
  };
}
