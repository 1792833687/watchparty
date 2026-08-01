/**
 * Global Random Engine — AI Narrator Game v0.7.0
 *
 * Provides deterministic seeded RNG (mulberry32), loot tables,
 * event triggers, and chest generation. All randomness flows
 * through a single seed stored in localStorage, enabling
 * reproducible game sessions.
 *
 * @module lib/utils/random
 */

// ============================================================
// Types
// ============================================================

export interface LootItem {
  id: string;
  name: string;
  emoji: string;
  type: 'consumable' | 'weapon' | 'armor' | 'tool' | 'key';
  description: string;
  effect?: { hp?: number; mp?: number; attr?: string; value?: number };
  quantity?: number;
}

export interface LootTable {
  common: { item: LootItem; weight: number }[];
  rare?: { item: LootItem; weight: number }[];
  epic?: { item: LootItem; weight: number }[];
}

export type RngFn = () => number;

// ============================================================
// Seeded RNG (mulberry32)
// ============================================================

/**
 * Create a deterministic PRNG from a numeric seed.
 * Returns a function that produces values in [0, 1).
 */
export function createRng(seed: number): RngFn {
  let state = seed | 0;
  return (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a seed from a string via simple hash.
 */
export function seedFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash;
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Random integer in [min, max] inclusive.
 */
export function randomInt(rng: RngFn, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Pick a random element from an array.
 */
export function randomPick<T>(rng: RngFn, arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Weighted random selection.
 */
export function randomWeighted<T>(
  rng: RngFn,
  items: { item: T; weight: number }[]
): T | undefined {
  const totalWeight = items.reduce((sum, it) => sum + it.weight, 0);
  if (totalWeight <= 0) return undefined;
  let roll = rng() * totalWeight;
  for (const entry of items) {
    roll -= entry.weight;
    if (roll <= 0) return entry.item;
  }
  return items[items.length - 1]?.item;
}

// ============================================================
// Loot System
// ============================================================

/** Base loot tables — per item type with weight */
const COMMON_LOOT: { item: LootItem; weight: number }[] = [
  { item: { id: 'bandage', name: '绷带', emoji: '🩹', type: 'consumable', description: '止血用', effect: { hp: 10 }, quantity: 1 }, weight: 5 },
  { item: { id: 'ration', name: '干粮', emoji: '🍞', type: 'consumable', description: '充饥', effect: { hp: 5, mp: 5 }, quantity: 1 }, weight: 4 },
  { item: { id: 'torch', name: '火把', emoji: '🔦', type: 'tool', description: '照亮黑暗', quantity: 1 }, weight: 3 },
  { item: { id: 'rope-loot', name: '绳索', emoji: '🪢', type: 'tool', description: '攀爬用', quantity: 1 }, weight: 3 },
  { item: { id: 'pebble', name: '石子', emoji: '🪨', type: 'tool', description: '可投掷', quantity: 1 }, weight: 3 },
];

const RARE_LOOT: { item: LootItem; weight: number }[] = [
  { item: { id: 'potion-hp', name: '生命药剂', emoji: '🧪', type: 'consumable', description: '恢复大量HP', effect: { hp: 30 }, quantity: 1 }, weight: 4 },
  { item: { id: 'potion-mp', name: '魔力药剂', emoji: '💎', type: 'consumable', description: '恢复大量MP', effect: { mp: 20 }, quantity: 1 }, weight: 3 },
  { item: { id: 'iron-sword', name: '铁剑', emoji: '⚔️', type: 'weapon', description: '基础武器', effect: { attr: 'strength', value: 3 }, quantity: 1 }, weight: 3 },
  { item: { id: 'leather-armor', name: '皮甲', emoji: '🛡️', type: 'armor', description: '基础防具', effect: { attr: 'constitution', value: 2 }, quantity: 1 }, weight: 2 },
  { item: { id: 'ammo', name: '箭矢', emoji: '🏹', type: 'tool', description: '远程攻击消耗品', quantity: 5 }, weight: 2 },
];

const EPIC_LOOT: { item: LootItem; weight: number }[] = [
  { item: { id: 'elixir', name: '万能药', emoji: '✨', type: 'consumable', description: '完全恢复HP和MP', effect: { hp: 999, mp: 999 }, quantity: 1 }, weight: 3 },
  { item: { id: 'magical-ring', name: '魔法戒指', emoji: '💍', type: 'armor', description: '魔力涌动', effect: { attr: 'intelligence', value: 5 }, quantity: 1 }, weight: 2 },
  { item: { id: 'dragon-scale', name: '龙鳞', emoji: '🐉', type: 'tool', description: '传说级锻造材料', quantity: 1 }, weight: 2 },
  { item: { id: 'ancient-scroll', name: '远古卷轴', emoji: '📜', type: 'tool', description: '记载失传知识', quantity: 1 }, weight: 2 },
  { item: { id: 'phoenix-feather', name: '不死鸟羽毛', emoji: '🪶', type: 'consumable', description: '复活一次', effect: { hp: 50 }, quantity: 1 }, weight: 1 },
];

const levelRarityMap: Record<number, 'common' | 'rare' | 'epic'> = {
  1: 'common', 2: 'common', 3: 'common',
  4: 'rare', 5: 'rare', 6: 'rare',
  7: 'epic', 8: 'epic', 9: 'epic', 10: 'epic',
};

/**
 * Roll for loost based on player level and loot table.
 * Returns 0-4 items depending on rolls and rarity.
 */
export function rollLoot(
  rng: RngFn,
  level: number,
  lootTable?: LootTable
): LootItem[] {
  const results: LootItem[] = [];
  const rarity = levelRarityMap[level] || 'common';

  // Always use global tables unless a custom table is provided
  const commonPool = lootTable?.common || COMMON_LOOT;
  const rarePool = lootTable?.rare || RARE_LOOT;
  const epicPool = lootTable?.epic || EPIC_LOOT;

  // Number of items: 1-3 for common, 1-4 for rare, 2-4 for epic
  const minItems = rarity === 'epic' ? 2 : 1;
  const maxItems = rarity === 'epic' ? 4 : rarity === 'rare' ? 3 : 2;
  const itemCount = randomInt(rng, minItems, maxItems);

  for (let i = 0; i < itemCount; i++) {
    // Roll for rarity bump: 5% epic, 15% rare, 80% common (on top of base rarity)
    const rarityRoll = rng();
    let pool: { item: LootItem; weight: number }[];

    if (rarity === 'epic') {
      pool = rarityRoll < 0.4 ? epicPool : rarityRoll < 0.7 ? rarePool : commonPool;
    } else if (rarity === 'rare') {
      pool = rarityRoll < 0.15 ? rarePool : commonPool;
    } else {
      pool = commonPool;
    }

    const picked = randomWeighted(rng, pool);
    if (picked) {
      // Avoid duplicate IDs
      if (!results.some((r) => r.id === picked.id)) {
        results.push({ ...picked, quantity: picked.quantity ?? 1 });
      } else {
        // Stack quantity on existing item
        const existing = results.find((r) => r.id === picked!.id);
        if (existing) {
          existing.quantity = (existing.quantity ?? 1) + 1;
        }
      }
    }
  }

  return results;
}

// ============================================================
// Event Triggers
// ============================================================

/**
 * Roll for a random event trigger with given probability.
 * Returns true if event should fire.
 */
export function rollEvent(rng: RngFn, prob: number): boolean {
  return rng() < Math.min(1, Math.max(0, prob));
}

// ============================================================
// Chest Generation
// ============================================================

const CHEST_CONFIG: Record<'common' | 'rare' | 'epic', { name: string; emoji: string; itemMin: number; itemMax: number }> = {
  common: { name: '木箱', emoji: '📦', itemMin: 1, itemMax: 2 },
  rare: { name: '铁箱', emoji: '🔒', itemMin: 2, itemMax: 3 },
  epic: { name: '宝箱', emoji: '💎', itemMin: 3, itemMax: 5 },
};

/**
 * Generate contents for a treasure chest.
 * Returns an array of LootItems found in the chest.
 */
export function generateChestContents(
  rng: RngFn,
  rarity: 'common' | 'rare' | 'epic'
): LootItem[] {
  const config = CHEST_CONFIG[rarity];
  const count = randomInt(rng, config.itemMin, config.itemMax);
  const pool = rarity === 'epic' ? EPIC_LOOT : rarity === 'rare' ? RARE_LOOT : COMMON_LOOT;
  const results: LootItem[] = [];

  for (let i = 0; i < count; i++) {
    const picked = randomWeighted(rng, pool);
    if (picked) {
      if (!results.some((r) => r.id === picked.id)) {
        results.push({ ...picked, quantity: picked.quantity ?? 1 });
      } else {
        const existing = results.find((r) => r.id === picked!.id);
        if (existing) {
          existing.quantity = (existing.quantity ?? 1) + 1;
        }
      }
    }
  }

  return results;
}

// ============================================================
// Session Seed Management
// ============================================================

const SEED_KEY = 'ai-narrator-game-seed';

/**
 * Get or create the game seed for this session.
 * Stored in localStorage. If no seed exists, generates one from timestamp.
 */
export function getSessionSeed(): number {
  try {
    const existing = localStorage.getItem(SEED_KEY);
    if (existing) {
      const parsed = parseInt(existing, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch {
    // localStorage unavailable
  }

  const newSeed = seedFromString(`${Date.now()}-${Math.random()}`);
  try {
    localStorage.setItem(SEED_KEY, String(newSeed));
  } catch {
    // localStorage unavailable
  }
  return newSeed;
}

/**
 * Override the session seed (e.g., for testing or save/load).
 */
export function setSessionSeed(seed: number): void {
  try {
    localStorage.setItem(SEED_KEY, String(seed));
  } catch {
    // localStorage unavailable
  }
}

/**
 * Create a game RNG from the current session seed.
 */
export function createGameRng(): RngFn {
  return createRng(getSessionSeed());
}

/**
 * Create a fresh RNG with a new random seed.
 */
export function refreshGameRng(): RngFn {
  const newSeed = seedFromString(`${Date.now()}-${Math.random()}`);
  setSessionSeed(newSeed);
  return createRng(newSeed);
}
