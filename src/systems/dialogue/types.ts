/**
 * 对话系统类型定义 — AI Narrator Game
 *
 * @description
 * 严格对齐 GDD dialogue-system.md §3.1。
 * NarrativeTag 对齐 memory/types.ts 的 EventTag（不重复定义）。
 *
 * @see design/gdd/dialogue-system.md §3.1
 * @see src/systems/memory/types.ts (EventTag)
 */

import type { EventTag } from '@/systems/memory/types';

// ============================================================
// NarrativeTag — 对齐 EventTag，仅添加对话特有标签
// ============================================================

/**
 * 叙事标签 — 扩展自 memory EventTag
 *
 * 对话系统专用标签补充：
 * - golden_choice / danger_zone / magic_moment: 场景类型标签
 * - hook_set / hook_resolved: 悬念生命周期
 * - chapter_end: 章节结束
 */
export type NarrativeTag = EventTag | 'golden_choice' | 'danger_zone' | 'magic_moment' | 'hook_set' | 'hook_resolved' | 'chapter_end';

// ============================================================
// 叙事状态机 — GDD §2.1
// ============================================================

/** 叙事状态枚举 — GDD §3.1 */
export type NarrativeMode =
  | 'exploration'    // 自由探索
  | 'conversation'   // 与 NPC 交谈中
  | 'tension'        // 紧张/冲突升级
  | 'climax'         // 关键转折 / 高潮
  | 'resolution'     // 后果消化
  | 'combat'         // 战斗中
  | 'resting';       // 休息

// ============================================================
// 玩家输入 — GDD §4.1
// ============================================================

export interface PlayerInput {
  type: 'free_text' | 'decision_option' | 'suggested_action';
  text: string;
  optionId?: string;
  actionId?: string;
  metadata?: PlayerInputMetadata;
}

export interface PlayerInputMetadata {
  clickedTileId?: string;
  clickedEntityId?: string;
}

// ============================================================
// 对话消息 — GDD §3.1
// ============================================================

export interface DialogueMessage {
  id: string;
  role: 'player' | 'ai_gm' | 'npc' | 'system';
  speakerName: string;
  speakerId: string;
  content: string;
  contentBlocks: ContentBlock[];
  timestamp: number;
  sceneType?: 'golden' | 'danger' | 'magic' | null;
  isDecisionPoint: boolean;
  decisionNodeId?: string;
  tokenCount: number;
  stateDelta?: StateDelta;
  suggestedActions: SuggestedAction[];
}

export interface ContentBlock {
  type: 'narrative' | 'action' | 'state' | 'decision';
  text: string;
  options?: DecisionOption[];
}

export interface StateDelta {
  hpChange?: number;
  mpChange?: number;
  relationshipChanges: RelationshipChange[];
  itemChanges: ItemChange[];
  locationChange?: string;
  questUpdates: QuestUpdate[];
  narrativeTags: NarrativeTag[];
}

export interface RelationshipChange {
  entityId: string;
  entityName: string;
  delta: number; // -100 ~ +100
  reason: string;
}

export interface ItemChange {
  itemName: string;
  action: 'acquire' | 'lose' | 'use';
}

export interface QuestUpdate {
  questId: string;
  status: 'started' | 'progressed' | 'completed' | 'failed';
  description: string;
}

// ============================================================
// 建议动作 — GDD §2.7, §3.1
// ============================================================

export interface SuggestedAction {
  id: string;
  text: string;
  type: 'conversation' | 'movement' | 'examination' | 'combat' | 'rest' | 'item_use';
  icon: string;
  targetEntityId?: string;
  priority: 1 | 2 | 3;
}

// ============================================================
// 决策节点 — GDD §2.5, §3.1
// ============================================================

export interface DecisionOption {
  id: string;
  text: string;
  sceneType: 'golden' | 'danger' | 'magic';
  predictedConsequence: string;
}

export interface DecisionNode {
  id: string;
  parentDecisionId: string | null;
  sessionId: string;
  timestamp: number;
  narrativeContext: string;
  promptText: string;
  options: DecisionOption[];
  chosenOptionIndex: number;
  immediateConsequence: string;
  consequenceEventIds: string[];
  sceneType: 'golden' | 'danger' | 'magic';
  tags: string[];
}

// ============================================================
// 叙事上下文（UI 层用）— 扩展自 store
// ============================================================

export interface NarrativeContext {
  /** 当前叙事模式 */
  mode: NarrativeMode;
  /** 当前场景描述 */
  currentScene: string;
  /** 当前幕 */
  currentAct: number;
  /** 紧张程度 0-100 */
  tensionLevel: number;
  /** AI GM 最近执行的动作描述 */
  lastAiAction: string;
}

// ============================================================
// 会话元数据 — GDD §3.1
// ============================================================

