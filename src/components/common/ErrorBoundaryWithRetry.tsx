/**
 * ErrorBoundaryWithRetry — AI Narrator Game
 *
 * React Error Boundary + API 重试组件。
 * 捕获子组件渲染错误，显示友好错误提示。
 * 提供自动重试（最多 2 次，指数退避）和手动重试按钮。
 *
 * @module components/common/ErrorBoundaryWithRetry
 */

'use client';

import React from 'react';

// ============================================================
// Types
// ============================================================

interface Props {
  children: React.ReactNode;
  /** 自定义 fallback UI（可选） */
  fallback?: React.ReactNode;
  /** 错误恢复回调 */
  onRetry?: () => void;
  /** 是否使用紧凑模式（内联而非全屏） */
  compact?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

// ============================================================
// Styles
// ============================================================

const S: Record<string, React.CSSProperties> = {
  container: {
    padding: '1.5rem',
    background: '#1A1714',
    border: '1px solid #3A3530',
    borderRadius: '12px',
    textAlign: 'center',
    color: '#E8E0D5',
  },
  containerCompact: {
    padding: '0.75rem',
    background: '#1A1714',
    border: '1px solid #3A3530',
    borderRadius: '8px',
    textAlign: 'center',
    color: '#E8E0D5',
  },
  icon: {
    fontSize: '2rem',
    marginBottom: '0.5rem',
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: '#C9A94E',
    marginBottom: '0.5rem',
  },
  message: {
    fontSize: '0.875rem',
    color: '#9B9188',
    marginBottom: '1rem',
    lineHeight: 1.5,
  },
  messageCompact: {
    fontSize: '0.8125rem',
    color: '#9B9188',
    marginBottom: '0.5rem',
  },
  retryBtn: {
    padding: '0.5rem 1.25rem',
    background: '#C9A94E',
    color: '#0D0D12',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  retryBtnCompact: {
    padding: '0.375rem 0.875rem',
    background: '#C9A94E',
    color: '#0D0D12',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  retryInfo: {
    fontSize: '0.75rem',
    color: '#6B6358',
    marginTop: '0.5rem',
  },
  details: {
    fontSize: '0.75rem',
    color: '#6B6358',
    marginTop: '0.5rem',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
    maxHeight: '80px',
    overflow: 'auto',
  },
};

// ============================================================
// Component
// ============================================================

const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 3000]; // 1s, 3s 指数退避

export class ErrorBoundaryWithRetry extends React.Component<Props, State> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  componentWillUnmount(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
  }

  handleRetry = (): void => {
    const { retryCount } = this.state;

    if (retryCount >= MAX_RETRIES) {
      // 超过最大重试次数，直接重置（可能导致再次崩溃，但至少给了用户选择）
      this.setState({ hasError: false, error: null, retryCount: 0 });
      this.props.onRetry?.();
      return;
    }

    // 指数退避延迟后重试
    const delay = RETRY_DELAYS[retryCount];
    this.retryTimer = setTimeout(() => {
      this.setState({ hasError: false, error: null, retryCount: retryCount + 1 });
      this.props.onRetry?.();
    }, delay);
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // 自定义 fallback
    if (this.props.fallback) {
      return this.props.fallback;
    }

    const { compact } = this.props;
    const { retryCount } = this.state;

    return (
      <div style={compact ? S.containerCompact : S.container}>
        <div style={S.icon}>&#9888;</div>
        <div style={S.title}>出错了</div>
        <div style={compact ? S.messageCompact : S.message}>
          AI 响应异常，请稍后重试。
        </div>
        <button
          style={compact ? S.retryBtnCompact : S.retryBtn}
          onClick={this.handleRetry}
        >
          {retryCount >= MAX_RETRIES
            ? '最后尝试'
            : retryCount > 0
            ? `正在重试 (${retryCount}/${MAX_RETRIES})...`
            : '重试'}
        </button>
        {retryCount > 0 && retryCount < MAX_RETRIES && (
          <div style={S.retryInfo}>
            自动重试 {retryCount}/{MAX_RETRIES}，请稍候...
          </div>
        )}
        {this.state.error && (
          <details style={S.details}>
            <summary>错误详情</summary>
            {this.state.error.message}
          </details>
        )}
      </div>
    );
  }
}

/**
 * API 重试 Hook — 适用于非渲染错误的 API 调用重试。
 *
 * @param maxRetries - 最大重试次数（默认 2）
 * @param baseDelay - 基础延迟毫秒（默认 1000）
 */
export function useApiRetry(maxRetries: number = 2, baseDelay: number = 1000) {
  const [retryCount, setRetryCount] = React.useState(0);
  const [isRetrying, setIsRetrying] = React.useState(false);

  const executeWithRetry = React.useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      let lastError: unknown;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            setIsRetrying(true);
            setRetryCount(attempt);
            // 指数退避
            await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, attempt - 1)));
          }
          const result = await fn();
          setIsRetrying(false);
          setRetryCount(0);
          return result;
        } catch (err) {
          lastError = err;
          if (attempt === maxRetries) {
            setIsRetrying(false);
            setRetryCount(0);
            throw err;
          }
        }
      }

      throw lastError;
    },
    [maxRetries, baseDelay]
  );

  return { executeWithRetry, retryCount, isRetrying };
}
