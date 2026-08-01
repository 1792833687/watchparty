/**
 * Guild / Reputation System — AI Narrator Game v1.0.0
 *
 * 5-tier reputation system, faction management, reputation-based
 * unlocks (discounts, quests, alliances, dialogue). 3 preset factions.
 */

// ============================================================
// Types
// ============================================================

export type ReputationTier = 'hatred' | 'cold' | 'neutral' | 'friendly' | 'revered';

export interface Faction {
  id: string;
  name: string;
  description: string;
  territory: string;
  icon: string;
  color: string;
}

export interface ReputationState {
  factionId: string;
  reputation: number; // -1000 to 3000+
  tier: ReputationTier;
  questsCompleted: number;
}

export interface ReputationThreshold {
  tier: ReputationTier;
  label: string;
  min: number;
  max: number;
  discount: number; // percentage discount
  features: string[];
}

// ============================================================
// Tier Definitions
// ============================================================

export const REPUTATION_TIERS: ReputationThreshold[] = [
  {
    tier: 'hatred',
    label: '仇恨',
    min: -9999, max: -1000,
    discount: 0,
    features: ['战斗敌对', '无法进入领地', 'NPC攻击'],
  },
  {
    tier: 'cold',
    label: '冷淡',
    min: -999, max: 0,
    discount: 0,
    features: ['基本交易可用', 'NPC态度冷漠', '任务限制'],
  },
  {
    tier: 'neutral',
    label: '中立',
    min: 1, max: 499,
    discount: 0,
    features: ['正常交易', '普通任务可用', '基础对话'],
  },
  {
    tier: 'friendly',
    label: '友善',
    min: 500, max: 1499,
    discount: 10,
    features: ['10%购物折扣', '特殊任务解锁', 'NPC友好对话', '可请求协助'],
  },
  {
    tier: 'revered',
    label: '崇拜',
    min: 1500, max: 9999,
    discount: 25,
    features: ['25%购物折扣', '传说任务解锁', 'NPC崇拜', '可在战斗中召唤援助', '获得专属称号'],
  },
];

// ============================================================
// Tier Calculation
// ============================================================

/**
 * Calculate reputation tier from raw reputation value.
 */
export function getReputationTier(reputation: number): ReputationTier {
  if (reputation >= 1500) return 'revered';
  if (reputation >= 500) return 'friendly';
  if (reputation >= 0) return 'neutral';
  if (reputation >= -1000) return 'cold';
  return 'hatred';
}

/**
 * Get tier metadata from reputation value.
 */
export function getTierInfo(reputation: number): ReputationThreshold {
  const tier = getReputationTier(reputation);
  return REPUTATION_TIERS.find(t => t.tier === tier) ?? REPUTATION_TIERS[2]!;
}

// ============================================================
// Preset Factions
// ============================================================

export const PRESET_FACTIONS: Faction[] = [
  {
    id: 'tribe-cavern',
    name: '穴居族',
    description: '生活在洞穴深处的古老种族，掌握着地下世界的秘密和独特的锻造技术。',
    territory: '洞穴',
    icon: '🦇',
    color: '#5B8CBE',
  },
  {
    id: 'tribe-tide',
    name: '潮汐族',
    description: '居住在海岸线的海洋之民，精通航海和水中作战，崇拜海洋之神。',
    territory: '海岸',
    icon: '🌊',
    color: '#5A9E6F',
  },
  {
    id: 'explorers-guild',
    name: '探险者联盟',
    description: '一群来自各地的冒险者组成的组织，致力于探索未知领域和共享知识。',
    territory: '各处',
    icon: '🧭',
    color: '#C9A94E',
  },
];

// ============================================================
// Reputation Management
// ============================================================

/**
 * Create initial reputation state for all factions.
 */
export function createReputationState(factions: Faction[] = PRESET_FACTIONS): ReputationState[] {
  return factions.map(f => ({
    factionId: f.id,
    reputation: 0,
    tier: 'cold',
    questsCompleted: 0,
  }));
}

/**
 * Modify reputation for a faction.
 * Clamped between -9999 and 9999.
 */
export function modifyReputation(
  states: ReputationState[],
  factionId: string,
  amount: number
): ReputationState[] {
  return states.map(s => {
    if (s.factionId !== factionId) return s;
    const newRep = Math.max(-9999, Math.min(9999, s.reputation + amount));
    return {
      ...s,
      reputation: newRep,
      tier: getReputationTier(newRep),
    };
  });
}

/**
 * Complete a faction quest — gains reputation and increments count.
 */
export function completeFactionQuest(
  states: ReputationState[],
  factionId: string,
  repGain: number = 100
): ReputationState[] {
  return states.map(s => {
    if (s.factionId !== factionId) return s;
    const newRep = Math.max(-9999, Math.min(9999, s.reputation + repGain));
    return {
      ...s,
      reputation: newRep,
      tier: getReputationTier(newRep),
      questsCompleted: s.questsCompleted + 1,
    };
  });
}

// ============================================================
// Reputation Queries
// ============================================================

/**
 * Get discount percentage for a faction based on reputation.
 */
export function getReputationDiscount(reputation: number): number {
  const tier = getReputationTier(reputation);
  const info = REPUTATION_TIERS.find(t => t.tier === tier);
  return info?.discount ?? 0;
}

/**
 * Check if faction is hostile (hatred tier).
 */
