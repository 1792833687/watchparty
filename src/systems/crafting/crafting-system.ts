/**
 * v4.2.0 物品组合（合成）系统
 *
 * 背包内物品可两两组合生成新物品（炼金/锻造/烹饪/附魔）。
 * 组合配方数据驱动，可扩展；UI 提供「组合」模式选择两件物品。
 * @module systems/crafting/crafting-system
 */

import type { GameItem } from '@/components/game/panels/types';

export interface CraftRecipe {
  id: string;
  /** 组合配方：a + b → result */
  a: string; // 物品 ID 或名称
  b: string;
  result: {
    id: string;
    name: string;
    emoji: string;
    type: GameItem['type'];
    description: string;
    effect?: GameItem['effect'];
    rarity?: GameItem['rarity'];
    stats?: Record<string, number>;
    quantity?: number;
    equippable?: boolean;
    stackable?: boolean;
  };
  /** 组合操作名（炼金/锻造/烹饪/附魔） */
  category: 'alchemy' | 'smithing' | 'cooking' | 'enchanting';
  /** 组合描述 */
  desc: string;
}

export const CRAFT_CATEGORY_LABELS: Record<CraftRecipe['category'], string> = {
  alchemy: '🧪 炼金',
  smithing: '🔨 锻造',
  cooking: '🍲 烹饪',
  enchanting: '✨ 附魔',
};

/**
 * 基础组合配方库（D&D 风格，与 items-library 联动）。
 * 匹配时支持 ID 或名称。
 */
export const CRAFT_RECIPES: CraftRecipe[] = [
  // ── 炼金 ──
  {
    id: 'craft-heal-potion',
    a: '草药', b: '空瓶',
    result: { id: 'healing-potion', name: '治疗药水', emoji: '🧪', type: 'consumable', description: '饮用后恢复 40 点生命值', effect: { hp: 40 }, rarity: 'common', quantity: 1 },
    category: 'alchemy', desc: '将草药浸泡、煮沸，灌入瓶中——基础的治疗药水。',
  },
  {
    id: 'craft-mana-potion',
    a: '魔法水晶', b: '空瓶',
    result: { id: 'mana-potion', name: '法力药水', emoji: '🔮', type: 'consumable', description: '饮用后恢复 30 点法力值', effect: { mp: 30 }, rarity: 'common', quantity: 1 },
    category: 'alchemy', desc: '水晶磨粉溶于酒精，蓝光闪烁——恢复法力的圣水。',
  },
  {
    id: 'craft-antidote',
    a: '草药', b: '硫磺',
    result: { id: 'antidote', name: '解毒剂', emoji: '💊', type: 'consumable', description: '解除中毒状态并恢复 15 点生命', effect: { hp: 15 }, rarity: 'common', quantity: 1 },
    category: 'alchemy', desc: '硫磺与草药中和毒素——野外生存必备。',
  },
  // ── 锻造 ──
  {
    id: 'craft-iron-sword',
    a: '铁锭', b: '木柄',
    result: { id: 'iron-sword', name: '铁制长剑', emoji: '⚔️', type: 'weapon', description: '粗制但可靠的标准长剑', rarity: 'common', stats: { 攻击: 5 }, equippable: true },
    category: 'smithing', desc: '熔铁锻造成刃，装上木柄——冒险者第一把像样的武器。',
  },
  {
    id: 'craft-steel-sword',
    a: '铁制长剑', b: '精钢',
    result: { id: 'steel-sword', name: '精钢长剑', emoji: '🗡️', type: 'weapon', description: '加入精钢锻打的长剑，锋利耐用', rarity: 'uncommon', stats: { 攻击: 9 }, equippable: true },
    category: 'smithing', desc: '在铁匠铺回炉重锻，渗入精钢——品质飞跃。',
  },
  {
    id: 'craft-leather-armor',
    a: '皮革', b: '铁钉',
    result: { id: 'leather-armor', name: '镶钉皮甲', emoji: '🛡️', type: 'armor', description: '钉上铁片的皮甲，轻便且防护提升', rarity: 'common', stats: { 防御: 4 }, equippable: true },
    category: 'smithing', desc: '将铁钉嵌入多层皮革——便宜的保命装。',
  },
  // ── 烹饪 ──
  {
    id: 'craft-hearty-meal',
    a: '肉干', b: '香料酒',
    result: { id: 'hearty-meal', name: '丰盛炖肉', emoji: '🍖', type: 'consumable', description: '恢复 50 点生命，并在当天力量检定 +1', effect: { hp: 50 }, rarity: 'uncommon', quantity: 1 },
    category: 'cooking', desc: '肉干与香料酒慢炖——旅人最想念的味道。',
  },
  {
    id: 'craft-herbal-tea',
    a: '草药', b: '清水',
    result: { id: 'herbal-tea', name: '草药茶', emoji: '🍵', type: 'consumable', description: '恢复 10 点法力并缓解疲劳', effect: { mp: 10 }, rarity: 'common', quantity: 1 },
    category: 'cooking', desc: '草药入滚水，清香提神——营地里的仪式感。',
  },
  // ── 附魔 ──
  {
    id: 'craft-flame-sword',
    a: '精钢长剑', b: '魔法水晶',
    result: { id: 'flame-sword', name: '烈焰长剑', emoji: '🔥', type: 'weapon', description: '附魔火焰的精钢剑，攻击附带灼烧', rarity: 'rare', stats: { 攻击: 12, 火焰: 4 }, equippable: true },
    category: 'enchanting', desc: '以魔法水晶为媒，将烈焰刻入剑身——真正的魔法武器。',
  },
  {
    id: 'craft-heart-stone',
    a: '魔法水晶', b: '硫磺',
    result: { id: 'heart-stone', name: '烈焰之石', emoji: '💎', type: 'treasure', description: '蕴含火焰之力的宝石，可用于附魔或高价出售', rarity: 'rare', quantity: 1 },
    category: 'enchanting', desc: '水晶吸纳硫磺的热力，凝固成滚烫的宝石。',
  },
];

