/**
 * v4.0.0 剧情元素库 — 通用剧情线索与交互元素池
 * 供 AI 在叙事中合理插入剧情线索，增强连贯性与世界沉浸。
 * @module systems/content/story-elements
 */

export interface StoryClue {
  id: string;
  type: 'rumor' | 'vision' | 'artifact' | 'document' | 'environmental';
  locationHint: string;
  desc: string;
  /** 关联的任务 id（如有） */
  questId?: string;
  /** 揭示所需的最低感知/智力值 */
  attributeGate?: { attr: string; value: number };
}

export interface LocationInteraction {
  id: string;
  locationId: string;
  name: string;
  emoji: string;
  type: 'npc' | 'object' | 'event' | 'hidden';
  desc: string;
  /** 交互后果 */
  outcome: string;
  /** 可否重复 */
  repeatable: boolean;
  /** 属性/技能门槛 */
  requirement?: { type: 'attr' | 'skill' | 'item'; key: string; value?: number };
}

/** 通用剧情线索库 */
export const STORY_CLUES: StoryClue[] = [
  {
    id: 'clue-dark-ritual',
    type: 'rumor',
    locationHint: '凛冬谷',
    desc: '守军闲聊时说：最近夜里塔楼北翼总有奇怪的吟唱声。拉尔夫队长让大家别去——他自己也没去。',
    questId: 'dark-ritual',
  },
  {
    id: 'clue-lost-heirloom',
    type: 'artifact',
    locationHint: '暮色森林',
    desc: '一个半埋在树根间的银质相框，里面的画像已经模糊不清。但相框背面刻着一行字：给我的小太阳。',
    attributeGate: { attr: 'wisdom', value: 3 },
  },
  {
    id: 'clue-shadow-march',
    type: 'vision',
    locationHint: '阴影山脉',
    desc: '你看见一支沉默的军队在远处山脊上行进。他们没有旗帜、没有火把——除了行走的声音，什么也没有。',
    attributeGate: { attr: 'perception', value: 3 },
  },
  {
    id: 'clue-gatekeepers-secret',
    type: 'document',
    locationHint: '黑曜石荒原',
    desc: '一份褪色的命令文书："第四道门一旦打开，就不允许再关上。此令不可违——G。"签名处已被烧焦。',
    questId: 'gatekeeper-secret',
  },
  {
    id: 'clue-watchman-last-note',
    type: 'document',
    locationHint: '凛冬谷',
    desc: '一张揉皱的纸条，只有一句话："如果天亮前我没回来，把教堂地下室的第三块石板撬开。"',
  },
  {
    id: 'clue-frozen-blood',
    type: 'environmental',
    locationHint: '龙脊冰峰',
    desc: '冰川表面上嵌着一大片暗红色的冻结血迹。范围之大，不像是任何凡人能够流出的血量。',
    attributeGate: { attr: 'intelligence', value: 4 },
  },
  {
    id: 'clue-wyvern-nest',
    type: 'environmental',
    locationHint: '阴影山脉',
    desc: '山壁上有一个巨大的巢穴，里面散落着人类大小的骨骼和破碎的盔甲碎片。但巢穴本身已经空了……很久了。',
  },
  {
    id: 'clue-ghost-merchant',
    type: 'rumor',
    locationHint: '荒芜平原',
    desc: '旅人之间流传着一个传说：在满月之夜，荒芜平原的十字路口会出现一个卖东西给死人的商人。他还活着的人的交易也接受——但价格不同。',
  },
];