export interface DialogueSessionMeta {
  sessionId: string;
  sessionDuration: number;
  messageCount: number;
  decisionCount: number;
  lastKeyEventTime: number;
  narrativeStateHistory: NarrativeStateTransition[];
  modelId: string;
  totalTokensUsed: number;
  startedAt: number;
}

export interface NarrativeStateTransition {
  from: NarrativeMode;
  to: NarrativeMode;
  timestamp: number;
  trigger: string;
}

// ============================================================
// 假选择检测 — GDD §3.1
// ============================================================

export interface FakeChoiceWarning {
  decisionNodeId: string;
  options: string[];
  reason: string;
  stateDeltaComparison: string;
  severity: 'warning' | 'error';
}

// ============================================================
// LLM 请求/响应 — GDD §3.1, §4.4
// ============================================================

export interface LLMRequest {
  model: string;
  messages: OpenRouterMessage[];
  stream: boolean;
  maxTokens: number;
  temperature: number;
  provider?: LLMProviderConfig;
}

export interface LLMProviderConfig {
  order?: string[];
  allow_fallbacks?: boolean;
}

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  id: string;
  model: string;
  content: string;
  usage: LLMUsage;
  latency: number;
  timeToFirstToken: number;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ============================================================
// OpenRouter 配置 — GDD §4.4, ADR-001
// ============================================================

export interface OpenRouterConfig {
  apiKey: string;
  baseUrl: string;
  customProxyUrl?: string;
  defaultModel: string;
  availableModels: ModelInfo[];
  httpReferer: string;
  appTitle: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  promptCost: number;
  completionCost: number;
  supportsStreaming: boolean;
  supportsFunctions: boolean;
}

// ============================================================
// LLM 配置 — GDD §4.1
// ============================================================

export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  streamTimeout: number;
  enableTypingEffect: boolean;
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  model: 'anthropic/claude-3.5-sonnet',
  temperature: 0.8,
  maxTokens: 2000,
  streamTimeout: 30000,
  enableTypingEffect: false,
};

// ============================================================
// 对话配置 — GDD §4.1
// ============================================================

export interface DialogueConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  streamTimeout: number;
  systemPromptTemplate: string;
  enableTypingEffect: boolean;
}

export const DEFAULT_DIALOGUE_CONFIG: DialogueConfig = {
  model: 'anthropic/claude-3.5-sonnet',
  temperature: 0.8,
  maxTokens: 2000,
  streamTimeout: 30000,
  systemPromptTemplate: 'default',
  enableTypingEffect: false,
};

// ============================================================
// Prompt 组装上下文 — ADR-003
// ============================================================

export interface AssemblyContext {
  systemVersion: number;
  worldVersion: number;
  memoryVersion: number;
  gameSetting: GameSettingContext;
  modelConfig: LLMConfig;
  mapContext: MapContext;
  timeContext: TimeContext;
  memoryRequest: MemoryRetrievalRequest;
  maxSessionTokens: number;
  currentPageState?: PageState;
}

export interface GameSettingContext {
  worldName: string;
  dmName: string;
  playerClassName: string;
  worldRules: string;
  settingId: string;
  // FIX: BUG-4 — 传入实际会话时长和最后关键事件时间
  sessionDurationMinutes: number;
  timeSinceLastKeyEventMinutes: number;
}

export interface MapContext {
  currentRegion: string;
  regionDescription: string;
  nearbyLocations: string[];
  visibleNpcs: string[];
  playerCoord: string;
}

export interface TimeContext {
  timeOfDay: string;
  weather: string;
  atmosphere: string;
}

export interface PageState {
  selectedTileId?: string;
  openPanel?: string;
}

/** 轻量版 MemoryRetrievalRequest（对话系统内部使用，避免循环依赖） */
export interface MemoryRetrievalRequest {
  currentLocation: string;
  nearbyEntities: string[];
  activeQuestIds: string[];
  playerInput: string;
  maxTokens: number;
  includeLastSession: boolean;
}

// ============================================================
// IDialogueSystem — GDD §4.1
// ============================================================

export interface IDialogueSystem {
  init(config: DialogueConfig): Promise<void>;
  shutdown(): Promise<void>;

  sendMessage(input: PlayerInput): Promise<DialogueMessage>;
  sendMessageStream(
    input: PlayerInput,
    onToken: (token: string) => void,
    onBlock: (block: ContentBlock) => void,
    onComplete: (message: DialogueMessage) => void
  ): Promise<void>;

  getCurrentSuggestions(): SuggestedAction[];
  executeSuggestion(actionId: string): Promise<DialogueMessage>;

  getRecentMessages(count: number): DialogueMessage[];
  getSessionHistory(): DialogueMessage[];
  getDecisionTree(): DecisionNode[];

  getNarrativeMode(): NarrativeMode;
  getSessionMeta(): DialogueSessionMeta;
}
