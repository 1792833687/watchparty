'use client';

import React from 'react';
import type { Wallet } from '@/theme/tokens';
import type { GameItem } from './types';
import { REPUTATION_STEPS, getReputationStep } from './types';

export interface CharacterPanelProps {
  name: string;
  className: string;
  attributes: Record<string, number>;
  /** v1.1.0: world-specific attribute labels */
  attrLabels?: Record<string, string>;
  /** v1.1.0: world-specific attribute descriptions */
  attrDescs?: Record<string, string>;
  /** v1.2.0: HP calculation attribute key (default: constitution) */
  hpAttr?: string;
  /** v1.2.0: MP calculation attribute key (default: intelligence) */
  mpAttr?: string;
  /** v2.0.0: hero origin name */
  origin?: string;
  /** v2.0.0: hero background name */
  background?: string;
  /** v2.0.0: faction list */
  factions?: { id: string; name: string; description?: string; reputation?: number }[];
  /** v3.0.0: gold currency */
  gold?: number;
  /** v4.0.0: multi-tier wallet */
  wallet?: Wallet;
  /** v4.1.0: 当前处境描述 */
  currentSituation?: string;
  /** v4.1.0: 伤病状态列表 */
  injuries?: CharacterInjury[];
  /** v4.1.0: 职业机制列表 */
  mechanics?: ClassMechanic[];
  /** v4.1.0: 装备槽位 */
  equipmentSlots?: Record<string, GameItem | null>;
  /** v4.1.0: 卸下装备回调（槽位 → 背包） */
  onUnequip?: (slotId: string) => void;
  /** v4.1.0: 职业名称 */
  profession?: string;
  /** v4.1.0: 堕落值 0-100（world-setting 五·堕落值系统） */
  corruption?: number;
}

/** v4.1.0: 堕落阶段定义（world-setting 5.2） */
export interface CorruptionStage {
  name: string;
  min: number;
  max: number;
  color: string;
  effect: string;
}

export const CORRUPTION_STAGES: CorruptionStage[] = [
  { name: '纯净', min: 0, max: 20, color: '#5A9E6F', effect: '神圣法术+10%，恐惧免疫' },
  { name: '微染', min: 21, max: 40, color: '#C9A94E', effect: '噩梦侵扰，感知检定-1' },
  { name: '侵蚀', min: 41, max: 60, color: '#E8843C', effect: '魅力-2，解锁初级暗影低语' },
  { name: '暗影', min: 61, max: 80, color: '#A864C0', effect: '黑暗法术+20%，神圣法术禁用，解锁高级暗影低语' },
  { name: '堕落', min: 81, max: 99, color: '#C85554', effect: '获得强力能力，行为可能失控' },
  { name: '深渊', min: 100, max: 100, color: '#1A1A2E', effect: '触发「陨落」结局' },
];

/** 根据堕落值获取当前阶段 */
export function getCorruptionStage(corruption: number): CorruptionStage {
  return CORRUPTION_STAGES.find((s) => corruption >= s.min && corruption <= s.max)
    ?? CORRUPTION_STAGES[0]!;
}

/** v4.1.0: 伤病系统 */
export interface CharacterInjury {
  id: string;
  name: string;
  desc: string;
  severity: 'minor' | 'moderate' | 'severe';
  attrPenalty?: Partial<Record<string, number>>;
}

/** v4.1.0: 职业机制 */
export interface ClassMechanic {
  name: string;
  desc: string;
  trigger: string;
  effect: string;
}

const LABELS: Record<string, string> = {
  strength: '力量', agility: '敏捷', intelligence: '智力',
  constitution: '体质', charisma: '魅力',
};

const DESCS: Record<string, string> = {
  strength: '物理攻击和负重', agility: '命中、闪避和速度',
  intelligence: '魔法伤害和学习', constitution: '生命值和抗性',
  charisma: '社交和说服',
};

const MAX_ATTR = 10;

function calcHp(attrs: Record<string, number>, hpAttr: string = 'constitution'): number {
  return 50 + (attrs[hpAttr] ?? 0) * 15;
}

function calcMp(attrs: Record<string, number>, mpAttr: string = 'intelligence'): number {
  return 20 + (attrs[mpAttr] ?? 0) * 10;
}

