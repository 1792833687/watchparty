/**
 * v4.2.0 物品组合系统测试
 */
import { describe, expect, it } from 'vitest';
import { findRecipe, isCraftable, applyCraft, CRAFT_RECIPES } from '@/systems/crafting/crafting-system';
import type { GameItem } from '@/components/game/panels/types';

function item(id: string, name: string, qty = 1): GameItem {
  return { id, name, emoji: '📦', type: 'material', quantity: qty };
}

describe('物品组合系统', () => {
  it('配方库包含 4 大类别', () => {
    const cats = new Set(CRAFT_RECIPES.map((r) => r.category));
    expect(cats.has('alchemy')).toBe(true);
    expect(cats.has('smithing')).toBe(true);
    expect(cats.has('cooking')).toBe(true);
    expect(cats.has('enchanting')).toBe(true);
  });

  it('草药+空瓶 → 治疗药水', () => {
    const a = item('herb', '草药');
    const b = item('empty-bottle', '空瓶');
    const match = findRecipe(a, b);
    expect(match).not.toBeNull();
    expect(match!.recipe.result.name).toBe('治疗药水');
  });

  it('顺序颠倒也能匹配（b+a）', () => {
    const a = item('empty-bottle', '空瓶');
    const b = item('herb', '草药');
    const match = findRecipe(a, b);
    expect(match).not.toBeNull();
  });

  it('不匹配的组合返回 null', () => {
    const a = item('x', '石头');
    const b = item('y', '木头');
    expect(findRecipe(a, b)).toBeNull();
  });

  it('参与配方的物品 isCraftable = true', () => {
    expect(isCraftable(item('herb', '草药'))).toBe(true);
    expect(isCraftable(item('iron-ingot', '铁锭'))).toBe(true);
    expect(isCraftable(item('random', '普通石头'))).toBe(false);
  });

  it('applyCraft 消耗材料并生成结果', () => {
    const items = [item('herb', '草药'), item('empty-bottle', '空瓶')];
    const match = findRecipe(items[0]!, items[1]!)!;
    const { items: next, newItem } = applyCraft(items, match.recipe, 'herb', 'empty-bottle');
    expect(newItem.name).toBe('治疗药水');
    // 材料消耗完被移除，结果加入
    expect(next.length).toBe(1);
    expect(next[0]!.id).toBe('healing-potion');
  });

  it('数量>1 时材料减一而非移除', () => {
    const items = [item('herb', '草药', 3), item('empty-bottle', '空瓶', 2)];
    const match = findRecipe(items[0]!, items[1]!)!;
    const { items: next } = applyCraft(items, match.recipe, 'herb', 'empty-bottle');
    expect(next.find((i) => i.id === 'herb')?.quantity).toBe(2);
    expect(next.find((i) => i.id === 'empty-bottle')?.quantity).toBe(1);
  });

  it('同类结果叠加数量', () => {
    const items = [
      { ...item('herb', '草药'), id: 'herb2' },
      { ...item('empty-bottle', '空瓶'), id: 'bottle2' },
      item('healing-potion', '治疗药水', 2),
    ];
    const match = findRecipe(items[0]!, items[1]!)!;
    const { items: next, newItem } = applyCraft(items, match.recipe, 'herb2', 'bottle2');
    expect(newItem.quantity).toBe(1);
    expect(next.find((i) => i.id === 'healing-potion')?.quantity).toBe(3);
  });
});
