/**
 * v4.1.0 领地经营系统（world-setting 八·领地经营）
 *
 * 6 设施 × 3 级 + 战略桌 4 项目 + 防御值 + 围城战。
 * @module systems/territory/territory-system
 */

// ============================================================
// 类型定义
// ============================================================

export type FacilityId = 'keep' | 'wall' | 'barracks' | 'housing' | 'temple' | 'workshop';

export type ResourceId = 'gold' | 'stone' | 'wood' | 'iron' | 'grain' | 'crystal';

export interface FacilityLevel {
  name: string;
  cost: Partial<Record<ResourceId, number>>;
  desc: string;
}

export interface FacilityDef {
  id: FacilityId;
  name: string;
  icon: string;
  desc: string;
  /** 每级描述：index 0 = 1 级，1 = 2 级，2 = 3 级 */
  levels: FacilityLevel[];
}

export interface TerritoryState {
  /** 设施等级：0=未建造，1~3=已建等级 */
  facilities: Record<FacilityId, number>;
  /** 核心资源 */
  resources: Record<ResourceId, number>;
  /** 战略桌项目进度（0-100） */
  strategyProjects: Record<string, number>;
  /** 防御值 */
  defense: number;
  /** 围城战倒计时（天） */
  siegeCountdown: number;
  /** 已挺过围城战次数 */
  siegesSurvived: number;
}

// ============================================================
// 设施数据（world-setting 8.1）
// ============================================================

export const FACILITIES: FacilityDef[] = [
  {
    id: 'keep', name: '主堡', icon: '🏰',
    desc: '要塞的心脏。议政、储财与号令之所。',
    levels: [
      { name: '领主大厅', desc: '基础议政厅，容纳 20 名守卫。', cost: { gold: 100, stone: 40, wood: 30 } },
      { name: '议事厅+仓库', desc: '解锁战略桌（每轮可执行 1 项战略项目）。', cost: { gold: 300, stone: 100, wood: 60, iron: 40 } },
      { name: '王座厅', desc: '全阵营声望成长 +15%，威慑检定优势。', cost: { gold: 800, stone: 250, wood: 120, iron: 100, crystal: 20 } },
    ],
  },
  {
    id: 'wall', name: '城墙', icon: '🧱',
    desc: '要塞的第一道防线。防御值的核心来源。',
    levels: [
      { name: '基础石墙', desc: '防御值 +30。', cost: { gold: 80, stone: 80, wood: 20 } },
      { name: '加固城墙+箭塔', desc: '防御值 +60。', cost: { gold: 250, stone: 180, wood: 80, iron: 60 } },
      { name: '魔法护盾', desc: '防御值 +90，围城战首日免疫伤害。', cost: { gold: 700, stone: 300, wood: 150, iron: 120, crystal: 40 } },
    ],
  },
  {
    id: 'barracks', name: '兵营', icon: '⚔️',
    desc: '训练守军之地。决定你面对围城时有多少把剑。',
    levels: [
      { name: '训练场', desc: '守军力量 +10，防御值 +10。', cost: { gold: 100, wood: 60, iron: 30 } },
      { name: '铁匠铺+马厩', desc: '守军力量 +25，防御值 +25，解锁骑兵单位。', cost: { gold: 350, wood: 120, iron: 100 } },
      { name: '骑士团大厅', desc: '守军力量 +50，防御值 +50，围城战可发起一次反冲锋。', cost: { gold: 900, wood: 250, iron: 220, crystal: 30 } },
    ],
  },
  {
    id: 'housing', name: '民居', icon: '🏠',
    desc: '要塞的人口基础。人口带来税收与兵源。',
    levels: [
      { name: '木屋', desc: '人口 +50，每周税收 +20 金币。', cost: { gold: 50, wood: 80 } },
      { name: '石砌民居+市场', desc: '人口 +150，每周税收 +60 金币，市场交易 +10%。', cost: { gold: 200, wood: 100, stone: 120 } },
      { name: '温泉浴场+学院', desc: '人口 +400，每周税收 +150 金币，智力/感知检定 +1。', cost: { gold: 600, wood: 200, stone: 250, crystal: 25 } },
    ],
  },
  {
    id: 'temple', name: '神殿', icon: '⛪',
    desc: '信仰之地。抵抗堕落与治愈伤痛的关键。',
    levels: [
      { name: '小礼拜堂', desc: '每次休整可祈祷一次：堕落值 -5。', cost: { gold: 80, stone: 60, wood: 30 } },
      { name: '圣坛+治疗室', desc: '每次休整可祈祷两次：堕落值 -8，治疗全部伤病。', cost: { gold: 250, stone: 150, wood: 60 } },
      { name: '大圣堂', desc: '每次休整可祈祷三次：堕落值 -12，神圣法术 +20%。', cost: { gold: 700, stone: 300, wood: 100, crystal: 35 } },
    ],
  },
  {
    id: 'workshop', name: '工坊', icon: '🔨',
    desc: '锻造与炼金之所。产出装备与稀有材料。',
    levels: [
      { name: '铁匠铺', desc: '每次休整产出 1 件精良武器，锻造花费 -10%。', cost: { gold: 100, wood: 40, iron: 50 } },
      { name: '炼金实验室', desc: '每次休整产出 2 瓶药剂+1 件精良防具，解锁秘银熔炼。', cost: { gold: 300, wood: 80, iron: 100, stone: 60 } },
      { name: '传奇锻造大厅', desc: '每次休整产出 1 件稀有装备，可熔炼传说材料，锻造花费 -25%。', cost: { gold: 850, wood: 150, iron: 250, crystal: 30 } },
    ],
  },
];

