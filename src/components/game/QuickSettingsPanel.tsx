/**
 * QuickSettingsPanel — AI Narrator Game
 *
 * 游戏内快速设置面板。点击齿轮图标展开，提供：
 * - 音效开关
 * - 文字显示速度调整
 * - 自动保存间隔设置
 * - 主题亮度调节
 *
 * 持久化到 localStorage (key: ai-narrator-quick-settings)。
 *
 * @module components/game/QuickSettingsPanel
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
// v5.1.0 (移动端): 齿轮触控区适配
import { useIsMobile } from '@/hooks/useMediaQuery';

// ============================================================
// Types
// ============================================================

export interface QuickSettings {
  soundEnabled: boolean;
  textSpeed: number;       // 1-5 (slow → fast)
  autoSaveInterval: number; // 分钟, 0 = 禁用
  brightness: number;       // 50-100
}

const DEFAULT_SETTINGS: QuickSettings = {
  soundEnabled: true,
  textSpeed: 3,
  autoSaveInterval: 10,
  brightness: 80,
};

const LS_KEY = 'ai-narrator-quick-settings';

// ============================================================
// Helpers
// ============================================================

function loadSettings(): QuickSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s: QuickSettings): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}

// ============================================================
// Styles
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const S: Record<string, any> = {
  gearBtn: {
    position: 'fixed',
    top: '16px',
    right: '16px',
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    background: 'rgba(30, 27, 24, 0.85)',
    border: '1px solid rgba(201, 169, 78, 0.2)',
    color: '#C9A94E',
    fontSize: '1.25rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    // v5.0.0 (需求1 修复): zIndex 1000 → 90，低于面板遮罩(100)/关闭按钮(102) —
    // 此前齿轮浮在面板之上且与右上角关闭按钮重叠，导致关闭按钮无法点击
    zIndex: 90,
    transition: 'background 0.2s, opacity 0.2s',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 1001,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    background: '#1A1714',
    border: '1px solid #2A2520',
    borderRadius: '12px',
    padding: '1.5rem',
    minWidth: '340px',
    maxWidth: '90vw',
    color: '#E8E0D5',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#C9A94E',
    marginBottom: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.625rem 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  label: {
    fontSize: '0.9375rem',
    color: '#C0B8A8',
  },
  toggle: (on: boolean): React.CSSProperties => ({
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    background: on ? '#C9A94E' : '#3A3530',
    position: 'relative',
    cursor: 'pointer',
    border: 'none',
    transition: 'background 0.2s',
  }),
  toggleKnob: (on: boolean): React.CSSProperties => ({
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: '#1A1714',
    position: 'absolute',
    top: '2px',
    left: on ? '22px' : '2px',
    transition: 'left 0.2s',
  }),
  slider: {
    width: '120px',
    accentColor: '#C9A94E',
  },
  select: {
    background: '#2A2520',
    border: '1px solid #3A3530',
    color: '#E8E0D5',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '0.875rem',
    minWidth: '100px',
  },
  closeBtn: {
    marginTop: '1.25rem',
    width: '100%',
    padding: '0.625rem',
    background: '#2A2520',
    border: '1px solid #3A3530',
    borderRadius: '8px',
    color: '#C0B8A8',
    fontSize: '0.9375rem',
    cursor: 'pointer',
  },
};

// ============================================================
// Component
// ============================================================

interface QuickSettingsPanelProps {
  /** 设置变更回调 */
  onChange?: (settings: QuickSettings) => void;
  /** v5.0.0 (需求1 修复): 侧边面板打开时隐藏齿轮 — 避免与面板关闭按钮重叠/遮挡 */
  hidden?: boolean;
}

export function QuickSettingsPanel({ onChange, hidden }: QuickSettingsPanelProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<QuickSettings>(loadSettings);
  // v5.1.0 (移动端): 齿轮放大到 44px 触控区、内收至 12px
  const isMobile = useIsMobile();

  // v5.0.0: 面板打开时自动收起设置弹层
  useEffect(() => {
    if (hidden) setOpen(false);
  }, [hidden]);

  // 同步初始设置
  useEffect(() => {
    onChange?.(settings);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback(
    (patch: Partial<QuickSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        saveSettings(next);
        onChange?.(next);
        return next;
      });
    },
    [onChange]
  );

  const toggle = useCallback(() => setOpen((o) => !o), []);

  return (
    <>
      {/* 齿轮按钮（面板打开时隐藏，避免遮挡关闭按钮） */}
      <button
        style={{
          ...S.gearBtn,
          display: hidden ? 'none' : 'flex',
          // v5.1.0 (移动端): 44×44 触控区、top/right 12（顶栏已留 56px 让位）
          ...(isMobile ? { width: 44, height: 44, top: 12, right: 12, fontSize: '1.375rem' } : {}),
        }}
        onClick={toggle}
        title="游戏设置"
        aria-label="打开游戏设置"
      >
        &#9881;
      </button>

      {/* 设置面板 */}
      {open && (
        <div style={S.overlay} onClick={toggle}>
          <div style={S.panel} onClick={(e) => e.stopPropagation()}>
            <div style={S.title}>
              &#9881; 游戏设置
            </div>

            {/* 音效开关 */}
            <div style={S.row}>
              <span style={S.label}>音效</span>
              <button
                style={S.toggle(settings.soundEnabled)}
                onClick={() => update({ soundEnabled: !settings.soundEnabled })}
                aria-label={settings.soundEnabled ? '关闭音效' : '开启音效'}
              >
                <span style={S.toggleKnob(settings.soundEnabled)} />
              </button>
            </div>

            {/* 文字速度 */}
            <div style={S.row}>
              <span style={S.label}>文字速度</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#6B6358' }}>慢</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={settings.textSpeed}
                  style={S.slider}
                  onChange={(e) => update({ textSpeed: Number(e.target.value) })}
                />
                <span style={{ fontSize: '0.75rem', color: '#6B6358' }}>快</span>
              </div>
            </div>

            {/* 自动保存 */}
            <div style={S.row}>
              <span style={S.label}>自动保存</span>
              <select
                style={S.select}
                value={settings.autoSaveInterval}
                onChange={(e) => update({ autoSaveInterval: Number(e.target.value) })}
              >
                <option value={0}>禁用</option>
                <option value={5}>每 5 分钟</option>
                <option value={10}>每 10 分钟</option>
                <option value={15}>每 15 分钟</option>
                <option value={30}>每 30 分钟</option>
              </select>
            </div>

            {/* 亮度 */}
            <div style={S.row}>
              <span style={S.label}>界面亮度</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#6B6358' }}>暗</span>
                <input
                  type="range"
                  min={50}
                  max={100}
                  step={5}
                  value={settings.brightness}
                  style={S.slider}
                  onChange={(e) => update({ brightness: Number(e.target.value) })}
                />
                <span style={{ fontSize: '0.75rem', color: '#6B6358' }}>亮</span>
              </div>
            </div>

            <button style={S.closeBtn} onClick={toggle}>
              关闭
            </button>
          </div>
        </div>
      )}
    </>
  );
}
