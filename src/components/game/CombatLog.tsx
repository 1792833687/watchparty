'use client';

/**
 * CombatLog — AI Narrator Game v1.0.0
 *
 * Side panel showing the most recent combat results.
 * Semi-transparent overlay positioned flush to the right.
 */

import React, { useEffect, useCallback } from 'react';
import type { CombatResult } from '@/systems/combat/combat-engine';

// ============================================================
// Types
// ============================================================

export interface CombatLogEntry {
  id: string;
  timestamp: number;
  result: CombatResult;
  enemyName: string;
}

// ============================================================
// Styles
// ============================================================

const S = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    right: 0,
    width: 340,
    maxWidth: 'calc(100vw - 48px)',
    height: '100vh',
    background: 'rgba(10,10,15,0.92)',
    borderLeft: '1px solid rgba(201,169,78,0.25)',
    zIndex: 200,
    display: 'flex',
    flexDirection: 'column' as const,
    fontFamily: "'Noto Sans SC','Inter',system-ui,sans-serif",
    boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  title: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: '#C9A94E',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: '1px solid rgba(201,169,78,0.3)',
    background: 'transparent',
    color: '#C9A94E',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
  },
  list: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '0.75rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  entry: {
    padding: '0.625rem 0.75rem',
    borderRadius: 6,
    background: '#1A181C',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  entryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.375rem',
  },
  enemyName: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#E8E0D5',
  },
  timestamp: {
    fontSize: '0.5625rem',
    color: '#6B6258',
  },
  damageRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.25rem',
  },
  damageValue: {
    fontSize: '0.9375rem',
    fontWeight: 700,
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.25rem',
    marginBottom: '0.25rem',
  },
  tag: (color: string) => ({
    fontSize: '0.5625rem',
    fontWeight: 600,
    color,
    background: `${color}15`,
    padding: '0.125rem 0.375rem',
    borderRadius: 3,
    border: `1px solid ${color}30`,
  }),
  narrative: {
    fontSize: '0.6875rem',
    color: '#A09888',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6B6258',
    fontSize: '0.75rem',
    textAlign: 'center' as const,
    padding: '2rem',
  },
} as const;

// ============================================================
// Component
// ============================================================

export interface CombatLogProps {
  entries: CombatLogEntry[];
  onClose: () => void;
  maxEntries?: number;
}

export function CombatLog({
  entries,
  onClose,
  maxEntries = 20,
}: CombatLogProps): React.ReactElement {
  const recentEntries = entries.slice(-maxEntries).reverse();

  // v4.1.0: Escape 键关闭
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // v4.1.0: 点击遮罩层关闭
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  return (
    <div style={S.overlay} onClick={handleOverlayClick}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.title}>⚔️ 战斗日志</span>
        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.5625rem', color: '#6B6258' }}>ESC 关闭</span>
          <button
            type="button"
            style={S.closeBtn}
            onClick={onClose}
            aria-label="关闭战斗日志"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Entries */}
      {recentEntries.length === 0 ? (
        <div style={S.empty}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚔️</div>
          <div>暂无战斗记录</div>
          <div style={{ fontSize: '0.625rem', marginTop: '0.25rem' }}>
            进入战斗后这里会显示记录
          </div>
        </div>
      ) : (
        <div style={S.list}>
          {recentEntries.map((entry) => {
            const { result } = entry;
            const damageColor = result.damage > 0 ? '#E53E3E' : '#6B6258';
            const comboColor = '#C9A94E';
            const reactionColor = '#7B6FDF';
            const envColor = '#5A9E6F';

            return (
              <div key={entry.id} style={S.entry}>
                {/* Header */}
                <div style={S.entryHeader}>
                  <span style={S.enemyName}>{entry.enemyName}</span>
                  <span style={S.timestamp}>
                    {new Date(entry.timestamp).toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>

                {/* Damage */}
                {result.damage > 0 && (
                  <div style={S.damageRow}>
                    <span style={{ ...S.damageValue, color: damageColor }}>
                      {result.damage}
                    </span>
                    <span style={{ fontSize: '0.625rem', color: '#6B6258' }}>
                      伤害
                    </span>
                  </div>
                )}

                {/* Tags */}
                <div style={S.tags}>
                  {result.reaction && (
                    <span style={S.tag(reactionColor)}>
                      {result.reaction}
                    </span>
                  )}
                  {result.comboName && (
                    <span style={S.tag(comboColor)}>
                      {result.comboName} · {result.combo}连击
                    </span>
                  )}
                  {result.environmentHazard && (
                    <span style={S.tag(envColor)}>
                      {result.environmentHazard}
                    </span>
                  )}
                  {result.damage === 0 && (
                    <span style={S.tag('#6B6258')}>MISS</span>
                  )}
                </div>

                {/* Narrative */}
                <div style={S.narrative}>
                  {result.narrative}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
