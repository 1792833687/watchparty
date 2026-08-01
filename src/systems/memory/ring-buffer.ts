/**
 * RingBuffer — 固定容量循环缓冲区
 *
 * @description
 * 即时记忆的事件存储。容量固定（默认 200），溢出时按 importance 优先级
 * 淘汰低重要性条目，确保关键事件（importance=3）尽可能不被丢弃。
 *
 * 特性：
 * - O(1) push / peek / last
 * - O(n log n) 溢出驱逐（仅溢出时触发）
 * - 线程安全：所有操作同步完成
 *
 * @see GDD §2.2.1 即时记忆
 */

import type { EventLogEntry, ImportanceLevel } from './types';

/**
 * importance 权重映射 — importance=3 的权重是 1 的 9 倍，
 * 确保高重要性事件在驱逐时具有压倒性优势。
 */
const IMPORTANCE_WEIGHT: Record<ImportanceLevel, number> = {
  1: 1,
  2: 3,
  3: 9,
};

export class RingBuffer {
  private buffer: EventLogEntry[];
  private head: number = 0;
  private _size: number = 0;
  private readonly capacity: number;

  /**
   * @param capacity - 最大容量，默认 200
   */
  constructor(capacity: number = 200) {
    if (capacity < 1) {
      throw new Error(`RingBuffer capacity must be >= 1, got ${capacity}`);
    }
    this.capacity = capacity;
    this.buffer = new Array<EventLogEntry>(capacity);
  }

  /** 当前事件数量 */
  get size(): number {
    return this._size;
  }

  /** 是否已满 */
  get isFull(): boolean {
    return this._size >= this.capacity;
  }

  /** 是否为空 */
  get isEmpty(): boolean {
    return this._size === 0;
  }

  /**
   * 向缓冲区推入一条事件。
   * 如果已满，先驱逐低重要性事件再插入。
   *
   * @returns 被驱逐的事件（如果有），否则 null
   */
  push(event: EventLogEntry): EventLogEntry | null {
    let evicted: EventLogEntry | null = null;

    if (this._size >= this.capacity) {
      evicted = this.evictOne(event);
    }

    const idx = (this.head + this._size) % this.capacity;
    this.buffer[idx] = event;
    this._size++;

    return evicted;
  }

  /**
   * 查看最新 N 条事件（按时间倒序，最新的在前）。
   * 不修改缓冲区。
   *
   * @param n - 要查看的数量，默认全部
   */
  peek(n?: number): EventLogEntry[] {
    const count = n !== undefined ? Math.min(n, this._size) : this._size;
    if (count <= 0) return [];

    const result: EventLogEntry[] = [];
    for (let i = 0; i < count; i++) {
      const idx = (this.head + this._size - 1 - i + this.capacity) % this.capacity;
      result.push(this.buffer[idx]!);
    }
    return result;
  }

  /**
   * 获取最新一条事件，不修改缓冲区。
   */
  last(): EventLogEntry | undefined {
    if (this._size === 0) return undefined;
    const idx = (this.head + this._size - 1) % this.capacity;
    return this.buffer[idx];
  }

  /**
   * 将所有事件导出为数组（按插入顺序，最早的在索引 0）。
   */
  toArray(): EventLogEntry[] {
    const result: EventLogEntry[] = [];
    for (let i = 0; i < this._size; i++) {
      const idx = (this.head + i) % this.capacity;
      result.push(this.buffer[idx]!);
    }
    return result;
  }

  /**
   * 清空缓冲区。
   */
  clear(): void {
    this.buffer = new Array<EventLogEntry>(this.capacity);
    this.head = 0;
    this._size = 0;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * 驱逐一条事件，为新事件腾出空间。
   *
   * 策略（GDD §2.3 压缩策略指引）：
   * 1. 扫描全部条目，按 (importance_weight × recency_bonus) 计算得分
   * 2. recency_bonus：越近的条目 +30% 权重保护
   * 3. 得分最低的条目被驱逐
   * 4. 如果得分相同，驱逐时间戳更早的
   */
  private evictOne(incoming: EventLogEntry): EventLogEntry {
    const all = this.toArray();
    const now = Date.now();
    const maxAge = Math.max(1, now - all[0]!.timestamp);

    let worstIdx = 0;
    let worstScore = Infinity;

    for (let i = 0; i < all.length; i++) {
      const event = all[i]!;
      const age = Math.max(0, now - event.timestamp);
      // recency: 0.0 (oldest) → 1.0 (newest)
      const recency = 1.0 - age / maxAge;
      // recency_bonus: 0.0 → 0.3
      const recencyBonus = recency * 0.3;
      const score =
        IMPORTANCE_WEIGHT[event.importance] * (1.0 + recencyBonus);

      if (score < worstScore) {
        worstScore = score;
        worstIdx = i;
      } else if (score === worstScore) {
        // 平局时驱逐更早的
        if (event.timestamp < all[worstIdx]!.timestamp) {
          worstIdx = i;
        }
      }
    }

    const evicted = all[worstIdx]!;

    // 原地重建：排除被驱逐的条目，再插入新条目
    const remaining = all.filter((_, i) => i !== worstIdx);
    this.buffer = new Array<EventLogEntry>(this.capacity);
    this.head = 0;
    this._size = 0;

    // 重新插入剩余条目
    for (const e of remaining) {
      this.buffer[this._size++] = e;
    }

    return evicted;
  }
}