// ============================================================
// 战略桌 4 大项目（world-setting 8.3）
// ============================================================

export interface StrategyProject {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** 每轮投入的资源 */
  cost: Partial<Record<ResourceId, number>>;
  /** 完成后奖励 */
  reward: string;
}

export const STRATEGY_PROJECTS: StrategyProject[] = [
  {
    id: 'armor', name: '铸甲卫国', icon: '🛡️',
    desc: '大规模锻造守军装备，全面提升要塞防御。',
    cost: { gold: 150, iron: 60, stone: 40 },
    reward: '完成：防御值 +40，全体守军伤害减免 10%',
  },
  {
    id: 'knowledge', name: '知识之光', icon: '📚',
    desc: '扩建学院与图书馆，招募学者。',
    cost: { gold: 120, wood: 80, grain: 40 },
    reward: '完成：智力/感知检定 +1，每次休整额外获得 1 个技能点',
  },
  {
    id: 'faith', name: '信仰之盾', icon: '✨',
    desc: '扩大神殿影响力，庇护民心。',
    cost: { gold: 130, stone: 60, crystal: 10 },
    reward: '完成：每次休整祈祷次数 +1，堕落值上限降低 10',
  },
  {
    id: 'people', name: '万民之厅', icon: '🏛️',
    desc: '兴修水利与道路，繁荣民生。',
    cost: { gold: 160, wood: 100, grain: 60 },
    reward: '完成：人口 +200，每周税收 +80，魅力检定 +1',
  },
];

// ============================================================
// 工具函数
// ============================================================

export const RESOURCE_LABELS: Record<ResourceId, string> = {
  gold: '金币', stone: '石材', wood: '木材', iron: '铁锭', grain: '粮食', crystal: '魔法水晶',
};

export const RESOURCE_ICONS: Record<ResourceId, string> = {
  gold: '🪙', stone: '🪨', wood: '🪵', iron: '⚙️', grain: '🌾', crystal: '💎',
};

/** 初始领地状态 */
export function createInitialTerritory(): TerritoryState {
  return {
    facilities: { keep: 0, wall: 0, barracks: 0, housing: 0, temple: 0, workshop: 0 },
    resources: { gold: 200, stone: 100, wood: 120, iron: 40, grain: 80, crystal: 0 },
    strategyProjects: { armor: 0, knowledge: 0, faith: 0, people: 0 },
    defense: 0,
    siegeCountdown: 60,
    siegesSurvived: 0,
  };
}

/** 计算防御值（world-setting 8.4：防御值 = 城墙级×30 + 守军力量 + 魔法防护 + 英雄加成） */
export function calcDefense(state: TerritoryState): number {
  const wallLevel = state.facilities.wall ?? 0;
  const barracksLevel = state.facilities.barracks ?? 0;
  const keepLevel = state.facilities.keep ?? 0;
  // 城墙 3 级：+30/+60/+90；兵营 3 级：+10/+25/+50；主堡 3 级：+10/+20/+40
  const wallBonus = [0, 30, 60, 90][wallLevel] ?? 0;
  const barracksBonus = [0, 10, 25, 50][barracksLevel] ?? 0;
  const keepBonus = [0, 10, 20, 40][keepLevel] ?? 0;
  return wallBonus + barracksBonus + keepBonus;
}

