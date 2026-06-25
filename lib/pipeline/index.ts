// lib/pipeline/index.ts
// Jarvis AI pipeline orchestrator — Phase 3 complete.
// Full flow: Context assembly → LLM (OpenAI / stub) → Tool Use Loop → Memory extraction
//
// Automatically uses OpenAI when NEXT_PUBLIC_OPENAI_API_KEY is configured.
// Falls back to a descriptive stub response when no key is present.
// Uses contextManager for token-aware message pruning.
// Uses memoryExtractor for post-turn memory capture.

import { useAssistantStore } from '@/store/useAssistantStore';
import { useVoiceStore } from '@/store/useVoiceStore';
import { useMemoryStore } from '@/store/useMemoryStore';
import { memoryService } from '@/lib/memory/service';
import { contextManager } from '@/lib/memory/context';
import { memoryExtractor } from '@/lib/memory/extractor';
import { openAIAdapter } from '@/lib/openai/adapter';
import { openAIClient } from '@/lib/openai/client';
import type { PipelineRun, PipelineStage } from './types';
import type { ConversationMessage } from '@/types/assistant';

// ─────────────────────────────────────────
// ID GENERATION
// ─────────────────────────────────────────

let _runCounter = 0;
function generateRunId(): string {
  return `run_${Date.now()}_${++_runCounter}`;
}

// ─────────────────────────────────────────
// STORE ACCESSORS (no React — .getState())
// ─────────────────────────────────────────

const getAssistant = () => useAssistantStore.getState();
const getVoice = () => useVoiceStore.getState();

// ─────────────────────────────────────────
// PIPELINE OPTIONS & RESULT
// ─────────────────────────────────────────

export interface RunPipelineOptions {
  text: string;
  isVoice?: boolean;
  signal?: AbortSignal;
}

export interface PipelineResult {
  run: PipelineRun;
  success: boolean;
  response?: string;
  error?: string;
}

// ─────────────────────────────────────────
// PIPELINE CLASS
// ─────────────────────────────────────────

class JarvisPipeline {
  private activeAbortController: AbortController | null = null;

  async run(options: RunPipelineOptions): Promise<PipelineResult> {
    const { text, isVoice = false, signal: externalSignal } = options;

    // Cancel any in-flight run
    this.cancel();
    const controller = new AbortController();
    this.activeAbortController = controller;
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

    const assistant = getAssistant();

    // Add user message
    assistant.addMessage({ role: 'user', content: text, isVoice });

    try {
      // ── Stage: LLM ────────────────────────────────────────────────────────
      run.stage = 'llm';
      assistant.setMode('processing');

      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');

      // Use contextManager for token-aware message assembly with memory injection
      const { messages: assembledMessages, totalTokens, pruned } = contextManager.assemble(text, {
        injectMemory: true,
        responseReserve: 1024,
      });

      // Update context usage in conversation store (non-blocking)
      const usagePercent = contextManager.getContextUsagePercent();
      if (process.env.NODE_ENV === 'development' && pruned > 0) {
        console.debug(`[Pipeline] Pruned ${pruned} messages to fit context. Usage: ${usagePercent}%`);
      }

      run.messages = assembledMessages;

      const { aiConfig } = getAssistant();
      let assistantResponse = '';

      // ── Real OpenAI call or stub ───────────────────────────────────────────
      if (openAIClient.isConfigured) {
        run.stage = 'llm';
        assistant.setMode('thinking');

        // Add a streaming placeholder message
        assistant.addMessage({
          role: 'assistant',
          content: '',
          isVoice,
          isStreaming: true,
        });

        const result = await openAIAdapter.complete({
          messages: run.messages,
          config: aiConfig,
          onToken: (delta) => {
            // Accumulate and update the streaming message in-place
            assistantResponse += delta;
            assistant.setCurrentTranscript(assistantResponse);
            assistant.updateLastMessage({ content: assistantResponse });
          },
          signal: controller.signal,
        });

        assistantResponse = result.content;
        run.assistantResponse = assistantResponse;
        run.promptTokens = result.promptTokens;
        run.completionTokens = result.completionTokens;

        if (result.toolCalls) {
          run.toolCalls = result.toolCalls;
        }

        // Finalize the streaming message
        assistant.updateLastMessage({
          content: assistantResponse,
          isStreaming: false,
        });

      } else {
        // ── Stub response (no API key) ─────────────────────────────────────
        assistantResponse =
          `I'm ready to help, but no OpenAI API key is configured yet. ` +
          `Add NEXT_PUBLIC_OPENAI_API_KEY to your .env.local file to enable AI responses. ` +
          `You said: "${text}"`;

        run.assistantResponse = assistantResponse;
        assistant.addMessage({
          role: 'assistant',
          content: assistantResponse,
          isVoice,
        });
      }

      // ── Stage: TTS ────────────────────────────────────────────────────────
      if (isVoice && assistantResponse) {
        run.stage = 'tts';
        assistant.setMode('speaking');
        getVoice().enqueueTTS(assistantResponse, 'normal');
      }

      // ── Memory extraction (heuristic + async LLM) ─────────────────────────
      if (assistantResponse) {
        // memoryExtractor runs heuristics synchronously, then queues LLM extraction async
        memoryExtractor.extract(text, assistantResponse);
      }

      run.stage = 'complete';
      run.completedAt = Date.now();
      assistant.setMode('idle');
      assistant.setCurrentTranscript('');
      assistant.setIsStreaming(false);

      return { run, success: true, response: assistantResponse };

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const isAbort = err instanceof DOMException && err.name === 'AbortError';

      run.stage = 'error';
      run.error = message;

      if (!isAbort) {
        assistant.setError(message);
        assistant.setMode('error');
      } else {
        assistant.setMode('idle');
      }

      assistant.setCurrentTranscript('');
      assistant.setIsStreaming(false);

      return { run, success: false, error: message };

    } finally {
      this.activeAbortController = null;
    }
  }

  cancel(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
  }

  get isRunning(): boolean {
    return this.activeAbortController !== null;
  }
}

// ─────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────

export const pipeline = new JarvisPipeline();
export type { PipelineRun, PipelineStage };
