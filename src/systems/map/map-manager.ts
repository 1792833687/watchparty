/**
 * @file MapManager — Epic 4.5
 * @description
 * 地图系统主管理器。协调坐标系统、寻路、战争迷雾、区域加载和事件触发。
 *
 * 职责:
 *   - 加载/卸载区域
 *   - moveTo() 驱动寻路 + 迷雾揭示 + 事件触发
 *   - 图块/实体查询
 *   - 缩放与视图控制
 *
 * @see design/gdd/map-system.md §4.1 IMapSystem
 */

import type {
  TileCoord, Tile, Region, MapEntity, MapState,
  MoveResult, MapConfig, FogState, TileEvent, RegionState,
  EntityDisposition,
} from './types';
import { DEFAULT_MAP_CONFIG } from './types';
import { coordsToKey, distance, isInBounds } from './coordinates';
import { findPath } from './pathfinder';
import { FogManager } from './fog-manager';

// ============================================================
// MapManager
// ============================================================

export interface TileEventCallback {
  (event: TileEvent, tile: Tile): void;
}

export class MapManager {
  // ── 配置 ──
  private config: MapConfig;

  // ── 世界数据 ──
  private regions: Map<string, Region> = new Map();
  private currentRegionId: string = '';
  private tileIndex: Map<string, Tile> = new Map();
  private entityIndex: Map<string, MapEntity> = new Map();

  // ── 玩家 ──
  private playerCoord: TileCoord = { col: 0, row: 0 };
  private isMovingFlag: boolean = false;
  private currentPath: TileCoord[] = [];
  private moveAbortController: AbortController | null = null;

  // ── 战争迷雾 ──
  private fogManager: FogManager;

  // ── 事件监听 ──
  private tileEventHandlers: Set<TileEventCallback> = new Set();

  // ── 缩放 ──
  private zoomLevel: number;
  private cameraOffset: { x: number; y: number } = { x: 0, y: 0 };

  constructor(config?: Partial<MapConfig>) {
    this.config = { ...DEFAULT_MAP_CONFIG, ...config };
    this.zoomLevel = this.config.defaultZoom;
    this.fogManager = new FogManager(this.tileIndex, this.config.defaultViewRadius);
  }

  // ============================================================
  // 生命周期
  // ============================================================

  /** 加载世界数据 */
  loadWorld(regions: Region[]): void {
    this.regions.clear();
    this.tileIndex.clear();
    this.entityIndex.clear();

    for (const region of regions) {
      this.regions.set(region.id, region);
      for (const [, tile] of region.tiles) {
        this.tileIndex.set(coordsToKey(tile.coord), tile);
      }
      for (const [, entity] of region.entities) {
        this.entityIndex.set(entity.id, entity);
      }
    }
  }

  /** 加载存档状态 */
  loadState(state: MapState): void {
    this.playerCoord = { ...state.playerCoord };
    this.currentRegionId = state.currentRegionId;

    // 恢复迷雾状态
    this.fogManager.reset();
    this.fogManager.loadFogStates(state.tileStates);

    // 恢复实体状态
    for (const [entityId, entityState] of Object.entries(state.entityStates)) {
      const entity = this.entityIndex.get(entityId);
      if (entity) {
        entity.coord = { ...entityState.coord };
        entity.isActive = entityState.isActive;
        entity.currentHp = entityState.currentHp;
        entity.disposition = entityState.disposition;
      }
    }
  }

  /** 导出当前状态 */
  exportState(): MapState {
    return {
      playerCoord: { ...this.playerCoord },
      currentRegionId: this.currentRegionId,
      tileStates: this.fogManager.exportFogStates(),
      entityStates: this.exportEntityStates(),
      regionStates: this.exportRegionStates(),
    };
  }

  // ============================================================
  // 玩家移动
  // ============================================================

