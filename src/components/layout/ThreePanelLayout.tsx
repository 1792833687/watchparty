/**
 * ThreePanelLayout — 三面板布局 — Story 5.1
 *
 * @description
 * 响应式三面板布局：360px地图 | flex对话 | 300px状态栏。
 * 断点策略：
 *   ≥1280px — 三面板完整布局
 *   ≥1024px — 三面板(地图可折叠)
 *   ≥768px  — 两面板(地图可折叠, 对话+状态上下)
 *   ≥600px  — 单面板全屏切换
 *   <600px  — 单面板 + 底部 TabBar
 *
 * @see design/art-bible.md §5 (布局系统)
 * @see design/ux-spec.md §10 (响应式降级)
 * @see design/accessibility-requirements.md (键盘导航, ARIA)
 */

'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Map, MessageCircle, ClipboardList } from 'lucide-react';

// ============================================================
// 类型
// ============================================================

export interface ThreePanelLayoutProps {
  /** 地图面板 */
  mapPanel: React.ReactNode;
  /** 对话面板 */
  dialoguePanel: React.ReactNode;
  /** 状态栏面板 */
  statusPanel: React.ReactNode;
  /** 默认激活面板 (移动端) */
  defaultMobilePanel?: PanelType;
  /** 是否强制隐藏地图 (特殊模式) */
  forceHideMap?: boolean;
}

export type PanelType = 'map' | 'dialogue' | 'status';

// ============================================================
// 断点常量
// ============================================================

const BREAKPOINTS = {
  DESKTOP: 1280,
  DESKTOP_SMALL: 1024,
  TABLET: 768,
  MOBILE: 600,
} as const;

// ============================================================
// 组件
// ============================================================

