'use client';

/**
 * v4.2.0 关系链面板
 * - 剧情中遇到的所有人物构成关系链（预设同伴 + 动态角色）
 * - 节点可交互：对话 / 赠送 / 邀约（向 AI 发送指令）
 * - 显示好感度、忠诚度、关系层级、羁绊记忆
 * @module components/game/panels/RelationsPanel
 */

import React, { useMemo, useState } from 'react';
import { C } from '@/theme/tokens';
import type { CompanionRelationship } from './types';
import { RELATION_LABELS, RELATION_COLORS, type ChainNode } from '@/systems/npc/relation-chain';

export interface RelationsPanelProps {
  relationships?: CompanionRelationship[];
  /** v4.2.0: 关系链节点（预设 + 动态） */
  chainNodes?: ChainNode[];
  /** v4.2.0: 交互回调（发送 AI 指令） */
  onInteract?: (node: ChainNode, action: 'talk' | 'gift' | 'invite' | 'recruit') => void;
  /** v4.2.0: 好感度变化回调（赠送/交谈后） */
  onAffinityChange?: (nodeId: string, delta: number) => void;
}

const GOLD = C.gold;
const TEXT = C.text;
const DIM = C.textDim;
const MUTED = C.textMuted;
const PANEL = C.bgCard;
const DEEP = C.bgPanel;
const PURPLE = C.magic;
const OK = C.ok;

function affinityColor(v: number): string {
  if (v >= 60) return OK;
  if (v >= 20) return GOLD;
  if (v <= -40) return '#E53E3E';
  if (v <= -20) return '#E8843C';
  return DIM;
}

