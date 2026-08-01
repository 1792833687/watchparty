'use client';

/**
 * EquipmentCard — AI Narrator Game v1.0.0
 *
 * Displays equipment with rarity-colored borders, stat listings,
 * and equip button. Uses inline styles per project standards.
 */

import React from 'react';
import type { Equipment, Rarity, EquipmentAffix } from '@/systems/equipment/equipment-system';
import { RARITY_COLORS, RARITY_LABELS } from '@/systems/equipment/equipment-system';

// ============================================================
// Styles
// ============================================================

const S = {
  card: (rarity: Rarity) => {
    const c = RARITY_COLORS[rarity];
    return {
      background: `linear-gradient(135deg, #1A181C, ${c.bg})`,
      border: `2px solid ${c.border}`,
      borderRadius: 8,
      padding: '0.875rem',
      fontFamily: "'Noto Sans SC','Inter',system-ui,sans-serif",
      transition: 'all 0.2s ease',
      position: 'relative' as const,
      overflow: 'hidden' as const,
    };
  },
  glow: (rarity: Rarity) => {
    if (rarity === 'legendary') {
      return {
        position: 'absolute' as const,
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(135deg, rgba(201,169,78,0.05) 0%, transparent 50%, rgba(201,169,78,0.05) 100%)',
        pointerEvents: 'none' as const,
      };
    }
    return {};
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.5rem',
    position: 'relative' as const,
    zIndex: 1,
  },
  name: (rarity: Rarity) => ({
    fontSize: '0.875rem',
    fontWeight: 700,
    color: RARITY_COLORS[rarity].color,
    lineHeight: 1.3,
  }),
  rarityBadge: (rarity: Rarity) => ({
    fontSize: '0.5625rem',
    fontWeight: 600,
    color: RARITY_COLORS[rarity].color,
    background: RARITY_COLORS[rarity].bg,
    padding: '0.125rem 0.375rem',
    borderRadius: 3,
    whiteSpace: 'nowrap' as const,
    border: `1px solid ${RARITY_COLORS[rarity].border}`,
  }),
  typeLabel: {
    fontSize: '0.625rem',
    color: '#6B6258',
    marginBottom: '0.5rem',
    position: 'relative' as const,
    zIndex: 1,
  },
  divider: {
    height: 1,
    background: 'rgba(255,255,255,0.06)',
    margin: '0.5rem 0',
    position: 'relative' as const,
    zIndex: 1,
  },
  statsSection: {
    position: 'relative' as const,
    zIndex: 1,
  },
  statsTitle: {
    fontSize: '0.625rem',
    fontWeight: 600,
    color: '#6B6258',
    marginBottom: '0.375rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.75rem',
    marginBottom: '0.125rem',
  },
  statName: {
    color: '#A09888',
  },
  statValue: {
    color: '#E8E0D5',
    fontWeight: 600,
  },
  affixSection: {
    marginTop: '0.375rem',
    position: 'relative' as const,
    zIndex: 1,
  },
  affixRow: {
    fontSize: '0.6875rem',
    color: '#7B6FDF',
    marginBottom: '0.125rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  durability: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    marginTop: '0.5rem',
    position: 'relative' as const,
    zIndex: 1,
  },
  durabilityBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    background: '#2A272C',
    overflow: 'hidden' as const,
  },
  durabilityFill: (pct: number) => {
    let color = '#5A9E6F';
    if (pct < 25) color = '#E53E3E';
    else if (pct < 50) color = '#C9A94E';
    return {
      width: `${pct}%`,
      height: '100%',
      borderRadius: 2,
      background: color,
      transition: 'width 0.3s ease',
    };
  },
  durabilityText: {
    fontSize: '0.625rem',
    color: '#6B6258',
    whiteSpace: 'nowrap' as const,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '0.625rem',
    position: 'relative' as const,
    zIndex: 1,
  },
  levelBadge: {
    fontSize: '0.625rem',
    color: '#6B6258',
    fontWeight: 600,
  },
  equipBtn: (rarity: Rarity) => ({
    padding: '0.25rem 0.75rem',
    borderRadius: 4,
    border: `1px solid ${RARITY_COLORS[rarity].border}`,
    background: RARITY_COLORS[rarity].bg,
    color: RARITY_COLORS[rarity].color,
    fontSize: '0.6875rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  }),
  compact: {
    padding: '0.5rem',
  },
} as const;

// ============================================================
// Component
// ============================================================

export interface EquipmentCardProps {
  equipment: Equipment;
  onEquip?: (equipment: Equipment) => void;
  compact?: boolean;
  showEquipButton?: boolean;
}

export function EquipmentCard({
  equipment,
  onEquip,
  compact = false,
  showEquipButton = true,
}: EquipmentCardProps): React.ReactElement {
  const { rarity } = equipment;
  const rarityMeta = RARITY_COLORS[rarity];
  const durabilityPct = equipment.maxDurability > 0
    ? (equipment.durability / equipment.maxDurability) * 100
    : 100;

  const handleEquip = () => {
    onEquip?.(equipment);
  };

  const typeLabel = getTypeLabel(equipment.type);

  return (
    <div style={S.card(rarity)}>
      {/* Ambient glow for legendary */}
      <div style={S.glow(rarity)} />

      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.name(rarity)}>{equipment.name}</div>
          <div style={S.typeLabel}>{typeLabel}</div>
        </div>
        <span style={S.rarityBadge(rarity)}>
          {RARITY_LABELS[rarity]}
        </span>
      </div>

      {!compact && (
        <>
          {/* Base Stats */}
          <div style={S.statsSection}>
            <div style={S.statsTitle}>基础属性</div>
            {Object.entries(equipment.baseStats).map(([key, val]) => (
              <div key={key} style={S.statRow}>
                <span style={S.statName}>{getStatLabel(key)}</span>
                <span style={S.statValue}>+{val}</span>
              </div>
            ))}
          </div>

          {/* Affixes */}
          {equipment.affixes.length > 0 && (
            <div style={S.affixSection}>
              <div style={S.statsTitle}>词缀</div>
              {equipment.affixes.map((affix, i) => (
                <div key={`${affix.name}-${i}`} style={S.affixRow}>
                  <span>✦</span>
                  <span>{affix.name} +{affix.value}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Compact stats */}
      {compact && (
        <div style={S.statsSection}>
          {Object.entries(equipment.baseStats).map(([key, val]) => (
            <div key={key} style={{ display: 'inline-flex', gap: '0.25rem', marginRight: '0.75rem', fontSize: '0.6875rem' }}>
              <span style={{ color: '#6B6258' }}>{getStatLabel(key)}</span>
              <span style={{ color: rarityMeta.color, fontWeight: 600 }}>+{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Durability */}
      <div style={S.durability}>
        <div style={S.durabilityBar}>
          <div style={S.durabilityFill(durabilityPct)} />
        </div>
        <span style={S.durabilityText}>
          {equipment.durability}/{equipment.maxDurability}
        </span>
      </div>

      {/* Footer */}
      <div style={S.footer}>
        <span style={S.levelBadge}>Lv.{equipment.level}</span>
        {showEquipButton && (
          <button
            type="button"
            onClick={handleEquip}
            style={S.equipBtn(rarity)}
          >
            装备
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function getTypeLabel(type: string): string {
  switch (type) {
    case 'weapon': return '武器';
    case 'armor': return '防具';
    case 'accessory': return '饰品';
    case 'consumable': return '消耗品';
    default: return type;
  }
}

function getStatLabel(key: string): string {
  switch (key) {
    case 'attack': return '攻击';
    case 'defense': return '防御';
    case 'hp': return '生命';
    case 'critChance': return '暴击率';
    case 'intelligence': return '智力';
    case 'luck': return '幸运';
    default: return key;
  }
}
