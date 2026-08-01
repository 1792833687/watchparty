'use client';

/**
 * Error Boundary — 页面级错误处理
 *
 * 当页面渲染出错时显示友好的错误界面，
 * 并提供重试按钮。
 */

import { useEffect } from 'react';
import Link from 'next/link';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps): React.ReactElement {
  useEffect(() => {
    console.error('[ErrorBoundary] Page error:', error);
  }, [error]);

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        background: 'var(--bg-deep)',
        color: 'var(--text-primary)',
        gap: '1.5rem',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '3rem' }}>⚠️</div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-gold)' }}>
        出错了
      </h1>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '32rem', lineHeight: 1.7 }}>
        {error.message || '页面发生了意外错误。请尝试刷新或返回首页。'}
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={reset}
          style={{
            padding: '0.625rem 1.5rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: 'var(--accent-gold)',
            color: 'var(--bg-deep)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9375rem',
          }}
        >
          重试
        </button>
        <Link
          href="/"
          style={{
            padding: '0.625rem 1.5rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-panel)',
            color: 'var(--text-primary)',
            fontWeight: 500,
            cursor: 'pointer',
            fontSize: '0.9375rem',
            textDecoration: 'none',
          }}
        >
          返回首页
        </Link>
      </div>
    </main>
  );
}
