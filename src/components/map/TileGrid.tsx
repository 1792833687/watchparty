/**
 * @file TileGrid — 等距菱形图块网格组件 — Epic 4.6
 * @description
 * CSS clip-path 菱形图块 + SVG 路径线叠加。
 * 五图层 DOM 结构 (ADR-002): 地形 → 装饰 → 实体 → Canvas 叠加 → UI 标签。
 *
 * @see design/gdd/map-system.md §5.2
 * @see docs/architecture/adr/002-map-rendering.md
 * @see design/art-bible.md §7.2
 */

import React, { useCallback, useMemo, type CSSProperties } from 'react';
import type { Tile, TileCoord, MapTheme } from '@/systems/map/types';
import { THEME_PALETTES, type ThemePalette } from '@/systems/map/types';
import { isoToScreen, coordsToKey, distance } from '@/systems/map/coordinates';

// ============================================================
// Props
// ============================================================

export interface TileGridProps {
  /** 要渲染的图块数组 */
  tiles: Tile[];
  /** 玩家当前坐标 */
  playerCoord: TileCoord;
  /** 当前缩放级别 */
  zoomLevel: number;
  /** 可见坐标的 key 集合 */
  visibleCoords: Set<string>;
  /** 已探索坐标的 key 集合 */
  exploredCoords: Set<string>;
  /** 可选：当前选中的坐标 */
  selectedCoord?: TileCoord | null;
  /** 可选：可达坐标集合（用于高亮） */
  reachableCoords?: Set<string>;
  /** 可选：路径坐标数组（用于绘制路径线） */
  pathCoords?: TileCoord[];
  /** 可选：地图主题 */
  theme?: MapTheme;
  /** 图块点击回调 */
  onTileClick?: (coord: TileCoord) => void;
  /** 图块 hover 回调 */
  onTileHover?: (coord: TileCoord | null) => void;
  /** 容器偏移（用于居中） */
  offsetX?: number;
  offsetY?: number;
}

// ============================================================
// 常量
// ============================================================

const TILE_W = 128;
const TILE_H = 64;

// ============================================================
// 组件
// ============================================================

