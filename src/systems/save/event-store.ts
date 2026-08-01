/**
 * v4.1.0 事件溯源存档系统 — 基于 intra-game update-stream 架构
 * 将游戏状态变更记录为不可变事件流。
 * 支持回滚到任意事件点、重放和完整审计。
 * @module systems/save/event-store
 */

// ============================================================
// 类型
// ============================================================

export type GameEventType =
  | 'travel'
  | 'item_add'
  | 'item_remove'
  | 'quest_update'
  | 'combat'
  | 'dialogue'
  | 'relation_change'
  | 'gold_change'
  | 'region_discover'
  | 'skill_learn'
  | 'system';

export interface GameEvent {
  /** 自增 ID */
  seq: number;
  type: GameEventType;
  /** 毫秒时间戳 */
  timestamp: number;
  /** 描述摘要 */
  label: string;
  /** 结构化数据，用于重放 */
  data: Record<string, unknown>;
}

export interface EventStore {
  events: GameEvent[];
  lastSeq: number;
}

export interface Snapshot<T = unknown> {
  /** 从哪个事件号之后的快照 */
  afterSeq: number;
  /** 序列化的状态 */
  state: T;
  /** 快照时间 */
  timestamp: number;
}

// ============================================================
// 核心操作
// ============================================================

export function createEventStore(): EventStore {
  return { events: [], lastSeq: 0 };
}

export function appendEvent(store: EventStore, type: GameEventType, label: string, data: Record<string, unknown> = {}): GameEvent {
  const seq = store.lastSeq + 1;
  const event: GameEvent = { seq, type, timestamp: Date.now(), label, data };
  store.events.push(event);
  store.lastSeq = seq;
  return event;
}

/** 回滚到指定事件号之前（保留该号本身） */
export function rollbackTo(store: EventStore, targetSeq: number): GameEvent[] {
  const idx = store.events.findIndex(e => e.seq >= targetSeq);
  if (idx === -1) return [];
  const removed = store.events.splice(idx);
  store.lastSeq = store.events.length > 0 ? store.events[store.events.length - 1]!.seq : 0;
  return removed;
}

/** 获取最近 N 个事件 */
export function getRecentEvents(store: EventStore, n: number): GameEvent[] {
  return store.events.slice(-n);
}

/** 从事件流重建状态（需要外部提供 apply 函数） */
export function replayEvents<T>(
  store: EventStore,
  initial: T,
  apply: (state: T, event: GameEvent) => T,
  upToSeq?: number,
): T {
  let state = initial;
  for (const e of store.events) {
    if (upToSeq !== undefined && e.seq > upToSeq) break;
    state = apply(state, e);
  }
  return state;
}

/** 序列化事件存储为 JSON */
export function serializeStore(store: EventStore): string {
  return JSON.stringify({ events: store.events, lastSeq: store.lastSeq });
}

/** 从 JSON 反序列化 */
export function deserializeStore(json: string): EventStore {
  const parsed = JSON.parse(json) as { events: GameEvent[]; lastSeq: number };
  return { events: parsed.events, lastSeq: parsed.lastSeq };
}

/** 生成快照（事件号 + 当前状态 JSON） */
export function createSnapshot<T>(store: EventStore, state: T): Snapshot<T> {
  return {
    afterSeq: store.lastSeq,
    state,
    timestamp: Date.now(),
  };
}

/** 从快照恢复：重放快照之后的事件 */
export function restoreFromSnapshot<T>(
  store: EventStore,
  snapshot: Snapshot<T>,
  apply: (state: T, event: GameEvent) => T,
): T {
  let state = snapshot.state;
  for (const e of store.events) {
    if (e.seq > snapshot.afterSeq) {
      state = apply(state, e);
    }
  }
  return state;
}
