/**
 * Combat Engine — AI Narrator Game v1.0.0
 *
 * 6-element combat system with elemental reactions, combo chains,
 * and environmental modifiers. All damage resolution flows through
 * resolveCombat() which returns a CombatResult.
 */

// ============================================================
// Types
// ============================================================

export type Element = '火' | '水' | '风' | '土' | '光' | '暗';

export interface CombatResult {
  damage: number;
  combo: number;
  comboName: string | null;
  comboBonus: number;
  reaction: string | null;
  reactionMultiplier: number;
  environment: string;
  environmentBonus: number;
  environmentHazard: string | null;
  narrative: string;
}

export interface ComboState {
  combo: number;
  prevAction: string;
}

export interface ReactionResult {
  name: string;
  multiplier: number;
  effect: string;
}

// ============================================================
// Element Reaction Table
// ============================================================

type ReactionKey = string;

const REACTION_TABLE: Record<ReactionKey, ReactionResult> = {
  '火-水': { name: '蒸汽爆发', multiplier: 1.5, effect: '高温蒸汽灼伤敌人，伤害提升50%' },
  '水-火': { name: '蒸汽爆发', multiplier: 1.5, effect: '高温蒸汽灼伤敌人，伤害提升50%' },
  '风-火': { name: '烈焰风暴', multiplier: 2.0, effect: '狂风助长火势，伤害翻倍' },
  '火-风': { name: '烈焰风暴', multiplier: 2.0, effect: '狂风助长火势，伤害��倍' },
  '土-水': { name: '泥沼陷阱', multiplier: 1.0, effect: '地面化为泥沼，敌人移动速度降低' },
  '水-土': { name: '泥沼陷阱', multiplier: 1.0, effect: '地面化为泥沼，敌人移动速度降低' },
  '光-暗': { name: '湮灭', multiplier: 3.0, effect: '光暗碰撞引发毁灭性能量，伤害提升200%' },
  '暗-光': { name: '湮灭', multiplier: 3.0, effect: '光暗碰撞引发毁灭性能量，伤害提升200%' },
  '风-水': { name: '冰霜风暴', multiplier: 1.3, effect: '寒风冻结水汽，伤害提升30%' },
  '水-风': { name: '冰霜风暴', multiplier: 1.3, effect: '寒风冻结水汽，伤害提升30%' },
  '火-土': { name: '熔岩喷发', multiplier: 1.8, effect: '火焰融化大地，伤害提升80%' },
  '土-火': { name: '熔岩喷发', multiplier: 1.8, effect: '火焰融化大地，伤害提升80%' },
  '风-土': { name: '沙尘暴', multiplier: 1.2, effect: '风卷尘土遮蔽视线，伤害提升20%' },
  '土-风': { name: '沙尘暴', multiplier: 1.2, effect: '风卷尘土遮蔽视线，伤害提升20%' },
  '光-水': { name: '圣水净化', multiplier: 1.4, effect: '圣光净化水面，伤害提升40%' },
  '水-光': { name: '圣水净化', multiplier: 1.4, effect: '圣光净化水面，伤害提升40%' },
  '暗-火': { name: '地狱火', multiplier: 1.6, effect: '暗影点燃烈焰，伤害提升60%' },
  '火-暗': { name: '地狱火', multiplier: 1.6, effect: '暗影点燃烈焰，伤害提升60%' },
  '光-风': { name: '天罚之风', multiplier: 1.5, effect: '圣光乘风扩散，伤害提升50%' },
  '风-光': { name: '天罚之风', multiplier: 1.5, effect: '圣光乘风扩散，伤害提升50%' },
  '暗-土': { name: '深渊裂痕', multiplier: 1.4, effect: '暗影撕裂大地，伤害提升40%' },
  '土-暗': { name: '深渊裂痕', multiplier: 1.4, effect: '暗影撕裂大地，伤害提升40%' },
};

// ============================================================
// Environment Modifiers
// ============================================================

export interface EnvironmentConfig {
  element: Element;
  bonus: number; // percentage bonus
  hazard: string | null;
  hazardDamage: number;
}

