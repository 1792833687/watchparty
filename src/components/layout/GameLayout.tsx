'use client';

/**
 * GameLayout — Game Console Frame (v4.2.0)
 *
 * v4.2.0 重构：
 * - 左侧栏改为「动态新闻推送」容器（worldFeed，见 NewsFeed）
 * - 响应式布局：移动端（<900px）自动折叠左侧栏、底栏变悬浮抽屉
 * - 底栏不再独占高度，改为悬浮于主内容底部，不遮挡对话框
 */

import React, { useEffect, useState } from 'react';
// v5.0.0 (需求2): assistant 消息内容按「」/引号区分对话与旁白
import { NarrativeRenderer } from '@/components/game/NarrativeRenderer';
// v5.1.0 (移动端): 小屏断点（气泡全宽）
import { useIsXs } from '@/hooks/useMediaQuery';
// v5.1.0 技术美术：统一走 tokens.ts（单一事实源），bgDeep 对齐 #0D0D12
import { C } from '@/theme/tokens';

// ============================================================
// Design Tokens — fixed proportions, no fluid units
// ============================================================

const TOKENS = {
  bgDeep: C.bgDeep,
  bgFrame: '#121117',
  bgPanel: C.bgPanel,
  bgCard: C.bgCard,
  gold: C.gold,
  goldDim: C.border,
  textPrimary: C.text,
  textSecondary: C.textDim,
  textMuted: C.textMuted,
  borderSubtle: '#2A272C',
  borderActive: C.gold,
  accentPurple: C.magic,
  accentDanger: C.darkAccent,
  accentOk: C.ok,

  consoleMaxWidth: 1280,
  sidebarWidth: 216,
  topBarHeight: 48,
  mobileBreakpoint: 900,
};

// ============================================================
// Components
// ============================================================

export interface GameLayoutProps {
  topBar: React.ReactNode;
  /** 左侧新闻推送内容（worldFeed） */
  sidebar: React.ReactNode;
  /** 主内容（chat messages + input） */
  children: React.ReactNode;
  /** 底部悬浮操作栏（panel buttons） */
  bottomBar: React.ReactNode;
  /** 移动端侧栏开关（是否展开） */
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function GameLayout({
  topBar,
  sidebar,
  children,
  bottomBar,
  sidebarOpen = false,
  onToggleSidebar,
}: GameLayoutProps): React.ReactElement {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${TOKENS.mobileBreakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: TOKENS.bgDeep,
      backgroundImage: `
        radial-gradient(ellipse at 50% 30%, ${TOKENS.goldDim} 0%, transparent 70%),
        radial-gradient(ellipse at 80% 80%, rgba(123,111,223,0.06) 0%, transparent 50%)
      `,
      fontFamily: "'Noto Sans SC', 'Inter', system-ui, sans-serif",
      userSelect: 'none',
    }}>
      <div style={{
        width: '100%',
        maxWidth: TOKENS.consoleMaxWidth,
        // v5.1.0 (移动端): var(--app-height) = 100dvh fallback，移动浏览器地址栏收展不溢出
        height: 'var(--app-height)',
        maxHeight: 'var(--app-height)',
        display: 'flex',
        flexDirection: 'column',
        background: TOKENS.bgFrame,
        borderLeft: `1px solid ${TOKENS.borderSubtle}`,
        borderRight: `1px solid ${TOKENS.borderSubtle}`,
        boxShadow: `0 0 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02)`,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Decorative top border */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, transparent, ${TOKENS.gold}, transparent)`,
          opacity: 0.4, zIndex: 1,
        }} />

        {/* ── Top Bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', height: TOKENS.topBarHeight,
          // v5.1.0 (移动端): paddingRight 56px 给右上角设置齿轮让位，防重叠
          padding: isMobile ? '0 56px 0 0.75rem' : '0 1rem', background: TOKENS.bgPanel,
          borderBottom: `1px solid ${TOKENS.borderSubtle}`, flexShrink: 0, zIndex: 2,
        }}>
          {topBar}
        </div>

        {/* ── Main Content Row ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {/* Left Sidebar — 新闻推送（桌面端常驻，移动端抽屉） */}
          <div style={{
            width: isMobile ? (sidebarOpen ? '100%' : 0) : TOKENS.sidebarWidth,
            flexShrink: 0,
            background: TOKENS.bgPanel,
            borderRight: `1px solid ${TOKENS.borderSubtle}`,
            overflow: 'hidden',
            transition: 'width 0.3s ease',
            position: isMobile && sidebarOpen ? 'absolute' as const : 'relative' as const,
            left: 0, top: 0, bottom: 0,
            zIndex: isMobile && sidebarOpen ? 30 : 1,
            display: 'flex', flexDirection: 'column',
          }}>
            {isMobile && sidebarOpen && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                padding: '0.5rem 0.75rem', flexShrink: 0,
              }}>
                <button
                  type="button"
                  onClick={onToggleSidebar}
                  aria-label="关闭信息栏"
                  style={{
                    width: 30, height: 30, borderRadius: '50%',
                    border: `1px solid ${TOKENS.borderSubtle}`, background: TOKENS.bgCard,
                    color: TOKENS.textSecondary, cursor: 'pointer', fontSize: '0.875rem',
                  }}
                >
                  ✕
                </button>
              </div>
            )}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
              {sidebar}
            </div>
          </div>

          {/* 移动端遮罩 */}
          {isMobile && sidebarOpen && (
            <div
              onClick={onToggleSidebar}
              style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
                zIndex: 29, cursor: 'pointer',
              }}
              aria-hidden
            />
          )}

          {/* Center — Chat Area */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
            overflow: 'hidden', background: TOKENS.bgDeep,
          }}>
            {children}
          </div>
        </div>

        {/* ── 悬浮底栏（不再独占高度，绝对定位悬浮） ── */}
        <div style={{
          position: 'absolute', bottom: isMobile ? 8 : 12, right: isMobile ? 8 : 16,
          zIndex: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          pointerEvents: 'none',
        }}>
          <div style={{ pointerEvents: 'auto' }}>{bottomBar}</div>
        </div>

        {/* Decorative bottom border */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, transparent, ${TOKENS.gold}, transparent)`,
          opacity: 0.3, zIndex: 1,
        }} />
      </div>
    </div>
  );
}

