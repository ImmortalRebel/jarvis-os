// lib/tools/builtins/index.ts
// Built-in tools pre-registered with the tool registry.
// These are always available — no API keys required.
// Import and call registerBuiltins() once at app startup.

import { toolRegistry } from '@/lib/tools/registry';
import { memoryService } from '@/lib/memory/service';
import { runtime } from '@/lib/assistant/runtime';
import type { RegisteredTool } from '@/types/tools';

// ─────────────────────────────────────────
// BUILT-IN TOOL DEFINITIONS
// ─────────────────────────────────────────

const builtinTools: RegisteredTool[] = [

  // ── Time & Date ────────────────────────────────────────────────────────

  {
    name: 'get_current_time',
    description: 'Returns the current local time and date.',
    parameters: { type: 'object', properties: {} },
    category: 'system',
    execute: async () => {
      const now = new Date();
      return JSON.stringify({
        time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        date: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        iso: now.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    },
  },

  {
    name: 'get_day_of_week',
    description: 'Returns the current day of the week.',
    parameters: { type: 'object', properties: {} },
    category: 'system',
    execute: async () => {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return days[new Date().getDay()];
    },
  },

  // ── Browser ────────────────────────────────────────────────────────────

  {
    name: 'open_url',
    description: 'Opens a URL in the system default browser.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to open (must start with https://)' },
      },
      required: ['url'],
    },
    category: 'browser',
    execute: async (args) => {
      const url = args.url as string;
      if (!url.startsWith('https://') && !url.startsWith('http://')) {
        return 'Error: URL must start with http:// or https://';
      }
      window.open(url, '_blank', 'noopener,noreferrer');
      return `Opened: ${url}`;
    },
  },

  {
    name: 'search_web',
    description: 'Opens a web search for the given query in the default browser.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' },
        engine: {
          type: 'string',
          enum: ['google', 'duckduckgo', 'bing'],
          description: 'Search engine to use (default: google)',
        },
      },
      required: ['query'],
    },
    category: 'browser',
    execute: async (args) => {
      const query = encodeURIComponent(args.query as string);
      const engine = (args.engine as string) ?? 'google';
      const urls: Record<string, string> = {
        google: `https://www.google.com/search?q=${query}`,
        duckduckgo: `https://duckduckgo.com/?q=${query}`,
        bing: `https://www.bing.com/search?q=${query}`,
      };
      const url = urls[engine] ?? urls.google;
      window.open(url, '_blank', 'noopener,noreferrer');
      return `Searching ${engine} for: "${args.query}"`;
    },
  },

  // ── Memory ─────────────────────────────────────────────────────────────

  {
    name: 'remember_fact',
    description: 'Store a fact or preference about the user in long-term memory.',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The fact or preference to remember' },
        importance: {
          type: 'number',
          description: 'Importance score 0.0–1.0 (default: 0.7)',
        },
      },
      required: ['content'],
    },
    category: 'memory',
    execute: async (args) => {
      const id = memoryService.rememberPreference(
        args.content as string,
        { importance: args.importance ?? 0.7, storedAt: Date.now() },
      );
      return `Remembered: "${args.content}" (id: ${id})`;
    },
  },

  {
    name: 'recall',
    description: 'Search long-term memory for relevant facts about the user.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to search for in memory' },
        limit: { type: 'number', description: 'Max results to return (default: 5)' },
      },
      required: ['query'],
    },
    category: 'memory',
    execute: async (args) => {
      const results = memoryService.search({
        query: args.query as string,
        limit: (args.limit as number) ?? 5,
      });

      if (results.length === 0) {
        return 'No relevant memories found.';
      }

      return JSON.stringify(
        results.map((r) => ({
          content: r.entry.content,
          type: r.entry.type,
          importance: r.entry.importance,
          score: r.score.toFixed(2),
        })),
      );
    },
  },

  // ── Session ────────────────────────────────────────────────────────────

  {
    name: 'new_conversation',
    description: 'Start a fresh conversation session, clearing the current message history.',
    parameters: { type: 'object', properties: {} },
    category: 'system',
    execute: async () => {
      runtime.newSession();
      return 'New conversation started.';
    },
  },

  {
    name: 'get_system_info',
    description: 'Returns basic system and runtime information.',
    parameters: { type: 'object', properties: {} },
    category: 'system',
    execute: async () => {
      return JSON.stringify({
        platform: navigator.platform,
        language: navigator.language,
        userAgent: navigator.userAgent.substring(0, 80),
        online: navigator.onLine,
        screen: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        jarvisMode: 'web',
      });
    },
  },
];

// ─────────────────────────────────────────
// REGISTRATION FUNCTION
// ─────────────────────────────────────────

let registered = false;

/**
 * Register all built-in tools with the tool registry.
 * Safe to call multiple times — subsequent calls are no-ops.
 * Call once from JarvisProvider or app startup.
 */
export function registerBuiltins(): void {
  if (registered) return;
  toolRegistry.registerAll(builtinTools);
  registered = true;

  if (process.env.NODE_ENV === 'development') {
    console.log(`[ToolRegistry] Registered ${builtinTools.length} built-in tools:`,
      builtinTools.map((t) => t.name).join(', '));
  }
}

export { builtinTools };
