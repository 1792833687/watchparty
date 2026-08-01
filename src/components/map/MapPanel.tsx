/**
 * @file MapPanel — 地图面板 — Epic 4.8
 * @description
 * 360px 固定宽度地图面板，集成 TileGrid + ParticleCanvas。
 * 缩放控件、鼠标滚轮缩放、图块标签显示、虚拟化视口渲染。
 * 响应式：Tablet 端可折叠。
 *
 * @see design/gdd/map-system.md §5.3
 * @see design/art-bible.md §5.1
 */

'use client';

import React, {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
  type WheelEvent,
} from 'react';
import type { Tile, TileCoord, MapTheme, FogState } from '@/systems/map/types';
import { DEFAULT_MAP_CONFIG } from '@/systems/map/types';
import { coordsToKey, distance, isoToScreen, getCoordsInRange } from '@/systems/map/coordinates';
import { findPath } from '@/systems/map/pathfinder';
import { TileGrid } from './TileGrid';
import { ParticleCanvas } from './ParticleCanvas';

// ============================================================
// Props
// ============================================================

export interface MapPanelProps {
  /** 要渲染的图块数据 */
  tiles: Tile[];
  /** 玩家当前位置 */
  playerCoord: TileCoord;
  /** 地图主题 */
  theme?: MapTheme;
  /** 初始缩放级别 */
  initialZoom?: number;
  /** 是否折叠（移动端） */
  collapsed?: boolean;
  /** 折叠切换回调 */
  onToggleCollapse?: () => void;
  /** 图块点击回调 */
  onTileClick?: (coord: TileCoord) => void;
  /** 图块事件回调 */
  onTileEvent?: (coord: TileCoord, eventType: string) => void;
  /** 面板宽度 (默认 360) */
  width?: number;
  /** 面板高度 (默认 100%) */
  height?: number | string;
}

// ============================================================
// 常量
// ============================================================

const TILE_W = 128;
const TILE_H = 64;
const MAX_VISIBLE_TILES = 200;

// ============================================================
// 组件
// ============================================================