const ENVIRONMENT_TABLE: Record<string, EnvironmentConfig> = {
  '森林': { element: '风', bonus: 10, hazard: '荆棘陷阱', hazardDamage: 8 },
  '密林': { element: '风', bonus: 10, hazard: '毒藤缠绕', hazardDamage: 12 },
  '火山': { element: '火', bonus: 20, hazard: '岩浆喷发', hazardDamage: 25 },
  '熔岩': { element: '火', bonus: 25, hazard: '岩浆喷发', hazardDamage: 30 },
  '雪原': { element: '水', bonus: 10, hazard: '雪崩', hazardDamage: 15 },
  '冰湖': { element: '水', bonus: 15, hazard: '冰面碎裂', hazardDamage: 10 },
  '洞穴': { element: '土', bonus: 15, hazard: '落石', hazardDamage: 10 },
  '矿洞': { element: '土', bonus: 20, hazard: '塌方', hazardDamage: 20 },
  '沙漠': { element: '火', bonus: 5, hazard: '沙暴', hazardDamage: 15 },
  '沼泽': { element: '土', bonus: 10, hazard: '毒沼下沉', hazardDamage: 20 },
  '山顶': { element: '风', bonus: 15, hazard: '雷击', hazardDamage: 18 },
  '海滩': { element: '水', bonus: 5, hazard: '潮汐', hazardDamage: 5 },
  '遗迹': { element: '光', bonus: 10, hazard: '魔法陷阱', hazardDamage: 15 },
  '废墟': { element: '暗', bonus: 10, hazard: '诅咒波动', hazardDamage: 12 },
  '墓地': { element: '暗', bonus: 15, hazard: '灵魂侵蚀', hazardDamage: 18 },
  '神殿': { element: '光', bonus: 20, hazard: '神圣考验', hazardDamage: 10 },
};

/**
 * Get environment modifier for a region.
 * Falls back to 'forest' defaults if region not found.
 */
export function getEnvironmentModifier(region: string): EnvironmentConfig {
  return ENVIRONMENT_TABLE[region] ?? { element: '风', bonus: 0, hazard: null, hazardDamage: 0 };
}

// ============================================================
// Element Reaction Resolution
// ============================================================

/**
 * Get the elemental reaction between two elements.
 * Returns null if no reaction exists.
 */
export function getElementReaction(a: Element, b: Element): ReactionResult | null {
  const key = `${a}-${b}`;
  return REACTION_TABLE[key] ?? null;
}

// ============================================================
// Combo System
// ============================================================

const COMBO_THRESHOLDS: { min: number; name: string; bonus: number }[] = [
  { min: 3, name: '连斩', bonus: 0.20 },
  { min: 5, name: '乱舞', bonus: 0.50 },
  { min: 10, name: '无双', bonus: 1.50 },
];

/**
 * Process combo based on current and previous action.
 * Returns updated combo count and bonus.
 */
export function processCombo(action: string, prevAction: string): { combo: number; bonus: number; name: string | null } {
  // Simple combo: if same/similar action, increment; otherwise reset
  const isCombo = prevAction && (action === prevAction || action.startsWith(prevAction) || prevAction.startsWith(action));

  if (!isCombo) {
    return { combo: 0, bonus: 0, name: null };
  }

  // Get current combo (called externally, so we track state externally)
  // This function takes the current combo from the state tracker
  return { combo: 0, bonus: 0, name: null }; // Placeholder — actual combo tracking is stateful
}

/**
 * Calculate combo bonus from current combo count.
 */
export function getComboBonus(comboCount: number): { name: string | null; bonus: number } {
  let result: { name: string | null; bonus: number } = { name: null, bonus: 0 };
  for (const threshold of COMBO_THRESHOLDS) {
    if (comboCount >= threshold.min) {
      result = { name: threshold.name, bonus: threshold.bonus };
    }
  }
  return result;
}

/**
 * Advance combo: increment on hit, reset on miss.
 */
export function advanceCombo(currentCombo: number, hit: boolean): number {
  return hit ? currentCombo + 1 : 0;
}

// ============================================================
// Main Combat Resolution
// ============================================================

/**
 * Resolve a combat action.
 *
 * @param baseDamage - Base damage of the action
 * @param playerElements - Elements involved in the action (up to 2 for reactions)
 * @param enemyType - Enemy type string (affects narrative)
 * @param region - Current region (affects environment)
 * @param currentCombo - Current combo count
 * @param hit - Whether the attack connected
 * @param playerStats - v4.2.1 (P0-1): 玩家属性/装备/职业上下文，让成长线接入战斗公式
 * @returns CombatResult with all modifiers applied
 */
