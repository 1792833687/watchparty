'use client';

/**
 * SkillsPanel — AI Narrator Game v4.1.0
 *
 * 技能树按世界观的 7 大魔法学派呈现（防护/咒法/预言/塑能/幻术/变化/死灵），
 * 另含「武技」（战斗技艺）与「神圣」（圣职神术）两个非魔法分类。
 * - 每个学派有图标、描述与若干技能（含阶层 tier 与法术等级 spellLevel）
 * - 未解锁的高阶技能显示为「迷雾」状态，并给出 fogHint 揭示其解锁条件
 * - 死灵系为暗系学派，习得会提升堕落值（corruption）
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { C } from '@/theme/tokens';

// ============================================================
// Types
// ============================================================

export interface SkillThemeSkill {
  name: string;
  desc: string;
  cost: number;
  /** 阶层 1~3，越高越需前置解锁 */
  tier?: number;
  /** 迷雾提示：未解锁时揭示如何习得 */
  fogHint?: string;
  /** 暗系学派技能 */
  darkSchool?: boolean;
  /** 习得此项带来的堕落值 */
  corruption?: number;
  /** v4.1.0: 法术等级（world-setting 4.2：戏法/1环~5环） */
  spellLevel?: 'cantrip' | 1 | 2 | 3 | 4 | 5;
  /** v4.1.0: 施法魔力消耗 */
  mpCost?: number;
  /** v4.1.0: 学派类型：magic=魔法学派 / martial=武技 / divine=圣职神术 */
  category?: 'magic' | 'martial' | 'divine';
}

/** 法术等级显示标签 */
export const SPELL_LEVEL_LABELS: Record<string, string> = {
  cantrip: '戏法',
  '1': '1环',
  '2': '2环',
  '3': '3环',
  '4': '4环',
  '5': '5环',
};

/** 法术等级颜色 */
export const SPELL_LEVEL_COLORS: Record<string, string> = {
  cantrip: '#7A8FA0',
  '1': '#5B7B9A',
  '2': '#4A90D9',
  '3': '#A864C0',
  '4': '#E8843C',
  '5': '#E53E3E',
};

/**
 * v4.1.0: 根据职业 starterSkills（技能名列表）在技能树中定位节点并返回技能名集合。
 * 用于开局预解锁职业基础技能。若技能树中找不到同名技能则忽略（容错）。
 */
export function resolveStarterSkillNames(
  starterSkillNames: string[] | undefined,
  categories: SkillCategoryTheme[] | undefined
): string[] {
  if (!starterSkillNames || starterSkillNames.length === 0) return [];
  if (!categories || categories.length === 0) return [];
  const allNames = new Set<string>();
  categories.forEach((cat) => cat.skills.forEach((s) => allNames.add(s.name)));
  return starterSkillNames.filter((n) => allNames.has(n));
}

/** Theme-driven skill category definition (from gameSetting.themeData.skillCategories) */
export interface SkillCategoryTheme {
  name: string;
  icon?: string;
  desc?: string;
  skills: SkillThemeSkill[];
}

export interface SkillsPanelProps {
  classId?: string;
  skillPoints?: number;
  unlockedSkills?: string[];
  onUnlockSkill?: (skillId: string) => void;
  /** v3.0.0: theme-driven skill categories (9 学派) */
  themeCategories?: SkillCategoryTheme[];
  /** v5.0.0 (功能5): 本职业基础技能（starterSkills 技能名数组）— 开局可见可学 */
  classStarterSkills?: string[];
}

// ============================================================
// Component
// ============================================================

const GOLD = C.gold;
const TEXT = C.text;
const DIM = C.textDim;
const MUTED = C.textMuted;
const PANEL = C.bgCard;
const DEEP = C.bgPanel;
const DANGER = C.darkAccent;
const PURPLE = C.magic;

