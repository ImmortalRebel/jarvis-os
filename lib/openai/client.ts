// lib/openai/client.ts
// OpenAI API client for Jarvis OS.
//
// SETUP:
//   1. Create a .env.local file in the project root
//   2. Add: NEXT_PUBLIC_OPENAI_API_KEY=sk-...
//      OR (more secure, server-side only): OPENAI_API_KEY=sk-...
//
// ARCHITECTURE NOTE:
//   In Next.js 16 App Router, API calls to OpenAI should be made from
//   Route Handlers (app/api/*) to keep the API key server-side.
//   This client works in both contexts — it reads the env var at call time.
//
//   For a production AI assistant:
//     Browser → POST /api/chat → Route Handler → OpenAI API
//   This keeps your API key out of the browser bundle entirely.
//
//   For a desktop Electron build, calling OpenAI directly from the renderer
//   is acceptable since the key is local to the user's machine.

export interface OpenAIClientConfig {
  apiKey?: string;
  baseURL?: string;
  organization?: string;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** null is valid for assistant messages that contain only tool_calls */
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: OpenAIToolCall[];
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: object;
  };
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: OpenAITool[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

export interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason: string | null;
  }>;
}

// ─────────────────────────────────────────
// CLIENT CLASS
// ─────────────────────────────────────────

class OpenAIClient {
  private config: Required<OpenAIClientConfig>;

  constructor(config: OpenAIClientConfig = {}) {
    this.config = {
      apiKey: config.apiKey ?? '',
      baseURL: config.baseURL ?? 'https://api.openai.com/v1',
      organization: config.organization ?? '',
      maxRetries: config.maxRetries ?? 2,
      timeoutMs: config.timeoutMs ?? 30_000,
    };
  }

  private getApiKey(): string {
    // Try runtime config first (set via updateConfig)
    if (this.config.apiKey) return this.config.apiKey;
    // Try env vars — NEXT_PUBLIC_ prefix makes it available browser-side
    if (typeof process !== 'undefined') {
      return process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? '';
    }
    return '';
  }

  /**
   * Update the client configuration at runtime.
   * Call this when the user sets their API key in settings.
   */
  updateConfig(config: Partial<OpenAIClientConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Returns true if an API key is available.
   */
  get isConfigured(): boolean {
    return this.getApiKey().length > 10;
  }

  // ── Chat Completion (non-streaming) ──────────────────────────────────────

  async chat(request: OpenAIChatRequest): Promise<OpenAIChatResponse> {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      throw new Error(
        'OpenAI API key not configured. Set NEXT_PUBLIC_OPENAI_API_KEY in .env.local or call openAIClient.updateConfig({ apiKey: "sk-..." })',
      );
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    if (this.config.organization) {
      headers['OpenAI-Organization'] = this.config.organization;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

        const res = await fetch(`${this.config.baseURL}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...request, stream: false }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) {
          const errorBody = await res.json().catch(() => ({ error: { message: res.statusText } }));
          const message = errorBody?.error?.message ?? `HTTP ${res.status}`;

          // Don't retry client errors (4xx) except 429 (rate limit)
          if (res.status >= 400 && res.status < 500 && res.status !== 429) {
            throw new Error(`OpenAI API error: ${message}`);
          }

          lastError = new Error(`OpenAI API error: ${message}`);
          if (attempt < this.config.maxRetries) {
            await sleep(Math.pow(2, attempt) * 500); // exponential backoff
            continue;
          }
          throw lastError;
        }

        return await res.json() as OpenAIChatResponse;

      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new Error(`OpenAI request timed out after ${this.config.timeoutMs}ms`);
        }
        if (attempt === this.config.maxRetries) {
          throw err instanceof Error ? err : new Error(String(err));
        }
        lastError = err instanceof Error ? err : new Error(String(err));
        await sleep(Math.pow(2, attempt) * 500);
      }
    }

    throw lastError ?? new Error('OpenAI request failed');
  }

  // ── Streaming Chat Completion ────────────────────────────────────────────

  /**
   * Stream a chat completion, calling onToken for each text delta.
   * Returns the full accumulated response when the stream ends.
   */
  async stream(
    request: Omit<OpenAIChatRequest, 'stream'>,
    onToken: (delta: string) => void,
    signal?: AbortSignal,
  ): Promise<{ content: string; toolCalls: OpenAIToolCall[]; usage?: { prompt_tokens: number; completion_tokens: number } }> {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      throw new Error('OpenAI API key not configured.');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    if (this.config.organization) {
      headers['OpenAI-Organization'] = this.config.organization;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    if (signal) signal.addEventListener('abort', () => controller.abort());

    const res = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...request, stream: true }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new Error(`OpenAI streaming error: ${errorBody?.error?.message ?? res.statusText}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let accumulated = '';
    const toolCallAccumulators: Map<number, { id: string; name: string; args: string }> = new Map();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

        for (const line of lines) {
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;

          try {
            const parsed = JSON.parse(json) as OpenAIStreamChunk;
            const delta = parsed.choices[0]?.delta;

            if (delta?.content) {
              accumulated += delta.content;
              onToken(delta.content);
            }

            // Accumulate tool calls across chunks
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const existing = toolCallAccumulators.get(tc.index) ?? { id: '', name: '', args: '' };
                toolCallAccumulators.set(tc.index, {
                  id: existing.id || tc.id || '',
                  name: existing.name || tc.function?.name || '',
                  args: existing.args + (tc.function?.arguments ?? ''),
                });
              }
            }
          } catch {
            // Malformed JSON chunk — skip
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Build tool calls array
    const toolCalls: OpenAIToolCall[] = Array.from(toolCallAccumulators.values()).map((tc, i) => ({
      id: tc.id || `tc_${i}`,
      type: 'function' as const,
      function: { name: tc.name, arguments: tc.args },
    }));

    return { content: accumulated, toolCalls };
  }
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────

export const openAIClient = new OpenAIClient();
