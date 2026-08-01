/**
 * Dynamic Event Engine — AI Narrator Game v1.0.0
 *
 * Random world events, event chains, seasonal events, weighted
 * by region danger level. Main entry: rollWorldEvent().
 */

// ============================================================
// Types
// ============================================================

export type EventCategory =
  | 'disaster' | 'merchant' | 'encounter' | 'invasion'
  | 'treasure' | 'weather' | 'social' | 'mystery';

export interface GameEvent {
  id: string;
  name: string;
  category: EventCategory;
  description: string;
  weight: number;
  effects: EventEffect[];
  chainId?: string;
  nextEventId?: string;
  seasonOnly?: number; // 0-3 = spring/summer/autumn/winter
  minDay?: number;
}

export interface EventEffect {
  type: 'hp' | 'mp' | 'gold' | 'item' | 'reputation' | 'combat' | 'buff' | 'debuff';
  value: number;
  target?: string;
  description: string;
}

export interface EventRollResult extends GameEvent {
  chainActive: boolean;
  chainStep: number;
}

// ============================================================
// Region Danger Levels
// ============================================================

const REGION_DANGER: Record<string, number> = {
  '海滩': 2,
  'beach': 2,
  '森林': 4,
  '密林': 6,
  'jungle': 5,
  '洞穴': 5,
  '矿洞': 6,
  'cave': 5,
  '山顶': 6,
  'peak': 6,
  '遗迹': 7,
  '废墟': 7,
  'ruins': 7,
  '火山': 9,
  '熔岩': 10,
  '雪原': 5,
  '冰湖': 6,
  '沙漠': 6,
  '沼泽': 7,
  '墓地': 8,
  '神殿': 3,
};

const REGION_PEACE: Record<string, number> = {
  '海滩': 5,
  'beach': 5,
  '森林': 3,
  '城市': 8,
  '神殿': 8,
};

// ============================================================
// Event Definitions (20+)
// ============================================================

