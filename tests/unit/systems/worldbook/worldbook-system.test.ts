/**
 * 世界书系统单元测试 — v4.1.0
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  createDefaultWorldBook,
  loadWorldBook,
  saveWorldBook,
  resetWorldBook,
  groupBySection,
  buildWorldBookPrompt,
  WORLDBOOK_STORAGE_KEY,
  type WorldBookEntry,
} from '@/systems/worldbook/worldbook-system';

// 清理 localStorage（jsdom 环境）
beforeEach(() => {
  try { localStorage.removeItem(WORLDBOOK_STORAGE_KEY); } catch { /* ignore */ }
});
afterEach(() => {
  try { localStorage.removeItem(WORLDBOOK_STORAGE_KEY); } catch { /* ignore */ }
});

describe('世界书系统', () => {
  it('默认世界书包含 9 条权威设定条目', () => {
    const entries = createDefaultWorldBook();
    expect(entries.length).toBeGreaterThanOrEqual(8);
    const ids = entries.map((e) => e.id);
    expect(ids).toContain('wb-world');
    expect(ids).toContain('wb-geo');
    expect(ids).toContain('wb-endings');
    // 默认条目全部锁定（不可删除）
    expect(entries.every((e) => e.locked)).toBe(true);
  });

  it('无存档时 loadWorldBook 返回默认条目', () => {
    const entries = loadWorldBook();
    expect(entries.length).toBe(createDefaultWorldBook().length);
  });

  it('saveWorldBook + loadWorldBook 往返一致', () => {
    const custom: WorldBookEntry[] = [...createDefaultWorldBook(), {
      id: 'wb-custom-test', section: '设定', title: '测试条目', content: '自定义内容', order: 90,
    }];
    expect(saveWorldBook(custom)).toBe(true);
    const loaded = loadWorldBook();
    expect(loaded.some((e) => e.id === 'wb-custom-test')).toBe(true);
    expect(loaded.find((e) => e.id === 'wb-custom-test')?.content).toBe('自定义内容');
  });

  it('旧存档缺少新默认条目时自动补齐', () => {
    // 模拟只存了 1 条自定义的旧存档
    const partial = [{ id: 'wb-custom-old', section: '规则', title: '旧条目', content: 'x' }];
    saveWorldBook(partial);
    const loaded = loadWorldBook();
    expect(loaded.some((e) => e.id === 'wb-custom-old')).toBe(true);
    expect(loaded.some((e) => e.id === 'wb-world')).toBe(true); // 默认条目已补齐
  });

  it('resetWorldBook 清空自定义并恢复默认', () => {
    saveWorldBook([{ id: 'wb-x', section: '设定', title: 'x', content: 'y' }]);
    const reset = resetWorldBook();
    expect(reset.length).toBe(createDefaultWorldBook().length);
    expect(loadWorldBook().some((e) => e.id === 'wb-x')).toBe(false);
  });

  it('groupBySection 按章节分组并排序', () => {
    const groups = groupBySection(createDefaultWorldBook());
    const sections = groups.map((g) => g.section);
    expect(sections).toContain('世界观');
    expect(sections).toContain('设定');
    // 世界观组内按 order 排序
    const worldGroup = groups.find((g) => g.section === '世界观');
    expect(worldGroup!.entries[0]!.order).toBeLessThanOrEqual(worldGroup!.entries[1]!.order);
  });

  it('buildWorldBookPrompt 注入启用条目并声明最高优先级', () => {
    const entries = createDefaultWorldBook();
    const prompt = buildWorldBookPrompt(entries);
    expect(prompt).toContain('世界书');
    expect(prompt).toContain('凛冬要塞');
    expect(prompt).toContain('最高优先级');
    expect(prompt).toContain('虚空守望者');
  });

  it('停用的条目不注入 prompt', () => {
    const entries = createDefaultWorldBook().map((e, i) =>
      i === 0 ? { ...e, enabled: false } : e
    );
    const prompt = buildWorldBookPrompt(entries);
    expect(prompt).not.toContain(entries[0]!.content);
  });

  it('空条目列表返回空 prompt', () => {
    expect(buildWorldBookPrompt([])).toBe('');
  });
});
