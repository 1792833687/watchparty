/**
 * v4.1.0 多结局系统（world-setting 十一·多结局系统）
 *
 * 7 种结局：光明 3 / 黑暗 1 / 牺牲 1 / 隐藏真结局 1 / 湮灭 1。
 * 条件基于 endingFlags（AI 追踪的叙事进度）+ 堕落值 + 阵营声望 + 领地防御。
 * @module systems/endings/ending-system
 */

export type EndingId =
  | 'humanity'      // 人类纪元 — 光明·英雄
  | 'king'          // 王者归来 — 光明·国王
  | 'elves'         // 精灵西渡 — 光明·传承
  | 'dwarves'       // 矮人复兴 — 光明·工匠
  | 'darklord'      // 魔君陨落 — 黑暗·英雄
  | 'sacrifice'     // 最后的联盟 — 光明·牺牲
  | 'void'          // 虚空守望者 — 隐藏·真结局
  | 'oblivion';     // 湮灭 — 堕落结局

export type EndingType = '光明·英雄' | '光明·国王' | '光明·传承' | '光明·工匠' | '黑暗·英雄' | '光明·牺牲' | '隐藏·真结局' | '湮灭';

export interface EndingConditionContext {
  /** AI 追踪的结局条件进度（corruption峰值/crown王权线/diplomacy外交线/sacrifice牺牲线/alone孤独线/oblivion湮灭/void虚空） */
  endingFlags: Record<string, number>;
  /** 当前堕落值 0-100 */
  corruption: number;
  /** 阵营声望（全阵营平均值用于真结局判定） */
  factionReputations: Record<string, number>;
  /** 领地防御值 */
  defense: number;
  /** 是否完成艾拉剧情线 */
  ailaCompleted: boolean;
  /** 当前天数 */
  dayCount: number;
  /** 是否已触发过围城战 */
  siegesSurvived: number;
  /** 主任务是否完成 */
  mainQuestCompleted: boolean;
}

export interface EndingDef {
  id: EndingId;
  name: string;
  type: EndingType;
  icon: string;
  color: string;
  title: string;
  summary: string;
  /** 是否满足触发条件 */
  check: (ctx: EndingConditionContext) => boolean;
  /** 触发优先级（同时满足多个时取数字最小者，0 最高） */
  priority: number;
  /** 生成《致领主书》 */
  letter: (ctx: EndingConditionContext) => string;
}

/** 敌对阵营（平均值计算时排除，P1-5 修复——此前把黑暗军团 -40 计入平均导致真结局数学上不可达） */
const HOSTILE_FACTIONS = new Set(['dark-legion', 'black-obsidian', 'shadow-legion', 'dark-lord']);

