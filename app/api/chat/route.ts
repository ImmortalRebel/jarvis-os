// app/api/chat/route.ts
// Server-side OpenAI chat completion route handler.
// Keeps the API key server-side — never exposed to the browser bundle.
//
// POST /api/chat
// Body: { messages, model, temperature, maxTokens, stream, tools }
// Response: { content, toolCalls, usage } or streaming SSE

import { NextRequest, NextResponse } from 'next/server';

// ─────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o';
const MAX_TOKENS_LIMIT = 4096;

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY ?? process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? '';
  return key;
}

// ─────────────────────────────────────────
// REQUEST HANDLER
// ─────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse | Response> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured. Set OPENAI_API_KEY in .env.local' },
      { status: 503 },
    );
  }

  let body: {
    messages: unknown[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    tools?: unknown[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    messages,
    model = DEFAULT_MODEL,
    temperature = 0.7,
    maxTokens = 1024,
    stream = false,
    tools,
  } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages array is required' }, { status: 400 });
  }

  const requestBody: Record<string, unknown> = {
    model,
    messages,
    temperature: Math.max(0, Math.min(2, temperature)),
    max_tokens: Math.min(maxTokens, MAX_TOKENS_LIMIT),
    stream,
  };

  if (tools && Array.isArray(tools) && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = 'auto';
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  // ── Streaming response ──────────────────────────────────────────────

  if (stream) {
    const upstream = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...requestBody, stream: true }),
      signal: req.signal,
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({ error: { message: upstream.statusText } }));
      return NextResponse.json(
        { error: (err as { error: { message: string } }).error?.message ?? 'OpenAI error' },
        { status: upstream.status },
      );
    }

    // Pipe the SSE stream directly to the client
    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  // ── Non-streaming response ──────────────────────────────────────────

  try {
    const upstream = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: req.signal,
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({})) as { error?: { message?: string } };
      return NextResponse.json(
        { error: err.error?.message ?? `OpenAI error ${upstream.status}` },
        { status: upstream.status },
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);

  } catch (err: unknown) {
    const isAbort = err instanceof DOMException && err.name === 'AbortError';
    if (isAbort) {
      return NextResponse.json({ error: 'Request cancelled' }, { status: 499 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
