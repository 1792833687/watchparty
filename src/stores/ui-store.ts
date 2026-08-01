import { create } from 'zustand';

// ============================================================
// 类型定义 — 对应 overview.md §3.4.4
// ============================================================

/** Toast 通知 */
export interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  durationMs: number;
  createdAt: number;
}

/** AI 主持人状态 */
export type AIAvatarState = 'idle' | 'thinking' | 'speaking' | 'warning';

/** 面板类型 */
export type PanelType = 'map' | 'dialogue' | 'status';

// ============================================================
// Store 接口
// ============================================================

export interface UISlice {
  // ── 布局 ──
  theme: 'dark' | 'light';
  activePanel: PanelType;

  // ── 模态 ──
  activeModal: string | null;
  modalData: unknown;

  // ── 提示 ──
  toasts: Toast[];

  // ── AI 状态 ──
  aiAvatarState: AIAvatarState;

  // ── 设置 ──
  selectedModel: string;
  typingEffectEnabled: boolean;
  soundEnabled: boolean;

  // ── 可访问性 ──
  reducedMotion: boolean;
  highContrast: boolean;

  // ── Actions ──
  setTheme: (theme: 'dark' | 'light') => void;
  setActivePanel: (panel: PanelType) => void;
  openModal: (id: string, data?: unknown) => void;
  closeModal: () => void;
  addToast: (toast: Toast) => void;
  removeToast: (id: string) => void;
  setAiAvatarState: (state: AIAvatarState) => void;
  setSelectedModel: (model: string) => void;
  toggleTypingEffect: () => void;
  toggleSound: () => void;
  setReducedMotion: (reduced: boolean) => void;
  setHighContrast: (high: boolean) => void;
  reset: () => void;
}

// ============================================================
// 初始状态
// ============================================================

function getInitialState(): Omit<
  UISlice,
  | 'setTheme'
  | 'setActivePanel'
  | 'openModal'
  | 'closeModal'
  | 'addToast'
  | 'removeToast'
  | 'setAiAvatarState'
  | 'setSelectedModel'
  | 'toggleTypingEffect'
  | 'toggleSound'
  | 'setReducedMotion'
  | 'setHighContrast'
  | 'reset'
> {
  return {
    theme: 'dark',
    activePanel: 'dialogue',
    activeModal: null,
    modalData: null,
    toasts: [],
    aiAvatarState: 'idle',
    selectedModel: 'openai/gpt-4o',
    typingEffectEnabled: true,
    soundEnabled: false,
    reducedMotion: false,
    highContrast: false,
  };
}

// ============================================================
// Store 创建
// ============================================================

export const useUIStore = create<UISlice>((set) => ({
  ...getInitialState(),

  setTheme: (theme: 'dark' | 'light'): void => {
    set({ theme });
  },

  setActivePanel: (panel: PanelType): void => {
    set({ activePanel: panel });
  },

  openModal: (id: string, data?: unknown): void => {
    set({ activeModal: id, modalData: data ?? null });
  },

  closeModal: (): void => {
    set({ activeModal: null, modalData: null });
  },

  addToast: (toast: Toast): void => {
    set((state) => ({
      toasts: [...state.toasts, toast].slice(-5),
    }));
  },

  removeToast: (id: string): void => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  setAiAvatarState: (avatarState: AIAvatarState): void => {
    set({ aiAvatarState: avatarState });
  },

  setSelectedModel: (model: string): void => {
    set({ selectedModel: model });
  },

  toggleTypingEffect: (): void => {
    set((state) => ({ typingEffectEnabled: !state.typingEffectEnabled }));
  },

  toggleSound: (): void => {
    set((state) => ({ soundEnabled: !state.soundEnabled }));
  },

  setReducedMotion: (reduced: boolean): void => {
    set({ reducedMotion: reduced });
  },

  setHighContrast: (high: boolean): void => {
    set({ highContrast: high });
  },

  reset: (): void => {
    set(getInitialState());
  },
}));