// ============================================================
// News Feed — 动态新闻推送（官方新闻 / 小道消息）
// ============================================================

export interface NewsItem {
  id: string;
  /** 类型：官方公报 / 战场快讯 / 市井流言 / 神秘预言 */
  type: 'official' | 'war' | 'rumor' | 'prophecy' | 'quest';
  title: string;
  body: string;
  /** 时间标签（第 N 天） */
  day?: number;
  /** 是否已读（高亮区分） */
  read?: boolean;
}

const NEWS_TYPE_META: Record<NewsItem['type'], { label: string; color: string; icon: string }> = {
  official: { label: '官方公报', color: '#C9A94E', icon: '📜' },
  war: { label: '战场快讯', color: '#E53E3E', icon: '⚔️' },
  rumor: { label: '市井流言', color: '#7B6FDF', icon: '🗣️' },
  prophecy: { label: '神秘预言', color: '#A864C0', icon: '🔮' },
  quest: { label: '悬赏告示', color: '#5A9E6F', icon: '📌' },
};

export interface NewsFeedProps {
  items: NewsItem[];
  characterName?: string;
  characterClass?: string;
  level?: number;
  worldName?: string;
  onToggleSidebar?: () => void;
  /** 点击未读条目标记已读 */
  onMarkRead?: (id: string) => void;
}