/** 阵营平均声望（排除敌对阵营；真结局要求的是"盟友的信任"，不是"敌人的畏惧"） */
function avgReputation(reps: Record<string, number>): number {
  const values = Object.entries(reps)
    .filter(([fid]) => !HOSTILE_FACTIONS.has(fid))
    .map(([, v]) => v);
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export const ENDINGS: EndingDef[] = [
  {
    id: 'oblivion',
    name: '湮灭',
    type: '湮灭',
    icon: '🕳️',
    color: '#8B0000',
    title: '你的灵魂沉入虚空，要塞在永夜中崩塌',
    summary: '堕落值抵达 100。暗影彻底吞噬了你——你成为了你最想击败的东西。凛冬要塞的烽火永远熄灭。',
    priority: 0,
    check: (ctx) => ctx.corruption >= 100,
    letter: (ctx) => {
      // v5.0.0 (叙事 3.5/3.8): 裁决「代价是自我」+ 艾拉回响
      const ailaLine = ctx.ailaCompleted
        ? '\n在要塞废墟的哭声被你听见的那一夜之后，艾拉学会了用灰烬写字。她写的第一行字是：\'你答应过要回来。\'现在，她守着这行字，守着空荡荡的城墙。\n'
        : '\n有人说起要塞墙角还住着一个小女孩，她说你在梦里答应过她一件事。无人知道那是什么。\n';
      return (
        '致凛冬要塞最后的领主：\n\n' +
        '当你读到这封信时，我们已经不认识你了。或者说，你也不再认识自己。\n' +
        '主堡大厅里的肖像依然是你——但画中人的眼睛已经变成两团燃烧的暗影。\n' +
        '你赢下了每一场战斗，却输掉了唯一重要的那场：与自己的战争。\n' +
        '你得到了所有力量，代价是所有人——包括你自己。\n' +
        ailaLine +
        '—— 署名：曾经的同伴'
      );
    },
  },
  {
    id: 'void',
    name: '虚空守望者',
    type: '隐藏·真结局',
    icon: '🌌',
    color: '#1A1A2E',
    title: '你站在世界的边缘，成为新的守望者',
    summary: '集齐预言碎片、行走于光明与黑暗的钢丝之上，你做出了最终的选择——「新的誓约」。世界需要一位不属于任何阵营的守望者。',
    priority: 1,
    check: (ctx) =>
      (ctx.endingFlags.void ?? 0) >= 10 &&           // 预言碎片集齐（AI 追踪）
      ctx.corruption >= 40 && ctx.corruption <= 60 && // 堕落 40-60
      avgReputation(ctx.factionReputations) >= 60 && // 全阵营 ≥60
      (ctx.endingFlags.trials ?? 0) >= 3 &&           // 完成所有审判
      ctx.ailaCompleted &&                             // 艾拉剧情线完成
      (ctx.endingFlags.oath ?? 0) >= 1,               // 选择「新的誓约」
    letter: (ctx) =>
      // v5.0.0 (叙事 3.5): 裁决「代价是永恒孤独」；3.8: 艾拉成为守望者第一位学徒
      `致第 ${ctx.dayCount} 天仍站在瞭望塔上的你：\n\n` +
      '他们说世界需要英雄，但英雄都带着阵营的枷锁。\n' +
      '你见过光明的虚伪，也尝过黑暗的甜美。你既不属于王座，也不属于圣坛。\n' +
      '于是你选择了第三条路——成为虚空与现世之间的守望者。\n' +
      '从今往后，每当世界在善恶的边界上摇摇欲坠，都会有一双不带立场的眼睛注视。\n' +
      '你走完了前任守夜人鸦羽走过的路——但他坠落了，你没有。你打破了他的镜像。\n' +
      '代价是永恒：你不会属于任何一个黎明，只属于每一个临界时刻。\n' +
      (ctx.ailaCompleted
        ? '\n而艾拉——她在你身后学会了守望。她不再问你会不会回来，因为她知道你会站在哪儿，一直都在。她成了你的第一位学徒。\n'
        : '\n远处废墟里，有一盏灯从你守望的第一个夜晚亮起，再未熄灭。\n') +
      '—— 署名：艾拉（她终于学会了写字）',
  },
  {
    id: 'sacrifice',
    name: '最后的联盟',
    type: '光明·牺牲',
    icon: '🕯️',
    color: '#E8E0D5',
    title: '你点燃了自己，照亮了整片大陆',
    summary: '魔君的大军兵临城下，联军节节败退。你选择了最古老也最光荣的结局——献祭自己，换取联盟的胜利。',
    priority: 2,
    check: (ctx) =>
      (ctx.endingFlags.sacrifice ?? 0) >= 10 &&
      ctx.mainQuestCompleted &&
      ctx.corruption < 80,
    letter: (ctx) =>
      // v5.0.0 (叙事 3.5): 裁决「代价是生命」；3.8: 艾拉守望烽火
      '致那位点燃烽火的人：\n\n' +
      '我们赢了。以你为代价。\n' +
      '当你的火焰在大军中央升起时，连渊主都后退了一步。影仆的队列在那一瞬间溃散——不是因为恐惧，而是因为敬畏。\n' +
      '要塞的城墙将永远镌刻你的名字。孩子们会问起你，我们会说：他选择了我们所有人——他付出的代价是生命本身。\n' +
      (ctx.ailaCompleted
        ? '\n艾拉每天清晨会去城头，替你看着第一缕光。她说这是你教她的守夜。\n'
        : '\n城头有一把椅子，始终空着，也始终没人坐。\n') +
      '—— 署名：并肩作战的战友',
  },
  {
    id: 'darklord',
    name: '魔君陨落',
    type: '黑暗·英雄',
    icon: '🌑',
    color: '#6B3FA0',
    title: '魔君陨落了，但你成为了新的魔君',
    summary: '你以暗影之力击败了魔君，拯救了世界——但代价是你自己被彻底腐化。黑暗英雄，或许是最讽刺的称号。',
    priority: 3,
    check: (ctx) =>
      (ctx.endingFlags.oblivion ?? 0) >= 10 &&
      ctx.mainQuestCompleted &&
      ctx.corruption >= 80 && ctx.corruption < 100,
    letter: (ctx) =>
      // v5.0.0 (叙事 3.5): 裁决「代价是自我」；3.8: 艾拉成为暗影术士（呼应主角）
      '致坐上黑色王座的那位：\n\n' +
      '你杀了渊主。全世界都看到了那一剑——带着暗影烈焰的一剑。\n' +
      '人们欢呼了三秒。然后他们看见你的眼睛，欢呼变成了沉默。\n' +
      '渊主陨落了。但王座没有空着。\n' +
      '你赢了世界，代价是你自己——鸦羽的影子与你合而为一，这一次没有镜像可破。\n' +
      (ctx.ailaCompleted
        ? '\n艾拉后来离开了要塞。有人说她跟着暗影走了，眼里的光像你堕落前的最后一晚。她再也没有回来。\n'
        : '\n再没有人提起要塞墙角那个唱歌的小女孩。\n') +
      '—— 署名：逃向西边的幽林精灵',
  },
  {
    id: 'king',
    name: '王者归来',
    type: '光明·国王',
    icon: '👑',
    color: '#C9A94E',
    title: '旧王国的血脉在你身上苏醒',
    summary: '你与白石结盟，集结了六大区域的力量，重建了人类王国。王座上的不是昔日的阴影，而是崭新的希望。',
    priority: 4,
    check: (ctx) =>
      (ctx.endingFlags.crown ?? 0) >= 10 &&
      (ctx.factionReputations.gondor ?? 0) >= 60 &&
      ctx.mainQuestCompleted &&
      ctx.corruption < 20,
    letter: (ctx) =>
      // v5.0.0 (叙事 3.5): 裁决「代价是自由」；3.8: 艾拉成为王宫里的养女/见习文书
      `致第 ${ctx.dayCount} 天加冕的国王：\n\n` +
      '银树再次开花了。这是三百年来第一次。\n' +
      '人们说你是个奇怪的国王——你会亲自修补城墙，会在宴会上为卫兵斟酒。\n' +
      '但正是这样的你，让凛冬要塞的烽火从熄灭的边缘重新燃起。\n' +
      '王冠很重。你把它戴上了——这是你为这份力量付出的代价：你不再能像一个旅人那样自由地走向任何远方。\n' +
      (ctx.ailaCompleted
        ? '\n艾拉住在王宫东边的小院里，学着文书与算术。她偶尔爬上城墙，说想看看你守卫的地方，像从前一样。\n'
        : '\n王座旁常年放着一只褪色的布偶，无人知道来历，也无人敢动。\n') +
      '—— 署名：白石的摄政大臣',
  },
  {
    id: 'humanity',
    name: '人类纪元',
    type: '光明·英雄',
    icon: '🌅',
    color: '#E8843C',
    title: '暗影退去，人类纪元开启',
    summary: '堕落值从未越过界限，你以纯粹的意志守护了要塞。所有阵营团结在你的旗帜下，黑暗纪元落幕。',
    priority: 5,
    check: (ctx) =>
      ctx.corruption < 20 &&
      avgReputation(ctx.factionReputations) >= 60 &&
      ctx.mainQuestCompleted,
    letter: (ctx) =>
      // v5.0.0 (叙事 3.5): 裁决「代价由他人承担」；3.8: 艾拉是幸存者/要塞的女儿
      '致那位从未向黑暗低头的领主：\n\n' +
      '暗影退去了。像潮水一样退去，露出久违的土地。\n' +
      '我们这一代人，第一次在没有战鼓声的清晨醒来。\n' +
      '你的要塞依然矗立——不是因为它有多坚固，而是因为站在墙后的人从未动摇。\n' +
      '但请记得：这份黎明，是许多人为你承担了代价换来的——你站的墙，每一块砖下都埋着别人的名字。\n' +
      (ctx.ailaCompleted
        ? '\n艾拉在最亮的那天早晨跑过整个要塞，把城门钥匙挂回原位。她说：\'守住了，对吗？\'对，守住了。\n'
        : '\n城门钥匙被重新打造的那天，要塞的孩子们排着队摸了摸它，像摸一件圣物。\n') +
      '—— 署名：要塞的每一个居民',
  },
  {
    id: 'elves',
    name: '精灵西渡',
    type: '光明·传承',
    icon: '🚢',
    color: '#4A7C59',
    title: '你护送精灵们驶向西方的渡口',
    summary: '灰港的船帆扬起，精灵们带着古老的智慧与悲伤离开了中洲。世界失去了永恒，却获得了延续。',
    priority: 6,
    check: (ctx) =>
      (ctx.endingFlags.elves ?? 0) >= 10 &&
      ctx.mainQuestCompleted &&
      ctx.corruption < 50,
    letter: (ctx) =>
      // v5.0.0 (叙事 3.5): 裁决「代价是遗忘」；3.8: 艾拉随精灵习医/临别
      '致那位在灰港送行的人：\n\n' +
      '船已经驶出很远，但岸边的火把依然亮着。我们知道那是你。\n' +
      '幽林精灵从不忘却。我们会记得你的名字，记得你在最后一刻的选择。\n' +
      '世界属于人类了。请温柔地对待她。\n' +
      '你付出的代价是遗忘：离开的船载走了牵挂，而留下的你，将用余生记住所有被遗忘的名字。\n' +
      (ctx.ailaCompleted
        ? '\n艾拉上了最后一条船。她在甲板上远远看着你，像当年在废墟里看你那样——她跟精灵学了医，说这样就算你老去，也有人记得你的伤口。\n'
        : '\n最后一条船的船尾，挂着一只褪色的布偶，向着要塞的方向。\n') +
      '—— 署名：最后一批西渡的幽林精灵',
  },
  {
    id: 'dwarves',
    name: '矮人复兴',
    type: '光明·工匠',
    icon: '⛏️',
    color: '#8B6914',
    title: '灰炉山重燃锻火，矮人王国复兴',
    summary: '你帮助矮人收复了灰炉山。熔炉重新燃起，矮人的战锤与歌谣再次响彻山脉。',
    priority: 7,
    check: (ctx) =>
      (ctx.endingFlags.dwarves ?? 0) >= 10 &&
      ctx.mainQuestCompleted &&
      ctx.corruption < 50,
    letter: (ctx) =>
      // v5.0.0 (叙事 3.5): 裁决「代价是执念」；3.8: 艾拉在灰炉山
      '致那位敲开灰炉山大门的英雄：\n\n' +
      '第一炉铁水出来的时候，整个灰炉山都在颤抖——那是三百年来的第一炉。\n' +
      '矮人用最古老的誓言记住了你：你的事迹将刻在山腹最深处的石壁上。\n' +
      '但你最清楚那份代价：复兴是一条执念的闭环——你追回了故土，却再也停不下为它锻造的锤声。\n' +
      (ctx.ailaCompleted
        ? '\n艾拉跟着矮人学打铁。她说要塞的剑该有人修——她学会了在炉火边等你，像从前在墙根下等你一样。\n'
        : '\n灰炉山的山口，多了一块无名铁砧，据说等它的主人回来。\n') +
      '来喝酒吧。管够。\n\n' +
      '—— 署名：灰炉山新王',
  },
];

/** 判定当前触发的结局（多个满足时按 priority 取最高；无则 null） */
export function evaluateEnding(ctx: EndingConditionContext): EndingDef | null {
  const candidates = ENDINGS.filter((e) => e.check(ctx));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.priority - b.priority);
  return candidates[0]!;
}

