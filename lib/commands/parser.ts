// lib/commands/parser.ts
// Natural language parser for command routing.
// Extracts command intent and entities from user input before registry lookup.
// Runs client-side, zero cost, no API call required.

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export type ParsedIntent =
  | 'open_app'
  | 'open_url'
  | 'search'
  | 'set_reminder'
  | 'set_alarm'
  | 'get_time'
  | 'get_date'
  | 'get_weather'
  | 'control_assistant'
  | 'control_system'
  | 'memory_recall'
  | 'memory_store'
  | 'play_media'
  | 'calculate'
  | 'translate'
  | 'unknown';

export interface ParsedCommand {
  intent: ParsedIntent;
  confidence: number;     // 0–1
  entities: Record<string, string>;
  normalized: string;
  isCommand: boolean;     // true if high-confidence command match
}

// ─────────────────────────────────────────
// INTENT PATTERNS
// ─────────────────────────────────────────

interface IntentPattern {
  intent: ParsedIntent;
  patterns: RegExp[];
  entityExtractors?: Record<string, RegExp>;
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: 'open_app',
    patterns: [
      /^open\s+(.+)/i,
      /^launch\s+(.+)/i,
      /^start\s+(.+)/i,
      /^run\s+(.+)/i,
    ],
    entityExtractors: { app: /^(?:open|launch|start|run)\s+(.+)/i },
  },
  {
    intent: 'open_url',
    patterns: [
      /^(?:go to|navigate to|open|visit)\s+(https?:\/\/\S+|(?:www\.)?\S+\.\S{2,})/i,
      /^(?:go to|open)\s+(\S+\.(?:com|org|net|io|dev|ai|co|app))/i,
    ],
    entityExtractors: { url: /(?:go to|navigate to|open|visit)\s+(\S+)/i },
  },
  {
    intent: 'search',
    patterns: [
      /^search (?:for |the web for )?(.+)/i,
      /^(?:google|bing|look up)\s+(.+)/i,
      /^find (?:me )?(.+) online/i,
    ],
    entityExtractors: { query: /^(?:search for?|search|google|bing|look up)\s+(.+)/i },
  },
  {
    intent: 'get_time',
    patterns: [
      /^what(?:'s| is) the (?:current )?time/i,
      /^what time is it/i,
      /^(?:tell me the |give me the )?time(?:\s+now)?$/i,
    ],
  },
  {
    intent: 'get_date',
    patterns: [
      /^what(?:'s| is) (?:today's |the )?date/i,
      /^what day is (?:it|today)/i,
      /^(?:tell me |what is )?today(?:'s date)?$/i,
    ],
  },
  {
    intent: 'set_reminder',
    patterns: [
      /^remind me (?:to |about )?(.+?)(?:\s+(?:at|in|on)\s+(.+))?$/i,
      /^set (?:a )?reminder (?:to |for )?(.+)/i,
    ],
    entityExtractors: {
      task: /^remind me (?:to |about )?(.+?)(?:\s+(?:at|in|on)\s+.+)?$/i,
      time: /\s+(?:at|in|on)\s+(.+)$/i,
    },
  },
  {
    intent: 'set_alarm',
    patterns: [
      /^set (?:an )?alarm (?:for )?(\d{1,2}(?::\d{2})?(?:\s*[ap]m)?)/i,
      /^wake me (?:up )?at (\d{1,2}(?::\d{2})?(?:\s*[ap]m)?)/i,
    ],
    entityExtractors: { time: /(\d{1,2}(?::\d{2})?(?:\s*[ap]m)?)/i },
  },
  {
    intent: 'control_assistant',
    patterns: [
      /^(?:go to |enter )?sleep(?: mode)?$/i,
      /^wake up$/i,
      /^(?:be )?quiet(?:er)?$/i,
      /^stop(?: talking| listening)?$/i,
      /^(?:clear|reset|new) (?:conversation|chat|history)$/i,
      /^(?:mute|unmute)(?: yourself)?$/i,
    ],
    entityExtractors: {
      action: /^(\w+)/i,
    },
  },
  {
    intent: 'memory_recall',
    patterns: [
      /^(?:do you )?remember(?: when| what| that)?\s+(.+)/i,
      /^what (?:do you know about|did i say about|was|were)\s+(.+)/i,
      /^recall\s+(.+)/i,
    ],
    entityExtractors: { query: /^(?:remember|recall|what do you know about)\s+(.+)/i },
  },
  {
    intent: 'memory_store',
    patterns: [
      /^remember (?:that )?(.+)/i,
      /^(?:please )?(?:note|note down|make a note)(?: that)?\s+(.+)/i,
      /^don't forget (?:that )?(.+)/i,
    ],
    entityExtractors: { content: /^(?:remember(?: that)?|note(?: that)?|don't forget(?: that)?)\s+(.+)/i },
  },
  {
    intent: 'calculate',
    patterns: [
      /^(?:what(?:'s| is) )?(\d[\d\s+\-*/^()%.]*\d)(?:\s*=\s*\?|\s*\?)?$/i,
      /^(?:calculate|compute|work out|what is)\s+([\d\s+\-*/^()%.]+)/i,
    ],
    entityExtractors: { expression: /^(?:calculate|compute|work out|what is)?\s*([\d\s+\-*/^()%.]+)/i },
  },
];

// ─────────────────────────────────────────
// PARSER
// ─────────────────────────────────────────

class CommandParser {

  /**
   * Parse raw user input into a structured ParsedCommand.
   */
  parse(input: string): ParsedCommand {
    const normalized = input.trim().toLowerCase();

    for (const intentDef of INTENT_PATTERNS) {
      for (const pattern of intentDef.patterns) {
        if (pattern.test(normalized)) {
          const entities = this.extractEntities(normalized, input, intentDef);
          const confidence = this.scoreConfidence(normalized, pattern);

          return {
            intent: intentDef.intent,
            confidence,
            entities,
            normalized,
            isCommand: confidence >= 0.7,
          };
        }
      }
    }

    return {
      intent: 'unknown',
      confidence: 0,
      entities: { raw: input },
      normalized,
      isCommand: false,
    };
  }

  /**
   * Returns true if input looks like a command (not a free-form AI query).
   */
  isCommand(input: string): boolean {
    return this.parse(input).isCommand;
  }

  private extractEntities(
    normalized: string,
    original: string,
    intentDef: IntentPattern,
  ): Record<string, string> {
    const entities: Record<string, string> = { raw: original };

    if (!intentDef.entityExtractors) return entities;

    for (const [key, extractor] of Object.entries(intentDef.entityExtractors)) {
      const match = normalized.match(extractor) ?? original.match(extractor);
      if (match?.[1]) {
        entities[key] = match[1].trim();
      }
    }

    return entities;
  }

  private scoreConfidence(input: string, pattern: RegExp): number {
    const match = input.match(pattern);
    if (!match) return 0;

    // Longer specific matches = higher confidence
    const matchLength = match[0].length / input.length;
    const base = 0.75;
    return Math.min(1.0, base + matchLength * 0.25);
  }
}

export const commandParser = new CommandParser();