/** 地点交互元素库 */
export const LOCATION_INTERACTIONS: LocationInteraction[] = [
  {
    id: 'int-frosthold-tower',
    locationId: 'frosthold-gate',
    name: '古老石门',
    emoji: '🏰',
    type: 'object',
    desc: '要塞主堡底层的一扇沉重石门，表面刻满了你从未见过的符文。石门的正中央——一个恰好适合手掌的凹槽。',
    outcome: '若拥有「冰霜之钥」，可解锁通往深渊地底的秘密通道。',
    repeatable: false,
    requirement: { type: 'item', key: 'frozen-key' },
  },
  {
    id: 'int-blacksmith',
    locationId: 'frosthold-gate',
    name: '铁匠铺',
    emoji: '⛏️',
    type: 'npc',
    desc: '老铁匠布鲁诺在铺子里捶打着什么。他瞥了你一眼：需要修理装备，还是想自己打点什么？',
    outcome: '可修理损坏装备、将材料锻造成武器/防具。',
    repeatable: true,
  },
  {
    id: 'int-ghost-tree',
    locationId: 'twilight-forest',
    name: '银叶巨树',
    emoji: '🌳',
    type: 'hidden',
    desc: '森林深处一棵通体银白的巨树，树干上有数以百计的刻痕——每一条都代表一个在此许下誓言的守夜人。',
    outcome: '在树下冥想可降低 3 点堕落值（仅限一次）。',
    repeatable: false,
  },
  {
    id: 'int-watchtower-ruins',
    locationId: 'shadow-mountains',
    name: '废弃瞭望塔',
    emoji: '🗼',
    type: 'object',
    desc: '一座被暗影侵蚀的古旧瞭望塔，墙上的守军印记已被某种黑色苔藓覆盖。但塔顶仍有一盏灯亮着——它已经亮了十三年。',
    outcome: '调查灯塔可触发隐藏剧情「永不熄灭的火焰」。',
    repeatable: false,
    requirement: { type: 'attr', key: 'wisdom', value: 4 },
  },
  {
    id: 'int-obsidian-forge',
    locationId: 'obsidian-wasteland',
    name: '黑曜石祭坛',
    emoji: '🔥',
    type: 'event',
    desc: '一块烧得暗红的黑曜石祭坛，周围散落着大量兽人的仪式用品。祭坛上方悬浮着一枚不断旋转的暗色火球。',
    outcome: '破坏祭坛可获得「暗影尘」x3 与随机武器，但会引来附近所有暗影生物。',
    repeatable: false,
  },
  {
    id: 'int-dragon-skeleton',
    locationId: 'dragon-peak',
    name: '冰龙遗骸',
    emoji: '🐉',
    type: 'object',
    desc: '一副完整的远古冰龙骨架，半埋在万年冰川之中。它的颅骨朝向正北——如同那仍是它要守护的方向。',
    outcome: '调查遗骸可获得「龙鳞碎片」与「源晶碎片」。',
    repeatable: false,
  },
  {
    id: 'int-nomad-camp',
    locationId: 'wasteland',
    name: '游牧营地',
    emoji: '🏕️',
    type: 'npc',
    desc: '一群雪原游牧民在此歇脚。首领是一个满脸皱纹的老妇人，她的眼睛比冰层还清澈。',
    outcome: '可与游牧民交易稀有物品、获得隐秘路径信息。若出身「雪原游牧民」则获得额外好感。',
    repeatable: true,
  },
];

/** 通用叙事钩子 — AI 可在适当时机触发 */
export const NARRATIVE_HOOKS: { id: string; trigger: string; hook: string }[] = [
  { id: 'hook-low-hp', trigger: 'HP < 30%', hook: '提示玩家当前伤势严重，可选择撤退、使用物品或放手一搏' },
  { id: 'hook-high-corruption', trigger: '堕落值 > 15', hook: '角色开始听到耳语、看到不存在的影子，暗影生物对你的态度可能改变' },
  { id: 'hook-first-night', trigger: '首次进入夜晚地图', hook: '提示玩家夜晚的凛冬要塞更加危险，但某些秘密只在夜间显露' },
  { id: 'hook-companion-trust', trigger: '同伴忠诚度 > 50', hook: '同伴主动分享一段记忆，解锁额外支线线索' },
  { id: 'hook-merchant-rare', trigger: '拥有 3+ 稀有物品', hook: '神秘商人出现，提供稀有物品交易' },
];
