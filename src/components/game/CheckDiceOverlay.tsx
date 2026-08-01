/**
 * v4.1.0 D20 检定可视化覆盖层（world-setting 三·3.1 检定公式）
 *
 * 解析 AI 输出的 [CHECK:attr:STR:DC:15] 块，渲染掷骰动画：
 *  D20 翻转 → 显示结果 + 属性修正 → 成功/失败判定
 * 属性修正值 = Math.floor((attr - 10) / 2)
 * @module components/game/CheckDiceOverlay
 */
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface DiceCheck {
  /** 检定属性 key（如 strength/dexterity…） */
  attr: string;
  /** 属性值 */
  attrValue: number;
  /** 难度等级 DC */
  dc: number;
  /** 检定描述 */
  desc?: string;
}

interface CheckDiceOverlayProps {
  check: DiceCheck;
  onClose: () => void;
  /** v4.2.1 (P0-2): 检定结果回调 — 前端裁决结果回传父组件，注入 AI 上下文 */
  onResult?: (result: { attr: string; roll: number; modifier: number; total: number; dc: number; success: boolean }) => void;
}

const ATTR_LABELS: Record<string, string> = {
  strength: '力量', dexterity: '敏捷', constitution: '体质',
  intelligence: '智力', wisdom: '感知', charisma: '魅力',
};

/** 解析 AI 回复中的 [CHECK:attr:STR:DC:15] 块 */
export function parseCheckBlocks(text: string): { attr: string; dc: number; desc?: string }[] {
  const pattern = /\[CHECK:(attr)?:?([a-zA-Z]+):DC:(\d+)(?::([^\]]+))?\]/g;
  const results: { attr: string; dc: number; desc?: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    results.push({ attr: m[2]!.toLowerCase(), dc: parseInt(m[3]!, 10), desc: m[4] });
  }
  return results;
}

/** 从 AI 回复中剥离 CHECK 块 */
export function stripCheckBlocks(text: string): string {
  return text.replace(/\[CHECK:[^\]]*\]/g, '');
}

export function CheckDiceOverlay({ check, onClose, onResult }: CheckDiceOverlayProps): React.ReactElement {
  const [phase, setPhase] = useState<'rolling' | 'result' | 'done'>('rolling');
  const [roll, setRoll] = useState(0);
  const [face, setFace] = useState(1);
  // v4.2.1 (P1-6): 属性范围 1-10 下原公式 floor((attr-10)/2) 修正恒 ≤0（DC25 数学上必败）。
  // 改为 attr-5：修正范围 -4~+5，匹配当前属性范围；DC 档位同步调为 8/12/16/20。
  const modifier = useMemo(() => (check.attrValue ?? 0) - 5, [check.attrValue]);
  const total = roll + modifier;
  const success = total >= check.dc;
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    // 掷骰动画：约 1.2s 内快速翻转
    let frame = 0;
    const interval = window.setInterval(() => {
      frame += 1;
      setFace(1 + Math.floor(Math.random() * 20));
      if (frame >= 24) {
        window.clearInterval(interval);
        const final = 1 + Math.floor(Math.random() * 20);
        setRoll(final);
        setFace(final);
        setPhase('result');
        // v4.2.1 (P0-2): 结果一出即回传父组件（不等动画结束，保证注入下轮 prompt）
        onResult?.({ attr: check.attr, roll: final, modifier, total: final + modifier, dc: check.dc, success: final + modifier >= check.dc });
        // 显示结果 2.5s 后自动关闭
        window.setTimeout(() => setPhase('done'), 2500);
      }
    }, 50);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (phase === 'done') {
      const t = window.setTimeout(onClose, 400);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [phase, onClose]);

  const diceColor = success ? '#5A9E6F' : '#E53E3E';
  const phaseLabel = phase === 'rolling' ? '检定中…' : success ? '检定成功！' : '检定失败…';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={phase !== 'rolling' ? onClose : undefined}
      role="dialog"
      aria-label="D20 检定"
    >
      <div style={{
        background: 'linear-gradient(160deg, #1E1B18, #0D0D12)',
        border: `1px solid ${phase === 'rolling' ? 'rgba(201,169,78,0.4)' : diceColor}`,
        borderRadius: 16,
        padding: '2rem 2.5rem',
        textAlign: 'center',
        boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
        minWidth: 300,
        animation: phase === 'done' ? 'check-fadeout 0.4s ease forwards' : 'check-pop 0.3s ease',
      }}>
        {/* 属性与 DC */}
        <div style={{ fontSize: '0.8125rem', color: '#A09888', marginBottom: '1rem' }}>
          {ATTR_LABELS[check.attr] ?? check.attr}检定（{check.attrValue}）· DC {check.dc}
        </div>
        {check.desc && (
          <div style={{ fontSize: '0.75rem', color: '#8B7355', marginBottom: '1rem', fontStyle: 'italic' }}>
            {check.desc}
          </div>
        )}

        {/* D20 骰子 */}
        <div style={{
          width: 120, height: 120, margin: '0 auto 1.25rem',
          borderRadius: 24, background: phase === 'rolling' ? '#2A2522' : diceColor + '22',
          border: `2px solid ${phase === 'rolling' ? '#C9A94E' : diceColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: phase === 'rolling' ? 'rotate(0deg)' : 'rotate(360deg)',
          transition: 'transform 0.2s ease, background 0.4s ease',
          animation: phase === 'rolling' ? 'dice-spin 1.2s linear infinite' : 'none',
          boxShadow: phase === 'rolling' ? '0 0 24px rgba(201,169,78,0.3)' : `0 0 32px ${diceColor}44`,
        }}>
          <span style={{ fontSize: '3rem', fontWeight: 800, color: phase === 'rolling' ? '#C9A94E' : diceColor }}>
            {phase === 'rolling' ? '?' : face}
          </span>
        </div>

        {/* 结果行 */}
        <div style={{ fontSize: '1rem', fontWeight: 700, color: phase === 'rolling' ? '#A09888' : diceColor, marginBottom: '0.5rem' }}>
          {phaseLabel}
        </div>
        {phase === 'result' && (
          <div style={{ fontSize: '0.875rem', color: '#E8E0D5', marginBottom: '0.75rem' }}>
            🎲 {roll} {modifier >= 0 ? `+ ${modifier}` : `- ${Math.abs(modifier)}`} = <b style={{ color: diceColor }}>{total}</b>
            <span style={{ color: '#6B6258', marginLeft: '0.5rem' }}>
              {success ? `≥ ${check.dc}` : `< ${check.dc}`}
            </span>
          </div>
        )}
        {phase === 'result' && (
          <div style={{ fontSize: '0.6875rem', color: '#6B6258' }}>
            {success ? '✦ 检定成功，行动如你所愿' : '✧ 检定失败，代价随之而来'}
          </div>
        )}
      </div>

      <style>{`
        @keyframes dice-spin {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.05); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes check-pop {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes check-fadeout {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default CheckDiceOverlay;
