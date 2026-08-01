/**
 * RingBuffer 单元测试
 *
 * @see GDD §7.1 MEM-UT-01 ~ MEM-UT-04
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RingBuffer } from '@/systems/memory/ring-buffer';
import { createTestEvent } from '../../../setup';
import type { EventLogEntry } from '@/systems/memory/types';

describe('RingBuffer', () => {
  let buffer: RingBuffer;

  beforeEach(() => {
    buffer = new RingBuffer(200);
  });

  describe('基本操作', () => {
    it('初始化为空', () => {
      expect(buffer.size).toBe(0);
      expect(buffer.isEmpty).toBe(true);
      expect(buffer.isFull).toBe(false);
    });

    it('push 后 size 递增', () => {
      const event = createTestEvent({ id: 'evt-1' });
      buffer.push(event);
      expect(buffer.size).toBe(1);
      expect(buffer.isEmpty).toBe(false);
    });

    it('last() 返回最新推入的事件', () => {
      const event1 = createTestEvent({ id: 'evt-1' });
      const event2 = createTestEvent({ id: 'evt-2' });
      buffer.push(event1);
      buffer.push(event2);
      expect(buffer.last()!.id).toBe('evt-2');
    });

    it('peek(n) 返回最新 N 条事件（按时间倒序）', () => {
      for (let i = 1; i <= 5; i++) {
        buffer.push(
          createTestEvent({ id: `evt-${i}`, timestamp: Date.now() + i })
        );
      }
      const recent = buffer.peek(3);
      expect(recent).toHaveLength(3);
      expect(recent[0]!.id).toBe('evt-5');
      expect(recent[1]!.id).toBe('evt-4');
      expect(recent[2]!.id).toBe('evt-3');
    });

    it('peek() 不传参数返回全部事件', () => {
      for (let i = 1; i <= 5; i++) {
        buffer.push(createTestEvent({ id: `evt-${i}` }));
      }
      expect(buffer.peek()).toHaveLength(5);
    });

    it('toArray() 返回按插入顺序的事件数组', () => {
      buffer.push(createTestEvent({ id: 'evt-1' }));
      buffer.push(createTestEvent({ id: 'evt-2' }));
      buffer.push(createTestEvent({ id: 'evt-3' }));
      const arr = buffer.toArray();
      expect(arr).toHaveLength(3);
      expect(arr[0]!.id).toBe('evt-1');
      expect(arr[1]!.id).toBe('evt-2');
      expect(arr[2]!.id).toBe('evt-3');
    });

    it('clear() 清空缓冲区', () => {
      buffer.push(createTestEvent({ id: 'evt-1' }));
      buffer.push(createTestEvent({ id: 'evt-2' }));
      buffer.clear();
      expect(buffer.size).toBe(0);
      expect(buffer.isEmpty).toBe(true);
    });
  });

  describe('溢出驱逐', () => {
    it('容量满时 push 驱逐低重要性事件', () => {
      const smallBuffer = new RingBuffer(5);

      // 推入 4 条低重要性事件 + 1 条高重要性事件
      for (let i = 0; i < 4; i++) {
        smallBuffer.push(
          createTestEvent({
            id: `low-${i}`,
            importance: 1,
            timestamp: Date.now() - 10000 + i,
          })
        );
      }
      smallBuffer.push(
        createTestEvent({
          id: 'high-1',
          importance: 3,
          timestamp: Date.now(),
        })
      );

      // 现在满了，再 push 一个
      const evicted = smallBuffer.push(
        createTestEvent({
          id: 'new-1',
          importance: 2,
          timestamp: Date.now() + 1,
        })
      );

      expect(evicted).not.toBeNull();
      // 驱逐的应该是低重要性事件
      expect(evicted!.importance).toBe(1);
      // 高重要性事件仍保留
      const allIds = smallBuffer.toArray().map((e) => e.id);
      expect(allIds).toContain('high-1');
    });

    it('importance=3 的事件在驱逐时优先保留', () => {
      const smallBuffer = new RingBuffer(3);

      smallBuffer.push(
        createTestEvent({ id: 'golden', importance: 3, timestamp: 1 })
      );
      smallBuffer.push(
        createTestEvent({ id: 'mid', importance: 2, timestamp: 2 })
      );
      smallBuffer.push(
        createTestEvent({ id: 'low', importance: 1, timestamp: 3 })
      );

      // push 新事件
      const evicted = smallBuffer.push(
        createTestEvent({ id: 'new', importance: 2, timestamp: 4 })
      );

      expect(evicted).not.toBeNull();
      expect(evicted!.id).toBe('low'); // importance=1 应被驱逐
      const allIds = smallBuffer.toArray().map((e) => e.id);
      expect(allIds).toContain('golden');
    });

    it('驱逐后 size 保持等于 capacity', () => {
      const smallBuffer = new RingBuffer(3);

      for (let i = 0; i < 3; i++) {
        smallBuffer.push(createTestEvent({ id: `evt-${i}`, importance: 1 }));
      }
      smallBuffer.push(createTestEvent({ id: 'evt-new', importance: 2 }));

      expect(smallBuffer.size).toBe(3);
    });
  });

  describe('边界条件', () => {
    it('空缓冲区 last() 返回 undefined', () => {
      expect(buffer.last()).toBeUndefined();
    });

    it('空缓冲区 peek() 返回空数组', () => {
      expect(buffer.peek()).toEqual([]);
      expect(buffer.peek(5)).toEqual([]);
    });

    it('空缓冲区 toArray() 返回空数组', () => {
      expect(buffer.toArray()).toEqual([]);
    });

    it('peek(0) 返回空数组', () => {
      buffer.push(createTestEvent({ id: 'evt-1' }));
      expect(buffer.peek(0)).toEqual([]);
    });

    it('capacity=1 的缓冲区正常工作', () => {
      const tiny = new RingBuffer(1);
      const e1 = createTestEvent({ id: 'e1', importance: 1 });
      const e2 = createTestEvent({ id: 'e2', importance: 3 });

      tiny.push(e1);
      expect(tiny.size).toBe(1);

      const evicted = tiny.push(e2);
      expect(evicted!.id).toBe('e1');
      expect(tiny.last()!.id).toBe('e2');
    });

    it('capacity < 1 抛出异常', () => {
      expect(() => new RingBuffer(0)).toThrow();
      expect(() => new RingBuffer(-1)).toThrow();
    });
  });

  describe('时间优先', () => {
    it('同 importance 时驱逐更早的事件', () => {
      const smallBuffer = new RingBuffer(3);

      smallBuffer.push(
        createTestEvent({
          id: 'old',
          importance: 2,
          timestamp: 1000,
        })
      );
      smallBuffer.push(
        createTestEvent({
          id: 'mid',
          importance: 2,
          timestamp: 2000,
        })
      );
      smallBuffer.push(
        createTestEvent({
          id: 'new',
          importance: 2,
          timestamp: 3000,
        })
      );

      const evicted = smallBuffer.push(
        createTestEvent({
          id: 'newest',
          importance: 2,
          timestamp: 4000,
        })
      );

      // 同 importance 时，最旧的应被驱逐
      expect(evicted!.id).toBe('old');
    });
  });
});
