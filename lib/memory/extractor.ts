// lib/memory/extractor.ts
// Memory extraction system for Jarvis OS.
// Extracts facts, preferences, and patterns from conversation turns.
//
// Two extraction modes:
//   1. Heuristic (always active) — regex patterns, no API cost
//   2. LLM-powered (optional)   — POST /api/chat for richer extraction

import { memoryService } from './service';
import type { MemoryType } from '@/types/assistant';

// ─────────────────────────────────────────
// EXTRACTION PATTERNS
// ─────────────────────────────────────────

interface ExtractionPattern {
  type: MemoryType;
  importance: number;
  patterns: RegExp[];
  transform?: (match: RegExpMatchArray, input: string) => string;
}

const EXTRACTION_PATTERNS: ExtractionPattern[] = [
  // Personal identity
  {
    type: 'semantic',
    importance: 0.95,
    patterns: [
      /(?:my name is|i(?:'m| am) called|call me)\s+([A-Za-z][A-Za-z\s'-]{1,30})/i,
    ],
    transform: (m) => `User's name is ${m[1].trim()}`,
  },
  // Preferences — likes
  {
    type: 'semantic',
    importance: 0.8,
    patterns: [
      /i (?:really )?(?:like|love|enjoy|prefer|adore)\s+(.{3,60}?)(?:\.|$)/i,
    ],
    transform: (m, input) => `User likes: ${m[1].trim()} (from: "${input.substring(0, 50)}")`,
  },
  // Preferences — dislikes
  {
    type: 'semantic',
    importance: 0.8,
    patterns: [
      /i (?:really )?(?:hate|dislike|don't like|do not like|can't stand)\s+(.{3,60}?)(?:\.|$)/i,
    ],
    transform: (m, input) => `User dislikes: ${m[1].trim()} (from: "${input.substring(0, 50)}")`,
  },
  // Location
  {
    type: 'semantic',
    importance: 0.85,
    patterns: [
      /i (?:live|am|work|stay) (?:in|at|near)\s+([A-Za-z][A-Za-z\s,'-]{2,40})/i,
    ],
    transform: (m) => `User's location: ${m[1].trim()}`,
  },
  // Occupation
  {
    type: 'semantic',
    importance: 0.8,
    patterns: [
      /i(?:'m| am) (?:a |an )?(.{3,40}?)(?: by profession|for work|as a career)?(?:\.|,|$)/i,
    ],
    transform: (m) => `User occupation/identity: ${m[1].trim()}`,
  },
  // Reminders / tasks
  {
    type: 'episodic',
    importance: 0.7,
    patterns: [
      /remind me (?:to|about)\s+(.{3,80}?)(?:\.|$)/i,
    ],
    transform: (m) => `User requested reminder: ${m[1].trim()}`,
  },
  // Goals
  {
    type: 'semantic',
    importance: 0.75,
    patterns: [
      /i (?:want to|need to|plan to|am trying to|would like to)\s+(.{5,80}?)(?:\.|$)/i,
    ],
    transform: (m) => `User goal: ${m[1].trim()}`,
  },
  // Age
  {
    type: 'semantic',
    importance: 0.75,
    patterns: [
      /i(?:'m| am)\s+(\d{1,3})\s+years?\s+old/i,
    ],
    transform: (m) => `User age: ${m[1]} years old`,
  },
];

// ─────────────────────────────────────────
// LLM EXTRACTION PROMPT
// ─────────────────────────────────────────

const LLM_EXTRACTION_SYSTEM = `You are a memory extraction assistant. 
Extract factual information about the user from the conversation.
Return ONLY a JSON array of strings, each being a concise fact.
Example: ["User's name is Alex", "User prefers dark mode", "User works as a developer"]
If nothing extractable, return [].
Be concise. Max 5 facts per call.`;

// ─────────────────────────────────────────
// EXTRACTOR
// ─────────────────────────────────────────

class MemoryExtractor {
  private extractionQueue: Array<{ user: string; assistant: string }> = [];
  private isProcessing = false;

  /**
   * Extract memories from a completed conversation turn.
   * Runs heuristics immediately, queues LLM extraction if available.
   */
  extract(userMessage: string, assistantResponse: string): void {
    if (!userMessage.trim()) return;

    // Always run heuristic extraction (free, instant)
    this.runHeuristicExtraction(userMessage);

    // Queue LLM extraction for background processing
    this.extractionQueue.push({ user: userMessage, assistant: assistantResponse });
    void this.processQueue();
  }

  /**
   * Heuristic extraction — regex pattern matching.
   * Runs synchronously, zero cost.
   */
  private runHeuristicExtraction(text: string): void {
    for (const pattern of EXTRACTION_PATTERNS) {
      for (const regex of pattern.patterns) {
        const match = text.match(regex);
        if (match) {
          const content = pattern.transform
            ? pattern.transform(match, text)
            : `${text.substring(0, 100)}`;

          if (content && content.length > 5) {
            memoryService.memorize({
              content,
              type: pattern.type,
              importance: pattern.importance,
              metadata: {
                extractedAt: Date.now(),
                source: 'heuristic',
                pattern: regex.source,
              },
            });
          }
        }
      }
    }
  }

  /**
   * LLM extraction — uses /api/chat to extract richer facts.
   * Runs in background, processes queue one at a time.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.extractionQueue.length === 0) return;
    this.isProcessing = true;

    while (this.extractionQueue.length > 0) {
      const item = this.extractionQueue.shift();
      if (!item) break;

      try {
        await this.runLLMExtraction(item.user, item.assistant);
      } catch {
        // LLM extraction is best-effort — never crash on failure
      }

      // Throttle — wait 500ms between extractions
      await new Promise((r) => setTimeout(r, 500));
    }

    this.isProcessing = false;
  }

  private async runLLMExtraction(
    userMessage: string,
    assistantResponse: string,
  ): Promise<void> {
    // Check if API route is available
    const hasKey = typeof process !== 'undefined' &&
      !!(process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY);
    if (!hasKey) return;

    const prompt = `User said: "${userMessage.substring(0, 200)}"\nAssistant said: "${assistantResponse.substring(0, 200)}"`;

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: LLM_EXTRACTION_SYSTEM },
          { role: 'user', content: prompt },
        ],
        model: 'gpt-4o-mini',
        temperature: 0.2,
        maxTokens: 256,
        stream: false,
      }),
    });

    if (!res.ok) return;

    const data = await res.json() as { choices?: Array<{ message: { content: string } }> };
    const rawContent = data.choices?.[0]?.message?.content?.trim() ?? '[]';

    let facts: string[] = [];
    try {
      const cleaned = rawContent.replace(/```json|```/g, '').trim();
      facts = JSON.parse(cleaned) as string[];
    } catch {
      return;
    }

    for (const fact of facts) {
      if (typeof fact === 'string' && fact.length > 5 && fact.length < 200) {
        memoryService.memorize({
          content: fact,
          type: 'semantic',
          importance: 0.7,
          metadata: { extractedAt: Date.now(), source: 'llm' },
        });
      }
    }
  }
}

export const memoryExtractor = new MemoryExtractor();
