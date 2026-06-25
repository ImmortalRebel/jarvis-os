// app/api/tts/route.ts
// Server-side OpenAI TTS route.
// Returns audio as a stream so it can be played directly in the browser.
//
// POST /api/tts
// Body: { text, voice?, speed?, model? }
// Response: audio/mpeg stream

import { NextRequest, NextResponse } from 'next/server';

const TTS_API_URL = 'https://api.openai.com/v1/audio/speech';
const VALID_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;
const DEFAULT_VOICE = 'onyx';
const DEFAULT_MODEL = 'tts-1';
const MAX_CHARS = 4096;

type TTSVoice = typeof VALID_VOICES[number];

function getApiKey(): string {
  return process.env.OPENAI_API_KEY ?? process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? '';
}

export async function POST(req: NextRequest): Promise<NextResponse | Response> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 503 },
    );
  }

  let body: { text?: string; voice?: string; speed?: number; model?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { text, voice = DEFAULT_VOICE, speed = 1.0, model = DEFAULT_MODEL } = body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'text field is required' }, { status: 400 });
  }

  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `Text too long: ${text.length} chars (max ${MAX_CHARS})` },
      { status: 413 },
    );
  }

  const safeVoice: TTSVoice = VALID_VOICES.includes(voice as TTSVoice)
    ? (voice as TTSVoice)
    : DEFAULT_VOICE;

  try {
    const upstream = await fetch(TTS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text.trim(),
        voice: safeVoice,
        speed: Math.max(0.25, Math.min(4.0, speed)),
        response_format: 'mp3',
      }),
      signal: req.signal,
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({})) as { error?: { message?: string } };
      return NextResponse.json(
        { error: err.error?.message ?? `TTS error ${upstream.status}` },
        { status: upstream.status },
      );
    }

    // Stream the mp3 audio directly to the client
    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });

  } catch (err: unknown) {
    const isAbort = err instanceof DOMException && err.name === 'AbortError';
    if (isAbort) {
      return NextResponse.json({ error: 'Request cancelled' }, { status: 499 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'TTS failed' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
