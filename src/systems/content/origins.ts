/**
 * v4.0.0 出身系统 — 6 出身定义
 * 职业与出身已拆分为独立系统。
 * 出身决定初始属性偏移、起始物品、初始货币与剧情走向。
 * @module systems/content/origins
 */

import type { Wallet } from '@/theme/tokens';

export interface Origin {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  /** 属性修正（叠加在职业之上） */
  attrMods: Partial<Record<'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma', number>>;
  /** 起始钱包 */
  startingWallet: Wallet;
  /** 起始物品名称列表 */
  startingItems: string[];
  /** 出身带来的隐藏特质 */
  hiddenTrait: string;
  /** 专属剧情钩子描述 */
  storyHook: string;
  /** 初始堕落值偏移 */
  corruptionStart: number;
  /** 出身后果列表 */
  consequences: string[];
  /** 初始阵营倾向 */
  factionBias?: { faction: string; attitude: number }[];
}

export const ORIGINS: Origin[] = [
  // ==================== 1. 贵族血脉 ====================
  {
    id: 'noble-blood',
    name: '贵族血脉',
    emoji: '👑',
    desc: '你在丝绸与银盘中长大，但凛冬要塞的石墙比你的城堡更诚实。继承权在别人嘴里，命运在自己脚下。',
    attrMods: { charisma: 2, intelligence: 1 },
    startingWallet: { gold: 3, silver: 5, copper: 0, shard: 1 },
    startingItems: ['贵族纹章戒指', '丝绸手帕', '家徽印章'],
    hiddenTrait: '皇室仪态 — 与贵族NPC交涉时魅力检定+2',
    storyHook: '你的家族欠着暗影势力一笔旧债。债主正在敲凛冬要塞的门。',
    corruptionStart: 2,
    consequences: [
      '与贵族/商人NPC交涉时获得态度加成',
      '更容易被暗影势力针对（旧债追索）',
      '获得额外初始稀有代币（源晶碎片 x1）',
    ],
    // v4.2.1 (P0-6): 阵营偏好映射到凛冬要塞真实阵营（此前 id 无效永不生效）
    factionBias: [
      { faction: 'gondor', attitude: 10 },
      { faction: 'northern-rangers', attitude: 5 },
    ],
  },
  // ==================== 2. 流浪佣兵 ====================
  {
    id: 'mercenary',
    name: '流浪佣兵',
    emoji: '⚔️',
    desc: '你为钱打过仗，为信仰也打过，最后发现两者都会让人流血。现在你只为值得的人拔剑。',
    attrMods: { strength: 2, constitution: 1 },
    startingWallet: { gold: 1, silver: 8, copper: 5, shard: 0 },
    startingItems: ['佣兵铭牌', '磨刀石', '烈酒壶'],
    hiddenTrait: '老兵直觉 — 当生命低于30%时，防御临时+5',
    storyHook: '你曾效力的佣兵团被全灭，凶手至今不明。凛冬要塞可能是你找到答案的唯一机会。',
    corruptionStart: 3,
    consequences: [
      '战斗中获得额外战术选项',
      '初始金币较少但拥有丰富战斗经验',
      '对佣兵/军队NPC有天然亲和力',
    ],
    // v4.2.1 (P0-6): 映射真实阵营
    factionBias: [
      { faction: 'rohan', attitude: 10 },
      { faction: 'northern-rangers', attitude: 5 },
    ],
  },
  // ==================== 3. 学者后裔 ====================
  {
    id: 'scholar',
    name: '学者后裔',
    emoji: '📖',
    desc: '你的祖父留下了一整座图书馆，以及一个你至今不敢念完的禁咒。知识是你的武器，也是你的诅咒。',
    attrMods: { intelligence: 2, wisdom: 1 },
    startingWallet: { gold: 2, silver: 3, copper: 0, shard: 2 },
    startingItems: ['古籍抄本', '羽毛笔与墨水', '放大镜'],
    hiddenTrait: '博闻强记 — 识别古代符文与魔法物品时智力检定+2',
    storyHook: '你在祖父的遗物中发现了一张标注着凛冬要塞深处的秘密地图。上面标记着一个不该存在的东西。',
    corruptionStart: 4,
    consequences: [
      '更容易识别魔法物品与古代符文',
      '获得额外初始源晶碎片（古代知识遗产）',
      '对学术/法师NPC有天然亲和力',
    ],
    // v4.2.1 (P0-6): 映射真实阵营
    factionBias: [
      { faction: 'rivendell', attitude: 15 },
      { faction: 'wood-elves', attitude: 10 },
    ],
  },
  // ==================== 4. 边塞弃儿 ====================
  {
    id: 'outcast',
    name: '边塞弃儿',
    emoji: '🌑',
    desc: '你在雪地里被捡到时只有一件破旧的斗篷和一封信。信上说：让她活下去。你做到了。',
    attrMods: { constitution: 2, dexterity: 1 },
    startingWallet: { gold: 0, silver: 5, copper: 8, shard: 0 },
    startingItems: ['破旧的信', '缝补斗篷', '火石'],
    hiddenTrait: '逆境求存 — 在生命低于25%时，回复效果翻倍',
    storyHook: '那封信的蜡封印记，与要塞塔楼深处的某块石门上的符文一模一样。你到底是谁？',
    corruptionStart: 0,
    consequences: [
      '极低初始金币，但拥有极强的生存能力',
      '初始堕落值为0（纯洁）',
      '与底层NPC有天然亲和力',
    ],
    factionBias: [],
  },
  // ==================== 5. 铁匠传人 ====================
  {
    id: 'smith-heir',
    name: '铁匠传人',
    emoji: '⛏️',
    desc: '你爷爷说过：能修好的东西，就不该被丢掉。人也一样。你带着祖传的锻锤来到要塞，想修好一切。',
    attrMods: { strength: 2, constitution: 1 },
    startingWallet: { gold: 1, silver: 2, copper: 0, shard: 0 },
    startingItems: ['祖传锻锤', '铁锭 x2', '皮革围裙'],
    hiddenTrait: '锻造大师 — 修理与鉴定装备概率+15%',
    storyHook: '你爷爷临终前说：要塞底下，有一块谁都没见过的矿石。你找到它那天，就明白一切了。',
    corruptionStart: 1,
    consequences: [
      '修理/鉴定装备有额外成功率',
      '可打造/改良装备（关联工匠系统）',
      '与商人/工匠NPC有天然亲和力',
    ],
    factionBias: [],
  },
  // ==================== 6. 雪原游牧民 ====================
  {
    id: 'nomad',
    name: '雪原游牧民',
    emoji: '🏔️',
    desc: '你们一族世代在龙脊冰峰上迁徙，从不筑墙，也从不相信墙能挡住任何东西。但你选择了留下。',
    attrMods: { dexterity: 2, wisdom: 1 },
    startingWallet: { gold: 0, silver: 3, copper: 5, shard: 0 },
    startingItems: ['游牧长弓', '御寒兽皮', '占卜骨片'],
    hiddenTrait: '极地适应 — 寒冷环境不受惩罚，雪地移动速度+20%',
    storyHook: '部族长老在你离开时给了你一块冰蓝色的碎片。他说：找到她的另一半，你就找到了回家的路。',
    corruptionStart: 0,
    consequences: [
      '寒冷环境不受惩罚',
      '与兽人/游牧族NPC有天然亲和力',
      '初始金币极少但耐心极高',
    ],
    // v4.2.1 (P0-6): 映射真实阵营
    factionBias: [
      { faction: 'lonely-mountain', attitude: 10 },
      { faction: 'northern-rangers', attitude: 5 },
    ],
  },
];
