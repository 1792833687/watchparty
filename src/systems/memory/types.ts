/**
 * 记忆引擎类型定义 — AI Narrator Game
 *
 * @description
 * 严格对齐 GDD memory-engine.md §2.5, §2.6, §3, §4.1。
 * EntityType / RelationType / EventType / EventTag 使用 string literal union
 * 同时导出 const 数组用于运行时迭代。
 *
 * @see docs/gdd/memory-engine.md
 */

// ============================================================
// 枚举类型 (string literal unions + const arrays)
// ============================================================

/** 实体类型 — GDD §2.5 */
export type EntityType =
  | 'character'
  | 'location'
  | 'item'
  | 'faction'
  | 'event'
  | 'concept'
  | 'quest';

export const ENTITY_TYPES: readonly EntityType[] = [
  'character',
  'location',
  'item',
  'faction',
  'event',
  'concept',
  'quest',
] as const;

/** 关系类型 — GDD §2.6 */
export type RelationType =
  // 社交关系
  | 'ALLY'
  | 'ENEMY'
  | 'NEUTRAL'
  | 'FRIEND'
  | 'LOVER'
  | 'FAMILY'
  | 'RIVAL'
  | 'MENTOR'
  | 'STUDENT'
  // 空间关系
  | 'LOCATED_AT'
  | 'ORIGIN_OF'
  // 从属关系
  | 'PART_OF'
  | 'OWNS'
  | 'OWED_BY'
  // 因果/事件关系
  | 'CAUSED_BY'
  | 'TRIGGERED'
  | 'KNOWS_OF';

export const RELATION_TYPES: readonly RelationType[] = [
  'ALLY',
  'ENEMY',
  'NEUTRAL',
  'FRIEND',
  'LOVER',
  'FAMILY',
  'RIVAL',
  'MENTOR',
  'STUDENT',
  'LOCATED_AT',
  'ORIGIN_OF',
  'PART_OF',
  'OWNS',
  'OWED_BY',
  'CAUSED_BY',
  'TRIGGERED',
  'KNOWS_OF',
] as const;

/** 事件类型 — GDD §3 */
export type EventType =
  | 'dialogue'
  | 'action'
  | 'state_change'
  | 'discovery'
  | 'decision'
  | 'combat'
  | 'travel';

export const EVENT_TYPES: readonly EventType[] = [
  'dialogue',
  'action',
  'state_change',
  'discovery',
  'decision',
  'combat',
  'travel',
] as const;

/** 事件标签 — GDD §3 */
export type EventTag =
  | 'golden'
  | 'danger'
  | 'magic'
  | 'hook'
  | 'resolution'
  | 'betrayal';

export const EVENT_TAGS: readonly EventTag[] = [
  'golden',
  'danger',
  'magic',
  'hook',
  'resolution',
  'betrayal',
] as const;

/** 重要性等级 — GDD §2.2 */
export type ImportanceLevel = 1 | 2 | 3;

// ============================================================
// 压缩模式
// ============================================================

/** 压缩模式 */
export type CompressionMode = 'gentle' | 'aggressive';

/** 压缩结果 */
export interface CompressedResult {
  /** 压缩后保留的事件 */
  retained: EventLogEntry[];
  /** 被移除的事件 */
  removed: EventLogEntry[];
  /** 压缩后生成的摘要文本（仅在激进模式下非空） */
  summary: string;
  /** 压缩前事件数 */
  originalCount: number;
  /** 压缩后保留数 */
  retainedCount: number;
}

// ============================================================
// 实体与关系 — GDD §2.5, §2.6, §3.1
// ============================================================

/** 记忆实体 — GDD §3.1 */
export interface MemoryEntity {
  id: string;
  name: string;
  type: EntityType;
  aliases: string[];
  attributes: Record<string, unknown>;
  firstSeenAt: number;
  lastSeenAt: number;
  occurrenceCount: number;
  importance: ImportanceLevel;
  isActive: boolean;
}

