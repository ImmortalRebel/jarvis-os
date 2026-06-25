// lib/pipeline/executor.ts
// Complete assistant execution pipeline for Jarvis OS.
//
// Full flow:
//   Wake Word → Listening → STT → Processing → AI Response
//   → Action Execution → Speaking → Idle
//
// This module wraps lib/pipeline/index.ts with:
//   - Full state machine synchronization
//   - STT integration
//   - TTS integration
//   - Command system routing
//   - Memory extraction on each turn
//   - Cancellation at any stage
//   - Error recovery

import { transitionMode, resetToIdle } from '@/lib/assistant/modes';
import { pipeline } from '@/lib/pipeline';
import { stt } from '@/lib/voice/stt';
import { tts } from '@/lib/voice/tts';
import { microphone } from '@/lib/voice/microphone';
import { memoryService } from '@/lib/memory/service';
import { commandRegistry } from '@/lib/commands/registry';
import { useAssistantStore } from '@/store/useAssistantStore';
import { useVoiceStore } from '@/store/useVoiceStore';
import { useUIStore } from '@/store/useUIStore';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export type ExecutionStage =
  | 'idle'
  | 'listening'    // Microphone open, waiting for speech
  | 'transcribing' // STT converting audio to text
  | 'routing'      // Deciding: command or AI?
  | 'processing'   // AI pipeline running
  | 'executing'    // Running a command/tool
  | 'speaking'     // TTS playing response
  | 'error';

export interface ExecutionOptions {
  /** Pre-supplied text — skips STT stage */
  text?: string;
  /** Whether to speak the response */
  speakResponse?: boolean;
  /** Whether this is a voice interaction */
  isVoice?: boolean;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

export interface ExecutionResult {
  stage: ExecutionStage;
  transcript?: string;
  response?: string;
  commandExecuted?: boolean;
  success: boolean;
  error?: string;
  durationMs: number;
}

// ─────────────────────────────────────────
// EXECUTOR
// ─────────────────────────────────────────

class PipelineExecutor {
  private currentController: AbortController | null = null;
  private currentStage: ExecutionStage = 'idle';

  get stage(): ExecutionStage { return this.currentStage; }
  get isRunning(): boolean { return this.currentStage !== 'idle' && this.currentStage !== 'error'; }

  // ── Main execution entry point ──────────────────────────────────────

  /**
   * Execute a full assistant interaction.
   * If no text is provided, opens the microphone and runs STT first.
   */
  async execute(options: ExecutionOptions = {}): Promise<ExecutionResult> {
    const startTime = Date.now();
    const { text, speakResponse = true, isVoice = !text, signal: extSignal } = options;

    // Cancel any in-progress execution
    this.cancel();
    const controller = new AbortController();
    this.currentController = controller;
    if (extSignal) extSignal.addEventListener('abort', () => controller.abort());

    try {
      // ── Stage 1: Listening / STT ──────────────────────────────────────
      let transcript = text ?? '';

      if (!text) {
        transcript = await this.runSTTStage(controller.signal);
        if (!transcript.trim()) {
          resetToIdle();
          return { stage: 'idle', success: true, durationMs: Date.now() - startTime };
        }
      }

      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');

      // ── Stage 2: Command routing ──────────────────────────────────────
      this.setStage('routing');
      const commandResult = await commandRegistry.tryExecute(transcript);

      if (commandResult.handled) {
        // Command was handled — speak response and return
        if (speakResponse && commandResult.response) {
          await this.runTTSStage(commandResult.response, controller.signal);
        }
        resetToIdle();
        return {
          stage: 'idle',
          transcript,
          response: commandResult.response,
          commandExecuted: true,
          success: true,
          durationMs: Date.now() - startTime,
        };
      }

      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');

      // ── Stage 3: AI pipeline ──────────────────────────────────────────
      this.setStage('processing');
      transitionMode('processing', { force: true });

      const result = await pipeline.run({
        text: transcript,
        isVoice,
        signal: controller.signal,
      });

      if (!result.success) {
        throw new Error(result.error ?? 'Pipeline failed');
      }

      const response = result.response ?? '';

      // ── Stage 4: TTS ──────────────────────────────────────────────────
      if (speakResponse && isVoice && response) {
        await this.runTTSStage(response, controller.signal);
      }

      // ── Stage 5: Memory extraction ────────────────────────────────────
      if (transcript && response) {
        memoryService.extractFromTurn(transcript, response);
      }

      resetToIdle();

      return {
        stage: 'idle',
        transcript,
        response,
        commandExecuted: false,
        success: true,
        durationMs: Date.now() - startTime,
      };

    } catch (err: unknown) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      const message = err instanceof Error ? err.message : String(err);

      if (!isAbort) {
        this.setStage('error');
        transitionMode('error', { force: true });
        useUIStore.getState().notify({
          type: 'error',
          title: 'Jarvis Error',
          message,
          duration: 5000,
        });
        // Auto-recover after 4s
        setTimeout(() => {
          if (this.currentStage === 'error') resetToIdle();
        }, 4000);
      } else {
        resetToIdle();
      }

      return {
        stage: isAbort ? 'idle' : 'error',
        success: false,
        error: message,
        durationMs: Date.now() - startTime,
      };

    } finally {
      this.currentController = null;
    }
  }

  // ── STT Stage ────────────────────────────────────────────────────────

  private async runSTTStage(signal: AbortSignal): Promise<string> {
    this.setStage('listening');
    transitionMode('listening', { force: true });

    // Start mic capture for audio analysis / visualizer
    if (!microphone.active) {
      await microphone.start().catch(() => {
        // Mic unavailable — fall through to browser STT anyway
      });
    }

    this.setStage('transcribing');

    try {
      const result = await stt.transcribe({
        signal,
        onInterim: (text) => {
          useAssistantStore.getState().setCurrentTranscript(text);
        },
        onFinal: (r) => {
          useAssistantStore.getState().setCurrentTranscript(r.transcript);
        },
      });
      return result.transcript.trim();
    } finally {
      microphone.stop();
    }
  }

  // ── TTS Stage ────────────────────────────────────────────────────────

  private async runTTSStage(text: string, signal: AbortSignal): Promise<void> {
    this.setStage('speaking');
    await tts.speak(text, signal).catch(() => {
      // TTS failure is non-fatal — continue to idle
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private setStage(stage: ExecutionStage): void {
    this.currentStage = stage;
  }

  cancel(): void {
    if (this.currentController) {
      this.currentController.abort();
      this.currentController = null;
    }
    stt.stop();
    tts.stop();
    microphone.stop();
    this.setStage('idle');
  }
}

export const executor = new PipelineExecutor();
