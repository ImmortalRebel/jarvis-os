// lib/pipeline/index.ts
// Jarvis AI pipeline orchestrator.
// Coordinates the full STT → LLM → Tool Use → TTS flow.
//
// Architecture:
// - This is a standalone module (not a React hook) so it can be called from
//   anywhere: hooks, event listeners, Electron IPC handlers.
// - It reads config from Zustand stores but does NOT import React.
// - All state mutations go through the stores.
// - Each stage fires store updates so the UI reflects real-time progress.
//
// Usage (from a hook or event handler):
//   const run = await pipeline.run({ text: 'What time is it?', isVoice: false })

import { useAssistantStore } from '@/store/useAssistantStore';
import { useVoiceStore } from '@/store/useVoiceStore';
import { useMemoryStore } from '@/store/useMemoryStore';
import type { PipelineRun, PipelineStage } from './types';
import type { ConversationMessage } from '@/types/assistant';

// ─────────────────────────────────────────
// INTERNAL UTILITIES
// ─────────────────────────────────────────

let _runCounter = 0;
function generateRunId(): string {
  return `run_${Date.now()}_${++_runCounter}`;
}

function getAssistantStore() {
  return useAssistantStore.getState();
}

function getVoiceStore() {
  return useVoiceStore.getState();
}

function getMemoryStore() {
  return useMemoryStore.getState();
}

// ─────────────────────────────────────────
// PIPELINE RUNNER
// ─────────────────────────────────────────

export interface RunPipelineOptions {
  text: string;
  isVoice?: boolean;
  /** Optional AbortSignal to cancel the run */
  signal?: AbortSignal;
}

export interface PipelineResult {
  run: PipelineRun;
  success: boolean;
  response?: string;
  error?: string;
}

class JarvisPipeline {
  private activeAbortController: AbortController | null = null;

  /**
   * Run the full pipeline for a user input.
   * Manages store state transitions automatically.
   */
  async run(options: RunPipelineOptions): Promise<PipelineResult> {
    const { text, isVoice = false, signal: externalSignal } = options;

    // Cancel any in-flight run
    this.cancel();
    const controller = new AbortController();
    this.activeAbortController = controller;

    // Merge signals if an external one was provided
    if (externalSignal) {
      externalSignal.addEventListener('abort', () => controller.abort());
    }

    const runId = generateRunId();
    const run: PipelineRun = {
      id: runId,
      startedAt: Date.now(),
      stage: 'idle',
      userInput: text,
      isVoiceInput: isVoice,
      messages: [],
      toolCalls: [],
      toolResults: [],
    };

    const assistantStore = getAssistantStore();

    // Add user message to conversation
    assistantStore.addMessage({
      role: 'user',
      content: text,
      isVoice,
    });

    try {
      // ── Stage: LLM ──────────────────────────
      run.stage = 'llm';
      assistantStore.setMode('processing');

      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');

      const memoryStore = getMemoryStore();
      const memoryContext = memoryStore.buildContextString();

      // Build messages array for the LLM
      const { aiConfig, messages } = getAssistantStore();

      const systemMessage: ConversationMessage = {
        id: 'system-0',
        role: 'system',
        content: aiConfig.systemPrompt + (memoryContext ? `\n\n${memoryContext}` : ''),
        timestamp: Date.now(),
      };

      run.messages = [systemMessage, ...messages];

      // ── Placeholder for real LLM call ───────
      // When you integrate an LLM provider, replace this block:
      //
      //   const adapter = getLLMAdapter(aiConfig.provider)
      //   const result = await adapter.complete({
      //     messages: run.messages,
      //     config: aiConfig,
      //     onToken: (delta) => {
      //       assistantStore.setCurrentTranscript(transcript + delta)
      //     },
      //     signal: controller.signal,
      //   })
      //
      // For now, we stage a stub response so the pipeline flow is testable:

      const stubResponse = `[Jarvis pipeline staged — LLM provider not yet configured. Input was: "${text}"]`;

      run.assistantResponse = stubResponse;
      run.stage = 'complete';

      // Add assistant response to conversation
      assistantStore.addMessage({
        role: 'assistant',
        content: stubResponse,
        isVoice,
      });

      // ── Stage: TTS (optional) ──────────────
      const voiceStore = getVoiceStore();
      if (isVoice) {
        run.stage = 'tts';
        assistantStore.setMode('speaking');
        voiceStore.enqueueTTS(stubResponse, 'normal');
      }

      run.stage = 'complete';
      run.completedAt = Date.now();
      assistantStore.setMode('idle');
      assistantStore.setCurrentTranscript('');

      return { run, success: true, response: stubResponse };

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const isAbort = err instanceof DOMException && err.name === 'AbortError';

      run.stage = 'error';
      run.error = message;

      if (!isAbort) {
        assistantStore.setError(message);
        assistantStore.setMode('error');
      } else {
        assistantStore.setMode('idle');
      }

      return { run, success: false, error: message };

    } finally {
      this.activeAbortController = null;
    }
  }

  /**
   * Cancel the currently running pipeline, if any.
   */
  cancel(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
  }

  /**
   * Whether a pipeline run is currently in progress.
   */
  get isRunning(): boolean {
    return this.activeAbortController !== null;
  }
}

/**
 * Singleton pipeline instance.
 * Import and use this directly — no React required.
 *
 * @example
 * import { pipeline } from '@/lib/pipeline'
 * const result = await pipeline.run({ text: 'Hello Jarvis', isVoice: true })
 */
export const pipeline = new JarvisPipeline();

export type { PipelineRun, PipelineStage };