/**
 * @file A* 寻路单元测试 — MAP-UT-02
 * @description 测试 A* 寻路在各种场景下的正确性
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { findPath, getReachableTiles } from '@/systems/map/pathfinder';
import { coordsToKey } from '@/systems/map/coordinates';
import type { Tile, TileCoord } from '@/systems/map/types';
import { createTestTile, createTestCoord } from '../../../setup';

// ============================================================
// 辅助函数
// ============================================================

/** 创建 N×N 草地网格，所有图块默认可行走 */
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

/** 在网格中放置障碍物 */
function placeObstacle(tiles: Map<string, Tile>, col: number, row: number): void {
  const key = coordsToKey({ col, row });
  const tile = tiles.get(key);
  if (tile) {
    tile.isWalkable = false;
    tile.terrain = 'wall';
  }
}

// ============================================================
// 测试
// ============================================================

describe('Pathfinder — A* 寻路', () => {
  let grid: Map<string, Tile>;

  beforeEach(() => {
    grid = createTileGrid(10);
  });

  // ── 基础功能 ──

  it('起点 = 终点应返回空路径', () => {
    const from: TileCoord = { col: 0, row: 0 };
    const to: TileCoord = { col: 0, row: 0 };
    const path = findPath(from, to, grid);
    expect(path).toEqual([]);
  });

  it('相邻图块应返回单步路径', () => {
    const from: TileCoord = { col: 0, row: 0 };
    const to: TileCoord = { col: 1, row: 0 };
    const path = findPath(from, to, grid);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(1);
    expect(path![0]).toEqual(to);
  });

  it('简单直线路径应正确', () => {
    const from: TileCoord = { col: 0, row: 0 };
    const to: TileCoord = { col: 5, row: 0 };
    const path = findPath(from, to, grid);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(5);
    expect(path![path!.length - 1]).toEqual(to);
  });

  it('对角路径应正确', () => {
    const from: TileCoord = { col: 0, row: 0 };
    const to: TileCoord = { col: 5, row: 5 };
    const path = findPath(from, to, grid);
    expect(path).not.toBeNull();
    expect(path![path!.length - 1]).toEqual(to);
  });

  // ── 障碍物 ──

  it('应绕过单个障碍物', () => {
    // 放置一堵墙在 (3,0)
    placeObstacle(grid, 3, 0);

    const from: TileCoord = { col: 0, row: 0 };
    const to: TileCoord = { col: 5, row: 0 };

    const path = findPath(from, to, grid);
    expect(path).not.toBeNull();
    // 路径不应经过 (3,0)
    for (const coord of path!) {
      expect(coord.col === 3 && coord.row === 0).toBe(false);
    }
    // 应到达目标
    expect(path![path!.length - 1]).toEqual(to);
  });

  it('完全被围住时应返回 null', () => {
    // 把 (1,1) 围住
    placeObstacle(grid, 0, 1);
    placeObstacle(grid, 1, 0);
    placeObstacle(grid, 2, 1);
    placeObstacle(grid, 1, 2);

    const from: TileCoord = { col: 0, row: 0 };
    const to: TileCoord = { col: 1, row: 1 };
    const path = findPath(from, to, grid);
    // (1,1) 本身 walkable 但无法到达
    expect(path).toBeNull();
  });

  it('障碍物包围（回廊）', () => {
    // 创建一条弯曲回廊
    // 0 1 2 3 4 5
    // . . W . . .  row 0
    // . . W . W .  row 1
    // . . . . W .  row 2
    // . . . . . .  row 3
    for (let c = 0; c < 6; c++) {
      for (let r = 0; r < 4; r++) {
        grid.set(coordsToKey({ col: c, row: r }),
          createTestTile({ col: c, row: r }, { isWalkable: true }));
      }
    }
    placeObstacle(grid, 2, 0);
    placeObstacle(grid, 2, 1);
    placeObstacle(grid, 4, 1);
    placeObstacle(grid, 4, 2);

    const path = findPath({ col: 0, row: 0 }, { col: 5, row: 0 }, grid);
    expect(path).not.toBeNull();
    // 路径不应经过障碍物
    const wallKeys = new Set(['2,0', '2,1', '4,1', '4,2']);
    for (const coord of path!) {
      expect(wallKeys.has(coordsToKey(coord))).toBe(false);
    }
  });

  // ── 目标不可达 ──

  it('目标图块不可行走应返回 null', () => {
    placeObstacle(grid, 5, 0);
    const path = findPath({ col: 0, row: 0 }, { col: 5, row: 0 }, grid);
    expect(path).toBeNull();
  });

  // ── 性能 ──

  it('500 格距离的路径计算应在 50ms 内完成', () => {
    const bigGrid = createTileGrid(50);
    const from: TileCoord = { col: 0, row: 0 };
    const to: TileCoord = { col: 25, row: 0 };

    const start = performance.now();
    const path = findPath(from, to, bigGrid);
    const elapsed = performance.now() - start;

    expect(path).not.toBeNull();
    expect(path!.length).toBe(25);
    expect(elapsed).toBeLessThan(50);
  });

  // ── 对角线选项 ──

  it('禁止对角线时应走正交路径', () => {
    const path = findPath(
      { col: 0, row: 0 },
      { col: 2, row: 2 },
      grid,
      { allowDiagonals: false }
    );
    expect(path).not.toBeNull();
    // 不走对角线的路径长度应该 ≥ 4 (2,0→2,2 or 0,2→2,2)
    expect(path!.length).toBeGreaterThanOrEqual(4);
  });
});

// ============================================================
// getReachableTiles
// ============================================================

describe('getReachableTiles', () => {
  it('应在范围内返回可到达的图块', () => {
    const grid = createTileGrid(8);
    placeObstacle(grid, 2, 0);
    placeObstacle(grid, 2, 1);

    const reachable = getReachableTiles({ col: 0, row: 0 }, grid, 3);
    expect(reachable.length).toBeGreaterThan(0);
    // 障碍物不应在可达列表中
    const obstacleKey = coordsToKey({ col: 2, row: 0 });
    for (const coord of reachable) {
      expect(coordsToKey(coord)).not.toBe(obstacleKey);
    }
  });
});
