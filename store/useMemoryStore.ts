'use client';
// store/useMemoryStore.ts
// Jarvis OS memory system — episodic, semantic, working, and procedural memory.
// This store is the foundation for long-term context, personalization, and recall.
//
// Architecture notes:
// - Working memory: short-lived context injected into AI prompts (in-session)
// - Episodic memory: past interactions stored with timestamps
// - Semantic memory: facts/preferences extracted from conversations (persisted)
// - Procedural memory: learned workflows and patterns (persisted)
//
// Embedding / vector search is handled async by a future memory service.
// This store manages the state layer only.

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { MemoryEntry, MemoryType } from '@/types/assistant';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export interface MemoryQuery {
  query: string;
  type?: MemoryType;
  limit?: number;
  minImportance?: number;
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  /** Similarity score 0–1 (1 = exact match) */
  score: number;
}

export type MemoryStatus = 'idle' | 'indexing' | 'searching' | 'error';

// ─────────────────────────────────────────
// STATE INTERFACE
// ─────────────────────────────────────────

export interface MemoryStoreState {
  // ── Memory banks ─────────────────────────
  /** Working memory — current session context injected into AI prompts */
  workingMemory: MemoryEntry[];
  /** Semantic memory — facts, preferences, user info (persisted) */
  semanticMemory: MemoryEntry[];
  /** Episodic memory — past interactions and events (persisted) */
  episodicMemory: MemoryEntry[];
  /** Procedural memory — learned workflows and patterns (persisted) */
  proceduralMemory: MemoryEntry[];

  // ── Search state ──────────────────────────
  lastSearchResults: MemorySearchResult[];
  lastQuery: string | null;
  status: MemoryStatus;
  error: string | null;

  // ── Statistics ────────────────────────────
  totalEntries: number;

  // ── Actions: Write ────────────────────────
  addMemory: (entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'accessedAt' | 'accessCount'>) => string;
  updateMemory: (id: string, updates: Partial<MemoryEntry>) => void;
  deleteMemory: (id: string) => void;
  /** Bump accessedAt + accessCount for an entry (call on retrieval) */
  touchMemory: (id: string) => void;

  // ── Actions: Working memory ───────────────
  setWorkingContext: (entries: MemoryEntry[]) => void;
  clearWorkingMemory: () => void;
  /** Returns formatted context string for AI system prompt injection */
  buildContextString: () => string;

  // ── Actions: Search ───────────────────────
  setSearchResults: (results: MemorySearchResult[], query: string) => void;
  setStatus: (status: MemoryStatus, error?: string) => void;
  clearSearchResults: () => void;

  // ── Actions: Maintenance ──────────────────
  /** Remove entries below importance threshold to manage storage size */
  prune: (minImportance?: number) => void;
  clearAll: () => void;
}

// ─────────────────────────────────────────
// ID GENERATION
// ─────────────────────────────────────────

let _memCounter = 0;
function generateMemoryId(): string {
  return `mem_${Date.now()}_${++_memCounter}`;
}

// ─────────────────────────────────────────
// LIMITS (prevent unbounded storage growth)
// ─────────────────────────────────────────

const LIMITS: Record<MemoryType, number> = {
  working: 20,
  semantic: 500,
  episodic: 1000,
  procedural: 200,
};

function getBankKey(type: MemoryType): keyof Pick<MemoryStoreState, 'workingMemory' | 'semanticMemory' | 'episodicMemory' | 'proceduralMemory'> {
  const map: Record<MemoryType, keyof Pick<MemoryStoreState, 'workingMemory' | 'semanticMemory' | 'episodicMemory' | 'proceduralMemory'>> = {
    working: 'workingMemory',
    semantic: 'semanticMemory',
    episodic: 'episodicMemory',
    procedural: 'proceduralMemory',
  };
  return map[type];
}

// ─────────────────────────────────────────
// STORE
// ─────────────────────────────────────────

