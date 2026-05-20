// types/speech-recognition.d.ts
// Global Web Speech API type declarations for TypeScript 5.7.3
//
// WHY THIS FILE EXISTS:
// TypeScript's built-in lib.dom.d.ts does not fully declare the Web Speech API
// globals (SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent)
// in all project configurations. This file declares them globally so that
// useVoiceInput.ts and useWakeWord.ts can reference them without TS2304 errors.
//
// This file is automatically picked up by TypeScript because it is inside the
// `types/` directory which is included via tsconfig "include": ["**/*.ts"].
// No imports needed anywhere — these become globally available.

// ─────────────────────────────────────────────────────────────────────────────
// CORE INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

declare var SpeechRecognitionEvent: {
  prototype: SpeechRecognitionEvent;
  new (): SpeechRecognitionEvent;
};

type SpeechRecognitionErrorCode =
  | 'aborted'
  | 'audio-capture'
  | 'bad-grammar'
  | 'language-not-supported'
  | 'network'
  | 'no-speech'
  | 'not-allowed'
  | 'service-not-allowed';

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: SpeechRecognitionErrorCode;
  readonly message: string;
}

declare var SpeechRecognitionErrorEvent: {
  prototype: SpeechRecognitionErrorEvent;
  new (): SpeechRecognitionErrorEvent;
};

// ─────────────────────────────────────────────────────────────────────────────
// SPEECH RECOGNITION CLASS
// ─────────────────────────────────────────────────────────────────────────────

interface SpeechRecognition extends EventTarget {
  // Configuration
  continuous: boolean;
  grammars: SpeechGrammarList;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;

  // Control
  start(): void;
  stop(): void;
  abort(): void;

  // Event handlers
  onaudioend:   ((this: SpeechRecognition, ev: Event) => void) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend:        ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror:      ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onnomatch:    ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onresult:     ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onsoundend:   ((this: SpeechRecognition, ev: Event) => void) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechend:  ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechstart:((this: SpeechRecognition, ev: Event) => void) | null;
  onstart:      ((this: SpeechRecognition, ev: Event) => void) | null;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};

// ─────────────────────────────────────────────────────────────────────────────
// SPEECH GRAMMAR (needed to avoid missing dependency errors)
// ─────────────────────────────────────────────────────────────────────────────

interface SpeechGrammar {
  src: string;
  weight: number;
}

interface SpeechGrammarList {
  readonly length: number;
  addFromString(string: string, weight?: number): void;
  addFromURI(src: string, weight?: number): void;
  item(index: number): SpeechGrammar;
  [index: number]: SpeechGrammar;
}

declare var SpeechGrammarList: {
  prototype: SpeechGrammarList;
  new (): SpeechGrammarList;
};

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW AUGMENTATION
// Adds webkitSpeechRecognition + webkitSpeechGrammarList to the Window type.
// Required because Chrome/Edge still ship the webkit-prefixed version.
// ─────────────────────────────────────────────────────────────────────────────

interface Window {
  SpeechRecognition: typeof SpeechRecognition;
  webkitSpeechRecognition: typeof SpeechRecognition;
  SpeechGrammarList: typeof SpeechGrammarList;
  webkitSpeechGrammarList: typeof SpeechGrammarList;
  SpeechRecognitionEvent: typeof SpeechRecognitionEvent;
}
