/**
 * v5.1.0 响应式断点 hook — 移动端布局优化基建
 * - useIsMobile(): ≤900px 主断点（抽屉/全屏面板/顶栏精简/FAB）
 * - useIsXs(): ≤480px 小屏细分（气泡全宽/.hide-xs）
 *
 * SSR 安全：初始 false，useEffect 后根据 matchMedia 校正，避免 hydration 闪烁。
 */
'use client';

import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/** ≤900px：移动端主断点 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 900px)');
}

/** ≤480px：小屏细分断点 */
export function useIsXs(): boolean {
  return useMediaQuery('(max-width: 480px)');
}
