/**
 * Achievement System — 凛冬要塞：暗影纪元 v3.0.0
 *
 * 全部成就收敛到「凛冬要塞」单一世界观：暗影侵蚀、守夜人誓约、
 * 龙脊探险、圣战史诗、同伴羁绊。4 大类：探索 / 战斗 / 收集 / 叙事。
 * 奖励统一以金币为主，部分成就授予称号。
 */

// ============================================================
// Types
// ============================================================

export type AchievementCategory = 'exploration' | 'combat' | 'collection' | 'narrative';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  progress: number;
  max: number;
  reward: string;
  /** v4.2.1 (P0-5): 结构化金币奖励（前端落账用，此前仅文案不兑现） */
  rewardGold?: number;
  /** v4.2.1 (P1-4): 技能点奖励（1-3 点） */
  rewardSkillPoints?: number;
  unlocked: boolean;
  hidden?: boolean;
  icon: string;
}

export interface AchievementCheckContext {
  regionsDiscovered: number;
  totalRegions: number;
  hiddenAreasFound: boolean;
  allRegionsUnlocked: boolean;
  enemiesDefeated: number;
  firstKill: boolean;
  maxComboReached: number;
  elementReactionsTriggered: Set<string>;
  equipmentByRarity: Record<string, number>;
  inventorySize: number;
  gold: number;
  mainQuestCompleted: boolean;
  factionReputation: Record<string, number>;
  epic7Completed: boolean;
  daysPlayed: number;
  timesSaved: number;
  /** v3.0.0: 已结识（revealLevel>=1）的同伴数量 */
  companionsUnlocked?: number;
  /** v3.0.0: 堕落值（0-100），使用暗影力量累积 */
  corruption?: number;
}

// ============================================================
// Achievement Definitions — 凛冬要塞主题
// ============================================================

