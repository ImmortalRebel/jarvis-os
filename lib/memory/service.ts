// lib/memory/service.ts
// Jarvis OS Memory Service — high-level API for reading and writing memories.
// Sits above useMemoryStore (raw state) and adds:
//   - Semantic search (keyword-based now, vector-based when embeddings added)
//   - Context injection for LLM system prompt
//   - Auto-importance scoring
//   - Memory extraction from conversation turns
//
// This is a pure singleton — no React.

import { useMemoryStore } from '@/store/useMemoryStore';
import { useAssistantStore } from '@/store/useAssistantStore';
import type { MemoryEntry, MemoryType } from '@/types/assistant';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export interface MemorizeOptions {
  content: string;
  type: MemoryType;
  importance?: number;
  metadata?: Record<string, unknown>;
}

export interface SearchOptions {
  query: string;
  type?: MemoryType;
  limit?: number;
  minImportance?: number;
}

export interface SearchResult {
  entry: MemoryEntry;
  score: number;
}

// ─────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────

class MemoryService {

  // ── Write ───────────────────────────────────────────────────────────────

  /**
   * Store a new memory entry.
   * Scores importance automatically if not provided.
   */
  memorize(options: MemorizeOptions): string {
    const importance = options.importance ?? this.scoreImportance(options.content, options.type);

    const id = useMemoryStore.getState().addMemory({
      type: options.type,
      content: options.content,
      importance,
      metadata: options.metadata ?? {},
    });

    if (process.env.NODE_ENV === 'development') {
      console.debug(`[Memory] Stored ${options.type} memory (importance: ${importance.toFixed(2)}):`, options.content.substring(0, 60));
    }

    return id;
  }

  /**
   * Store a user preference (semantic memory with high importance).
   */
  rememberPreference(content: string, metadata?: Record<string, unknown>): string {
    return this.memorize({ content, type: 'semantic', importance: 0.85, metadata });
  }

  /**
   * Store an episodic memory (interaction event).
   */
  rememberEvent(content: string, metadata?: Record<string, unknown>): string {
    return this.memorize({ content, type: 'episodic', importance: 0.5, metadata });
  }

  /**
   * Store a procedural memory (learned workflow/pattern).
   */
  rememberProcedure(content: string, metadata?: Record<string, unknown>): string {
    return this.memorize({ content, type: 'procedural', importance: 0.7, metadata });
  }

  // ── Search ──────────────────────────────────────────────────────────────

  /**
   * Search memories using keyword matching.
   * Returns results sorted by relevance score descending.
   * When vector embeddings are added, replace this with cosine similarity.
   */
  search(options: SearchOptions): SearchResult[] {
    const { query, type, limit = 5, minImportance = 0 } = options;
    const store = useMemoryStore.getState();
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

    const allMemories: MemoryEntry[] = [
      ...store.semanticMemory,
      ...store.episodicMemory,
      ...store.proceduralMemory,
    ].filter((m) => {
      if (type && m.type !== type) return false;
      if (m.importance < minImportance) return false;
      return true;
    });

    const scored: SearchResult[] = allMemories.map((entry) => {
      const text = entry.content.toLowerCase();
      let score = 0;
      let matchCount = 0;

      for (const term of terms) {
        if (text.includes(term)) {
          matchCount++;
          // Boost score for exact phrase match
          if (text.includes(query.toLowerCase())) score += 0.3;
        }
      }

      if (terms.length > 0) score += matchCount / terms.length;
      // Boost by importance
      score *= (0.5 + entry.importance * 0.5);
      // Recency boost (last 24h)
      const ageMs = Date.now() - entry.accessedAt;
      if (ageMs < 86_400_000) score += 0.1;

      return { entry, score };
    });

    // Sort by score, filter zero-score, apply limit
    return scored
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // ── Context Building ────────────────────────────────────────────────────

  /**
   * Build the memory context string to inject into the LLM system prompt.
   * Pulls top semantic facts and recent episodic context.
   */
  buildContext(userInput?: string): string {
    const store = useMemoryStore.getState();
    const sections: string[] = [];

    // Top semantic facts (user preferences, known info)
    const topFacts = [...store.semanticMemory]
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 8);

    if (topFacts.length > 0) {
      sections.push(
        'What you know about the user:\n' +
        topFacts.map((e) => `• ${e.content}`).join('\n'),
      );
    }

    // Recent episodic context (last 5 interactions)
    const recentEpisodic = [...store.episodicMemory]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);

    if (recentEpisodic.length > 0) {
      sections.push(
        'Recent context:\n' +
        recentEpisodic.map((e) => `• ${e.content}`).join('\n'),
      );
    }

    // Relevant search results if userInput provided
    if (userInput) {
      const results = this.search({ query: userInput, limit: 3, minImportance: 0.3 });
      if (results.length > 0) {
        sections.push(
          'Potentially relevant:\n' +
          results.map((r) => `• ${r.entry.content}`).join('\n'),
        );
      }
    }

    // Working memory
    if (store.workingMemory.length > 0) {
      sections.push(
        'Current session context:\n' +
        store.workingMemory.map((e) => `• ${e.content}`).join('\n'),
      );
    }

    return sections.join('\n\n');
  }

  // ── Auto-extraction ─────────────────────────────────────────────────────

  /**
   * Extract and store memories from a completed conversation turn.
   * Call after each assistant response.
   * Currently uses simple heuristics — replace with LLM extraction in production.
   */
  extractFromTurn(userMessage: string, assistantResponse: string): void {
    const now = Date.now();

    // Store as episodic event
    this.memorize({
      type: 'episodic',
      content: `User asked: "${userMessage.substring(0, 100)}"`,
      importance: 0.3,
      metadata: { timestamp: now, responsePreview: assistantResponse.substring(0, 50) },
    });

    // Heuristic: detect preference statements
    const prefPatterns = [
      /i (?:like|love|prefer|enjoy|hate|dislike)\s+(.+)/i,
      /my (?:name|favourite|favorite|preferred)\s+(?:is|are)\s+(.+)/i,
      /call me (.+)/i,
      /i am (?:a |an )?(.+)/i,
    ];

    for (const pattern of prefPatterns) {
      const match = userMessage.match(pattern);
      if (match?.[1]) {
        this.rememberPreference(
          `User said: "${userMessage.trim()}"`,
          { extractedAt: now, pattern: pattern.source },
        );
        break;
      }
    }
  }

  // ── Maintenance ─────────────────────────────────────────────────────────

  /**
   * Prune low-importance memories to keep storage size manageable.
   */
  prune(minImportance = 0.1): void {
    useMemoryStore.getState().prune(minImportance);
  }

  /**
   * Clear all memories (useful for testing or user-requested reset).
   */
  clearAll(): void {
    useMemoryStore.getState().clearAll();
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private scoreImportance(content: string, type: MemoryType): number {
    const base: Record<MemoryType, number> = {
      semantic: 0.6,
      episodic: 0.3,
      procedural: 0.65,
      working: 0.2,
    };

    let score = base[type];

    // Boost for personal information keywords
    const highValueTerms = ['name', 'prefer', 'always', 'never', 'important', 'remember', 'favourite', 'favorite'];
    const lowered = content.toLowerCase();
    if (highValueTerms.some((t) => lowered.includes(t))) score += 0.15;

    // Cap at 1.0
    return Math.min(1.0, score);
  }
}

// ─────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────

export const memoryService = new MemoryService();