/** 关系 — GDD §2.6 + §3.1 合并 */
export interface Relation {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type: RelationType;
  strength: number; // 0.0 ~ 1.0
  evidence: string[]; // 来源事件 ID 列表
  establishedAt: number;
  lastUpdatedAt: number;
  // FIX: BUG-2 — 关系提取阶段暂存名称，由 MemoryEngine 解析为 ID
  fromEntityName?: string;
  toEntityName?: string;
}

/** 实体提取器输出 — GDD §2.5 */
export interface ExtractedEntity {
  name: string;
  type: EntityType;
  attributes: Record<string, string | number | boolean>;
  confidence: number; // 0.0 ~ 1.0
  sourceEventId: string;
}

// ============================================================
// 事件日志 — GDD §3.1
// ============================================================

/** 事件日志条目 — GDD §3.1 */
export interface EventLogEntry {
  id: string;
  sessionId: string;
  type: EventType;
  timestamp: number;
  importance: ImportanceLevel;
  summary: string; // ≤ 140 chars
  detail: string;
  entitiesExtracted: string[];
  relationsUpdated: string[];
  tags: EventTag[];
  precedingEventId: string | null;
}

// ============================================================
// 记忆图谱 — GDD §3.1
// ============================================================

/** 图谱元数据 — GDD §3.1 */
export interface GraphMetadata {
  totalSessions: number;
  currentSessionId: string;
  createdAt: number;
  lastUpdatedAt: number;
  worldName: string;
  gameSettingId: string;
}

/** 记忆图谱 — GDD §3.1 */
export interface MemoryGraph {
  version: string;
  entities: Map<string, MemoryEntity>;
  relations: Map<string, Relation>;
  eventLog: EventLogEntry[];
  metadata: GraphMetadata;
}

// ============================================================
// 世界状态摘要 — GDD §3.1 (SessionMemory 子结构)
// 注意：与 WorldStore 的 WorldStateDigest 是互补关系，
// 记忆引擎使用此版本记录会话结束时的世界快照。
// ============================================================

/** 世界状态摘要 — GDD §3.1 */
export interface WorldStateDigest {
  playerLocation: string;
  playerHp: number;
  playerMp: number;
  activeQuests: string[];
  factionStandings: Record<string, number>;
  inventorySummary: string[];
}

// ============================================================
// 短期记忆 — GDD §3.1
// ============================================================

/** 关键事件摘要 — GDD §2.2 + §3.1 */
export interface KeyEventDigest {
  id: string;
  eventLogId: string;
  type: EventType;
  summary: string; // ≤ 140 chars
  importance: ImportanceLevel;
  entitiesInvolved: string[];
  tags: EventTag[];
  timestamp: number;
}

/** 关系变化量 — GDD §3.1 */
export interface RelationDelta {
  relationId: string;
  fromEntityId: string;
  toEntityId: string;
  type: RelationType;
  strengthBefore: number;
  strengthAfter: number;
  reason: string;
}

/** 未解决悬念 — GDD §3.1 */
export interface UnresolvedHook {
  id: string;
  description: string;
  relatedEntityId: string;
  createdInSessionId: string;
  urgency: 1 | 2 | 3;
}

/** 会话记忆 — GDD §3.1 */
export interface SessionMemory {
  sessionId: string;
  startedAt: number;
  endedAt: number | null;
  keyEvents: KeyEventDigest[];
  relationshipDeltas: RelationDelta[];
  worldStateDigest: WorldStateDigest;
  unresolvedHooks: UnresolvedHook[];
  playerIntentGuess: string;
}

// ============================================================
// 上下文检索请求/响应 — GDD §3.1, §4.2
// ============================================================

/** 记忆检索请求 — GDD §3.1 */
export interface MemoryRetrievalRequest {
  currentLocation: string;
  nearbyEntities: string[];
  activeQuestIds: string[];
  playerInput: string;
  maxTokens: number;
  includeLastSession: boolean;
}