export const MapPanel: React.FC<MapPanelProps> = ({
  tiles,
  playerCoord,
  theme = 'forest',
  initialZoom = 1.0,
  collapsed = false,
  onToggleCollapse,
  onTileClick,
  onTileEvent,
  width = 360,
  height = '100%',
}) => {
  // ── 状态 ──
  const [zoomLevel, setZoomLevel] = useState(
    Math.max(DEFAULT_MAP_CONFIG.minZoom, Math.min(DEFAULT_MAP_CONFIG.maxZoom, initialZoom))
  );
  const [selectedCoord, setSelectedCoord] = useState<TileCoord | null>(null);
  const [hoveredCoord, setHoveredCoord] = useState<TileCoord | null>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [showParticles, setShowParticles] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: width, h: 600 });

  // ── 图块索引 ──
  const tileMap = useMemo(() => {
    const map = new Map<string, Tile>();
    for (const tile of tiles) {
      map.set(coordsToKey(tile.coord), tile);
    }
    return map;
  }, [tiles]);

  // ── 迷雾计算（简化为基于距离的模拟） ──
  const { visibleCoords, exploredCoords } = useMemo(() => {
    const visible = new Set<string>();
    const explored = new Set<string>();
    const viewRadius = DEFAULT_MAP_CONFIG.defaultViewRadius;
    const inRange = getCoordsInRange(playerCoord, viewRadius);

    for (const coord of inRange) {
      const key = coordsToKey(coord);
      if (distance(playerCoord, coord) <= viewRadius) {
        visible.add(key);
        explored.add(key);
      }
    }

    // 所有已提供的图块标记为已探索（模拟存档中的 explored 状态）
    for (const tile of tiles) {
      const key = coordsToKey(tile.coord);
      if (!explored.has(key) && tile.isDiscovered) {
        explored.add(key);
      }
    }

    return { visibleCoords: visible, exploredCoords: explored };
  }, [tiles, playerCoord]);

  // ── 路径计算 ──
  const [pathCoords, setPathCoords] = useState<TileCoord[]>([]);
  const [reachableKeys, setReachableKeys] = useState<Set<string>>(new Set());

  const handleTileClick = useCallback(
    (coord: TileCoord) => {
      setSelectedCoord(coord);

      // 计算路径
      const path = findPath(playerCoord, coord, tileMap);
      if (path) {
        setPathCoords([playerCoord, ...path]);
      }

      // 计算可达图块
      const reachable = new Set<string>();
      const viewRadius = DEFAULT_MAP_CONFIG.defaultViewRadius;
      for (const tile of tiles) {
        if (!tile.isWalkable) continue;
        if (distance(playerCoord, tile.coord) > viewRadius) continue;
        reachable.add(coordsToKey(tile.coord));
      }
      setReachableKeys(reachable);

      onTileClick?.(coord);
      onTileEvent?.(coord, 'click');
    },
    [playerCoord, tileMap, tiles, onTileClick, onTileEvent]
  );

  // ── 虚拟化: 仅渲染视口内图块 ──
  const visibleTiles = useMemo(() => {
    if (tiles.length <= MAX_VISIBLE_TILES) return tiles;

    // 计算视口范围（等距坐标 → 屏幕坐标反算）
    const halfW = containerSize.w / 2 / zoomLevel;
    const halfH = containerSize.h / 2 / zoomLevel;

    return tiles.filter((tile) => {
      const screen = isoToScreen(tile.coord);
      const sx = screen.x - panOffset.x;
      const sy = screen.y - panOffset.y;
      return (
        sx > -halfW - TILE_W &&
        sx < halfW + TILE_W &&
        sy > -halfH - TILE_H &&
        sy < halfH + TILE_H
      );
    });
  }, [tiles, containerSize, zoomLevel, panOffset]);

  // ── 缩放控制 ──
  const handleZoomIn = useCallback(() => {
    setZoomLevel((z) => Math.min(DEFAULT_MAP_CONFIG.maxZoom, z + 0.25));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((z) => Math.max(DEFAULT_MAP_CONFIG.minZoom, z - 0.25));
  }, []);

  const handleWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoomLevel((z) =>
      Math.max(
        DEFAULT_MAP_CONFIG.minZoom,
        Math.min(DEFAULT_MAP_CONFIG.maxZoom, z + delta)
      )
    );
  }, []);

  // ── 容器尺寸检测 ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ── 低端设备性能降级 ──
  useEffect(() => {
    const cores = navigator.hardwareConcurrency ?? 4;
    if (cores <= 2) {
      setShowParticles(false);
    }
  }, []);

  // ── 计算 TileGrid 居中偏移 ──
  const gridOffset = useMemo(() => {
    // 以玩家位置为中心计算偏移
    const playerScreen = isoToScreen(playerCoord);
    return {
      x: containerSize.w / 2 - playerScreen.x - TILE_W / 2 + panOffset.x,
      y: containerSize.h / 2 - playerScreen.y - TILE_H / 2 + panOffset.y,
    };
  }, [playerCoord, containerSize, panOffset]);

  // ── 渲染 ──
  if (collapsed) {
    return (
      <div className="map-panel map-panel--collapsed" style={{ width: 48, height }}>
        <button
          className="map-panel__expand-btn"
          onClick={onToggleCollapse}
          aria-label="展开地图面板"
          style={{
            width: '100%',
            height: '100%',
            background: 'var(--bg-panel, #1E1B18)',
            border: '1px solid var(--border-subtle, #2E2924)',
            color: 'var(--text-secondary, #A09888)',
            cursor: 'pointer',
            writingMode: 'vertical-rl',
            fontSize: '12px',
            letterSpacing: '2px',
          }}
        >
          🗺️ 地图
        </button>
      </div>
    );
  }

  return (
    <div
      className="map-panel"
      ref={containerRef}
      style={{
        width,
        height,
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--bg-table, #1A1614)',
        borderRight: '1px solid var(--border-subtle, #2E2924)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── 顶栏: 区域名 + 缩放控件 ── */}
      <div
        className="map-panel__header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-subtle, #2E2924)',
          background: 'var(--bg-panel, #1E1B18)',
          zIndex: 30,
        }}
      >
        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-primary, #E8E0D5)',
          }}
        >
          🗺️ 地图 · {(zoomLevel * 100).toFixed(0)}%
        </span>

        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {/* 折叠按钮 (tablet) */}
          {onToggleCollapse && (
            <button
              className="map-panel__collapse-btn"
              onClick={onToggleCollapse}
              aria-label="折叠地图"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted, #6B6258)',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '4px',
              }}
            >
              ◀
            </button>
          )}

          {/* 缩放按钮 */}
          <button
            className="map-panel__zoom-btn"
            onClick={handleZoomOut}
            disabled={zoomLevel <= DEFAULT_MAP_CONFIG.minZoom}
            aria-label="缩小地图"
            style={zoomBtnStyle}
          >
            −
          </button>
          <button
            className="map-panel__zoom-btn"
            onClick={handleZoomIn}
            disabled={zoomLevel >= DEFAULT_MAP_CONFIG.maxZoom}
            aria-label="放大地图"
            style={zoomBtnStyle}
          >
            +
          </button>
        </div>
      </div>

      {/* ── 地图视口 ── */}
      <div
        className="map-panel__viewport"
        onWheel={handleWheel}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          cursor: 'grab',
        }}
      >
        {/* TileGrid */}
        {visibleTiles.length > 0 && (
          <TileGrid
            tiles={visibleTiles}
            playerCoord={playerCoord}
            zoomLevel={zoomLevel}
            visibleCoords={visibleCoords}
            exploredCoords={exploredCoords}
            selectedCoord={selectedCoord}
            reachableCoords={reachableKeys}
            pathCoords={pathCoords}
            theme={theme}
            onTileClick={handleTileClick}
            onTileHover={setHoveredCoord}
            offsetX={gridOffset.x}
            offsetY={gridOffset.y}
          />
        )}

        {/* ParticleCanvas */}
        {showParticles && (
          <ParticleCanvas
            width={containerSize.w}
            height={containerSize.h}
            theme={theme}
            paused={false}
          />
        )}

        {/* 空状态 */}
        {tiles.length === 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted, #6B6258)',
              fontSize: '14px',
            }}
          >
            地图数据为空
          </div>
        )}
      </div>

      {/* ── 底部: 当前选中图块信息 ── */}
      {hoveredCoord && (
        <div
          className="map-panel__tooltip"
          style={{
            padding: '6px 10px',
            borderTop: '1px solid var(--border-subtle, #2E2924)',
            background: 'var(--bg-panel, #1E1B18)',
            fontSize: '12px',
            color: 'var(--text-secondary, #A09888)',
            zIndex: 30,
          }}
        >
          [{hoveredCoord.col}, {hoveredCoord.row}]
          {tileMap.get(coordsToKey(hoveredCoord))?.name && (
            <> — {tileMap.get(coordsToKey(hoveredCoord))!.name}</>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================
// 样式常量
// ============================================================

const zoomBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg-input, #2A2522)',
  border: '1px solid var(--border-subtle, #2E2924)',
  borderRadius: 6,
  color: 'var(--text-primary, #E8E0D5)',
  fontSize: '16px',
  cursor: 'pointer',
  fontWeight: 600,
};
