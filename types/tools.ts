// types/tools.ts
// Tool / function-calling types for the Jarvis AI pipeline.
// Modelled on the OpenAI tool_call schema — compatible with Anthropic tool_use too.

// ─────────────────────────────────────────
// TOOL DEFINITIONS (declared by the system)
// ─────────────────────────────────────────

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolDefinition {
  /** Unique machine-readable name, e.g. "open_application" */
  name: string;
  /** Human-readable description shown to the AI */
  description: string;
  /** JSON Schema for the tool's input parameters */
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
  /** Whether this tool requires Electron (desktop-only) */
  requiresElectron?: boolean;
  /** Category for grouping in the UI */
  category?: 'system' | 'browser' | 'file' | 'communication' | 'memory' | 'custom';
}

// ─────────────────────────────────────────
// TOOL CALLS (issued by the AI)
// ─────────────────────────────────────────

export interface ToolCall {
  id: string;
  name: string;
  /** Parsed arguments object */
  arguments: Record<string, unknown>;
  /** Raw JSON string from the AI */
  rawArguments: string;
}

// ─────────────────────────────────────────
// TOOL RESULTS (returned to the AI)
// ─────────────────────────────────────────

export type ToolResultStatus = 'success' | 'error' | 'pending' | 'cancelled';

export interface ToolResult {
  toolCallId: string;
  toolName: string;
  status: ToolResultStatus;
  /** Stringified result returned to the AI context */
  output: string;
  /** Structured data for UI rendering (not sent to AI) */
  data?: unknown;
  /** Error message if status is 'error' */
  error?: string;
  /** Execution time in ms */
  executionMs?: number;
}

// ─────────────────────────────────────────
// TOOL REGISTRY
// ─────────────────────────────────────────

export interface RegisteredTool extends ToolDefinition {
  /** The actual execution function — called by the pipeline */
  execute: (args: Record<string, unknown>) => Promise<ToolResult['output']>;
}
