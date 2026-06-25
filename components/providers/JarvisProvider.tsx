'use client';
// components/providers/JarvisProvider.tsx
// Phase 3 complete — root provider for the full Jarvis OS runtime.
//
// ╔══════════════════════════════════════════════════════════╗
// ║  RENDERS ZERO VISIBLE HTML — pure behavioral layer       ║
// ║  The existing UI is completely unchanged                 ║
// ╚══════════════════════════════════════════════════════════╝
//
// Initializes on mount (client-side only):
//   1. All 7 Zustand stores registered with Redux DevTools
//   2. AssistantStore marked as initialized
//   3. Built-in tools registered (7 tools)
//   4. Built-in commands registered (14 commands)
//   5. JarvisRuntime started (IPC + keyboard shortcuts)
//   6. BehaviorEngine started (idle timeout + error recovery)
//   7. System preferences synced (reducedMotion, mic permission)
//   8. ConversationStore and CommandStore wired
//   9. MemoryStore force-persisted on first load

import { useEffect, type ReactNode } from 'react';
import { useAssistantStore }    from '@/store/useAssistantStore';
import { useVoiceStore }        from '@/store/useVoiceStore';
import { useUIStore }           from '@/store/useUIStore';
import { useMemoryStore }       from '@/store/useMemoryStore';
import { useToolStore }         from '@/store/useToolStore';
import { useCommandStore }      from '@/store/useCommandStore';
import { useConversationStore } from '@/store/useConversationStore';
import { runtime }              from '@/lib/assistant/runtime';
import { behaviorEngine }       from '@/lib/assistant/behavior';
import { wakeWordEngine }       from '@/lib/voice/wakeword';
import { registerBuiltins }     from '@/lib/tools/builtins';
import { toolRegistry }         from '@/lib/tools/registry';
import { registerBuiltinCommands } from '@/lib/commands/handlers';
import { commandRegistry }      from '@/lib/commands/registry';

// ─────────────────────────────────────────────────────────────────────────────
// STORE INITIALIZER
// Subscribes to all 7 stores → triggers Redux DevTools @@INIT dispatch
// ─────────────────────────────────────────────────────────────────────────────

function StoreInitializer(): null {
  const assistantMode  = useAssistantStore((s) => s.mode);
  const voiceState     = useVoiceStore((s) => s.voiceState);
  const uiTheme        = useUIStore((s) => s.theme);
  const memoryTotal    = useMemoryStore((s) => s.totalEntries);
  const toolCount      = useToolStore((s) => s.registeredToolNames.length);
  const commandCount   = useCommandStore((s) => s.registeredCount);
  const sessionId      = useConversationStore((s) => s.currentSessionId);

  useEffect(() => {
    const a = useAssistantStore.getState();
    const v = useVoiceStore.getState();
    const u = useUIStore.getState();
    const m = useMemoryStore.getState();

    // Force MemoryStore to persist on first load
    // (Zustand persist only saves on setState — getState() alone won't trigger it)
    if (!localStorage.getItem('jarvis-memory-store')) {
      m.setStatus('idle');
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(
        '[JarvisOS] Stores initialized ✓',
        '\n  AssistantStore mode:', a.mode,
        '\n  VoiceStore state:', v.voiceState,
        '\n  UIStore theme:', u.theme,
        '\n  MemoryStore entries:', m.totalEntries,
      );
    }
  }, []);

  // Silence lint — subscriptions are intentional
  void assistantMode; void voiceState; void uiTheme; void memoryTotal;
  void toolCount; void commandCount; void sessionId;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// RUNTIME INITIALIZER
// Starts the full assistant runtime, registers tools/commands, wires behavior
// ─────────────────────────────────────────────────────────────────────────────

function RuntimeInitializer(): null {
  const initialize         = useAssistantStore((s) => s.initialize);
  const setReducedMotion   = useUIStore((s) => s.setReducedMotion);
  const setMicPermission   = useVoiceStore((s) => s.setMicPermission);
  const setRegisteredTools = useToolStore((s) => s.setRegisteredTools);
  const setCommandCount    = useCommandStore((s) => s.setRegisteredCount);
  const startConvSession   = useConversationStore((s) => s.startNewSession);

  useEffect(() => {
    // 1. Mark AssistantStore initialized (resolves SSR/client mismatch)
    initialize();

    // 2. Register built-in tools
    registerBuiltins();
    const toolNames = toolRegistry.getAll().map((t) => t.name);
    setRegisteredTools(toolNames);

    // 3. Register built-in commands
    registerBuiltinCommands();
    setCommandCount(commandRegistry.size);

    // 4. Start the assistant runtime (IPC + keyboard shortcuts + behavior + wakeword)
    runtime.init({ registerIPC: true, registerShortcuts: true });

    // 5. Start behavior engine
    behaviorEngine.init({
      idleTimeoutMinutes: 10,
      errorRecoverySeconds: 5,
      speakingTimeoutSeconds: 60,
      wakeWordOnSleep: true,
      notifyOnSleep: false,
    });

    // 6. Initialize conversation session
    startConvSession();

    // 7. Detect system prefers-reduced-motion
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(motionQuery.matches);
    const onMotion = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    motionQuery.addEventListener('change', onMotion);

    // 8. Check microphone permission
    if (navigator.permissions) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((result) => {
          setMicPermission(result.state === 'granted');
          result.addEventListener('change', () =>
            setMicPermission(result.state === 'granted'),
          );
        })
        .catch(() => setMicPermission(null));
    }

    // 9. Auto-start wake word detection if enabled in config
    const { wakeWordConfig } = useAssistantStore.getState();
    if (wakeWordConfig.enabled) {
      wakeWordEngine.start();
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[ToolRegistry] Registered ${toolNames.length} built-in tools: ${toolNames.join(', ')}`
      );
      console.log(
        `[CommandRegistry] Registered ${commandRegistry.size} built-in commands`
      );
    }

    // 10. Cleanup on unmount / hot-reload
    return () => {
      motionQuery.removeEventListener('change', onMotion);
      runtime.destroy();           // stops IPC, shortcuts, behavior, wakeword, executor
      wakeWordEngine.stop();
      if (process.env.NODE_ENV === 'development') {
        useVoiceStore.getState().reset();
      }
    };
  }, [
    initialize,
    setReducedMotion,
    setMicPermission,
    setRegisteredTools,
    setCommandCount,
    startConvSession,
  ]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

interface JarvisProviderProps {
  children: ReactNode;
}

export function JarvisProvider({ children }: JarvisProviderProps) {
  return (
    <>
      <StoreInitializer />
      <RuntimeInitializer />
      {children}
    </>
  );
}
