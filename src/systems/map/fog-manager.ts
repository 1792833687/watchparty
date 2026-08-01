/**
 * @file 战争迷雾管理器 — Epic 4.4
 * @description
 * 三层战争迷雾（Unexplored → Explored → Visible）管理。
 * 基于 Bresenham 视线算法 + 阻挡物检测。
 *
 * 视野计算流程:
 *   1. 获取以玩家为中心、视野半径内的所有坐标
 *   2. 对每个坐标用 Bresenham 画线 → 如果有阻挡物在线上，该坐标及后方不可见
 *   3. 可见坐标设为 VISIBLE，曾经可见但现在不在视野内的设为 EXPLORED
 *
 * @see design/gdd/map-system.md §2.2
 * @see docs/architecture/adr/002-map-rendering.md
 */

import type { TileCoord, FogState, Tile } from './types';
import { distance, coordsToKey, lineCoords, getCoordsInRange, getRingCoords } from './coordinates';

// ============================================================
// FogManager
// ============================================================

export interface FogRevealResult {
  /** 新揭示为 visible 的坐标 */
  newlyVisible: TileCoord[];
  /** 从 visible 退回 explored 的坐标 */
  newlyExplored: TileCoord[];
  /** 当前 visible 状态的快照 */
  visibleCoords: TileCoord[];
}

export class FogManager {
  /** 当前迷雾状态: key = "col,row" → FogState */
  private fogStates: Map<string, FogState> = new Map();

  /** 当前可见坐标集合 */
  private visibleSet: Set<string> = new Set();

  /** 已探索坐标集合 */
  private exploredSet: Set<string> = new Set();

  /** 默认视野半径 */
  private viewRadius: number;

  /** 图块映射引用（用于阻挡物检测） */
  private tiles: Map<string, Tile>;

  constructor(tiles: Map<string, Tile> = new Map(), viewRadius: number = 6) {
    this.tiles = tiles;
    this.viewRadius = viewRadius;
  }

  // ============================================================
  // 公共 API
  // ============================================================

  /**
   * 揭示指定坐标周围的战争迷雾
   *
   * @param coord - 中心坐标（通常是玩家位置）
   * @param radius - 视野半径（默认使用构造时的 viewRadius）
   * @returns 揭示结果（新可见和新探索的坐标）
   */
  revealFog(coord: TileCoord, radius?: number): FogRevealResult {
    const r = radius ?? this.viewRadius;
    const newlyVisible: TileCoord[] = [];
    const newlyExplored: TileCoord[] = [];

    // 之前可见的坐标集合
    const prevVisibleSet = new Set(this.visibleSet);

    // 清空当前可见集（将重新计算）
    this.visibleSet.clear();

    // 获取视野范围内的所有坐标
    const candidates = getCoordsInRange(coord, r);

    for (const candidate of candidates) {
      if (distance(coord, candidate) > r) continue;

      // 视线检测
      const hasLineOfSight = this.hasLineOfSight(coord, candidate);

      if (hasLineOfSight) {
        // 可见
        const key = coordsToKey(candidate);
        this.fogStates.set(key, 'visible');
        this.visibleSet.add(key);
        this.exploredSet.add(key);

        if (!prevVisibleSet.has(key)) {
          newlyVisible.push(candidate);
        }
      }
    }

    // 之前可见但现在不在视野内的 → 变为 explored
    for (const prevKey of prevVisibleSet) {
      if (!this.visibleSet.has(prevKey)) {
        this.fogStates.set(prevKey, 'explored');
        const [col, row] = prevKey.split(',').map(Number);
        newlyExplored.push({ col: col!, row: row! });
      }
    }

    return {
      newlyVisible,
      newlyExplored,
      visibleCoords: this.getVisibleCoords(),
    };
  }

  /**
   * 获取指定坐标的迷雾状态
   */
  getFogState(coord: TileCoord): FogState {
    const key = coordsToKey(coord);
    return this.fogStates.get(key) ?? 'unexplored';
  }

  /**
   * 获取所有可见坐标
   */
  getVisibleCoords(): TileCoord[] {
    return Array.from(this.visibleSet).map((key) => {
      const [col, row] = key.split(',').map(Number);
      return { col: col!, row: row! };
    });
  }

  /**
   * 获取所有已探索坐标
   */
  getExploredCoords(): TileCoord[] {
    return Array.from(this.exploredSet).map((key) => {
      const [col, row] = key.split(',').map(Number);
      return { col: col!, row: row! };
    });
  }

  /**
   * 检查指定坐标当前是否可见
   */
  isVisible(coord: TileCoord): boolean {
    return this.visibleSet.has(coordsToKey(coord));
  }

  /**
   * 检查指定坐标是否已被探索过
   */
  isExplored(coord: TileCoord): boolean {
    return this.exploredSet.has(coordsToKey(coord));
  }

  /**
   * 批量设置迷雾状态（用于加载存档）
   */
  loadFogStates(states: Record<string, { fogState: FogState }>): void {
    for (const [key, state] of Object.entries(states)) {
      this.fogStates.set(key, state.fogState);
      if (state.fogState === 'visible') {
        this.visibleSet.add(key);
        this.exploredSet.add(key);
      } else if (state.fogState === 'explored') {
        this.exploredSet.add(key);
      }
    }
  }

  /**
   * 导出当前迷雾状态（用于存档）
   */
  exportFogStates(): Record<string, { fogState: FogState; isDiscovered: boolean }> {
    const result: Record<string, { fogState: FogState; isDiscovered: boolean }> = {};
    for (const [key, state] of this.fogStates) {
      result[key] = {
        fogState: state,
        isDiscovered: this.exploredSet.has(key),
      };
    }
    return result;
  }

  /**
   * 更新图块引用
   */
  setTiles(tiles: Map<string, Tile>): void {
    this.tiles = tiles;
  }

  /**
   * 设置视野半径
   */
  setViewRadius(radius: number): void {
    this.viewRadius = Math.max(1, radius);
  }

  /**
   * 重置所有迷雾状态
   */
  reset(): void {
    this.fogStates.clear();
    this.visibleSet.clear();
    this.exploredSet.clear();
  }

  // ============================================================
  // 视线算法
  // ============================================================

  /**
   * 使用 Bresenham 直线算法判断从 origin 到 target 是否有视线
   *
   * 视线被阻挡的条件:
   * - 线上存在 isWalkable=false 的图块（墙壁、密林等）
   * - 阻挡物会阻断其后的所有图块
   */
  private hasLineOfSight(origin: TileCoord, target: TileCoord): boolean {
    const line = lineCoords(origin, target);

    // 起点和终点总是可见的
    if (line.length <= 2) return true;

    // 从第二个点开始检查（跳过起点），到倒数第二个点（跳过终点）
    for (let i = 1; i < line.length - 1; i++) {
      const coord = line[i]!;
      const key = coordsToKey(coord);
      const tile = this.tiles.get(key);

      // 如果有不可行走的图块 → 阻挡视线
      if (tile && !tile.isWalkable) {
        return false;
      }
    }

    return true;
  }
}
