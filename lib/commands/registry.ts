// lib/commands/registry.ts
// Jarvis OS Command Registry.
// Commands are natural-language-triggered actions distinct from AI tool calls.
// Commands have: trigger phrases, aliases, categories, permissions, handlers.
//
// Pipeline routing:
//   User input → CommandParser → CommandRegistry.tryExecute()
//   If matched → run handler, return response (no AI needed)
//   If not matched → fall through to AI pipeline

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export type CommandCategory =
  | 'system'       // OS-level: sleep, wake, restart
  | 'navigation'   // Open apps, websites, files
  | 'memory'       // Remember, recall, forget
  | 'assistant'    // Mode changes, settings
  | 'search'       // Web search, local search
  | 'utility'      // Time, weather, calculations
  | 'automation'   // Macros, shortcuts
  | 'custom';      // User-defined

export type CommandPermission =
  | 'none'         // No special permission required
  | 'microphone'   // Needs mic access
  | 'filesystem'   // Needs file system (Electron only)
  | 'system'       // Needs OS-level access (Electron only)
  | 'network';     // Needs network access

export interface CommandContext {
  rawInput: string;
  matches: RegExpMatchArray | null;
  params: Record<string, string>;
  isVoice: boolean;
}

export interface CommandResult {
  handled: boolean;
  response?: string;
  error?: string;
  action?: 'speak' | 'notify' | 'silent';
}

export interface CommandDefinition {
  /** Unique identifier */
  id: string;
  /** Primary trigger phrase (can include regex groups) */
  trigger: string | RegExp;
  /** Alternate trigger phrases */
  aliases?: Array<string | RegExp>;
  /** Human-readable description */
  description: string;
  /** Command category */
  category: CommandCategory;
  /** Required permissions */
  permissions?: CommandPermission[];
  /** Whether command only works in Electron */
  electronOnly?: boolean;
  /** The handler function */
  handler: (context: CommandContext) => Promise<CommandResult> | CommandResult;
  /** Example usages for help/autocomplete */
  examples?: string[];
}

// ─────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────

class CommandRegistry {
  private commands = new Map<string, CommandDefinition>();

  // ── Registration ──────────────────────────────────────────────────

  register(command: CommandDefinition): void {
    this.validate(command);
    this.commands.set(command.id, command);
  }

  registerAll(commands: CommandDefinition[]): void {
    commands.forEach((c) => this.register(c));
  }

  unregister(id: string): void {
    this.commands.delete(id);
  }

  has(id: string): boolean {
    return this.commands.has(id);
  }

  getAll(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  getByCategory(category: CommandCategory): CommandDefinition[] {
    return this.getAll().filter((c) => c.category === category);
  }

  // ── Execution ─────────────────────────────────────────────────────

  /**
   * Try to match input against all registered commands.
   * Returns the first match result, or { handled: false } if no match.
   */
  async tryExecute(
    input: string,
    options: { isVoice?: boolean; isElectron?: boolean } = {},
  ): Promise<CommandResult> {
    const normalized = input.trim().toLowerCase();
    const { isVoice = false, isElectron = false } = options;

    for (const command of this.commands.values()) {
      // Skip Electron-only commands in web mode
      if (command.electronOnly && !isElectron) continue;

      const match = this.matchTrigger(normalized, command);
      if (!match) continue;

      // Check permissions
      const permCheck = await this.checkPermissions(command.permissions ?? []);
      if (!permCheck.granted) {
        return {
          handled: true,
          response: permCheck.message,
          action: 'speak',
        };
      }

      // Extract named params from regex groups
      const params = this.extractParams(normalized, command, match);

      try {
        const result = await command.handler({
          rawInput: input,
          matches: match instanceof RegExp ? null : null,
          params,
          isVoice,
        });
        return result;
      } catch (err: unknown) {
        return {
          handled: true,
          error: err instanceof Error ? err.message : 'Command failed',
          response: 'Sorry, that command failed. Please try again.',
          action: 'speak',
        };
      }
    }

    return { handled: false };
  }

  // ── Matching ──────────────────────────────────────────────────────

  private matchTrigger(
    input: string,
    command: CommandDefinition,
  ): RegExpMatchArray | boolean | null {
    const triggers = [command.trigger, ...(command.aliases ?? [])];

    for (const trigger of triggers) {
      if (typeof trigger === 'string') {
        if (input.includes(trigger.toLowerCase())) return true;
      } else {
        const m = input.match(trigger);
        if (m) return m;
      }
    }
    return null;
  }

  private extractParams(
    input: string,
    command: CommandDefinition,
    _match: RegExpMatchArray | boolean | null,
  ): Record<string, string> {
    const params: Record<string, string> = { input };

    if (command.trigger instanceof RegExp) {
      const m = input.match(command.trigger);
      if (m?.groups) {
        Object.assign(params, m.groups);
      }
    }

    return params;
  }

  private async checkPermissions(
    permissions: CommandPermission[],
  ): Promise<{ granted: boolean; message?: string }> {
    for (const perm of permissions) {
      if (perm === 'microphone') {
        if (typeof navigator?.permissions !== 'undefined') {
          const result = await navigator.permissions
            .query({ name: 'microphone' as PermissionName })
            .catch(() => null);
          if (result?.state === 'denied') {
            return { granted: false, message: 'Microphone permission is required for this command.' };
          }
        }
      }
    }
    return { granted: true };
  }

  private validate(command: CommandDefinition): void {
    if (!command.id) throw new Error('Command must have an id');
    if (!command.trigger) throw new Error(`Command "${command.id}" must have a trigger`);
    if (typeof command.handler !== 'function') throw new Error(`Command "${command.id}" must have a handler`);
  }

  get size(): number { return this.commands.size; }
}

export const commandRegistry = new CommandRegistry();
