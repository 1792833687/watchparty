/**
 * v4.1.0 NPC 行为引擎 — 基于 AgentGal 多智能体设计
 * 每个 NPC 具备独立的目标、情绪、位置和记忆。
 * 每次对话结束或时间推进后，NPC 会自主推演行为。
 * @module systems/npc/npc-engine
 */

// ============================================================
// 类型
// ============================================================

export type NpcGoal = 'explore' | 'rest' | 'patrol' | 'trade' | 'quest' | 'flee' | 'support';
export type NpcMood = 'calm' | 'happy' | 'worried' | 'angry' | 'fearful' | 'determined';
export type NpcLocation = '凛冬谷' | '暮色森林' | '阴影山脉' | '荒芜平原' | '黑曜石荒原' | '龙脊冰峰' | '未知';

export interface NpcMemory {
  id: string;
  event: string;
  timestamp: number;
  importance: 1 | 2 | 3;
}

export interface NpcBehavior {
  id: string;
  name: string;
  role: string;
  mood: NpcMood;
  goal: NpcGoal;
  location: NpcLocation;
  /** 对玩家的好感 -100~100 */
  affinity: number;
  /** 当前是否在线（在玩家所在位置） */
  present: boolean;
  /** 最近 10 条记忆 */
  memories: NpcMemory[];
  /** 上次更新时间戳 */
  lastTick: number;
}

export interface NpcEngineState {
  npcs: Record<string, NpcBehavior>;
  tickCount: number;
}

export interface TickResult {
  npcId: string;
  name: string;
  action: string;
  narrative: string;
  locationChange?: NpcLocation;
  moodChange?: NpcMood;
  goalChange?: NpcGoal;
  affinityDelta?: number;
}

// ============================================================
// 初始化
// ============================================================

/** AgentGal 式的 NPC 初始状态：基于 Frosthold 世界设定 */
export function createInitialNpcState(): NpcEngineState {
  return {
    npcs: {
      'thorin-copper': {
        id: 'thorin-copper',
        name: '塔林·铜锤',
        role: '矮人铁匠',
        mood: 'calm',
        goal: 'trade',
        location: '凛冬谷',
        affinity: 0,
        present: false,
        memories: [{ id: 'init', event: '镇上来了个新面孔', timestamp: Date.now(), importance: 2 }],
        lastTick: Date.now(),
      },
      'aelune-starwhisper': {
        id: 'aelune-starwhisper',
        name: '艾琳·星语',
        role: '精灵学者',
        mood: 'worried',
        goal: 'quest',
        location: '暮色森林',
        affinity: 5,
        present: false,
        memories: [{ id: 'init', event: '感受到古老的魔法波动在东方', timestamp: Date.now(), importance: 3 }],
        lastTick: Date.now(),
      },
      'roland': {
        id: 'roland',
        name: '罗兰爵士',
        role: '圣骑士',
        mood: 'determined',
        goal: 'patrol',
        location: '凛冬谷',
        affinity: 10,
        present: false,
        memories: [{ id: 'init', event: '宣誓保卫凛冬要塞', timestamp: Date.now(), importance: 3 }],
        lastTick: Date.now(),
      },
      'lia-windwalker': {
        id: 'lia-windwalker',
        name: '莉亚·风行者',
        role: '游侠斥候',
        mood: 'calm',
        goal: 'explore',
        location: '阴影山脉',
        affinity: 0,
        present: false,
        memories: [{ id: 'init', event: '在阴影山脉边缘发现了可疑的足迹', timestamp: Date.now(), importance: 2 }],
        lastTick: Date.now(),
      },
      'grim-darkforge': {
        id: 'grim-darkforge',
        name: '格朗·铁砧',
        role: '堕落领主',
        mood: 'angry',
        goal: 'quest',
        location: '黑曜石荒原',
        affinity: -10,
        present: false,
        memories: [{ id: 'init', event: '旧日的誓言已被打破', timestamp: Date.now(), importance: 3 }],
        lastTick: Date.now(),
      },
      // v4.1.0: 艾拉 — 游离之魂事件的小女孩（world-setting 5.3），拯救后加入 NPC 世界
      'aila': {
        id: 'aila',
        name: '艾拉',
        role: '被拯救的小女孩',
        mood: 'fearful',
        goal: 'support',
        location: '凛冬谷',
        affinity: 20,
        present: false,
        memories: [
          { id: 'init', event: '在要塞废墟中被领主发现', timestamp: Date.now(), importance: 3 },
          { id: 'rescue', event: '领主回应了她的哭声', timestamp: Date.now(), importance: 3 },
        ],
        lastTick: Date.now(),
      },
    },
    tickCount: 0,
  };
}

// ============================================================
// 行为推演
// ============================================================

const MOOD_TRANSITIONS: Record<NpcMood, NpcMood[]> = {
  calm: ['happy', 'worried', 'determined'],
  happy: ['calm', 'determined', 'worried'],
  worried: ['calm', 'fearful', 'determined'],
  angry: ['determined', 'fearful', 'calm'],
  fearful: ['worried', 'angry', 'calm'],
  determined: ['calm', 'angry', 'happy'],
};

