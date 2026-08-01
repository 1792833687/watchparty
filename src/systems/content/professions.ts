/**
 * v4.0.0 职业系统 — 12 职业定义
 * 职业与出身已拆分为独立系统。
 * 每个职业含独特技能、属性加成与专精学派。
 *
 * v4.2.0 语义统一（P2-3）：starterSkills 字段 = 该职业的「推荐技能路径」，
 * 仅作为技能树/剧情中 AI 引导玩家优先获取的参考，**不再开局授予**。
 * 玩家开局无任何技能，需通过剧情/探索/导师传授逐步习得（见 GAMESTATE.skills 协议）。
 * @module systems/content/professions
 */

export interface ProfessionSkill {
  name: string;
  desc: string;
  /** 所属技能学派 */
  school?: string;
  /** 职业专属 flag */
  signature?: boolean;
}

/** v4.1.0: 职业独特机制 */
export interface ClassMechanic {
  name: string;
  desc: string;
  /** 触发条件类型 */
  trigger: 'passive' | 'onHit' | 'onKill' | 'onLowHp' | 'onCrit' | 'onDodge' | 'onHeal' | 'onSpell' | 'onStart';
  /** 效果描述 */
  effect: string;
  /** 冷却回合数（0=无冷却） */
  cooldown?: number;
}

export interface Profession {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  /** 战斗角色定位 */
  role: 'warrior' | 'tank' | 'assassin' | 'ranger' | 'mage' | 'healer' | 'druid' | 'monk' | 'paladin' | 'warlock' | 'bard' | 'artificer';
  roleLabel: string;
  /** 属性修正（加在 base 之上） */
  attrMods: Partial<Record<'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma', number>>;
  /** 专精魔法学派 */
  preferredSchools?: string[];
  /** 职业专属技能 */
  skills: ProfessionSkill[];
  /** 起始装备名称 */
  startingGear: string[];
  /** 玩法风格简述 */
  playstyle: string;
  /** 上手难度 1-5 */
  difficulty: number;
  /** v4.1.0: 职业独特机制 */
  mechanics?: ClassMechanic[];
  /** v4.1.0: 成长曲线（world-setting 三·成长）— 每级成长 */
  growth?: {
    /** 每级生命成长 */
    hpPerLevel: number;
    /** 每级法力成长 */
    mpPerLevel: number;
    /** 属性成长倾向：每 2 级主属性 +1 的权重（值越大成长越快） */
    attrWeights?: Partial<Record<'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma', number>>;
  };
  /** v4.1.0: 开局自带的基础技能名（对应 skillCategories 中的 tier1 技能） */
  starterSkills?: string[];
}

