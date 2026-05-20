// lib/ipc/index.ts
// Barrel export for all IPC-related utilities.
// Usage: import { ipc, IPC_CHANNELS } from '@/lib/ipc'
//
// ⚠️  THIS FILE must ONLY export from './bridge' and './channels'.
//     Do NOT add store exports here — stores live in /store/index.ts.

// Runtime bridge (environment-safe: works in Electron, browser, and SSR)
export { ipc, emitSyntheticIPC } from './bridge';
export type { IPCBridge } from './bridge';

// Channel name constants and their derived types
// Note: IPCChannelKey and IPCChannelValue are derived from channels.ts — NOT from bridge.ts
export { IPC_CHANNELS } from './channels';
export type { IPCChannelKey, IPCChannelValue } from './channels';
