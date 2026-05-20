// types/assistant.ts
// Central type definitions for the Jarvis OS assistant system.
// Pure TypeScript — no runtime dependencies, safe to import anywhere (server or client).

// ─────────────────────────────────────────
// ASSISTANT MODES
// ─────────────────────────────────────────

export type AssistantMode =
  | 'idle'       // Default state — passively ready
  | 'listening'  // Actively recording user speech
  | 'processing' // AI pipeline running (STT → LLM → TTS)
  | 'speaking'   // TTS playback in progress
  | 'error'      // Error state — shows error UI
  | 'wake'       // Wake word just detected (brief animation state)
  | 'thinking';  // Extended processing (long tasks, tool use, multi-step)

// ─────────────────────────────────────────
// VOICE STATE
// ─────────────────────────────────────────

export type VoiceState =
  | 'inactive'   // No audio activity
  | 'detecting'  // Wake word detection running in background
  | 'recording'  // Microphone capturing user input
  | 'processing' // STT model running
  | 'playing'    // TTS output playing back
  | 'muted';     // User has muted the microphone

// ─────────────────────────────────────────
// WAKE WORD CONFIG
// ─────────────────────────────────────────

export interface WakeWordConfig {
  /** The trigger phrase, e.g. "Hey Jarvis" */
  phrase: string;
  /** Detection confidence threshold 0–1 */
  threshold: number;
  /** Wake word engine backend */
  engine: 'porcupine' | 'picovoice' | 'custom' | 'browser';
  /** Whether wake word detection is currently active */
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
  /** Playback duration in ms for assistant voice messages */
  audioDuration?: number;
  /** Whether this message was delivered via voice */
  isVoice?: boolean;
  /** Tool call metadata for function-calling pipeline */
  toolCallId?: string;
  toolName?: string;
  /** Whether this message is still being streamed */
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
  /** Streaming response (token-by-token) enabled */
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
  /** Silence threshold in dB before auto-stop recording */
  silenceThreshold: number;
  /** Max recording duration in ms (safety cutoff) */
  maxDuration: number;
}

// ─────────────────────────────────────────
// MEMORY SYSTEM (foundation for future build-out)
// ─────────────────────────────────────────

export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'working';

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  /** Vector embedding for semantic search (populated async) */
  embedding?: number[];
  metadata: Record<string, unknown>;
  createdAt: number;
  accessedAt: number;
  /** Relevance/importance score 0–1 */
  importance: number;
  /** Number of times this memory was accessed */
  accessCount: number;
}

// ─────────────────────────────────────────
// SYSTEM PERMISSIONS
// ─────────────────────────────────────────

export interface SystemPermissions {
  microphone: PermissionState | 'unknown';
  notifications: PermissionState | 'unknown';
  /** Electron-only: local filesystem read access */
  filesystem?: boolean;
  /** Electron-only: system tray access */
  systemTray?: boolean;
}
