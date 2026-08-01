/**
 * StorageSync — 记忆引擎存储同步
 *
 * @description
 * 负责短期记忆 ↔ localStorage、长期记忆 ↔ IndexedDB 的持久化同步。
 * MVP 阶段：长期记忆为 Should Have 占位，仅实现 localStorage 短期记忆。
 *
 * 降级策略（GDD §6.1）:
 * IndexedDB 不可用 → localStorage
 * localStorage 不可用 → 内存模式（仅即时记忆，刷新丢失）
 *
 * @see GDD §3.2, §6.1
 */

import type { IStorageAdapter } from '@/infrastructure/storage/IStorageAdapter';
import type { MemoryGraph, SessionMemory } from './types';
import { serializeGraph, deserializeGraph } from './types';

// ============================================================
// 存储键常量
// ============================================================

const KEY_MEMORY_GRAPH = 'memory-graph';
const KEY_SESSION_MEMORIES = 'session-memories';
const KEY_CURRENT_SESSION_ID = 'current-session-id';
const KEY_SESSION_COUNT = 'session-count';
const KEY_COMPRESSION_LOG = 'compression-log';

// ============================================================
// StorageSync 类
// ============================================================

export class StorageSync {
  private shortTermAdapter: IStorageAdapter;
  private longTermAdapter: IStorageAdapter | null;
  private memoryFallback: boolean = false;
  /**
   * FIX: ERR-2 — 存储降级通知回调，由外部注册（如 UI Toast）
   */
  onStorageDegraded: ((reason: string) => void) | null = null;

  /**
   * @param shortTermAdapter - 短期存储适配器（通常为 localStorage）
   * @param longTermAdapter - 长期存储适配器（通常为 IndexedDB），MVP 可为 null
   */
  constructor(
    shortTermAdapter: IStorageAdapter,
    longTermAdapter: IStorageAdapter | null = null
  ) {
    this.shortTermAdapter = shortTermAdapter;
    this.longTermAdapter = longTermAdapter;
  }

  /**
   * 检查短期存储是否可用。
   */
  async isShortTermAvailable(): Promise<boolean> {
    try {
      return await this.shortTermAdapter.isAvailable();
    } catch {
      return false;
    }
  }

  /**
   * 检查长期存储是否可用。
   */
  async isLongTermAvailable(): Promise<boolean> {
    if (!this.longTermAdapter) return false;
    try {
      return await this.longTermAdapter.isAvailable();
    } catch {
      return false;
    }
  }

  /**
   * 是否已进入内存降级模式。
   */
  get isMemoryFallback(): boolean {
    return this.memoryFallback;
  }

  // ---------------------------------------------------------------------------
  // 短期记忆 (localStorage)
  // ---------------------------------------------------------------------------

  /**
   * 保存记忆图谱到短期存储。
   */
  async saveShortTerm(graph: MemoryGraph): Promise<void> {
    try {
      const serialized = serializeGraph(graph);
      await this.shortTermAdapter.set(KEY_MEMORY_GRAPH, serialized);
    } catch (err) {
      console.warn('[StorageSync] Failed to save short-term memory:', err);
      // FIX: ERR-2 — 存储降级时通知用户
      if (!this.memoryFallback) {
        this.memoryFallback = true;
        this.onStorageDegraded?.('短期存储不可用，记忆数据仅保存在内存中，刷新页面后将丢失。');
      }
    }
  }

  /**
   * 从短期存储加载记忆图谱。
   *
   * @returns 图谱或 null（首次启动/数据损坏）
   */
  async loadShortTerm(): Promise<MemoryGraph | null> {
    try {
      const data = await this.shortTermAdapter.get<Record<string, unknown>>(
        KEY_MEMORY_GRAPH
      );
      if (!data) return null;

      // 基本校验
      if (!data['version'] || !data['metadata']) {
        console.warn('[StorageSync] Short-term data corrupted, discarding.');
        return null;
      }

      return deserializeGraph(data);
    } catch (err) {
      console.warn('[StorageSync] Failed to load short-term memory:', err);
      return null;
    }
  }

