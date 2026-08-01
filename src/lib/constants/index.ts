/**
 * 全局常量 — AI Narrator Game
 *
 * 所有魔法数字集中管理。按系统域组织。
 */

// ============================================================
// 应用元数据
// ============================================================

export const APP_NAME = '凛冬要塞' as const;
export const APP_VERSION = '4.1.0' as const;
export const SAVE_FORMAT_VERSION = '1.0.0' as const;

/** v3.0.0: 唯一世界 — 世界名即游戏名 */
export const WORLD_NAME = '凛冬要塞' as const;
export const WORLD_FULL_NAME = '凛冬要塞：暗影纪元' as const;
export const WORLD_TEMPLATE_ID = 'frosthold' as const;

// ============================================================
// 经济系统 (v4.0.0 多层级货币)
// ============================================================

/** @deprecated v4.0.0: 使用 Wallet 结构替代，保留向后兼容 */
export const DEFAULT_STARTING_GOLD = 80;
/** 货币单位名称 */
export const CURRENCY_NAME = '金币' as const;
export const CURRENCY_SYMBOL = '🪙' as const;

// ============================================================
// 记忆引擎 (Memory Engine)
// ============================================================

/** 即时记忆最大条目数（触发压缩阈值） */
export const MAX_IMMEDIATE_EVENTS = 200;

/** 压缩后即时记忆目标数量 */
export const COMPACT_EVENT_TARGET = 80;

/** 短期记忆最大会话数 */
export const MAX_SHORT_TERM_SESSIONS = 5;

/** 每会话关键事件摘要数上限 */
export const MAX_KEY_EVENT_DIGESTS = 20;

/** 记忆检索超时 (ms) */
export const MEMORY_RETRIEVAL_TIMEOUT_MS = 500;

// ============================================================
// 对话系统 (Dialogue System)
// ============================================================

/** 上下文窗口 token 预算 */
export const CONTEXT_WINDOW_TOKENS = 8000;

/** Prompt 预算分配 */
export const SYSTEM_PROMPT_TOKENS = 500;
export const WORLD_CONTEXT_TOKENS = 300;
export const MEMORY_CONTEXT_TOKENS = 800;
export const SESSION_CONTEXT_TOKENS = 1500;
export const RESPONSE_BUDGET_TOKENS = 2000;

/** LLM 请求超时 (ms) */
export const LLM_REQUEST_TIMEOUT_MS = 30000;

/** 流式首 Token 目标 (ms) */
export const FIRST_TOKEN_TARGET_MS = 500;

/** 重试策略：最大次数 */
export const LLM_MAX_RETRIES = 3;
/** 重试策略：基础退避 (ms) */
export const LLM_RETRY_BASE_DELAY_MS = 1000;

/** 玩家输入最大长度（字符数） */
export const MAX_PLAYER_INPUT_LENGTH = 1000;

// ============================================================
// 地图系统 (Map System)
// ============================================================

/** 默认图块尺寸 (px) — 菱形外接矩形 */
export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 64;

/** 默认缩放范围 */
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2.0;
export const DEFAULT_ZOOM = 1.0;

/** 默认视野半径（格） */
export const DEFAULT_VIEW_RADIUS = 6;

/** 视口内最大 DOM 节点数 */
export const MAX_VIEWPORT_TILES = 200;

/** A* 寻路最大迭代次数 */
export const PATHFINDER_MAX_ITERATIONS = 1000;

/** 移动动画每格时长 (ms) */
export const MOVE_DURATION_PER_TILE_MS = 150;

/** 区域切换动画时长 (ms) */
export const REGION_SWITCH_DURATION_MS = 300;

// ============================================================
// 存档系统 (Save System)
// ============================================================

/** 最大存档位数量 */
export const MAX_SAVE_SLOTS = 3;

/** 存储配额警告阈值（百分比） */
export const STORAGE_QUOTA_WARNING_PERCENT = 80;

// ============================================================
// UI
// ============================================================

/** Toast 默认持续时间 (ms) */
export const TOAST_DURATION_MS = 4000;

/** Toast 最大同时显示数 */
export const MAX_TOASTS = 5;

/** Tooltip 悬停延迟 (ms) */
export const TOOLTIP_HOVER_DELAY_MS = 400;

/** 模态动画时长 (ms) */
export const MODAL_ANIMATION_DURATION_MS = 200;

// ============================================================
// 模型
// ============================================================

/** 默认模型列表 */
export const DEFAULT_MODELS = [
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { id: 'google/gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', provider: 'DeepSeek', via: 'openrouter' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', via: 'openrouter' },
  { id: 'deepseek-chat', name: 'DeepSeek V3 (直连)', provider: 'DeepSeek', via: 'deepseek' },
  { id: 'deepseek-reasoner', name: 'DeepSeek R1 (直连)', provider: 'DeepSeek', via: 'deepseek' },
] as const;

// ============================================================
// OpenRouter
// ============================================================

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1' as const;
export const OPENROUTER_API_URL = 'https://api.openrouter.ai' as const;
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1' as const;
