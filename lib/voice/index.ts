// lib/voice/index.ts
export { microphone } from './microphone';
export type { MicrophoneConfig } from './microphone';
export { tts, BrowserTTSProvider } from './tts';
export type { TTSSpeakOptions, ITTSProvider } from './tts';
export { stt, BrowserSTTProvider, WhisperSTTProvider } from './stt';
export type { STTResult, STTOptions, ISTTProvider } from './stt';
export { wakeWordEngine } from './wakeword';
export type { WakeWordEvent, WakeWordCallback } from './wakeword';
export { voiceVisualizer } from './visualizer';
export type { VisualizerConfig } from './visualizer';