export function SkillsPanel({
  classId = '守夜人',
  skillPoints = 0,
  unlockedSkills = [],
  onUnlockSkill,
  themeCategories,
  classStarterSkills = [],
}: SkillsPanelProps): React.ReactElement {
  const categories = themeCategories && themeCategories.length > 0 ? themeCategories : [];

  // v4.1.0: 已习得集合以「技能名」为键（稳定，不随索引漂移），支持外部初始注入
  const [learnedNodes, setLearnedNodes] = useState<Set<string>>(() => new Set(unlockedSkills));
  const [points, setPoints] = useState(skillPoints);

  const learnedCount = learnedNodes.size;

  // Build a flat list of nodes with stable ids
  const nodes = useMemo(() => {
    const out: { catIdx: number; skillIdx: number; id: string; cat: SkillCategoryTheme; skill: SkillThemeSkill }[] = [];
    categories.forEach((cat, catIdx) => {
      cat.skills.forEach((skill, skillIdx) => {
        out.push({ catIdx, skillIdx, id: `c${catIdx}-s${skillIdx}`, cat, skill });
      });
    });
    return out;
  }, [categories]);

  // v4.1.0: 以技能名判定是否已习得（外部注入 unlockedSkills 也按名匹配）
  const isLearned = useCallback((name: string): boolean => learnedNodes.has(name), [learnedNodes]);

  // A skill is available if tier===1, or a lower-tier skill in the same category is learned
  const isAvailable = useCallback((catIdx: number, skill: SkillThemeSkill): boolean => {
    const tier = skill.tier ?? 1;
    if (tier <= 1) return true;
    // needs a learned skill of tier-1 in same category
    const lowerTierLearned = nodes.some(
      (n) => n.catIdx === catIdx && (n.skill.tier ?? 1) === tier - 1 && isLearned(n.skill.name)
    );
    return lowerTierLearned;
  }, [nodes, isLearned]);

  const handleUnlock = useCallback((name: string, cost: number) => {
    if (points < cost) return;
    setPoints((prev) => prev - cost);
    setLearnedNodes((prev) => new Set([...prev, name]));
    onUnlockSkill?.(name);
  }, [points, onUnlockSkill]);

  // v4.1.0: 响应外部 skillPoints 变化（如成就奖励）
  useEffect(() => { setPoints(skillPoints); }, [skillPoints]);

  if (categories.length === 0) {
    return (
      <div style={{ padding: '1.5rem', color: DIM, textAlign: 'center', fontFamily: "'Noto Sans SC',system-ui,sans-serif" }}>
        暂无技能数据。
      </div>
    );
  }

  const totalSkills = nodes.length;
  const lockedCount = nodes.filter((n) => !isLearned(n.skill.name) && !isAvailable(n.catIdx, n.skill)).length;

  return (
    <div style={{ padding: '1rem', color: TEXT, fontFamily: 'Noto Sans SC, Inter, system-ui, sans-serif', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: GOLD, margin: '0 0 0.15rem' }}>
        🌟 技能树 — {classId}
      </h2>
      <p style={{ fontSize: '0.6875rem', color: MUTED, margin: '0 0 0.75rem' }}>
        已习得 {learnedCount} / {totalSkills}
        {lockedCount > 0 && ` · ${lockedCount} 项仍笼罩在迷雾中`}
      </p>

      {/* v5.0.0 (功能5): 本职业基础技能横幅 — 开局可见，让玩家一眼看到职业特色 */}
      {classStarterSkills.length > 0 && (
        <div style={{
          background: 'linear-gradient(120deg, rgba(201,169,78,0.14), rgba(123,111,223,0.08))',
          border: '1px solid rgba(201,169,78,0.35)',
          borderRadius: 10, padding: '0.625rem 0.875rem', marginBottom: '0.875rem',
        }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: GOLD, marginBottom: '0.375rem' }}>
            ⚔️ 本职业基础技能
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {classStarterSkills.map((name) => {
              const learned = isLearned(name);
              return (
                <span key={name} style={{
                  fontSize: '0.75rem', color: learned ? '#5A9E6F' : '#F0DCA8',
                  border: `1px solid ${learned ? '#5A9E6F' : 'rgba(201,169,78,0.4)'}`,
                  borderRadius: 999, padding: '0.125rem 0.625rem',
                  background: learned ? 'rgba(90,158,111,0.12)' : 'rgba(201,169,78,0.1)',
                  fontWeight: 600,
                }}>
                  {name} {learned ? '✓' : '可学习'}
                </span>
              );
            })}
          </div>
          <div style={{ fontSize: '0.625rem', color: MUTED, marginTop: '0.375rem' }}>
            在下方对应学派中找到并点亮它们；也可通过剧情/导师传授习得。
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        {categories.map((cat, catIdx) => {
          const isDark = cat.skills.some((s) => s.darkSchool);
          const catColor = isDark ? DANGER : GOLD;
          return (
            <div key={`cat-${catIdx}`} style={{
              borderRadius: 10,
              background: isDark ? 'rgba(229,62,62,0.05)' : 'rgba(201,169,78,0.04)',
              border: `1px solid ${isDark ? 'rgba(229,62,62,0.25)' : 'rgba(201,169,78,0.18)'}`,
              padding: '0.75rem 0.875rem',
            }}>
              {/* School header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>{cat.icon ?? '✦'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: catColor }}>
                    {cat.name}
                    {isDark && <span style={{ fontSize: '0.625rem', marginLeft: '0.375rem', color: DANGER, border: `1px solid ${DANGER}`, borderRadius: 4, padding: '0 4px' }}>暗系</span>}
                  </div>
                  {cat.desc && <div style={{ fontSize: '0.6875rem', color: DIM, lineHeight: 1.5 }}>{cat.desc}</div>}
                </div>
              </div>

              {/* Skills */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {cat.skills.map((skill, sIdx) => {
                  const id = `c${catIdx}-s${sIdx}`;
                  const tier = skill.tier ?? 1;
                  const learned = isLearned(skill.name);
                  const available = !learned && isAvailable(catIdx, skill);
                  const locked = !learned && !available;

                  const themeColor = skill.darkSchool ? DANGER : catColor;

                  if (locked) {
                    // 迷雾状态：未解锁
                    return (
                      <div key={id} style={{
                        padding: '0.625rem 0.75rem', borderRadius: 8,
                        background: 'rgba(123,111,223,0.06)',
                        border: '1px dashed rgba(123,111,223,0.3)',
                        position: 'relative', overflow: 'hidden',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1rem', filter: 'grayscale(1) opacity(0.6)' }}>🌫️</span>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#8A80A8' }}>
                            {skill.name}
                          </span>
                          {/* v5.0.0 (功能5): 职业基础技能即使处于迷雾也标注 */}
                          {classStarterSkills.includes(skill.name) && (
                            <span style={{
                              fontSize: '0.5625rem', color: '#C9A94E',
                              border: '1px solid rgba(201,169,78,0.6)', borderRadius: 4,
                              padding: '0 4px', fontWeight: 700,
                            }}>
                              职业
                            </span>
                          )}
                          <span style={{ fontSize: '0.625rem', color: PURPLE, border: `1px solid ${PURPLE}55`, borderRadius: 4, padding: '0 4px', marginLeft: 'auto' }}>
                            阶层 {tier} · 迷雾
                          </span>
                        </div>
                        {skill.fogHint && (
                          <div style={{ marginTop: '0.375rem', fontSize: '0.6875rem', color: '#8A80A8', fontStyle: 'italic', lineHeight: 1.5 }}>
                            ✦ 迷雾低语：{skill.fogHint}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // 已习得 / 可解锁
                  return (
                    <div key={id} style={{
                      padding: '0.625rem 0.75rem', borderRadius: 8,
                      background: learned ? (skill.darkSchool ? 'rgba(229,62,62,0.1)' : 'rgba(201,169,78,0.1)') : PANEL,
                      border: `1px solid ${learned ? themeColor : available ? themeColor + '66' : 'rgba(201,169,78,0.12)'}`,
                      display: 'flex', alignItems: 'center', gap: '0.625rem',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: learned ? themeColor : DIM }}>
                            {skill.name}
                          </span>
                          {/* v5.0.0 (功能5): 本职业基础技能徽章 */}
                          {classStarterSkills.includes(skill.name) && (
                            <span style={{
                              fontSize: '0.5625rem', color: '#C9A94E',
                              border: '1px solid rgba(201,169,78,0.6)', borderRadius: 4,
                              padding: '0 4px', fontWeight: 700,
                            }}>
                              职业
                            </span>
                          )}
                          <span style={{ fontSize: '0.5625rem', color: MUTED, border: `1px solid ${MUTED}55`, borderRadius: 4, padding: '0 4px' }}>
                            阶层 {tier}
                          </span>
                          {/* v4.1.0: 法术等级标识（魔法学派技能） */}
                          {skill.spellLevel !== undefined && (
                            <span
                              style={{
                                fontSize: '0.5625rem',
                                color: SPELL_LEVEL_COLORS[String(skill.spellLevel)],
                                border: `1px solid ${SPELL_LEVEL_COLORS[String(skill.spellLevel)]}`,
                                borderRadius: 4, padding: '0 4px',
                              }}
                              title="法术等级"
                            >
                              ✦ {SPELL_LEVEL_LABELS[String(skill.spellLevel)]}
                            </span>
                          )}
                          {/* v4.1.0: 魔力消耗（魔法学派技能） */}
                          {typeof skill.mpCost === 'number' && skill.mpCost > 0 && (
                            <span style={{ fontSize: '0.5625rem', color: '#5B9BD5', border: '1px solid #5B9BD555', borderRadius: 4, padding: '0 4px' }} title="魔力消耗">
                              💧{skill.mpCost} MP
                            </span>
                          )}
                          {skill.darkSchool && (
                            <span style={{ fontSize: '0.5625rem', color: DANGER, border: `1px solid ${DANGER}`, borderRadius: 4, padding: '0 4px' }}>
                              堕落+{skill.corruption ?? 0}
                            </span>
                          )}
                          {learned && (
                            <span style={{ fontSize: '0.5625rem', color: '#5A9E6F', marginLeft: 'auto' }}>✓ 已习得</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: learned ? DIM : MUTED, marginTop: '0.15rem', lineHeight: 1.5 }}>
                          {skill.desc}
                        </div>
                      </div>
                      {available && (
                        <button
                          type="button"
                          onClick={() => handleUnlock(skill.name, skill.cost)}
                          disabled={points < skill.cost}
                          style={{
                            padding: '0.25rem 0.625rem', borderRadius: 6, flexShrink: 0,
                            border: `1px solid ${themeColor}`,
                            background: points >= skill.cost ? themeColor : 'transparent',
                            color: points >= skill.cost ? DEEP : themeColor,
                            fontSize: '0.625rem', fontWeight: 700, cursor: points >= skill.cost ? 'pointer' : 'not-allowed',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          解锁 ({skill.cost}点)
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Available skill points */}
      <div style={{
        textAlign: 'center', padding: '0.625rem', borderRadius: 6,
        background: DEEP, border: '1px solid rgba(201,169,78,0.15)',
        marginTop: '1rem', flexShrink: 0,
      }}>
        <span style={{ fontSize: '0.6875rem', color: MUTED }}>可用技能点：</span>
        <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: GOLD, marginLeft: '0.25rem' }}>{points}</span>
        <span style={{ fontSize: '0.5625rem', color: '#4A4A4A', display: 'block', marginTop: '0.15rem' }}>
          完成探索、战斗与叙事成就可获得更多技能点
        </span>
      </div>
    </div>
  );
}
