// app/api/stt/route.ts
// Server-side Whisper STT route.
// Receives audio blob from the client and returns transcript.
//
// POST /api/stt
// Body: FormData { audio: Blob, language?: string }
// Response: { transcript, confidence?, language }

import { NextRequest, NextResponse } from 'next/server';

const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';
const MAX_FILE_SIZE_MB = 25;

function getApiKey(): string {
  return process.env.OPENAI_API_KEY ?? process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? '';
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const audioFile = formData.get('audio') as File | null;
  const language = (formData.get('language') as string) ?? 'en';

  if (!audioFile) {
    return NextResponse.json({ error: 'audio field is required' }, { status: 400 });
  }

  // Size guard — Whisper limit is 25MB
  const sizeMB = audioFile.size / (1024 * 1024);
  if (sizeMB > MAX_FILE_SIZE_MB) {
    return NextResponse.json(
      { error: `Audio file too large: ${sizeMB.toFixed(1)}MB (max ${MAX_FILE_SIZE_MB}MB)` },
      { status: 413 },
    );
  }

  // Build multipart form for Whisper API
  const whisperForm = new FormData();
  whisperForm.append('file', audioFile, 'audio.webm');
  whisperForm.append('model', 'whisper-1');
  whisperForm.append('language', language);
  whisperForm.append('response_format', 'json');

  try {
    const upstream = await fetch(WHISPER_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
      signal: req.signal,
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({})) as { error?: { message?: string } };
      return NextResponse.json(
        { error: err.error?.message ?? `Whisper error ${upstream.status}` },
        { status: upstream.status },
      );
    }

    const data = await upstream.json() as { text: string };
    return NextResponse.json({
      transcript: data.text.trim(),
      confidence: 0.95,
      language,
    });

  } catch (err: unknown) {
    const isAbort = err instanceof DOMException && err.name === 'AbortError';
    if (isAbort) {
      return NextResponse.json({ error: 'Request cancelled' }, { status: 499 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Whisper transcription failed' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