export const ThreePanelLayout: React.FC<ThreePanelLayoutProps> = ({
  mapPanel,
  dialoguePanel,
  statusPanel,
  defaultMobilePanel = 'dialogue',
  forceHideMap = false,
}) => {
  // ── 状态 ──
  const [mapCollapsed, setMapCollapsed] = useState(false);
  const [statusCollapsed, setStatusCollapsed] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<PanelType>(defaultMobilePanel);
  const [viewportWidth, setViewportWidth] = useState(1440);

  // ── 响应式断点 ──
  const isDesktopSmall = viewportWidth >= BREAKPOINTS.DESKTOP_SMALL;
  const isTablet = viewportWidth >= BREAKPOINTS.TABLET;
  const isMobile = viewportWidth < BREAKPOINTS.MOBILE;

  // ── 视口宽度监听 ──
  useEffect(() => {
    setViewportWidth(window.innerWidth);
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── 自动折叠 (200% 缩放适配) ──
  useEffect(() => {
    if (viewportWidth < 800 && viewportWidth > 0) {
      setMapCollapsed(true);
      setStatusCollapsed(true);
    }
  }, [viewportWidth]);

  // ── 地图折叠/展开 ──
  const toggleMap = useCallback(() => {
    setMapCollapsed((prev) => !prev);
  }, []);

  // ── 状态栏折叠/展开 ──
  const toggleStatus = useCallback(() => {
    setStatusCollapsed((prev) => !prev);
  }, []);

  // ── TabBar 渲染 ──
  const tabBar = useMemo((): React.ReactNode => {
    const tabs: { type: PanelType; label: string; icon: React.ReactNode }[] = [
      { type: 'map', label: '地图', icon: <Map size={20} /> },
      { type: 'dialogue', label: '对��', icon: <MessageCircle size={20} /> },
      { type: 'status', label: '状态', icon: <ClipboardList size={20} /> },
    ];

    return (
      <nav
        className="mobile-tabbar"
        role="tablist"
        aria-label="面板切换"
        style={{
          display: 'flex',
          height: 48,
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-panel)',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.type}
            role="tab"
            aria-selected={mobilePanel === tab.type}
            aria-label={tab.label}
            onClick={() => setMobilePanel(tab.type)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              background: 'transparent',
              border: 'none',
              color:
                mobilePanel === tab.type
                  ? 'var(--accent-gold)'
                  : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: mobilePanel === tab.type ? 600 : 400,
              padding: '4px 0',
              transition: 'color 200ms ease-out',
              borderTop:
                mobilePanel === tab.type
                  ? '2px solid var(--accent-gold)'
                  : '2px solid transparent',
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    );
  }, [mobilePanel]);

  // ── 单面板模式 (<768px) ──
  if (!isTablet) {
    return (
      <div
        className="three-panel-layout three-panel-layout--mobile"
        role="region"
        aria-label="游戏主界面"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - var(--topbar-height))',
          overflow: 'hidden',
        }}
      >
        {/* 面板内容区域 */}
        <div
          className="mobile-panel-container"
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* 地图面板 */}
          <div
            role="tabpanel"
            aria-label="地图面板"
            hidden={mobilePanel !== 'map'}
            style={{ height: '100%', overflow: 'hidden' }}
          >
            {mapPanel}
          </div>

          {/* 对话面板 */}
          <div
            role="tabpanel"
            aria-label="对话面板"
            hidden={mobilePanel !== 'dialogue'}
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {dialoguePanel}
          </div>

          {/* 状态面板 */}
          <div
            role="tabpanel"
            aria-label="状态面板"
            hidden={mobilePanel !== 'status'}
            style={{ height: '100%', overflow: 'hidden' }}
          >
            {statusPanel}
          </div>
        </div>

        {/* TabBar */}
        {isMobile && tabBar}
      </div>
    );
  }

  // ── 两面板 / 三面板模式 ──
  const showMap = !mapCollapsed && !forceHideMap;
  const showStatus = !statusCollapsed && isDesktopSmall;

  return (
    <div
      className="three-panel-layout"
      role="region"
      aria-label="游戏主界面"
      style={{
        display: 'flex',
        height: 'calc(100vh - var(--topbar-height))',
        overflow: 'hidden',
        gap: isDesktopSmall ? 'var(--panel-gap)' : 0,
        padding: isDesktopSmall ? 'var(--panel-gap)' : 0,
        background: 'var(--bg-deep)',
        position: 'relative',
      }}
    >
      {/* ── 地图面板 ── */}
      <div
        className="layout-panel--map"
        role="complementary"
        aria-label="地图面板"
        style={{
          width: showMap ? 'var(--map-width)' : 0,
          minWidth: showMap ? 'var(--map-width)' : 0,
          overflow: 'hidden',
          transition: 'width 200ms ease-out, min-width 200ms ease-out',
          borderRadius: isDesktopSmall ? 'var(--panel-radius)' : 0,
        }}
      >
        {showMap && mapPanel}
      </div>

      {/* ── 地图折叠按钮 ── */}
      <button
        className="map-collapse-toggle"
        onClick={toggleMap}
        aria-label={mapCollapsed ? '展开地图' : '折叠地图'}
        style={{
          position: 'absolute',
          left: mapCollapsed ? 8 : 'calc(var(--map-width) + var(--panel-gap) - 16px)',
          top: '50%',
          transform: 'translateY(-50%)',
          width: 20,
          height: 48,
          background: 'var(--bg-panel-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '0 4px 4px 0',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          zIndex: 40,
          transition: 'left 200ms ease-out',
        }}
      >
        {mapCollapsed ? '▶' : '◀'}
      </button>

      {/* ── 对话面板 (主区域) ── */}
      <div
        className="layout-panel--dialogue"
        role="main"
        aria-label="对话区域"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
          borderRadius: isDesktopSmall ? 'var(--panel-radius)' : 0,
        }}
      >
        {dialoguePanel}
      </div>

      {/* ── 状态栏 ── */}
      <div
        className="layout-panel--status"
        role="complementary"
        aria-label="状态面板"
        style={{
          width: showStatus ? 'var(--status-width)' : 0,
          minWidth: showStatus ? 'var(--status-width)' : 0,
          overflow: 'hidden',
          transition: 'width 200ms ease-out, min-width 200ms ease-out',
          borderRadius: isDesktopSmall ? 'var(--panel-radius)' : 0,
        }}
      >
        {showStatus && statusPanel}
      </div>
    </div>
  );
};
