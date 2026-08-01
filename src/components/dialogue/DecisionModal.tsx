/**
 * DecisionModal — 决策面板 — Story 5.3
 *
 * @description
 * 全屏Modal，三色场景类型：
 *   golden_choice: 金色边框 + 🛡️图标
 *   danger_zone: 红色边框 + ⚔️图标
 *   magic_moment: 紫色边框 + ✦图标
 * 2-5个预设选项卡片 + "其他选择…"自由输入
 * 确认前二次确认（重要抉择）
 * Escape微震提示（不可跳过=支柱IV）
 * 出场动画：滑入300ms
 *
 * @see design/art-bible.md §6.5 (Modal)
 * @see design/ux-spec.md §7 (关键抉择面板)
 * @see design/accessibility-requirements.md §2.1 (色盲三通道)
 */

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X, Shield, Swords, Sparkles } from 'lucide-react';
import { useDialogueStore } from '@/stores/dialogue-store';
import type { DecisionNode, DecisionOption } from '@/stores/dialogue-store';

// ============================================================
// 类型
// ============================================================

export interface DecisionModalProps {
  /** 决策节点 (null = 不显示) */
  decision: DecisionNode | null;
  /** 关闭回调 */
  onClose?: () => void;
}

// ============================================================
// 场景类型配置
// ============================================================

interface SceneConfig {
  icon: React.ReactNode;
  borderColor: string;
  glowColor: string;
  label: string;
  animation: string;
}

const SCENE_CONFIGS = {
  golden: {
    icon: <Shield size={20} />,
    borderColor: 'var(--accent-gold)',
    glowColor: 'rgba(201, 169, 78, 0.3)',
    label: '关键时刻',
    animation: 'ai-dot-pulse 3s ease-in-out infinite',
  },
  danger: {
    icon: <Swords size={20} />,
    borderColor: 'var(--accent-danger)',
    glowColor: 'rgba(200, 85, 84, 0.3)',
    label: '危险抉择',
    animation: 'ai-dot-pulse 1s ease-in-out infinite',
  },
  magic: {
    icon: <Sparkles size={20} />,
    borderColor: 'var(--accent-magic)',
    glowColor: 'rgba(123, 111, 223, 0.3)',
    label: '神秘时刻',
    animation: 'ai-dot-pulse 2s ease-in-out infinite',
  },
};

// ============================================================
// 选项卡片
// ============================================================