/** 给 AI 的结局条件提示文本（注入系统 prompt） */
export function buildEndingPrompt(ctx: EndingConditionContext): string {
  const flags = Object.entries(ctx.endingFlags)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  return `【多结局系统 — 7 种结局】（world-setting 十一）
当前结局条件进度：${flags || '暂无'}
堕落值：${ctx.corruption}/100，阵营平均声望：${Math.round(avgReputation(ctx.factionReputations))}
  - 光明·英雄「人类纪元」：堕落<20 + 全阵营≥60 + 主线完成
  - 光明·国王「王者归来」：crown≥10 + 白石≥60 + 主线完成 + 堕落<20
  - 光明·传承「精灵西渡」：elves≥10 + 主线完成 + 堕落<50
  - 光明·工匠「矮人复兴」：dwarves≥10 + 主线完成 + 堕落<50
  - 黑暗·英雄「魔君陨落」：oblivion≥10 + 主线完成 + 堕落80-99
  - 光明·牺牲「最后的联盟」：sacrifice≥10 + 主线完成 + 堕落<80
  - 隐藏·真结局「虚空守望者」：void≥10 + 堕落40-60 + 全阵营≥60 + trials≥3 + 艾拉线完成 + oath≥1
  - 湮灭：堕落=100 立即触发
请通过 ---GAMESTATE--- 的 endingFlags 追踪关键进度：corruption=堕落峰值/crown=王权线/elves=精灵线/dwarves=矮人线/diplomacy=外交线/sacrifice=牺牲线/oblivion=黑暗线/void=虚空线/trials=审判次数/oath=誓约抉择。`;
}
