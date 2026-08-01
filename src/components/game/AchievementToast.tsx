'use client';

/**
 * AchievementToast — AI Narrator Game v1.0.0
 *
 * Slides in from top when an achievement is unlocked.
 * Gold border, auto-dismiss after 3s.
 */

import React, { useEffect, useState, useCallback } from 'react';

// ============================================================
// Types
// ============================================================

export interface AchievementToastData {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  reward: string;
}

// ============================================================
// Styles
// ============================================================

const S = {
  container: {
    position: 'fixed' as const,
    top: 16,
    left: '50%',
    transform: 'translateX(-50%) translateY(-120px)',
    zIndex: 9999,
    transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
    pointerEvents: 'none' as const,
  },
  visible: {
    transform: 'translateX(-50%) translateY(0)',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1.25rem',
    background: 'linear-gradient(135deg, #1A181C 0%, #211F24 100%)',
    border: '2px solid #C9A94E',
    borderRadius: 8,
    boxShadow: '0 4px 24px rgba(201,169,78,0.3), 0 0 60px rgba(201,169,78,0.1)',
    minWidth: 280,
    maxWidth: 400,
    fontFamily: "'Noto Sans SC','Inter',system-ui,sans-serif",
  },
  icon: {
    fontSize: '2rem',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    marginBottom: '0.125rem',
  },
  badge: {
    fontSize: '0.5625rem',
    fontWeight: 700,
    color: '#C9A94E',
    background: 'rgba(201,169,78,0.15)',
    padding: '0.125rem 0.375rem',
    borderRadius: 3,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  name: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: '#C9A94E',
  },
  description: {
    fontSize: '0.6875rem',
    color: '#A09888',
    marginBottom: '0.125rem',
    lineHeight: 1.4,
  },
  reward: {
    fontSize: '0.625rem',
    color: '#5A9E6F',
    fontWeight: 600,
  },
} as const;

// ============================================================
// Component
// ============================================================

export interface AchievementToastProps {
  achievement: AchievementToastData | null;
  onDismiss: () => void;
}

export function AchievementToast({ achievement, onDismiss }: AchievementToastProps): React.ReactElement | null {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (achievement) {
      // Trigger animation
      requestAnimationFrame(() => setVisible(true));

      // Auto-dismiss after 3s
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 500); // Wait for animation
      }, 3000);

      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
    return;
  }, [achievement, onDismiss]);

  if (!achievement) return null;

  const categoryLabel = getCategoryLabel(achievement.category);

  return (
    <div style={{ ...S.container, ...(visible ? S.visible : {}) }}>
      <div style={S.card}>
        <div style={S.icon}>{achievement.icon}</div>
        <div style={S.content}>
          <div style={S.header}>
            <span style={S.badge}>{categoryLabel}</span>
            <span style={S.name}>{achievement.name}</span>
          </div>
          <div style={S.description}>{achievement.description}</div>
          <div style={S.reward}>{achievement.reward}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Toast Manager
// ============================================================

export interface AchievementToastManager {
  current: AchievementToastData | null;
  queue: AchievementToastData[];
  show: (achievement: AchievementToastData) => void;
}

/**
 * Create a toast manager hook for managing achievement notifications.
 */
export function useAchievementToasts(): AchievementToastManager {
  const [current, setCurrent] = useState<AchievementToastData | null>(null);
  const [queue, setQueue] = useState<AchievementToastData[]>([]);

  const show = useCallback((achievement: AchievementToastData) => {
    setQueue(prev => [...prev, achievement]);
  }, []);

  // Process queue whenever current is dismissed
  useEffect(() => {
    if (!current && queue.length > 0) {
      const [next, ...rest] = queue;
      if (next) {
        setCurrent(next);
        setQueue(rest);
      }
    }
  }, [current, queue]);

  const handleDismiss = useCallback(() => {
    setCurrent(null);
  }, []);

  return { current, queue, show };
}

// ============================================================
// Helpers
// ============================================================

function getCategoryLabel(category: string): string {
  switch (category) {
    case 'exploration': return '探索';
    case 'combat': return '战斗';
    case 'collection': return '收集';
    case 'narrative': return '剧情';
    default: return '成就';
  }
}

export { AchievementToast as default };