/** 按名称/ID 匹配物品 */
function matchItem(item: GameItem, key: string): boolean {
  return item.id === key || item.name === key;
}

export interface CraftMatch {
  recipe: CraftRecipe;
  /** 需要消耗的物品（可能同名同款多次） */
  consumes: GameItem[];
}

/** 查找两个物品能触发的组合配方 */
export function findRecipe(itemA: GameItem, itemB: GameItem): CraftMatch | null {
  for (const recipe of CRAFT_RECIPES) {
    const aMatches = matchItem(itemA, recipe.a) && matchItem(itemB, recipe.b);
    const bMatches = matchItem(itemA, recipe.b) && matchItem(itemB, recipe.a);
    if (aMatches || bMatches) {
      return { recipe, consumes: [itemA, itemB] };
    }
  }
  return null;
}

/** 该物品是否参与任何配方 */
export function isCraftable(item: GameItem): boolean {
  return CRAFT_RECIPES.some(
    (r) => matchItem(item, r.a) || matchItem(item, r.b)
  );
}

/** 组合后扣减库存：消耗配方中的两件（数量各 -1），生成结果物品 */
export function applyCraft(
  items: GameItem[],
  recipe: CraftRecipe,
  aId: string,
  bId: string
): { items: GameItem[]; newItem: GameItem } {
  const consume = (list: GameItem[], id: string): GameItem[] =>
    list.map((i) => {
      if (i.id === id) {
        const qty = (i.quantity ?? 1) - 1;
        return qty <= 0 ? null : { ...i, quantity: qty };
      }
      return i;
    }).filter((i): i is GameItem => i !== null);

  // 依次消耗两件材料（基于上一轮结果，避免重复读取原始数组）
  const afterA = consume(items, aId);
  let next = consume(afterA, bId);
  const newItem: GameItem = { ...recipe.result, quantity: recipe.result.quantity ?? 1 };
  // 若结果已在背包中则叠加数量
  const existing = next.find((i) => i.id === newItem.id);
  if (existing && existing.quantity !== undefined) {
    next = next.map((i) =>
      i.id === newItem.id ? { ...i, quantity: (i.quantity ?? 1) + (newItem.quantity ?? 1) } : i
    );
  } else {
    next = [...next, newItem];
  }
  return { items: next, newItem };
}