const OptionCard: React.FC<{
  option: DecisionOption;
  sceneType: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
}> = ({ option, sceneType, isSelected, onSelect }) => {
  const config = SCENE_CONFIGS[sceneType as keyof typeof SCENE_CONFIGS] ?? SCENE_CONFIGS.golden;

  return (
    <button
      role="option"
      aria-selected={isSelected}
      onClick={() => onSelect(option.id)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        width: '100%',
        padding: '14px 18px',
        background: isSelected
          ? 'var(--bg-input)'
          : 'var(--bg-panel)',
        border: `1px solid ${
          isSelected ? config.borderColor : 'var(--border-subtle)'
        }`,
        borderLeft: `3px solid ${config.borderColor}`,
        borderRadius: 10,
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 200ms ease',
        transform: isSelected ? 'translateX(4px)' : 'translateX(0)',
        boxShadow: isSelected
          ? `0 0 16px ${config.glowColor}`
          : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'var(--bg-input)';
          e.currentTarget.style.borderColor = config.borderColor;
          e.currentTarget.style.transform = 'translateX(4px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'var(--bg-panel)';
          e.currentTarget.style.borderColor = 'var(--border-subtle)';
          e.currentTarget.style.transform = 'translateX(0)';
        }
      }}
    >
      {/* 图标 */}
      <span
        style={{
          color: config.borderColor,
          flexShrink: 0,
          marginTop: 2,
        }}
        aria-hidden="true"
      >
        {config.icon}
      </span>

      {/* 内容 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: '0.9375rem',
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}
        >
          {option.text}
        </div>
        {option.predictedConsequence && (
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              lineHeight: 1.4,
            }}
          >
            {option.predictedConsequence}
          </div>
        )}
      </div>
    </button>
  );
};

// ============================================================
// 二次确认 Modal
// ============================================================

const ConfirmDialog: React.FC<{
  optionText: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ optionText, onConfirm, onCancel }) => (
  <div
    className="decision-confirm-overlay"
    style={{
      position: 'absolute',
      inset: 0,
      background: 'var(--overlay-modal)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
      borderRadius: 16,
    }}
  >
    <div
      className="decision-confirm-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-label="确认选择"
      style={{
        background: 'var(--bg-panel-raised)',
        border: '1px solid var(--border-active)',
        borderRadius: 12,
        padding: '24px 28px',
        maxWidth: 360,
        textAlign: 'center',
        animation: 'modal-slide-up 200ms ease-out',
      }}
    >
      <h3
        style={{
          margin: '0 0 8px',
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}
      >
        确认你的选择
      </h3>
      <p
        style={{
          margin: '0 0 20px',
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}
      >
        &ldquo;{optionText}&rdquo;
      </p>
      <p
        style={{
          margin: '0 0 20px',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
        }}
      >
        此选择将影响故事走向，确认后不可撤销。
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 20px',
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            color: 'var(--text-secondary)',
            fontSize: '0.8125rem',
            cursor: 'pointer',
          }}
        >
          再想想
        </button>
        <button
          onClick={onConfirm}
          style={{
            padding: '8px 20px',
            background: 'var(--accent-gold)',
            border: 'none',
            borderRadius: 8,
            color: 'var(--bg-deep)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          确认选择
        </button>
      </div>
    </div>
  </div>
);

// ============================================================
// DecisionModal 组件
// ============================================================

export const DecisionModal: React.FC<DecisionModalProps> = ({
  decision,
  onClose,
}) => {
  const selectDecisionOption = useDialogueStore((s) => s.selectDecisionOption);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [shake, setShake] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // 自动聚焦 Modal
  useEffect(() => {
    if (decision && modalRef.current) {
      modalRef.current.focus();
    }
  }, [decision]);

  // Escape 微震
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShake(true);
        setTimeout(() => setShake(false), 300);
      }
    },
    []
  );

  if (!decision) return null;

  const sceneType = decision.sceneType || 'golden';
  const config = SCENE_CONFIGS[sceneType as keyof typeof SCENE_CONFIGS] ?? SCENE_CONFIGS.golden;
  const options = decision.options ?? [];

  const handleOptionSelect = (optionId: string) => {
    setSelectedOptionId(optionId);
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (!selectedOptionId) return;
    setShowConfirm(false);
    await selectDecisionOption(selectedOptionId);
    setSelectedOptionId(null);
    onClose?.();
  };

  const handleCancelConfirm = () => {
    setShowConfirm(false);
    setSelectedOptionId(null);
  };

  const handleCustomSubmit = () => {
    const text = customInput.trim();
    if (!text) return;
    // 通过 selectDecisionOption 发送自定义文本
    selectDecisionOption(text);
    setCustomInput('');
    setShowCustomInput(false);
    onClose?.();
  };

  const selectedOption = options.find((o) => o.id === selectedOptionId);

  return (
    <div
      className="decision-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${config.label}: ${decision.promptText}`}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay-modal)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        animation: 'fade-in 200ms ease-out',
      }}
    >
      <div
        ref={modalRef}
        className="decision-modal"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        style={{
          position: 'relative',
          width: 'min(560px, 90vw)',
          maxHeight: '85vh',
          overflowY: 'auto',
          background: 'var(--bg-panel-raised)',
          border: `2px solid ${config.borderColor}`,
          borderRadius: 16,
          boxShadow: `0 0 40px ${config.glowColor}, 0 8px 48px var(--shadow-panel)`,
          animation: `${shake ? 'shake' : 'modal-slide-up'} 300ms ease-out`,
        }}
      >
        {/* ── 标题栏 ── */}
        <div
          className="decision-modal__header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              style={{
                color: config.borderColor,
                animation: config.animation,
              }}
              aria-hidden="true"
            >
              {config.icon}
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: '1.0625rem',
                fontWeight: 600,
                color: config.borderColor,
              }}
            >
              {config.label}
            </h2>
          </div>

          {/* 不可关闭 — 但显示X表示Escape会震动 */}
          <span
            style={{
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
            }}
          >
            不可跳过
          </span>
        </div>

        {/* ── 叙述文本 ── */}
        <div
          className="decision-modal__narrative"
          style={{
            padding: '16px 20px',
            fontSize: '1rem',
            lineHeight: 1.7,
            color: 'var(--text-narrative)',
            fontFamily: 'var(--font-narrative)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {decision.narrativeContext || decision.promptText}
        </div>

        {/* ── 选项列表 ── */}
        <div
          className="decision-modal__options"
          role="listbox"
          aria-label="抉择选项"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '16px 20px',
          }}
        >
          {options.map((option) => (
            <OptionCard
              key={option.id}
              option={option}
              sceneType={sceneType}
              isSelected={selectedOptionId === option.id}
              onSelect={handleOptionSelect}
            />
          ))}

          {/* 其他选择… */}
          {!showCustomInput ? (
            <button
              onClick={() => setShowCustomInput(true)}
              style={{
                padding: '12px 18px',
                background: 'transparent',
                border: '1px dashed var(--border-subtle)',
                borderRadius: 10,
                color: 'var(--text-secondary)',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--text-muted)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              ✏️ 其他选择…（自由输入）
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="输入你的选择…"
                rows={2}
                autoFocus
                style={{
                  padding: '10px 14px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  fontFamily: 'var(--font-ui)',
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowCustomInput(false)}
                  style={{
                    padding: '6px 14px',
                    background: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  取消
                </button>
                <button
                  onClick={handleCustomSubmit}
                  disabled={!customInput.trim()}
                  style={{
                    padding: '6px 14px',
                    background: customInput.trim()
                      ? 'var(--accent-magic)'
                      : 'var(--bg-input)',
                    border: 'none',
                    borderRadius: 6,
                    color: customInput.trim() ? '#FFFFFF' : 'var(--text-muted)',
                    fontSize: '0.75rem',
                    cursor: customInput.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  确认
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 底部提示 ── */}
        <div
          style={{
            padding: '10px 20px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.6875rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          此选择不可撤销，请谨慎抉择
        </div>

        {/* ── 二次确认层 ── */}
        {showConfirm && selectedOption && (
          <ConfirmDialog
            optionText={selectedOption.text}
            onConfirm={handleConfirm}
            onCancel={handleCancelConfirm}
          />
        )}
      </div>
    </div>
  );
};
