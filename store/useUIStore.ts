'use client';
// store/useUIStore.ts
// UI-level state — active panels, notifications, user preferences, overlay states.
// Partially persisted (preferences only; transient overlay/notification state is not).

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export type PanelId =
  | 'settings'
  | 'history'
  | 'memory'
  | 'plugins'
  | 'diagnostics'
  | 'none';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface UINotification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  /** Duration in ms before auto-dismiss. 0 = persistent until manually dismissed. */
  duration: number;
  createdAt: number;
}

export type JarvisTheme = 'jarvis-dark' | 'jarvis-blue' | 'jarvis-green' | 'system';

// ─────────────────────────────────────────
// STATE INTERFACE
// ─────────────────────────────────────────

export interface UIStoreState {
  // ── Layout ───────────────────────────────
  activePanel: PanelId;
  isSidebarOpen: boolean;
  isFullscreen: boolean;
  isCompactMode: boolean;

  // ── Notifications (transient) ─────────────
  notifications: UINotification[];

  // ── User preferences (persisted) ──────────
  theme: JarvisTheme;
  reducedMotion: boolean;
  soundEffects: boolean;
  hapticFeedback: boolean;

  // ── Overlay states (transient) ────────────
  isCommandPaletteOpen: boolean;
  isOnboarding: boolean;
  hasCompletedOnboarding: boolean;

  // ── Actions: Layout ───────────────────────
  setActivePanel: (panel: PanelId) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setFullscreen: (value: boolean) => void;
  setCompactMode: (value: boolean) => void;

  // ── Actions: Notifications ────────────────
  notify: (notification: Pick<UINotification, 'type' | 'title' | 'message'> & { duration?: number }) => string;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;

  // ── Actions: Preferences ──────────────────
  setTheme: (theme: JarvisTheme) => void;
  setReducedMotion: (value: boolean) => void;
  setSoundEffects: (value: boolean) => void;
  setHapticFeedback: (value: boolean) => void;

  // ── Actions: Overlays ─────────────────────
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  completeOnboarding: () => void;
}

// ─────────────────────────────────────────
// ID GENERATION
// ─────────────────────────────────────────

let _notifCounter = 0;
function generateNotifId(): string {
  return `notif_${Date.now()}_${++_notifCounter}`;
}

// ─────────────────────────────────────────
// STORE
// ─────────────────────────────────────────

export const useUIStore = create<UIStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        // ── Initial state ─────────────────────
        activePanel: 'none',
        isSidebarOpen: false,
        isFullscreen: false,
        isCompactMode: false,
        notifications: [],
        theme: 'jarvis-dark',
        reducedMotion: false,
        soundEffects: true,
        hapticFeedback: false,
        isCommandPaletteOpen: false,
        isOnboarding: false,
        hasCompletedOnboarding: false,

        // ── Layout actions ────────────────────

        setActivePanel: (panel) => {
          // Toggling the same panel closes it
          const current = get().activePanel;
          set(
            { activePanel: current === panel ? 'none' : panel },
            false,
            'ui/setActivePanel',
          );
        },

        toggleSidebar: () => {
          set(
            (state) => ({ isSidebarOpen: !state.isSidebarOpen }),
            false,
            'ui/toggleSidebar',
          );
        },

        setSidebarOpen: (isSidebarOpen) => {
          set({ isSidebarOpen }, false, 'ui/setSidebarOpen');
        },

        setFullscreen: (isFullscreen) => {
          set({ isFullscreen }, false, 'ui/setFullscreen');
        },

        setCompactMode: (isCompactMode) => {
          set({ isCompactMode }, false, 'ui/setCompactMode');
        },

        // ── Notification actions ──────────────

        notify: ({ type, title, message, duration }) => {
          const id = generateNotifId();
          const notification: UINotification = {
            id,
            type,
            title,
            message,
            duration: duration ?? 4000,
            createdAt: Date.now(),
          };
          set(
            (state) => ({ notifications: [...state.notifications, notification] }),
            false,
            'ui/notify',
          );
          // Auto-dismiss
          if (notification.duration > 0) {
            setTimeout(() => get().dismissNotification(id), notification.duration);
          }
          return id;
        },

        dismissNotification: (id) => {
          set(
            (state) => ({
              notifications: state.notifications.filter((n) => n.id !== id),
            }),
            false,
            'ui/dismissNotification',
          );
        },

        clearNotifications: () => {
          set({ notifications: [] }, false, 'ui/clearNotifications');
        },

        // ── Preference actions ────────────────

        setTheme: (theme) => {
          set({ theme }, false, 'ui/setTheme');
        },

        setReducedMotion: (reducedMotion) => {
          set({ reducedMotion }, false, 'ui/setReducedMotion');
        },

        setSoundEffects: (soundEffects) => {
          set({ soundEffects }, false, 'ui/setSoundEffects');
        },

        setHapticFeedback: (hapticFeedback) => {
          set({ hapticFeedback }, false, 'ui/setHapticFeedback');
        },

        // ── Overlay actions ───────────────────

        openCommandPalette: () => {
          set({ isCommandPaletteOpen: true }, false, 'ui/openCommandPalette');
        },

        closeCommandPalette: () => {
          set({ isCommandPaletteOpen: false }, false, 'ui/closeCommandPalette');
        },

        completeOnboarding: () => {
          set(
            { isOnboarding: false, hasCompletedOnboarding: true },
            false,
            'ui/completeOnboarding',
          );
        },
      }),
      {
        name: 'jarvis-ui-store',
        // Persist user preferences only — never panel/overlay/notification state
        partialize: (state) => ({
          theme: state.theme,
          reducedMotion: state.reducedMotion,
          soundEffects: state.soundEffects,
          hapticFeedback: state.hapticFeedback,
          isCompactMode: state.isCompactMode,
          hasCompletedOnboarding: state.hasCompletedOnboarding,
        }),
      },
    ),
    {
      name: 'JarvisUIStore',
      enabled: process.env.NODE_ENV === 'development',
    },
  ),
);