/** 获取设施当前等级定义 */
export function getFacilityLevel(f: FacilityDef, level: number): FacilityLevel | null {
  if (level < 1 || level > 3) return null;
  return f.levels[level - 1] ?? null;
}

/** 获取下一级建造费用（若已达 3 级返回 null） */
export function getUpgradeCost(f: FacilityDef, level: number): Partial<Record<ResourceId, number>> | null {
  if (level >= 3) return null;
  return f.levels[level]?.cost ?? null;
}

/** 升级是否可支付 */
export function canAfford(resources: Record<ResourceId, number>, cost: Partial<Record<ResourceId, number>>): boolean {
  return Object.entries(cost).every(([rid, amount]) => (resources[rid as ResourceId] ?? 0) >= (amount ?? 0));
}

/** 支付资源（返回剩余资源） */
export function payCost(resources: Record<ResourceId, number>, cost: Partial<Record<ResourceId, number>>): Record<ResourceId, number> {
  const next = { ...resources };
  for (const [rid, amount] of Object.entries(cost)) {
    next[rid as ResourceId] = (next[rid as ResourceId] ?? 0) - (amount ?? 0);
  }
  return next;
}

/** 围城战结算：返回是否守城成功 */
export function resolveSiege(state: TerritoryState, attackPower: number): { survived: boolean; defense: number; attackPower: number; losses: Partial<Record<ResourceId, number>>; downgraded?: FacilityId | null } {
  const defense = calcDefense(state);
  const survived = defense >= attackPower;
  const losses: Partial<Record<ResourceId, number>> = {};
  let downgraded: FacilityId | null = null;
  if (survived) {
    // 胜利：损失少量资源
    losses.gold = Math.min(state.resources.gold ?? 0, 30);
    losses.grain = Math.min(state.resources.grain ?? 0, 20);
  } else {
    // v4.2.1 (P0-4): 失守 = 大量资源损失 + 随机设施降级 1 级（此前无惩罚，围城无威胁）
    losses.gold = Math.min(state.resources.gold ?? 0, 120);
    losses.grain = Math.min(state.resources.grain ?? 0, 60);
    losses.wood = Math.min(state.resources.wood ?? 0, 40);
    losses.iron = Math.min(state.resources.iron ?? 0, 20);
    // 随机降级一个已建成的设施（主堡不降级，保护核心）
    const upgradeable: FacilityId[] = (['wall', 'barracks', 'housing', 'temple', 'workshop'] as FacilityId[])
      .filter((fid) => (state.facilities[fid] ?? 0) > 0);
    if (upgradeable.length > 0) {
      downgraded = upgradeable[Math.floor(Math.random() * upgradeable.length)] ?? null;
    }
  }
  return { survived, defense, attackPower, losses, downgraded };
}

// ============================================================
// v4.2.1 (P0-4): 税收与产出结算 — 兑现设施描述中的"每周税收/每章产出"
// ============================================================

/** 民居税收：1 级 +20 / 2 级 +60 / 3 级 +150 金币（每次休整结算） */
export function collectTax(state: TerritoryState): number {
  const housingLevel = state.facilities.housing ?? 0;
  const TAX_TABLE = [0, 20, 60, 150];
  return TAX_TABLE[housingLevel] ?? 0;
}

/** 工坊产出：1 级 铁+5 / 2 级 铁+12 / 3 级 铁+30 + 1 件装备素材（每次休整结算） */
export function collectWorkshopOutput(state: TerritoryState): Partial<Record<ResourceId, number>> {
  const workshopLevel = state.facilities.workshop ?? 0;
  const IRON_TABLE = [0, 5, 12, 30];
  const out: Partial<Record<ResourceId, number>> = {};
  if (IRON_TABLE[workshopLevel]) out.iron = IRON_TABLE[workshopLevel];
  return out;
}

/** 神殿祈祷：减堕落值（1 级 -3 / 2 级 -6 / 3 级 -12） */
export function templePrayer(level: number): number {
  const REDUCE_TABLE = [0, 3, 6, 12];
  return REDUCE_TABLE[level] ?? 0;
}