  /**
   * 请求移动到目标图块
   *
   * 流程: 验证可达 → A* 寻路 → 路径预览 → 逐格移动 → 触发事件 → 揭示迷雾
   */
  async moveTo(coord: TileCoord): Promise<MoveResult> {
    // 取消当前移动
    this.cancelMovement();

    const from = { ...this.playerCoord };

    // 验证可达性
    const targetTile = this.tileIndex.get(coordsToKey(coord));
    if (targetTile && !targetTile.isWalkable) {
      return {
        success: false,
        path: [],
        eventsTriggered: [],
        destinationReached: false,
        blockedReason: 'Target tile is not walkable',
      };
    }

    // A* 寻路
    const path = findPath(from, coord, this.tileIndex);
    if (!path) {
      return {
        success: false,
        path: [],
        eventsTriggered: [],
        destinationReached: false,
        blockedReason: 'No path found',
      };
    }

    // 空路径（起点=终点）
    if (path.length === 0) {
      return {
        success: true,
        path: [],
        destinationCoord: { ...coord },
        tilesEntered: [],
        eventsTriggered: [],
        destinationReached: true,
      };
    }

    this.isMovingFlag = true;
    this.currentPath = path;
    this.moveAbortController = new AbortController();

    const tilesEntered: TileCoord[] = [];
    const eventsTriggered: TileEvent[] = [];
    let aborted = false;

    for (const stepCoord of path) {
      if (this.moveAbortController.signal.aborted) {
        aborted = true;
        break;
      }

      // 更新玩家位置
      this.playerCoord = { ...stepCoord };
      tilesEntered.push({ ...stepCoord });

      // 揭示迷雾
      this.fogManager.revealFog(stepCoord);

      // 触发图块事件
      const stepTile = this.tileIndex.get(coordsToKey(stepCoord));
      if (stepTile) {
        for (const event of stepTile.events) {
          if (event.trigger === 'on_every_enter' || 
              (event.trigger === 'on_enter' && !event.hasFired)) {
            eventsTriggered.push(event);
            event.hasFired = true;
            // 通知监听器
            for (const handler of this.tileEventHandlers) {
              handler(event, stepTile);
            }
          }
        }
        // 标记图块为已发现
        stepTile.isDiscovered = true;
      }

      // 模拟移动延迟
      if (path.length > 1) {
        await this.delay(this.config.moveSpeedMs);
      }
    }

    this.isMovingFlag = false;
    this.currentPath = [];
    this.moveAbortController = null;

    return {
      success: true,
      path,
      destinationCoord: { ...coord },
      tilesEntered,
      eventsTriggered,
      destinationReached: !aborted,
    };
  }

  /** 中断当前移动 */
  cancelMovement(): void {
    if (this.moveAbortController) {
      this.moveAbortController.abort();
      this.moveAbortController = null;
    }
    this.isMovingFlag = false;
    this.currentPath = [];
  }

  /** 获取玩家当前位置 */
  getPlayerCoord(): TileCoord {
    return { ...this.playerCoord };
  }

  /** 是否正在移动 */
  isMoving(): boolean {
    return this.isMovingFlag;
  }

  /** 获取当前移动路径 */
  getCurrentPath(): TileCoord[] {
    return [...this.currentPath];
  }

  /** 设置玩家位置（传送） */
  setPlayerCoord(coord: TileCoord): void {
    this.cancelMovement();
    this.playerCoord = { ...coord };
    this.fogManager.revealFog(coord);
  }

  // ============================================================
  // 图块查询
  // ============================================================

  /** 获取指定坐标的图块 */
  getTile(coord: TileCoord): Tile | undefined {
    return this.tileIndex.get(coordsToKey(coord));
  }

  /** 获取指定区域的所有图块 */
  getRegionTiles(regionId: string): Tile[] {
    const region = this.regions.get(regionId);
    if (!region) return [];
    return Array.from(region.tiles.values());
  }

  /** 获取指定图块的邻近可到达图块 */
  getReachableTiles(from: TileCoord, range: number): TileCoord[] {
    const reachable: TileCoord[] = [];
    for (const [, tile] of this.tileIndex) {
      if (!tile.isWalkable) continue;
      if (distance(from, tile.coord) > range) continue;
      if (!this.isExplored(tile.coord) && !this.isVisible(tile.coord)) continue;
      reachable.push(tile.coord);
    }
    return reachable;
  }

  // ============================================================
  // 区域
  // ============================================================

  /** 切换到指定区域 */
  switchRegion(regionId: string, entryCoord?: TileCoord): Region | null {
    const region = this.regions.get(regionId);
    if (!region) return null;

    this.currentRegionId = regionId;

    // 更新 tile 索引
    this.tileIndex.clear();
    for (const [, tile] of region.tiles) {
      this.tileIndex.set(coordsToKey(tile.coord), tile);
    }

    // 更新实体索引
    this.entityIndex.clear();
    for (const [, entity] of region.entities) {
      this.entityIndex.set(entity.id, entity);
    }

    // 设置玩家入口位置
    if (entryCoord) {
      this.playerCoord = { ...entryCoord };
    }

    // 更新迷雾管理的 tile 引用
    this.fogManager.setTiles(this.tileIndex);
    this.fogManager.revealFog(this.playerCoord);

    // 更新区域访问状态
    return region;
  }

