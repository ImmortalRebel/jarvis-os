'use client';
// store/useVoiceStore.ts
// Voice pipeline state — audio analysis, recording sessions, TTS queue, device info.
// Intentionally NOT persisted — all state here is transient runtime data.
// High-frequency updates (waveform/frequency) use replace=true to avoid React batching overhead.

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { VoiceState } from '@/types/assistant';
import type { AudioAnalysis, RecordingSession, TTSQueueItem } from '@/types/voice';

// ─────────────────────────────────────────
// STATE INTERFACE
// ─────────────────────────────────────────

export interface VoiceStoreState {
  // ── Pipeline state ───────────────────────
  voiceState: VoiceState;

  // ── Audio analysis (high-frequency updates) ─
  audioAnalysis: AudioAnalysis;
  waveformData: number[];
  frequencyData: number[];

  // ── Recording session management ──────────
  activeSession: RecordingSession | null;
  sessionHistory: RecordingSession[];

  // ── TTS queue ────────────────────────────
  ttsQueue: TTSQueueItem[];
  currentTTSItem: TTSQueueItem | null;

  // ── Device state ─────────────────────────
  inputDeviceId: string | null;
  outputDeviceId: string | null;
  isMicPermissionGranted: boolean | null;

  // ── Actions: State ────────────────────────
  setVoiceState: (voiceState: VoiceState) => void;

  // ── Actions: Audio analysis ───────────────
  updateAudioAnalysis: (analysis: Partial<AudioAnalysis>) => void;
  /** High-frequency: call at ~60fps. Uses replace to skip deep merge. */
  updateWaveform: (data: number[]) => void;
  /** High-frequency: call at ~60fps. Uses replace to skip deep merge. */
  updateFrequency: (data: number[]) => void;

  // ── Actions: Recording ────────────────────
  startRecordingSession: () => string;
  endRecordingSession: (id: string, result: Partial<RecordingSession>) => void;

  // ── Actions: TTS queue ────────────────────
  enqueueTTS: (text: string, priority?: TTSQueueItem['priority']) => string;
  dequeueTTS: () => TTSQueueItem | null;
  completeTTSItem: () => void;
  clearTTSQueue: () => void;

  // ── Actions: Devices ──────────────────────
  setInputDevice: (deviceId: string) => void;
  setOutputDevice: (deviceId: string) => void;
  setMicPermission: (granted: boolean | null) => void;

  // ── Reset ─────────────────────────────────
  reset: () => void;
}

// ─────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────

const INITIAL_AUDIO_ANALYSIS: AudioAnalysis = {
  rms: 0,
  peak: 0,
  frequencies: null,
  isSpeaking: false,
};

const MAX_SESSION_HISTORY = 50;

let _ttsCounter = 0;
function generateTTSId(): string {
  return `tts_${Date.now()}_${++_ttsCounter}`;
}

let _sessionCounter = 0;
function generateSessionId(): string {
  return `rec_${Date.now()}_${++_sessionCounter}`;
}

const PRIORITY_ORDER: Record<TTSQueueItem['priority'], number> = {
  high: 0,
  normal: 1,
  low: 2,
};

// ─────────────────────────────────────────
// STORE
// ─────────────────────────────────────────

export const useVoiceStore = create<VoiceStoreState>()(
  devtools(
    (set, get) => ({
      // ── Initial state ────────────────────
      voiceState: 'inactive',
      audioAnalysis: INITIAL_AUDIO_ANALYSIS,
      waveformData: [],
      frequencyData: [],
      activeSession: null,
      sessionHistory: [],
      ttsQueue: [],
      currentTTSItem: null,
      inputDeviceId: null,
      outputDeviceId: null,
      isMicPermissionGranted: null,

      // ── Voice state ──────────────────────

      setVoiceState: (voiceState) => {
        set({ voiceState }, false, 'voice/setVoiceState');
      },

      // ── Audio analysis ───────────────────

      updateAudioAnalysis: (analysis) => {
        set(
          (state) => ({ audioAnalysis: { ...state.audioAnalysis, ...analysis } }),
          false,
          'voice/updateAudioAnalysis',
        );
      },

      // High-frequency updates use shallow replace (second arg = true in Zustand v4 / false with replace)
      // In Zustand v5, set(updater, replace, actionName) — replace=false merges, replace=true replaces
      updateWaveform: (waveformData) => {
        set({ waveformData }, false, 'voice/updateWaveform');
      },

      updateFrequency: (frequencyData) => {
        set({ frequencyData }, false, 'voice/updateFrequency');
      },

      // ── Recording sessions ───────────────

      startRecordingSession: () => {
        const id = generateSessionId();
        const session: RecordingSession = { id, startedAt: Date.now() };
        set({ activeSession: session }, false, 'voice/startRecordingSession');
        return id;
      },

      endRecordingSession: (id, result) => {
        const { activeSession, sessionHistory } = get();
        if (!activeSession || activeSession.id !== id) return;
        const completed: RecordingSession = {
          ...activeSession,
          ...result,
          endedAt: Date.now(),
        };
        set(
          {
            activeSession: null,
            sessionHistory: [completed, ...sessionHistory].slice(0, MAX_SESSION_HISTORY),
          },
          false,
          'voice/endRecordingSession',
        );
      },

      // ── TTS queue ────────────────────────

      enqueueTTS: (text, priority = 'normal') => {
        const id = generateTTSId();
        const item: TTSQueueItem = { id, text, priority, createdAt: Date.now() };
        set(
          (state) => ({
            ttsQueue: [...state.ttsQueue, item].sort(
              (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
            ),
          }),
          false,
          'voice/enqueueTTS',
        );
        return id;
      },

      dequeueTTS: () => {
        const { ttsQueue } = get();
        if (ttsQueue.length === 0) return null;
        const [next, ...rest] = ttsQueue;
        set({ ttsQueue: rest, currentTTSItem: next }, false, 'voice/dequeueTTS');
        return next;
      },

      completeTTSItem: () => {
        set({ currentTTSItem: null }, false, 'voice/completeTTSItem');
      },

      clearTTSQueue: () => {
        set({ ttsQueue: [], currentTTSItem: null }, false, 'voice/clearTTSQueue');
      },

      // ── Devices ──────────────────────────

      setInputDevice: (inputDeviceId) => {
        set({ inputDeviceId }, false, 'voice/setInputDevice');
      },

      setOutputDevice: (outputDeviceId) => {
        set({ outputDeviceId }, false, 'voice/setOutputDevice');
      },

      setMicPermission: (isMicPermissionGranted) => {
        set({ isMicPermissionGranted }, false, 'voice/setMicPermission');
      },

      // ── Reset ────────────────────────────

      reset: () => {
        set(
          {
            voiceState: 'inactive',
            audioAnalysis: INITIAL_AUDIO_ANALYSIS,
            activeSession: null,
            ttsQueue: [],
            currentTTSItem: null,
            waveformData: [],
            frequencyData: [],
          },
          false,
          'voice/reset',
        );
      },
    }),
    {
      name: 'JarvisVoiceStore',
      enabled: process.env.NODE_ENV === 'development',
    },
  ),
);
