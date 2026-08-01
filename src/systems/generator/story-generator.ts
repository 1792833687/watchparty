/**
 * 故事生成器 — AI Narrator Game v1.1.0
 *
 * 接收设定 → 解析类型 → 强约束生成职业/属性/背包/地图 → 模板输出
 */

import { detectAndGetProfile, validateConsistency } from './constraint-engine';
import type { GenreProfile } from './constraint-engine';

// ============================================================
// Types
// ============================================================

export interface GeneratedWorld {
  /** 世界观识别结果 */
  detectedGenre: string;
  genreProfile: GenreProfile;
  consistencyWarnings: string[];

  /** 生成内容 */
  classes: GeneratedClass[];
  equipment: GeneratedEquipment[];
  mapRegions: GeneratedRegion[];
  openingNarrative: string;
}

export interface GeneratedClass {
  id: string;
  name: string;
  description: string;
  baseAttributes: Record<string, number>;
  startingEquipment: string[];
}

export interface GeneratedEquipment {
  id: string;
  name: string;
  type: string;
  emoji: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare';
}

export interface GeneratedRegion {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  biomeType: string;
}

// ============================================================
// Rarity-based item generator
// ============================================================

const RARITY_WEIGHTS = { common: 0.6, uncommon: 0.3, rare: 0.1 };

function pickRandom<T>(arr: T[], seed?: () => number): T {
  const r = seed ? seed() : Math.random();
  return arr[Math.floor(r * arr.length)]!;
}

function pickRarity(seed?: () => number): 'common' | 'uncommon' | 'rare' {
  const r = seed ? seed() : Math.random();
  if (r < RARITY_WEIGHTS.rare) return 'rare';
  if (r < RARITY_WEIGHTS.rare + RARITY_WEIGHTS.uncommon) return 'uncommon';
  return 'common';
}

const ITEM_EMOJIS: Record<string, string[]> = {
  '武器': ['⚔️', '🗡️', '🔫', '🏹', '💣'],
  '防具': ['🛡️', '🦺', '🧥', '⛑️'],
  '消耗品': ['💊', '🧪', '🍖', '🧃'],
  '宝物': ['💎', '👑', '📜', '🔮'],
  '工具': ['🔧', '🔦', '📱', '🪝'],
  '关键物品': ['🔑', '📁', '💿', '📸'],
  '秘籍': ['📖', '📜', '🎴'],
  '材料': ['🪵', '🪨', '🧵'],
  '义体': ['🦾', '👁️', '🧠'],
};

// ============================================================
// Main Generator
// ============================================================

export function generateWorld(input: {
  name?: string;
  genre?: string;
  tone?: string;
  description?: string;
  era?: string;
  seed?: number;
}): GeneratedWorld {
  // Step 1: Detect genre
  const profile = detectAndGetProfile(input);
  const rng = input.seed ? mulberry32(input.seed) : Math.random;

  // Step 2: Generate classes from profile
  const classes: GeneratedClass[] = profile.classes.map((className, i) => {
    const id = `gen-${profile.genre}-class-${i}`;
    const attrs: Record<string, number> = {};
    const attrKeys = Object.keys(profile.attributes);
    attrKeys.forEach((k) => {
      const attr = profile.attributes[k]!;
      const { min, max } = attr;
      const base = min + Math.floor(((max - min) / 2));
      const tilt = i === 0 ? 0 : (i % 2 === 0 ? 2 : -1);
      attrs[k] = Math.max(min, Math.min(max, base + tilt));
    });

    // Generate starting equipment from item pool
    const startingEquipment: string[] = [];
    profile.itemPool.forEach((pool) => {
      if (pool.items.length > 0) {
        const idx = (i * 3 + 1) % pool.items.length;
        const item = pool.items[idx]!;
        startingEquipment.push(item ?? pool.items[0]!);
      }
    });

    return {
      id,
      name: className,
      description: `${profile.genre === 'fantasy' ? '掌握' : '擅长'}${profile.attributes[(attrKeys[0] ?? 'strength')]?.label ?? '核心'}能力`,
      baseAttributes: attrs,
      startingEquipment: startingEquipment.slice(0, 3),
    };
  });

  // Step 3: Generate equipment
  const equipment: GeneratedEquipment[] = [];
  let eqId = 0;
  profile.itemPool.forEach((pool) => {
    const items = pool.items.slice(0, 6); // Max 6 per type
    items.forEach((itemName) => {
      const rarity = pickRarity(rng);
      const emojiPool = ITEM_EMOJIS[pool.type] ?? ['📦'];
      equipment.push({
        id: `gen-eq-${eqId++}`,
        name: itemName,
        type: pool.type,
        emoji: pickRandom(emojiPool, rng),
        description: rarity === 'rare' ? `罕见的${pool.type}，品质非凡` : `普通的${pool.type}`,
        rarity,
      });
    });
  });

  // Step 4: Generate map regions
  const mapRegions: GeneratedRegion[] = profile.biomes.slice(0, 5).map((biome, i) => ({
    id: `gen-region-${i}`,
    name: biome,
    description: `${biome}${i === 0 ? '（起点）' : ''}`,
    unlocked: i === 0,
    biomeType: profile.genre,
  }));

  // Step 5: Consistency check
  const allItemNames = equipment.map((e) => e.name);
  const { violations } = validateConsistency(profile.genre, allItemNames);
  const consistencyWarnings = violations.map((v) => `⚠️ "${v}"不适合${profile.genre}世界，已自动过滤`);

  // Step 6: Generate opening narrative
  const biome = profile.biomes[0] ?? '未知之地';
  const arch = profile.architecture[0] ?? '神秘建筑';
  const danger = input.tone?.includes('黑暗') || input.tone?.includes('恐怖') ? '诡异' : '神秘';

  const openingNarrative = `你站在${biome}的边缘。${arch}的轮廓在${danger}的光线下若隐若现。${
    profile.classes[0] ? `作为一个${profile.classes[0]}，你知道接下来的一切都将考验你的能力。` : ''
  }远处传来低沉的声音——冒险开始了。`;

  return {
    detectedGenre: profile.genre,
    genreProfile: profile,
    consistencyWarnings,
    classes,
    equipment,
    mapRegions,
    openingNarrative,
  };
}

// ============================================================
// Mulberry32 PRNG (for deterministic generation)
// ============================================================

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
