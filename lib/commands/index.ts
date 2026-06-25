// lib/commands/index.ts
export { commandRegistry } from './registry';
export type { CommandDefinition, CommandCategory, CommandPermission, CommandContext, CommandResult } from './registry';
export { commandParser } from './parser';
export type { ParsedCommand, ParsedIntent } from './parser';
export { registerBuiltinCommands } from './handlers';
