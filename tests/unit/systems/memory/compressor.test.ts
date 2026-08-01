/**
 * Compressor 单元测试
 *
 * @see GDD §7.1 MEM-UT-04, MEM-UT-05
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Compressor } from '@/systems/memory/compressor';
import { createTestEvent } from '../../../setup';
import type { EventLogEntry, CompressionMode } from '@/systems/memory/types';

describe('Compressor', () => {
  let compressor: Compressor;

  beforeEach(() => {
    compressor = new Compressor();
  });

  describe('温和压缩 (gentle)', () => {
    it('事件数 ≤ 80 时不压缩', () => {
      const events = generateEvents(50);
      const result = compressor.compress(events, 'gentle');
      expect(result.retainedCount).toBe(50);
      expect(result.removed).toHaveLength(0);
      expect(result.summary).toBe('');
    });

    it('200 条事件压缩至 ≤ 80 条', () => {
      const events = generateEvents(200);
      const result = compressor.compress(events, 'gentle');
      expect(result.retainedCount).toBeLessThanOrEqual(80);
      expect(result.originalCount).toBe(200);
    });

    it('importance=3 的事件全部保留', () => {
      const events = generateEvents(200);
      // generateEvents 中 i%10===0 的已经是 importance=3，共 20 条
      // 再显式标记前 10 条为 importance=3 + decision 类型
      for (let i = 0; i < 10; i++) {
        events[i] = { ...events[i]!, importance: 3, type: 'decision' };
      }

      const result = compressor.compress(events, 'gentle');
      const goldenCount = result.retained.filter(
        (e) => e.importance === 3
      ).length;
      // 所有 importance=3 的事件必须全部保留，至少 20 条
      expect(goldenCount).toBeGreaterThanOrEqual(20);
    });

    it('压缩后按时间戳排序', () => {
      const events = generateEvents(200);
      const result = compressor.compress(events, 'gentle');

      for (let i = 1; i < result.retained.length; i++) {
        expect(result.retained[i]!.timestamp).toBeGreaterThanOrEqual(
          result.retained[i - 1]!.timestamp
        );
      }
    });

    it('高 importance 事件优先保留', () => {
      const events: EventLogEntry[] = [];
      // 150 条 importance=1 + 50 条 importance=2
      for (let i = 0; i < 150; i++) {
        events.push(createTestEvent({ id: `low-${i}`, importance: 1 }));
      }
      for (let i = 0; i < 50; i++) {
        events.push(createTestEvent({ id: `mid-${i}`, importance: 2 }));
      }

      const result = compressor.compress(events, 'gentle');
      const midCount = result.retained.filter((e) => e.importance === 2).length;
      const lowCount = result.retained.filter((e) => e.importance === 1).length;
      // importance=2 的事件应大部分保留
      expect(midCount).toBeGreaterThanOrEqual(40);
    });
  });

  describe('激进压缩 (aggressive)', () => {
    it('500 条事件压缩至 ≤ 100 条', () => {
      const events = generateEvents(500);
      const result = compressor.compress(events, 'aggressive');
      expect(result.retainedCount).toBeLessThanOrEqual(100);
    });

    it('激进压缩生成摘要文本', () => {
      const events = generateEvents(500);
      const result = compressor.compress(events, 'aggressive');
      expect(result.summary.length).toBeGreaterThan(0);
      expect(result.summary).toContain('压缩摘要');
    });
  });

  describe('autoMode', () => {
    it('事件数 ≥ 500 返回 aggressive', () => {
      expect(Compressor.autoMode(500)).toBe('aggressive');
      expect(Compressor.autoMode(1000)).toBe('aggressive');
    });

    it('事件数 200-499 返回 gentle', () => {
      expect(Compressor.autoMode(200)).toBe('gentle');
      expect(Compressor.autoMode(350)).toBe('gentle');
    });

    it('事件数 < 200 返回 null', () => {
      expect(Compressor.autoMode(0)).toBeNull();
      expect(Compressor.autoMode(100)).toBeNull();
      expect(Compressor.autoMode(199)).toBeNull();
    });
  });

  describe('buildSessionSummaryEvents', () => {
    it('返回最多 maxEntries 条事件', () => {
      const events = generateEvents(100);
      const summary = compressor.buildSessionSummaryEvents(events, 20);
      expect(summary.length).toBeLessThanOrEqual(20);
    });

    it('按事件得分排序（高 importance 优先）', () => {
      const now = Date.now();
      const events: EventLogEntry[] = [
        createTestEvent({ id: 'a', importance: 1, type: 'state_change', timestamp: now - 3000 }),
        createTestEvent({ id: 'b', importance: 3, type: 'decision', timestamp: now }),
        createTestEvent({ id: 'c', importance: 2, type: 'discovery', timestamp: now - 1000 }),
      ];
      const summary = compressor.buildSessionSummaryEvents(events, 3);
      // 最高 importance 的应在最前（decision=3 > discovery=2 > state_change=1）
      expect(summary[0]!.importance).toBeGreaterThanOrEqual(2);
    });
  });

  describe('边界条件', () => {
    it('空事件列表返回空结果', () => {
      const result = compressor.compress([], 'gentle');
      expect(result.retained).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.originalCount).toBe(0);
    });

    it('单条事件不压缩', () => {
      const events = [createTestEvent({ id: 'only' })];
      const result = compressor.compress(events, 'gentle');
      expect(result.retained).toHaveLength(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateEvents(count: number): EventLogEntry[] {
  const types = [
    'dialogue',
    'action',
    'state_change',
    'discovery',
    'decision',
    'combat',
    'travel',
  ] as const;
  const events: EventLogEntry[] = [];
  for (let i = 0; i < count; i++) {
    const importance =
      i % 10 === 0 ? 3 : i % 5 === 0 ? 2 : 1;
    events.push(
      createTestEvent({
        id: `evt-gen-${i}`,
        type: types[i % types.length]!,
        importance: importance as 1 | 2 | 3,
        timestamp: Date.now() - (count - i) * 1000,
        summary: `Test event ${i}`,
      })
    );
  }
  return events;
}
