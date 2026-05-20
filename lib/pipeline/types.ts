// lib/pipeline/types.ts
// AI pipeline stage types and contracts.
// The pipeline is: STT → (optional tool use loop) → LLM → TTS
// Each stage is independent and can be swapped via configuration.

import type { AIConfig, ConversationMessage } from '@/types/assistant';
import type { ToolCall, ToolResult } from '@/types/tools';

// ─────────────────────────────────────────
// PIPELINE STAGES
// ─────────────────────────────────────────

export type PipelineStage =
  | 'idle'
  | 'stt'         // Speech-to-text transcription
  | 'llm'         // Language model inference
  | 'tool_call'   // Executing a tool requested by the LLM
  | 'tts'         // Text-to-speech synthesis
  | 'complete'    // Pipeline finished successfully
  | 'error';      // Pipeline halted due to error

// ─────────────────────────────────────────
// PIPELINE RUN
// ─────────────────────────────────────────

export interface PipelineRun {
  id: string;
  startedAt: number;
  completedAt?: number;
  stage: PipelineStage;

  // Input
  userInput: string;
  isVoiceInput: boolean;

  // STT output
  transcript?: string;
  transcriptConfidence?: number;

  // LLM interaction
  messages: ConversationMessage[];
  toolCalls: ToolCall[];
  toolResults: ToolResult[];

  // LLM output
  assistantResponse?: string;
  promptTokens?: number;
  completionTokens?: number;

  // TTS output
  audioUrl?: string;
  audioDuration?: number;

  // Error
  error?: string;
  errorStage?: PipelineStage;
}

// ─────────────────────────────────────────
// PIPELINE EVENT
// ─────────────────────────────────────────

export type PipelineEventType =
  | 'stage_change'
  | 'token_delta'
  | 'tool_call_start'
  | 'tool_call_complete'
  | 'tts_ready'
  | 'complete'
  | 'error';

export interface PipelineEvent {
  type: PipelineEventType;
  runId: string;
  stage: PipelineStage;
  payload?: unknown;
}

// ─────────────────────────────────────────
// PIPELINE CONFIG
// ─────────────────────────────────────────

export interface PipelineConfig {
  ai: AIConfig;
  /** Whether to run TTS after every assistant response */
  autoTTS: boolean;
  /** Whether to inject memory context into the system prompt */
  injectMemory: boolean;
  /** Max tool call iterations before forcing a final answer */
  maxToolIterations: number;
}

// ─────────────────────────────────────────
// LLM PROVIDER ADAPTER INTERFACE
// Implement this to add new AI providers.
// ─────────────────────────────────────────

export interface LLMAdapter {
  readonly name: string;
  readonly supportsStreaming: boolean;
  readonly supportsToolCalling: boolean;

  /**
   * Run a single completion with the provided messages.
   * If streaming is enabled, the adapter should call `onToken` for each chunk.
   */
  complete: (params: {
    messages: ConversationMessage[];
    config: AIConfig;
    onToken?: (delta: string) => void;
    signal?: AbortSignal;
  }) => Promise<{
    content: string;
    toolCalls?: ToolCall[];
    promptTokens?: number;
    completionTokens?: number;
  }>;
}