const ALL_EVENTS: GameEvent[] = [
  // ── Disasters ──
  {
    id: 'quake',
    name: '地震',
    category: 'disaster',
    description: '地面剧烈震动！裂缝在你脚下张开。',
    weight: 5,
    effects: [{ type: 'hp', value: -15, description: '受到15点地震伤害' }],
  },
  {
    id: 'landslide',
    name: '山体滑坡',
    category: 'disaster',
    description: '山坡上的巨石和泥土倾泻而下！',
    weight: 4,
    effects: [
      { type: 'hp', value: -20, description: '受到20点伤害' },
      { type: 'item', value: -1, description: '丢失了一件物品' },
    ],
    minDay: 3,
  },
  {
    id: 'wildfire',
    name: '野火',
    category: 'disaster',
    description: '干燥的风带来了失控的野火！',
    weight: 3,
    effects: [
      { type: 'hp', value: -10, description: '被火焰灼伤' },
      { type: 'debuff', value: 3, description: '火属性抗性降低，持续3天' },
    ],
    minDay: 5,
  },
  {
    id: 'storm',
    name: '暴风雨',
    category: 'disaster',
    description: '乌云翻滚，暴雨倾盆。雷声在头顶炸响。',
    weight: 6,
    effects: [
      { type: 'hp', value: -5, description: '受到5点伤害' },
      { type: 'buff', value: 1, description: '水属性攻击力+20%，持续1天' },
    ],
  },

  // ── Merchants ──
  {
    id: 'traveling-merchant',
    name: '旅行商人',
    category: 'merchant',
    description: '一位风尘仆仆的商人在路边休息，他的背包里似乎有不少好东西。',
    weight: 8,
    effects: [
      { type: 'item', value: 1, description: '可以购买稀有物品' },
    ],
  },
  {
    id: 'black-market',
    name: '黑市商人',
    category: 'merchant',
    description: '一个戴着面具的神秘商人向你招手。他出售一些...不太合法的东西。',
    weight: 3,
    effects: [
      { type: 'gold', value: -100, description: '可以以高价购买违禁品' },
      { type: 'reputation', value: -50, description: '与神秘商人交易，声望有风险' },
    ],
    minDay: 10,
  },
  {
    id: 'weapon-smith',
    name: '武器大师',
    category: 'merchant',
    description: '一位老铁匠在路边支起了临时锻造台。他说可以帮你强化装备。',
    weight: 4,
    effects: [
      { type: 'gold', value: -200, description: '可花费200金币强化装备' },
    ],
    minDay: 7,
  },

  // ── Encounters ──
  {
    id: 'wounded-traveler',
    name: '受伤的旅人',
    category: 'encounter',
    description: '路边躺着一个满身是血的旅人，他向你求救。',
    weight: 6,
    effects: [
      { type: 'hp', value: -10, description: '救助旅人消耗10HP' },
      { type: 'gold', value: 100, description: '旅人感谢你，给了你100金币' },
    ],
  },
  {
    id: 'mysterious-stranger',
    name: '神秘陌生人',
    category: 'encounter',
    description: '一个穿着斗篷的人拦住你的去路。他说他知道未来的秘密...但你需要付出代价。',
    weight: 3,
    effects: [
      { type: 'gold', value: -50, description: '支付50金币获得秘密情报' },
    ],
    minDay: 5,
    chainId: 'stranger-chain',
    nextEventId: 'stranger-revelation',
  },
  {
    id: 'stranger-revelation',
    name: '陌生人的启示',
    category: 'mystery',
    description: '神秘人揭开斗篷——他竟然是你以为已经死去的人！',
    weight: 1,
    effects: [
      { type: 'reputation', value: 200, description: '揭开了一个重大秘密' },
      { type: 'item', value: 1, description: '获得了神秘信物' },
    ],
    minDay: 15,
  },
  {
    id: 'hermit',
    name: '山间隐士',
    category: 'encounter',
    description: '一位在山中修行多年的隐士愿意教你一项技能。',
    weight: 2,
    effects: [
      { type: 'buff', value: 5, description: '随机属性永久+1' },
    ],
    minDay: 10,
  },

  // ── Invasions ──
  {
    id: 'bandit-raid',
    name: '强盗袭击',
    category: 'invasion',
    description: '一群蒙面强盗从暗处跳出！他们要求你交出财物。',
    weight: 5,
    effects: [
      { type: 'combat', value: 3, description: '与3名强盗作战' },
      { type: 'gold', value: -100, description: '如果失败，损失100金币' },
    ],
  },
  {
    id: 'monster-attack',
    name: '怪物袭击',
    category: 'invasion',
    description: '一只凶猛的地狱犬从阴影中冲出，口中滴着腐蚀性的唾液。',
    weight: 7,
    effects: [
      { type: 'combat', value: 5, description: '与危险怪物作战' },
      { type: 'hp', value: -25, description: '受到25点伤害' },
    ],
    minDay: 3,
  },
  {
    id: 'undead-horde',
    name: '亡灵潮',
    category: 'invasion',
    description: '黑夜中，无数亡者从墓土中爬出，向你涌来...',
    weight: 2,
    effects: [
      { type: 'combat', value: 10, description: '与亡灵大军作战' },
      { type: 'hp', value: -40, description: '受到大量伤害' },
    ],
    minDay: 20,
  },

  // ── Treasure ──
  {
    id: 'treasure-map',
    name: '藏宝图',
    category: 'treasure',
    description: '你在一棵老橡树的树洞里发现了一张泛黄的藏宝图。',
    weight: 4,
    effects: [
      { type: 'item', value: 1, description: '获得藏宝图' },
    ],
    chainId: 'treasure-chain',
    nextEventId: 'treasure-found',
  },
  {
    id: 'treasure-found',
    name: '埋藏的宝藏',
    category: 'treasure',
    description: '按照地图的指引，你找到了埋藏的宝箱！',
    weight: 1,
    effects: [
      { type: 'gold', value: 300, description: '获得300金币' },
      { type: 'item', value: 2, description: '获得两件随机物品' },
    ],
    minDay: 5,
  },
  {
    id: 'hidden-shrine',
    name: '隐藏神社',
    category: 'treasure',
    description: '在密林深处，你发现了一座长满青苔的古老神社。',
    weight: 3,
    effects: [
      { type: 'buff', value: 3, description: '获得持续3天的祝福' },
      { type: 'gold', value: 100, description: '神社旁发现了100金币' },
    ],
  },

  // ── Weather ──
  {
    id: 'dense-fog',
    name: '大雾',
    category: 'weather',
    description: '浓雾笼罩了一切。你看不清前方的路，也难以察觉潜伏的危险。',
    weight: 5,
    effects: [
      { type: 'debuff', value: 2, description: '视野降低，容易遭遇伏击' },
    ],
  },
  {
    id: 'meteor-shower',
    name: '流星雨',
    category: 'weather',
    description: '夜空中落下了一场壮丽的流星雨——其中一颗似乎落在了不远处的山谷。',
    weight: 2,
    effects: [
      { type: 'item', value: 1, description: '可以去山谷寻找陨石' },
      { type: 'buff', value: 1, description: '星之祝福，魔法能力+20%' },
    ],
    chainId: 'meteor-chain',
    nextEventId: 'meteor-mine',
  },
  {
    id: 'meteor-mine',
    name: '陨石矿脉',
    category: 'treasure',
    description: '你找到了陨石的落点——它击穿地面，露出了闪着蓝光的稀有矿石。',
    weight: 1,
    effects: [
      { type: 'gold', value: 500, description: '采集了价值500金币的陨石矿' },
      { type: 'item', value: 1, description: '获得了陨铁精华' },
    ],
    minDay: 7,
  },

  // ── Social ──
  {
    id: 'festival',
    name: '节日庆典',
    category: 'social',
    description: '附近的村庄正在举办一年一度的丰收祭典。人们载歌载舞，美食飘香。',
    weight: 3,
    effects: [
      { type: 'gold', value: 50, description: '获得50金币节日红包' },
      { type: 'reputation', value: 100, description: '与村民同乐，声望+100' },
    ],
    minDay: 5,
  },
  {
    id: 'refugees',
    name: '难民',
    category: 'social',
    description: '一群面黄肌瘦的难民向你求助。他们的村庄被怪物摧毁了。',
    weight: 4,
    effects: [
      { type: 'gold', value: -50, description: '你可以选择捐赠食物和金币' },
      { type: 'reputation', value: 150, description: '帮助难民，声望+150' },
    ],
    minDay: 3,
  },
  {
    id: 'traitors',
    name: '内奸',
    category: 'social',
    description: '一个自称来自你同盟派系的信使带来了消息——但某些细节似乎不对。',
    weight: 2,
    effects: [
      { type: 'reputation', value: -100, description: '如果被骗，声望-100' },
      { type: 'item', value: 1, description: '如果识破，获得情报文件' },
    ],
    minDay: 8,
  },

  // ── Mystery ──
  {
    id: 'ancient-lore',
    name: '古老的记载',
    category: 'mystery',
    description: '你在遗迹中发现了一段残缺的铭文，上面记载着一段被遗忘的历史。',
    weight: 2,
    effects: [
      { type: 'reputation', value: 50, description: '了解了世界真相的一部分' },
    ],
    minDay: 12,
    chainId: 'lore-chain',
    nextEventId: 'lore-complete',
  },
  {
    id: 'lore-complete',
    name: '真相显现',
    category: 'mystery',
    description: '所有的线索终于串联成完整的图景——这个世界的真相远比想象的更加震撼。',
    weight: 1,
    effects: [
      { type: 'reputation', value: 200, description: '揭示真相，获得觉醒者称号' },
      { type: 'buff', value: 10, description: '获得长久的智慧祝福' },
    ],
    minDay: 25,
  },
];

