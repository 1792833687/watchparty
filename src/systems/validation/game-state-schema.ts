/**
 * v4.1.0 Zod 校验层 — AI 输出结构化验证
 * 基于 acto 项目的 Zod 模式设计。
 * 所有从 AI 解析的 GAMESTATE / OPTIONS 块均通过此模块校验。
 * @module systems/validation/game-state-schema
 */

import { z } from 'zod';

// ============================================================
// OPTIONS 块 Schema
// ============================================================

const OptionConditionSchema = z.object({
  type: z.enum(['attr', 'skill', 'item', 'gold', 'corruption']),
  key: z.string().min(1),
  value: z.number().int().optional(),
}).optional();

export const DialogueOptionSchema = z.object({
  id: z.string().min(1, '选项 ID 不能为空'),
  text: z.string().min(1, '选项文本不能为空'),
  emoji: z.string().optional(),
  hint: z.string().optional(),
  style: z.enum(['default', 'bold', 'cautious', 'aggressive']).optional(),
  condition: OptionConditionSchema,
});

export const DialogueOptionsArraySchema = z.array(DialogueOptionSchema);

// ============================================================
// GAMESTATE 块 Schema
// ============================================================

export const ItemEffectSchema = z.object({
  hp: z.number().optional(),
  mp: z.number().optional(),
  attr: z.string().optional(),
  value: z.number().optional(),
}).optional();

export const GameItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  emoji: z.string().optional(),
  type: z.enum([
    'consumable', 'weapon', 'armor', 'tool', 'key',
    'magic', 'treasure', 'resource', 'quest', 'document',
  ]).optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  effect: ItemEffectSchema,
  quantity: z.number().int().positive().optional(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']).optional(),
  damageType: z.string().optional(),
  magicSchool: z.string().optional(),
  lore: z.string().optional(),
  sources: z.array(z.string()).optional(),
  stats: z.record(z.string(), z.number()).optional(),
  basePrice: z.number().optional(),
  equippable: z.boolean().optional(),
  stackable: z.boolean().optional(),
});

export const GameQuestSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['main', 'side']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  status: z.enum(['active', 'completed', 'failed']).optional(),
});

export const RelationshipUpdateSchema = z.object({
  id: z.string().min(1),
  revealLevel: z.number().int().min(0).max(3).optional(),
  affinity: z.number().int().min(-100).max(100).optional(),
  loyalty: z.number().int().min(0).max(100).optional(),
});

/** v4.2.0: 动态角色加入关系链 */
export const DynamicNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  codename: z.string().optional(),
  role: z.string().optional(),
  emoji: z.string().optional(),
  race: z.string().optional(),
  affinity: z.number().int().min(-100).max(100).optional(),
  loyalty: z.number().int().min(0).max(100).optional(),
  appearance: z.string().optional(),
  memory: z.string().optional(),
});

/** v4.2.0: 大陆快讯（AI 动态生成） */
export const NewsItemSchema = z.object({
  type: z.enum(['official', 'war', 'rumor', 'prophecy', 'quest']).optional(),
  title: z.string().min(1),
  body: z.string().min(1),
  day: z.number().int().optional(),
});

/** v4.2.0: 世界书自动记录条目（AI 根据剧情写入） */
export const WorldLogSchema = z.object({
  section: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  id: z.string().optional(),
});

export const GameStateSchema = z.object({
  items: z.array(GameItemSchema).optional(),
  quests: z.array(GameQuestSchema).optional(),
  currentLocation: z.string().optional(),
  currentLocationDescription: z.string().optional(),
  relationships: z.array(RelationshipUpdateSchema).optional(),
  /** v4.1.0: 阵营声望增量（world-setting 10.2） */
  factionReputations: z.record(z.string(), z.number()).optional(),
  /** v4.1.0: 结局条件进度（world-setting 十一·多结局） */
  endingFlags: z.record(z.string(), z.number()).optional(),
  /** v4.2.0: 习得技能（技能名数组，剧情获取） */
  skills: z.array(z.string()).optional(),
  /** v4.2.0: 大陆快讯推送 */
  news: z.array(NewsItemSchema).optional(),
  /** v4.2.0: 世界书自动记录 */
  worldLog: z.array(WorldLogSchema).optional(),
  /** v4.2.0: 关系链动态角色 */
  dynamicNodes: z.array(DynamicNodeSchema).optional(),
  /** v4.2.1 (P0-6): 货币钱包增量（AI 叙事奖励入账，gold/silver/copper/shard） */
  wallet: z.object({
    gold: z.number().int().optional(),
    silver: z.number().int().optional(),
    copper: z.number().int().optional(),
    shard: z.number().int().optional(),
  }).optional(),
  /** v4.2.1 (P0-4): 领地资源增量（AI 叙事奖励发放：战斗缴获/任务奖励） */
  territory: z.object({
    resources: z.object({
      stone: z.number().int().optional(),
      wood: z.number().int().optional(),
      iron: z.number().int().optional(),
      grain: z.number().int().optional(),
      crystal: z.number().int().optional(),
    }).optional(),
  }).optional(),
  /** v5.0.0 (叙事 P0-2): 预兆梦进度（主角弧光 — 梦境随堕落值变异，随存档走） */
  propheticDream: z.object({
    count: z.number().int().optional(),
    last: z.string().optional(),
    motif: z.string().optional(),
  }).optional(),
  /** v5.0.0 (叙事 P1-5): 凛冬议会决策（场景级分支 — 影响围城战形态与同伴忠诚） */
  councilDecision: z.string().optional(),
  /** v5.0.0 (叙事 P1-3): 镜像反派鸦羽剧情标记（低语呼应次数/已现身） */
  crowFeather: z.object({
    echoes: z.number().int().optional(),
    revealed: z.boolean().optional(),
    confront: z.boolean().optional(),
  }).optional(),
});

