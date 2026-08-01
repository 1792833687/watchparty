/**
 * AIAvatar — AI头像组件 — v0.2.0 重写
 *
 * @description
 * 去除 SVG path（v0.1.0 的 SVG path 注释导致浏览器崩溃）。
 * 改用 emoji 🦊 + 纯 CSS 圆形背景，稳定可靠。
 *
 * 三层呈现体系：
 *   Level 1: 仅边界色指示
 *   Level 2: 圆形头像(48px) + 名称标签（默认）
 *   Level 3: 全息模式(72px) + 光环 + 光晕
 *
 * 状态驱动动画：说话脉动 / 思考旋转 / 空闲呼吸
 * prefers-reduced-motion 降级为静态光晕
 */

'use client';

import React from 'react';
import type { AIAvatarState } from '@/stores/ui-store';

// ============================================================
// 类型
// ============================================================

export interface AIAvatarProps {
  /** 呈现级别 (默认 Level 2) */
  level?: 1 | 2 | 3;
  /** AI 当前状态 */
  state?: AIAvatarState;
  /** AI 名称 */
  name?: string;
  /** 头像尺寸 (Level 2 默认 48, Level 3 默认 72) */
  size?: number;
  /** 额外的 className */
  className?: string;
}

// ============================================================
// 组件
// ============================================================

export const AIAvatar: React.FC<AIAvatarProps> = ({
  level = 2,
  state = 'idle',
  name = 'AI GM',
  size,
  className,
}) => {
  const avatarSize = size ?? (level === 3 ? 72 : 48);
  const fontSize = avatarSize * 0.55;

  // ── Level 1: 仅边界色指示 ──
  if (level === 1) {
    return (
      <span
        role="status"
        aria-label={`AI ${name}: ${state}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
        className={className}
      >
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: 'var(--accent-magic)',
            boxShadow: '0 0 8px var(--accent-magic-glow)',
            animation: getDotAnimation(state),
          }}
        />
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            fontWeight: 500,
          }}
        >
          {name}
        </span>
      </span>
    );
  }

  // ── 共享的头像圆形 ──
  const avatarCircle = (
    <div
      style={{
        width: avatarSize,
        height: avatarSize,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, var(--accent-magic), var(--accent-magic-glow))',
        boxShadow: '0 0 12px var(--accent-magic-glow)',
        fontSize,
        lineHeight: 1,
        animation: getAvatarAnimation(state),
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      <span role="img" aria-label="fox">
        🦊
      </span>
    </div>
  );

  // ── Level 3: 全息模式 ──
  if (level === 3) {
    return (
      <div
        role="status"
        aria-label={`AI ${name}: ${state}`}
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          position: 'relative',
        }}
        className={className}
      >
        {/* 粒子光晕 */}
        <div
          style={{
            position: 'absolute',
            width: avatarSize + 20,
            height: avatarSize + 20,
            borderRadius: '50%',
            border: '2px solid var(--accent-magic)',
            opacity: 0.4,
            animation: getHoloAnimation(state),
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: avatarSize + 36,
            height: avatarSize + 36,
            borderRadius: '50%',
            border: '1px solid var(--accent-magic-glow)',
            opacity: 0.2,
            animation: getHoloAnimation(state),
            animationDelay: '0.3s',
          }}
        />

        {avatarCircle}

        <span
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {name}
        </span>
      </div>
    );
  }

  // ── Level 2: 默认头像模式 ──
  return (
    <div
      role="status"
      aria-label={`AI ${name}: ${state}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
      }}
      className={className}
    >
      {avatarCircle}

      <span
        style={{
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          fontWeight: 500,
        }}
      >
        {name}
      </span>
    </div>
  );
};

// ============================================================
// 动画辅助
// ============================================================

function getDotAnimation(state: AIAvatarState): string {
  switch (state) {
    case 'thinking':
      return 'ai-dot-rotate 1.5s linear infinite';
    case 'speaking':
      return 'ai-dot-pulse 2s ease-in-out infinite';
    case 'warning':
      return 'ai-dot-pulse 0.8s ease-in-out infinite';
    default:
      return 'ai-dot-breathe 4s ease-in-out infinite';
  }
}

function getAvatarAnimation(state: AIAvatarState): string {
  switch (state) {
    case 'thinking':
      return 'ai-avatar-spin 3s linear infinite';
    case 'speaking':
      return 'ai-avatar-pulse 2s ease-in-out infinite';
    case 'warning':
      return 'ai-avatar-pulse 0.8s ease-in-out infinite';
    default:
      return 'ai-avatar-breathe 4s ease-in-out infinite';
  }
}

function getHoloAnimation(state: AIAvatarState): string {
  switch (state) {
    case 'thinking':
      return 'ai-holo-rotate 3s linear infinite';
    case 'speaking':
      return 'ai-holo-pulse 2s ease-in-out infinite';
    case 'warning':
      return 'ai-holo-pulse 0.8s ease-in-out infinite';
    default:
      return 'ai-holo-breathe 4s ease-in-out infinite';
  }
}
