/**
 * @file 等距坐标系统 — Epic 4.1
 * @description
 * 2D 网格坐标 ↔ 等距屏幕坐标转换，以及距离/邻接/可达性计算。
 * 使用 2D 投影 + clip-path，不用 3D CSS transform（ADR-002 决策）。
 *
 * 核心公式（GDD §5.2）:
 *   screenX = (col - row) * (tileWidth / 2)
 *   screenY = (col + row) * (tileHeight / 2)
 *
 * @see design/gdd/map-system.md §5.2
 * @see docs/architecture/adr/002-map-rendering.md
 */

import type { TileCoord } from './types';

// ============================================================
// 常���
// ============================================================

/** 默认图块尺寸 — 对齐美术圣经 §7.2 */
export const DEFAULT_TILE_WIDTH = 128;
export const DEFAULT_TILE_HEIGHT = 64;

// ============================================================
// 等距投影转换
// ============================================================

/**
 * 等距坐标 → 屏幕坐标 (2D 投影)
 *
 * 公式:
 *   screenX = (col - row) * halfW
 *   screenY = (col + row) * halfH
 *
 * 不依赖 3D CSS transform，避免文字渲染和边框问题（ADR-002）
 */
export function isoToScreen(
  coord: TileCoord,
  tileWidth: number = DEFAULT_TILE_WIDTH,
  tileHeight: number = DEFAULT_TILE_HEIGHT
): { x: number; y: number } {
  const halfW = tileWidth / 2;
  const halfH = tileHeight / 2;
  return {
    x: (coord.col - coord.row) * halfW,
    y: (coord.col + coord.row) * halfH,
  };
}

/**
 * 屏幕坐标 → 等距坐标 (逆投影)
 *
 * 逆公式:
 *   col = (screenX / halfW + screenY / halfH) / 2
 *   row = (screenY / halfH - screenX / halfW) / 2
 */
export function screenToIso(
  screenX: number,
  screenY: number,
  tileWidth: number = DEFAULT_TILE_WIDTH,
  tileHeight: number = DEFAULT_TILE_HEIGHT
): TileCoord {
  const halfW = tileWidth / 2;
  const halfH = tileHeight / 2;
  const col = (screenX / halfW + screenY / halfH) / 2;
  const row = (screenY / halfH - screenX / halfW) / 2;
  return {
    col: Math.floor(col),
    row: Math.floor(row),
  };
}

// ============================================================
// 距离与邻接
// ============================================================

/**
 * 两个坐标之间的切比雪夫距离（等距网格上的"步数"距离）
 *
 * 在等距网格中，从 (col,row) 到相邻 8 个方向的任何一格都是 1 步，
 * 因此使用 max(|Δcol|, |Δrow|) 而不是欧几里得距离。
 */
export function distance(a: TileCoord, b: TileCoord): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

/**
 * 两个坐标之间的欧几里得距离（浮点精度）
 */
export function euclideanDistance(a: TileCoord, b: TileCoord): number {
  const dc = a.col - b.col;
  const dr = a.row - b.row;
  return Math.sqrt(dc * dc + dr * dr);
}

/**
 * 判断两个坐标是否相邻（8 方向邻接）
 */
export function isAdjacent(a: TileCoord, b: TileCoord): boolean {
  const dc = Math.abs(a.col - b.col);
  const dr = Math.abs(a.row - b.row);
  return dc <= 1 && dr <= 1 && (dc + dr) > 0;
}

/**
 * 判断两个坐标是否相等
 */
export function coordsEqual(a: TileCoord, b: TileCoord): boolean {
  return a.col === b.col && a.row === b.row;
}

/**
 * 将坐标转为字符串键 ("col,row")
 */
export function coordsToKey(coord: TileCoord): string {
  return `${coord.col},${coord.row}`;
}

/**
 * 将字符串键解析为坐标
 */
export function keyToCoords(key: string): TileCoord {
  const [col, row] = key.split(',').map(Number);
  return { col: col!, row: row! };
}

// ============================================================
// 邻域
// ============================================================