/** 实体快照（供 UI 侧使用）— GDD §3.1 */
export interface MemoryEntitySnapshot {
  id: string;
  name: string;
  type: EntityType;
  aliases: string[];
  importance: ImportanceLevel;
  summary: string;
}

/** 记忆检索响应 — GDD §3.1 */
export interface MemoryRetrievalResponse {
  contextBlock: string;
  entitiesCached: MemoryEntitySnapshot[];
  tokenCount: number;
  retrievalMeta: {
    entitiesMatched: number;
    eventsMatched: number;
    relationsMatched: number;
    retrievalTimeMs: number;
  };
}

// ============================================================
// 引擎配置 — GDD §4.1
// ============================================================

/** 记忆引擎配置 — GDD §4.1 */
export interface MemoryEngineConfig {
  maxImmediateEvents: number; // 默认 200
  shortTermSessionLimit: number; // 默认 5
  compressionThreshold: number; // 默认 200
  enableLongTerm: boolean; // MVP: false
}

export const DEFAULT_MEMORY_ENGINE_CONFIG: MemoryEngineConfig = {
  maxImmediateEvents: 200,
  shortTermSessionLimit: 5,
  compressionThreshold: 200,
  enableLongTerm: false,
};

// ============================================================
// IMemoryEngine — GDD §4.1
// ============================================================

/** 记忆引擎主接口 — GDD §4.1 */
export interface IMemoryEngine {
  init(config: MemoryEngineConfig): Promise<void>;
  shutdown(): Promise<void>;

  ingest(event: EventLogEntry): Promise<void>;
  ingestBatch(events: EventLogEntry[]): Promise<void>;

  retrieveForContext(
    req: MemoryRetrievalRequest
  ): Promise<MemoryRetrievalResponse>;

  getEntity(id: string): MemoryEntity | undefined;
  searchEntities(query: string, limit?: number): MemoryEntity[];
  getRelation(fromId: string, toId: string): Relation | undefined;
  getEntityRelations(entityId: string): Relation[];

  getLastSessionSummary(): SessionMemory | undefined;
  getCurrentSessionEventCount(): number;

  getUnresolvedHooks(): UnresolvedHook[];
  exportGraph(): MemoryGraph;
}

// ============================================================
// 序列化辅助 — Map 与 JSON 互转
// ============================================================

/** 将 Map<string, T> 序列化为 JSON 安全格式 */
export function serializeMap<T>(map: Map<string, T>): Record<string, T> {
  const obj: Record<string, T> = {};
  for (const [key, value] of map.entries()) {
    obj[key] = value;
  }
  return obj;
}

/** 从 JSON 安全格式反序列化为 Map<string, T> */
export function deserializeMap<T>(obj: Record<string, T>): Map<string, T> {
  const map = new Map<string, T>();
  for (const [key, value] of Object.entries(obj)) {
    map.set(key, value);
  }
  return map;
}

/** 将完整的 MemoryGraph 序列化为 JSON 兼容对象 */
export function serializeGraph(graph: MemoryGraph): Record<string, unknown> {
  return {
    version: graph.version,
    entities: serializeMap(graph.entities),
    relations: serializeMap(graph.relations),
    eventLog: graph.eventLog,
    metadata: graph.metadata,
  };
}

/** 从 JSON 兼容对象反序列化为 MemoryGraph */
export function deserializeGraph(data: Record<string, unknown>): MemoryGraph {
  return {
    version: String(data['version'] ?? '1.0.0'),
    entities: deserializeMap<MemoryEntity>(
      (data['entities'] as Record<string, MemoryEntity>) ?? {}
    ),
    relations: deserializeMap<Relation>(
      (data['relations'] as Record<string, Relation>) ?? {}
    ),
    eventLog: (data['eventLog'] as EventLogEntry[]) ?? [],
    metadata: data['metadata'] as GraphMetadata,
  };
}