function calcPercent(current: number, max: number): number {
  return Math.min(100, Math.max(0, (current / max) * 100));
}

export function CharacterPanel({
  name, className, attributes, attrLabels, attrDescs,
  hpAttr = 'constitution', mpAttr = 'intelligence',
  origin, background, factions, gold, wallet,
  currentSituation, injuries, mechanics, equipmentSlots, onUnequip, profession,
  corruption,
}: CharacterPanelProps): React.ReactElement {
  const labels = attrLabels ?? LABELS;
  const descs = attrDescs ?? DESCS;
  const hpMax = calcHp(attributes, hpAttr);
  const mpMax = calcMp(attributes, mpAttr);
  const hpPct = calcPercent(hpMax, hpMax);
  const mpPct = calcPercent(mpMax * 0.6, mpMax);
  const corrStage = getCorruptionStage(corruption ?? 0);

  return (
    <div style={{
      padding: '1.5rem 1.25rem',
      color: '#E8E0D5',
      fontFamily: 'system-ui, sans-serif',
      height: '100%',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: '1.75rem',
        paddingBottom: '1.125rem',
        borderBottom: '1px solid rgba(201,169,78,0.3)',
      }}>
        <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#C9A94E' }}>{name || '冒险者'}</div>
        <div style={{ fontSize: '1.0625rem', color: '#A09888', marginTop: '0.375rem' }}>{className || '冒险者'}</div>
        {/* v2.0.0: Origin & Background */}
        {(origin || background) && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.625rem', flexWrap: 'wrap' }}>
            {origin && (
              <span style={{ fontSize: '0.8125rem', color: '#5B7B9A', background: 'rgba(91,123,154,0.12)', padding: '0.125rem 0.625rem', borderRadius: 12 }}>
                出身：{origin}
              </span>
            )}
            {background && (
              <span style={{ fontSize: '0.8125rem', color: '#A0522D', background: 'rgba(160,82,45,0.12)', padding: '0.125rem 0.625rem', borderRadius: 12 }}>
                过往：{background}
              </span>
            )}
          </div>
        )}
        {typeof gold === 'number' && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.625rem' }}>
            <span style={{
              fontSize: '0.9375rem', fontWeight: 700, color: '#C9A94E',
              background: 'rgba(201,169,78,0.12)', border: '1px solid rgba(201,169,78,0.3)',
              padding: '0.25rem 0.875rem', borderRadius: 12,
            }}>
              🪙 金币 {gold}
            </span>
          </div>
        )}
        {/* v4.1.0: 多层级钱包详情 */}
        {wallet && (
          <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.6875rem', color: '#C9A94E' }}>🪙{wallet.gold}金</span>
            <span style={{ fontSize: '0.6875rem', color: '#B0B8C8' }}>🪙{wallet.silver}银</span>
            <span style={{ fontSize: '0.6875rem', color: '#C8966C' }}>🪙{wallet.copper}铜</span>
            {wallet.shard > 0 && <span style={{ fontSize: '0.6875rem', color: '#A864C0' }}>💎{wallet.shard}</span>}
          </div>
        )}
        {/* v4.1.0: 职业机制 */}
        {mechanics && mechanics.length > 0 && (
          <div style={{ marginTop: '0.625rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {mechanics.map((m, i) => (
              <span key={i} title={m.effect} style={{ fontSize: '0.625rem', color: '#7B6FDF', background: 'rgba(123,111,223,0.12)', padding: '0.125rem 0.5rem', borderRadius: 8, border: '1px solid rgba(123,111,223,0.2)' }}>
                ⚙ {m.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* v4.1.0: 当前处境 */}
      {currentSituation && (
        <div style={{ marginBottom: '1.25rem', padding: '0.75rem', borderRadius: 8, background: 'rgba(201,169,78,0.05)', border: '1px solid rgba(201,169,78,0.15)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#C9A94E', marginBottom: '0.375rem' }}>📍 当前处境</div>
          <div style={{ fontSize: '0.8125rem', color: '#E8E0D5', lineHeight: 1.6 }}>{currentSituation}</div>
        </div>
      )}

      {/* v4.1.0: 堕落值六阶段指示器（world-setting 5.2） */}
      {typeof corruption === 'number' && (
        <div style={{ marginBottom: '1.25rem', padding: '0.75rem', borderRadius: 8, background: 'rgba(229,62,62,0.04)', border: `1px solid ${corrStage.color}44` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#E8E0D5' }}>🌑 堕落值</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: corrStage.color }}>
              {corruption} / 100
            </span>
          </div>
          {/* 进度条 */}
          <div style={{ height: 10, borderRadius: 5, background: '#1E1B18', overflow: 'hidden', position: 'relative' }}>
            <div style={{
              width: `${Math.min(100, corruption)}%`, height: '100%',
              background: `linear-gradient(90deg, #5A9E6F, #C9A94E 35%, #E8843C 55%, #A864C0 75%, #C85554 92%, #1A1A2E 100%)`,
              borderRadius: 5, transition: 'width 0.4s ease',
            }} />
          </div>
          {/* 六阶段分段条 */}
          <div style={{ display: 'flex', marginTop: '0.375rem' }}>
            {CORRUPTION_STAGES.map((s) => {
              const span = s.max - s.min + 1;
              const active = corruption >= s.min && corruption <= s.max;
              const past = corruption > s.max;
              return (
                <div key={s.name} style={{
                  flex: span, textAlign: 'center', fontSize: '0.5rem', lineHeight: '1.4',
                  color: past ? s.color : active ? '#E8E0D5' : '#4A4542',
                  borderBottom: active ? `2px solid ${s.color}` : '2px solid #2A272C',
                  fontWeight: active || past ? 700 : 400,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {s.name}
                </div>
              );
            })}
          </div>
          {/* 当前阶段效果 */}
          <div style={{ marginTop: '0.5rem', fontSize: '0.6875rem', color: corrStage.color, lineHeight: 1.5 }}>
            <span style={{ fontWeight: 700 }}>【{corrStage.name}】</span> {corrStage.effect}
          </div>
        </div>
      )}

      {/* v4.1.0: 伤病系统 */}
      {injuries && injuries.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#E53E3E', marginBottom: '0.5rem' }}>🤕 伤病</div>
          {injuries.map((inj) => {
            const sevColor = inj.severity === 'severe' ? '#E53E3E' : inj.severity === 'moderate' ? '#E67E22' : '#C9A94E';
            return (
              <div key={inj.id} style={{ padding: '0.5rem 0.625rem', marginBottom: '0.375rem', borderRadius: 6, background: 'rgba(229,62,62,0.06)', border: `1px solid ${sevColor}22` }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: sevColor }}>{inj.name}</div>
                <div style={{ fontSize: '0.6875rem', color: '#A09888', marginTop: '0.125rem' }}>{inj.desc}</div>
                {inj.attrPenalty && (
                  <div style={{ fontSize: '0.625rem', color: '#E53E3E', marginTop: '0.25rem' }}>
                    {Object.entries(inj.attrPenalty).map(([k, v]) => `${LABELS[k] ?? k} ${(v ?? 0) > 0 ? '+' : ''}${v ?? 0}`).join('，')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* v4.1.0: 装备槽位 */}
      {equipmentSlots && Object.keys(equipmentSlots).length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#D4A574', marginBottom: '0.5rem' }}>⚔️ 装备</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem' }}>
            {Object.entries(equipmentSlots).map(([slot, item]) => (
              <div key={slot} style={{ padding: '0.375rem 0.5rem', borderRadius: 6, background: item ? 'rgba(201,169,78,0.08)' : 'rgba(42,37,34,0.5)', border: '1px solid rgba(201,169,78,0.1)', fontSize: '0.6875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ color: '#6B6258', marginRight: '0.25rem' }}>{slot}</span>
                  <span style={{ color: item ? '#E8E0D5' : '#4A4542', flex: 1 }}>
                    {item ? `${item.emoji ?? ''} ${item.name}` : '空'}
                  </span>
                  {/* v4.1.0: 卸下按钮 */}
                  {item && onUnequip && (
                    <button
                      type="button"
                      onClick={() => onUnequip(slot)}
                      title={`卸下 ${item.name}`}
                      style={{
                        fontSize: '0.5625rem', padding: '1px 5px', borderRadius: 4,
                        border: '1px solid rgba(201,169,78,0.3)', background: 'transparent',
                        color: '#A09888', cursor: 'pointer', flexShrink: 0,
                      }}
                    >
                      卸下
                    </button>
                  )}
                </div>
                {item?.stats && Object.keys(item.stats).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                    {Object.entries(item.stats).map(([k, v]) => (
                      <span key={k} style={{ fontSize: '0.5625rem', color: '#C9A94E' }}>{k}+{v}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HP / MP Bars */}
      <div style={{ marginBottom: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem', marginBottom: '0.375rem' }}>
            <span style={{ color: '#E8E0D5', fontWeight: 600 }}>❤️ HP</span>
            <span style={{ color: '#A09888' }}>{hpMax} / {hpMax}</span>
          </div>
          <div style={{ height: 12, borderRadius: 6, background: '#1E1B18', overflow: 'hidden' }}>
            <div style={{
              width: `${hpPct}%`, height: '100%',
              background: 'linear-gradient(90deg, #C0392B, #E74C3C)',
              borderRadius: 6, transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem', marginBottom: '0.375rem' }}>
            <span style={{ color: '#E8E0D5', fontWeight: 600 }}>💙 MP</span>
            <span style={{ color: '#A09888' }}>{Math.floor(mpMax * 0.6)} / {mpMax}</span>
          </div>
          <div style={{ height: 12, borderRadius: 6, background: '#1E1B18', overflow: 'hidden' }}>
            <div style={{
              width: `${mpPct}%`, height: '100%',
              background: 'linear-gradient(90deg, #2471A3, #5DADE2)',
              borderRadius: 6, transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      </div>

      {/* Attributes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {Object.entries(attributes).map(([key, value]) => {
          const pct = (value / MAX_ATTR) * 100;
          return (
            <div key={key} style={{
              padding: '0.75rem 0.875rem',
              borderRadius: 10,
              background: '#2A2522',
              border: '1px solid rgba(201,169,78,0.18)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1rem', fontWeight: 600, color: '#E8E0D5' }}>
                  {labels[key] ?? key}
                </span>
                <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#C9A94E' }}>
                  {value}/{MAX_ATTR}
                </span>
              </div>
              <div style={{
                fontSize: '0.8125rem', color: '#A09888', marginBottom: '0.5rem',
              }}>
                {descs[key] ?? ''}
              </div>
              <div style={{ height: 8, borderRadius: 4, background: '#1E1B18', overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`, height: '100%',
                  background: pct >= 70
                    ? 'linear-gradient(90deg, #C9A94E, #E6C84E)'
                    : pct >= 40
                    ? 'linear-gradient(90deg, #8B7E5E, #C9A94E)'
                    : 'linear-gradient(90deg, #5A4E3E, #8B7E5E)',
                  borderRadius: 4, transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* v2.0.0: Factions */}
      {factions && factions.length > 0 && (
        <div style={{ marginTop: '1.5rem', paddingTop: '1.125rem', borderTop: '1px solid rgba(201,169,78,0.2)' }}>
          <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#D4A574', marginBottom: '0.625rem' }}>阵营声望</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {factions.map((f) => {
              const rep = f.reputation ?? 0;
              const step = getReputationStep(rep);
              return (
                <div key={f.id} style={{
                  padding: '0.625rem 0.75rem', borderRadius: 8, background: '#1E1B18',
                  border: '1px solid rgba(201,169,78,0.1)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#D3D9DF' }}>{f.name}</span>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: step.color }}>{step.label}</span>
                  </div>
                  {/* v4.1.0: 五级声望阶梯（world-setting 10.2） */}
                  <div style={{ display: 'flex', gap: '0.1875rem' }}>
                    {REPUTATION_STEPS.map((s) => {
                      const active = step.label === s.label;
                      return (
                        <div key={s.label} style={{
                          flex: 1, height: 6, borderRadius: 3,
                          background: active ? s.color : '#2A272C',
                          border: active ? `1px solid ${s.color}` : '1px solid #2A272C',
                          transition: 'all 0.3s ease',
                        }} title={`${s.label} (${s.min}~${s.max})`} />
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.5625rem', color: '#6B6258' }}>{f.description ?? ''}</span>
                    <span style={{ fontSize: '0.625rem', color: '#A09888' }}>
                      {rep > 0 ? `+${rep}` : rep}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