// ============================================================
// 类型推断（直接从 Schema 导出类型）
// ============================================================

export type ValidatedDialogueOption = z.infer<typeof DialogueOptionSchema>;
export type ValidatedGameState = z.infer<typeof GameStateSchema>;
export type ValidatedGameItem = z.infer<typeof GameItemSchema>;
export type ValidatedGameQuest = z.infer<typeof GameQuestSchema>;
export type ValidatedRelationship = z.infer<typeof RelationshipUpdateSchema>;

// ============================================================
// 安全解析函数
// ============================================================

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; /** 修复后的数据 */ partial?: T };

/**
 * 安全解析 GameState JSON。
 * 对非法字段自动过滤而非整体拒绝，提高容错性。
 */
export function safeParseGameState(jsonStr: string): ParseResult<ValidatedGameState> {
  try {
    const raw = JSON.parse(jsonStr) as unknown;
    const result = GameStateSchema.safeParse(raw);
    if (result.success) return { ok: true, data: result.data };

    // 尝试逐字段修复
    const partial: Record<string, unknown> = {};
    const errors: string[] = [];
    const rawObj = raw as Record<string, unknown>;

    if ('items' in rawObj) {
      const itemsResult = z.array(GameItemSchema).safeParse(rawObj.items);
      if (itemsResult.success) partial.items = itemsResult.data;
      else errors.push(`items: ${itemsResult.error.message}`);
    }
    if ('quests' in rawObj) {
      const questsResult = z.array(GameQuestSchema).safeParse(rawObj.quests);
      if (questsResult.success) partial.quests = questsResult.data;
      else errors.push(`quests: ${questsResult.error.message}`);
    }
    if ('currentLocation' in rawObj && typeof rawObj.currentLocation === 'string') {
      partial.currentLocation = rawObj.currentLocation;
    }
    if ('currentLocationDescription' in rawObj && typeof rawObj.currentLocationDescription === 'string') {
      partial.currentLocationDescription = rawObj.currentLocationDescription;
    }
    if ('relationships' in rawObj) {
      const relsResult = z.array(RelationshipUpdateSchema).safeParse(rawObj.relationships);
      if (relsResult.success) partial.relationships = relsResult.data;
      else errors.push(`relationships: ${relsResult.error.message}`);
    }
    if ('factionReputations' in rawObj && rawObj.factionReputations !== null && typeof rawObj.factionReputations === 'object') {
      const fr = z.record(z.string(), z.number()).safeParse(rawObj.factionReputations);
      if (fr.success) partial.factionReputations = fr.data;
      else errors.push(`factionReputations: ${fr.error.message}`);
    }
    if ('endingFlags' in rawObj && rawObj.endingFlags !== null && typeof rawObj.endingFlags === 'object') {
      const ef = z.record(z.string(), z.number()).safeParse(rawObj.endingFlags);
      if (ef.success) partial.endingFlags = ef.data;
      else errors.push(`endingFlags: ${ef.error.message}`);
    }

    if (Object.keys(partial).length > 0) {
      return { ok: false, error: errors.join('; '), partial: partial as ValidatedGameState };
    }
    return { ok: false, error: result.error.message };
  } catch {
    return { ok: false, error: 'JSON 解析失败：非法的 JSON 格式' };
  }
}

/**
 * 安全解析 DialogueOptions JSON 数组。
 */
export function safeParseDialogueOptions(jsonStr: string): ParseResult<ValidatedDialogueOption[]> {
  try {
    const raw = JSON.parse(jsonStr) as unknown;
    const result = DialogueOptionsArraySchema.safeParse(raw);
    if (result.success) return { ok: true, data: result.data };

    // 尝试逐项验证，过滤非法项
    if (Array.isArray(raw)) {
      const valid: ValidatedDialogueOption[] = [];
      const errors: string[] = [];
      for (const item of raw) {
        const r = DialogueOptionSchema.safeParse(item);
        if (r.success) valid.push(r.data);
        else errors.push(r.error.message);
      }
      if (valid.length > 0) {
        return { ok: false, error: `部分选项无效: ${errors.join('; ')}`, partial: valid };
      }
    }
    return { ok: false, error: result.error.message };
  } catch {
    return { ok: false, error: 'OPTIONS JSON 解析失败' };
  }
}
