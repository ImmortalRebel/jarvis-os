'use client';
// store/useAssistantStore.ts
// Core Jarvis assistant state — mode, conversation history, AI configuration.
// Single source of truth for the assistant's operational state.
//
// Middleware stack: devtools(persist(...))
// - persist: saves AI/TTS/STT/wakeword config + interaction count across sessions
// - devtools: time-travel debugging in Redux DevTools (dev only)

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  AssistantMode,
  ConversationMessage,
  AIConfig,
  TTSConfig,
  STTConfig,
  WakeWordConfig,
} from '@/types/assistant';

// ─────────────────────────────────────────
// DEFAULT CONFIGURATION VALUES
// ─────────────────────────────────────────

const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'openai',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 1024,
  streamingEnabled: true,
  systemPrompt:
    'You are Jarvis, an advanced AI personal assistant. You are helpful, precise, and concise. ' +
    'You speak in a calm, intelligent tone. You adapt your responses for both voice and text. ' +
    'Keep voice responses brief and conversational. For complex tasks, break them into clear steps.',
};

const DEFAULT_TTS_CONFIG: TTSConfig = {
  provider: 'browser',
  voiceId: 'default',
  speed: 1.0,
  pitch: 1.0,
  volume: 0.9,
};

const DEFAULT_STT_CONFIG: STTConfig = {
  provider: 'browser',
  language: 'en-US',
  silenceThreshold: -40,
  maxDuration: 30_000,
};

const DEFAULT_WAKE_WORD_CONFIG: WakeWordConfig = {
  phrase: 'Hey Jarvis',
  threshold: 0.6,
  engine: 'browser',
  enabled: false,
};

// ─────────────────────────────────────────
// STATE INTERFACE
// ─────────────────────────────────────────

export interface AssistantState {
  // ── Core operational state ──────────────
  mode: AssistantMode;
  isInitialized: boolean;
  error: string | null;

  // ── Conversation ─────────────────────────
  messages: ConversationMessage[];
  currentTranscript: string;
  isStreaming: boolean;

  // ── Configuration (persisted) ─────────────
  aiConfig: AIConfig;
  ttsConfig: TTSConfig;
  sttConfig: STTConfig;
  wakeWordConfig: WakeWordConfig;

  // ── Session metadata ──────────────────────
  sessionId: string;
  interactionCount: number;

  // ── Actions: Core ─────────────────────────
  setMode: (mode: AssistantMode) => void;
  setError: (error: string | null) => void;
  initialize: () => void;

  // ── Actions: Conversation ─────────────────
  addMessage: (message: Omit<ConversationMessage, 'id' | 'timestamp'>) => void;
  updateLastMessage: (updates: Partial<ConversationMessage>) => void;
  clearMessages: () => void;
  setCurrentTranscript: (transcript: string) => void;
  setIsStreaming: (value: boolean) => void;

  // ── Actions: Configuration ────────────────
  updateAIConfig: (config: Partial<AIConfig>) => void;
  updateTTSConfig: (config: Partial<TTSConfig>) => void;
  updateSTTConfig: (config: Partial<STTConfig>) => void;
  updateWakeWordConfig: (config: Partial<WakeWordConfig>) => void;

  // ── Actions: Session ──────────────────────
  resetSession: () => void;
}

// ─────────────────────────────────────────
// ID GENERATION
// ─────────────────────────────────────────

let _msgCounter = 0;
function generateMessageId(): string {
  return `msg_${Date.now()}_${++_msgCounter}`;
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─────────────────────────────────────────
// STORE
// ─────────────────────────────────────────

export const useAssistantStore = create<AssistantState>()(
  devtools(
    persist(
      (set, get) => ({
        // ── Initial state ────────────────────
        mode: 'idle',
        isInitialized: false,
        error: null,
        messages: [],
        currentTranscript: '',
        isStreaming: false,
        aiConfig: DEFAULT_AI_CONFIG,
        ttsConfig: DEFAULT_TTS_CONFIG,
        sttConfig: DEFAULT_STT_CONFIG,
        wakeWordConfig: DEFAULT_WAKE_WORD_CONFIG,
        sessionId: generateSessionId(),
        interactionCount: 0,

        // ── Core actions ─────────────────────

        setMode: (mode) => {
          set({ mode }, false, 'assistant/setMode');
        },

        setError: (error) => {
          set(
            { error, mode: error ? 'error' : get().mode },
            false,
            'assistant/setError',
          );
        },

        initialize: () => {
          set({ isInitialized: true }, false, 'assistant/initialize');
        },

        // ── Conversation actions ──────────────

        addMessage: (messageData) => {
          const message: ConversationMessage = {
            ...messageData,
            id: generateMessageId(),
            timestamp: Date.now(),
          };
          set(
            (state) => ({
              messages: [...state.messages, message],
              interactionCount:
                state.interactionCount + (messageData.role === 'user' ? 1 : 0),
            }),
            false,
            'assistant/addMessage',
          );
        },

        updateLastMessage: (updates) => {
          set(
            (state) => {
              if (state.messages.length === 0) return {};
              const updated = [...state.messages];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                ...updates,
              };
              return { messages: updated };
            },
            false,
            'assistant/updateLastMessage',
          );
        },

        clearMessages: () => {
          set({ messages: [] }, false, 'assistant/clearMessages');
        },

        setCurrentTranscript: (currentTranscript) => {
          set({ currentTranscript }, false, 'assistant/setCurrentTranscript');
        },

        setIsStreaming: (isStreaming) => {
          set({ isStreaming }, false, 'assistant/setIsStreaming');
        },

        // ── Config actions ────────────────────

        updateAIConfig: (config) => {
          set(
            (state) => ({ aiConfig: { ...state.aiConfig, ...config } }),
            false,
            'assistant/updateAIConfig',
          );
        },

        updateTTSConfig: (config) => {
          set(
            (state) => ({ ttsConfig: { ...state.ttsConfig, ...config } }),
            false,
            'assistant/updateTTSConfig',
          );
        },

        updateSTTConfig: (config) => {
          set(
            (state) => ({ sttConfig: { ...state.sttConfig, ...config } }),
            false,
            'assistant/updateSTTConfig',
          );
        },

        updateWakeWordConfig: (config) => {
          set(
            (state) => ({ wakeWordConfig: { ...state.wakeWordConfig, ...config } }),
            false,
            'assistant/updateWakeWordConfig',
          );
        },

        // ── Session actions ───────────────────

        resetSession: () => {
          set(
            {
              messages: [],
              currentTranscript: '',
              isStreaming: false,
              error: null,
              mode: 'idle',
              sessionId: generateSessionId(),
              interactionCount: 0,
            },
            false,
            'assistant/resetSession',
          );
        },
      }),
      {
        name: 'jarvis-assistant-store',
        // Persist ONLY configuration and counters — never transient runtime state
        partialize: (state) => ({
          aiConfig: state.aiConfig,
          ttsConfig: state.ttsConfig,
          sttConfig: state.sttConfig,
          wakeWordConfig: state.wakeWordConfig,
          interactionCount: state.interactionCount,
        }),
      },
    ),
    {
      name: 'JarvisAssistantStore',
      enabled: process.env.NODE_ENV === 'development',
    },
  ),
);
