/**
 * Toast — 通知组件 — Story 5.7
 *
 * @description
 * 4种类型：success/error/warning/info
 * 自动消失3s，Escape可提前关闭，最多堆叠3个
 *
 * @see design/ux-spec.md §9 (错误与异常流程)
 * @see src/stores/ui-store.ts (Toast接口)
 */

'use client';

import React, { useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { Toast as ToastData } from '@/stores/ui-store';
import { useUIStore } from '@/stores/ui-store';

// ============================================================
// 类型
// ============================================================

export interface ToastContainerProps {
  /** 最大显示数量 (默认 3) */
  maxToasts?: number;
}

// ============================================================
// 图标映射
// ============================================================

const TOAST_ICONS: Record<ToastData['type'], React.ReactNode> = {
  success: <CheckCircle size={18} />,
  error: <AlertCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
};

const TOAST_COLORS: Record<ToastData['type'], { border: string; bg: string; icon: string }> = {
  success: {
    border: 'var(--accent-success)',
    bg: 'rgba(90, 158, 111, 0.12)',
    icon: 'var(--accent-success)',
  },
  error: {
    border: 'var(--accent-danger)',
    bg: 'rgba(200, 85, 84, 0.12)',
    icon: 'var(--accent-danger)',
  },
  warning: {
    border: 'var(--accent-gold)',
    bg: 'rgba(201, 169, 78, 0.12)',
    icon: 'var(--accent-gold)',
  },
  info: {
    border: 'var(--accent-info)',
    bg: 'rgba(91, 140, 190, 0.12)',
    icon: 'var(--accent-info)',
  },
};

// ============================================================
// 单个 Toast
// ============================================================

const ToastItem: React.FC<{
  toast: ToastData;
  onDismiss: (id: string) => void;
}> = ({ toast, onDismiss }) => {
  const colors = TOAST_COLORS[toast.type];

  // 自动消失
  useEffect(() => {
    if (toast.durationMs <= 0) return;
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, onDismiss]);

  const handleDismiss = useCallback(() => {
    onDismiss(toast.id);
  }, [toast.id, onDismiss]);

  return (
    <div
      className="toast-item"
      role="alert"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 14px',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderLeft: `3px solid ${colors.border}`,
        borderRadius: 8,
        boxShadow: '0 4px 16px var(--shadow-panel)',
        backdropFilter: 'blur(8px)',
        minWidth: 280,
        maxWidth: 420,
        animation: 'toast-slide-in 200ms ease-out',
        pointerEvents: 'auto',
      }}
    >
      {/* 图标 */}
      <span
        style={{
          color: colors.icon,
          flexShrink: 0,
          marginTop: 1,
        }}
        aria-hidden="true"
      >
        {TOAST_ICONS[toast.type]}
      </span>

      {/* 内容 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && (
          <div
            style={{
              fontWeight: 600,
              fontSize: '0.875rem',
              color: 'var(--text-primary)',
              marginBottom: 2,
            }}
          >
            {toast.title}
          </div>
        )}
        <div
          style={{
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.4,
          }}
        >
          {toast.message}
        </div>
      </div>

      {/* 关闭按钮 */}
      <button
        onClick={handleDismiss}
        aria-label="关闭通知"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: 2,
          flexShrink: 0,
          borderRadius: 4,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
};

// ============================================================
// Toast 容器
// ============================================================

export const ToastContainer: React.FC<ToastContainerProps> = ({
  maxToasts = 3,
}) => {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  // Escape 关闭全部
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && toasts.length > 0) {
        // 关闭最早的 toast
        const oldest = toasts[0];
        if (oldest) removeToast(oldest.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toasts, removeToast]);

  const visibleToasts = toasts.slice(0, maxToasts);

  if (visibleToasts.length === 0) return null;

  return (
    <div
      className="toast-container"
      aria-label="通知区域"
      style={{
        position: 'fixed',
        top: 'calc(var(--topbar-height) + 12px)',
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {visibleToasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>
  );
};

// ============================================================
// 辅助 — 创建 Toast
// ============================================================

let toastCounter = 0;

export function createToast(
  type: ToastData['type'],
  title: string,
  message: string,
  durationMs = 3000
): ToastData {
  toastCounter += 1;
  return {
    id: `toast-${Date.now()}-${toastCounter}`,
    type,
    title,
    message,
    durationMs,
    createdAt: Date.now(),
  };
}
