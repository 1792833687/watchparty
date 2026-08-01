/**
 * v4.1.0 领地经营面板（world-setting 八·领地经营）
 * 6 设施 × 3 级 + 战略桌 4 项目 + 防御值 + 围城战倒计时。
 * @module components/game/panels/TerritoryPanel
 */
'use client';

import React, { useMemo, useState } from 'react';
import { C } from '@/theme/tokens';
import {
  FACILITIES, STRATEGY_PROJECTS,
  RESOURCE_LABELS, RESOURCE_ICONS,
  calcDefense, canAfford, getUpgradeCost, payCost,
  type FacilityId, type TerritoryState,
} from '@/systems/territory/territory-system';

export interface TerritoryPanelProps {
  territory: TerritoryState;
  onUpgrade?: (facilityId: FacilityId) => void;
  onStrategy?: (projectId: string) => void;
  onRest?: () => void;
  dayCount?: number;
}

const GOLD = C.gold;
const TEXT = C.text;
const DIM = C.textDim;
const MUTED = C.textMuted;
const PANEL = C.bgCard;
const DEEP = C.bgPanel;
const DANGER = C.darkAccent;
const OK = C.ok;

export function TerritoryPanel({
  territory, onUpgrade, onStrategy, onRest, dayCount = 1,
}: TerritoryPanelProps): React.ReactElement {
  const [selectedFacility, setSelectedFacility] = useState<FacilityId | null>(null);

  const defense = useMemo(() => calcDefense(territory), [territory]);
  const selected = FACILITIES.find((f) => f.id === selectedFacility) ?? null;
  const selLevel = selected ? (territory.facilities[selected.id] ?? 0) : 0;
  const selCost = selected ? getUpgradeCost(selected, selLevel) : null;
  const selAffordable = selected && selCost ? canAfford(territory.resources, selCost) : false;

  return (
    <div style={{
      padding: '1.25rem', color: TEXT, fontFamily: 'system-ui, sans-serif',
      height: '100%', overflowY: 'auto',
    }}>
      <h3 style={{
        textAlign: 'center', fontSize: '1.5rem', fontWeight: 700, color: GOLD,
        marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(201,169,78,0.3)',
      }}>
        🏰 领地经营
      </h3>

      {/* 资源栏 */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.75rem',
        borderRadius: 10, background: PANEL, border: '1px solid rgba(201,169,78,0.18)', marginBottom: '1rem',
      }}>
        {Object.entries(territory.resources).map(([rid, amount]) => (
          <div key={rid} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: DIM }}>
            <span>{RESOURCE_ICONS[rid as keyof typeof RESOURCE_ICONS] ?? '•'}</span>
            <span>{RESOURCE_LABELS[rid as keyof typeof RESOURCE_LABELS] ?? rid}</span>
            <b style={{ color: GOLD }}>{amount}</b>
          </div>
        ))}
      </div>

      {/* 防御值与围城战 */}
      <div style={{
        display: 'flex', gap: '0.75rem', marginBottom: '1.25rem',
      }}>
        <div style={{
          flex: 1, padding: '0.75rem', borderRadius: 10, background: DEEP,
          border: '1px solid rgba(90,158,111,0.3)', textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.6875rem', color: DIM }}>🛡️ 防御值</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: OK }}>{defense}</div>
        </div>
        <div style={{
          flex: 1, padding: '0.75rem', borderRadius: 10, background: DEEP,
          border: territory.siegeCountdown <= 10 ? '1px solid rgba(229,62,62,0.4)' : '1px solid rgba(201,169,78,0.2)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.6875rem', color: DIM }}>⚔️ 围城战</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: territory.siegeCountdown <= 10 ? DANGER : GOLD }}>
            {territory.siegeCountdown} 天
          </div>
          <div style={{ fontSize: '0.5625rem', color: MUTED }}>已挺过 {territory.siegesSurvived} 次</div>
        </div>
      </div>

      {/* 设施列表 */}
      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#D4A574', marginBottom: '0.5rem' }}>
        🏗️ 设施
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {FACILITIES.map((f) => {
          const level = territory.facilities[f.id] ?? 0;
          const lv = f.levels[level - 1];
          const cost = getUpgradeCost(f, level);
          const affordable = cost ? canAfford(territory.resources, cost) : false;
          const isSel = selectedFacility === f.id;
          return (
            <div
              key={f.id}
              onClick={() => setSelectedFacility(isSel ? null : f.id)}
              style={{
                padding: '0.625rem 0.75rem', borderRadius: 8,
                background: isSel ? 'rgba(201,169,78,0.1)' : PANEL,
                border: `1px solid ${isSel ? 'rgba(201,169,78,0.4)' : 'rgba(201,169,78,0.12)'}`,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>{f.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{f.name}</span>
                    <span style={{ fontSize: '0.5625rem', color: MUTED, border: '1px solid ' + MUTED + '55', borderRadius: 4, padding: '0 4px' }}>
                      等级 {level}/3
                    </span>
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: DIM, marginTop: '0.125rem' }}>
                    {level === 0 ? f.desc : (lv ? `${lv.name}：${lv.desc}` : f.desc)}
                  </div>
                </div>
                {cost && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onUpgrade?.(f.id); }}
                    disabled={!affordable}
                    style={{
                      padding: '0.25rem 0.5rem', borderRadius: 6, flexShrink: 0,
                      border: `1px solid ${affordable ? GOLD : MUTED}`,
                      background: affordable ? GOLD : 'transparent',
                      color: affordable ? DEEP : MUTED,
                      fontSize: '0.625rem', fontWeight: 700, cursor: affordable ? 'pointer' : 'not-allowed',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    升级
                  </button>
                )}
              </div>
              {/* 选中后显示升级费用 */}
              {isSel && cost && (
                <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {Object.entries(cost).map(([rid, amt]) => (
                    <span
                      key={rid}
                      style={{
                        fontSize: '0.625rem',
                        color: (territory.resources[rid as keyof typeof territory.resources] ?? 0) >= (amt ?? 0) ? OK : DANGER,
                        background: DEEP, padding: '0.125rem 0.5rem', borderRadius: 4,
                      }}
                    >
                      {RESOURCE_ICONS[rid as keyof typeof RESOURCE_ICONS]} {RESOURCE_LABELS[rid as keyof typeof RESOURCE_LABELS]} {amt}
                    </span>
                  ))}
                  {level < 3 && (
                    <span style={{ fontSize: '0.625rem', color: MUTED, marginLeft: 'auto' }}>
                      {affordable ? '✓ 可升级' : '✗ 资源不足'}
                    </span>
                  )}
                  {level >= 3 && (
                    <span style={{ fontSize: '0.625rem', color: OK, marginLeft: 'auto' }}>已满级</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 战略桌（主堡 2 级解锁） */}
      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#D4A574', marginBottom: '0.5rem' }}>
        📜 战略桌{(territory.facilities.keep ?? 0) < 2 ? '（主堡 2 级解锁）' : ''}
      </div>
      {(territory.facilities.keep ?? 0) < 2 ? (
        <div style={{
          padding: '0.75rem', borderRadius: 8, background: DEEP,
          border: '1px dashed rgba(201,169,78,0.2)', color: MUTED, fontSize: '0.75rem', textAlign: 'center', marginBottom: '1.25rem',
        }}>
          🔒 将主堡升至 2 级以解锁战略桌
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {STRATEGY_PROJECTS.map((p) => {
            const progress = territory.strategyProjects[p.id] ?? 0;
            const done = progress >= 100;
            const affordable = canAfford(territory.resources, p.cost);
            return (
              <div key={p.id} style={{ padding: '0.625rem 0.75rem', borderRadius: 8, background: PANEL, border: '1px solid rgba(201,169,78,0.12)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1rem' }}>{p.icon}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{p.name}</span>
                    <div style={{ fontSize: '0.625rem', color: DIM, marginTop: '0.125rem' }}>{p.desc}</div>
                  </div>
                  {!done && (
                    <button
                      type="button"
                      onClick={() => onStrategy?.(p.id)}
                      disabled={!affordable}
                      style={{
                        padding: '0.25rem 0.5rem', borderRadius: 6, flexShrink: 0,
                        border: `1px solid ${affordable ? '#7B6FDF' : MUTED}`,
                        background: affordable ? '#7B6FDF' : 'transparent',
                        color: affordable ? '#0A0A0F' : MUTED,
                        fontSize: '0.625rem', fontWeight: 700, cursor: affordable ? 'pointer' : 'not-allowed',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      投入资源 (+25%)
                    </button>
                  )}
                </div>
                {/* 进度条 */}
                <div style={{ height: 6, borderRadius: 3, background: DEEP, marginTop: '0.5rem', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, progress)}%`, height: '100%',
                    background: done ? OK : 'linear-gradient(90deg, #7B6FDF, #A864C0)',
                    borderRadius: 3, transition: 'width 0.3s ease',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  <span style={{ fontSize: '0.5625rem', color: done ? OK : MUTED }}>
                    {done ? '✓ 已完成' : `${Math.floor(progress)}%`}
                  </span>
                  <span style={{ fontSize: '0.5625rem', color: MUTED }}>{p.reward}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 休整 */}
      <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
        <button
          type="button"
          onClick={onRest}
          style={{
            padding: '0.5rem 1.5rem', borderRadius: 8,
            border: '1px solid ' + GOLD + '66', background: 'rgba(201,169,78,0.08)',
            color: GOLD, fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
          }}
        >
          🛌 休整一日（恢复 HP / 推进围城战倒计时）
        </button>
      </div>
    </div>
  );
}

export default TerritoryPanel;
