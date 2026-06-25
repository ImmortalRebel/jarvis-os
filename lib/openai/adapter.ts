// lib/openai/adapter.ts
// OpenAI implementation of the LLMAdapter interface.
// Plugs directly into lib/pipeline/index.ts as the real LLM provider.
//
// USAGE — replace the stub in lib/pipeline/index.ts:
//   import { openAIAdapter } from '@/lib/openai/adapter'
//   const result = await openAIAdapter.complete({ messages, config, onToken, signal })

import { openAIClient } from './client';
import { toolRegistry } from '@/lib/tools/registry';
import { toolExecutor } from '@/lib/tools/executor';
import { ipc } from '@/lib/ipc/bridge';
import type { LLMAdapter } from '@/lib/pipeline/types';
import type { ConversationMessage, AIConfig } from '@/types/assistant';
import type { ToolCall, ToolResult } from '@/types/tools';
import type { OpenAIChatMessage } from './client';

// ─────────────────────────────────────────
// MESSAGE CONVERTER
// Jarvis ConversationMessage → OpenAI message format
// ─────────────────────────────────────────

function toOpenAIMessage(msg: ConversationMessage): OpenAIChatMessage {
  if (msg.role === 'tool') {
    return {
      role: 'tool',
      content: msg.content,
      tool_call_id: msg.toolCallId ?? '',
    };
  }
  return {
    role: msg.role as OpenAIChatMessage['role'],
    content: msg.content,
  };
}

// ─────────────────────────────────────────
// ADAPTER
// ─────────────────────────────────────────

class OpenAILLMAdapter implements LLMAdapter {
  readonly name = 'openai';
  readonly supportsStreaming = true;
  readonly supportsToolCalling = true;

  /**
   * Run a single LLM completion with tool-use loop.
   * Handles streaming tokens, tool calls, and multi-step reasoning.
   */
  async complete(params: {
    messages: ConversationMessage[];
    config: AIConfig;
    onToken?: (delta: string) => void;
    signal?: AbortSignal;
  }): Promise<{
    content: string;
    toolCalls?: ToolCall[];
    promptTokens?: number;
    completionTokens?: number;
  }> {
    const { messages, config, onToken, signal } = params;

    // Convert messages to OpenAI format
    const openAIMessages: OpenAIChatMessage[] = messages.map(toOpenAIMessage);

    // Get available tools in OpenAI format
    const tools = toolRegistry.getOpenAITools(ipc.isElectron);

    let allContent = '';
    const allToolCalls: ToolCall[] = [];
    let promptTokens = 0;
    let completionTokens = 0;

    // Tool use loop — max 5 iterations to prevent infinite loops
    const MAX_ITERATIONS = 5;
    let iteration = 0;

    while (iteration < MAX_ITERATIONS) {
      iteration++;

      if (config.streamingEnabled && onToken) {
        // ── Streaming mode ─────────────────────────────────────
        const result = await openAIClient.stream(
          {
            model: config.model,
            messages: openAIMessages,
            temperature: config.temperature,
            max_tokens: config.maxTokens,
            tools: tools.length > 0 ? (tools as import('./client').OpenAITool[]) : undefined,
            tool_choice: tools.length > 0 ? 'auto' : undefined,
          },
          onToken,
          signal,
        );

        allContent += result.content;

        if (!result.toolCalls || result.toolCalls.length === 0) {
          // No tool calls — we're done
          break;
        }

        // Execute tool calls
        const parsedCalls = this.parseToolCalls(result.toolCalls);
        allToolCalls.push(...parsedCalls);

        const toolResults = await toolExecutor.executeAll(parsedCalls);

        // Add assistant message with tool calls and results to conversation
        openAIMessages.push({
          role: 'assistant',
          content: result.content || null,
          tool_calls: result.toolCalls,
        });

        // Add tool results
        for (const tr of toolResults) {
          openAIMessages.push({
            role: 'tool',
            content: tr.output,
            tool_call_id: tr.toolCallId,
          });
        }

        // Continue loop for next iteration
        onToken?.('\n');

      } else {
        // ── Non-streaming mode ─────────────────────────────────
        const response = await openAIClient.chat({
          model: config.model,
          messages: openAIMessages,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          tools: tools.length > 0 ? (tools as import('./client').OpenAITool[]) : undefined,
          tool_choice: tools.length > 0 ? 'auto' : undefined,
        });

        const choice = response.choices[0];
        promptTokens += response.usage?.prompt_tokens ?? 0;
        completionTokens += response.usage?.completion_tokens ?? 0;

        const assistantContent = choice.message.content ?? '';
        allContent += assistantContent;

        if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
          break;
        }

        // Execute tool calls
        const parsedCalls = this.parseToolCalls(choice.message.tool_calls);
        allToolCalls.push(...parsedCalls);

        const toolResults = await toolExecutor.executeAll(parsedCalls);

        // Add to conversation for next iteration
        openAIMessages.push({
          role: 'assistant',
          content: assistantContent || null,
          tool_calls: choice.message.tool_calls,
        });

        for (const tr of toolResults) {
          openAIMessages.push({
            role: 'tool',
            content: tr.output,
            tool_call_id: tr.toolCallId,
          });
        }
      }
    }

    return {
      content: allContent,
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
      promptTokens,
      completionTokens,
    };
  }

  // ── Parse tool calls from OpenAI response ─────────────────────────────

  private parseToolCalls(
    rawCalls: Array<{ id: string; function: { name: string; arguments: string } }>,
  ): ToolCall[] {
    return rawCalls.map((tc) => {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(tc.function.arguments);
      } catch {
        parsedArgs = { _raw: tc.function.arguments };
      }

      return {
        id: tc.id,
        name: tc.function.name,
        arguments: parsedArgs,
        rawArguments: tc.function.arguments,
      };
    });
  }

  /**
   * Check if the OpenAI client is configured and ready.
   */
  get isReady(): boolean {
    return openAIClient.isConfigured;
  }
}

// ─────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────

export const openAIAdapter = new OpenAILLMAdapter();
