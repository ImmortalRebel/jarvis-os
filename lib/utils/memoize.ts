// lib/utils/memoize.ts
// Memoization utilities for Jarvis OS.
// All utilities are pure functions — no side effects, no imports.
//
// Included:
//   memoize()           — single-arg function memoization with WeakMap
//   memoizeN()          — multi-arg memoization with shallow comparison
//   createSelector()    — reselect-style selector factory
//   shallowEqual()      — shallow object comparison for store subscriptions
//   debounce()          — debounce with cancel/flush
//   throttle()          — leading-edge throttle
//   once()              — run a function only once

// ─────────────────────────────────────────
// SHALLOW EQUAL
// ─────────────────────────────────────────

/**
 * Shallow equality comparison.
 * Returns true if all own enumerable properties are strictly equal.
 * Used by Zustand subscription selectors to prevent extra renders.
 */
export function shallowEqual<T extends object>(a: T, b: T): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object') return a === b;
  if (a === null || b === null) return a === b;

  const keysA = Object.keys(a) as Array<keyof T>;
  const keysB = Object.keys(b) as Array<keyof T>;

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * Shallow equality for arrays.
 */
export function shallowEqualArray<T>(a: T[], b: T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ─────────────────────────────────────────
// MEMOIZE (single arg)
// ─────────────────────────────────────────

/**
 * Memoize a function that takes a single object/array argument.
 * Uses WeakMap — memoized results are automatically GC'd with the key.
 *
 * @example
 * const getMessages = memoizeWeak((state: AssistantState) => state.messages)
 */
export function memoizeWeak<TArg extends object, TResult>(
  fn: (arg: TArg) => TResult,
): (arg: TArg) => TResult {
  const cache = new WeakMap<TArg, TResult>();
  return (arg: TArg): TResult => {
    if (cache.has(arg)) return cache.get(arg) as TResult;
    const result = fn(arg);
    cache.set(arg, result);
    return result;
  };
}

/**
 * Memoize a function with a primitive key (string/number).
 * Uses a Map with optional max-size LRU eviction.
 *
 * @example
 * const getLabel = memoize((mode: string) => MODE_LABELS[mode], 50)
 */
export function memoize<TArg, TResult>(
  fn: (arg: TArg) => TResult,
  maxSize = 100,
): (arg: TArg) => TResult {
  const cache = new Map<TArg, TResult>();
  return (arg: TArg): TResult => {
    if (cache.has(arg)) return cache.get(arg) as TResult;
    const result = fn(arg);
    if (cache.size >= maxSize) {
      // Evict oldest entry
      cache.delete(cache.keys().next().value as TArg);
    }
    cache.set(arg, result);
    return result;
  };
}

// ─────────────────────────────────────────
// SELECTOR FACTORY (reselect-style)
// ─────────────────────────────────────────

/**
 * Create a memoized selector from one or more input selectors.
 * Result is recomputed only when inputs change (===).
 *
 * @example
 * const selectUserMessages = createSelector(
 *   (s: AssistantState) => s.messages,
 *   (messages) => messages.filter(m => m.role === 'user')
 * )
 */
export function createSelector<TState, TInput, TResult>(
  inputSelector: (state: TState) => TInput,
  resultFn: (input: TInput) => TResult,
): (state: TState) => TResult {
  let lastInput: TInput | typeof UNSET = UNSET;
  let lastResult: TResult;

  return (state: TState): TResult => {
    const input = inputSelector(state);
    if (lastInput !== UNSET && input === lastInput) return lastResult;
    lastInput = input;
    lastResult = resultFn(input);
    return lastResult;
  };
}

export function createSelector2<TState, TI1, TI2, TResult>(
  sel1: (s: TState) => TI1,
  sel2: (s: TState) => TI2,
  resultFn: (i1: TI1, i2: TI2) => TResult,
): (state: TState) => TResult {
  let last1: TI1 | typeof UNSET = UNSET;
  let last2: TI2 | typeof UNSET = UNSET;
  let lastResult: TResult;

  return (state: TState): TResult => {
    const i1 = sel1(state);
    const i2 = sel2(state);
    if (i1 === last1 && i2 === last2 && last1 !== UNSET) return lastResult;
    last1 = i1;
    last2 = i2;
    lastResult = resultFn(i1, i2);
    return lastResult;
  };
}

const UNSET = Symbol('UNSET');

// ─────────────────────────────────────────
// DEBOUNCE
// ─────────────────────────────────────────

export interface DebouncedFn<T extends (...args: unknown[]) => void> {
  (...args: Parameters<T>): void;
  cancel(): void;
  flush(): void;
}

/**
 * Debounce a function — delays execution until after wait ms of inactivity.
 *
 * @example
 * const debouncedSearch = debounce(search, 300)
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  waitMs: number,
): DebouncedFn<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T>;

  const debounced = (...args: Parameters<T>): void => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...lastArgs);
    }, waitMs);
  };

  debounced.cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
  };

  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      fn(...lastArgs);
    }
  };

  return debounced as DebouncedFn<T>;
}

// ─────────────────────────────────────────
// THROTTLE
// ─────────────────────────────────────────

/**
 * Throttle a function — fires at most once per wait ms (leading edge).
 * Useful for high-frequency events like scroll, resize, mousemove.
 *
 * @example
 * const throttledUpdate = throttle(updateWaveform, 16) // ~60fps
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  waitMs: number,
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>): void => {
    const now = Date.now();
    if (now - lastCall >= waitMs) {
      lastCall = now;
      fn(...args);
    }
  };
}

// ─────────────────────────────────────────
// ONCE
// ─────────────────────────────────────────

/**
 * Wrap a function so it only executes once.
 * Subsequent calls return the first result.
 *
 * @example
 * const init = once(() => expensiveSetup())
 */
export function once<T>(fn: () => T): () => T {
  let called = false;
  let result: T;
  return (): T => {
    if (!called) { called = true; result = fn(); }
    return result;
  };
}

// ─────────────────────────────────────────
// LAZY INIT
// ─────────────────────────────────────────

/**
 * Lazily initialize a value on first access.
 * Avoids creating expensive objects before they are needed.
 *
 * @example
 * const getAudioContext = lazy(() => new AudioContext())
 * // AudioContext only created when getAudioContext() is first called
 */
export function lazy<T>(factory: () => T): () => T {
  let value: T | undefined;
  let initialized = false;
  return (): T => {
    if (!initialized) { initialized = true; value = factory(); }
    return value as T;
  };
}
