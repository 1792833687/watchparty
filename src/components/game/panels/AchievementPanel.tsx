'use client';

import React, { useState } from 'react';
import type { Achievement, AchievementCategory } from '@/systems/achievements/achievement-system';

export interface AchievementPanelProps {
  achievements: Achievement[];
  totalProgress: { total: number; unlocked: number; byCategory: Record<AchievementCategory, { unlocked: number; total: number }> };
}

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  exploration: '🗺️ 探索',
  combat: '⚔️ 战斗',
  collection: '💎 收集',
  narrative: '📖 叙事',
};

const CATEGORY_ORDER: AchievementCategory[] = ['exploration', 'combat', 'collection', 'narrative'];

export function AchievementPanel({ achievements, totalProgress }: AchievementPanelProps): React.ReactElement {
  const [activeCategory, setActiveCategory] = useState<AchievementCategory | 'all'>('all');

  const filteredAchievements = activeCategory === 'all'
    ? achievements
    : achievements.filter(a => a.category === activeCategory);

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;
  const overallPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  return (
    <div style={{
      padding: '1.5rem 1.25rem',
      color: '#E8E0D5',
      fontFamily: 'system-ui, sans-serif',
      height: '100%',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <h3 style={{
        textAlign: 'center',
        fontSize: '1.5rem',
        fontWeight: 700,
        color: '#C9A94E',
        marginBottom: '0.875rem',
        paddingBottom: '0.875rem',
        borderBottom: '1px solid rgba(201,169,78,0.3)',
      }}>
        🏆 成就
      </h3>

      {/* Overall progress */}
      <div style={{
        background: '#2A2522',
        borderRadius: 10,
        padding: '0.875rem 1rem',
        marginBottom: '1rem',
        border: '1px solid rgba(201,169,78,0.18)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#E8E0D5' }}>
            总进度
          </span>
          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#C9A94E' }}>
            {unlockedCount} / {totalCount} ({overallPercent}%)
          </span>
        </div>
        <div style={{
          height: 10,
          borderRadius: 5,
          background: '#1E1B18',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${overallPercent}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #C9A94E, #E6C84E)',
            borderRadius: 5,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* v4.2.1 (P2-8): 已获称号横幅 — 称号兑现为名片展示 */}
      {(() => {
        const titles = achievements
          .filter((a) => a.unlocked && a.reward.includes('称号：'))
          .map((a) => a.reward.match(/称号：([^ ·]+)/)?.[1])
          .filter((t): t is string => !!t);
        if (titles.length === 0) return null;
        return (
          <div style={{
            background: 'linear-gradient(120deg, rgba(201,169,78,0.12), rgba(123,111,223,0.08))',
            borderRadius: 10, padding: '0.625rem 0.875rem', marginBottom: '1rem',
            border: '1px solid rgba(201,169,78,0.3)',
          }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#C9A94E', marginBottom: '0.375rem' }}>
              🏅 你的称号
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {titles.map((t) => (
                <span key={t} style={{
                  fontSize: '0.75rem', color: '#F5E3B3',
                  border: '1px solid rgba(201,169,78,0.4)', borderRadius: 999,
                  padding: '0.125rem 0.625rem', background: 'rgba(201,169,78,0.1)',
                  fontWeight: 600,
                }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Category tabs */}
      <div style={{
        display: 'flex',
        gap: '0.375rem',
        marginBottom: '1rem',
        flexWrap: 'wrap',
      }}>
        <button
          onClick={() => setActiveCategory('all')}
          style={{
            padding: '0.375rem 0.75rem',
            borderRadius: 6,
            border: '1px solid',
            borderColor: activeCategory === 'all' ? '#C9A94E' : 'rgba(201,169,78,0.2)',
            background: activeCategory === 'all' ? 'rgba(201,169,78,0.18)' : 'transparent',
            color: activeCategory === 'all' ? '#C9A94E' : '#A09888',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          全部
        </button>
        {CATEGORY_ORDER.map(cat => {
          const catProgress = totalProgress.byCategory[cat];
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: 6,
                border: '1px solid',
                borderColor: isActive ? '#C9A94E' : 'rgba(201,169,78,0.2)',
                background: isActive ? 'rgba(201,169,78,0.18)' : 'transparent',
                color: isActive ? '#C9A94E' : '#A09888',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {CATEGORY_LABELS[cat]}
              {catProgress && (
                <span style={{ marginLeft: '0.375rem', fontSize: '0.75rem', opacity: 0.8 }}>
                  {catProgress.unlocked}/{catProgress.total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Achievement list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
        {filteredAchievements.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '2rem 1rem',
            color: '#5A5248',
            fontSize: '0.9375rem',
          }}>
            暂无成就。
          </div>
        ) : (
          filteredAchievements.map(ach => {
            const percent = ach.max > 0 ? Math.min(100, Math.round((ach.progress / ach.max) * 100)) : 0;
            const isUnlocked = ach.unlocked;
            const isHidden = ach.hidden && !isUnlocked;

            return (
              <div key={ach.id} style={{
                borderRadius: 10,
                background: isUnlocked ? '#2A2522' : '#211F24',
                border: '1px solid',
                borderColor: isUnlocked ? 'rgba(201,169,78,0.35)' : 'rgba(160,152,136,0.15)',
                padding: '0.875rem 1rem',
                opacity: isHidden ? 0.5 : 1,
                boxShadow: isUnlocked ? '0 2px 10px rgba(201,169,78,0.1)' : 'none',
                transition: 'all 0.2s ease',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  {/* Icon */}
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: isUnlocked
                      ? 'linear-gradient(135deg, rgba(201,169,78,0.25), rgba(201,169,78,0.1))'
                      : 'rgba(90,82,72,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    flexShrink: 0,
                    border: isUnlocked ? '1px solid rgba(201,169,78,0.3)' : '1px solid rgba(90,82,72,0.2)',
                  }}>
                    {isHidden ? '❓' : ach.icon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                      <span style={{
                        fontWeight: 700,
                        fontSize: '0.9375rem',
                        color: isUnlocked ? '#E8E0D5' : '#6B6258',
                      }}>
                        {isHidden ? '???' : ach.name}
                      </span>
                      {isUnlocked && (
                        <span style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          padding: '0.125rem 0.5rem',
                          borderRadius: 4,
                          background: 'rgba(76,175,80,0.2)',
                          color: '#4CAF50',
                        }}>
                          已解锁
                        </span>
                      )}
                    </div>

                    <p style={{
                      fontSize: '0.8125rem',
                      color: isUnlocked ? '#A09888' : '#5A5248',
                      margin: '0 0 0.5rem',
                      lineHeight: 1.4,
                    }}>
                      {isHidden ? '完成特定条件以解锁此隐藏成就' : ach.description}
                    </p>

                    {/* Progress bar */}
                    {!isHidden && ach.max > 1 && (
                      <div style={{ marginBottom: '0.375rem' }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.6875rem',
                          marginBottom: '0.25rem',
                        }}>
                          <span style={{ color: '#6B6258' }}>进度</span>
                          <span style={{ color: isUnlocked ? '#4CAF50' : '#C9A94E', fontWeight: 600 }}>
                            {ach.progress} / {ach.max}
                          </span>
                        </div>
                        <div style={{
                          height: 6,
                          borderRadius: 3,
                          background: '#1E1B18',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${percent}%`,
                            height: '100%',
                            background: isUnlocked
                              ? 'linear-gradient(90deg, #4CAF50, #66BB6A)'
                              : 'linear-gradient(90deg, #C9A94E, #E6C84E)',
                            borderRadius: 3,
                            transition: 'width 0.3s ease',
                          }} />
                        </div>
                      </div>
                    )}

                    {/* Reward */}
                    {!isHidden && ach.reward && (
                      <div style={{
                        fontSize: '0.6875rem',
                        color: '#C9A94E',
                        fontWeight: 500,
                      }}>
                        🎁 奖励：{ach.reward}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
