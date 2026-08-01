/**
 * TopBar — 顶栏 — Story 5.5
 *
 * @description
 * 56px高度顶栏，包含：
 *   Logo + 游戏名称
 *   AI状态指示器：空闲○/思考◌/说话◎/警告⬤
 *   快捷图标：设置⚙、存档📦
 *
 * @see design/art-bible.md §5.1 (布局), §8.4 (AI状态指示器)
 * @see design/ux-spec.md §5 (游戏主界面)
 * @see design/accessibility-requirements.md §2.3 (屏幕阅读器)
 */

'use client';

import React from 'react';
import { Settings, Save, Compass } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';
import { useWorldStore } from '@/stores/world-store';
import { useDialogueStore } from '@/stores/dialogue-store';
import { AIAvatar } from '@/components/common/AIAvatar';

// ============================================================
// 类型
// ============================================================

export interface TopBarProps {
  /** 存档回调 */
  onSave?: () => void;
  /** 设置回调 */
  onSettings?: () => void;
}

// ============================================================
// AI 状态指示器
// ============================================================

const AIStatusIndicator: React.FC<{
  state: ReturnType<typeof useUIStore.getState>['aiAvatarState'];
}> = ({ state }) => {
  const config: Record<string, { char: string; color: string; label: string; animation?: string }> = {
    idle: {
      char: '●',
      color: 'var(--accent-magic)',
      label: 'AI 空闲',
    },
    thinking: {
      char: '◌',
      color: 'var(--accent-magic)',
      label: 'AI 思考中',
      animation: 'ai-dot-rotate 1.5s linear infinite',
    },
    speaking: {
      char: '◎',
      color: 'var(--accent-magic-glow)',
      label: 'AI 叙述中',
      animation: 'ai-dot-pulse 2s ease-in-out infinite',
    },
    warning: {
      char: '⬤',
      color: 'var(--accent-danger)',
      label: 'AI 警告',
      animation: 'ai-dot-pulse 0.8s ease-in-out infinite',
    },
  };

  const c = config[state]!;

  return (
    <span
      role="status"
      aria-label={c.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          fontSize: state === 'thinking' ? '1rem' : '0.6rem',
          color: c.color,
          animation: c.animation,
        }}
      >
        {c.char}
      </span>
      <span className="topbar__ai-label">{c.label}</span>
    </span>
  );
};

// ============================================================
// 图标按钮
// ============================================================

const IconButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    aria-label={label}
    title={label}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 36,
      height: 36,
      background: 'transparent',
      border: 'none',
      borderRadius: 8,
      color: 'var(--text-secondary)',
      cursor: 'pointer',
      transition: 'background 150ms ease, color 150ms ease',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'var(--bg-input)';
      e.currentTarget.style.color = 'var(--text-primary)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.color = 'var(--text-secondary)';
    }}
  >
    {icon}
  </button>
);

// ============================================================
// TopBar 组件
// ============================================================

export const TopBar: React.FC<TopBarProps> = ({ onSave, onSettings }) => {
  const aiAvatarState = useUIStore((s) => s.aiAvatarState);
  const gameSetting = useWorldStore((s) => s.gameSetting);
  const playerName = useWorldStore((s) => s.playerName);

  const gameTitle = gameSetting?.worldMeta?.name ?? 'AI Narrator Game';
  const displayName = playerName || '冒险者';

  return (
    <header
      className="topbar"
      role="banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 'var(--topbar-height)',
        padding: '0 16px',
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border-subtle)',
        zIndex: 50,
        position: 'relative',
      }}
    >
      {/* ── 左侧: Logo + 游戏名 ── */}
      <div
        className="topbar__left"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 0,
        }}
      >
        <Compass
          size={24}
          color="var(--accent-magic)"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        />
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {gameTitle}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {displayName}
          </p>
        </div>
      </div>

      {/* ── 中间: AI 状态 ── */}
      <div
        className="topbar__center"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <AIStatusIndicator state={aiAvatarState} />
        <AIAvatar level={1} state={aiAvatarState} name="GM" size={28} />
      </div>

      {/* ── 右侧: 快捷操作 + AI头像 ── */}
      <div
        className="topbar__right"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <IconButton
          icon={<Save size={18} />}
          label="存档 (Ctrl+S)"
          onClick={onSave}
        />
        <IconButton
          icon={<Settings size={18} />}
          label="设置"
          onClick={onSettings}
        />

        {/* AI 头像 (Level 2 mini) */}
        <div style={{ marginLeft: 8 }}>
          <AIAvatar
            level={2}
            state={aiAvatarState}
            name="GM"
            size={32}
          />
        </div>
      </div>
    </header>
  );
};