const ACHIEVEMENTS: Achievement[] = [
  // ── 探索 · 暗影荒野 ──
  {
    id: 'explore-first',
    name: '接过火炬',
    description: '离开要塞，踏入暗影荒野，进入第一个新区域',
    category: 'exploration',
    progress: 0, max: 1,
    reward: '+50 金币',
    rewardGold: 50,
    unlocked: false,
    icon: '🔥',
  },
  {
    id: 'explore-three',
    name: '跨越阴影山脉',
    description: '在荒野中发现 3 个不同区域',
    category: 'exploration',
    progress: 0, max: 3,
    reward: '+150 金币',
    rewardGold: 150,
    unlocked: false,
    icon: '🏔️',
  },
  {
    id: 'explore-five',
    name: '龙脊足迹',
    description: '在极北冰封之地发现 5 个不同区域',
    category: 'exploration',
    progress: 0, max: 5,
    reward: '+300 金币',
    rewardGold: 300,
    unlocked: false,
    icon: '❄️',
  },
  {
    id: 'explore-hidden',
    name: '遗忘的密道',
    description: '发现一处被世界遗忘的隐藏地点',
    category: 'exploration',
    progress: 0, max: 1,
    reward: '+200 金币',
    rewardGold: 200,
    unlocked: false,
    icon: '🕳️',
  },
  {
    id: 'explore-all',
    name: '要塞之主',
    description: '解锁全部已知区域，将暗影挡在墙外',
    category: 'exploration',
    progress: 0, max: 1,
    reward: '+500 金币 · 称号：探索者',
    rewardGold: 500,
    // v4.2.1 (P1-4): 技能点奖励 — 探索成就发 2 点，缓解技能树枯竭
    rewardSkillPoints: 2,
    unlocked: false,
    icon: '🏰',
  },

  // ── 战斗 · 守夜人誓约 ──
  {
    id: 'combat-first',
    name: '初阵',
    description: '在瞭望台下击退第一个敌人',
    category: 'combat',
    progress: 0, max: 1,
    reward: '+100 金币',
    rewardGold: 100,
    unlocked: false,
    icon: '⚔️',
  },
  {
    id: 'combat-5combo',
    name: '乱舞',
    description: '在一场战斗中达成 5 连击',
    category: 'combat',
    progress: 0, max: 5,
    reward: '+100 金币',
    rewardGold: 100,
    unlocked: false,
    icon: '💥',
  },
  {
    id: 'combat-10combo',
    name: '寒铁连斩',
    description: '在一场战斗中达成 10 连击',
    category: 'combat',
    progress: 0, max: 10,
    reward: '+200 金币',
    rewardGold: 200,
    unlocked: false,
    icon: '🗡️',
  },
  {
    id: 'combat-reaction-1',
    name: '奥术初鸣',
    description: '释放第一次学派法术',
    category: 'combat',
    progress: 0, max: 1,
    reward: '+50 金币',
    rewardGold: 50,
    unlocked: false,
    icon: '✨',
  },
  {
    id: 'combat-reaction-3',
    name: '魔导大师',
    description: '在战斗中释放 3 种不同学派的法术',
    category: 'combat',
    progress: 0, max: 3,
    reward: '+200 金币',
    rewardGold: 200,
    unlocked: false,
    icon: '🎆',
  },
  {
    id: 'combat-reaction-5',
    name: '缚影者',
    description: '在战斗中释放 5 种不同学派的法术',
    category: 'combat',
    progress: 0, max: 5,
    reward: '+400 金币 · 称号：元素使',
    rewardGold: 400,
    unlocked: false,
    icon: '🌈',
  },
  {
    id: 'combat-hunter',
    name: '半兽人猎手',
    description: '击败 10 个敌人，让阴影山脉为之静默',
    category: 'combat',
    progress: 0, max: 10,
    reward: '+250 金币',
    rewardGold: 250,
    unlocked: false,
    icon: '🏹',
  },

  // ── 收集 · 财富与造物 ──
  {
    id: 'collect-rare',
    name: '珍藏',
    description: '获得一件稀有或更高品质的装备',
    category: 'collection',
    progress: 0, max: 1,
    reward: '+100 金币',
    rewardGold: 100,
    unlocked: false,
    icon: '💎',
  },
  {
    id: 'collect-epic',
    name: '传世之作',
    description: '获得一件史诗装备',
    category: 'collection',
    progress: 0, max: 1,
    reward: '+300 金币',
    rewardGold: 300,
    unlocked: false,
    icon: '👑',
  },
  {
    id: 'collect-legendary',
    name: '神兵天降',
    description: '获得一件传说装备',
    category: 'collection',
    progress: 0, max: 1,
    reward: '+800 金币 · 称号：幸运儿',
    rewardGold: 800,
    // v4.2.1 (P1-4): 传说装备成就奖励技能点
    rewardSkillPoints: 3,
    unlocked: false,
    icon: '💫',
  },
  {
    id: 'collect-full-bag',
    name: '满载而归',
    description: '背包中集齐 10 件不同物品',
    category: 'collection',
    progress: 0, max: 10,
    reward: '+150 金币',
    rewardGold: 150,
    unlocked: false,
    icon: '🎒',
  },
  {
    id: 'collect-rich',
    name: '初窥金库',
    description: '累计持有 500 金币',
    category: 'collection',
    progress: 0, max: 500,
    reward: '+100 金币',
    rewardGold: 100,
    unlocked: false,
    icon: '💰',
  },
  {
    id: 'collect-rich-2',
    name: '富甲一方',
    description: '累计持有 2000 金币，要塞的命脉握于你手',
    category: 'collection',
    progress: 0, max: 2000,
    reward: '+300 金币 · 称号：富豪',
    rewardGold: 300,
    unlocked: false,
    icon: '🪙',
  },

  // ── 叙事 · 暗影纪元史诗 ──
  {
    id: 'story-main',
    name: '命运之始',
    description: '完成第一个主线任务：守夜人之誓',
    category: 'narrative',
    progress: 0, max: 1,
    reward: '+200 金币',
    rewardGold: 200,
    unlocked: false,
    icon: '📜',
  },
  {
    id: 'story-friendly-3',
    name: '八方来援',
    description: '使 3 个阵营的声望达到友善',
    category: 'narrative',
    progress: 0, max: 3,
    reward: '+300 金币',
    rewardGold: 300,
    unlocked: false,
    icon: '🤝',
  },
  {
    id: 'story-truth',
    name: '暗影真相',
    description: '发现世界被掩埋的隐藏真相',
    category: 'narrative',
    progress: 0, max: 1,
    reward: '+500 金币 · 称号：觉醒者',
    rewardGold: 500,
    unlocked: false,
    hidden: true,
    icon: '👁️',
  },
  {
    id: 'story-epic7',
    name: '圣战终章',
    description: '揭开凛冬史诗的完整篇章',
    category: 'narrative',
    progress: 0, max: 1,
    reward: '+1000 金币 · 称号：传承者',
    rewardGold: 1000,
    unlocked: false,
    hidden: true,
    icon: '🏛️',
  },
  {
    id: 'story-survivor',
    name: '长夜幸存',
    description: '在游戏中存活 30 天黎明',
    category: 'narrative',
    progress: 0, max: 30,
    reward: '+200 金币',
    rewardGold: 200,
    unlocked: false,
    icon: '🌅',
  },
  {
    id: 'story-saver',
    name: '记忆守望',
    description: '存档 3 次，让要塞的过往不被遗忘',
    category: 'narrative',
    progress: 0, max: 3,
    reward: '+50 金币',
    rewardGold: 50,
    unlocked: false,
    icon: '💾',
  },
  {
    id: 'story-companion-1',
    name: '羁绊萌芽',
    description: '结识第一位同行的伙伴',
    category: 'narrative',
    progress: 0, max: 1,
    reward: '+50 金币',
    rewardGold: 50,
    unlocked: false,
    icon: '🤝',
  },
  {
    id: 'story-companion-3',
    name: '众志成城',
    description: '与 3 位同伴建立联系，人心聚则壁垒固',
    category: 'narrative',
    progress: 0, max: 3,
    reward: '+150 金币',
    rewardGold: 150,
    unlocked: false,
    icon: '🔗',
  },
  {
    id: 'story-shadow-edge',
    name: '暗影边缘的抉择',
    description: '堕落值达到 50，暗影低语几乎成为你的声音',
    category: 'narrative',
    progress: 0, max: 50,
    reward: '称号：迷途者',
    unlocked: false,
    hidden: true,
    icon: '🌑',
  },
];