const GOAL_TRANSITIONS: Record<NpcGoal, NpcGoal[]> = {
  explore: ['patrol', 'quest', 'rest', 'support'],
  rest: ['explore', 'patrol', 'trade'],
  patrol: ['explore', 'quest', 'rest'],
  trade: ['explore', 'rest', 'quest'],
  quest: ['explore', 'patrol', 'flee'],
  flee: ['rest', 'support'],
  support: ['patrol', 'explore', 'rest'],
};

const LOCATIONS: NpcLocation[] = [
  '凛冬谷', '暮色森林', '阴影山脉', '荒芜平原', '黑曜石荒原', '龙脊冰峰',
];

const ACTION_NARRATIVES: Record<NpcGoal, string[]> = {
  explore: ['在{location}周边勘察地形', '发现了一处隐秘的洞穴入口', '在{location}边缘追踪着某种生物'],
  rest: ['在{location}休整，补充物资', '在{location}的营地中靠着篝火小憩', '整理着行囊，检查装备'],
  patrol: ['在{location}巡逻，保持警戒', '巡视着{location}的防线', '检查着{location}的路障'],
  trade: ['在{location}与商人交谈', '在{location}的市集上寻找稀有矿石', '与人交换情报和物资'],
  quest: ['深入{location}调查异常', '在{location}寻找古老的线索', '追踪着一个神秘的目标'],
  flee: ['从{location}撤退到安全地带', '仓促离开{location}', '警惕地穿过{location}的边缘地带'],
  support: ['前往{location}支援同伴', '赶往{location}，听说那里需要帮助', '在{location}与其他冒险者汇合'],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * 推进 NPC 状态一个 tick（约游戏内 1 小时）。
 * 基于 AgentGal 的"角色自主演化"理念：
 * - NPC 可能在几个地点间迁移
 * - 情绪可能变化
 * - 可能产生新的目标
 * - 与玩家好感可能自然衰减/增长
 */
export function tickNpc(npc: NpcBehavior, playerLocation: string, playerReputation: number): TickResult {
  let { mood, goal, location, affinity } = npc;

  // 30% 概率情绪变化
  if (Math.random() < 0.3) {
    const nextMoods = MOOD_TRANSITIONS[mood];
    mood = pickRandom(nextMoods);
  }

  // 20% 概率目标变化
  if (Math.random() < 0.2) {
    const nextGoals = GOAL_TRANSITIONS[goal];
    goal = pickRandom(nextGoals);
  }

  // 如果目标是 explore/quest，可能换地点
  if ((goal === 'explore' || goal === 'quest') && Math.random() < 0.4) {
    const otherLocations = LOCATIONS.filter(l => l !== location);
    location = pickRandom(otherLocations);
  }

  // 与玩家好感自然变化
  // 如果 NPC 在玩家周围，好感缓慢增长（最大 +/-5）
  const isNearPlayer = location === playerLocation || npc.present;
  const affinityDelta = isNearPlayer
    ? (affinity < 0 ? 2 : 1)   // 附近 NPC：敌对者缓和，友善者增进
    : (Math.random() < 0.1 ? (Math.random() < 0.5 ? -1 : 1) : 0);  // 远离时偶尔自然变化

  affinity = Math.max(-100, Math.min(100, affinity + affinityDelta));

  // 生成叙事
  const narratives = ACTION_NARRATIVES[goal];
  const narrative = pickRandom(narratives).replace(/\{location\}/g, location);

  return {
    npcId: npc.id,
    name: npc.name,
    action: `${goal}@${location}`,
    narrative: `【${npc.name}】${narrative}。`,
    locationChange: location !== npc.location ? location : undefined,
    moodChange: mood !== npc.mood ? mood : undefined,
    goalChange: goal !== npc.goal ? goal : undefined,
    affinityDelta,
  };
}

/**
 * 对整个 NPC 世界推演一个 tick。
 * 返回所有 NPC 的行为结果。
 */
export function tickWorld(
  state: NpcEngineState,
  playerLocation: string,
  playerReputation: number,
): { newState: NpcEngineState; results: TickResult[] } {
  const results: TickResult[] = [];
  const newNpcs: Record<string, NpcBehavior> = {};

  for (const [id, npc] of Object.entries(state.npcs)) {
    const result = tickNpc(npc, playerLocation, playerReputation);
    results.push(result);

    newNpcs[id] = {
      ...npc,
      mood: result.moodChange ?? npc.mood,
      goal: result.goalChange ?? npc.goal,
      location: result.locationChange ?? npc.location,
      affinity: npc.affinity + (result.affinityDelta ?? 0),
      lastTick: Date.now(),
    };
  }

  return {
    newState: { npcs: newNpcs, tickCount: state.tickCount + 1 },
    results,
  };
}
