// lib/memory/context.ts
// Context window manager for Jarvis OS.
// Responsible for:
//   - Estimating token counts for messages
//   - Pruning conversation history to stay within model limits
//   - Assembling the final message array for each LLM call
//   - Injecting memory context into system prompt
//   - Managing short-term (session) vs long-term (persisted) context

import { useAssistantStore } from '@/store/useAssistantStore';
import { memoryService } from './service';
import type { ConversationMessage, AIConfig } from '@/types/assistant';

// ─────────────────────────────────────────
// TOKEN ESTIMATION
// ─────────────────────────────────────────

// Approximation: 1 token ≈ 4 chars for English text
// This avoids a tokenizer dependency while staying close enough for pruning.
const CHARS_PER_TOKEN = 4;
const TOKENS_PER_MESSAGE_OVERHEAD = 4; // role + separators

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function estimateMessageTokens(msg: ConversationMessage): number {
  return TOKENS_PER_MESSAGE_OVERHEAD + estimateTokens(msg.content ?? '');
}

// ─────────────────────────────────────────
// MODEL CONTEXT LIMITS
// ─────────────────────────────────────────

const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'gpt-4o':            128_000,
  'gpt-4o-mini':        16_000,
  'gpt-4-turbo':       128_000,
  'gpt-4':               8_192,
  'gpt-3.5-turbo':      16_385,
  'gpt-3.5-turbo-16k':  16_385,
};

function getContextLimit(model: string): number {
  return MODEL_CONTEXT_LIMITS[model] ?? 16_000;
}

// ─────────────────────────────────────────
// CONTEXT MANAGER
// ─────────────────────────────────────────

export interface ContextAssemblyResult {
  messages: ConversationMessage[];
  totalTokens: number;
  pruned: number;
  memoryInjected: boolean;
}

export interface ContextOptions {
  /** Include memory context in system prompt (default: true) */
  injectMemory?: boolean;
  /** Reserve tokens for the response (default: 1024) */
  responseReserve?: number;
  /** Force include these messages regardless of token limit */
  forceInclude?: ConversationMessage[];
}

class ContextManager {

  /**
   * Assemble the full message array for an LLM call.
   * Handles token counting, pruning, and memory injection.
   */
  assemble(userInput: string, options: ContextOptions = {}): ContextAssemblyResult {
    const { injectMemory = true, responseReserve = 1024 } = options;
    const { aiConfig, messages } = useAssistantStore.getState();

    const contextLimit = getContextLimit(aiConfig.model);
    const usableTokens = contextLimit - responseReserve;

    // Build system message with optional memory context
    const systemContent = this.buildSystemPrompt(aiConfig, userInput, injectMemory);
    const systemMessage: ConversationMessage = {
      id: 'system-0',
      role: 'system',
      content: systemContent,
      timestamp: Date.now(),
    };

    // Current user message (not yet in store)
    const userMessage: ConversationMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userInput,
      timestamp: Date.now(),
    };

    // Calculate tokens used by system + current user message
    const systemTokens = estimateMessageTokens(systemMessage);
    const userTokens = estimateMessageTokens(userMessage);
    const reservedTokens = systemTokens + userTokens;

    if (reservedTokens >= usableTokens) {
      // System + user alone fills the context — return minimal
      return {
        messages: [systemMessage, userMessage],
        totalTokens: reservedTokens,
        pruned: messages.length,
        memoryInjected: injectMemory,
      };
    }

    // Prune conversation history to fit remaining token budget
    const remainingBudget = usableTokens - reservedTokens;
    const { kept, pruned } = this.pruneHistory(messages, remainingBudget);

    const assembled: ConversationMessage[] = [
      systemMessage,
      ...kept,
      userMessage,
    ];

    const totalTokens = assembled.reduce((sum, m) => sum + estimateMessageTokens(m), 0);

    return {
      messages: assembled,
      totalTokens,
      pruned,
      memoryInjected: injectMemory,
    };
  }

  /**
   * Prune oldest messages to fit within token budget.
   * Always keeps the most recent messages.
   * Never prunes system messages.
   */
  private pruneHistory(
    messages: ConversationMessage[],
    budgetTokens: number,
  ): { kept: ConversationMessage[]; pruned: number } {
    // Work from newest to oldest — keep until budget exhausted
    const nonSystem = messages.filter(
      (m) => m.role !== 'system' && !m.isStreaming,
    );

    const kept: ConversationMessage[] = [];
    let usedTokens = 0;

    for (let i = nonSystem.length - 1; i >= 0; i--) {
      const msg = nonSystem[i];
      const tokens = estimateMessageTokens(msg);
      if (usedTokens + tokens > budgetTokens) break;
      kept.unshift(msg);
      usedTokens += tokens;
    }

    return {
      kept,
      pruned: nonSystem.length - kept.length,
    };
  }

  /**
   * Build the system prompt including memory context.
   */
  private buildSystemPrompt(
    config: AIConfig,
    userInput: string,
    injectMemory: boolean,
  ): string {
    let prompt = config.systemPrompt;

    if (injectMemory) {
      const memCtx = memoryService.buildContext(userInput);
      if (memCtx) {
        prompt += `\n\n${memCtx}`;
      }
    }

    return prompt;
  }

  /**
   * Estimate total tokens for a set of messages.
   */
  estimateTokens(messages: ConversationMessage[]): number {
    return messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
  }

  /**
   * Get the context limit for the current model.
   */
  getModelLimit(): number {
    const { aiConfig } = useAssistantStore.getState();
    return getContextLimit(aiConfig.model);
  }

  /**
   * Returns what percentage of context is used by current conversation.
   */
  getContextUsagePercent(): number {
    const { messages, aiConfig } = useAssistantStore.getState();
    const used = messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
    const limit = getContextLimit(aiConfig.model);
    return Math.min(100, Math.round((used / limit) * 100));
  }
}

export const contextManager = new ContextManager();