export function isHostile(reputation: number): boolean {
  return getReputationTier(reputation) === 'hatred';
}

/**
 * Check if faction can provide battle assistance (friendly+).
 */
export function canAssist(reputation: number): boolean {
  const tier = getReputationTier(reputation);
  return tier === 'friendly' || tier === 'revered';
}

/**
 * Check if legendary quests are available (revered tier).
 */
export function hasLegendaryQuests(reputation: number): boolean {
  return getReputationTier(reputation) === 'revered';
}

/**
 * Get unlocked features for current reputation.
 */
export function getUnlockedFeatures(reputation: number): string[] {
  const tier = getReputationTier(reputation);
  const info = REPUTATION_TIERS.find(t => t.tier === tier);
  return info?.features ?? [];
}

/**
 * Generate dialogue tone based on reputation tier.
 */
export function getDialogueTone(reputation: number): string {
  const tier = getReputationTier(reputation);
  switch (tier) {
    case 'hatred': return '充满敌意和威胁的';
    case 'cold': return '冷淡而疏远的';
    case 'neutral': return '公事公办的';
    case 'friendly': return '热情友善的';
    case 'revered': return '崇拜敬仰的';
  }
}

// ============================================================
// Faction Quests (by Tier)
// ============================================================

export interface FactionQuest {
  id: string;
  factionId: string;
  tier: ReputationTier;
  title: string;
  description: string;
  reward: { reputation: number; gold: number; items?: string[] };
}

const FACTION_QUESTS: FactionQuest[] = [
  // 穴居族
  {
    id: 'cavern-neutral-1',
    factionId: 'tribe-cavern',
    tier: 'neutral',
    title: '矿洞清理',
    description: '穴居族的矿洞被一群巨型蜘蛛占据了，需要有人清理。',
    reward: { reputation: 100, gold: 50 },
  },
  {
    id: 'cavern-friendly-1',
    factionId: 'tribe-cavern',
    tier: 'friendly',
    title: '失落的锻造术',
    description: '寻找穴居族失传已久的暗铁锻造配方。',
    reward: { reputation: 200, gold: 150, items: ['暗铁锭'] },
  },
  {
    id: 'cavern-revered-1',
    factionId: 'tribe-cavern',
    tier: 'revered',
    title: '地心之核',
    description: '深入洞穴最深处，击败地心守护者，获取传说中的地心之核。',
    reward: { reputation: 500, gold: 500, items: ['地心之核', '传说锻造锤'] },
  },
  // 潮汐族
  {
    id: 'tide-neutral-1',
    factionId: 'tribe-tide',
    tier: 'neutral',
    title: '渔获危机',
    description: '近海的鱼群异常减少，潮汐族需要调查原因。',
    reward: { reputation: 100, gold: 60 },
  },
  {
    id: 'tide-friendly-1',
    factionId: 'tribe-tide',
    tier: 'friendly',
    title: '深海遗迹',
    description: '潮汐族发现了一处深海遗迹，需要勇士陪同探索。',
    reward: { reputation: 200, gold: 200, items: ['深海珍珠'] },
  },
  {
    id: 'tide-revered-1',
    factionId: 'tribe-tide',
    tier: 'revered',
    title: '海神试炼',
    description: '通过海神的试炼，获得海洋之力的祝福。',
    reward: { reputation: 500, gold: 500, items: ['海神三叉戟', '潮汐之心'] },
  },
  // 探险者联盟
  {
    id: 'explorers-neutral-1',
    factionId: 'explorers-guild',
    tier: 'neutral',
    title: '地图绘制',
    description: '为探险者联盟绘制未探索区域的地图。',
    reward: { reputation: 100, gold: 80 },
  },
  {
    id: 'explorers-friendly-1',
    factionId: 'explorers-guild',
    tier: 'friendly',
    title: '失落的文明',
    description: '在古老废墟中寻找失落的文明遗物。',
    reward: { reputation: 200, gold: 250, items: ['古代遗物'] },
  },
  {
    id: 'explorers-revered-1',
    factionId: 'explorers-guild',
    tier: 'revered',
    title: '终极探索',
    description: '探索世界边缘，寻找创世之初留下的真相。',
    reward: { reputation: 500, gold: 800, items: ['世界地图', '探索者勋章'] },
  },
];

/**
 * Get available quests for a faction at current reputation tier.
 */
export function getFactionQuests(
  factionId: string,
  reputation: number
): FactionQuest[] {
  const tier = getReputationTier(reputation);

  // Get quests for all tiers up to current
  const tierLevels: ReputationTier[] = ['neutral', 'friendly', 'revered'];
  const availableTiers: ReputationTier[] = [];

  for (const t of tierLevels) {
    availableTiers.push(t);
    if (t === tier) break;
  }

  return FACTION_QUESTS.filter(
    q => q.factionId === factionId && availableTiers.includes(q.tier)
  );
}

/**
 * Get quest by ID.
 */
export function getQuestById(questId: string): FactionQuest | undefined {
  return FACTION_QUESTS.find(q => q.id === questId);
}

// ============================================================
// Summary
// ============================================================

/**
 * Get a human-readable summary of reputation with a faction.
 */
export function getReputationSummary(reputation: number): string {
  const tier = getReputationTier(reputation);
  const info = REPUTATION_TIERS.find(t => t.tier === tier);
  const label = info?.label ?? '未知';
  return `${label} (声望: ${reputation})`;
}
