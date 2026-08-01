/**
 * v4.2.0 城镇面板 — 凛冬谷五大场所入口
 * 酒馆 / 商店 / 旅馆 / 铁匠铺 / 神殿
 * @module components/game/panels/TownPanel
 */
'use client';

import React from 'react';
import { C } from '@/theme/tokens';
import { TOWN_FACILITIES, type TownFacilityId } from '@/systems/town/town-system';

export interface TownPanelProps {
  onEnterFacility: (facilityId: TownFacilityId) => void;
  /** 当前是否位于凛冬谷（城镇入口可用） */
  inTown: boolean;
  /** 当前地点名称 */
  currentLocationName?: string;
}

const GOLD = C.gold;
const TEXT = C.text;
const DIM = C.textDim;
const MUTED = C.textMuted;
const PANEL = C.bgCard;
const DEEP = C.bgPanel;
const PURPLE = C.magic;

export function TownPanel({ onEnterFacility, inTown, currentLocationName }: TownPanelProps): React.ReactElement {
  return (
    <div style={{
      padding: '1.25rem', color: TEXT, fontFamily: 'system-ui, sans-serif',
      height: '100%', overflowY: 'auto',
    }}>
      <h3 style={{
        textAlign: 'center', fontSize: '1.375rem', fontWeight: 700, color: GOLD,
        marginBottom: '0.25rem', paddingBottom: '0.625rem', borderBottom: '1px solid rgba(201,169,78,0.3)',
      }}>
        🏘️ 凛冬谷城镇
      </h3>
      <p style={{ textAlign: 'center', fontSize: '0.6875rem', color: MUTED, margin: '0 0 1rem' }}>
        要塞外的核心聚居地 · 酒馆、商铺与神庙汇聚之处
      </p>

      {!inTown && (
        <div style={{
          padding: '0.75rem', borderRadius: 8, background: DEEP,
          border: '1px dashed rgba(201,169,78,0.25)', color: DIM,
          fontSize: '0.75rem', textAlign: 'center', marginBottom: '1rem',
        }}>
          🚶 你目前位于「{currentLocationName ?? '未知地点'}」。
          <br />返回凛冬谷后可访问城镇场所。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {TOWN_FACILITIES.map((f) => (
          <div
            key={f.id}
            style={{
              padding: '0.75rem', borderRadius: 10,
              background: PANEL, border: '1px solid rgba(201,169,78,0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <span style={{ fontSize: '1.5rem' }}>{f.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: TEXT }}>
                  {f.name}
                </div>
                <div style={{ fontSize: '0.6875rem', color: DIM, lineHeight: 1.5, marginTop: '0.125rem' }}>
                  {f.desc}
                </div>
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.375rem' }}>
                  {f.actions.map((a) => (
                    <span key={a} style={{
                      fontSize: '0.5625rem', color: PURPLE, border: `1px solid ${PURPLE}44`,
                      borderRadius: 4, padding: '0 5px',
                    }}>
                      {a}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onEnterFacility(f.id)}
                disabled={!inTown}
                style={{
                  flexShrink: 0, padding: '0.375rem 0.75rem', borderRadius: 6,
                  border: `1px solid ${inTown ? GOLD : MUTED}`,
                  background: inTown ? 'rgba(201,169,78,0.15)' : 'transparent',
                  color: inTown ? GOLD : MUTED, fontSize: '0.6875rem', fontWeight: 700,
                  cursor: inTown ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap',
                }}
              >
                进入
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: '1rem', fontSize: '0.625rem', color: MUTED, textAlign: 'center', lineHeight: 1.6,
      }}>
        💡 进入场所后，AI 主持人会描述环境并展开互动；
        <br />酒馆可接委托，旅馆可休息恢复。
      </div>
    </div>
  );
}

export default TownPanel;
