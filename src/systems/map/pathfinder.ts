/**
 * @file A* 寻路 — Epic 4.3
 * @description
 * 等距网格上的 A* 寻路算法。8 方向移动，考虑地形移动成本和阻挡物。
 * 使用二叉堆优化优先队列（PERF-1），对角线判断不依赖索引硬编码（BUG-6）。
 *
 * 性能目标: 500 格路径 < 50ms (GDD §6.2)
 *
 * @see design/gdd/map-system.md §2.1
 */

import type { TileCoord, Tile } from './types';
import { distance, coordsToKey, getNeighbors } from './coordinates';

// ============================================================
// 类型
// ============================================================

/** A* 节点 */
interface PathNode {
  coord: TileCoord;
  g: number;  // 从起点到当前节点的实际成本
  h: number;  // 启发式估计: 从当前节点到目标的成本
  f: number;  // g + h
  parent: PathNode | null;
  closed: boolean;
}

/** 寻路选项 */
export interface PathfinderOptions {
  /** 是否允许对角线移动（默认 true） */
  allowDiagonals?: boolean;
  /** 对角线移动的成本系数（默认 √2 ≈ 1.414） */
  diagonalCostMultiplier?: number;
  /** 是否将阻挡物视为不可通过 */
  respectBlockers?: boolean;
}

const DEFAULT_OPTIONS: Required<PathfinderOptions> = {
  allowDiagonals: true,
  diagonalCostMultiplier: Math.SQRT2,
  respectBlockers: true,
};

// ============================================================
// 二叉堆（最小堆）— FIX: PERF-1
// ============================================================

/**
 * f 值最小的 PathNode 优先弹出。
 * push: O(log n), pop: O(log n)，替代原 Map.entries() 线性遍历 (O(n))。
 */
class MinHeap {
  private heap: { key: string; node: PathNode }[] = [];

  get size(): number { return this.heap.length; }

  push(key: string, node: PathNode): void {
    this.heap.push({ key, node });
    this.siftUp(this.heap.length - 1);
  }