export interface PlayerCombatStats {
  /** 主属性（力量/智力等），直接乘入伤害 */
  attackAttr?: number;
  /** 敏捷（命中与闪避加成） */
  dexterity?: number;
  /** 主手武器攻击力（stats.attack） */
  weaponAttack?: number;
  /** 暴击率 0-1 */
  critChance?: number;
  /** 职业名（用于叙事） */
  className?: string;
  /** 已习得技能（用于叙事/加成） */
  skills?: string[];
}

export function resolveCombat(
  baseDamage: number,
  playerElements: Element[],
  enemyType: string,
  region: string,
  currentCombo: number,
  hit: boolean,
  playerStats?: PlayerCombatStats
): CombatResult {
  // Advance combo
  const newCombo = advanceCombo(currentCombo, hit);
  if (!hit) {
    return {
      damage: 0,
      combo: 0,
      comboName: null,
      comboBonus: 0,
      reaction: null,
      reactionMultiplier: 1,
      environment: region,
      environmentBonus: 0,
      environmentHazard: null,
      narrative: `你的攻击落空了！${enemyType}躲过了你的攻击。`,
    };
  }

  // Elemental reaction
  let reaction: ReactionResult | null = null;
  if (playerElements.length >= 2) {
    const elem0 = playerElements[0]!;
    const elem1 = playerElements[1]!;
    reaction = getElementReaction(elem0, elem1);
    if (!reaction) {
      // Try reverse order
      reaction = getElementReaction(elem1, elem0);
    }
  }

  // Environment modifier
  const envConfig = getEnvironmentModifier(region);

  // Combo bonus
  const { name: comboName, bonus: comboBonus } = getComboBonus(newCombo);

  // ── v4.2.1 (P0-1): 玩家成长线入公式 ──
  // 属性加成：主属性 1 点 = 2 点伤害（力量/智力/敏捷按职业取向，统一取 attackAttr）
  const attrDamage = Math.max(0, (playerStats?.attackAttr ?? 0) * 2);
  // 装备加成：主手武器攻击力直接累加
  const weaponDamage = Math.max(0, playerStats?.weaponAttack ?? 0);
  // 暴击判定：critChance（装备/技能提供），暴击 ×1.5
  const isCrit = playerStats?.critChance
    ? Math.random() < Math.min(0.5, playerStats.critChance)
    : false;

  // Calculate final damage
  let totalDamage = baseDamage + attrDamage + weaponDamage;

  // Apply element reaction multiplier
  const reactionMultiplier = reaction ? reaction.multiplier : 1;
  totalDamage *= reactionMultiplier;

  // Apply environment bonus
  const envBonus = envConfig.bonus / 100;
  totalDamage *= (1 + envBonus);

  // Apply combo bonus
  totalDamage *= (1 + comboBonus);

  // 暴击
  if (isCrit) totalDamage *= 1.5;

  // Build narrative
  let narrative = `你攻击了${enemyType}，造成 ${Math.round(totalDamage)} 点伤害！`;
  if (playerStats?.weaponAttack && playerStats.weaponAttack > 0) {
    narrative += `\n⚔️ 武器「攻击+${playerStats.weaponAttack}」已计入伤害`;
  }
  if (attrDamage > 0) {
    narrative += `\n💪 属性加值 ${attrDamage} 已计入（主属性 ×2）`;
  }
  if (isCrit) {
    narrative += `\n💥 暴击！伤害 ×1.5`;
  }
  if (reaction) {
    narrative += `\n✨ ${reaction.name}：${reaction.effect}`;
  }
  if (comboName) {
    narrative += `\n🔥 ${comboName}：伤害加成 ${Math.round(comboBonus * 100)}%`;
  }
  if (envConfig.hazard && Math.random() < 0.2) {
    narrative += `\n⚠️ ${envConfig.hazard}触发，受到 ${envConfig.hazardDamage} 点环境伤害！`;
  }

  return {
    damage: Math.round(totalDamage),
    combo: newCombo,
    comboName,
    comboBonus,
    reaction: reaction ? reaction.name : null,
    reactionMultiplier,
    environment: region,
    environmentBonus: envBonus * 100,
    environmentHazard: envConfig.hazard,
    narrative,
  };
}

// ============================================================
// Element name helper
// ============================================================

export function getElementEmoji(element: Element): string {
  switch (element) {
    case '火': return '🔥';
    case '水': return '💧';
    case '风': return '🌪️';
    case '土': return '🪨';
    case '光': return '✨';
    case '暗': return '🌑';
  }
}
