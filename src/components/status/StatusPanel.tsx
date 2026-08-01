/**
 * StatusPanel — 状态栏 — Story 5.4
 *
 * @description
 * HP/MP条形图（颜色+数字+长度三通道=色盲友好）
 * 属性列表（力量/敏捷/智力等）
 * 背包预览（最近5件物品）
 * 快捷操作：存档(Ctrl+S)、日志、设置
 * 空状态占位
 *
 * @see design/art-bible.md §5.1 (布局), §9.3 (色盲友���)
 * @see design/ux-spec.md §6.3 (状态反馈)
 * @see design/accessibility-requirements.md §2.4 (色盲三通道)
 */

'use client';

import React from 'react';
import {
  Heart,
  Zap,
  Swords,
  Eye,
  Brain,
  Gem,
  Save,
  BookOpen,
  Settings,
  Package,
} from 'lucide-react';
import { useWorldStore } from '@/stores/world-store';

// ============================================================
// 类型
// ============================================================

export interface StatusPanelProps {
  /** 存档回调 */
  onSave?: () => void;
  /** 日志回调 */
  onJournal?: () => void;
  /** 设置回调 */
  onSettings?: () => void;
}

// ============================================================
// 属性条
// ============================================================

interface StatBarProps {
  label: string;
  icon: React.ReactNode;
  current: number;
  max: number;
  color: string;
  /** 用于色盲友好的额外标识 */
  symbol: string;
}

const StatBar: React.FC<StatBarProps> = ({
  label,
  icon,
  current,
  max,
  color,
  symbol,
}) => {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0;

  return (
    <div className="status-statbar" aria-label={`${label}: ${current}/${max}`}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ color }} aria-hidden="true">
            {icon}
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {label}
          </span>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {/* 色盲通道1: 数字 */}
          {current}/{max}
        </span>
      </div>

      {/* 色盲通道2+3: 颜色条 + 长度 */}
      <div
        style={{
          height: 8,
          background: 'var(--bg-input)',
          borderRadius: 4,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: color,
            borderRadius: 4,
            transition: 'width 400ms ease-out',
            position: 'relative',
          }}
        >
          {/* 色盲通道: 内部符号标识 */}
          <span
            style={{
              position: 'absolute',
              right: 4,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 8,
              color: 'var(--bg-deep)',
              fontWeight: 700,
              lineHeight: 1,
            }}
            aria-hidden="true"
          >
            {pct < 20 ? '!' : pct < 50 ? symbol : ''}
          </span>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 属性行
// ============================================================

const AttributeRow: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
}> = ({ label, value, icon }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '4px 0',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        {label}
      </span>
    </div>
    <span
      style={{
        fontSize: '0.875rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {value}
    </span>
  </div>
);

// ============================================================
// StatusPanel 组件
// ============================================================

export const StatusPanel: React.FC<StatusPanelProps> = ({
  onSave,
  onJournal,
  onSettings,
}) => {
  const playerName = useWorldStore((s) => s.playerName);
  const playerClass = useWorldStore((s) => s.playerClass);
  const attributes = useWorldStore((s) => s.playerAttributes);

  // 从属性中获取 HP/MP，或使用默认 mock 数据
  const hp = attributes['hp'] ?? 80;
  const maxHp = attributes['maxHp'] ?? 100;
  const mp = attributes['mp'] ?? 60;
  const maxMp = attributes['maxMp'] ?? 100;
  const stamina = attributes['stamina'] ?? 85;
  const maxStamina = attributes['maxStamina'] ?? 100;

  const mainAttrs: { key: string; label: string; icon: React.ReactNode }[] = [
    { key: 'strength', label: '力量', icon: <Swords size={14} /> },
    { key: 'dexterity', label: '敏捷', icon: <Eye size={14} /> },
    { key: 'intelligence', label: '智力', icon: <Brain size={14} /> },
    { key: 'perception', label: '感知', icon: <Eye size={14} /> },
    { key: 'charisma', label: '魅力', icon: <Gem size={14} /> },
  ];

  const isEmpty = !playerName;

  return (
    <div
      className="status-panel"
      id="status-panel"
      role="complementary"
      aria-label="状态面板"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--panel-radius)',
        overflow: 'hidden',
      }}
    >
      {/* ── 角色信息 ── */}
      <div
        className="status-panel__header"
        style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {isEmpty ? (
          <div
            style={{
              textAlign: 'center',
              padding: '20px 0',
              color: 'var(--text-muted)',
              fontSize: '0.8125rem',
            }}
          >
            等待角色创建…
          </div>
        ) : (
          <>
            <h3
              style={{
                margin: '0 0 2px',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {playerName}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: '0.75rem',
                color: 'var(--accent-gold)',
              }}
            >
              {playerClass}
            </p>
          </>
        )}
      </div>

      {/* ── 可滚动内容 ── */}
      <div
        className="status-panel__content"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* ── HP / MP / 体力 ── */}
        <section aria-label="生命与魔法">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <StatBar
              label="HP"
              icon={<Heart size={14} />}
              current={hp}
              max={maxHp}
              color="var(--accent-danger)"
              symbol="♥"
            />
            <StatBar
              label="MP"
              icon={<Zap size={14} />}
              current={mp}
              max={maxMp}
              color="var(--accent-info)"
              symbol="♦"
            />
            <StatBar
              label="体力"
              icon={<Swords size={14} />}
              current={stamina}
              max={maxStamina}
              color="var(--accent-success)"
              symbol="●"
            />
          </div>
        </section>

        {/* ── 属性 ── */}
        <section aria-label="角色属性">
          <h4
            style={{
              margin: '0 0 6px',
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            属性
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {mainAttrs.map((attr) => (
              <AttributeRow
                key={attr.key}
                label={attr.label}
                value={attributes[attr.key] ?? 10}
                icon={attr.icon}
              />
            ))}
          </div>
        </section>

        {/* ── 背包预览 ── */}
        <section aria-label="背包预览">
          <h4
            style={{
              margin: '0 0 6px',
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            背包
          </h4>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {isEmpty ? (
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  fontStyle: 'italic',
                }}
              >
                背包为空
              </span>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  background: 'var(--bg-input)',
                  borderRadius: 6,
                }}
              >
                <Package size={14} color="var(--text-muted)" />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  等待物品数据…
                </span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── 快捷操作 ── */}
      <div
        className="status-panel__actions"
        style={{
          display: 'flex',
          gap: 4,
          padding: '10px 16px',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <button
          onClick={onSave}
          aria-label="存档 (Ctrl+S)"
          title="存档 (Ctrl+S)"
          style={quickActionStyle}
        >
          <Save size={14} />
          <span style={{ fontSize: '0.6875rem' }}>存档</span>
        </button>
        <button
          onClick={onJournal}
          aria-label="冒险日志"
          title="冒险日志"
          style={quickActionStyle}
        >
          <BookOpen size={14} />
          <span style={{ fontSize: '0.6875rem' }}>日志</span>
        </button>
        <button
          onClick={onSettings}
          aria-label="设置"
          title="设置"
          style={quickActionStyle}
        >
          <Settings size={14} />
          <span style={{ fontSize: '0.6875rem' }}>设置</span>
        </button>
      </div>
    </div>
  );
};

// ============================================================
// 样式常量
// ============================================================

const quickActionStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  padding: '6px 8px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'background 150ms ease, color 150ms ease',
};