export function RelationsPanel({
  relationships = [],
  chainNodes = [],
  onInteract,
  onAffinityChange,
}: RelationsPanelProps): React.ReactElement {
  // 合并：关系链节点优先（含动态角色），补充预设同伴
  const mergedNodes: ChainNode[] = useMemo(() => {
    const nodes = [...chainNodes];
    for (const rel of relationships) {
      if (!nodes.some((n) => n.id === rel.id)) {
        nodes.push({
          id: rel.id,
          name: rel.name,
          codename: rel.codename,
          role: rel.role ?? '未知身份',
          emoji: rel.emoji,
          race: rel.race,
          affinity: rel.affinity,
          loyalty: rel.loyalty,
          relation: 'acquaintance',
          revealLevel: rel.revealLevel,
          appearance: rel.appearance,
          memories: rel.memories ?? [],
          active: rel.status === 'companion',
          interactionCount: 0,
          lastInteraction: Date.now(),
        });
      }
    }
    return nodes.sort((a, b) => b.affinity - a.affinity);
  }, [chainNodes, relationships]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'companion' | 'friend' | 'enemy'>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return mergedNodes;
    if (filter === 'companion') return mergedNodes.filter((n) => n.relation === 'companion' || n.active);
    if (filter === 'friend') return mergedNodes.filter((n) => n.affinity >= 20);
    return mergedNodes.filter((n) => n.affinity <= -20);
  }, [mergedNodes, filter]);

  const selected = mergedNodes.find((n) => n.id === selectedId) ?? null;

  const handleAction = (action: 'talk' | 'gift' | 'invite' | 'recruit') => {
    if (!selected) return;
    onInteract?.(selected, action);
    onAffinityChange?.(selected.id, action === 'gift' ? 5 : action === 'talk' ? 2 : action === 'invite' ? 3 : 0);
    setSelectedId(null);
  };

  return (
    <div style={{
      padding: '1.25rem', color: TEXT, fontFamily: 'system-ui, sans-serif',
      height: '100%', overflowY: 'auto',
    }}>
      <h3 style={{
        textAlign: 'center', fontSize: '1.375rem', fontWeight: 700, color: GOLD,
        marginBottom: '0.25rem', paddingBottom: '0.625rem', borderBottom: '1px solid rgba(201,169,78,0.3)',
      }}>
        ⛓️ 关系链
      </h3>
      <p style={{ textAlign: 'center', fontSize: '0.6875rem', color: MUTED, margin: '0 0 0.75rem' }}>
        剧情中相遇之人皆入此链 · 好感与忠诚编织羁绊
      </p>

      {/* 筛选 */}
      <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {([
          ['all', '全部'],
          ['companion', '同伴'],
          ['friend', '友好'],
          ['enemy', '敌对'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            style={{
              padding: '0.1875rem 0.625rem', borderRadius: 999, fontSize: '0.6875rem',
              border: `1px solid ${filter === key ? GOLD : 'rgba(201,169,78,0.2)'}`,
              background: filter === key ? 'rgba(201,169,78,0.15)' : 'transparent',
              color: filter === key ? GOLD : DIM, cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '0.625rem', color: MUTED, alignSelf: 'center' }}>
          {mergedNodes.length} 人
        </span>
      </div>

      {/* 节点列表 */}
      {filtered.length === 0 ? (
        <div style={{
          padding: '1.5rem 1rem', borderRadius: 8, background: DEEP, textAlign: 'center',
          color: MUTED, fontSize: '0.75rem', border: '1px dashed rgba(201,169,78,0.2)',
        }}>
          关系链空空如也。与剧情中的角色互动后，他们会出现在这里。
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filtered.map((node) => {
            const isSel = selectedId === node.id;
            const relColor = RELATION_COLORS[node.relation] ?? MUTED;
            return (
              <div
                key={node.id}
                onClick={() => setSelectedId(isSel ? null : node.id)}
                style={{
                  padding: '0.625rem 0.75rem', borderRadius: 10, cursor: 'pointer',
                  background: isSel ? 'rgba(201,169,78,0.1)' : PANEL,
                  border: `1px solid ${isSel ? 'rgba(201,169,78,0.4)' : 'rgba(201,169,78,0.12)'}`,
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: DEEP, border: `1px solid ${relColor}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem',
                  }}>
                    {node.emoji}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: TEXT }}>
                        {node.revealLevel >= 1 ? node.name : node.codename}
                      </span>
                      <span style={{
                        fontSize: '0.5625rem', color: relColor, fontWeight: 600,
                        border: `1px solid ${relColor}55`, borderRadius: 4, padding: '0 4px',
                      }}>
                        {RELATION_LABELS[node.relation]}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.625rem', color: DIM, marginTop: '0.125rem' }}>
                      {node.role}
                      {node.race && ` · ${node.race}`}
                    </div>
                  </div>
                  {/* 好感/忠诚 */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: affinityColor(node.affinity) }}>
                      ❤ {node.affinity}
                    </div>
                    <div style={{ fontSize: '0.625rem', color: DIM }}>⚔ {node.loyalty}</div>
                  </div>
                </div>

                {/* 交互区（选中展开） */}
                {isSel && (
                  <div style={{
                    marginTop: '0.625rem', paddingTop: '0.625rem',
                    borderTop: '1px solid rgba(201,169,78,0.15)',
                  }}>
                    {node.memories.length > 0 && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        <div style={{ fontSize: '0.5625rem', color: MUTED, marginBottom: '0.25rem' }}>🧠 羁绊记忆</div>
                        {node.memories.slice(0, 3).map((m, i) => (
                          <div key={i} style={{ fontSize: '0.625rem', color: DIM, lineHeight: 1.5 }}>
                            · {m}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                      <ActionBtn label="💬 对话" onClick={() => handleAction('talk')} color={PURPLE} />
                      <ActionBtn label="🎁 赠送" onClick={() => handleAction('gift')} color={GOLD} />
                      <ActionBtn label="🤝 邀约" onClick={() => handleAction('invite')} color={OK} />
                      {!node.active && node.affinity >= 40 && (
                        <ActionBtn label="✨ 招募" onClick={() => handleAction('recruit')} color="#A864C0" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: '1rem', fontSize: '0.625rem', color: MUTED, textAlign: 'center', lineHeight: 1.6 }}>
        💡 点击角色展开互动：对话增进好感、赠送加深羁绊；
        <br />好感≥40 可尝试招募为同伴。
      </div>
    </div>
  );
}

function ActionBtn({ label, onClick, color }: { label: string; onClick: () => void; color: string }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        padding: '0.25rem 0.625rem', borderRadius: 6, fontSize: '0.625rem', fontWeight: 700,
        border: `1px solid ${color}66`, background: `${color}14`, color,
        cursor: 'pointer', transition: 'all 0.2s ease',
      }}
    >
      {label}
    </button>
  );
}

export default RelationsPanel;