// ============================================================
// Season Calculation
// ============================================================

/**
 * Get season index from day number.
 * 0=Spring, 1=Summer, 2=Autumn, 3=Winter
 */
export function getSeason(day: number): number {
  return Math.floor((day % 120) / 30);
}

/**
 * Get season name.
 */
export function getSeasonName(day: number): string {
  const seasons = ['春', '夏', '秋', '冬'];
  return seasons[getSeason(day)] ?? '春';
}

// ============================================================
// Event Chain Tracking
// ============================================================

const activeChains = new Map<string, { currentEvent: string; step: number; startedDay: number }>();

function getChain(category: string, eventId: string): { currentEvent: string; step: number } | null {
  const key = `${category}:${eventId}`;
  return activeChains.get(key) ?? null;
}

function startChain(category: string, eventId: string): void {
  const key = `${category}:${eventId}`;
  if (!activeChains.has(key)) {
    activeChains.set(key, { currentEvent: eventId, step: 1, startedDay: 0 });
  }
}

function advanceChain(category: string, eventId: string): void {
  const key = `${category}:${eventId}`;
  const chain = activeChains.get(key);
  if (chain) {
    chain.currentEvent = eventId;
    chain.step++;
  }
}

// ============================================================
// Event Rolling
// ============================================================

/**
 * Roll a random world event.
 *
 * @param rng - Random number generator
 * @param region - Current region name
 * @param day - Current day number
 * @returns A GameEvent or null if no event fires
 */
