// lib/tools/registry.ts
// Jarvis OS Tool Registry.
// Central store for all tools (functions) that the AI assistant can invoke.
// Compatible with OpenAI function-calling and Anthropic tool_use schemas.
//
// Usage:
//   toolRegistry.register(myTool)
//   const tools = toolRegistry.getOpenAITools()  // pass to OpenAI API
//   const result = await toolRegistry.execute('tool_name', args)

import type { RegisteredTool, ToolDefinition } from '@/types/tools';

// ─────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────

class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();

  // ── Registration ──────────────────────────────────────────────────────

  /**
   * Register a tool. Overwrites if already exists.
   */
  register(tool: RegisteredTool): void {
    this.validateTool(tool);
    this.tools.set(tool.name, tool);

    if (process.env.NODE_ENV === 'development') {
      console.debug(`[ToolRegistry] Registered: ${tool.name} (${tool.category ?? 'custom'})`);
    }
  }

  /**
   * Register multiple tools at once.
   */
  registerAll(tools: RegisteredTool[]): void {
    tools.forEach((t) => this.register(t));
  }

  /**
   * Unregister a tool by name.
   */
  unregister(name: string): void {
    this.tools.delete(name);
  }

  // ── Lookup ────────────────────────────────────────────────────────────

  has(name: string): boolean {
    return this.tools.has(name);
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  getAll(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  getByCategory(category: ToolDefinition['category']): RegisteredTool[] {
    return this.getAll().filter((t) => t.category === category);
  }

  /**
   * Returns tools that are available in the current environment.
   * Electron-only tools are filtered out in web mode.
   */
  getAvailable(isElectron = false): RegisteredTool[] {
    return this.getAll().filter((t) => !t.requiresElectron || isElectron);
  }

  // ── Schema Formatters ─────────────────────────────────────────────────

  /**
   * Returns tool definitions in OpenAI function-calling format.
   * Pass directly to the `tools` parameter of openai.chat.completions.create().
   */
  getOpenAITools(isElectron = false): object[] {
    return this.getAvailable(isElectron).map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  /**
   * Returns tool definitions in Anthropic tool_use format.
   */
  getAnthropicTools(isElectron = false): object[] {
    return this.getAvailable(isElectron).map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }

  // ── Validation ────────────────────────────────────────────────────────

  private validateTool(tool: RegisteredTool): void {
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('[ToolRegistry] Tool must have a string name');
    }
    if (!/^[a-z_][a-z0-9_]*$/.test(tool.name)) {
      throw new Error(`[ToolRegistry] Tool name must be snake_case: "${tool.name}"`);
    }
    if (!tool.description) {
      throw new Error(`[ToolRegistry] Tool "${tool.name}" must have a description`);
    }
    if (typeof tool.execute !== 'function') {
      throw new Error(`[ToolRegistry] Tool "${tool.name}" must have an execute function`);
    }
  }

  get size(): number {
    return this.tools.size;
  }
}

// ─────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────

export const toolRegistry = new ToolRegistry();