/** 左侧信息栏 — 新闻推送 + 角色速览头部 */
export function NewsFeed({
  items = [],
  characterName = '无名领主',
  characterClass = '冒险者',
  level = 1,
  worldName = '凛冬要塞',
  onToggleSidebar,
  onMarkRead,
}: NewsFeedProps): React.ReactElement {
  const unreadCount = items.filter((i) => !i.read).length;

  return (
    <>
      {/* 角色速览头部 */}
      <div style={{ textAlign: 'center', marginBottom: '0.625rem' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto',
          background: `radial-gradient(circle at 40% 35%, ${TOKENS.goldDim}, ${TOKENS.bgCard})`,
          border: `2px solid ${TOKENS.gold}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
        }}>
          🦊
        </div>
        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: TOKENS.textPrimary, marginTop: '0.375rem', fontFamily: "'Cinzel','Georgia','Noto Serif SC',serif" }}>
          {characterName}
        </div>
        <div style={{ fontSize: '0.625rem', color: TOKENS.gold, marginTop: '0.125rem' }}>
          {characterClass} · Lv.{level}
        </div>
      </div>

      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${TOKENS.gold}, transparent)`, opacity: 0.3, margin: '0.375rem 0' }} />

      {/* 新闻标题栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '0.5rem',
      }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: TOKENS.gold, letterSpacing: '0.1em' }}>
          📰 大陆快讯
        </span>
        {unreadCount > 0 && (
          <span style={{
            fontSize: '0.5625rem', color: TOKENS.gold, background: 'rgba(201,169,78,0.15)',
            borderRadius: 999, padding: '1px 7px', fontWeight: 700,
          }}>
            {unreadCount} 条新
          </span>
        )}
      </div>

      {/* 新闻列表 */}
      {items.length === 0 ? (
        <div style={{
          textAlign: 'center', color: TOKENS.textMuted, fontSize: '0.6875rem',
          padding: '1rem 0.5rem', lineHeight: 1.7,
          border: '1px dashed ' + TOKENS.borderSubtle, borderRadius: 8,
        }}>
          暂无情报。<br />随着冒险推进，<br />这里会更新大陆新闻与流言。
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {items.map((item) => {
            const meta = NEWS_TYPE_META[item.type] ?? NEWS_TYPE_META.rumor;
            const isUnread = !item.read;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onMarkRead?.(item.id)}
                style={{
                  textAlign: 'left', cursor: 'pointer', padding: 0, border: 'none', background: 'transparent',
                  fontFamily: 'inherit',
                }}
              >
                {/* v5.1.0 技术美术：已读卡片套 .panel-card 材质（渐变边框/光泽线/噪点/hover 悬浮）；未读保留金色高亮底 */}
                <div
                  className={isUnread ? undefined : 'panel-card'}
                  style={{
                    padding: '0.5rem 0.625rem',
                    borderRadius: isUnread ? 8 : undefined,
                    background: isUnread ? 'rgba(201,169,78,0.07)' : undefined,
                    border: isUnread ? `1px solid ${meta.color}55` : undefined,
                    transition: 'all 0.2s ease',
                    position: 'relative',
                  }}
                >
                  {isUnread && (
                    <span style={{
                      position: 'absolute', top: 6, right: 6,
                      width: 6, height: 6, borderRadius: '50%', background: meta.color,
                    }} />
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem' }}>{meta.icon}</span>
                    <span style={{
                      fontSize: '0.5625rem', fontWeight: 700, color: meta.color,
                      border: `1px solid ${meta.color}44`, borderRadius: 4, padding: '0 4px',
                    }}>
                      {meta.label}
                    </span>
                    {item.day !== undefined && (
                      <span style={{ fontSize: '0.5625rem', color: TOKENS.textMuted, marginLeft: 'auto' }}>
                        第{item.day}日
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: isUnread ? TOKENS.textPrimary : TOKENS.textSecondary, lineHeight: 1.4 }}>
                    {item.title}
                  </div>
                  <div style={{
                    fontSize: '0.625rem', color: TOKENS.textMuted, lineHeight: 1.6, marginTop: '0.125rem',
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {item.body}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 移动端关闭按钮 */}
      {onToggleSidebar && (
        <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
          <button
            type="button"
            onClick={onToggleSidebar}
            style={{
              fontSize: '0.625rem', color: TOKENS.textSecondary,
              background: 'transparent', border: `1px solid ${TOKENS.borderSubtle}`,
              borderRadius: 999, padding: '0.25rem 0.875rem', cursor: 'pointer',
            }}
          >
            ← 返回冒险
          </button>
        </div>
      )}
    </>
  );
}

// ============================================================
// Message Bubble — refined typography
// ============================================================

interface MessageBubbleLayoutProps {
  role: 'user' | 'assistant' | 'system' | 'narrator';
  content: string;
}

export function MessageBubbleLayout({ role, content }: MessageBubbleLayoutProps): React.ReactElement {
  // v5.1.0 (移动端): ≤480px 时气泡全宽，最大化文字可读性（桌面保持比例）
  const isXs = useIsXs();
  if (role === 'narrator') {
    return (
      <div style={{
        alignSelf: 'center', maxWidth: isXs ? '100%' : '85%',
        padding: '1rem 1.5rem', borderRadius: 4,
        borderLeft: `3px solid ${TOKENS.gold}`,
        background: TOKENS.bgCard,
        color: TOKENS.textPrimary,
        fontFamily: "'Cinzel','Georgia','Noto Serif SC',serif",
        fontSize: '0.9375rem', lineHeight: 1.9,
        fontStyle: 'italic', textAlign: 'center',
      }}>
        <div style={{ fontSize: '0.625rem', fontWeight: 600, color: TOKENS.gold, marginBottom: '0.5rem', fontStyle: 'normal', letterSpacing: '0.1em' }}>
          旁白
        </div>
        {content}
      </div>
    );
  }

  if (role === 'system') {
    return (
      <div style={{
        alignSelf: 'center', maxWidth: isXs ? '100%' : '80%',
        padding: '0.375rem 1rem', borderRadius: 4,
        background: TOKENS.bgCard,
        color: TOKENS.textMuted, fontSize: '0.75rem',
        textAlign: 'center', fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      }}>
        {content}
      </div>
    );
  }

  const isUser = role === 'user';

  return (
    <div style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      // v5.1.0 (移动端): ≤480px 气泡全宽；桌面 78%
      maxWidth: isXs ? '100%' : '78%',
      padding: '0.625rem 1rem',
      borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
      background: isUser ? TOKENS.accentPurple : TOKENS.bgCard,
      color: TOKENS.textPrimary,
      fontSize: '0.875rem', lineHeight: 1.7,
      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      boxShadow: isUser ? '0 2px 8px rgba(123,111,223,0.2)' : '0 1px 4px rgba(0,0,0,0.3)',
    }}>
      {!isUser && (
        <div style={{ fontSize: '0.625rem', fontWeight: 600, color: TOKENS.gold, marginBottom: '0.25rem', letterSpacing: '0.05em' }}>
          🦊 主持
        </div>
      )}
      {/* v5.0.0 (需求2): 内容级区分 — 「」内为角色对话（金色标签块），其余为旁白（默认色） */}
      {isUser ? content : <NarrativeRenderer content={content} />}
    </div>
  );
}

export { TOKENS };
