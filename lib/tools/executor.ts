// lib/tools/executor.ts
// Tool execution engine for Jarvis OS.
// Safely executes tools from the registry with:
//   - Argument validation
//   - Timeout enforcement
//   - Error isolation (tool failure never crashes the pipeline)
//   - Execution metrics

import { toolRegistry } from './registry';
import type { ToolCall, ToolResult } from '@/types/tools';

// ─────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 10_000; // 10 seconds per tool

// ─────────────────────────────────────────
// EXECUTOR
// ─────────────────────────────────────────

class ToolExecutor {

  /**
   * Execute a single tool call from the AI pipeline.
   * Never throws — always returns a ToolResult (success or error).
   */
  async execute(toolCall: ToolCall, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<ToolResult> {
    const startTime = Date.now();
    const tool = toolRegistry.get(toolCall.name);

    // Tool not found
    if (!tool) {
      return {
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        status: 'error',
        output: `Tool "${toolCall.name}" is not registered.`,
        error: `Unknown tool: ${toolCall.name}`,
        executionMs: Date.now() - startTime,
      };
    }

    // Validate arguments
    const argError = this.validateArguments(toolCall, tool);
    if (argError) {
      return {
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        status: 'error',
        output: `Invalid arguments: ${argError}`,
        error: argError,
        executionMs: Date.now() - startTime,
      };
    }

    // Execute with timeout
    try {
      const output = await this.withTimeout(
        tool.execute(toolCall.arguments),
        timeoutMs,
        toolCall.name,
      );

      const executionMs = Date.now() - startTime;

      if (process.env.NODE_ENV === 'development') {
        console.debug(`[ToolExecutor] ${toolCall.name} completed in ${executionMs}ms`);
      }

      return {
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        status: 'success',
        output,
        executionMs,
      };

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const executionMs = Date.now() - startTime;

      if (process.env.NODE_ENV === 'development') {
        console.error(`[ToolExecutor] ${toolCall.name} failed:`, message);
      }

      return {
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        status: 'error',
        output: `Tool execution failed: ${message}`,
        error: message,
        executionMs,
      };
    }
  }

  /**
   * Execute multiple tool calls in parallel.
   * All tools run concurrently — results are returned in the same order.
   */
  async executeAll(toolCalls: ToolCall[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<ToolResult[]> {
    return Promise.all(toolCalls.map((tc) => this.execute(tc, timeoutMs)));
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private withTimeout<T>(promise: Promise<T>, ms: number, name: string): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Tool "${name}" timed out after ${ms}ms`)), ms),
    );
    return Promise.race([promise, timeout]);
  }

  private validateArguments(toolCall: ToolCall, tool: { parameters: { required?: string[]; properties: Record<string, unknown> } }): string | null {
    const required = tool.parameters.required ?? [];
    for (const key of required) {
      if (!(key in toolCall.arguments)) {
        return `Missing required argument: "${key}"`;
      }
    }
    return null;
  }
}

// ─────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────

export const toolExecutor = new ToolExecutor();
