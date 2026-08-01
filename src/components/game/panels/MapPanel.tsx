'use client';

import React, { useCallback, useState } from 'react';
import type { GameRegion } from './types';

export interface MapPanelProps {
  currentRegion: string;
  currentLocation: string;
  currentLocationDescription: string;
  regions: GameRegion[];
  unlockedRegions?: string[];
  onTravel?: (regionId: string) => void;
  /** v1.2.0: theme-specific map title */
  mapTitle?: string;
}

/**
 * v4.1.0: DEFAULT_REGIONS 对齐凛冬要塞六大区域（world-setting.md 7.1）。
 * 不再回退到 v2.0.0 时代的沙滩/密林/山洞/营地。
 * 坐标排布：凛冬谷(中心偏下) → 暮色森林(左上) → 阴影山脉(右上) →
 *           荒芜平原(下) → 黑曜石荒原(右下) → 龙脊冰峰(右上外圈)。
 */
const DEFAULT_REGIONS: GameRegion[] = [
  { id: 'winter-glen', name: '凛冬谷', discovered: true, cx: 220, cy: 320, points: '220,240 300,320 220,400 140,320', labelX: 220, labelY: 320, dangerLevel: 'safe', regionDesc: '要塞周边已清理的安全区域。农田、巡逻队和寻求庇护的难民构成这片区域的生活景象。', connections: ['暮色森林', '阴影山脉'] },
  { id: 'twilight-forest', name: '暮色森林', discovered: true, cx: 110, cy: 180, points: '110,100 200,180 110,260 20,180', labelX: 110, labelY: 180, dangerLevel: 'caution', regionDesc: '古老森林，精灵遗迹散布其间。阳光透过枝叶洒下斑驳光影，但深处的阴影似乎永不消散。', connections: ['凛冬谷', '阴影山脉'] },
  { id: 'shadow-mountains', name: '阴影山脉', discovered: false, cx: 300, cy: 110, points: '300,30 390,110 300,190 210,110', labelX: 300, labelY: 110, dangerLevel: 'danger', regionDesc: '曾经的矮人王国疆域，如今半兽人与黑暗生物盘踞。矿道深处仍有未开采的秘银矿脉。', connections: ['凛冬谷', '暮色森林', '荒芜平原'] },
  { id: 'barren-plains', name: '荒芜平原', discovered: false, cx: 330, cy: 330, points: '330,250 420,330 330,410 240,330', labelX: 330, labelY: 330, dangerLevel: 'danger', regionDesc: '古代战场遗址，亡灵与不死生物在夜间游荡。战争遗留的兵器、铠甲和遗物散落各处。', connections: ['阴影山脉', '黑曜石荒原'] },
  { id: 'obsidian-wastes', name: '黑曜石荒原', discovered: false, cx: 440, cy: 250, points: '440,170 530,250 440,330 350,250', labelX: 440, labelY: 250, dangerLevel: 'deadly', regionDesc: '黑暗君主力量的核心渗透区。永不熄灭的火山映红了天空，半兽人要塞隐藏其中。', connections: ['荒芜平原', '龙脊冰峰'] },
  { id: 'dragon-spine', name: '龙脊冰峰', discovered: false, cx: 470, cy: 80, points: '470,0 560,80 470,160 380,80', labelX: 470, labelY: 80, dangerLevel: 'deadly', regionDesc: '极北冰封山脉，远古生物栖息。龙、远古魔法与预言遗迹在此静候。', connections: ['黑曜石荒原'] },
];

function resolveRegions(regions: GameRegion[]): GameRegion[] {
  if (regions.length >= 6) return regions;
  if (regions.length > 0) return [...regions, ...DEFAULT_REGIONS.slice(regions.length)];
  return DEFAULT_REGIONS;
}

