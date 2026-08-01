/**
 * v4.0.0 统一主题令牌 — 全局样式常量
 * 所有 UI 组件统一引用此处，消除散落硬编码。
 * @module theme/tokens
 */

// ---- 色彩体系 ----
export const C = {
  // 主色
  gold: '#C9A94E',
  goldLight: '#E0CC85',
  goldDark: '#A07820',

  // 背景
  bgDeep: '#0D0D12',
  bgPanel: '#1E1B18',
  bgCard: '#2A2522',
  bgHover: 'rgba(201,169,78,0.08)',

  // 前景文本
  text: '#E8E0D5',
  textDim: '#A09888',
  textMuted: '#6B635B',

  // 功能色
  danger: '#C85554',
  dangerBg: 'rgba(200,85,84,0.12)',
  ok: '#5A9E6F',
  okBg: 'rgba(90,158,111,0.12)',
  magic: '#7B6FDF',
  magicBg: 'rgba(123,111,223,0.12)',
  info: '#5B8CBE',

  // 稀有度（与 equipment-system 统一）
  rarity: {
    common: '#A09888',
    uncommon: '#5A9E6F',
    rare: '#4A90D9',
    epic: '#A864C0',
    legendary: '#E8A840',
  },

  // 危险等级
  dangerLevel: {
    safe: '#5A9E6F',
    caution: '#C8A44E',
    danger: '#E07040',
    deadly: '#C85554',
  },

  // 暗系 / 死灵
  darkAccent: '#E53E3E',
  darkBg: 'rgba(229,62,62,0.08)',

  // 货币
  currency: {
    gold: '#C9A94E',
    silver: '#B0B8C8',
    copper: '#C8966C',
    shard: '#A864C0',
  },

  // 边框 / 分割线
  border: 'rgba(201,169,78,0.15)',
  borderActive: 'rgba(201,169,78,0.4)',
  borderDanger: 'rgba(200,85,84,0.3)',
} as const;

// ---- 稀有度标签 ----
export const RARITY = {
  common:     { label: '普通', color: C.rarity.common },
  uncommon:   { label: '精良', color: C.rarity.uncommon },
  rare:       { label: '稀有', color: C.rarity.rare },
  epic:       { label: '史诗', color: C.rarity.epic },
  legendary:  { label: '传说', color: C.rarity.legendary },
} as const;

export type Rarity = keyof typeof RARITY;

// ---- 危险等级标签 ----
export const DANGER_LABELS: Record<string, string> = {
  safe: '安全区',
  caution: '警戒区',
  danger: '危险区',
  deadly: '死境',
};

// ---- 物品类型标签 ----
export const ITEM_TYPE_LABELS: Record<string, string> = {
  weapon: '武器',
  armor: '防具',
  consumable: '消耗品',
  material: '材料',
  quest: '任务',
  treasure: '宝物',
  tome: '典籍',
  trinket: '饰品',
  tool: '工具',
  key: '钥匙',
};

// ---- 货币层级 ----
export const CURRENCY = {
  gold:   { name: '金币', symbol: '🪙', rateToCopper: 100 },
  silver: { name: '银币', symbol: '🪙S', rateToCopper: 10 },
  copper: { name: '铜币', symbol: '🪙C', rateToCopper: 1 },
  shard:  { name: '源晶碎片', symbol: '💎', rateToCopper: NaN },
} as const;

export type CurrencyType = keyof typeof CURRENCY;

/** v4.0.0 钱包结构 */
export interface Wallet {
  gold: number;
  silver: number;
  copper: number;
  shard: number;
}

export const EMPTY_WALLET: Wallet = { gold: 0, silver: 0, copper: 0, shard: 0 };

/** 将铜币拆分进钱包 */
export function copperToWallet(totalCopper: number): Omit<Wallet, 'shard'> {
  const g = Math.floor(totalCopper / 100);
  const s = Math.floor((totalCopper % 100) / 10);
  const c = totalCopper % 10;
  return { gold: g, silver: s, copper: c };
}

/** 钱包总铜币值 */
export function walletToCopper(w: Wallet): number {
  return w.gold * 100 + w.silver * 10 + w.copper;
}

/**
 * v4.2.3 (测试镜像消除): 金币 → 铜币换算（1 金币 = 100 铜币）。
 * page.tsx 入账与测试共用此函数，避免"镜像公式"（测试复制实装公式、改一处忘另一处）。
 */
export function goldToCopper(gold: number): number {
  return gold * CURRENCY.gold.rateToCopper;
}

// ---- 阴影 / 光效 ----
export const SHADOW = {
  glow: '0 0 12px rgba(201,169,78,0.25)',
  glowMagic: '0 0 14px rgba(123,111,223,0.3)',
  card: '0 2px 8px rgba(0,0,0,0.35)',
  modal: '0 4px 24px rgba(0,0,0,0.5)',
} as const;

// ---- 圆角 ----
export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 24,
} as const;

// ---- 字体尺寸 ----
export const FONT = {
  xs: '0.6875rem',
  sm: '0.75rem',
  base: '0.875rem',
  md: '0.9375rem',
  lg: '1.0625rem',
  xl: '1.25rem',
  h3: '1rem',
  h2: '1.125rem',
  h1: '1.375rem',
} as const;