export function rollWorldEvent(
  rng: () => number,
  region: string,
  day: number
): EventRollResult | null {
  const season = getSeason(day);
  const dangerLevel = REGION_DANGER[region] ?? 3;

  // Filter eligible events
  const eligible = ALL_EVENTS.filter(e => {
    if (e.minDay && day < e.minDay) return false;
    if (e.seasonOnly !== undefined && e.seasonOnly !== season) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  // Weight calculation
  const weighted = eligible.map(e => {
    let w = e.weight;
    // Increase combat/invasion weight in dangerous areas
    if ((e.category === 'invasion' || e.category === 'disaster') && dangerLevel >= 7) {
      w *= 2.0;
    }
    if ((e.category === 'merchant' || e.category === 'social') && dangerLevel <= 3) {
      w *= 1.5;
    }
    // Decrease combat weight in peaceful areas
    if ((e.category === 'invasion') && dangerLevel <= 2) {
      w *= 0.3;
    }
    return { event: e, weight: w };
  });

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  if (totalWeight <= 0) return null;

  let roll = rng() * totalWeight;
  let selected = weighted[0];
  for (const w of weighted) {
    roll -= w.weight;
    if (roll <= 0) {
      selected = w;
      break;
    }
  }

  const event = selected!.event;

  // Chain check
  let chainActive = false;
  let chainStep = 0;

  if (event.chainId) {
    const chain = getChain(event.category, event.chainId);
    if (chain && chain.currentEvent === event.id) {
      chainActive = true;
      chainStep = chain.step;
    }
    if (!chain) {
      startChain(event.category, event.chainId);
      chainStep = 1;
    }
  }

  if (event.nextEventId) {
    const chain = getChain(event.category, event.chainId ?? event.id);
    if (chain) {
      advanceChain(event.category, event.nextEventId);
    }
  }

  return { ...event, chainActive, chainStep };
}

/**
 * Roll a seasonal boss event (fires every 30 days).
 */
export function rollSeasonalEvent(
  rng: () => number,
  day: number
): GameEvent | null {
  const season = getSeason(day);

  const seasonalEvents: GameEvent[] = [
    {
      id: 'spring-boss',
      name: '春之守护者',
      category: 'invasion',
      description: '春天的守护者——一只巨大的树精——从沉睡中苏醒。它认为你破坏了自然的平衡。',
      weight: 1,
      effects: [
        { type: 'combat', value: 15, description: '与春之守护者对战' },
        { type: 'item', value: 1, description: '击败后获得自然精华' },
      ],
      seasonOnly: 0,
    },
    {
      id: 'summer-boss',
      name: '炎之巨兽',
      category: 'invasion',
      description: '火焰从地底喷涌而出，炎之巨兽现身了！整个天空都被染成红色。',
      weight: 1,
      effects: [
        { type: 'combat', value: 18, description: '与炎之巨兽对战' },
        { type: 'item', value: 1, description: '击败后获得火焰之心' },
      ],
      seasonOnly: 1,
    },
    {
      id: 'autumn-boss',
      name: '秋之收割者',
      category: 'invasion',
      description: '一阵枯萎之风扫过大地，秋之收割者手持镰刀，从落叶中无声出现。',
      weight: 1,
      effects: [
        { type: 'combat', value: 14, description: '与秋之收割者对战' },
        { type: 'item', value: 1, description: '击败后获得凋零之镰' },
      ],
      seasonOnly: 2,
    },
    {
      id: 'winter-boss',
      name: '冰霜女王',
      category: 'invasion',
      description: '寒冬的暴风雪中，一个巨大的冰晶人影浮现——冰霜女王降临了。',
      weight: 1,
      effects: [
        { type: 'combat', value: 20, description: '与冰霜女王对战' },
        { type: 'item', value: 1, description: '击败后获得冰霜之心' },
      ],
      seasonOnly: 3,
    },
  ];

  const bossEvent = seasonalEvents[season];
  return bossEvent ?? null;
}

/**
 * Roll for seasonal merchant (every 30 days).
 */
export function rollSeasonalMerchant(
  rng: () => number,
  day: number
): GameEvent | null {
  const season = getSeason(day);

  const seasonalMerchants: GameEvent[] = [
    {
      id: 'spring-merchant',
      name: '春之商人',
      category: 'merchant',
      description: '春季特供商人带着稀有的草药和种子来到附近。',
      weight: 1,
      effects: [
        { type: 'item', value: 3, description: '可购买春季限定物品' },
      ],
      seasonOnly: 0,
    },
    {
      id: 'summer-merchant',
      name: '夏日行商',
      category: 'merchant',
      description: '乘坐骆驼商队的行商带来了沙漠中的奇珍异宝。',
      weight: 1,
      effects: [
        { type: 'item', value: 3, description: '可购买夏季限定物品' },
      ],
      seasonOnly: 1,
    },
    {
      id: 'autumn-merchant',
      name: '秋收商人',
      category: 'merchant',
      description: '丰收季节，商人带来了丰富的粮食和珍藏的酒品。',
      weight: 1,
      effects: [
        { type: 'item', value: 3, description: '可购买秋季限定物品' },
      ],
      seasonOnly: 2,
    },
    {
      id: 'winter-merchant',
      name: '冬日货郎',
      category: 'merchant',
      description: '穿着厚皮袄的货郎带来了保暖物资和冬季特产。',
      weight: 1,
      effects: [
        { type: 'item', value: 3, description: '可购买冬季限定物品' },
      ],
      seasonOnly: 3,
    },
  ];

  return seasonalMerchants[season] ?? null;
}

// ============================================================
// Event Utilities
// ============================================================

/**
 * Get all events by category.
 */
export function getEventsByCategory(category: EventCategory): GameEvent[] {
  return ALL_EVENTS.filter(e => e.category === category);
}

/**
 * Get event by ID.
 */
export function getEventById(id: string): GameEvent | undefined {
  return ALL_EVENTS.find(e => e.id === id);
}

/**
 * Reset all active event chains.
 */
export function resetEventChains(): void {
  activeChains.clear();
}
