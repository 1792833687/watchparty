/**
 * DialogueStore — 对话系统 Zustand Store
 *
 * @description
 * UI 层与 DialogueSession 之间的桥梁。
 * 通过注入 IDialogueSystem 引用实现依赖反转。
 *
 * 类型从 systems/dialogue 导入，Store 层扩展了少量 UI 专用类型。
 */

import { create } from 'zustand';
import type {
  IDialogueSystem,
  DialogueMessage,
  ContentBlock,
  SuggestedAction,
  DecisionNode,
  DecisionOption,
  NarrativeMode,
  NarrativeContext,
  PlayerInput,
} from '@/systems/dialogue/types';

// ============================================================
// Re-export 系统类型（向后兼容）
// ============================================================

export type {
  DialogueMessage,
  ContentBlock,
  SuggestedAction,
  DecisionNode,
  DecisionOption,
  NarrativeMode,
  NarrativeContext,
  PlayerInput,
};

// ============================================================
// UI 专用类型
// ============================================================

/** Store 层的叙事状态（UI 渲染用） */
export interface NarrativeUIState {
  currentScene: string;
  currentAct: number;
  tensionLevel: number;
  mode: NarrativeMode;
  lastAiAction: string;
}

/** Store 层的会话元数据 */
export interface StoreSessionMeta {
  sessionId: string;
  messageCount: number;
  totalTokensUsed: number;
  startedAt: number;
  modelId: string;
}

// ============================================================
// Store 接口
// ============================================================

export interface DialogueSlice {
  // ── 消息历史 ──
  messages: DialogueMessage[];

  // ── 当前状态 ──
  narrativeState: NarrativeUIState;
  currentSuggestions: SuggestedAction[];
  isStreaming: boolean;
  streamedText: string;

  // ── 决策 ──
  activeDecision: DecisionNode | null;

  // ── 元数据 ──
  sessionMeta: StoreSessionMeta | null;

  // ── 系统引用 ──
  setDialogueSystem: (system: IDialogueSystem) => void;

  // ── Actions ──
  sendMessage: (input: PlayerInput) => Promise<void>;
  executeSuggestion: (actionId: string) => Promise<void>;
  selectDecisionOption: (optionId: string) => Promise<void>;
  clearStreamedText: () => void;
  addMessage: (message: DialogueMessage) => void;
  setStreaming: (streaming: boolean) => void;
  appendStreamedText: (text: string) => void;
  setSuggestions: (suggestions: SuggestedAction[]) => void;
  setActiveDecision: (decision: DecisionNode | null) => void;
  setNarrativeState: (state: Partial<NarrativeUIState>) => void;
  initSessionMeta: (meta: StoreSessionMeta) => void;
  reset: () => void;
}

// ============================================================
// 模块级系统引用
// ============================================================

let dialogueSystemRef: IDialogueSystem | null = null;

// ============================================================
// 初始状态
// ============================================================

function getInitialNarrativeState(): NarrativeUIState {
  return {
    currentScene: '',
    currentAct: 1,
    tensionLevel: 0,
    mode: 'exploration',
    lastAiAction: '',
  };
}

function getInitialState(): Omit<
  DialogueSlice,
  | 'setDialogueSystem'
  | 'sendMessage'
  | 'executeSuggestion'
  | 'selectDecisionOption'
  | 'clearStreamedText'
  | 'addMessage'
  | 'setStreaming'
  | 'appendStreamedText'
  | 'setSuggestions'
  | 'setActiveDecision'
  | 'setNarrativeState'
  | 'initSessionMeta'
  | 'reset'
> {
  return {
    messages: [],
    narrativeState: getInitialNarrativeState(),
    currentSuggestions: [],
    isStreaming: false,
    streamedText: '',
    activeDecision: null,
    sessionMeta: null,
  };
}

// ============================================================
// Store 创建
// ============================================================

