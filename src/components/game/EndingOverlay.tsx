/**
 * v4.1.0 结局触发遮罩（world-setting 十一·多结局系统）
 * 结局揭晓 + 《致领主书》通关书信 + 新游戏入口。
 * @module components/game/EndingOverlay
 */
'use client';

import React from 'react';
import type { EndingDef, EndingConditionContext } from '@/systems/endings/ending-system';
// v5.1.0 技术美术：硬编码色板统一走 tokens
import { C } from '@/theme/tokens';

export interface EndingOverlayProps {
  ending: EndingDef;
  dayCount: number;
  /** v4.1.0: 结局上下文（用于生成真实的《致领主书》） */
  letterContext?: Partial<EndingConditionContext>;
  /** 是否可开启新游戏（返回首页） */
  onNewGame: () => void;
  /** 关闭遮罩（继续浏览战报） */
  onClose?: () => void;
}

export function EndingOverlay({ ending, dayCount, letterContext, onNewGame, onClose }: EndingOverlayProps): React.ReactElement {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.25rem',
        backdropFilter: 'blur(6px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label="结局"
    >
      <div
        style={{
          maxWidth: 560, width: '100%', maxHeight: '88vh', overflowY: 'auto',
          background: C.bgPanel,
          border: `2px solid ${ending.color}`,
          borderRadius: 16,
          boxShadow: `0 0 60px ${ending.color}44, 0 12px 40px rgba(0,0,0,0.7)`,
          padding: '2rem 1.75rem',
          color: C.text,
          fontFamily: "'Georgia', serif",
          position: 'relative',
        }}
      >
        {/* 装饰顶栏 */}
        <div style={{
          textAlign: 'center', marginBottom: '1.5rem',
        }}>
          <div style={{ fontSize: '3rem', lineHeight: 1 }}>{ending.icon}</div>
          <div style={{
            display: 'inline-block', marginTop: '0.75rem',
            fontSize: '0.75rem', letterSpacing: '0.2em', color: ending.color,
            border: `1px solid ${ending.color}66`, borderRadius: 999,
            padding: '0.25rem 1rem', textTransform: 'uppercase',
          }}>
            {ending.type}
          </div>
          <h2 style={{
            fontSize: '1.75rem', fontWeight: 800, color: ending.color,
            margin: '0.75rem 0 0.25rem', textShadow: `0 0 24px ${ending.color}55`,
          }}>
            {ending.name}
          </h2>
          <div style={{ fontSize: '0.8125rem', color: C.textDim, marginTop: '0.25rem' }}>
            —— 第 {dayCount} 天 · 凛冬要塞编年史终章
          </div>
        </div>

        {/* 结局标题 */}
        <p style={{
          textAlign: 'center', fontStyle: 'italic', color: '#D4C5A9',
          fontSize: '1.0625rem', lineHeight: 1.7, margin: '0 0 1.5rem',
        }}>
          「{ending.title}」
        </p>

        {/* 结局概述 */}
        <div style={{
          background: 'rgba(0,0,0,0.25)', borderRadius: 10,
          padding: '0.875rem 1rem', fontSize: '0.875rem', lineHeight: 1.7,
          color: '#C8BFB0', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.05)',
        }}>
          {ending.summary}
        </div>

        {/* 《致领主书》 */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{
            fontSize: '0.75rem', letterSpacing: '0.25em', color: ending.color,
            textAlign: 'center', marginBottom: '0.75rem',
          }}>
            ── 通 关 书 信 · 致 领 主 书 ──
          </div>
          <div style={{
            background: '#16130F', borderRadius: 12,
            border: `1px solid ${C.border}`,
            padding: '1.25rem 1.375rem',
            fontSize: '0.875rem', lineHeight: 1.9,
            color: '#D4C5A9', whiteSpace: 'pre-line',
            fontStyle: 'italic',
          }}>
            {ending.letter({
              dayCount,
              corruption: letterContext?.corruption ?? 0,
              endingFlags: letterContext?.endingFlags ?? {},
              factionReputations: letterContext?.factionReputations ?? {},
              defense: letterContext?.defense ?? 0,
              ailaCompleted: letterContext?.ailaCompleted ?? false,
              siegesSurvived: letterContext?.siegesSurvived ?? 0,
              mainQuestCompleted: letterContext?.mainQuestCompleted ?? true,
            })}
          </div>
        </div>

        {/* 操作 */}
        <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'center' }}>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.625rem 1.375rem', borderRadius: 8,
                border: '1px solid rgba(160,152,136,0.4)', background: 'transparent',
                color: C.textDim, fontSize: '0.8125rem', cursor: 'pointer',
              }}
            >
              关闭（查看编年史）
            </button>
          )}
          <button
            type="button"
            onClick={onNewGame}
            style={{
              padding: '0.625rem 1.375rem', borderRadius: 8,
              border: `1px solid ${ending.color}`,
              background: ending.color,
              color: C.bgDeep, fontWeight: 700, fontSize: '0.8125rem',
              cursor: 'pointer', boxShadow: `0 4px 20px ${ending.color}55`,
            }}
          >
            ✦ 开启新的传说
          </button>
        </div>
      </div>
    </div>
  );
}

export default EndingOverlay;