  /** 获取当前区域 */
  getCurrentRegion(): Region | undefined {
    return this.regions.get(this.currentRegionId);
  }

  /** 获取已解锁的区域列表 */
  getUnlockedRegions(): Region[] {
    return Array.from(this.regions.values());
  }

  /** 检查区域是否已加载 */
  isRegionLoaded(regionId: string): boolean {
    return this.regions.has(regionId) && this.currentRegionId === regionId;
  }

  // ============================================================
  // 实体
  // ============================================================

  /** 获取指定图块上的实体 */
  getEntitiesAt(coord: TileCoord): MapEntity[] {
    const tile = this.tileIndex.get(coordsToKey(coord));
    if (!tile) return [];
    return tile.entityIds
      .map((id) => this.entityIndex.get(id))
      .filter((e): e is MapEntity => e !== undefined);
  }

  /** 获取邻近实体 */
  getNearbyEntities(coord: TileCoord, radius: number): MapEntity[] {
    const result: MapEntity[] = [];
    for (const [, entity] of this.entityIndex) {
      if (!entity.isActive) continue;
      if (distance(coord, entity.coord) <= radius) {
        result.push(entity);
      }
    }
    return result;
  }

  /** 移动实体到新坐标 */
  moveEntity(entityId: string, to: TileCoord): void {
    const entity = this.entityIndex.get(entityId);
    if (!entity) return;

    // 从旧位置移除
    const oldTile = this.tileIndex.get(coordsToKey(entity.coord));
    if (oldTile) {
      oldTile.entityIds = oldTile.entityIds.filter((id) => id !== entityId);
    }

    // 更新位置
    entity.coord = { ...to };

    // 添加到新位置
    const newTile = this.tileIndex.get(coordsToKey(to));
    if (newTile) {
      newTile.entityIds.push(entityId);
    }
  }

  // ============================================================
  // 战争迷雾 (委托给 FogManager)
  // ============================================================

  revealFog(coord: TileCoord, radius?: number): void {
    this.fogManager.revealFog(coord, radius);
  }

  getFogState(coord: TileCoord): FogState {
    return this.fogManager.getFogState(coord);
  }

  isVisible(coord: TileCoord): boolean {
    return this.fogManager.isVisible(coord);
  }

  isExplored(coord: TileCoord): boolean {
    return this.fogManager.isExplored(coord);
  }

  getVisibleCoords(): TileCoord[] {
    return this.fogManager.getVisibleCoords();
  }

  // ============================================================
  // 事件
  // ============================================================

  /** 注册图块事件监听 */
  onTileEvent(handler: TileEventCallback): void {
    this.tileEventHandlers.add(handler);
  }

  /** 移除事件监听 */
  offTileEvent(handler: TileEventCallback): void {
    this.tileEventHandlers.delete(handler);
  }

  // ============================================================
  // 视图
  // ============================================================

  setZoom(level: number): void {
    this.zoomLevel = Math.max(
      this.config.minZoom,
      Math.min(this.config.maxZoom, level)
    );
  }

  getZoom(): number {
    return this.zoomLevel;
  }

  /** 将地图视图居中到指定坐标 */
  centerOn(coord: TileCoord): void {
    this.cameraOffset = { x: coord.col, y: coord.row };
  }

  getCameraOffset(): { x: number; y: number } {
    return { ...this.cameraOffset };
  }

  // ============================================================
  // 私有辅助
  // ============================================================

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private exportEntityStates(): Record<string, {
    coord: TileCoord;
    isActive: boolean;
    currentHp?: number;
    disposition?: EntityDisposition;
  }> {
    const result: Record<string, {
      coord: TileCoord;
      isActive: boolean;
      currentHp?: number;
      disposition?: EntityDisposition;
    }> = {};
    for (const [id, entity] of this.entityIndex) {
      result[id] = {
        coord: { ...entity.coord },
        isActive: entity.isActive ?? true,
        currentHp: entity.currentHp,
        disposition: entity.disposition,
      };
    }
    return result;
  }

  private exportRegionStates(): Record<string, RegionState> {
    const result: Record<string, RegionState> = {};
    for (const [id] of this.regions) {
      result[id] = {
        isUnlocked: true,
        visitCount: id === this.currentRegionId ? 1 : 0,
      };
    }
    return result;
  }
}
