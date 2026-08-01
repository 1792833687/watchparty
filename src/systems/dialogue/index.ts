/**
 * 对话系统 (Dialogue System) — 公共导出
 */

// 类型
export type {
  IDialogueSystem,
  DialogueConfig,
  DialogueMessage,
  DialogueSessionMeta,
  ContentBlock,
  StateDelta,
  RelationshipChange,
  ItemChange,
  QuestUpdate,
  SuggestedAction,
  DecisionOption,
  DecisionNode,
  NarrativeMode,
  NarrativeContext,
  NarrativeStateTransition,
  NarrativeTag,
  PlayerInput,
  PlayerInputMetadata,
  FakeChoiceWarning,
  LLMRequest,
  LLMResponse,
  LLMUsage,
  LLMConfig,
  OpenRouterMessage,
  OpenRouterConfig,
  ModelInfo,
  AssemblyContext,
  MapContext,
  TimeContext,
  GameSettingContext,
  MemoryRetrievalRequest,
} from './types';

export {
  DEFAULT_DIALOGUE_CONFIG,
  DEFAULT_LLM_CONFIG,
} from './types';

// 核心类
export { DialogueSession } from './dialogue-session';
export { PromptAssembler } from './prompt-assembler';
export { ResponseParser } from './response-parser';
export type { ParseResult, ParseDiagnostics } from './response-parser';
