// lib/commands/handlers/index.ts
// Built-in command handlers for Jarvis OS.
// All handlers are registered in commandRegistry.
// Call registerBuiltinCommands() once at app startup.

import { commandRegistry } from '@/lib/commands/registry';
import { memoryService } from '@/lib/memory/service';
import { runtime } from '@/lib/assistant/runtime';
import { wakeWordEngine } from '@/lib/voice/wakeword';
import { useAssistantStore } from '@/store/useAssistantStore';
import type { CommandDefinition } from '@/lib/commands/registry';

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

function now(): { time: string; date: string; day: string } {
  const d = new Date();
  return {
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    date: d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    day: d.toLocaleDateString('en-US', { weekday: 'long' }),
  };
}

function safeOpen(url: string): void {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ─────────────────────────────────────────
// COMMAND DEFINITIONS
// ─────────────────────────────────────────

const BUILTIN_COMMANDS: CommandDefinition[] = [

  // ── Time & Date ────────────────────────────────────────────────────

  {
    id: 'get_time',
    trigger: /^(?:what(?:'s| is) the (?:current )?time|what time is it|tell me the time)/i,
    aliases: [/^time(?:\s+now)?$/i],
    description: 'Get current time',
    category: 'utility',
    examples: ["What time is it?", "Tell me the time"],
    handler: () => {
      const { time } = now();
      return { handled: true, response: `The current time is ${time}.`, action: 'speak' };
    },
  },

  {
    id: 'get_date',
    trigger: /^(?:what(?:'s| is) (?:today's |the )?date|what day is (?:it|today)|today)/i,
    description: 'Get current date',
    category: 'utility',
    examples: ["What's today's date?", "What day is it?"],
    handler: () => {
      const { date, day } = now();
      return { handled: true, response: `Today is ${day}, ${date}.`, action: 'speak' };
    },
  },

  // ── Web Navigation ─────────────────────────────────────────────────

  {
    id: 'open_url',
    trigger: /^(?:go to|open|visit|navigate to)\s+(https?:\/\/\S+|(?:www\.)?\S+\.\S{2,4})/i,
    description: 'Open a URL in the browser',
    category: 'navigation',
    examples: ["Open google.com", "Go to github.com"],
    handler: (ctx) => {
      const url = ctx.params.url ?? ctx.rawInput.match(/https?:\/\/\S+|(?:www\.)?\S+\.\S{2,4}/i)?.[0];
      if (!url) return { handled: true, response: "I couldn't find a URL in that request." };
      safeOpen(url);
      return { handled: true, response: `Opening ${url}.`, action: 'speak' };
    },
  },

  {
    id: 'search_web',
    trigger: /^(?:search (?:for |the web for )?|google |bing |look up )(.+)/i,
    aliases: [/^find (.+) online$/i],
    description: 'Search the web',
    category: 'search',
    examples: ["Search for Next.js tutorials", "Google the weather"],
    handler: (ctx) => {
      const query = ctx.params.query ?? ctx.rawInput.replace(/^(?:search for?|google|bing|look up)\s+/i, '');
      if (!query.trim()) return { handled: true, response: "What would you like to search for?" };
      safeOpen(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
      return { handled: true, response: `Searching the web for: ${query}.`, action: 'speak' };
    },
  },

  // ── Assistant Control ──────────────────────────────────────────────

  {
    id: 'sleep',
    trigger: /^(?:go to sleep|sleep(?: mode)?|be quiet|goodbye jarvis)$/i,
    description: 'Put assistant to sleep',
    category: 'assistant',
    examples: ["Go to sleep", "Sleep mode"],
    handler: () => {
      setTimeout(() => runtime.speak('Entering sleep mode. Press Ctrl+Shift+J to wake me.'), 500);
      setTimeout(() => {
        const { sleepAssistant } = require('@/lib/assistant/modes');
        sleepAssistant();
      }, 2000);
      return { handled: true, response: 'Entering sleep mode. Press Ctrl+Shift+J to wake me.', action: 'speak' };
    },
  },

  {
    id: 'new_conversation',
    trigger: /^(?:clear|reset|start|new) (?:conversation|chat|history)$/i,
    description: 'Start a new conversation',
    category: 'assistant',
    examples: ["New conversation", "Clear chat"],
    handler: () => {
      runtime.newSession();
      return { handled: true, response: 'Starting a fresh conversation.', action: 'speak' };
    },
  },

  {
    id: 'stop_listening',
    trigger: /^(?:stop|cancel|never mind|abort)$/i,
    description: 'Stop current operation',
    category: 'assistant',
    examples: ["Stop", "Cancel", "Never mind"],
    handler: () => {
      const { resetToIdle } = require('@/lib/assistant/modes');
      const { pipeline } = require('@/lib/pipeline');
      pipeline.cancel();
      resetToIdle();
      return { handled: true, response: 'Stopped.', action: 'speak' };
    },
  },

  // ── Memory ─────────────────────────────────────────────────────────

  {
    id: 'remember',
    trigger: /^remember (?:that )?(.+)/i,
    aliases: [/^(?:note|note down|make a note)(?: that)?\s+(.+)/i],
    description: 'Store a memory',
    category: 'memory',
    examples: ["Remember that I prefer dark mode", "Note that my meeting is at 3pm"],
    handler: (ctx) => {
      const content = ctx.params.content ?? ctx.rawInput.replace(/^(?:remember(?: that)?|note(?: that)?)\s+/i, '');
      if (!content.trim()) return { handled: true, response: "What would you like me to remember?" };
      memoryService.rememberPreference(content);
      return { handled: true, response: `Got it, I'll remember: ${content}.`, action: 'speak' };
    },
  },

  {
    id: 'recall',
    trigger: /^(?:do you remember|recall|what do you know about)\s+(.+)/i,
    description: 'Search memories',
    category: 'memory',
    examples: ["Do you remember my name?", "Recall my preferences"],
    handler: (ctx) => {
      const query = ctx.params.query ?? ctx.rawInput.replace(/^(?:do you remember|recall|what do you know about)\s+/i, '');
      const results = memoryService.search({ query, limit: 3 });
      if (results.length === 0) {
        return { handled: true, response: `I don't have anything stored about "${query}" yet.`, action: 'speak' };
      }
      const facts = results.map((r) => r.entry.content).join('. ');
      return { handled: true, response: `Here's what I know: ${facts}`, action: 'speak' };
    },
  },

  // ── Calculations ────────────────────────────────────────────────────

  {
    id: 'calculate',
    trigger: /^(?:calculate|compute|what is|what's)\s+([\d\s+\-*/^()%.]+\??)$/i,
    description: 'Perform a calculation',
    category: 'utility',
    examples: ["Calculate 42 * 8", "What is 100 / 4"],
    handler: (ctx) => {
      const expr = (ctx.params.expression ?? ctx.rawInput)
        .replace(/^(?:calculate|compute|what is|what's)\s+/i, '')
        .replace(/\?$/, '')
        .trim();
      try {
        // Safe eval — only allow numbers and operators
        if (!/^[\d\s+\-*/^().%]+$/.test(expr)) {
          return { handled: true, response: "I can only calculate numeric expressions.", action: 'speak' };
        }
        const result = Function(`"use strict"; return (${expr.replace(/\^/g, '**')})`)() as number;
        if (!isFinite(result)) throw new Error('Invalid result');
        return { handled: true, response: `${expr} equals ${result}.`, action: 'speak' };
      } catch {
        return { handled: true, response: `I couldn't calculate that expression.`, action: 'speak' };
      }
    },
  },

  // ── System Info ─────────────────────────────────────────────────────

  {
    id: 'jarvis_version',
    trigger: /^(?:what version are you|what are you running|jarvis version)$/i,
    description: 'Get Jarvis version info',
    category: 'system',
    examples: ["What version are you?"],
    handler: () => {
      const { mode, interactionCount } = useAssistantStore.getState();
      return {
        handled: true,
        response: `I'm Jarvis OS, currently in ${mode} mode. You and I have had ${interactionCount} interactions this session.`,
        action: 'speak',
      };
    },
  },

  // ── Wake Word Toggle ────────────────────────────────────────────────

  {
    id: 'enable_wake_word',
    trigger: /^(?:enable|activate|turn on) wake (?:word|detection)$/i,
    description: 'Enable wake word detection',
    category: 'assistant',
    examples: ["Enable wake word"],
    handler: () => {
      if (!wakeWordEngine.active) {
        wakeWordEngine.start();
        return { handled: true, response: 'Wake word detection enabled. Say "Hey Jarvis" to activate me.', action: 'speak' };
      }
      return { handled: true, response: 'Wake word detection is already active.', action: 'speak' };
    },
  },

  {
    id: 'disable_wake_word',
    trigger: /^(?:disable|deactivate|turn off) wake (?:word|detection)$/i,
    description: 'Disable wake word detection',
    category: 'assistant',
    examples: ["Disable wake word"],
    handler: () => {
      if (wakeWordEngine.active) {
        wakeWordEngine.stop();
        return { handled: true, response: 'Wake word detection disabled.', action: 'speak' };
      }
      return { handled: true, response: 'Wake word detection was not active.', action: 'speak' };
    },
  },
];

// ─────────────────────────────────────────
// REGISTRATION
// ─────────────────────────────────────────

let registered = false;

export function registerBuiltinCommands(): void {
  if (registered) return;
  commandRegistry.registerAll(BUILTIN_COMMANDS);
  registered = true;

  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[CommandRegistry] Registered ${BUILTIN_COMMANDS.length} built-in commands:`,
      BUILTIN_COMMANDS.map((c) => c.id).join(', '),
    );
  }
}

export { BUILTIN_COMMANDS };
