/**
 * v4.0.0 市场系统 — 动态定价引擎
 * 价格 = basePrice × rarityMultiplier × supplyDemandFactor × locationModifier
 * @module systems/market
 */

import type { Rarity } from '@/theme/tokens';

// ---- 稀有度倍率 ----
const RARITY_MULTIPLIER: Record<Rarity, number> = {
  common: 1.0,
  uncommon: 1.8,
  rare: 3.5,
  epic: 7.0,
  legendary: 20.0,
};

// ---- 地点修正（v4.2.1 P0-5: key 改为真实区域名，匹配 mapRegionsV2 的中文名称）----
const LOCATION_MODIFIER: Record<string, number> = {
  '凛冬谷': 1.0,
  'winter-glen': 1.0,
  'region-0': 1.0,
  '暮色森林': 1.15,
  'twilight-forest': 1.15,
  'region-1': 1.15,
  '阴影山脉': 1.3,
  'shadow-mountains': 1.3,
  'region-2': 1.3,
  '荒芜平原': 0.85,
  'wasteland': 0.85,
  'region-3': 0.85,
  '黑曜石荒原': 1.5,
  'obsidian-wasteland': 1.5,
  'region-4': 1.5,
  '龙脊冰峰': 2.0,
  'dragon-peak': 2.0,
  'region-5': 2.0,
};

// ---- 供需因子缓存 ----
let supplyDemandCache: Record<string, { supply: number; demand: number }> = {};

/** 重置供需缓存（新游戏开始时调用） */
export function resetMarketCache(): void {
  supplyDemandCache = {};
}

/** 更新某物品的供需 */
export function updateSupplyDemand(itemId: string, supplyDelta: number, demandDelta: number): void {
  if (!supplyDemandCache[itemId]) {
    supplyDemandCache[itemId] = { supply: 50, demand: 50 };
  }
  const s = supplyDemandCache[itemId];
  s.supply = Math.max(0, Math.min(100, s.supply + supplyDelta));
  s.demand = Math.max(0, Math.min(100, s.demand + demandDelta));
}

/** 供需因子：需求高/供给低 → 涨价；供给高/需求低 → 降价。范围 0.5 ~ 2.0 */
function getSupplyDemandFactor(itemId: string): number {
  const s = supplyDemandCache[itemId];
  if (!s) return 1.0;
  const ratio = (s.demand + 10) / (s.supply + 10);
  return Math.max(0.5, Math.min(2.0, ratio));
}

/** 计算买入价（铜币） */
export function calculateBuyPrice(
  basePrice: number,
  rarity: Rarity,
  locationId?: string,
  itemId?: string,
): number {
  const rarityMul = RARITY_MULTIPLIER[rarity] ?? 1.0;
  const locationMul = locationId ? (LOCATION_MODIFIER[locationId] ?? 1.0) : 1.0;
  // v4.2.2 (R2 修复): 供需 key 统一为 itemId — 此前读 `${basePrice}-${rarity}` 从未被写入，
  // 买入价供需因子恒 1.0（���态定价只在卖出侧生效）。itemId 缺省时回退旧 key（兼容）。
  const key = itemId ?? `${basePrice}-${rarity}`;
  const supplyDemandMul = getSupplyDemandFactor(key);
  return Math.max(1, Math.round(basePrice * rarityMul * locationMul * supplyDemandMul));
}

/** 计算卖出价（铜币），约为买入价的 40%-60% */
export function calculateSellPrice(buyPrice: number, itemId?: string): number {
  const base = Math.floor(buyPrice * 0.5);
  if (itemId) {
    const factor = getSupplyDemandFactor(itemId);
    return Math.max(1, Math.round(base * factor));
  }
  return Math.max(1, base);
}

/** 格式化价格显示 */
export function formatPrice(copper: number): string {
  if (copper <= 0) return '—';
  const g = Math.floor(copper / 100);
  const s = Math.floor((copper % 100) / 10);
  const c = copper % 10;
  const parts: string[] = [];
  if (g > 0) parts.push(`${g}🪙`);
  if (s > 0) parts.push(`${s}S`);
  if (c > 0) parts.push(`${c}C`);
  return parts.join(' ');
}
