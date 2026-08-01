/**
 * Equipment System — AI Narrator Game v1.0.0
 *
 * 5-tier rarity system with affix pools and procedural generation.
 * Equipment affects player stats and can be equipped in game panels.
 */

// ============================================================
// Types
// ============================================================

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const RARITY_COLORS: Record<Rarity, { color: string; bg: string; border: string }> = {
  common: { color: '#888888', bg: 'rgba(136,136,136,0.12)', border: 'rgba(136,136,136,0.3)' },
  uncommon: { color: '#5A9E6F', bg: 'rgba(90,158,111,0.12)', border: 'rgba(90,158,111,0.3)' },
  rare: { color: '#5B8CBE', bg: 'rgba(91,140,190,0.12)', border: 'rgba(91,140,190,0.3)' },
  epic: { color: '#7B6FDF', bg: 'rgba(123,111,223,0.12)', border: 'rgba(123,111,223,0.3)' },
  legendary: { color: '#C9A94E', bg: 'rgba(201,169,78,0.12)', border: 'rgba(201,169,78,0.3)' },
};

export const RARITY_LABELS: Record<Rarity, string> = {
  common: '普通',
  uncommon: '精良',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

export const RARITY_SORT_ORDER: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

export type EquipmentType = 'weapon' | 'armor' | 'accessory' | 'consumable';

export interface EquipmentAffix {
  name: string;
  attribute: string;
  value: number;
}

export interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  rarity: Rarity;
  baseStats: Record<string, number>;
  affixes: EquipmentAffix[];
  durability: number;
  maxDurability: number;
  level: number;
  description: string;
}

// ============================================================
// Affix Pools
// ============================================================

interface AffixConfig {
  name: string;
  attribute: string;
  minValue: number;
  maxValue: number;
  prefix: string;
}

const AFFIX_POOL: AffixConfig[] = [
  { name: '锋利', attribute: 'strength', minValue: 1, maxValue: 8, prefix: '锋利的' },
  { name: '坚韧', attribute: 'constitution', minValue: 1, maxValue: 8, prefix: '坚韧的' },
  { name: '迅捷', attribute: 'agility', minValue: 1, maxValue: 8, prefix: '迅捷的' },
  { name: '燃烧', attribute: 'fireDamage', minValue: 2, maxValue: 12, prefix: '燃烧的' },
  { name: '冰冻', attribute: 'iceDamage', minValue: 2, maxValue: 12, prefix: '冰霜的' },
  { name: '吸血', attribute: 'lifeSteal', minValue: 1, maxValue: 5, prefix: '嗜血的' },
  { name: '反弹', attribute: 'reflect', minValue: 1, maxValue: 5, prefix: '荆棘的' },
  { name: '幸运', attribute: 'luck', minValue: 1, maxValue: 5, prefix: '幸运的' },
  { name: '智慧', attribute: 'intelligence', minValue: 1, maxValue: 8, prefix: '睿智的' },
  { name: '魅力', attribute: 'charisma', minValue: 1, maxValue: 5, prefix: '魅力的' },
  { name: '破甲', attribute: 'armorPen', minValue: 2, maxValue: 10, prefix: '破甲的' },
  { name: '暴怒', attribute: 'critChance', minValue: 1, maxValue: 10, prefix: '暴怒的' },
  { name: '精准', attribute: 'critDamage', minValue: 5, maxValue: 25, prefix: '精准的' },
  { name: '再生', attribute: 'hpRegen', minValue: 1, maxValue: 5, prefix: '再生的' },
  { name: '魔力', attribute: 'maxMp', minValue: 10, maxValue: 50, prefix: '魔力的' },
];

// ============================================================
// Equipment Name Templates
// ============================================================

const WEAPON_NAMES: Record<Rarity, string[]> = {
  common: ['木剑', '短刀', '长矛', '骨弓', '投石索'],
  uncommon: ['铁剑', '长柄斧', '战锤', '轻弩', '精铁枪'],
  rare: ['精钢剑', '寒冰弓', '火焰法杖', '暗影匕首', '龙牙之矛'],
  epic: ['雷霆之剑', '凤凰长弓', '奥术权杖', '虚空之刃', '风暴之锤'],
  legendary: ['创世神剑', '末日审判', '永恒之矛', '星辰魔杖', '混沌双刃'],
};