/** 8 方向偏移 */
export const NEIGHBOR_OFFSETS_8: readonly TileCoord[] = [
  { col: -1, row: -1 }, // NW
  { col:  0, row: -1 }, // N
  { col:  1, row: -1 }, // NE
  { col: -1, row:  0 }, // W
  { col:  1, row:  0 }, // E
  { col: -1, row:  1 }, // SW
  { col:  0, row:  1 }, // S
  { col:  1, row:  1 }, // SE
];

/** 4 方向偏移（仅正交方向） */
export const NEIGHBOR_OFFSETS_4: readonly TileCoord[] = [
  { col:  0, row: -1 }, // N
  { col: -1, row:  0 }, // W
  { col:  1, row:  0 }, // E
  { col:  0, row:  1 }, // S
];

/**
 * 获取指定坐标的 8 方向邻居
 */
export function getNeighbors(coord: TileCoord): TileCoord[] {
  return NEIGHBOR_OFFSETS_8.map((offset) => ({
    col: coord.col + offset.col,
    row: coord.row + offset.row,
  }));
}

/**
 * 获取指定坐标的 4 方向邻居
 */
export function getCardinalNeighbors(coord: TileCoord): TileCoord[] {
  return NEIGHBOR_OFFSETS_4.map((offset) => ({
    col: coord.col + offset.col,
    row: coord.row + offset.row,
  }));
}

// ============================================================
// 可达性
// ============================================================

/**
 * 判断坐标是否在指定边界范围内
 */
export function isInBounds(
  coord: TileCoord,
  bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }
): boolean {
  return (
    coord.col >= bounds.minCol &&
    coord.col <= bounds.maxCol &&
    coord.row >= bounds.minRow &&
    coord.row <= bounds.maxRow
  );
}

/**
 * 计算指定范围内的所有坐标（切比雪夫距离）
 */
export function getCoordsInRange(center: TileCoord, range: number): TileCoord[] {
  const coords: TileCoord[] = [];
  for (let dc = -range; dc <= range; dc++) {
    for (let dr = -range; dr <= range; dr++) {
      if (Math.max(Math.abs(dc), Math.abs(dr)) <= range) {
        coords.push({ col: center.col + dc, row: center.row + dr });
      }
    }
  }
  return coords;
}

/**
 * 获取环形边界坐标（距离 = range 的坐标）
 */
export function getRingCoords(center: TileCoord, range: number): TileCoord[] {
  if (range < 0) return [];
  if (range === 0) return [{ ...center }];
  const coords: TileCoord[] = [];
  for (let dc = -range; dc <= range; dc++) {
    for (let dr = -range; dr <= range; dr++) {
      if (Math.max(Math.abs(dc), Math.abs(dr)) === range) {
        coords.push({ col: center.col + dc, row: center.row + dr });
      }
    }
  }
  return coords;
}

// ============================================================
// 路径辅助
// ============================================================

/**
 * 计算路径在所有四个主轴方向上的最小/最大坐标
 */
export function pathBounds(path: TileCoord[]): {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
} {
  if (path.length === 0) {
    return { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 };
  }
  let minCol = Infinity;
  let maxCol = -Infinity;
  let minRow = Infinity;
  let maxRow = -Infinity;
  for (const c of path) {
    if (c.col < minCol) minCol = c.col;
    if (c.col > maxCol) maxCol = c.col;
    if (c.row < minRow) minRow = c.row;
    if (c.row > maxRow) maxRow = c.row;
  }
  return { minCol, maxCol, minRow, maxRow };
}

/**
 * 线性插值两个坐标之间的所有坐标（Bresenham 网格线）
 * 用于视线计算。
 */
export function lineCoords(from: TileCoord, to: TileCoord): TileCoord[] {
  const coords: TileCoord[] = [];
  const dc = Math.abs(to.col - from.col);
  const dr = Math.abs(to.row - from.row);
  const sc = from.col < to.col ? 1 : -1;
  const sr = from.row < to.row ? 1 : -1;
  let err = dc - dr;
  let col = from.col;
  let row = from.row;

  while (true) {
    coords.push({ col, row });
    if (col === to.col && row === to.row) break;
    const e2 = 2 * err;
    if (e2 > -dr) {
      err -= dr;
      col += sc;
    }
    if (e2 < dc) {
      err += dc;
      row += sr;
    }
  }
  return coords;
}
