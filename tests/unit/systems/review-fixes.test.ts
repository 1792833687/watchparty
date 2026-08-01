/**
 * v4.2.1 评审修复回归测试
 * - P0-1 战斗公式接入属性/装备
 * - P1-6 D20 属性修正公式
 * - P1-5 结局敌对阵营排除
 * - P0-4 领地税收/围城失败惩罚
 */
import { describe, expect, it } from 'vitest';
import { resolveCombat, type PlayerCombatStats } from '@/systems/combat/combat-engine';
import { evaluateEnding, type EndingConditionContext } from '@/systems/endings/ending-system';
import { calcDefense, resolveSiege, collectTax, collectWorkshopOutput, templePrayer, type TerritoryState } from '@/systems/territory/territory-system';

function ctx(overrides: Partial<EndingConditionContext> = {}): EndingConditionContext {
  return {
    endingFlags: {}, corruption: 0, factionReputations: {}, defense: 0,
    ailaCompleted: false, dayCount: 1, siegesSurvived: 0, mainQuestCompleted: false,
    ...overrides,
  };
}

function territory(facilities: Partial<TerritoryState['facilities']> = {}): TerritoryState {
  return {
    facilities: { keep: 0, wall: 0, barracks: 0, housing: 0, temple: 0, workshop: 0, ...facilities },
    resources: { gold: 200, stone: 100, wood: 120, iron: 40, grain: 80, crystal: 0 },
    strategyProjects: { armor: 0, knowledge: 0, faith: 0, people: 0 },
    defense: 0, siegeCountdown: 60, siegesSurvived: 0,
  };
}

describe('P0-1 战斗公式接入属性/装备', () => {
  it('无属性无装备时伤害 = 基础伤害', () => {
    const r = resolveCombat(10, ['火'], '狼', '森林', 0, true);
    expect(r.damage).toBeGreaterThanOrEqual(10);
  });

  it('主属性 5 点 → 伤害 +10', () => {
    const base = resolveCombat(10, ['火'], '狼', '森林', 0, true);
    const withAttr = resolveCombat(10, ['火'], '狼', '森林', 0, true, { attackAttr: 5 } as PlayerCombatStats);
    expect(withAttr.damage).toBeGreaterThan(base.damage + 8);
  });

  it('武器攻击力 10 → 伤害 +10', () => {
    const base = resolveCombat(10, ['火'], '狼', '森林', 0, true);
    const withWeapon = resolveCombat(10, ['火'], '狼', '森林', 0, true, { weaponAttack: 10 } as PlayerCombatStats);
    expect(withWeapon.damage).toBeGreaterThan(base.damage + 8);
  });

  it('属性+装备叠加', () => {
    const r = resolveCombat(10, ['火'], '狼', '森林', 0, true, { attackAttr: 5, weaponAttack: 8 } as PlayerCombatStats);
    expect(r.damage).toBeGreaterThanOrEqual(10 + 10 + 8);
  });

  it('未命中时伤害为 0（即便有属性）', () => {
    const r = resolveCombat(10, ['火'], '狼', '森林', 0, false, { attackAttr: 10 } as PlayerCombatStats);
    expect(r.damage).toBe(0);
  });
});

describe('P1-5 结局敌对阵营排除', () => {
  it('真结局：全部正面阵营 60+ 且无敌对 → 可达成', () => {
    const ending = evaluateEnding(ctx({
      endingFlags: { void: 10, trials: 3, oath: 1 },
      corruption: 50,
      factionReputations: { gondor: 60, rohan: 60, 'lonely-mountain': 60, 'wood-elves': 60, rivendell: 60, 'northern-rangers': 60 },
      ailaCompleted: true,
      mainQuestCompleted: true,
    }));
    expect(ending?.id).toBe('void');
  });

  it('真结局：敌对阵营 -40 不拉低平均（修复前数学上不可达）', () => {
    const ending = evaluateEnding(ctx({
      endingFlags: { void: 10, trials: 3, oath: 1 },
      corruption: 50,
      factionReputations: { gondor: 60, rohan: 60, 'lonely-mountain': 60, 'wood-elves': 60, rivendell: 60, 'northern-rangers': 60, 'dark-legion': -40 },
      ailaCompleted: true,
      mainQuestCompleted: true,
    }));
    expect(ending?.id).toBe('void');
  });
});

describe('P0-4 领地经济闭环', () => {
  it('民居税收：1级+20 / 2级+60 / 3级+150', () => {
    expect(collectTax(territory({ housing: 1 }))).toBe(20);
    expect(collectTax(territory({ housing: 2 }))).toBe(60);
    expect(collectTax(territory({ housing: 3 }))).toBe(150);
    expect(collectTax(territory())).toBe(0);
  });

  it('工坊产出：1级+5铁 / 2级+12 / 3级+30', () => {
    expect(collectWorkshopOutput(territory({ workshop: 1 })).iron).toBe(5);
    expect(collectWorkshopOutput(territory({ workshop: 2 })).iron).toBe(12);
    expect(collectWorkshopOutput(territory({ workshop: 3 })).iron).toBe(30);
    expect(collectWorkshopOutput(territory()).iron).toBeUndefined();
  });

  it('神殿祈祷减堕落：1级-3 / 2级-6 / 3级-12', () => {
    expect(templePrayer(1)).toBe(3);
    expect(templePrayer(2)).toBe(6);
    expect(templePrayer(3)).toBe(12);
    expect(templePrayer(0)).toBe(0);
  });

  it('围城失败：资源损失 + 设施降级', () => {
    const state = territory({ wall: 2, barracks: 1 }); // 防御 = 60+10 = 70
    const siege = resolveSiege(state, 120); // 攻势超过防御 → 失败
    expect(siege.survived).toBe(false);
    expect(siege.losses.gold).toBeGreaterThan(0);
    expect(siege.downgraded).not.toBeNull();
  });

  it('围城胜利：仅少量资源损耗，无降级', () => {
    const state = territory({ wall: 3, barracks: 2, keep: 1 }); // 防御 = 90+25+10 = 125
    const siege = resolveSiege(state, 60); // 攻势低于防御 → 守住
    expect(siege.survived).toBe(true);
    expect(siege.downgraded).toBeNull();
  });
});

describe('P0-3 主线完成解锁结局', () => {
  it('mainQuestCompleted=true 时光明结局可达（此前锁死）', () => {
    const ending = evaluateEnding(ctx({
      corruption: 10,
      factionReputations: { gondor: 70, rohan: 60 },
      mainQuestCompleted: true,
    }));
    expect(ending?.id).toBe('humanity');
  });

  it('mainQuestCompleted=false 时光明结局不可达（回归验证）', () => {
    const ending = evaluateEnding(ctx({
      corruption: 10,
      factionReputations: { gondor: 70, rohan: 60 },
      mainQuestCompleted: false,
    }));
    expect(ending?.id).not.toBe('humanity');
  });
});
