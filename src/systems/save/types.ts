/**
 * 存档系统类型定义 — AI Narrator Game
 *
 * @description
 * 定义存档数据模型、元数据、序列化选项、版本管理。
 * 对齐 GDD 存档系统设计 + Epic 6 Story 6.1。
 *
 * 存档存储路径: `ain_save_slot_0/1/2`
 * localStorage 总大小约 5MB，接近限制时需警告用户。
 */

import type { GameSetting, PlayerAttributes } from '@/stores/world-store';
import type { DialogueMessage } from '@/systems/dialogue/types';
import type { MapState } from '@/stores/map-store';
import type { FogState } from '@/systems/map/types';

// ============================================================
// SaveVersion — 存档格式版本（为未来迁移留接口）
// ============================================================

/**
 * 存档格式语义化版本号。
 * 大版本不兼容（需迁移逻辑），小版本向后兼容。
 */
export interface SaveVersion {
  /** 主版本 — 不兼容变更 */
  major: number;
  /** 次版本 — 向后兼容的新增字段 */
  minor: number;
  /** 修订版本 — bug fix / 格式修正 */
  patch: number;
}

/** 当前存档格式版本 */
export const CURRENT_SAVE_VERSION: SaveVersion = {
  major: 1,
  minor: 0,
  patch: 0,
};

/** 将 SaveVersion 序列化为字符串 "major.minor.patch" */
export function saveVersionToString(v: SaveVersion): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

/** 从 "major.minor.patch" 解析 SaveVersion */
export function parseSaveVersion(raw: string): SaveVersion {
  const parts = raw.split('.').map((s) => {
    const n = Number(s);
    return Number.isNaN(n) ? 0 : n;
  });
  return {
    major: parts[0] ?? 0,
    minor: parts[1] ?? 0,
    patch: parts[2] ?? 0,
  };
}

/**
 * 比较两个 SaveVersion。
 * @returns >0 如果 a > b, <0 如果 a < b, 0 如果相等
 */
export function compareSaveVersion(a: SaveVersion, b: SaveVersion): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

// ============================================================
// SaveSlotMeta — 轻量槽位元数据
// ============================================================

/**
 * 存档槽位元数据（轻量，不包含完整游戏状态）。
 * 用于存档列表展示，对齐 world-store 中的 SaveSlotMeta 并扩展。
 */
export interface SaveSlotMeta {
  /** 槽位索引 0-2 */
  slotIndex: number;
  /** 玩家输入/自动生成的标签 */
  label: string;
  /** 玩家角色名 */
  playerName: string;
  /** 玩家职业/身份 */
  playerClass: string;
  /** 游戏设定名称 */
  gameSettingName: string;
  /** 游戏设定 ID */
  gameSettingId: string;
  /** 累计游戏时长（毫秒） */
  playTimeMs: number;
  /** 存档创建时间戳 */
  createdAt: number;
  /** 最后存档时间戳 */
  savedAt: number;
  /** 存档格式版本 */
  saveVersion: SaveVersion;
  /** 存档文件大小（字节） */
  fileSizeBytes: number;
  /** 是否自动存档 */
  isAutoSave: boolean;
}

// ============================================================
// SaveData — 完整世界状态
// ============================================================

/**
 * 玩家状态快照
 */
export interface PlayerSaveState {
  name: string;
  class: string;
  attributes: PlayerAttributes;
}

/**
 * 对话状态快照
 */
export interface DialogueSaveState {
  /** 对话消息历史 */
  messages: DialogueMessage[];
  /** 会话 ID */
  sessionId: string;
  /** 已用 token 数 */
  totalTokensUsed: number;
  /** 会话开始时间 */
  startedAt: number;
  /** 当前模型 ID */
  modelId: string;
}

/**
 * UI 偏好快照
 */
export interface UISaveState {
  theme: 'dark' | 'light';
  selectedModel: string;
  typingEffectEnabled: boolean;
  soundEnabled: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
}

/**
 * 完整存档数据 — 包含恢复游戏所需的所有世界状态。
 *
 * 设计原则：
 * - 记忆图谱（MemoryGraph）通过 MemoryEngine.exportGraph() 获取，
 *   序列化时使用 serializeGraph 转为 JSON 兼容格式。
 * - Map 类型字段在序列化/反序列化时自动转换为 Record。
 * - 所有时间戳均为 epoch ms。
 */
export interface SaveData {
  /** 存档格式版本 */
  version: SaveVersion;

