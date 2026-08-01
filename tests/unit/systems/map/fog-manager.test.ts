/**
 * @file 战争迷雾管理器单元测试 — MAP-UT-03
 * @description 测试三层迷雾揭示、视线阻挡、状态序列化
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { FogManager } from '@/systems/map/fog-manager';
import { coordsToKey, distance } from '@/systems/map/coordinates';
import type { Tile, TileCoord } from '@/systems/map/types';
import { createTestTile, createTestCoord } from '../../../setup';

// ============================================================
// 辅助
// ============================================================

function createTileGrid(size: number): Map<string, Tile> {
  const map = new Map<string, Tile>();
  for (let col = 0; col < size; col++) {
    for (let row = 0; row < size; row++) {
      const coord = createTestCoord(col, row);
      const tile = createTestTile(coord, {
        terrain: 'grass',
        isWalkable: true,
        moveCost: 1.0,
      });
      map.set(coordsToKey(coord), tile);
    }
  }
  return map;
}

// ============================================================
// 测试
// ============================================================

describe('FogManager — 战争迷雾', () => {
  let fog: FogManager;
  let tiles: Map<string, Tile>;

  beforeEach(() => {
    tiles = createTileGrid(15);
    fog = new FogManager(tiles, 6);
  });

  // ── 基础揭示 ──

  it('初始状态所有坐标应为 unexplored', () => {
    expect(fog.getFogState({ col: 0, row: 0 })).toBe('unexplored');
    expect(fog.getFogState({ col: 5, row: 5 })).toBe('unexplored');
  });

  it('revealFog 应揭示视野范围内的图块', () => {
    const result = fog.revealFog({ col: 5, row: 5 }, 3);
    expect(result.newlyVisible.length).toBeGreaterThan(0);

    // 中心点应为 visible
    expect(fog.getFogState({ col: 5, row: 5 })).toBe('visible');

    // 范围内的图块应为 visible
    const inRange = { col: 6, row: 5 };
    expect(fog.getFogState(inRange)).toBe('visible');
  });

  it('视野范围外的图块应保持在 unexplored', () => {
    fog.revealFog({ col: 5, row: 5 }, 2);
    const farAway = { col: 10, row: 10 };
    expect(fog.getFogState(farAway)).toBe('unexplored');
  });

  // ── 三重状态转换 ──

  it('unexplored → visible → explored 转换', () => {
    // Step 1: 揭示 (5,5) 周围
    fog.revealFog({ col: 5, row: 5 }, 2);
    expect(fog.getFogState({ col: 6, row: 5 })).toBe('visible');

    // Step 2: 移动到远处 → 之前 visible 的变为 explored
    fog.revealFog({ col: 12, row: 12 }, 2);
    expect(fog.getFogState({ col: 6, row: 5 })).toBe('explored');
    expect(fog.getFogState({ col: 12, row: 12 })).toBe('visible');
  });

  it('从 explored 回到 visible（玩家走回来）', () => {
    fog.revealFog({ col: 5, row: 5 }, 2);
    expect(fog.getFogState({ col: 6, row: 5 })).toBe('visible');

    fog.revealFog({ col: 12, row: 12 }, 2);
    expect(fog.getFogState({ col: 6, row: 5 })).toBe('explored');

    fog.revealFog({ col: 5, row: 5 }, 2);
    expect(fog.getFogState({ col: 6, row: 5 })).toBe('visible');
  });

  // ── 阻挡物视线 ──

  it('阻挡物（墙壁）后的图块应保持 unexplored', () => {
    // 放置一堵墙在 (5,3)
    const wallKey = coordsToKey({ col: 5, row: 3 });
    const wallTile = tiles.get(wallKey);
    if (wallTile) {
      wallTile.isWalkable = false;
      wallTile.terrain = 'wall';
    }

    fog.setTiles(tiles);

    // 玩家在 (5,0)，看向 (5,6) 方向 — 墙壁 (5,3) 应阻挡视线
    fog.revealFog({ col: 5, row: 0 }, 8);

    // (5,1) 和 (5,2) 应在墙壁前可见
    expect(fog.getFogState({ col: 5, row: 2 })).toBe('visible');

    // (5,3) 本身是墙，没有视线阻挡问题（终点本身不做视线检测）
    // (5,4) 应该在墙后 → 不在 visible 集合中
    // 注意: Bresenham 线从 (5,0) 到 (5,4) 经过 (5,1),(5,2),(5,3),(5,4)
    // (5,3) 不可行走 → 切断视线
    const state54 = fog.getFogState({ col: 5, row: 4 });
    // 可能在范围外或墙后 → 应为 unexplored
    expect(state54).toBe('unexplored');
  });

  // ── 查询方法 ──

  it('isVisible / isExplored 应正确', () => {
    const coord: TileCoord = { col: 3, row: 3 };
    expect(fog.isVisible(coord)).toBe(false);
    expect(fog.isExplored(coord)).toBe(false);

    fog.revealFog(coord, 1);
    expect(fog.isVisible(coord)).toBe(true);
    expect(fog.isExplored(coord)).toBe(true);
  });

  // ── 序列化/反序列化 ──

  it('应正确序列化和恢复迷雾状态', () => {
    fog.revealFog({ col: 5, row: 5 }, 3);

    const exported = fog.exportFogStates();
    expect(Object.keys(exported).length).toBeGreaterThan(0);

    // 创建新的 FogManager 并恢复
    const newFog = new FogManager(tiles, 6);
    newFog.loadFogStates(exported);

    // 验证状态一致
    expect(newFog.getFogState({ col: 5, row: 5 })).toBe('visible');
    expect(newFog.getFogState({ col: 6, row: 5 })).toBe('visible');
    expect(newFog.getFogState({ col: 10, row: 10 })).toBe('unexplored');
  });

  it('空状态序列化不应崩溃', () => {
    const exported = fog.exportFogStates();
    expect(exported).toEqual({});
  });

  // ── reset ──

  it('reset 应清除所有状态', () => {
    fog.revealFog({ col: 5, row: 5 }, 3);
    expect(fog.getFogState({ col: 5, row: 5 })).toBe('visible');

    fog.reset();
    expect(fog.getFogState({ col: 5, row: 5 })).toBe('unexplored');
    expect(fog.getVisibleCoords()).toEqual([]);
  });

  // ── 视野半径 ──

  it('应支持自定义视野半径', () => {
    fog.setViewRadius(1);
    const result = fog.revealFog({ col: 5, row: 5 });
    expect(result.newlyVisible.length).toBe(9); // 3×3 网格 = 9 个坐标
  });

  it('revealFog 的 radius 参数应覆盖 viewRadius', () => {
    fog.setViewRadius(1);
    const result = fog.revealFog({ col: 5, row: 5 }, 2);
    expect(result.newlyVisible.length).toBe(25); // 5×5 网格 = 25 个坐标
  });
});