  pop(): { key: string; node: PathNode } | null {
    if (this.heap.length === 0) return null;
    const top = this.heap[0]!;
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  /** 更新节点后重新平衡堆（仅在找到更优路径时调用） */
  update(): void {
    // 重建堆（更新频率低，简单重建即可）
    this.heap.sort((a, b) => a.node.f - b.node.f);
  }

  private siftUp(idx: number): void {
    while (idx > 0) {
      const parent = (idx - 1) >>> 1;
      if (this.heap[parent]!.node.f <= this.heap[idx]!.node.f) break;
      [this.heap[parent], this.heap[idx]] = [this.heap[idx]!, this.heap[parent]!];
      idx = parent;
    }
  }

  private siftDown(idx: number): void {
    const len = this.heap.length;
    while (true) {
      let smallest = idx;
      const left = (idx << 1) + 1;
      const right = left + 1;
      if (left < len && this.heap[left]!.node.f < this.heap[smallest]!.node.f) smallest = left;
      if (right < len && this.heap[right]!.node.f < this.heap[smallest]!.node.f) smallest = right;
      if (smallest === idx) break;
      [this.heap[idx], this.heap[smallest]] = [this.heap[smallest]!, this.heap[idx]!];
      idx = smallest;
    }
  }
}

// ============================================================
// 辅助：判断对角线
// ============================================================

/**
 * 判断邻居移动是否为对角线。
 * FIX: BUG-6 — 不再依赖硬编码索引，改为基于坐标变化判断。
 */
function isDiagonalMove(from: TileCoord, to: TileCoord): boolean {
  return from.col !== to.col && from.row !== to.row;
}

// ============================================================
// A* 实现
// ============================================================

/**
 * 在等距网格上执行 A* 寻路
 *
 * @param from - 起始坐标
 * @param to - 目标坐标
 * @param tiles - 图块映射表 (key = "col,row")
 * @param options - 寻路选项
 * @returns 路径坐标数组（不含起点，含终点），若无路径返回 null
 */
export function findPath(
  from: TileCoord,
  to: TileCoord,
  tiles: Map<string, Tile>,
  options: PathfinderOptions = {}
): TileCoord[] | null {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 起点 = 终点
  const fromKey = coordsToKey(from);
  const toKey = coordsToKey(to);
  if (fromKey === toKey) return [];

  // 目标图块不可行走
  const targetTile = tiles.get(toKey);
  if (targetTile && !targetTile.isWalkable && opts.respectBlockers) {
    return null;
  }

  // ── 初始化 ──
  // FIX: PERF-1 — 使用二叉堆替代 Map.entries() 线性搜索
  const openHeap = new MinHeap();
  const openMap = new Map<string, PathNode>();
  const closedMap = new Map<string, PathNode>();

  const startNode: PathNode = {
    coord: from,
    g: 0,
    h: distance(from, to),
    f: distance(from, to),
    parent: null,
    closed: false,
  };
  openMap.set(fromKey, startNode);
  openHeap.push(fromKey, startNode);

  // ── 寻路循环 ──
  let iterations = 0;
  const MAX_ITERATIONS = 10000; // 安全阀

  while (openHeap.size > 0 && iterations < MAX_ITERATIONS) {
    iterations++;

    // 从堆中取 f 值最小的节点
    const topEntry = openHeap.pop();
    if (!topEntry) break;
    const { key: currentKey, node: current } = topEntry;

    // 如果该节点在 openMap 中已被移除（update 后残留），跳过
    if (!openMap.has(currentKey)) continue;
    if (current.closed) continue;

    // 到达目标
    if (currentKey === toKey) {
      return reconstructPath(current);
    }

    // 移入 closed
    openMap.delete(currentKey);
    current.closed = true;
    closedMap.set(currentKey, current);

    // 检查邻居
    const neighbors = getNeighbors(current.coord);
    for (let i = 0; i < neighbors.length; i++) {
      const neighbor = neighbors[i]!;
      const nKey = coordsToKey(neighbor);

      // 已关闭
      if (closedMap.has(nKey)) continue;

      // 检查图块
      const tile = tiles.get(nKey);

      // 不可行走
      if (tile && !tile.isWalkable && opts.respectBlockers) continue;

      // 对角线移动检查
      // FIX: BUG-6 — 使用坐标差判断对角线，不再依赖硬编码索引
      const isDiagonal = isDiagonalMove(current.coord, neighbor);
      if (isDiagonal && !opts.allowDiagonals) continue;

      // 对角线角落裁剪: 防止穿过两个相邻障碍物
      if (isDiagonal && opts.respectBlockers) {
        const dirCol = neighbor.col - current.coord.col;
        const dirRow = neighbor.row - current.coord.row;
        const adjKey1 = coordsToKey({ col: current.coord.col + dirCol, row: current.coord.row });
        const adjKey2 = coordsToKey({ col: current.coord.col, row: current.coord.row + dirRow });
        const adjTile1 = tiles.get(adjKey1);
        const adjTile2 = tiles.get(adjKey2);
        if (adjTile1 && !adjTile1.isWalkable && adjTile2 && !adjTile2.isWalkable) {
          continue;
        }
      }

      // 移动成本
      const baseCost = tile ? tile.moveCost : 1.0;
      const moveCost = isDiagonal
        ? baseCost * opts.diagonalCostMultiplier
        : baseCost;

      const tentativeG = current.g + moveCost;

      const existing = openMap.get(nKey);
      if (existing) {
        if (tentativeG < existing.g) {
          existing.g = tentativeG;
          existing.f = tentativeG + existing.h;
          existing.parent = current;
          openHeap.update();
        }
      } else {
        const h = isDiagonal
          ? distance(neighbor, to) * opts.diagonalCostMultiplier
          : distance(neighbor, to);
        const newNode: PathNode = {
          coord: neighbor,
          g: tentativeG,
          h,
          f: tentativeG + h,
          parent: current,
          closed: false,
        };
        openMap.set(nKey, newNode);
        openHeap.push(nKey, newNode);
      }
    }
  }

  // 无路径
  return null;
}

// ============================================================
// 路径重建
// ============================================================

/**
 * 从目标节点反向追踪路径
 * 返回的数组不包含起点，包含终点
 */
function reconstructPath(node: PathNode): TileCoord[] {
  const path: TileCoord[] = [];
  let current: PathNode | null = node;

  while (current) {
    path.unshift(current.coord);
    current = current.parent;
  }

  // 移除起点
  path.shift();
  return path;
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 判断两点之间是否存在可达路径（快速可达性检查）
 */
export function isReachable(
  from: TileCoord,
  to: TileCoord,
  tiles: Map<string, Tile>,
  maxRange?: number
): boolean {
  if (maxRange !== undefined && distance(from, to) > maxRange) {
    return false;
  }
  const toTile = tiles.get(coordsToKey(to));
  if (toTile && !toTile.isWalkable) return false;
  return true;
}

/**
 * 获取可达图块列表（在指定范围内）
 */
export function getReachableTiles(
  from: TileCoord,
  tiles: Map<string, Tile>,
  range: number,
  options?: PathfinderOptions
): TileCoord[] {
  const reachable: TileCoord[] = [];
  for (const [key, tile] of tiles) {
    if (!tile.isWalkable) continue;
    const coord = tile.coord;
    if (distance(from, coord) > range) continue;
    const path = findPath(from, coord, tiles, options);
    if (path !== null) {
      reachable.push(coord);
    }
    void key;
  }
  return reachable;
}
