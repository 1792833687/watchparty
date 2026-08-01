'use client';

/**
 * StoryDashboard — AI Narrator Game v1.1.0
 *
 * 可视化展示生成的故事世界：职业/属性/装备/地图/叙事
 */

import React, { useMemo } from 'react';
import type { GeneratedWorld, GeneratedClass, GeneratedEquipment, GeneratedRegion } from '@/systems/generator/story-generator';

// ============================================================
// Props
// ============================================================

interface StoryDashboardProps {
  world: GeneratedWorld;
  onConfirm?: () => void;
  onRegenerate?: () => void;
}

// ============================================================
// Design Tokens
// ============================================================

const T = {
  bg: '#0A0A0F',
  card: '#1A181C',
  gold: '#C9A94E',
  text: '#E8E0D5',
  sub: '#A09888',
  mute: '#6B6258',
  border: '#2A272C',
  rarity: { common: '#888', uncommon: '#5A9E6F', rare: '#5B8CBE', epic: '#7B6FDF', legendary: '#C9A94E' },
};

// ============================================================
// Component
// ============================================================

export function StoryDashboard({ world, onConfirm, onRegenerate }: StoryDashboardProps): React.ReactElement {
  return (
    <div style={{ background: T.bg, color: T.text, fontFamily: "'Noto Sans SC','Inter',sans-serif", minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: T.gold, fontFamily: "'Cinzel','Georgia',serif", marginBottom: '0.25rem' }}>
            🧬 世界观生成结果
          </h1>
          <p style={{ color: T.sub, fontSize: '0.875rem' }}>
            检测类型：<span style={{ color: T.gold, fontWeight: 600 }}>{world.detectedGenre}</span>
            {world.consistencyWarnings.length > 0 && (
              <span style={{ color: '#E53E3E', marginLeft: '0.75rem' }}>
                ⚠ {world.consistencyWarnings.length} 项警告
              </span>
            )}
          </p>
        </div>

        {/* Consistency warnings */}
        {world.consistencyWarnings.length > 0 && (
          <div style={{ background: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.3)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.5rem' }}>
            {world.consistencyWarnings.map((w, i) => (
              <div key={i} style={{ fontSize: '0.8125rem', color: '#E53E3E' }}>{w}</div>
            ))}
          </div>
        )}

        {/* Section: Classes */}
        <DashboardSection title="👥 职业体系" icon="⚔️">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {world.classes.map((cls) => (
              <ClassCard key={cls.id} cls={cls} genre={world.detectedGenre} />
            ))}
          </div>
        </DashboardSection>

        {/* Section: Equipment */}
        <DashboardSection title="🎒 装���物品" icon="📦">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {world.equipment.map((eq) => (
              <EquipmentBadge key={eq.id} eq={eq} />
            ))}
          </div>
        </DashboardSection>

        {/* Section: Map */}
        <DashboardSection title="🗺️ 世界地图" icon="📍">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {world.mapRegions.map((region) => (
              <RegionCard key={region.id} region={region} />
            ))}
          </div>
        </DashboardSection>

        {/* Section: Opening Narrative */}
        <DashboardSection title="📖 开场叙事" icon="✨">
          <div style={{
            background: T.card, borderRadius: 8, padding: '1.25rem 1.5rem',
            borderLeft: `3px solid ${T.gold}`, fontStyle: 'italic',
            fontSize: '0.9375rem', lineHeight: 1.9, color: T.text,
            fontFamily: "'Cinzel','Georgia','Noto Serif SC',serif",
          }}>
            {world.openingNarrative}
          </div>
        </DashboardSection>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '2rem', paddingBottom: '2rem' }}>
          {onRegenerate && (
            <button onClick={onRegenerate} type="button" style={{
              padding: '0.75rem 2rem', borderRadius: 8, border: `1px solid ${T.border}`,
              background: 'transparent', color: T.sub, fontWeight: 600, cursor: 'pointer',
              fontSize: '0.9375rem',
            }}>
              🔄 重新生成
            </button>
          )}
          {onConfirm && (
            <button onClick={onConfirm} type="button" style={{
              padding: '0.75rem 2rem', borderRadius: 8, border: 'none',
              background: T.gold, color: T.bg, fontWeight: 700, cursor: 'pointer',
              fontSize: '0.9375rem',
            }}>
              ✅ 确认使用 → 进入游戏
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function DashboardSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: T.gold, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>{icon}</span> {title}
      </h2>
      {children}
    </div>
  );
}

function ClassCard({ cls, genre }: { cls: GeneratedClass; genre: string }): React.ReactElement {
  const attrKeys = Object.keys(cls.baseAttributes);
  const primaryAttr = attrKeys[0] ?? 'strength';

  return (
    <div style={{
      background: T.card, borderRadius: 10, padding: '1rem',
      border: `1px solid ${T.border}`, transition: 'all 0.15s',
    }}>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: T.gold, marginBottom: '0.25rem' }}>
        {cls.name}
      </div>
      <div style={{ fontSize: '0.75rem', color: T.sub, marginBottom: '0.625rem' }}>
        {cls.description}
      </div>
      {/* Attributes */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {Object.entries(cls.baseAttributes).map(([key, val]) => (
          <div key={key} style={{
            padding: '0.125rem 0.5rem', borderRadius: 4,
            background: val >= 7 ? 'rgba(201,169,78,0.15)' : 'rgba(107,98,88,0.15)',
            fontSize: '0.75rem', color: val >= 7 ? T.gold : T.sub,
          }}>
            {key.slice(0, 3).toUpperCase()}: {val}
          </div>
        ))}
      </div>
      {/* Equipment */}
      {cls.startingEquipment.length > 0 && (
        <div style={{ fontSize: '0.6875rem', color: T.mute }}>
          🎒 {cls.startingEquipment.join(' · ')}
        </div>
      )}
    </div>
  );
}

function EquipmentBadge({ eq }: { eq: GeneratedEquipment }): React.ReactElement {
  const color = T.rarity[eq.rarity] ?? T.mute;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
      padding: '0.375rem 0.75rem', borderRadius: 6,
      background: T.card, border: `1px solid ${color}44`,
      fontSize: '0.8125rem', color: T.text,
    }}>
      <span>{eq.emoji}</span>
      <span style={{ color }}>{eq.name}</span>
    </div>
  );
}

function RegionCard({ region }: { region: GeneratedRegion }): React.ReactElement {
  return (
    <div style={{
      background: T.card, borderRadius: 8, padding: '0.75rem 1rem',
      border: `1px solid ${region.unlocked ? '#5A9E6F44' : T.border}`,
      minWidth: 140,
      opacity: region.unlocked ? 1 : 0.5,
    }}>
      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: region.unlocked ? '#5A9E6F' : T.sub }}>
        {region.unlocked ? '📍 ' : '🔒 '}{region.name}
      </div>
      <div style={{ fontSize: '0.6875rem', color: T.mute, marginTop: '0.25rem' }}>
        {region.description}
      </div>
    </div>
  );
}
