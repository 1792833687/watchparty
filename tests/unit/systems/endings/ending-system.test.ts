/**
 * 多结局系统单元测试 — v4.1.0（world-setting 十一）
 */
import { describe, expect, it } from 'vitest';
import { evaluateEnding, ENDINGS, buildEndingPrompt, type EndingConditionContext } from '@/systems/endings/ending-system';

function ctx(overrides: Partial<EndingConditionContext> = {}): EndingConditionContext {
  return {
    endingFlags: {},
    corruption: 0,
    factionReputations: {},
    defense: 0,
    ailaCompleted: false,
    dayCount: 1,
    siegesSurvived: 0,
    mainQuestCompleted: false,
    ...overrides,
  };
}

describe('多结局系统', () => {
  it('8 种结局定义完整（含隐藏真结局）', () => {
    expect(ENDINGS.length).toBe(8);
    const ids = ENDINGS.map((e) => e.id);
    expect(ids).toContain('void');
    expect(ids).toContain('oblivion');
    expect(ids).toContain('humanity');
    expect(ids).toContain('king');
    expect(ids).toContain('sacrifice');
  });

  it('无任何条件时返回 null', () => {
    expect(evaluateEnding(ctx())).toBeNull();
  });

  it('堕落值 100 立即触发湮灭结局', () => {
    const ending = evaluateEnding(ctx({ corruption: 100 }));
    expect(ending?.id).toBe('oblivion');
  });

  it('湮灭优先级最高（堕落 100 且其他条件满足时仍判定湮灭）', () => {
    const ending = evaluateEnding(ctx({
      corruption: 100,
      endingFlags: { crown: 10, void: 10, oath: 1, trials: 3 },
      factionReputations: { gondor: 80 },
      ailaCompleted: true,
      mainQuestCompleted: true,
    }));
    expect(ending?.id).toBe('oblivion');
  });

  it('隐藏真结局「虚空守望者」需全部条件满足', () => {
    const ending = evaluateEnding(ctx({
      endingFlags: { void: 10, trials: 3, oath: 1 },
      corruption: 50,
      factionReputations: { gondor: 70, rohan: 65 },
      ailaCompleted: true,
      mainQuestCompleted: true,
    }));
    expect(ending?.id).toBe('void');
  });

  it('真结局条件缺一不可（无誓约则不触发）', () => {
    const ending = evaluateEnding(ctx({
      endingFlags: { void: 10, trials: 3 }, // 缺 oath
      corruption: 50,
      factionReputations: { gondor: 70 },
      ailaCompleted: true,
      mainQuestCompleted: true,
    }));
    expect(ending?.id).not.toBe('void');
  });

  it('光明·英雄「人类纪元」：堕落<20 + 全阵营≥60 + 主线完成', () => {
    const ending = evaluateEnding(ctx({
      corruption: 10,
      factionReputations: { gondor: 70, rohan: 65, 'lonely-mountain': 60 },
      mainQuestCompleted: true,
    }));
    expect(ending?.id).toBe('humanity');
  });

  it('光明·牺牲「最后的联盟」：sacrifice≥10 + 主线完成 + 堕落<80', () => {
    const ending = evaluateEnding(ctx({
      endingFlags: { sacrifice: 10 },
      corruption: 40,
      mainQuestCompleted: true,
    }));
    expect(ending?.id).toBe('sacrifice');
  });

  it('buildEndingPrompt 输出包含结局列表与条件进度', () => {
    const prompt = buildEndingPrompt(ctx({ corruption: 30, endingFlags: { crown: 5 } }));
    expect(prompt).toContain('多结局');
    expect(prompt).toContain('crown=5');
    expect(prompt).toContain('虚空守望者');
  });
});