const ARMOR_NAMES: Record<Rarity, string[]> = {
  common: ['皮甲', '布袍', '木盾', '锁子甲', '草鞋'],
  uncommon: ['铁甲', '魔法长袍', '钢盾', '鳞甲', '皮靴'],
  rare: ['精金铠甲', '元素法袍', '龙鳞盾', '暗影披风', '秘银靴'],
  epic: ['圣光战甲', '深渊斗篷', '不朽之盾', '幻影披风', '泰坦战靴'],
  legendary: ['天神战甲', '虚空斗篷', '创世之盾', '时空披风', '命运之靴'],
};

const ACCESSORY_NAMES: Record<Rarity, string[]> = {
  common: ['铜戒指', '骨坠', '符文石', '丝带', '铁手镯'],
  uncommon: ['银戒指', '翡翠项链', '魔法护符', '金丝手镯', '牧师徽章'],
  rare: ['蓝宝石戒指', '龙牙项链', '元素护符', '暗影吊坠', '战斗铭牌'],
  epic: ['星芒戒指', '凤凰护符', '时空项链', '混沌徽记', '圣光之环'],
  legendary: ['永恒之戒', '命运项链', '创世护符', '虚空之眼', '天神印记'],
};

const CONSUMABLE_NAMES: Record<Rarity, string[]> = {
  common: ['小药瓶', '面包', '绷带', '解毒草', '止血粉'],
  uncommon: ['生命药剂', '魔力药水', '清醒药剂', '抗火药膏', '解毒剂'],
  rare: ['大生命药剂', '万能药', '力量药水', '敏捷药水', '智慧药水'],
  epic: ['远古药剂', '龙血精华', '凤凰之泪', '虚空精华', '圣光药水'],
  legendary: ['永生之药', '神之血', '宇宙精华', '命运之水', '创世之息'],
};

// ============================================================
// Base Stats by Type
// ============================================================

function getBaseStats(type: EquipmentType, level: number): Record<string, number> {
  const scale = 1 + (level - 1) * 0.5;
  switch (type) {
    case 'weapon':
      return {
        attack: Math.round(5 * scale),
        critChance: 5,
      };
    case 'armor':
      return {
        defense: Math.round(5 * scale),
        hp: Math.round(20 * scale),
      };
    case 'accessory':
      return {
        intelligence: Math.round(3 * scale),
        luck: 1,
      };
    case 'consumable':
      return {
        hp: Math.round(15 * scale),
      };
  }
}

// ============================================================
// Rarity Roll
// ============================================================

/**
 * Roll rarity based on level with weighted probability.
 */
export function rollRarity(rng: () => number, level: number): Rarity {
  const roll = rng();
  if (level >= 40 && roll < 0.02) return 'legendary';
  if (level >= 25 && roll < 0.06) return 'epic';
  if (level >= 15 && roll < 0.15) return 'rare';
  if (level >= 8 && roll < 0.35) return 'uncommon';
  return 'common';
}

/**
 * Get number of affixes for a given rarity.
 */
export function getAffixCount(rarity: Rarity): { min: number; max: number } {
  switch (rarity) {
    case 'common': return { min: 0, max: 1 };
    case 'uncommon': return { min: 1, max: 2 };
    case 'rare': return { min: 2, max: 3 };
    case 'epic': return { min: 3, max: 4 };
    case 'legendary': return { min: 4, max: 5 };
  }
}

// ============================================================
// Simple RNG (for internal use without external dependency)
// ============================================================

function simpleRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================
// Equipment Generation
// ============================================================

/**
 * Generate a single affix from the affix pool.
 */
