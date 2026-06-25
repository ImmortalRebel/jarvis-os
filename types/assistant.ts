// types/assistant.ts
// Central type definitions for the Jarvis OS assistant system.
// Pure TypeScript — no runtime dependencies, safe to import anywhere.

// ─────────────────────────────────────────
// ASSISTANT MODES
// ─────────────────────────────────────────

export type AssistantMode =
  | 'idle'       // Default — awake, passively ready
  | 'listening'  // Actively recording user speech
  | 'processing' // STT → LLM pipeline running
  | 'thinking'   // Extended reasoning / tool-use loop
  | 'speaking'   // TTS playback in progress
  | 'sleeping'   // Low-power background mode (wake-word only)
  | 'wake'       // Wake word just detected (brief transition state)
  | 'error';     // Error state — requires user action

// ─────────────────────────────────────────
// VOICE STATE
// ─────────────────────────────────────────

export type VoiceState =
  | 'inactive'   // No audio activity
  | 'detecting'  // Wake word detection running
  | 'recording'  // Microphone capturing user input
  | 'processing' // STT model running
  | 'playing'    // TTS output playing
  | 'muted';     // User has muted the microphone

// ─────────────────────────────────────────
// MODE METADATA
// ─────────────────────────────────────────

export interface AssistantModeConfig {
  label: string;
  /** Whether microphone should be active */
  micActive: boolean;
  /** Whether to show voice visualizer */
  showVisualizer: boolean;
  /** Animation variant key */
  animationKey: string;
  /** CSS color token for the mode indicator */
  colorToken: string;
}

export const ASSISTANT_MODE_CONFIG: Record<AssistantMode, AssistantModeConfig> = {
  idle:       { label: 'Ready',        micActive: false, showVisualizer: false, animationKey: 'idle',       colorToken: 'muted-foreground' },
  sleeping:   { label: 'Sleeping',     micActive: false, showVisualizer: false, animationKey: 'sleep',      colorToken: 'muted-foreground' },
  wake:       { label: 'Waking…',      micActive: false, showVisualizer: false, animationKey: 'wake',       colorToken: 'yellow-300'       },
  listening:  { label: 'Listening…',   micActive: true,  showVisualizer: true,  animationKey: 'listening',  colorToken: 'cyan-400'         },
  processing: { label: 'Processing…',  micActive: false, showVisualizer: false, animationKey: 'processing', colorToken: 'blue-400'         },
  thinking:   { label: 'Thinking…',    micActive: false, showVisualizer: false, animationKey: 'thinking',   colorToken: 'purple-400'       },
  speaking:   { label: 'Speaking…',    micActive: false, showVisualizer: true,  animationKey: 'speaking',   colorToken: 'emerald-400'      },
  error:      { label: 'Error',        micActive: false, showVisualizer: false, animationKey: 'error',      colorToken: 'red-400'          },
};

// ─────────────────────────────────────────
// VALID MODE TRANSITIONS
// State machine — which modes can follow which
// ─────────────────────────────────────────

export const VALID_TRANSITIONS: Record<AssistantMode, AssistantMode[]> = {
  idle:       ['listening', 'sleeping', 'wake', 'error'],
  sleeping:   ['wake', 'idle'],
  wake:       ['listening', 'idle'],
  listening:  ['processing', 'idle', 'error'],
  processing: ['thinking', 'speaking', 'idle', 'error'],
  thinking:   ['processing', 'speaking', 'idle', 'error'],
  speaking:   ['idle', 'listening', 'error'],
  error:      ['idle', 'sleeping'],
};

// ─────────────────────────────────────────
// WAKE WORD CONFIG
// ─────────────────────────────────────────

export interface WakeWordConfig {
  phrase: string;
  threshold: number;
  engine: 'porcupine' | 'picovoice' | 'custom' | 'browser';
  enabled: boolean;
}

// ─────────────────────────────────────────
// CONVERSATION
// ─────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  audioDuration?: number;
  isVoice?: boolean;
  toolCallId?: string;
  toolName?: string;
  isStreaming?: boolean;
}

// ─────────────────────────────────────────
// AI PIPELINE CONFIGURATION
// ─────────────────────────────────────────

export type AIProvider = 'openai' | 'anthropic' | 'ollama' | 'local' | 'custom';
export type TTSProvider = 'elevenlabs' | 'openai' | 'browser' | 'local';
export type STTProvider = 'whisper' | 'browser' | 'deepgram' | 'local';

export interface AIConfig {
  provider: AIProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  streamingEnabled: boolean;
}

export interface TTSConfig {
  provider: TTSProvider;
  voiceId: string;
  speed: number;
  pitch: number;
  volume: number;
}

export interface STTConfig {
  provider: STTProvider;
  language: string;
  silenceThreshold: number;
  maxDuration: number;
}

// ─────────────────────────────────────────
// MEMORY
// ─────────────────────────────────────────

export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'working';

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
  createdAt: number;
  accessedAt: number;
  importance: number;
  accessCount: number;
}

// ─────────────────────────────────────────
// SYSTEM PERMISSIONS
// ─────────────────────────────────────────

export interface SystemPermissions {
  microphone: PermissionState | 'unknown';
  notifications: PermissionState | 'unknown';
  filesystem?: boolean;
  systemTray?: boolean;
}
