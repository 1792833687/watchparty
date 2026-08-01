/**
 * Compressor — 两阶段记忆压缩器
 *
 * @description
 * 当即时记忆条目超出阈值时触发压缩：
 *
 * 温和压缩 (gentle): 200 条 → 按 importance 排序 + 低重要性合并 → 目标 ≤ 80 条
 * 激进压缩 (aggressive): 500 条 → 进一步合并 + 生成摘要 → 目标 ≤ 100 条
 *
 * 算法 (GDD §2.3):
 * 1. 按 importance 排序（decision > discovery > combat > dialogue > travel > state_change）
 * 2. 低重要性条目 (importance=1) 合并：连续同类型/同实体的条目合并为一条摘要
 * 3. 旧条目（超过 50 条新事件之前）的高重要性条目保留原文，但元数据精简
 * 4. 压缩后目标: ≤ 80 条（温和）/ ≤ 100 条（激进）
 *
 * @see GDD §2.3, §6.2
 */

import type {
  CompressionMode,
  CompressedResult,
  EventLogEntry,
  EventType,
  ImportanceLevel,
} from './types';
import { generateUUID } from '@/lib/utils/id';

// ============================================================
// importance 排序权重（越高越优先保留）
// ============================================================

const IMPORTANCE_SORT_ORDER: Record<EventType, number> = {
  decision: 100,
  discovery: 90,
  combat: 80,
  dialogue: 60,
  travel: 40,
  action: 30,
  state_change: 20,
};

/** 温和压缩目标条数 */
const GENTLE_TARGET = 80;

/** 激进压缩目标条数 */
const AGGRESSIVE_TARGET = 100;

/** 激进压缩触发阈值 */
const AGGRESSIVE_THRESHOLD = 500;

/** 温和压缩触发阈值 */
const GENTLE_THRESHOLD = 200;

// ============================================================
// Compressor 类
// ============================================================

export class Compressor {
  /**
   * 压缩事件列表。
   *
   * @param events - 待压缩的事件数组
   * @param mode - 压缩模式
   * @returns 压缩结果
   */
  compress(events: EventLogEntry[], mode: CompressionMode): CompressedResult {
    const originalCount = events.length;

    if (events.length === 0) {
      return {
        retained: [],
        removed: [],
        summary: '',
        originalCount: 0,
        retainedCount: 0,
      };
    }

    const targetCount =
      mode === 'gentle' ? GENTLE_TARGET : AGGRESSIVE_TARGET;

    // 如果事件数未超出目标，不需要压缩
    if (events.length <= targetCount) {
      return {
        retained: [...events],
        removed: [],
        summary: '',
        originalCount,
        retainedCount: events.length,
      };
    }

    // 1. 按优先级排序（高优先级在前）
    const sorted = [...events].sort((a, b) => {
      // 首先按 score 降序
      const scoreA = this.eventScore(a);
      const scoreB = this.eventScore(b);
      if (scoreB !== scoreA) return scoreB - scoreA;
      // 然后按 importance 降序
      if (b.importance !== a.importance) return b.importance - a.importance;
      // 最后按时间戳降序（新的在前）
      return b.timestamp - a.timestamp;
    });

    // 2. 保留前 targetCount 条高优先级事件
    const retained: EventLogEntry[] = [];
    const removed: EventLogEntry[] = [];

    // 保留 importance=3 的全部事件（金光事件不可丢弃）
    const goldenEvents = sorted.filter((e) => e.importance === 3);
    const remainingSlots = Math.max(0, targetCount - goldenEvents.length);

    // 取 importance=2 和 importance=1 的事件
    const otherEvents = sorted.filter((e) => e.importance !== 3);

    // 高优先级填充
    const toRetain = [
      ...goldenEvents,
      ...otherEvents.slice(0, remainingSlots),
    ];
    const toRemove = otherEvents.slice(remainingSlots);

    // 3. 对被移除的低重要性条目生成合并摘要
    let summary = '';
    if (mode === 'aggressive' && toRemove.length > 0) {
      summary = this.buildSummary(toRemove);
    }

    // 4. 按时间戳重新排序保留的事件
    toRetain.sort((a, b) => a.timestamp - b.timestamp);

    return {
      retained: toRetain,
      removed: toRemove,
      summary,
      originalCount,
      retainedCount: toRetain.length,
    };
  }

  /**
   * 根据当前事件数自动选择合适的压缩模式。
   */
  static autoMode(eventCount: number): CompressionMode | null {
    if (eventCount >= AGGRESSIVE_THRESHOLD) return 'aggressive';
    if (eventCount >= GENTLE_THRESHOLD) return 'gentle';
    return null; // 无需压缩
  }

  /**
   * 生成会话摘要 (KeyEventDigest 格式的精简版)。
   * 用于会话结束时生成短期记忆。
   *
   * @param events - 当前会话的关键事件
   * @param maxEntries - 最大摘要条目数（默认 20）
   */
  buildSessionSummaryEvents(
    events: EventLogEntry[],
    maxEntries: number = 20
  ): EventLogEntry[] {
    if (events.length <= maxEntries) {
      return [...events].sort((a, b) => b.timestamp - a.timestamp);
    }

    // 按事件得分排序，取 top N
    const sorted = [...events].sort((a, b) => {
      const scoreA = this.eventScore(a);
      const scoreB = this.eventScore(b);
      return scoreB - scoreA;
    });

    return sorted.slice(0, maxEntries);
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * 事件得分：importance_sort_order × importance_level + recency_bonus
   */
  private eventScore(event: EventLogEntry): number {
    const typeOrder = IMPORTANCE_SORT_ORDER[event.type] ?? 25;
    // recency bonus: 最近24h内的事件 +20%
    const ageHours = (Date.now() - event.timestamp) / (1000 * 60 * 60);
    const recencyBonus = ageHours < 24 ? 0.2 : 0;
    return typeOrder * event.importance * (1 + recencyBonus);
  }

  /**
   * 为被移除的事件生成摘要文本。
   */
  private buildSummary(removed: EventLogEntry[]): string {
    if (removed.length === 0) return '';

    // 按类型分组统计
    const typeCounts = new Map<string, number>();
    const entityMentions = new Map<string, number>();
    const keyPhrases: string[] = [];

    for (const event of removed) {
      const type = event.type;
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);

      for (const entityId of event.entitiesExtracted) {
        entityMentions.set(
          entityId,
          (entityMentions.get(entityId) ?? 0) + 1
        );
      }

      // 收集 importance=2 的事件的摘要（重要但不至于保留全文）
      if (event.importance >= 2 && event.summary) {
        keyPhrases.push(event.summary);
      }
    }

    const parts: string[] = [];
    parts.push(`[压缩摘要: ${removed.length} 条事件]`);

    if (typeCounts.size > 0) {
      const typeSummary = Array.from(typeCounts.entries())
        .map(([type, count]) => `${type}×${count}`)
        .join(', ');
      parts.push(`事件类型: ${typeSummary}`);
    }

    if (keyPhrases.length > 0) {
      // 取前 5 条关键摘要
      const topPhrases = keyPhrases.slice(0, 5);
      parts.push(`关键内容: ${topPhrases.join('; ')}`);
    }

    return parts.join('\n');
  }
}
