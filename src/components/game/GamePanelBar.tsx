'use client';

import React, { useEffect, useState } from 'react';
import type { PanelId } from './panels/types';

export interface GamePanelBarProps {
  activePanel: PanelId;
  onToggle: (panelId: PanelId) => void;
}

interface PanelButton {
  id: NonNullable<PanelId>;
  label: string;
  emoji: string;
}

const BUTTONS: PanelButton[] = [
  { id: 'character', label: '属性', emoji: '👤' },
  { id: 'inventory', label: '背包', emoji: '🎒' },
  { id: 'quest', label: '任务', emoji: '📜' },
  { id: 'skills', label: '技能', emoji: '🌟' },
  { id: 'map', label: '地图', emoji: '🗺️' },
  { id: 'town', label: '城镇', emoji: '🏘️' },
  { id: 'market', label: '市场', emoji: '🛒' },
  { id: 'territory', label: '领地', emoji: '🏰' },
  { id: 'worldbook', label: '世界书', emoji: '📖' },
  { id: 'achievements', label: '成就', emoji: '🏆' },
  { id: 'relations', label: '关系', emoji: '🤝' },
];

/**
 * v4.2.0: 悬浮式垂直圆钮组 — 不再占据底部高度、不遮挡对话框。
 * v5.1.0 (移动端): 默认收起为单个 📁 FAB；点击展开底部横滑按钮条（输入区上方），
 * 选后/点遮罩/Esc 自动收起 —— 不再遮挡对话选项区与输入区。桌面端行为完全不变。
 */
export function GamePanelBar({ activePanel, onToggle }: GamePanelBarProps): React.ReactElement {
  const [isMobile, setIsMobile] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // v5.1.0: Escape 关闭展开态
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const handleClick = (id: NonNullable<PanelId>) => {
    onToggle(id);
    // 点击后收起（移动端）
    if (isMobile) setExpanded(false);
  };

  const buttonStyle = (btn: PanelButton, isActive: boolean): React.CSSProperties => ({
    width: isMobile ? 52 : 56,
    height: isMobile ? 52 : 56,
    borderRadius: '50%',
    border: isActive ? '2.5px solid #C9A94E' : '1px solid rgba(201,169,78,0.3)',
    background: isActive ? 'rgba(201,169,78,0.18)' : 'rgba(30,27,24,0.82)',
    color: isActive ? '#C9A94E' : '#A09888',
    fontSize: isMobile ? '0.6875rem' : '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.125rem',
    transition: 'all 0.2s ease',
    boxShadow: isActive
      ? '0 0 14px rgba(201,169,78,0.25)'
      : '0 3px 8px rgba(0,0,0,0.45)',
    backdropFilter: 'blur(8px)',
    flexShrink: 0,
  });

  const activeBtn = BUTTONS.find((b) => b.id === activePanel);

  // ── 移动端展开态：遮罩 + 底部横滑按钮条（遮罩在 Fragment 外层，避开容器 backdropFilter 的 fixed 锚定）──
  if (isMobile && expanded) {
    return (
      <>
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 41, background: 'rgba(0,0,0,0.35)' }}
          onClick={() => setExpanded(false)}
          aria-hidden
        />
        <div
          style={{
            position: 'fixed',
            left: 8, right: 8,
            // 输入区之上（输入区高约 64px），不遮挡输入；留出 iOS 安全区
            bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
            zIndex: 42,
          }}
          role="toolbar"
          aria-label="游戏功能面板"
        >
          <div style={{
            display: 'flex', flexDirection: 'row', gap: '0.5rem', padding: '0.5rem',
            borderRadius: 14, background: 'rgba(13,13,18,0.94)',
            border: '1px solid rgba(201,169,78,0.22)',
            boxShadow: '0 6px 28px rgba(0,0,0,0.55)',
            backdropFilter: 'blur(12px)',
            overflowX: 'auto', maxWidth: '100%',
          }}>
            {BUTTONS.map((btn) => {
              const isActive = activePanel === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => handleClick(btn.id)}
                  style={buttonStyle(btn, isActive)}
                  aria-label={btn.label}
                  aria-pressed={isActive}
                  title={btn.label}
                >
                  <span style={{ fontSize: '1.375rem', lineHeight: 1 }}>{btn.emoji}</span>
                  <span style={{ lineHeight: 1 }}>{btn.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  // ── 移动端收起态：单个 📁 FAB（含当前激活面板角标）／桌面端：垂直圆钮组 ──
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'row' : 'column',
        gap: '0.5rem',
        padding: '0.5rem',
        borderRadius: isMobile ? 14 : 18,
        background: 'rgba(13,13,18,0.88)',
        border: '1px solid rgba(201,169,78,0.22)',
        boxShadow: '0 6px 28px rgba(0,0,0,0.55)',
        backdropFilter: 'blur(12px)',
        maxWidth: isMobile ? '100%' : undefined,
        overflowX: isMobile ? 'auto' : 'visible',
        overflowY: isMobile ? 'visible' : 'auto',
        maxHeight: isMobile ? undefined : '72vh',
      }}
      role="toolbar"
      aria-label="游戏功能面板"
    >
      {/* v5.1.0 移动端收起态 FAB */}
      {isMobile && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          title="打开功能面板"
          aria-label="打开功能面板"
          style={{
            ...buttonStyle(activeBtn ?? BUTTONS[0]!, Boolean(activeBtn)),
            position: 'relative',
          }}
        >
          <span style={{ fontSize: '1.375rem', lineHeight: 1 }}>📁</span>
          <span style={{ lineHeight: 1, fontSize: '0.625rem' }}>{activeBtn?.emoji ?? '菜单'}</span>
          {activeBtn && (
            <span style={{
              position: 'absolute', top: 2, right: 2, width: 9, height: 9,
              borderRadius: '50%', background: '#C9A94E',
            }} />
          )}
        </button>
      )}

      {/* 展开/收起（桌面端） */}
      {!isMobile && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? '收起面板' : '展开面板'}
          aria-label={expanded ? '收起面板' : '展开面板'}
          style={{
            ...buttonStyle({ id: 'character', label: '', emoji: expanded ? '◀' : '▶' } as PanelButton, false),
            width: 40, height: 40, fontSize: '0.875rem',
          }}
        >
          {expanded ? '▶' : '◀'}
        </button>
      )}

      {!isMobile && BUTTONS.map((btn) => {
        const isActive = activePanel === btn.id;
        // 桌面折叠态只显示图标
        if (!isMobile && !expanded && !isActive) {
          return (
            <button
              key={btn.id}
              type="button"
              onClick={() => handleClick(btn.id)}
              style={buttonStyle(btn, isActive)}
              aria-label={btn.label}
              title={btn.label}
            >
              <span style={{ fontSize: '1.375rem', lineHeight: 1 }}>{btn.emoji}</span>
            </button>
          );
        }
        return (
          <button
            key={btn.id}
            type="button"
            onClick={() => handleClick(btn.id)}
            style={buttonStyle(btn, isActive)}
            aria-label={btn.label}
            aria-pressed={isActive}
            title={btn.label}
          >
            <span style={{ fontSize: '1.375rem', lineHeight: 1 }}>{btn.emoji}</span>
            <span style={{ lineHeight: 1 }}>{btn.label}</span>
          </button>
        );
      })}
    </div>
  );
}