export function MapPanel({
  currentRegion,
  currentLocation,
  currentLocationDescription,
  regions,
  unlockedRegions,
  onTravel,
  mapTitle = '— 凛冬要塞 · 疆域 —',
}: MapPanelProps): React.ReactElement {
  const resolvedRegions = resolveRegions(regions);
  const [clickedId, setClickedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const isUnlocked = useCallback(
    (regionId: string): boolean => {
      if (unlockedRegions?.includes(regionId)) return true;
      const region = resolvedRegions.find((r) => r.id === regionId);
      if (region?.discovered) return true;
      return false;
    },
    [unlockedRegions, resolvedRegions]
  );

  const handleRegionClick = useCallback(
    (regionId: string) => {
      if (!isUnlocked(regionId)) return;
      setClickedId(regionId);
      if (onTravel) {
        onTravel(regionId);
      }
      // Reset animation after 300ms
      setTimeout(() => setClickedId(null), 300);
    },
    [isUnlocked, onTravel]
  );

  const isCurrent = (regionId: string): boolean => {
    return currentRegion === regionId || currentLocation === regionId;
  };

  return (
    <div style={{
      padding: '1.5rem 1.25rem',
      color: '#E8E0D5',
      fontFamily: 'system-ui, sans-serif',
      height: '100%',
      overflowY: 'auto',
    }}>
      <h3 style={{
        textAlign: 'center',
        fontSize: '1.5rem',
        fontWeight: 700,
        color: '#C9A94E',
        marginBottom: '1.25rem',
        paddingBottom: '0.875rem',
        borderBottom: '1px solid rgba(201,169,78,0.3)',
      }}>
        🗺️ 地图
      </h3>

      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '1.25rem',
        position: 'relative',
      }}>
        <svg
          viewBox="0 0 560 460"
          width="100%"
          style={{
            maxWidth: 420,
            filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.45))',
          }}
        >
          {/* Path lines connecting regions (derived from each region's connections) */}
          {(() => {
            const seen = new Set<string>();
            const lines: React.ReactElement[] = [];
            resolvedRegions.forEach((a) => {
              const conns = a.connections ?? [];
              conns.forEach((target) => {
                const b = resolvedRegions.find(
                  (r) => r.id === target || r.name === target
                );
                if (!b) return;
                const key = [a.id, b.id].sort().join('~');
                if (seen.has(key)) return;
                seen.add(key);
                const unlockedBoth = isUnlocked(a.id) && isUnlocked(b.id);
                lines.push(
                  <line
                    key={key}
                    x1={a.cx}
                    y1={a.cy}
                    x2={b.cx}
                    y2={b.cy}
                    stroke={unlockedBoth ? 'rgba(201,169,78,0.35)' : 'rgba(201,169,78,0.12)'}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                  />
                );
              });
            });
            return lines;
          })()}

          {resolvedRegions.map((region) => {
            const unlocked = isUnlocked(region.id);
            const current = isCurrent(region.id);
            const isHovered = hoveredId === region.id;
            const isClicked = clickedId === region.id;
            const scale = isClicked ? 1.15 : isHovered ? 1.08 : 1;
            const dangerColor: Record<string, string> = { safe: '#5A9E6F', caution: '#C9A94E', danger: '#E8843C', deadly: '#E53E3E' };
            const dColor = region.dangerLevel ? dangerColor[region.dangerLevel] : undefined;

            return (
              <g
                key={region.id}
                style={{ cursor: unlocked ? 'pointer' : 'default' }}
                onClick={() => handleRegionClick(region.id)}
                onMouseEnter={() => unlocked && setHoveredId(region.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Rotated diamond shape for the region */}
                <g transform={`translate(${region.cx}, ${region.cy}) scale(${scale})`}
                  style={{ transformOrigin: `${region.cx}px ${region.cy}px`, transition: 'transform 0.3s ease' }}>
                  <rect
                    x="-48"
                    y="-36"
                    width="96"
                    height="72"
                    rx="8"
                    ry="8"
                    fill={current ? 'rgba(201,169,78,0.18)' : unlocked ? '#2A3B2A' : '#1A181C'}
                    stroke={current ? '#C9A94E' : dColor ? dColor : unlocked ? 'rgba(201,169,78,0.4)' : '#3A3530'}
                    strokeWidth={current ? '2.5' : dColor ? '2' : unlocked ? '1.5' : '1'}
                    style={{ transition: 'all 0.3s ease' }}
                  />
                  {/* Region name */}
                  <text
                    x="0"
                    y="-8"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={unlocked ? '#E8E0D5' : '#5A5248'}
                    fontSize="13"
                    fontWeight={700}
                    style={{ pointerEvents: 'none' }}
                  >
                    {unlocked ? region.name : '???'}
                  </text>

                  {/* Lock icon for locked regions */}
                  {!unlocked && (
                    <text
                      x="0"
                      y="14"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="18"
                      style={{ pointerEvents: 'none' }}
                    >
                      🔒
                    </text>
                  )}

                  {/* Current position label */}
                  {current && (
                    <text
                      x="0"
                      y={!unlocked ? '26' : '14'}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#C9A94E"
                      fontSize="9"
                      fontWeight={600}
                      style={{ pointerEvents: 'none' }}
                    >
                      当前位置
                    </text>
                  )}

                  {/* Unlocked label */}
                  {unlocked && !current && (
                    <text
                      x="0"
                      y="14"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#5A9E6F"
                      fontSize="9"
                      fontWeight={600}
                      style={{ pointerEvents: 'none' }}
                    >
                      {isHovered ? '点击前往' : '已解锁'}
                    </text>
                  )}

                  {/* Gold pulse ring for current */}
                  {current && (
                    <rect
                      x="-56"
                      y="-44"
                      width="112"
                      height="88"
                      rx="12"
                      ry="12"
                      fill="none"
                      stroke="#C9A94E"
                      strokeWidth="2"
                      opacity="0.5"
                    >
                      <animate
                        attributeName="opacity"
                        values="0.5;0.1;0.5"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </rect>
                  )}
                </g>
              </g>
            );
          })}

          {/* Map title - centered top */}
          <text
            x="280"
            y="24"
            textAnchor="middle"
            fill="#6B6258"
            fontSize="12"
            fontWeight={600}
          >
            {mapTitle}
          </text>
        </svg>
      </div>

      {/* Current location info */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.625rem',
        background: '#2A2522',
        borderRadius: 10,
        border: '1px solid rgba(201,169,78,0.18)',
        padding: '1rem',
      }}>
        <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#C9A94E', marginBottom: '0.375rem' }}>
          当前位置
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          padding: '0.625rem',
          borderRadius: 8,
          background: 'rgba(201,169,78,0.1)',
        }}>
          <span style={{ fontSize: '0.9375rem', color: '#E8E0D5', fontWeight: 600 }}>
            {currentLocation || currentRegion || '未知区域'}
          </span>
        </div>
        <div style={{ fontSize: '0.8125rem', color: '#A09888', lineHeight: 1.6 }}>
          {currentLocationDescription || '尚未探索该区域。'}
        </div>
      </div>

      {/* Unlocked count */}
      <div style={{ marginTop: '1rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#A09888', marginBottom: '0.5rem' }}>
          已解锁区域: {resolvedRegions.filter((r) => isUnlocked(r.id)).length}/{resolvedRegions.length}
        </div>
        {/* v2.0.0: Danger level legend */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          {(['safe', 'caution', 'danger', 'deadly'] as const).map((level) => {
            const colors: Record<string, string> = { safe: '#5A9E6F', caution: '#C9A94E', danger: '#E8843C', deadly: '#E53E3E' };
            const labels: Record<string, string> = { safe: '安全', caution: '警戒', danger: '危险', deadly: '致命' };
            return (
              <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.6875rem', color: colors[level] }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[level], display: 'inline-block' }} />
                {labels[level]}
              </div>
            );
          })}
        </div>
      </div>

      {/* Locked region tooltip */}
      {resolvedRegions.filter((r) => !isUnlocked(r.id)).length > 0 && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.625rem 0.75rem',
          borderRadius: 8,
          background: 'rgba(91,123,154,0.08)',
          border: '1px solid rgba(91,123,154,0.15)',
          fontSize: '0.75rem',
          color: '#5B7B9A',
          textAlign: 'center',
        }}>
          <span style={{ fontWeight: 600 }}>未解锁区域</span>
          <br />
          <span style={{ color: '#7A8FA0' }}>随剧情推进、抵达新地点后将逐步揭示并解锁未知区域</span>
        </div>
      )}
    </div>
  );
}
