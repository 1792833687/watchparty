/**
 * CustomGameList — AI Narrator Game
 *
 * Displays previously created custom games as editable cards.
 * Supports re-editing (text import or module rebuild) and deletion.
 */

'use client';

import React from 'react';
import type { CustomGameRecord } from '@/systems/settings/types';

// ============================================================
// Props
// ============================================================

interface CustomGameListProps {
  games: CustomGameRecord[];
  selectedId: string | null;
  onSelect: (record: CustomGameRecord) => void;
  onEdit: (record: CustomGameRecord) => void;
  onDelete: (recordId: string) => void;
}

// ============================================================
// Styles
// ============================================================

const S = {
  section: {
    marginBottom: '1.5rem',
  },
  sectionTitle: {
    color: '#C9A94E',
    fontSize: '1.0625rem',
    fontWeight: 600,
    marginBottom: '0.75rem',
  },
  emptyText: {
    color: '#6B6258',
    fontSize: '0.875rem',
    fontStyle: 'italic' as const,
    padding: '0.75rem',
  },
  cardList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.625rem',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.875rem 1rem',
    borderRadius: 8,
    background: '#1E1B18',
    border: '1px solid #2E2924',
    transition: 'border-color 0.2s',
  },
  cardSelected: {
    borderColor: '#C9A94E',
    boxShadow: '0 0 0 1px rgba(201,169,78,0.3)',
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    color: '#E8E0D5',
    fontSize: '0.9375rem',
    fontWeight: 600,
    marginBottom: '0.25rem',
  },
  cardMeta: {
    display: 'flex',
    gap: '0.75rem',
    color: '#8B8278',
    fontSize: '0.75rem',
  },
  cardBadge: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    borderRadius: 4,
    fontSize: '0.6875rem',
    fontWeight: 600,
  },
  badgeImport: {
    background: 'rgba(123,111,223,0.2)',
    color: '#7B6FDF',
  },
  badgeModule: {
    background: 'rgba(90,158,111,0.2)',
    color: '#5A9E6F',
  },
  badgeSelected: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    borderRadius: 4,
    fontSize: '0.6875rem',
    fontWeight: 600,
    background: 'rgba(201,169,78,0.2)',
    color: '#C9A94E',
    marginLeft: '0.5rem',
  },
  actions: {
    display: 'flex',
    gap: '0.5rem',
    marginLeft: '0.75rem',
    flexShrink: 0,
  },
  btnAction: {
    padding: '0.375rem 0.75rem',
    borderRadius: 6,
    border: '1px solid #2E2924',
    background: 'transparent',
    color: '#A09888',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: 500,
    whiteSpace: 'nowrap' as const,
  },
  btnDelete: {
    padding: '0.375rem 0.75rem',
    borderRadius: 6,
    border: '1px solid rgba(220,80,80,0.3)',
    background: 'transparent',
    color: '#DC5050',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: 500,
    whiteSpace: 'nowrap' as const,
  },
  summaryRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    marginRight: '0.75rem',
  },
} as const;

// ============================================================
// Helpers
// ============================================================

function formatDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return isoStr;
  }
}

/** Summarize module selections for display */
function moduleSummary(record: CustomGameRecord): string {
  if (!record.moduleSelection) return '';
  const parts: string[] = [];
  if (record.moduleSelection.worldType) {
    const map: Record<string, string> = {
      fantasy: '奇幻', 'sci-fi': '科幻', modern: '现代', wuxia: '武侠',
      'post-apocalyptic': '末日', 'custom-world': '自定义',
    };
    parts.push(map[record.moduleSelection.worldType] ?? record.moduleSelection.worldType);
  }
  if (record.moduleSelection.coreGameplay) {
    const map: Record<string, string> = {
      'story-driven': '剧情驱动', 'free-exploration': '自由探索',
      survival: '生存挑战', 'puzzle-mystery': '解谜推理',
    };
    parts.push(map[record.moduleSelection.coreGameplay] ?? record.moduleSelection.coreGameplay);
  }
  if (record.moduleSelection.plotDirection) {
    const map: Record<string, string> = {
      'linear-narrative': '线性', 'branching-endings': '分支结局', sandbox: '沙盒',
    };
    parts.push(map[record.moduleSelection.plotDirection] ?? record.moduleSelection.plotDirection);
  }
  return parts.join(' · ');
}

// ============================================================
// Component
// ============================================================

export function CustomGameList({
  games,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
}: CustomGameListProps): React.ReactElement {
  if (games.length === 0) {
    return (
      <div style={S.section}>
        <div style={S.sectionTitle}>我的自定义游戏</div>
        <div style={S.emptyText}>
          尚未创建自定义游戏。使用上方「文本导入」或「模块拼搭」创建你的专属世界。
        </div>
      </div>
    );
  }

  return (
    <div style={S.section}>
      <div style={S.sectionTitle}>
        我的自定义游戏 ({games.length})
      </div>
      <div style={S.cardList}>
        {games.map((g) => {
          const isSelected = selectedId === g.id;
          return (
            <div
              key={g.id}
              style={{
                ...S.card,
                ...(isSelected ? S.cardSelected : {}),
                cursor: 'pointer',
              }}
              onClick={() => onSelect(g)}
            >
              <div style={S.cardInfo}>
                <div style={S.cardName}>
                  {g.name}
                  {isSelected && <span style={S.badgeSelected}>当前选择</span>}
                </div>
                <div style={S.cardMeta}>
                  <span style={{
                    ...S.cardBadge,
                    ...(g.createdBy === 'import' ? S.badgeImport : S.badgeModule),
                  }}>
                    {g.createdBy === 'import' ? '文本导入' : '模块拼搭'}
                  </span>
                  {g.createdBy === 'module-build' && g.moduleSelection && (
                    <span style={S.summaryRow}>
                      {moduleSummary(g)}
                    </span>
                  )}
                  <span>{formatDate(g.updatedAt ?? g.createdAt)}</span>
                </div>
              </div>
              <div style={S.actions}>
                <button
                  style={S.btnAction}
                  onClick={(e) => { e.stopPropagation(); onEdit(g); }}
                >
                  编辑
                </button>
                <button
                  style={S.btnDelete}
                  onClick={(e) => { e.stopPropagation(); onDelete(g.id); }}
                >
                  删除
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