export const useDialogueStore = create<DialogueSlice>((set, get) => ({
  ...getInitialState(),

  // ── 系统引用注入 ──

  setDialogueSystem: (system: IDialogueSystem): void => {
    dialogueSystemRef = system;
  },

  // ── 核心 Actions ──

  sendMessage: async (input: PlayerInput): Promise<void> => {
    const system = dialogueSystemRef;
    if (!system) {
      console.warn('[DialogueStore] sendMessage: no DialogueSystem injected');
      return;
    }

    try {
      set({ isStreaming: true, streamedText: '' });

      // 添加玩家消息到 store
      const playerMsg: DialogueMessage = {
        id: `player-${Date.now()}`,
        role: 'player',
        speakerName: 'Player',
        speakerId: 'player',
        content: input.text || '[等待中…]',
        contentBlocks: [],
        timestamp: Date.now(),
        isDecisionPoint: false,
        tokenCount: 0,
        suggestedActions: [],
      };
      set((state) => ({ messages: [...state.messages, playerMsg] }));

      // 使用流式 API 获取 AI 回应
      await system.sendMessageStream(
        input,
        // onToken: 逐步更新流式文本
        (token: string) => {
          set((state) => ({ streamedText: state.streamedText + token }));
        },
        // onBlock: 每个块解析完成时的回调
        (_block: ContentBlock) => {
          // 块解析完成（可用于提前渲染特定块类型）
        },
        // onComplete: 完整消息
        (aiMessage: DialogueMessage) => {
          set((state) => ({
            messages: [...state.messages, aiMessage],
            currentSuggestions: aiMessage.suggestedActions,
            isStreaming: false,
            streamedText: '',
            activeDecision: aiMessage.isDecisionPoint
              ? buildDecisionNodeFromMessage(aiMessage)
              : null,
            narrativeState: {
              ...state.narrativeState,
              lastAiAction: aiMessage.content.slice(0, 100),
            },
          }));
        }
      );
    } catch (error) {
      console.error('[DialogueStore] sendMessage failed:', error);
      set({ isStreaming: false, streamedText: '' });

      // 添加错误消息
      const errorMsg: DialogueMessage = {
        id: `error-${Date.now()}`,
        role: 'system',
        speakerName: 'System',
        speakerId: 'system',
        content: `[错误] ${error instanceof Error ? error.message : '未知错误'}`,
        contentBlocks: [{ type: 'narrative', text: 'AI GM 暂时无法回应，请稍后再试。' }],
        timestamp: Date.now(),
        isDecisionPoint: false,
        tokenCount: 0,
        suggestedActions: [],
      };
      set((state) => ({ messages: [...state.messages, errorMsg] }));
    }
  },

  executeSuggestion: async (actionId: string): Promise<void> => {
    const { currentSuggestions } = get();
    const action = currentSuggestions.find((a) => a.id === actionId);
    if (!action) return;

    await get().sendMessage({
      type: 'suggested_action',
      text: action.text,
      actionId,
    });
  },

  selectDecisionOption: async (optionId: string): Promise<void> => {
    const { activeDecision } = get();
    if (!activeDecision) return;

    const option = activeDecision.options.find((o) => o.id === optionId);
    if (!option) return;

    await get().sendMessage({
      type: 'decision_option',
      text: option.text,
      optionId,
    });
  },

  // ── UI Actions ──

  clearStreamedText: (): void => {
    set({ streamedText: '' });
  },

  addMessage: (message: DialogueMessage): void => {
    set((state) => ({ messages: [...state.messages, message] }));
  },

  setStreaming: (streaming: boolean): void => {
    set({ isStreaming: streaming });
  },

  appendStreamedText: (text: string): void => {
    set((state) => ({ streamedText: state.streamedText + text }));
  },

  setSuggestions: (suggestions: SuggestedAction[]): void => {
    set({ currentSuggestions: suggestions });
  },

  setActiveDecision: (decision: DecisionNode | null): void => {
    set({ activeDecision: decision });
  },

  setNarrativeState: (partial: Partial<NarrativeUIState>): void => {
    set((state) => ({
      narrativeState: { ...state.narrativeState, ...partial },
    }));
  },

  initSessionMeta: (meta: StoreSessionMeta): void => {
    set({ sessionMeta: meta });
  },

  reset: (): void => {
    dialogueSystemRef = null;
    set(getInitialState());
  },
}));

// ============================================================
// 辅助
// ============================================================

function buildDecisionNodeFromMessage(msg: DialogueMessage): DecisionNode {
  const decisionBlock = msg.contentBlocks.find((b) => b.type === 'decision');
  const options = decisionBlock?.options || [];

  return {
    id: msg.decisionNodeId || `decision-${Date.now()}`,
    parentDecisionId: null,
    sessionId: '',
    timestamp: msg.timestamp,
    narrativeContext: msg.content,
    promptText: decisionBlock?.text || '',
    options,
    chosenOptionIndex: -1,
    immediateConsequence: '',
    consequenceEventIds: [],
    // FIX: QUAL-5 — sceneType 空字符串应视为有效值，使用 ?? 而非 ||
    sceneType: options[0]?.sceneType ?? 'golden',
    tags: [],
  };
}