export function generateAffixes(rarity: Rarity, rng: () => number): EquipmentAffix[] {
  const { min, max } = getAffixCount(rarity);
  const count = min + Math.floor(rng() * (max - min + 1));

  const usedIndices = new Set<number>();
  const result: EquipmentAffix[] = [];

  for (let i = 0; i < count; i++) {
    let idx: number;
    do {
      idx = Math.floor(rng() * AFFIX_POOL.length);
    } while (usedIndices.has(idx) && usedIndices.size < AFFIX_POOL.length);

    if (usedIndices.has(idx)) break;
    usedIndices.add(idx);

    const config = AFFIX_POOL[idx];
    if (!config) break;
    const value = config.minValue + Math.floor(rng() * (config.maxValue - config.minValue + 1));

    result.push({
      name: config.name,
      attribute: config.attribute,
      value,
    });
  }

  return result;
}

/**
 * Generate equipment of a given type and level.
 */
export function generateEquipment(
  type: EquipmentType,
  level: number,
  seed?: number
): Equipment {
  const rng = simpleRng(seed ?? Date.now() + Math.random() * 10000);
  const rarity = rollRarity(rng, level);
  const affixes = generateAffixes(rarity, rng);

  // Pick name from appropriate pool
  let namePool: string[];
  switch (type) {
    case 'weapon': namePool = WEAPON_NAMES[rarity]; break;
    case 'armor': namePool = ARMOR_NAMES[rarity]; break;
    case 'accessory': namePool = ACCESSORY_NAMES[rarity]; break;
    case 'consumable': namePool = CONSUMABLE_NAMES[rarity]; break;
  }

  const nameIdx = Math.floor(rng() * namePool.length);
  const baseName = namePool[nameIdx] ?? '未知物品';

  // Add affix prefix if applicable
  const affixPrefix = affixes.length > 0 ? AFFIX_POOL.find(a => a.name === affixes[0]!.name)?.prefix ?? '' : '';
  const displayName = affixPrefix ? `${affixPrefix}${baseName}` : baseName;

  const baseStats = getBaseStats(type, level);

  // Build description
  const affixText = affixes.map(a => `+${a.value} ${a.name}`).join('，');
  const description = `Lv.${level} ${RARITY_LABELS[rarity]}${type === 'weapon' ? '武器' : type === 'armor' ? '防具' : type === 'accessory' ? '饰品' : '消耗品'}` +
    (affixText ? `\n词缀：${affixText}` : '');

  const maxDurability = 50 + level * 5;

  return {
    id: `eq-${type}-${level}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: displayName,
    type,
    rarity,
    baseStats,
    affixes,
    durability: maxDurability,
    maxDurability,
    level,
    description,
  };
}

/**
 * Generate starter equipment for a new character.
 * Returns a set of common-grade gear.
 */
export function generateStarterGear(seed?: number): Equipment[] {
  const rng = simpleRng(seed ?? Date.now());
  return [
    generateEquipment('weapon', 1, Math.floor(rng() * 10000)),
    generateEquipment('armor', 1, Math.floor(rng() * 10000)),
  ];
}

// ============================================================
// Equipment Utilities
// ============================================================

/**
 * Calculate total stats from equipment including affixes.
 */
export function calculateEquipmentStats(equipment: Equipment): Record<string, number> {
  const totals: Record<string, number> = { ...equipment.baseStats };

  for (const affix of equipment.affixes) {
    totals[affix.attribute] = (totals[affix.attribute] || 0) + affix.value;
  }

  return totals;
}

/**
 * Format equipment as a display string.
 */
export function formatEquipmentStats(equipment: Equipment): string {
  const lines: string[] = [];
  const stats = calculateEquipmentStats(equipment);

  lines.push(`${equipment.name}`);
  lines.push(`${RARITY_LABELS[equipment.rarity]} · Lv.${equipment.level}`);

  for (const [key, val] of Object.entries(stats)) {
    lines.push(`${key}: ${val}`);
  }

  if (equipment.affixes.length > 0) {
    lines.push('---');
    for (const a of equipment.affixes) {
      lines.push(`${a.name} +${a.value}`);
    }
  }

  return lines.join('\n');
}
