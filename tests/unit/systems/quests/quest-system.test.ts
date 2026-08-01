/**
 * v4.2.0 任务系统测试
 */
import { describe, expect, it } from 'vitest';
import { MAIN_QUEST_LINE, getMainStage, getActiveMainStage, groupQuests, SIDE_QUEST_PROMPT } from '@/systems/quests/quest-system';
import type { GameQuest } from '@/components/game/panels/types';

function quest(id: string, type: 'main' | 'side', status: GameQuest['status'] = 'active'): GameQuest {
  return { id, title: id, description: 'test', type, progress: 0, status };
}

describe('任务系统', () => {
  it('主线共 5 阶段且阶段衔接', () => {
    expect(MAIN_QUEST_LINE).toHaveLength(5);
    // 首阶段无前置
    expect(MAIN_QUEST_LINE[0]!.requires).toBeNull();
    // 后续阶段前置正确
    for (let i = 1; i < MAIN_QUEST_LINE.length; i++) {
      expect(MAIN_QUEST_LINE[i]!.requires).toBe(MAIN_QUEST_LINE[i - 1]!.id);
    }
  });

  it('主线每阶段含目标/地点/NPC/奖励', () => {
    for (const stage of MAIN_QUEST_LINE) {
      expect(stage.objectives.length).toBeGreaterThanOrEqual(2);
      expect(stage.locations.length).toBeGreaterThanOrEqual(1);
      expect(stage.keyNpcs.length).toBeGreaterThanOrEqual(1);
      expect(stage.rewards.length).toBeGreaterThan(0);
    }
  });

  it('getMainStage 按 ID 查找', () => {
    expect(getMainStage('mq-1')?.title).toBe('守夜人之誓');
    expect(getMainStage('nope')).toBeNull();
  });

  it('getActiveMainStage 返回首个未完成主线', () => {
    const quests = [quest('mq-1', 'main', 'completed')];
    const active = getActiveMainStage(quests);
    expect(active?.id).toBe('mq-2');
  });

  it('全部主线完成后返回 null', () => {
    const quests = MAIN_QUEST_LINE.map((s) => quest(s.id, 'main', 'completed'));
    expect(getActiveMainStage(quests)).toBeNull();
  });

  it('groupQuests 分组主线/支线/已完成', () => {
    const quests = [
      quest('mq-1', 'main', 'completed'),
      quest('mq-2', 'main'),
      quest('side-1', 'side'),
      quest('side-2', 'side', 'completed'),
    ];
    const groups = groupQuests(quests);
    expect(groups.main.map((q) => q.id)).toEqual(['mq-2']);
    expect(groups.side.map((q) => q.id)).toEqual(['side-1']);
    expect(groups.completed).toHaveLength(2);
  });

  it('支线生成提示包含 AI 规则', () => {
    expect(SIDE_QUEST_PROMPT).toContain('支线任务生成规则');
    expect(SIDE_QUEST_PROMPT).toContain('side');
  });
});