export const PROFESSIONS: Profession[] = [
  // ==================== 1. 战士 ====================
  {
    id: 'warrior',
    name: '战士',
    emoji: '⚔️',
    desc: '在前线挥剑如雷的勇士。你不需要魔法，因为钢铁本身就是最好的答案。',
    role: 'warrior',
    roleLabel: '近战输出',
    attrMods: { strength: 3, constitution: 2, dexterity: 1 },
    preferredSchools: ['武技'],
    skills: [
      { name: '裂甲斩', desc: '无视目标的护甲值，造成额外伤害', school: '武技', signature: true },
      { name: '战吼', desc: '激励附近同伴，短暂提升全体攻击力', school: '武技' },
      { name: '钢铁意志', desc: '陷入控制时自动触发，解除并免疫 2 回合', school: '防护' },
    ],
    startingGear: ['双手长剑', '铁制护腕', '战士口粮 x2'],
    playstyle: '正面冲锋、高物理输出、能扛能打',
    difficulty: 1,
    mechanics: [
      { name: '怒气爆发', desc: '每造成 3 次伤害后，下次攻击伤害 +30%', trigger: 'onHit', effect: '伤害+30%' },
      { name: '钢铁皮肤', desc: '生命高于 80% 时，免伤 10%', trigger: 'passive', effect: '免伤10%' },
    ],
    growth: { hpPerLevel: 10, mpPerLevel: 2, attrWeights: { strength: 3, constitution: 2, dexterity: 1 } },
    starterSkills: ['裂甲斩', '战吼'],
  },
  // ==================== 2. 圣骑士 ====================
  {
    id: 'paladin',
    name: '圣骑士',
    emoji: '🛡️',
    desc: '以誓言铸成铠甲，以信仰当作利剑。光明是你唯一的行军路线。',
    role: 'paladin',
    roleLabel: '坦克 / 辅助',
    attrMods: { strength: 2, constitution: 3, charisma: 1 },
    preferredSchools: ['神圣', '防护'],
    skills: [
      { name: '圣光裁决', desc: '对暗影生物造成双倍伤害，附加致盲', school: '神��', signature: true },
      { name: '守护光环', desc: '为一名同伴承担 40% 伤害，持续 3 回合', school: '防护' },
      { name: '圣疗', desc: '瞬间回复目标 35% 最大生命值，每场战斗限一次', school: '神圣' },
    ],
    startingGear: ['圣骑士盾牌', '圣典残页', '白蜡木权杖'],
    playstyle: '坦克兼治疗，克制暗影生物，团队支柱',
    difficulty: 2,
    mechanics: [
      { name: '神圣壁垒', desc: '格挡成功时回复少量生命并给队友提供护盾', trigger: 'onHit', effect: '格挡回血+护盾' },
      { name: '制裁之光', desc: '对暗影生物的攻击造成额外 25% 神圣伤害', trigger: 'onHit', effect: '对暗影+25%伤害' },
      { name: '守护誓言', desc: '生命低于 30% 时自动施加无敌 1 回合（每场战斗限一次）', trigger: 'onLowHp', effect: '濒死无敌1回合' },
    ],
    growth: { hpPerLevel: 10, mpPerLevel: 4, attrWeights: { constitution: 3, strength: 2, charisma: 2 } },
    starterSkills: ['圣光裁决', '守护光环'],
  },
  // ==================== 3. 刺客 ====================
  {
    id: 'assassin',
    name: '暗影行者',
    emoji: '🗡️',
    desc: '你在黑暗中行走，比黑暗本身更安静。目标的脖子上永远只有一声轻响。',
    role: 'assassin',
    roleLabel: '爆发刺客',
    attrMods: { dexterity: 3, intelligence: 2, strength: 1 },
    preferredSchools: ['咒法'],
    skills: [
      { name: '影步', desc: '进入隐身状态，下一次攻击必暴击', school: '咒法', signature: true },
      { name: '淬毒刃', desc: '攻击附带持续毒素伤害，持续 3 回合', school: '咒法' },
      { name: '弱点洞察', desc: '标记目标弱点，全队对其伤害提升 25%', school: '预言' },
    ],
    startingGear: ['双持短刃', '毒药瓶 x2', '夜行斗篷'],
    playstyle: '隐身爆发、单体秒杀、高暴击高风险',
    difficulty: 3,
    mechanics: [
      { name: '背刺暴击', desc: '从背后/隐身发动的攻击必定暴击且暴击伤害 +50%', trigger: 'onCrit', effect: '背刺必暴击+50%伤害' },
      { name: '影袭连击', desc: '击杀目标后立即获得一次额外行动机会', trigger: 'onKill', effect: '击杀后再行动' },
      { name: '闪避大师', desc: '闪避成功时获得「影步」效果，下次攻击必暴击', trigger: 'onDodge', effect: '闪避后必暴击' },
    ],
    growth: { hpPerLevel: 7, mpPerLevel: 3, attrWeights: { dexterity: 3, intelligence: 2, strength: 1 } },
    starterSkills: ['影步', '淬毒刃'],
  },
  // ==================== 4. 游侠 ====================
  {
    id: 'ranger',
    name: '游侠',
    emoji: '🏹',
    desc: '荒野是你唯一信任的盟友。你会在敌人看见你之前，先看见他们的死亡。',
    role: 'ranger',
    roleLabel: '远程 / 侦查',
    attrMods: { dexterity: 3, wisdom: 2, constitution: 1 },
    preferredSchools: ['预言', '幻术'],
    skills: [
      { name: '鹰眼射击', desc: '无视距离惩罚，提高精准与暴击率', school: '预言', signature: true },
      { name: '陷阱大师', desc: '在当前位置布设陷阱，触发后造成范围伤害并减速', school: '变化' },
      { name: '自然伪装', desc: '在野外环境中自动获得潜行效果', school: '幻术' },
    ],
    startingGear: ['猎弓', '响箭 x20', '草药包 x2'],
    playstyle: '远程风筝、野外侦查、陷阱控制',
    difficulty: 2,
    mechanics: [
      { name: '百步穿杨', desc: '远程攻击无视 1 点敌人护甲，射程内无距离惩罚', trigger: 'passive', effect: '远程破甲1' },
      { name: '猎人印记', desc: '标记目标后对其伤害 +20%，持续 3 回合', trigger: 'onStart', effect: '标记增伤20%' },
      { name: '致命一击', desc: '对生命低于 20% 的目标暴击率翻倍', trigger: 'onHit', effect: '斩杀线暴击翻倍' },
    ],
    growth: { hpPerLevel: 8, mpPerLevel: 3, attrWeights: { dexterity: 3, wisdom: 2, constitution: 1 } },
    starterSkills: ['鹰眼射击', '陷阱大师'],
  },
  // ==================== 5. 法师 ====================
  {
    id: 'mage',
    name: '奥术法师',
    emoji: '🔮',
    desc: '你读过的每一行符文都在血管里燃烧。奥术不为虔诚者敞开，只为理解它的人。',
    role: 'mage',
    roleLabel: '远程法术',
    attrMods: { intelligence: 4, wisdom: 2 },
    preferredSchools: ['塑能', '咒法'],
    skills: [
      { name: '奥术飞弹', desc: '发射 3 枚必中飞弹，分别造成奥术伤害', school: '塑能', signature: true },
      { name: '魔法护盾', desc: '消耗法力创造护盾，吸收相当于智力*3 的伤害', school: '防护' },
      { name: '奥术智慧', desc: '永久提升一名同伴的最大法力值', school: '变化' },
    ],
    startingGear: ['学徒法杖', '法力药剂 x3', '低阶符文石'],
    playstyle: '高爆发法术、远程炮台、法力管理核心',
    difficulty: 3,
    mechanics: [
      { name: '法术专精', desc: '奥术法术伤害 +15%，法力消耗 -10%', trigger: 'passive', effect: '法术伤害+15%' },
      { name: '奥术回响', desc: '施法暴击时获得额外一次低阶法术机会', trigger: 'onSpell', effect: '施法暴击追打' },
      { name: '法力护盾', desc: '受到致命伤害时以法力抵消（每场战斗限一次）', trigger: 'onLowHp', effect: '法力抵命一次' },
    ],
    growth: { hpPerLevel: 6, mpPerLevel: 8, attrWeights: { intelligence: 4, wisdom: 2 } },
    starterSkills: ['奥术飞弹', '魔法护盾'],
  },
  // ==================== 6. 术士 ====================
  {
    id: 'warlock',
    name: '暗影术士',
    emoji: '🕯️',
    desc: '你曾与暗影对视，而暗影先眨了眼。代价？你正在用余生偿还。',
    role: 'warlock',
    roleLabel: '暗影法师',
    attrMods: { intelligence: 3, charisma: 2, constitution: 1 },
    preferredSchools: ['死灵', '咒法'],
    skills: [
      { name: '暗影契约', desc: '消耗 10% 生命值换取双倍法力回复，持续 3 回合（+1 堕落）', school: '死灵', signature: true },
      { name: '痛苦诅咒', desc: '为目标施加痛苦诅咒，每回合流失生命并将 30% 转化为术士生命', school: '死灵' },
      { name: '恶魔之眼', desc: '揭示目标的隐藏属性与弱点', school: '咒法' },
    ],
    startingGear: ['献祭匕首', '黑色羊皮纸 x2', '缚魂水晶'],
    playstyle: '高风险高回报、生命换法力、堕落管理',
    difficulty: 4,
    mechanics: [
      { name: '暗影契约', desc: '消耗 10% 生命换取双倍法力回复，持续 3 回合（+1 堕落）', trigger: 'onStart', effect: '生命换法力' },
      { name: '灵魂汲取', desc: '击杀敌人时回复法力并降低 1 点堕落值', trigger: 'onKill', effect: '击杀回蓝' },
      { name: '暗影步', desc: '生命低于 40% 时暗影法术伤害 +30%', trigger: 'onLowHp', effect: '低血暗影增伤' },
    ],
    growth: { hpPerLevel: 7, mpPerLevel: 6, attrWeights: { intelligence: 3, charisma: 2, constitution: 1 } },
    starterSkills: ['暗影契约', '痛苦诅咒'],
  },
  // ==================== 7. 牧师 ====================
  {
    id: 'healer',
    name: '光明牧师',
    emoji: '⛪',
    desc: '你手中的光不只是治愈伤口——它也照亮那些连阳光都不敢触碰的角落。',
    role: 'healer',
    roleLabel: '治疗 / 驱邪',
    attrMods: { wisdom: 3, charisma: 2, intelligence: 1 },
    preferredSchools: ['神圣'],
    skills: [
      { name: '圣疗光环', desc: '全队每回合回复少量生命，持续 3 回合', school: '神圣', signature: true },
      { name: '驱散黑暗', desc: '移除一名同伴的负面效果与低堕落值', school: '神圣' },
      { name: '复生祷言', desc: '在战斗外复活一名阵亡同伴（需完整休息）', school: '神圣' },
    ],
    startingGear: ['光明权杖', '圣水 x2', '绷带卷 x3'],
    playstyle: 'AOE 治疗、驱散专家、不死族杀手',
    difficulty: 1,
    mechanics: [
      { name: '神圣眷顾', desc: '所有治疗法术效果 +20%，对不死生物法术伤害 +30%', trigger: 'passive', effect: '治疗+20%' },
      { name: '治愈涌动', desc: '过量治疗转化为临时护盾，护盾值最高为生命上限的 30%', trigger: 'onHeal', effect: '溢出治疗转护盾' },
      { name: '圣言庇护', desc: '同伴濒死时自动为其回复 15% 生命（每场战斗限三次）', trigger: 'onHeal', effect: '濒死自动回血' },
    ],
    growth: { hpPerLevel: 8, mpPerLevel: 6, attrWeights: { wisdom: 3, charisma: 2, intelligence: 1 } },
    starterSkills: ['圣疗光环', '驱散黑暗'],
  },
  // ==================== 8. 德鲁伊 ====================
  {
    id: 'druid',
    name: '荒野德鲁伊',
    emoji: '🌿',
    desc: '你不是森林的守护者——你就是森林。每一片落叶都认得你的名字。',
    role: 'druid',
    roleLabel: '变形 / 自然',
    attrMods: { wisdom: 3, constitution: 2, dexterity: 1 },
    preferredSchools: ['变化', '神圣'],
    skills: [
      { name: '熊形态', desc: '变形为熊，生命/护甲大幅提升，持续 3 回合', school: '变化', signature: true },
      { name: '荆棘缠绕', desc: '地面生长荆棘，范围内的敌人每回合受伤且减速', school: '变化' },
      { name: '自然愈疗', desc: '单目标持续回复生命，对亡灵无效', school: '神圣' },
    ],
    startingGear: ['橡木图腾', '野莓干 x3', '草药镰刀'],
    playstyle: '形态切换、自然法术、持续作战',
    difficulty: 3,
    mechanics: [
      { name: '自然亲和', desc: '在野外/林地地形中每回合回复少量生命与法力', trigger: 'passive', effect: '野外持续回复' },
      { name: '野性变形', desc: '变形形态下受到伤害 -20%，且每次攻击附带自然伤害', trigger: 'onStart', effect: '变形减伤20%' },
      { name: '林地复苏', desc: '自身治疗溢出时转化 50% 为全队共享回复', trigger: 'onHeal', effect: '溢出转群疗' },
    ],
    growth: { hpPerLevel: 9, mpPerLevel: 5, attrWeights: { wisdom: 3, constitution: 2, dexterity: 1 } },
    starterSkills: ['熊形态', '自然愈疗'],
  },
  // ==================== 9. 武僧 ====================
  {
    id: 'monk',
    name: '影流武僧',
    emoji: '🥋',
    desc: '你的拳头比言语诚实，你的步伐比命运安静。内在的平衡就是你唯一的武器。',
    role: 'monk',
    roleLabel: '近战 / 气功',
    attrMods: { dexterity: 2, wisdom: 2, strength: 2 },
    preferredSchools: ['武技', '预言'],
    skills: [
      { name: '碎骨掌', desc: '无视护甲的直接内伤攻击，附加短暂眩晕', school: '武技', signature: true },
      { name: '气场感知', desc: '感知周围 30 码内所有生物的意图（友善/敌意）', school: '预言' },
      { name: '借力打力', desc: '将下一次受到的物理攻击 50% 伤害反弹', school: '武技' },
    ],
    startingGear: ['僧袍', '冥想石', '草药茶 x2'],
    playstyle: '高速连击、感知优先、反制专家',
    difficulty: 3,
    mechanics: [
      { name: '气之流转', desc: '每回合开始获得 1 层气劲，气劲层数提升连击伤害', trigger: 'onStart', effect: '气劲叠伤' },
      { name: '以柔克刚', desc: '成功闪避后反弹 50% 物理伤害给攻击者', trigger: 'onDodge', effect: '闪避反弹50%' },
      { name: '金刚不坏', desc: '生命低于 25% 时获得「金刚」状态：免伤 40% 持续 2 回合', trigger: 'onLowHp', effect: '濒死金刚免伤' },
    ],
    growth: { hpPerLevel: 9, mpPerLevel: 4, attrWeights: { dexterity: 2, wisdom: 2, strength: 2 } },
    starterSkills: ['碎骨掌', '气场感知'],
  },
  // ==================== 10. 吟游诗人 ====================
  {
    id: 'bard',
    name: '吟游诗人',
    emoji: '🎵',
    desc: '你不需要剑才能改变世界。一首歌，一段故事，有时比一支军队更有用。',
    role: 'bard',
    roleLabel: '辅助 / 控场',
    attrMods: { charisma: 3, dexterity: 2, intelligence: 1 },
    preferredSchools: ['幻术', '变化'],
    skills: [
      { name: '战歌鼓舞', desc: '全队攻击力与速度提升，持续 3 回合', school: '幻术', signature: true },
      { name: '魅惑之音', desc: '使一名敌人陷入魅惑，为你战斗 2 回合', school: '幻术' },
      { name: '传奇叙事', desc: '讲述一段传奇，为全队恢复少量生命与法力', school: '变化' },
    ],
    startingGear: ['鲁特琴', '羽毛笔与墨水', '香料酒 x2'],
    playstyle: 'Buff/Debuff 大师、社交王牌、多面手',
    difficulty: 4,
    mechanics: [
      { name: '灵感乐章', desc: '每次施放增益/减益法术时，为全队叠加 5% 攻击加成', trigger: 'onSpell', effect: 'buff叠攻' },
      { name: '命运低语', desc: '每场战斗可重掷一次失败检定（叙事与战斗通用）', trigger: 'onStart', effect: '重掷一次' },
      { name: '鼓舞战歌', desc: '同伴行动失败时回复其 10% 生命并提升士气', trigger: 'onStart', effect: '失败后鼓舞' },
    ],
    growth: { hpPerLevel: 7, mpPerLevel: 6, attrWeights: { charisma: 3, dexterity: 2, intelligence: 1 } },
    starterSkills: ['战歌鼓舞', '魅惑之音'],
  },
  // ==================== 11. 工匠大师 ====================
  {
    id: 'artificer',
    name: '符文工匠',
    emoji: '⚙️',
    desc: '你相信万物皆有结构——包括魔法。你拆解它，重组它，然后把它变成自己想要的形状。',
    role: 'artificer',
    roleLabel: '制造 / 爆破',
    attrMods: { intelligence: 3, dexterity: 2, constitution: 1 },
    preferredSchools: ['塑能', '变化'],
    skills: [
      { name: '符文炸弹', desc: '投掷自制炸弹造成范围火焰伤害，附带破甲', school: '塑能', signature: true },
      { name: '附魔灌注', desc: '临时为一件装备附加随机词缀，持续当前地下城', school: '变化' },
      { name: '机械哨兵', desc: '部署一台小型机械哨兵，自动攻击最近的敌人 3 回合', school: '塑能' },
    ],
    startingGear: ['工程师扳手', '火药 x3', '黄铜齿轮 x2'],
    playstyle: '制造专家、爆炸输出、装备附魔',
    difficulty: 4,
    mechanics: [
      { name: '过载', desc: '暴击时引爆充能，对目标周围造成范围伤害', trigger: 'onCrit', effect: '暴击范围爆炸' },
      { name: '装备改造', desc: '装备的附魔效果提升 30%，且可装备特殊装置槽位', trigger: 'passive', effect: '附魔强化30%' },
      { name: '紧急维修', desc: '生命低于 30% 时自动部署维修机器人，回复 20% 生命', trigger: 'onLowHp', effect: '濒死机器人回血' },
    ],
    growth: { hpPerLevel: 7, mpPerLevel: 5, attrWeights: { intelligence: 3, dexterity: 2, constitution: 1 } },
    starterSkills: ['符文炸弹', '附魔灌注'],
  },
  // ==================== 12. 血骑士 ====================
  {
    id: 'blood-knight',
    name: '血誓骑士',
    emoji: '⚜️',
    desc: '你对着一把断剑发誓，用自己的一半寿命换取复仇的力量。契约还在生效。',
    role: 'warrior',
    roleLabel: '吸血战士',
    attrMods: { strength: 3, constitution: 2, charisma: 1 },
    preferredSchools: ['死灵', '武技'],
    skills: [
      { name: '血祭', desc: '消耗 15% 生命，使下一次攻击吸血 50%（+1 堕落）', school: '死灵', signature: true },
      { name: '死亡抗拒', desc: '生命低于 20% 时自动触发，免疫死亡一次并回复 30% 生命（每场战斗限一次）', school: '死灵' },
      { name: '血之狂暴', desc: '击杀敌人时回复 25% 生命并提升攻击力 1 回合', school: '武技' },
    ],
    startingGear: ['血誓长剑', '黑色圣徽', '止血带 x3'],
    playstyle: '吸血续航、极限生存、堕落高风险',
    difficulty: 3,
    mechanics: [
      { name: '血祭', desc: '消耗 15% 生命，使下一次攻击吸血 50%（+1 堕落）', trigger: 'onStart', effect: '攻击吸血50%' },
      { name: '死亡抗拒', desc: '生命低于 20% 时自动触发，免疫死亡一次并回复 30% 生命（每场战斗限一次）', trigger: 'onLowHp', effect: '免疫死亡一次' },
      { name: '血之狂暴', desc: '击杀敌人时回复 25% 生命并提升攻击力 1 回合', trigger: 'onKill', effect: '击杀回血25%' },
    ],
    growth: { hpPerLevel: 11, mpPerLevel: 3, attrWeights: { strength: 3, constitution: 2, charisma: 1 } },
    starterSkills: ['血祭', '血之狂暴'],
  },
];