  /** 存档创建时间戳 */
  createdAt: number;
  /** 最后保存时间戳 */
  savedAt: number;
  /** 累计游戏时长（毫秒） */
  playTimeMs: number;
  /** 是否自动存档 */
  isAutoSave: boolean;
  /** 用户输入的存档标签 */
  label: string;

  // ── 玩家 ──
  player: PlayerSaveState;

  // ── 游戏设定 ──
  gameSetting: {
    id: string;
    name: string;
    version: string;
    worldMeta: {
      name: string;
      genre: string;
      tone: string;
      description: string;
    };
  };

  // ── 地图 ──
  map: MapState;

  // ── 对话 ──
  dialogue: DialogueSaveState;

  // ── 记忆图谱（序列化后的 JSON 兼容格式） ──
  memoryGraph: Record<string, unknown>;

  // ── UI 偏好 ──
  ui: UISaveState;

  // ── 校验和（SHA-256 hex，存储后计算） ──
  checksum: string;
}

// ============================================================
// SerializeOptions & DeserializeResult
// ============================================================

/**
 * 序列化选项
 */
export interface SerializeOptions {
  /** 是否启用压缩（减少存储占用，默认 true） */
  compress?: boolean;
  /** 是否美化 JSON 输出（导出用，默认 false） */
  pretty?: boolean;
  /** 是否包含校验和（默认 true） */
  includeChecksum?: boolean;
}

/**
 * 反序列化结果
 */
export interface DeserializeResult {
  /** 是否成功 */
  success: boolean;
  /** 解析出的存档数据（失败时为 null） */
  data: SaveData | null;
  /** 错误信息（成功时为空） */
  error: string;
  /** 是否经过了版本迁移 */
  migrated: boolean;
  /** 迁移前的版本（未迁移时 undefined） */
  fromVersion?: SaveVersion;
  /** 迁移后的版本（未迁移时 undefined） */
  toVersion?: SaveVersion;
}

// ============================================================
// SaveManager 操作结果
// ============================================================

/**
 * SaveManager 操作结果
 */
export interface SaveOperationResult {
  success: boolean;
  error?: string;
  /** 操作后的存档元数据（失败时为 null） */
  meta?: SaveSlotMeta;
}

/**
 * Load 操作结果
 */
export interface LoadOperationResult {
  success: boolean;
  error?: string;
  /** 加载的存档数据（失败时为 null） */
  data?: SaveData;
  /** 存档元数据 */
  meta?: SaveSlotMeta;
}

// ============================================================
// 存储配额
// ============================================================

/**
 * 存储配额信息
 */
export interface StorageQuotaInfo {
  /** 已使用字节数 */
  usedBytes: number;
  /** 总配额字节数（估算） */
  quotaBytes: number;
  /** 使用百分比 (0-100) */
  usagePercent: number;
  /** 是否超过警告阈值 */
  isWarning: boolean;
  /** 是否接近配额上限 */
  isCritical: boolean;
}

// ============================================================
// 常量
// ============================================================

/** 每个存档槽位的 localStorage 键名前缀 */
export const SAVE_SLOT_KEY_PREFIX = 'ain_save_slot_';

/** 每个存档槽位元数据的 localStorage 键名前缀 */
export const SAVE_META_KEY_PREFIX = 'ain_save_meta_';

/** 最大存档槽位数 */
export const MAX_SAVE_SLOTS = 3;

/** localStorage 估算配额（5MB = 5,242,880 bytes） */
export const LOCALSTORAGE_QUOTA_BYTES = 5 * 1024 * 1024;

/** 存储使用警告阈值（80%） */
export const STORAGE_WARNING_THRESHOLD = 0.8;

/** 存���使用严重阈值（95%） */
export const STORAGE_CRITICAL_THRESHOLD = 0.95;

/** 单个存档估算最大大小（约 1MB） */
export const MAX_SAVE_SIZE_BYTES = 1 * 1024 * 1024;

/** 自动存档间隔（毫秒） — 15 分钟 */
export const AUTO_SAVE_INTERVAL_MS = 15 * 60 * 1000;

/** 构建槽位存储键 */
export function getSlotKey(slotIndex: number): string {
  return `${SAVE_SLOT_KEY_PREFIX}${slotIndex}`;
}

/** 构建槽位元数据键 */
export function getMetaKey(slotIndex: number): string {
  return `${SAVE_META_KEY_PREFIX}${slotIndex}`;
}
