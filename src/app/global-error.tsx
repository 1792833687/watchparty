'use client';

/**
 * Global Error Boundary — 根布局级错误处理
 *
 * 当根布局渲染出错时显示。必须包含 <html> 和 <body> 标签。
 */

import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps): React.ReactElement {
  useEffect(() => {
    console.error('[GlobalError] Root layout error:', error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          padding: 0,
          background: '#0D0D12',
          color: '#E8E0D5',
          fontFamily: '-apple-system, sans-serif',
        }}
      >
        <main
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            gap: '1.5rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '4rem' }}>🔥</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#C9A94E' }}>
            应用崩溃
          </h1>
          <p style={{ color: '#A09888', maxWidth: '32rem', lineHeight: 1.7 }}>
            {error.message || 'AI Narrator Game 遇到了严重错误。'}
          </p>
          <button
            onClick={reset}
            style={{
              padding: '0.75rem 2rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: '#C9A94E',
              color: '#0D0D12',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            重新加载
          </button>
        </main>
      </body>
    </html>
  );
}
