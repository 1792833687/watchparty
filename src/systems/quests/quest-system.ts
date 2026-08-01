/**
 * v4.2.0 任务系统重做
 *
 * - 主线：分阶段细化（每阶段有目标/地点/关键 NPC/奖励），随剧情解锁
 * - 支线：由 AI 在推动剧情后分析生成（AI 通过 GAMESTATE.quests 下发 side 任务）
 * - 任务详情 UI 分组展示主线/支线
 * @module systems/quests/quest-system
 */

import type { GameQuest } from '@/components/game/panels/types';

export interface MainQuestStage {
  id: string;
  title: string;
  description: string;
  /** 关键目标（子步骤） */
  objectives: string[];
  /** 涉及地点 */
  locations: string[];
  /** 关键 NPC */
  keyNpcs: string[];
  /** 完成后奖励描述 */
  rewards: string;
  /** 前置阶段 ID（null = 起始） */
  requires?: string | null;
}

/**
 * 凛冬要塞主线任务线（v4.2.0 细化版）
 * 共 5 阶段，对应世界观的叙事弧线。
 */
export const MAIN_QUEST_LINE: MainQuestStage[] = [
  {
    id: 'mq-1',
    title: '守夜人之誓',
    description: '接过守夜人的火炬，巩固凛冬要塞的防御，招募第一批同伴。',
    objectives: ['熟悉要塞与凛冬谷', '拜访老学士梅林了解局势', '招募至少 1 名同伴'],
    locations: ['凛冬谷', '主堡'],
    keyNpcs: ['老学士梅林'],
    rewards: '声望初值 + 初始装备补给',
    requires: null,
  },
  {
    id: 'mq-2',
    title: '阴影山脉的鼓声',
    description: '半兽人在阴影山脉集结，信使带回白石的求援。查明敌军动向。',
    objectives: ['前往暮色森林或阴影山脉侦查', '与艾琳·星语交换情报', '带回一份敌军动向报告'],
    locations: ['暮色森林', '阴影山脉'],
    keyNpcs: ['艾琳·星语', '白石信使'],
    rewards: '要塞防御值 +20，情报加成',
    requires: 'mq-1',
  },
  {
    id: 'mq-3',
    title: '王国的裂痕',
    description: '旧日王国的盟友各怀心思：白石求援、翠溪隐谷西渡、灰炉山闭关。你需要斡旋诸族。',
    objectives: ['访问至少两个阵营', '完成一次外交斡旋', '赢得一个阵营的信任（声望≥30）'],
    locations: ['凛冬谷', '任意已解锁区域'],
    keyNpcs: ['罗兰爵士', '塔林·铜锤'],
    rewards: '阵营声望 +20，解锁盟友支援',
    requires: 'mq-2',
  },
  {
    id: 'mq-4',
    title: '围城将至',
    description: '敌军大举压境，凛冬要塞将迎来最严峻的考验。升级工事、储备粮草、集结守军。',
    objectives: ['城墙/兵营至少 2 级', '完成至少 1 个战略桌项目', '挺过围城战'],
    locations: ['凛冬谷', '要塞'],
    keyNpcs: ['莉亚·风行者', '格朗·铁砧'],
    rewards: '领地防御值 +40，守军力量提升',
    requires: 'mq-3',
  },
  {
    id: 'mq-5',
    title: '终焉之战',
    description: '黑暗君主亲自降临。集结所有盟友，在最后关头做出不可逆转的选择——七个结局之一。',
    objectives: ['集结盟友（全阵营≥40）', '完成关键抉择', '迎接终局'],
    locations: ['黑曜石荒原', '龙脊冰峰'],
    keyNpcs: ['全部同伴'],
    rewards: '触发多结局系统',
    requires: 'mq-4',
  },
];

/** 获取主线第 N 阶段任务 */
export function getMainStage(stageId: string): MainQuestStage | null {
  return MAIN_QUEST_LINE.find((s) => s.id === stageId) ?? null;
}

/** 当前应激活的主线阶段（依据已完成的主线任务） */
export function getActiveMainStage(quests: GameQuest[]): MainQuestStage | null {
  const completed = quests
    .filter((q) => q.type === 'main' && q.status === 'completed')
    .map((q) => q.id);
  return MAIN_QUEST_LINE.find((stage) => !completed.includes(stage.id)) ?? null;
}

/**
 * 支线任务 AI 生成提示（注入系统 prompt）
 * AI 依据当前剧情分析生成 side 任务：酒馆委托、悬赏、求助、探索谜团。
 */
export const SIDE_QUEST_PROMPT = `【支线任务生成规则 — v4.2.0】
- 当剧情中出现合适的契机（酒馆委托、求助、悬赏、神秘事件）时，通过 GAMESTATE.quests 下发支线任务：
  {"id":"side-xxx","title":"任务名","description":"目标描述","type":"side","progress":0}
- 支线应紧扣当前剧情与地点，数量适中（同时活跃 1-3 条），完成后及时标记 status:"completed"
- 支线奖励可为装备/金币/情报/声望，与主线奖励错开`;

/** 构建任务面板用的分组数据 */
export function groupQuests(quests: GameQuest[]): { main: GameQuest[]; side: GameQuest[]; completed: GameQuest[] } {
  const active = quests.filter((q) => q.status !== 'completed' && q.status !== 'failed');
  return {
    main: active.filter((q) => q.type === 'main'),
    side: active.filter((q) => q.type === 'side'),
    completed: quests.filter((q) => q.status === 'completed'),
  };
}