export const TileGrid: React.FC<TileGridProps> = ({
  tiles,
  playerCoord,
  zoomLevel,
  visibleCoords,
  exploredCoords,
  selectedCoord,
  reachableCoords,
  pathCoords,
  theme = 'forest',
  onTileClick,
  onTileHover,
  offsetX = 0,
  offsetY = 0,
}) => {
  const palette = THEME_PALETTES[theme] ?? THEME_PALETTES.forest;

  // 路径坐标键集合（快速查询）
  const pathKeySet = useMemo(() => {
    if (!pathCoords || pathCoords.length === 0) return new Set<string>();
    return new Set(pathCoords.map(coordsToKey));
  }, [pathCoords]);

  // 路径连线的 SVG 定义
  const pathLines = useMemo(() => {
    if (!pathCoords || pathCoords.length < 2) return null;

    const lines: React.ReactNode[] = [];
    for (let i = 1; i < pathCoords.length; i++) {
      const from = pathCoords[i - 1]!;
      const to = pathCoords[i]!;
      const fromScreen = isoToScreen(from);
      const toScreen = isoToScreen(to);
      const isToReachable = reachableCoords?.has(coordsToKey(to));

      lines.push(
        <line
          key={`${coordsToKey(from)}-${coordsToKey(to)}`}
          x1={fromScreen.x + TILE_W / 2}
          y1={fromScreen.y + TILE_H / 2}
          x2={toScreen.x + TILE_W / 2}
          y2={toScreen.y + TILE_H / 2}
          stroke={isToReachable ? 'var(--accent-gold, #C9A94E)' : 'var(--text-muted, #6B6258)'}
          strokeWidth={2}
          strokeDasharray={isToReachable ? '6 3' : '2 3'}
          opacity={0.7}
        />
      );
    }
    return lines;
  }, [pathCoords, reachableCoords]);

  return (
    <div
      className="tile-grid"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        transform: `scale(${zoomLevel})`,
        transformOrigin: 'center center',
        transition: 'transform 0.2s ease-out',
      }}
      role="grid"
      aria-label="等距地图网格"
    >
      {/* ── 路径线 SVG 叠加层 ── */}
      {pathLines && pathLines.length > 0 && (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 15,
            overflow: 'visible',
          }}
        >
          {pathLines}
        </svg>
      )}

      {/* ── 图块 ── */}
      {tiles.map((tile) => {
        const key = coordsToKey(tile.coord);
        const screenPos = isoToScreen(tile.coord);
        const isVisible = visibleCoords.has(key);
        const isExplored = exploredCoords.has(key);
        const isSelected = selectedCoord
          ? selectedCoord.col === tile.coord.col && selectedCoord.row === tile.coord.row
          : false;
        const isPlayer =
          playerCoord.col === tile.coord.col && playerCoord.row === tile.coord.row;
        const isReachable = reachableCoords?.has(key) ?? false;
        const isOnPath = pathKeySet.has(key);
        const showLabels = zoomLevel >= 1.5;
        const showEntities = zoomLevel >= 0.75;

        // 迷雾状态
        const fogClass = !isVisible && !isExplored
          ? 'tile--unexplored'
          : !isVisible && isExplored
            ? 'tile--explored'
            : 'tile--visible';

        // 交互状态
        const interactionClass = [
          isSelected ? 'tile--selected' : '',
          isReachable && !isSelected ? 'tile--reachable' : '',
          isOnPath ? 'tile--on-path' : '',
        ].filter(Boolean).join(' ');

        return (
          <div
            key={key}
            className={`tile ${fogClass} ${interactionClass}`}
            role="gridcell"
            aria-label={`${tile.terrain}: ${tile.name}${isPlayer ? ', 玩家当前位置' : ''}${tile.isWalkable ? ', 可通行' : ', 不可通行'}`}
            aria-selected={isSelected}
            style={{
              position: 'absolute',
              left: screenPos.x + offsetX,
              top: screenPos.y + offsetY,
              width: TILE_W,
              height: TILE_H,
              // 菱形裁剪
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              cursor: tile.isWalkable ? 'pointer' : 'not-allowed',
              transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out, filter 0.3s ease',
              willChange: 'transform, box-shadow',
              zIndex: isSelected || isPlayer ? 10 : 1,
            }}
            onClick={() => tile.isWalkable && onTileClick?.(tile.coord)}
            onMouseEnter={() => onTileHover?.(tile.coord)}
            onMouseLeave={() => onTileHover?.(null)}
          >
            {/* Layer 0: 地形层 */}
            <div
              className="tile__terrain"
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: tile.themeOverrides?.base ?? palette.base,
                backgroundImage: `linear-gradient(135deg, ${tile.themeOverrides?.highlight ?? palette.highlight}22 0%, transparent 50%, ${tile.themeOverrides?.shadow ?? palette.shadow}44 100%)`,
              }}
            />

            {/* Layer 1: 装饰层 (装饰精灵图占位) */}
            {showEntities && tile.decorationId && (
              <div
                className="tile__decoration"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  opacity: 0.7,
                  pointerEvents: 'none',
                }}
              >
                {/* 装饰精灵图占位 — 后续由美术资产替换 */}
                <span style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))' }}>
                  {getDecorationEmoji(tile.decorationId)}
                </span>
              </div>
            )}

            {/* Layer 2: 实体层 (实体精灵图占位) */}
            {showEntities && tile.entityIds.length > 0 && (
              <div
                className="tile__entities"
                style={{
                  position: 'absolute',
                  bottom: '20%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: '4px',
                  pointerEvents: 'none',
                }}
              >
                {tile.entityIds.map((_, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: '18px',
                      filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))',
                    }}
                  >
                    ●
                  </span>
                ))}
              </div>
            )}

            {/* 玩家标记 */}
            {isPlayer && (
              <div
                className="tile__player-marker"
                style={{
                  position: 'absolute',
                  top: '15%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '22px',
                  filter: 'drop-shadow(0 0 4px var(--accent-gold, #C9A94E))',
                  pointerEvents: 'none',
                  zIndex: 5,
                }}
              >
                ★
              </div>
            )}

            {/* Layer 4: UI 标签层 */}
            {showLabels && tile.labels && tile.labels.length > 0 && (
              <div
                className="tile__labels"
                style={{
                  position: 'absolute',
                  bottom: '8%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  pointerEvents: 'none',
                  zIndex: 20,
                }}
              >
                {tile.labels.map((label, i) => (
                  <span
                    key={i}
                    style={{
                      display: 'block',
                      fontSize: '10px',
                      lineHeight: '1.2',
                      color: 'var(--text-secondary, #A09888)',
                      textAlign: 'center',
                      textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}

            {/* 图块名称标签 (>=1.5x) */}
            {showLabels && (
              <div
                className="tile__name"
                style={{
                  position: 'absolute',
                  top: '40%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: 'var(--text-primary, #E8E0D5)',
                  textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                  zIndex: 20,
                }}
              >
                {tile.name}
              </div>
            )}
          </div>
        );
      })}

      {/* ── 内联样式 ── */}
      <style jsx>{`
        .tile:hover {
          transform: scale(1.05);
          z-index: 10 !important;
        }
        .tile--selected {
          box-shadow: 0 0 20px var(--accent-gold, #C9A94E);
          border: 1px solid var(--accent-gold, #C9A94E);
        }
        .tile--reachable {
          box-shadow: 0 0 10px var(--accent-magic-glow, #A39BF0);
          animation: tile-pulse 2s ease-in-out infinite;
        }
        .tile--on-path {
          box-shadow: 0 0 8px var(--accent-gold-dim, #8B7330);
        }
        .tile--unexplored {
          filter: brightness(0.25) saturate(0.1);
        }
        .tile--explored {
          filter: brightness(0.6) saturate(0.4);
        }
        .tile--visible {
          filter: none;
        }

        @keyframes tile-pulse {
          0%, 100% { box-shadow: 0 0 10px var(--accent-magic-glow, #A39BF0); }
          50% { box-shadow: 0 0 20px var(--accent-magic-glow, #A39BF0); }
        }
      `}</style>
    </div>
  );
};

// ============================================================
// 辅助
// ============================================================

/** 装饰精灵图占位映射 */
function getDecorationEmoji(decorationId: string): string {
  const map: Record<string, string> = {
    tree_oak: '🌳',
    tree_pine: '🌲',
    bush: '🪨',
    rock: '🪨',
    stalactite: '⬇️',
    crystal: '💎',
    building_house: '🏠',
    building_tower: '🏰',
    lamp: '🕯️',
    reef: '🪸',
    wreck: '⚓',
    mushroom: '🍄',
    flower: '🌸',
  };
  return map[decorationId] ?? '◆';
}