  /**
   * 保存会话记忆列表到短期存储。
   */
  async saveSessionMemories(sessions: SessionMemory[]): Promise<void> {
    try {
      await this.shortTermAdapter.set(KEY_SESSION_MEMORIES, sessions);
    } catch (err) {
      console.warn('[StorageSync] Failed to save session memories:', err);
    }
  }

  /**
   * 从短期存储加载会话记忆列表。
   */
  async loadSessionMemories(): Promise<SessionMemory[]> {
    try {
      const data =
        await this.shortTermAdapter.get<SessionMemory[]>(
          KEY_SESSION_MEMORIES
        );
      return data ?? [];
    } catch (err) {
      console.warn('[StorageSync] Failed to load session memories:', err);
      return [];
    }
  }

  /**
   * 保存当前会话 ID。
   */
  async saveCurrentSessionId(sessionId: string): Promise<void> {
    try {
      await this.shortTermAdapter.set(KEY_CURRENT_SESSION_ID, sessionId);
    } catch {
      // 非关键操作
    }
  }

  /**
   * 加载当前会话 ID。
   */
  async loadCurrentSessionId(): Promise<string | null> {
    try {
      return await this.shortTermAdapter.get<string>(
        KEY_CURRENT_SESSION_ID
      );
    } catch {
      return null;
    }
  }

  /**
   * 保存会话计数。
   */
  async saveSessionCount(count: number): Promise<void> {
    try {
      await this.shortTermAdapter.set(KEY_SESSION_COUNT, count);
    } catch {
      // 非关键操作
    }
  }

  /**
   * 加载会话计数。
   */
  async loadSessionCount(): Promise<number> {
    try {
      return (await this.shortTermAdapter.get<number>(KEY_SESSION_COUNT)) ?? 0;
    } catch {
      return 0;
    }
  }

  // ---------------------------------------------------------------------------
  // 长期记忆 (IndexedDB) — Should Have 占位
  // ---------------------------------------------------------------------------

  /**
   * 保存记忆图谱到长期存储。
   * MVP 阶段：如果长期存储可用则使用，否则静默跳过。
   */
  async saveLongTerm(graph: MemoryGraph): Promise<void> {
    if (!this.longTermAdapter) return;

    try {
      const available = await this.longTermAdapter.isAvailable();
      if (!available) return;

      const serialized = serializeGraph(graph);
      await this.longTermAdapter.set(KEY_MEMORY_GRAPH, serialized);
    } catch (err) {
      console.warn('[StorageSync] Failed to save long-term memory:', err);
      // 静默降级
    }
  }

  /**
   * 从长期存储加载记忆图谱。
   * MVP 阶段：如果长期存储可用则尝试加载，否则返回 null。
   */
  async loadLongTerm(): Promise<MemoryGraph | null> {
    if (!this.longTermAdapter) return null;

    try {
      const available = await this.longTermAdapter.isAvailable();
      if (!available) return null;

      const data = await this.longTermAdapter.get<Record<string, unknown>>(
        KEY_MEMORY_GRAPH
      );
      if (!data) return null;

      return deserializeGraph(data);
    } catch (err) {
      console.warn('[StorageSync] Failed to load long-term memory:', err);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // 降级与清理
  // ---------------------------------------------------------------------------

  /**
   * 清除所有短期存储数据。
   */
  async clearShortTerm(): Promise<void> {
    try {
      await this.shortTermAdapter.remove(KEY_MEMORY_GRAPH);
      await this.shortTermAdapter.remove(KEY_SESSION_MEMORIES);
      await this.shortTermAdapter.remove(KEY_CURRENT_SESSION_ID);
      await this.shortTermAdapter.remove(KEY_SESSION_COUNT);
    } catch {
      // 清理失败不阻塞
    }
  }

  /**
   * 紧急压缩：当 localStorage 配额不足时，删除最早的会话记忆。
   */
  async emergencyCompact(
    sessions: SessionMemory[],
    keepCount: number = 5
  ): Promise<SessionMemory[]> {
    if (sessions.length <= keepCount) return sessions;

    // 按结束时间排序，保留最近的 keepCount 个
    const sorted = [...sessions].sort(
      (a, b) =>
        (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt)
    );
    const retained = sorted.slice(0, keepCount);

    try {
      await this.saveSessionMemories(retained);
    } catch {
      // 静默降级
    }

    return retained;
  }
}
