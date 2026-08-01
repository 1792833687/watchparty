/**
 * v4.1.0 对话选项 UI 组件
 * 将 AI 输出的 OPTIONS 块渲染为独立交互区，支持条件触发显示。
 * @module components/game/DialogueOptions
 */
'use client';

import React from 'react';
import { C, RADIUS, SHADOW, FONT } from '@/theme/tokens';
import type { DialogueOption } from './panels/types';

const S = {
  container: { display: 'flex', flexDirection: 'column' as const, gap: '0.5rem', padding: '0.75rem 0' },
  option: (style: string, disabled: boolean) => {
    const base: React.CSSProperties = {
      padding: '0.75rem 1rem', borderRadius: RADIUS.md, cursor: disabled ? 'not-allowed' : 'pointer',
      border: '1px solid', fontSize: FONT.md, fontWeight: 500, color: disabled ? C.textMuted : C.text,
      transition: 'all 0.2s ease', textAlign: 'left' as const, display: 'flex', alignItems: 'center', gap: '0.5rem',
      width: '100%', opacity: disabled ? 0.45 : 1,
    };
    switch (style) {
      case 'bold': return { ...base, background: `linear-gradient(135deg, ${C.gold}22, ${C.gold}08)`, borderColor: C.gold + '55' };
      case 'cautious': return { ...base, background: C.magic + '10', borderColor: C.magic + '33' };
      case 'aggressive': return { ...base, background: C.danger + '10', borderColor: C.danger + '33' };
      default: return { ...base, background: C.bgCard, borderColor: C.border };
    }
  },
  hint: { fontSize: FONT.xs, color: C.textDim, marginTop: '0.25rem' },
  conditionBadge: { fontSize: FONT.xs, padding: '0.125rem 0.5rem', borderRadius: RADIUS.pill, fontWeight: 600 },
};

interface DialogueOptionsProps {
  options: DialogueOption[];
  /** 当前属性值，用于条件判断 */
  attributes?: Record<string, number>;
  /** 当前技能（名称列表） */
  skills?: string[];
  /** 背包物品 ID 集合 */
  inventoryIds?: Set<string>;
  /** 当前金币（铜币） */
  gold?: number;
  /** 堕落值 */
  corruption?: number;
  /** 选择回调 */
  onSelect: (option: DialogueOption) => void;
}

/** 判断选项是否满足条件 */
function checkCondition(
  cond: DialogueOption['condition'],
  attributes: Record<string, number>,
  skills: string[],
  inventoryIds: Set<string>,
  gold: number,
  corruption: number,
): boolean {
  if (!cond) return true;
  switch (cond.type) {
    case 'attr': return (attributes[cond.key] ?? 0) >= (cond.value ?? 1);
    case 'skill': return skills.includes(cond.key);
    case 'item': return inventoryIds.has(cond.key);
    case 'gold': return gold >= (cond.value ?? 1);
    case 'corruption': return corruption >= (cond.value ?? 1);
    default: return false;
  }
}

export const DialogueOptions: React.FC<DialogueOptionsProps> = ({
  options, attributes = {}, skills = [], inventoryIds = new Set(),
  gold = 0, corruption = 0, onSelect,
}) => {
  if (options.length === 0) return null;

  return (
    <div style={S.container}>
      {options.map(opt => {
        const met = checkCondition(opt.condition, attributes, skills, inventoryIds, gold, corruption);
        return (
          <div key={opt.id}>
            <button
              type="button"
              disabled={!met}
              style={S.option(opt.style ?? 'default', !met)}
              onClick={() => met && onSelect(opt)}
              title={met ? (opt.hint ?? '') : (opt.condition ? '条件不满足' : '')}
            >
              {opt.emoji && <span style={{ fontSize: '1.1rem' }}>{opt.emoji}</span>}
              <span>{opt.text}</span>
              {!met && opt.condition && (
                <span style={{ ...S.conditionBadge, color: C.textMuted, background: C.bgDeep, marginLeft: 'auto' }}>
                  🔒 {opt.condition.type === 'attr' ? `${opt.condition.key} ≥ ${opt.condition.value}` :
                    opt.condition.type === 'item' ? `需: ${opt.condition.key}` :
                    opt.condition.type === 'gold' ? `需 ${opt.condition.value}🪙` :
                    '条件不足'}
                </span>
              )}
            </button>
            {met && opt.hint && <div style={S.hint}>{opt.hint}</div>}
          </div>
        );
      })}
    </div>
  );
};

export default DialogueOptions;