// ============================================================
// Achievement List & Lookup
// ============================================================

let achievements: Achievement[] = structuredClone(ACHIEVEMENTS);

const ACHIEVEMENT_MAP: Map<string, Achievement> = new Map();
achievements.forEach(a => ACHIEVEMENT_MAP.set(a.id, a));

/** Get all achievement definitions. */
export function getAchievements(): Achievement[] {
  return achievements;
}

/** Get achievement by ID. */
export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENT_MAP.get(id);
}

/** Get unlocked achievements. */
export function getUnlockedAchievements(): Achievement[] {
  return achievements.filter(a => a.unlocked);
}

/** Reset all achievements (for testing or new game). */
export function resetAchievements(): void {
  achievements = structuredClone(ACHIEVEMENTS);
  ACHIEVEMENT_MAP.clear();
  achievements.forEach(a => ACHIEVEMENT_MAP.set(a.id, a));
}

// ============================================================
// Achievement Checking
// ============================================================

/**
 * Check all achievements against current game context.
 * Returns newly unlocked achievements.
 */
export function checkAchievements(ctx: Partial<AchievementCheckContext>): Achievement[] {
  const newlyUnlocked: Achievement[] = [];

  for (const ach of achievements) {
    if (ach.unlocked) continue;

    let progress = ach.progress;
    let shouldUnlock = false;

    switch (ach.id) {
      // ── 探索 · 暗影荒野 ──
      case 'explore-first':
        progress = Math.max(progress, ctx.regionsDiscovered ?? 0);
        shouldUnlock = progress >= ach.max;
        break;
      case 'explore-three':
        progress = Math.max(progress, ctx.regionsDiscovered ?? 0);
        shouldUnlock = progress >= ach.max;
        break;
      case 'explore-five':
        progress = Math.max(progress, ctx.regionsDiscovered ?? 0);
        shouldUnlock = progress >= ach.max;
        break;
      case 'explore-hidden':
        if (ctx.hiddenAreasFound) {
          progress = ach.max;
          shouldUnlock = true;
        }
        break;
      case 'explore-all':
        if ((ctx.regionsDiscovered ?? 0) >= (ctx.totalRegions ?? 0) && (ctx.totalRegions ?? 0) > 0) {
          progress = ach.max;
          shouldUnlock = true;
        }
        break;

      // ── 战斗 · 守夜人誓约 ──
      case 'combat-first':
        progress = Math.max(progress, ctx.enemiesDefeated ?? 0);
        shouldUnlock = progress >= ach.max;
        break;
      case 'combat-5combo':
        progress = Math.max(progress, ctx.maxComboReached ?? 0);
        shouldUnlock = progress >= ach.max;
        break;
      case 'combat-10combo':
        progress = Math.max(progress, ctx.maxComboReached ?? 0);
        shouldUnlock = progress >= ach.max;
        break;
      case 'combat-reaction-1':
        progress = ctx.elementReactionsTriggered?.size ?? 0;
        shouldUnlock = progress >= ach.max;
        break;
      case 'combat-reaction-3':
        progress = ctx.elementReactionsTriggered?.size ?? 0;
        shouldUnlock = progress >= ach.max;
        break;
      case 'combat-reaction-5':
        progress = ctx.elementReactionsTriggered?.size ?? 0;
        shouldUnlock = progress >= ach.max;
        break;
      case 'combat-hunter':
        progress = Math.max(progress, ctx.enemiesDefeated ?? 0);
        shouldUnlock = progress >= ach.max;
        break;

      // ── 收集 · 财富与造物 ──
      case 'collect-rare':
        if ((ctx.equipmentByRarity?.['rare'] ?? 0) > 0 ||
            (ctx.equipmentByRarity?.['epic'] ?? 0) > 0 ||
            (ctx.equipmentByRarity?.['legendary'] ?? 0) > 0) {
          progress = ach.max;
          shouldUnlock = true;
        }
        break;
      case 'collect-epic':
        if ((ctx.equipmentByRarity?.['epic'] ?? 0) > 0 ||
            (ctx.equipmentByRarity?.['legendary'] ?? 0) > 0) {
          progress = ach.max;
          shouldUnlock = true;
        }
        break;
      case 'collect-legendary':
        if ((ctx.equipmentByRarity?.['legendary'] ?? 0) > 0) {
          progress = ach.max;
          shouldUnlock = true;
        }
        break;
      case 'collect-full-bag':
        progress = Math.max(progress, ctx.inventorySize ?? 0);
        shouldUnlock = progress >= ach.max;
        break;
      case 'collect-rich':
        progress = Math.max(progress, ctx.gold ?? 0);
        shouldUnlock = progress >= ach.max;
        break;
      case 'collect-rich-2':
        progress = Math.max(progress, ctx.gold ?? 0);
        shouldUnlock = progress >= ach.max;
        break;

      // ── 叙事 · 暗影纪元史诗 ──
      case 'story-main':
        if (ctx.mainQuestCompleted) {
          progress = ach.max;
          shouldUnlock = true;
        }
        break;
      case 'story-friendly-3':
        if (ctx.factionReputation) {
          const friendlyCount = Object.values(ctx.factionReputation).filter(v => v >= 1500).length;
          progress = friendlyCount;
          shouldUnlock = progress >= ach.max;
        }
        break;
      case 'story-truth':
        if (ctx.epic7Completed) {
          progress = ach.max;
          shouldUnlock = true;
        }
        break;
      case 'story-epic7':
        if (ctx.epic7Completed) {
          progress = ach.max;
          shouldUnlock = true;
        }
        break;
      case 'story-survivor':
        progress = Math.max(progress, ctx.daysPlayed ?? 0);
        shouldUnlock = progress >= ach.max;
        break;
      case 'story-saver':
        progress = Math.max(progress, ctx.timesSaved ?? 0);
        shouldUnlock = progress >= ach.max;
        break;
      case 'story-companion-1':
        progress = Math.max(progress, ctx.companionsUnlocked ?? 0);
        shouldUnlock = progress >= ach.max;
        break;
      case 'story-companion-3':
        progress = Math.max(progress, ctx.companionsUnlocked ?? 0);
        shouldUnlock = progress >= ach.max;
        break;
      case 'story-shadow-edge':
        progress = Math.max(progress, ctx.corruption ?? 0);
        shouldUnlock = progress >= ach.max;
        break;
    }

    ach.progress = Math.min(progress, ach.max);
    if (shouldUnlock) {
      ach.unlocked = true;
      ach.progress = ach.max;
      newlyUnlocked.push({ ...ach });
    }
  }

  return newlyUnlocked;
}

/**
 * Get raw achievement progress percentages for UI.
 */
export function getAchievementProgress(): { total: number; unlocked: number; byCategory: Record<AchievementCategory, { unlocked: number; total: number }> } {
  const total = achievements.length;
  const unlocked = achievements.filter(a => a.unlocked).length;
  const byCategory: Record<string, { unlocked: number; total: number }> = {
    exploration: { unlocked: 0, total: 0 },
    combat: { unlocked: 0, total: 0 },
    collection: { unlocked: 0, total: 0 },
    narrative: { unlocked: 0, total: 0 },
  };

  for (const ach of achievements) {
    const cat = byCategory[ach.category];
    if (cat) {
      cat.total++;
      if (ach.unlocked) {
        cat.unlocked++;
      }
    }
  }

  return { total, unlocked, byCategory } as {
    total: number;
    unlocked: number;
    byCategory: Record<AchievementCategory, { unlocked: number; total: number }>;
  };
}

// v3.0.0: 成就大类中文标签（供面板使用）
export const ACHIEVEMENT_CATEGORY_LABELS: Record<AchievementCategory, string> = {
  exploration: '探索',
  combat: '战斗',
  collection: '收集',
  narrative: '叙事',
};