export const useMemoryStore = create<MemoryStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        // ── Initial state ─────────────────────
        workingMemory: [],
        semanticMemory: [],
        episodicMemory: [],
        proceduralMemory: [],
        lastSearchResults: [],
        lastQuery: null,
        status: 'idle',
        error: null,
        totalEntries: 0,

        // ── Write actions ─────────────────────

        addMemory: (entryData) => {
          const id = generateMemoryId();
          const now = Date.now();
          const entry: MemoryEntry = {
            ...entryData,
            id,
            createdAt: now,
            accessedAt: now,
            accessCount: 0,
          };
          const bankKey = getBankKey(entryData.type);
          const limit = LIMITS[entryData.type];
          set(
            (state) => {
              const bank = state[bankKey] as MemoryEntry[];
              // Enforce limit: drop lowest-importance entries when over limit
              const updated = [entry, ...bank].slice(0, limit);
              return {
                [bankKey]: updated,
                totalEntries: state.totalEntries + 1,
              };
            },
            false,
            'memory/addMemory',
          );
          return id;
        },

        updateMemory: (id, updates) => {
          const updateBank = (bank: MemoryEntry[]): MemoryEntry[] =>
            bank.map((e) => (e.id === id ? { ...e, ...updates } : e));
          set(
            (state) => ({
              workingMemory: updateBank(state.workingMemory),
              semanticMemory: updateBank(state.semanticMemory),
              episodicMemory: updateBank(state.episodicMemory),
              proceduralMemory: updateBank(state.proceduralMemory),
            }),
            false,
            'memory/updateMemory',
          );
        },

        deleteMemory: (id) => {
          const filterBank = (bank: MemoryEntry[]): MemoryEntry[] =>
            bank.filter((e) => e.id !== id);
          set(
            (state) => ({
              workingMemory: filterBank(state.workingMemory),
              semanticMemory: filterBank(state.semanticMemory),
              episodicMemory: filterBank(state.episodicMemory),
              proceduralMemory: filterBank(state.proceduralMemory),
              totalEntries: Math.max(0, state.totalEntries - 1),
            }),
            false,
            'memory/deleteMemory',
          );
        },

        touchMemory: (id) => {
          const now = Date.now();
          const touchBank = (bank: MemoryEntry[]): MemoryEntry[] =>
            bank.map((e) =>
              e.id === id
                ? { ...e, accessedAt: now, accessCount: e.accessCount + 1 }
                : e,
            );
          set(
            (state) => ({
              workingMemory: touchBank(state.workingMemory),
              semanticMemory: touchBank(state.semanticMemory),
              episodicMemory: touchBank(state.episodicMemory),
              proceduralMemory: touchBank(state.proceduralMemory),
            }),
            false,
            'memory/touchMemory',
          );
        },

        // ── Working memory ────────────────────

        setWorkingContext: (entries) => {
          set(
            { workingMemory: entries.slice(0, LIMITS.working) },
            false,
            'memory/setWorkingContext',
          );
        },

        clearWorkingMemory: () => {
          set({ workingMemory: [] }, false, 'memory/clearWorkingMemory');
        },

        buildContextString: () => {
          const { workingMemory, semanticMemory } = get();
          const sections: string[] = [];

          if (semanticMemory.length > 0) {
            const topFacts = semanticMemory
              .sort((a, b) => b.importance - a.importance)
              .slice(0, 10)
              .map((e) => `- ${e.content}`)
              .join('\n');
            sections.push(`Known facts about the user:\n${topFacts}`);
          }

          if (workingMemory.length > 0) {
            const context = workingMemory
              .map((e) => `- ${e.content}`)
              .join('\n');
            sections.push(`Current session context:\n${context}`);
          }

          return sections.join('\n\n');
        },

        // ── Search ────────────────────────────

        setSearchResults: (results, query) => {
          set(
            { lastSearchResults: results, lastQuery: query },
            false,
            'memory/setSearchResults',
          );
        },

        setStatus: (status, error) => {
          set({ status, error: error ?? null }, false, 'memory/setStatus');
        },

        clearSearchResults: () => {
          set(
            { lastSearchResults: [], lastQuery: null },
            false,
            'memory/clearSearchResults',
          );
        },

        // ── Maintenance ───────────────────────

        prune: (minImportance = 0.1) => {
          const filter = (bank: MemoryEntry[]) =>
            bank.filter((e) => e.importance >= minImportance);
          set(
            (state) => {
              const s = filter(state.semanticMemory);
              const ep = filter(state.episodicMemory);
              const pr = filter(state.proceduralMemory);
              return {
                semanticMemory: s,
                episodicMemory: ep,
                proceduralMemory: pr,
                totalEntries: state.workingMemory.length + s.length + ep.length + pr.length,
              };
            },
            false,
            'memory/prune',
          );
        },

        clearAll: () => {
          set(
            {
              workingMemory: [],
              semanticMemory: [],
              episodicMemory: [],
              proceduralMemory: [],
              lastSearchResults: [],
              lastQuery: null,
              totalEntries: 0,
            },
            false,
            'memory/clearAll',
          );
        },
      }),
      {
        name: 'jarvis-memory-store',
        // Persist everything except working memory (session-scoped)
        partialize: (state) => ({
          semanticMemory: state.semanticMemory,
          episodicMemory: state.episodicMemory,
          proceduralMemory: state.proceduralMemory,
          totalEntries: state.totalEntries,
        }),
      },
    ),
    {
      name: 'JarvisMemoryStore',
      enabled: process.env.NODE_ENV === 'development',
    },
  ),
);
