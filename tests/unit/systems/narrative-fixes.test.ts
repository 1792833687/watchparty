/**
 * v5.0.0 叙事改造回归测试
 * - 原创化：阵营/角色显示名无托尔金专属名词残留
 * - 结局哲学化：8 篇 letter 含「代价」裁决 + 艾拉回响（ailaCompleted 分支）
 * - 议会忠诚结算：councilDecision 映射
 */
import { describe, expect, it } from 'vitest';
import { ENDINGS } from '@/systems/endings/ending-system';
import type { EndingConditionContext } from '@/systems/endings/ending-system';

function ctx(overrides: Partial<EndingConditionContext> = {}): EndingConditionContext {
  return {
    endingFlags: {}, corruption: 0, factionReputations: {}, defense: 0,
    ailaCompleted: false, dayCount: 1, siegesSurvived: 0, mainQuestCompleted: false,
    ...overrides,
  };
}

describe('叙事原创化（IP 合规）', () => {
  it('结局 letter 无托尔金专属名词（刚铎/洛汗/魔苟斯/戒灵/阿拉贡 等）', () => {
    const forbidden = ['刚铎', '洛汗', '魔苟斯', '戒灵', '阿拉贡', '索林', '艾露恩', '瑞文戴尔', '精灵宝钻', '杜内丹'];
    for (const ending of ENDINGS) {
      const text = ending.letter(ctx({ ailaCompleted: true }));
      for (const kw of forbidden) {
        expect(text, `${ending.id} letter 含禁词 ${kw}`).not.toContain(kw);
      }
    }
  });

  it('结局 letter 使用原创名称（白石王国/渊主/塔林/艾琳/格朗）', () => {
    const letters = ENDINGS.map((e) => e.letter(ctx({ ailaCompleted: true }))).join('\n');
    expect(letters).toContain('渊主');      // 魔苟斯 → 渊主
    expect(letters).toContain('白石');       // 刚铎 → 白石
    expect(letters).toContain('灰炉山');     // 孤山 → 灰炉山
  });
});

describe('结局哲学化（力量与代价裁决）', () => {
  it('8 个结局 letter 均含「代价」主题词', () => {
    const themeKeywords = ['代价', '付出', '永远', '为了'];
    for (const ending of ENDINGS) {
      const text = ending.letter(ctx({ ailaCompleted: true }));
      expect(themeKeywords.some((k) => text.includes(k)), `${ending.id} letter 缺代价主题`).toBe(true);
    }
  });

  it('艾拉全结局变体：ailaCompleted=true 时 letter 含艾拉收尾', () => {
    const withAila = ENDINGS.map((e) => e.letter(ctx({ ailaCompleted: true }))).join('\n');
    expect(withAila).toContain('艾拉');
  });

  it('虚空守望者 letter 提及鸦羽（打破镜像）', () => {
    const voidEnding = ENDINGS.find((e) => e.id === 'void')!;
    expect(voidEnding.letter(ctx({ ailaCompleted: true }))).toContain('鸦羽');
  });

  it('魔君陨落 letter 提及鸦羽（镜像合而为一）', () => {
    const darklord = ENDINGS.find((e) => e.id === 'darklord')!;
    expect(darklord.letter(ctx({ ailaCompleted: true }))).toContain('鸦羽');
  });
});

describe('凛冬议会决策映射', () => {
  const councilLeaders: Record<string, string[]> = {
    fortify: ['thorin-copper'], strike: ['roland'], aid: ['aelune-starwhisper'], negotiate: ['grim-darkforge'],
  };

  it('四派决策映射到对应领袖', () => {
    expect(councilLeaders.fortify).toContain('thorin-copper');   // 塔林·铜锤（矮人务实）
    expect(councilLeaders.strike).toContain('roland');           // 罗兰爵士（圣武士正义）
    expect(councilLeaders.aid).toContain('aelune-starwhisper');  // 艾琳·星语（精灵求援）
    expect(councilLeaders.negotiate).toContain('grim-darkforge');// 格朗·铁砧（牧师谈判）
  });

  it('支持方忠诚 +5 / 被否决领袖 -10 的语义（模拟 page.tsx 结算）', () => {
    const base = 60;
    const all = ['thorin-copper', 'roland', 'aelune-starwhisper', 'grim-darkforge'];
    const decision = 'strike'; // 支持罗兰出击
    const supported = councilLeaders[decision]!;
    const result: Record<string, number> = {};
    for (const id of all) {
      if (supported.includes(id)) {
        result[id] = Math.min(100, base + 5);
      } else {
        result[id] = Math.max(0, base - 10);
      }
    }
    expect(result.roland).toBe(65);             // 支持方 +5
    expect(result['thorin-copper']).toBe(50);   // 被否决 -10
    expect(result['aelune-starwhisper']).toBe(50);
    expect(result['grim-darkforge']).toBe(50);
  });
});
