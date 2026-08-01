/** v4.0.0: 面板 ID 新增 market；v4.1.0: territory（领地）/ worldbook（世界书）；v4.2.0: town（城镇） */
export type PanelId = 'character' | 'inventory' | 'quest' | 'skills' | 'map' | 'achievements' | 'relations' | 'market' | 'territory' | 'worldbook' | 'town' | null;

export type ItemType = 'consumable' | 'weapon' | 'armor' | 'tool' | 'key' | 'material' | 'quest' | 'treasure' | 'tome' | 'trinket';

export interface ItemEffect {
  hp?: number;
  mp?: number;
  attr?: string;
  value?: number;
}

export interface GameItem {
  id: string;
  name: string;
  emoji: string;
  type?: ItemType;
  category?: string;
  description?: string;
  effect?: ItemEffect;
  quantity?: number;
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  damageType?: string;
  magicSchool?: string;
  /** v4.0.0: 物品背景故事 */
  lore?: string;
  /** v4.0.0: 来源途径 */
  sources?: string[];
  /** v4.0.0: 武器/防具数值 */
  stats?: Record<string, number>;
  /** v4.0.0: 基准价格（铜币） */
  basePrice?: number;
  /** v4.0.0: 可否装备 */
  equippable?: boolean;
  /** v4.0.0: 可否堆叠 */
  stackable?: boolean;
}

export interface GameQuest {
  id: string;
  title: string;
  description: string;
  type: 'main' | 'side';
  progress: number;
  status?: 'active' | 'completed' | 'failed';
}

export interface GameRegion {
  id: string;
  name: string;
  discovered: boolean;
  cx: number;
  cy: number;
  points: string;
  labelX: number;
  labelY: number;
  dangerLevel?: 'safe' | 'caution' | 'danger' | 'deadly';
  regionDesc?: string;
  connections?: string[];
  /** v4.0.0: 地点背景描述 */
  locationDescription?: string;
  /** v4.0.0: 可交互元素 */
  interactions?: LocationInteractionData[];
  /** v4.0.0: 关联剧情线索 */
  plotHints?: string[];
}

/** v4.0.0: 地点交互元素数据 */
export interface LocationInteractionData {
  id: string;
  name: string;
  emoji: string;
  type: 'npc' | 'object' | 'event' | 'hidden';
  desc: string;
  outcome: string;
}

export interface GameSkill {
  id: string;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  emoji: string;
}

/** v4.0.0: 钱包结构 */
export interface Wallet { gold: number; silver: number; copper: number; shard: number; }

export interface GameState {
  items: GameItem[];
  quests: GameQuest[];
  currentLocation: string;
  currentLocationDescription: string;
  regions: GameRegion[];
  skills: GameSkill[];
  playerHp?: number;
  playerMaxHp?: number;
  playerMp?: number;
  playerMaxMp?: number;
  /** v4.0.0: 多层货币钱包 */
  wallet?: Wallet;
  /** @deprecated 保留向后兼容 */
  gold?: number;
  relationships?: CompanionRelationship[];
  /** v4.1.0: 阵营声望（world-setting 10.2，-100 ~ +100） */
  factionReputations?: Record<string, number>;
  /** v4.1.0: 结局条件追踪（world-setting 十一·多结局） */
  endingFlags?: Record<string, number>;
  /** v4.1.0: 领地经营状态（world-setting 八） */
  territory?: import('@/systems/territory/territory-system').TerritoryState;
  /** v5.0.0 (叙事): 预兆梦进度（主角弧光 — 梦境随堕落值变异） */
  propheticDream?: { count?: number; last?: string; motif?: string };
  /** v5.0.0 (叙事): 凛冬议会决策（fortify|strike|aid|negotiate） */
  councilDecision?: string;
  /** v5.0.0 (叙事): 镜像反派鸦羽剧情标记 */
  crowFeather?: { echoes?: number; revealed?: boolean; confront?: boolean };
}

/** v4.1.0: 阵营声望五级阶梯（world-setting 10.2） */
export const REPUTATION_STEPS = [
  { label: '仇敌', min: -100, max: -61, color: '#E53E3E' },
  { label: '敌视', min: -60, max: -21, color: '#E8843C' },
  { label: '中立', min: -20, max: 20, color: '#A09888' },
  { label: '友好', min: 21, max: 60, color: '#5A9E6F' },
  { label: '同盟', min: 61, max: 100, color: '#C9A94E' },
] as const;

/** 由声望值计算所处阶梯 */
export function getReputationStep(reputation: number): (typeof REPUTATION_STEPS)[number] {
  const clamped = Math.max(-100, Math.min(100, reputation));
  return REPUTATION_STEPS.find((s) => clamped >= s.min && clamped <= s.max) ?? REPUTATION_STEPS[2]!;
}

/**
 * v3.0.0 关系网络系统
 * 采用「好感 / 忠诚」双维模型：
 *  - affinity 好感度：决定对话选项、支线开放
 *  - loyalty 忠诚度：决定关键抉择时是否追随，低忠诚可能背叛
 * 人物信息随剧情推进逐级解锁（revealLevel 0~3）
 */
export interface CompanionRelationship {
  id: string;
  name: string;
  /** 未解锁时显示的代号，如「戴兜帽的人」 */
  codename: string;
  race?: string;
  role?: string;
  emoji: string;
  /** 好感度 -100 ~ 100 */
  affinity: number;
  /** 忠诚度 0 ~ 100 */
  loyalty: number;
  /**
   * 情报解锁等级
   * 0 = 未相遇（完全迷雾）
   * 1 = 已相遇（仅知代号与外貌）
   * 2 = 已熟识（知晓姓名、种族、身份）
   * 3 = 已交心（知晓核心信念与内在冲突）
   */
  revealLevel: 0 | 1 | 2 | 3;
  /** 核心信念（revealLevel >= 3 可见） */
  coreBelief?: string;
  /** 内在冲突（revealLevel >= 3 可见） */
  conflict?: string;
  /** 外貌速写（revealLevel >= 1 可见） */
  appearance?: string;
  /** 剧情中已解锁的记忆碎片 */
  memories?: string[];
  /** 当前状态：同行 / 分别 / 敌对 / 死亡 */
  status?: 'companion' | 'parted' | 'hostile' | 'dead';
}

/**
 * v4.0.0: 对话选项 UI
 * AI 在回复中嵌入 OPTIONS 块，前端解析为独立 UI 组件。
 */
export interface DialogueOption {
  id: string;
  text: string;
  emoji?: string;
  /** 选项风格 */
  style?: 'default' | 'bold' | 'cautious' | 'aggressive';
  /** 条件触发：需满足属性/技能/物品 */
  condition?: {
    type: 'attr' | 'skill' | 'item' | 'gold' | 'corruption';
    key: string;
    value?: number;
  };
  /** 选项后果描述（悬停提示） */
  hint?: string;
}
