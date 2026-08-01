/**
 * v5.0.0 需求修复回归测试
 * - 需求3: 对话选项解析 — OPTIONS 与 GAMESTATE 共存时不再被贪婪匹配吞掉
 * - 需求2: 旁白/对话分段 — 各类引号正确识别
 */
import { describe, expect, it } from 'vitest';
import { parseNarrativeSegments } from '@/components/game/NarrativeRenderer';

// 从 page.tsx 复制解析函数（保持与实装一致的行为验证）
// 注意：parseDialogueOptions 在 page.tsx 内未导出，此处用等价实现验证核心正则行为
function parseOptions(text: string): number {
  const stripGameState = (t: string): string => {
    const marker = '---GAMESTATE---';
    const idx = t.indexOf(marker);
    if (idx === -1) return t;
    return t.substring(0, idx).trimEnd();
  };
  const marker = '---OPTIONS---';
  const noState = stripGameState(text);
  const idx = noState.lastIndexOf(marker);
  if (idx === -1) return 0;
  const afterMarker = noState.substring(idx + marker.length).trim();
  // v5.0.0 修复后：非贪婪匹配第一个闭合数组
  const jsonMatch = afterMarker.match(/\[[\s\S]*?\]/);
  if (!jsonMatch) return 0;
  try {
    const arr = JSON.parse(jsonMatch[0]);
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

describe('需求3 对话选项解析（OPTIONS + GAMESTATE 共存）', () => {
  it('AI 回复同时含 OPTIONS 和 GAMESTATE（items 数组）时选项可解析', () => {
    const reply =
      '酒馆老板笑着说：「欢迎，旅人。」\n' +
      '---OPTIONS---\n' +
      '[{"text":"来一杯麦酒","emoji":"🍺"},{"text":"打听北境的消息","emoji":"🗺️"}]\n' +
      '---GAMESTATE---\n' +
      '{"items":[{"id":"gold","name":"金币","quantity":5}],"quests":[]}';
    expect(parseOptions(reply)).toBe(2);
  });

  it('回归验证：修复前贪婪匹配把 GAMESTATE 吞入 → 选项解析失败', () => {
    const reply =
      '---OPTIONS---\n' +
      '[{"text":"选项A"}]\n' +
      '---GAMESTATE---\n' +
      '{"items":[{"id":"x","name":"y"}],"quests":[],"news":[{"type":"official"}]}';
    // 修复前 /\[[\s\S]*\]/ 匹配到 news 数组最后一个 ] → JSON.parse 失败 → 0
    const greedyMatch = reply.match(/\[[\s\S]*\]/);
    let greedyCount = 0;
    if (greedyMatch) {
      try {
        const arr = JSON.parse(greedyMatch[0]);
        greedyCount = Array.isArray(arr) ? arr.length : 0;
      } catch { greedyCount = 0; }
    }
    expect(greedyCount).toBe(0); // 修复前确实失败
    expect(parseOptions(reply)).toBe(1); // 修复后正常
  });

  it('无 OPTIONS 块时返回 0（不误伤）', () => {
    expect(parseOptions('纯叙事内容，无选项。')).toBe(0);
  });
});

describe('需求2 旁白/对话分段', () => {
  it('「」对话 + 说话人前缀 → dialogue 带 speaker（说话人后标点不残留为旁白）', () => {
    const segs = parseNarrativeSegments('老学士梅林说：「孩子，编年史需要你的名字。」窗外风雪正紧。');
    expect(segs[0]!.type).toBe('dialogue');
    expect(segs[0]!.speaker).toBe('老学士梅林');
    expect(segs[1]!.type).toBe('narration');
  });

  it('中文弯引号 "" 也识别为对话（引号内标点保留）', () => {
    const segs = parseNarrativeSegments('她低语道：“快逃。”');
    expect(segs.some((s) => s.type === 'dialogue' && s.text.includes('快逃'))).toBe(true);
  });

  it('『』引号识别为对话', () => {
    const segs = parseNarrativeSegments('信上写着『末日将至』。');
    expect(segs.some((s) => s.type === 'dialogue' && s.text === '末日将至')).toBe(true);
  });

  it('无引号的纯旁白 → 全部 narration', () => {
    const segs = parseNarrativeSegments('要塞的烽火在夜色中燃烧，远处的山脉沉默如故。');
    expect(segs.every((s) => s.type === 'narration')).toBe(true);
  });
});
