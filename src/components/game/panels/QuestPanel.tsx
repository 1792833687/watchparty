'use client';

/**
 * v4.2.0 任务面板重做
 * - 主线：分阶段展示（MAIN_QUEST_LINE 细化），显示目标/地点/关键 NPC/奖励
 * - 支线：AI 剧情生成，显示活跃状态
 * - 已完成：归档展示
 * @module components/game/panels/QuestPanel
 */

import React, { useMemo } from 'react';
import { C } from '@/theme/tokens';
import type { GameQuest } from './types';
import { MAIN_QUEST_LINE, groupQuests, type MainQuestStage } from '@/systems/quests/quest-system';

export interface QuestPanelProps {
  quests: GameQuest[];
}

const GOLD = C.gold;
const TEXT = C.text;
const DIM = C.textDim;
const MUTED = C.textMuted;
const PANEL = C.bgCard;
const DEEP = C.bgPanel;
const OK = C.ok;
const BLUE = C.info;

export function QuestPanel({ quests }: QuestPanelProps): React.ReactElement {
  const { main, side, completed } = useMemo(() => groupQuests(quests), [quests]);
  const activeMainIds = new Set(main.map((q) => q.id));

  // 主线阶段：按 MAIN_QUEST_LINE 顺序展示，当前阶段高亮
  const mainStages: { stage: MainQuestStage; active: boolean }[] = useMemo(() => {
    return MAIN_QUEST_LINE.map((stage) => ({
      stage,
      active: activeMainIds.has(stage.id),
    }));
  }, [activeMainIds]);

  return (
    <div style={{
      padding: '1.25rem', color: TEXT, fontFamily: 'system-ui, sans-serif',
      height: '100%', overflowY: 'auto',
    }}>
      <h3 style={{
        textAlign: 'center', fontSize: '1.375rem', fontWeight: 700, color: GOLD,
        marginBottom: '0.25rem', paddingBottom: '0.625rem', borderBottom: '1px solid rgba(201,169,78,0.3)',
      }}>
        📜 任务簿
      </h3>
      <p style={{ textAlign: 'center', fontSize: '0.6875rem', color: MUTED, margin: '0 0 1rem' }}>
        主线铸就命运 · 支线由 AI 依据剧情生成
      </p>

      {/* ── 主线 ── */}
      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#D4A574', marginBottom: '0.5rem' }}>
        ⚔️ 主线任务
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {mainStages.map(({ stage, active }) => {
          const done = !active && main.every((q) => q.id !== stage.id) && completed.some((q) => q.id === stage.id || q.title === stage.title);
          return (
            <div
              key={stage.id}
              style={{
                padding: '0.75rem', borderRadius: 10,
                background: active ? 'rgba(201,169,78,0.08)' : PANEL,
                border: active ? `1px solid ${GOLD}66` : `1px solid rgba(201,169,78,0.12)`,
                opacity: done ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  fontSize: '0.6875rem', fontWeight: 700, color: active ? GOLD : MUTED,
                  border: `1px solid ${active ? GOLD : MUTED}55`, borderRadius: 4, padding: '0 5px',
                }}>
                  第 {MAIN_QUEST_LINE.indexOf(stage) + 1} 章
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: active ? GOLD : TEXT }}>
                  {stage.title}
                </span>
                {done && <span style={{ fontSize: '0.625rem', color: OK, marginLeft: 'auto' }}>✓ 已完成</span>}
              </div>
              <div style={{ fontSize: '0.75rem', color: DIM, lineHeight: 1.6, marginTop: '0.375rem' }}>
                {stage.description}
              </div>
              {active && (
                <>
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {stage.objectives.map((obj, i) => (
                      <div key={i} style={{ fontSize: '0.6875rem', color: DIM, display: 'flex', gap: '0.375rem' }}>
                        <span style={{ color: BLUE }}>▪</span>
                        <span>{obj}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.5rem' }}>
                    {stage.locations.map((loc) => (
                      <span key={loc} style={{ fontSize: '0.5625rem', color: BLUE, border: `1px solid ${BLUE}44`, borderRadius: 4, padding: '0 5px' }}>
                        📍 {loc}
                      </span>
                    ))}
                    {stage.keyNpcs.map((npc) => (
                      <span key={npc} style={{ fontSize: '0.5625rem', color: '#A864C0', border: '1px solid #A864C044', borderRadius: 4, padding: '0 5px' }}>
                        🎭 {npc}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.625rem', color: GOLD, marginTop: '0.5rem' }}>
                    🎁 {stage.rewards}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 支线 ── */}
      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#D4A574', marginBottom: '0.5rem' }}>
        🧩 支线任务 {side.length > 0 && <span style={{ color: MUTED, fontWeight: 400 }}>(AI 生成)</span>}
      </div>
      {side.length === 0 ? (
        <div style={{
          padding: '0.75rem', borderRadius: 8, background: DEEP, marginBottom: '1.25rem',
          border: '1px dashed rgba(201,169,78,0.2)', color: MUTED, fontSize: '0.75rem', textAlign: 'center',
        }}>
          暂无支线任务。推动剧情或前往酒馆，AI 主持人会为你生成新的委托。
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {side.map((q) => (
            <div key={q.id} style={{ padding: '0.625rem 0.75rem', borderRadius: 8, background: PANEL, border: '1px solid rgba(91,140,190,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: TEXT }}>{q.title}</span>
                <span style={{
                  marginLeft: 'auto', fontSize: '0.5625rem', color: OK,
                  border: `1px solid ${OK}44`, borderRadius: 4, padding: '0 5px',
                }}>
                  {q.progress}%
                </span>
              </div>
              <div style={{ fontSize: '0.6875rem', color: DIM, lineHeight: 1.5, marginTop: '0.25rem' }}>
                {q.description}
              </div>
              <div style={{ height: 4, borderRadius: 2, background: DEEP, marginTop: '0.375rem', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, q.progress)}%`, height: '100%', background: BLUE, borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 已完成 ── */}
      {completed.length > 0 && (
        <>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: MUTED, marginBottom: '0.5rem' }}>
            🏆 已完成 ({completed.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {completed.map((q) => (
              <div key={q.id} style={{
                padding: '0.5rem 0.75rem', borderRadius: 8, background: DEEP,
                border: '1px solid rgba(90,158,111,0.15)', fontSize: '0.75rem', color: MUTED,
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <span style={{ color: OK }}>✓</span>
                <span>{q.title}</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.5625rem', color: MUTED }}>
                  {q.type === 'main' ? '主线' : '支线'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default QuestPanel;
