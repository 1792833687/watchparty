/**
 * Setup Page — When user already has API Key
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { withBase } from '@/lib/utils/base-path';

export default function SetupPage(): React.ReactElement {
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    try {
      const k = localStorage.getItem('ai-narrator-openrouter-api-key');
      if (k) setApiKey(k);
    } catch {}
  }, []);

  const start = useCallback(() => {
    router.push('/game/new');
  }, [router]);

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D12', color: '#E8E0D5', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <h1 style={{ fontSize: '1.5rem', color: '#C9A94E', textAlign: 'center' }}>🦊 冒险准备就绪</h1>
      <p style={{ color: '#A09888', marginBottom: '2rem', textAlign: 'center' }}>
        API Key 已配置：{apiKey ? apiKey.slice(0, 12) + '...' : '未检测到'}
        <br /><a href={withBase('/settings')} style={{ color: '#7B6FDF' }}>重新配置</a>
      </p>
      <button
        onClick={start}
        style={{ padding: '1rem 3rem', borderRadius: 12, border: 'none', background: '#C9A94E', color: '#0D0D12', fontWeight: 700, fontSize: '1.125rem', cursor: 'pointer' }}
      >⚔️ 开始冒险</button>
    </div>
  );
}
