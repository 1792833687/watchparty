/**
 * Settings Loader — AI Narrator Game
 *
 * Loads and validates game settings from JSON/YAML.
 * Includes built-in presets embedded in code (no external file dependency).
 *
 * Corresponds to Epic 7 Story 7.2 and concept M07.
 *
 * @module systems/settings/settings-loader
 */

import type {
  GameSetting,
  ValidationError,
  ValidationResult,
} from './types';
import { parseYAML } from './yaml-parser'; // FIX: QUAL-1 — YAML 解析器提取为独立文件

// ============================================================
// Required Fields Schema
// ============================================================

const REQUIRED_TOP_FIELDS = ['id', 'name', 'version', 'worldMeta'] as const;
const REQUIRED_WORLD_META_FIELDS = ['name', 'genre', 'tone', 'description'] as const;

type RequiredTopField = (typeof REQUIRED_TOP_FIELDS)[number];
type RequiredWorldMetaField = (typeof REQUIRED_WORLD_META_FIELDS)[number];

// ============================================================
// JSON Loading
// ============================================================

/**
 * Load a GameSetting from a JSON string.
 * @throws {Error} If JSON is malformed.
 */
export function loadFromJSON(json: string): GameSetting {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(`JSON 解析失败: ${err instanceof Error ? err.message : '未知错误'}`);
  }

  if (!isSettingObject(parsed)) {
    throw new Error('JSON 内容不是有效的游戏设定对象');
  }

  return normalizeSetting(parsed as Record<string, unknown>);
}

// ============================================================
// YAML Loading (minimal parser)
// ============================================================

/**
 * Minimal YAML parser for game setting files.
 * Supports: scalars (strings, numbers, booleans, null), nested objects,
 * arrays (dash lists), and comments (#).
 *
 * Does NOT support: multi-line strings, anchors/aliases, tags, flow-style maps.
 * This is sufficient for game setting configuration files.
 *
 * @throws {Error} If YAML is malformed.
 */
export function loadFromYAML(yaml: string): GameSetting {
  const parsed = parseYAML(yaml);
  if (!isSettingObject(parsed)) {
    throw new Error('YAML 内容不是有效的游戏设定对象');
  }
  return normalizeSetting(parsed as Record<string, unknown>);
}

// ============================================================
// Validation
// ============================================================

/**
 * Validate a game setting object.

// ============================================================
// Validation
// ============================================================

/**
 * Validate a game setting object.
 * Returns a ValidationResult with any errors or warnings.
 */
export function validate(setting: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!setting || typeof setting !== 'object') {
    return {
      valid: false,
      errors: [{ field: '$', message: '游戏设定必须是一个对象', severity: 'error' }],
    };
  }

  const obj = setting as Record<string, unknown>;

  // Required top-level fields
  for (const field of REQUIRED_TOP_FIELDS) {
    if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
      errors.push({
        field,
        message: `缺少必需字段: ${field}`,
        severity: 'error',
      });
    }
  }

  // Type checks
  if (obj.id !== undefined && typeof obj.id !== 'string') {
    errors.push({ field: 'id', message: 'id 必须是字符串', severity: 'error' });
  }
  if (obj.name !== undefined && typeof obj.name !== 'string') {
    errors.push({ field: 'name', message: 'name 必须是字符串', severity: 'error' });
  }
  if (obj.version !== undefined && typeof obj.version !== 'string') {
    errors.push({ field: 'version', message: 'version 必须是字符串', severity: 'error' });
  }

  // Validate worldMeta
  if (obj.worldMeta && typeof obj.worldMeta === 'object') {
    const meta = obj.worldMeta as Record<string, unknown>;
    for (const field of REQUIRED_WORLD_META_FIELDS) {
      if (!(field in meta) || meta[field] === undefined || meta[field] === null) {
        errors.push({
          field: `worldMeta.${field}`,
          message: `worldMeta 缺少必需字段: ${field}`,
          severity: 'error',
        });
      }
    }
    if (meta.name !== undefined && typeof meta.name !== 'string') {
      errors.push({ field: 'worldMeta.name', message: 'worldMeta.name 必须是字符串', severity: 'error' });
    }
    if (meta.genre !== undefined && typeof meta.genre !== 'string') {
      errors.push({ field: 'worldMeta.genre', message: 'worldMeta.genre 必须是字符串', severity: 'error' });
    }
    if (meta.tone !== undefined && typeof meta.tone !== 'string') {
      errors.push({ field: 'worldMeta.tone', message: 'worldMeta.tone 必须是字符串', severity: 'error' });
    }
    if (meta.description !== undefined && typeof meta.description !== 'string') {
      errors.push({ field: 'worldMeta.description', message: 'worldMeta.description 必须是字符串', severity: 'error' });
    }
  } else if (obj.worldMeta !== undefined) {
    errors.push({ field: 'worldMeta', message: 'worldMeta 必须是对象', severity: 'error' });
  }

  // Optional field warnings
  if (obj.playerOptions !== undefined && typeof obj.playerOptions !== 'object') {
    errors.push({ field: 'playerOptions', message: 'playerOptions 必须是对象', severity: 'warning' });
  }

  if (obj.worldRules !== undefined) {
    if (!Array.isArray(obj.worldRules)) {
      errors.push({ field: 'worldRules', message: 'worldRules 必须是数组', severity: 'error' });
    }
  }

  if (obj.npcs !== undefined && !Array.isArray(obj.npcs)) {
    errors.push({ field: 'npcs', message: 'npcs 必须是数组', severity: 'warning' });
  }

  if (obj.regions !== undefined && !Array.isArray(obj.regions)) {
    errors.push({ field: 'regions', message: 'regions 必须是数组', severity: 'warning' });
  }

  return {
    valid: errors.filter((e) => e.severity === 'error').length === 0,
    errors,
  };
}

// ============================================================
// Normalization
// ============================================================

function isSettingObject(obj: unknown): obj is Record<string, unknown> {
  return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
}

function normalizeSetting(raw: Record<string, unknown>): GameSetting {
  const setting: GameSetting = {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    version: String(raw.version ?? '1.0.0'),
    worldMeta: normalizeWorldMeta(raw.worldMeta),
  };

  if (raw.playerOptions && typeof raw.playerOptions === 'object') {
    setting.playerOptions = raw.playerOptions as GameSetting['playerOptions'];
  }
  if (raw.startingLocation && typeof raw.startingLocation === 'object') {
    setting.startingLocation = raw.startingLocation as GameSetting['startingLocation'];
  }
  if (Array.isArray(raw.worldRules)) {
    setting.worldRules = raw.worldRules as GameSetting['worldRules'];
  }
  if (Array.isArray(raw.npcs)) {
    setting.npcs = raw.npcs as GameSetting['npcs'];
  }
  if (Array.isArray(raw.regions)) {
    setting.regions = raw.regions as GameSetting['regions'];
  }
  if (typeof raw.initialHook === 'string') {
    setting.initialHook = raw.initialHook;
  }
  if (typeof raw.createdAt === 'string') {
    setting.createdAt = raw.createdAt;
  }
  if (
    raw.createdBy === 'preset' ||
    raw.createdBy === 'import' ||
    raw.createdBy === 'ai-generated'
  ) {
    setting.createdBy = raw.createdBy;
  }

  // v1.1.0: Theme-adaptive fields
  if (Array.isArray(raw.classes)) {
    setting.classes = raw.classes as GameSetting['classes'];
  }
  if (Array.isArray(raw.attributes)) {
    setting.attributes = raw.attributes as GameSetting['attributes'];
  }
  if (Array.isArray(raw.skillCategories)) {
    setting.skillCategories = raw.skillCategories as GameSetting['skillCategories'];
  }
  if (Array.isArray(raw.startingItems)) {
    setting.startingItems = raw.startingItems as GameSetting['startingItems'];
  }
  if (Array.isArray(raw.mapRegions)) {
    setting.mapRegions = raw.mapRegions as GameSetting['mapRegions'];
  }
  if (Array.isArray(raw.forbiddenTerms)) {
    setting.forbiddenTerms = raw.forbiddenTerms.map(String);
  }

  return setting;
}

function normalizeWorldMeta(raw: unknown): GameSetting['worldMeta'] {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const meta = raw as Record<string, unknown>;
    return {
      name: String(meta.name ?? 'Unknown World'),
      genre: String(meta.genre ?? 'fantasy'),
      tone: String(meta.tone ?? 'neutral'),
      description: String(meta.description ?? ''),
      tags: Array.isArray(meta.tags) ? meta.tags.map(String) : undefined,
      languageHints: typeof meta.languageHints === 'string' ? meta.languageHints : undefined,
    };
  }
  return {
    name: 'Unknown World',
    genre: 'fantasy',
    tone: 'neutral',
    description: '',
  };
}

// ============================================================
// Built-in Presets
// ============================================================

/**
 * Frosthold Preset — the sole built-in world preset.
 * "凛冬要塞：暗影纪元" — medieval fantasy with D&D-style narrative.
 *
 * v3.0.0: 唯一世界。世界名即游戏名。职业、地图、成就、技能树全部
 * 收敛到这一套世界观之内，不再存在多预设并存的情况。
 */
export const FROSTHOLD_PRESET: GameSetting = {
  id: 'preset-frosthold',
  name: '凛冬要塞',
  version: '4.1.0',
  worldMeta: {
    name: '凛冬要塞：暗影纪元',
    genre: '中世纪魔幻',
    tone: '史诗吟游',
    description:
      '暗影再次笼罩中洲。远古的邪恶在东方苏醒，半兽人在阴影山脉中集结。' +
      '旧王国的血脉已几近断绝，精灵的船只正驶向西方。' +
      '在这最后的希望之地，凛冬要塞的烽火台上，一位新的领主接过了守夜人的火炬。' +
      '光明与黑暗的内心斗争、力量与代价的永恒博弈、选择与后果的不可逆转——' +
      '这是你的要塞。你的战争。你的烙印。你的命运。',
    tags: ['中世纪', '魔幻', '领地经营', '龙与地下城', '叙事驱动'],
    languageHints:
      '使用史诗吟游诗人风格。场景描写庄重而富有诗意，对话简洁有力。' +
      '暗影低语时语调转为低沉诱惑，如同从世界深处传来的回声。',
  },
  playerOptions: {
    /**
     * v3.0.0 修复：总点数原为 15，而各出身基础属性总和为 18~19，
     * 导致创建角色时剩余点数直接为负仍可进入游戏。
     * 现统一为「基础六维各 3 点(=18) + 出身加成(+3) = 21」。
     * v4.1.0: 成本制（核心 1 点/非核心 2 点）下总预算调整至 28，
     * 保证开局自由分配 5~7 点（原 24 成本制过紧易超支）。
     */
    totalAttributePoints: 28,
    availableClasses: [
      {
        id: 'gondor-knight',
        name: '白石骑士',
        description: '银树与七星之下受封的人类战士。力量+2 魅力+1。擅长：长剑、骑术、指挥。',
        baseAttributes: { strength: 5, dexterity: 3, constitution: 3, intelligence: 3, wisdom: 3, charisma: 4 },
        startingEquipment: ['白石长剑', '骑士盾', '锁子甲', '领主徽章'],
      },
      {
        id: 'northern-ranger',
        name: '雪原游侠',
        description: '没有旗帜的守望者，追踪与潜行大师。敏捷+2 感知+1。擅长：弓箭、潜行、追踪。',
        baseAttributes: { strength: 3, dexterity: 5, constitution: 3, intelligence: 3, wisdom: 4, charisma: 3 },
        startingEquipment: ['游侠长弓', '精灵斗篷', '短剑', '追踪工具'],
      },
      {
        id: 'rivendell-scholar',
        name: '翠溪隐谷学者',
        description: '读过太多不该读之物的智者。智力+2 感知+1。擅长：古代语、魔法、医疗。',
        baseAttributes: { strength: 3, dexterity: 3, constitution: 3, intelligence: 5, wisdom: 4, charisma: 3 },
        startingEquipment: ['魔法书', '水晶球', '草药包', '古代语词典'],
      },
      {
        id: 'lonely-mountain-smith',
        name: '灰炉山铁匠后裔',
        description: '矮人工艺的传承者，坚韧不拔。体质+2 力量+1。擅长：锻造、采矿、陷阱。',
        baseAttributes: { strength: 4, dexterity: 3, constitution: 5, intelligence: 3, wisdom: 3, charisma: 3 },
        startingEquipment: ['矮人锻造锤', '矿镐', '陷阱工具', '秘银碎片'],
      },
      {
        id: 'rohan-rider',
        name: '北境骠骑',
        description: '草原上的骑射手，天生的驯兽师。敏捷+2 魅力+1。擅长：骑射、长矛、驯兽。',
        baseAttributes: { strength: 3, dexterity: 5, constitution: 3, intelligence: 3, wisdom: 3, charisma: 4 },
        startingEquipment: ['复合弓', '骑枪', '驯兽哨', '北境骠骑战马'],
      },
      {
        id: 'custom',
        name: '自定义',
        description: '没有旗帜，没有师承。六维均衡，全部点数自由分配。',
        baseAttributes: { strength: 3, dexterity: 3, constitution: 3, intelligence: 3, wisdom: 3, charisma: 3 },
        startingEquipment: ['旅行者行囊', '短剑', '干粮x3'],
      },
    ],
    attributeNames: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'],
    characterCreationPrompt:
      '暗影再次笼罩中洲。远古的邪恶在东方苏醒，半兽人在阴影山脉中集结。' +
      '旧王国的血脉已几近断绝，精灵的船只正驶向西方。' +
      '在这最后的希望之地，凛冬要塞的烽火台上，一位新的领主接过了守夜人的火炬。选择你的出身与过往——你的战争即将开始。',
  },
  startingLocation: {
    regionId: 'frosthold-main-keep',
    description: '凛冬要塞·主堡瞭望台——晨曦艰难越过阴影山脉的雪线。',
    openingNarrative:
      '（灰白色的晨光艰难地越过阴影山脉的雪线，洒在凛冬要塞斑驳的黑色花岗岩城墙上。）' +
      '（你站在主堡最高处的瞭望台上。东方的天空被染成一片浑浊的暗橘色——那不是朝霞，' +
      '是黑曜石荒原上永不熄灭的火山映出的光。）' +
      '（铁锤敲打声、马嘶声、晨祷的低语，这些声音构成了你在无数个黎明中最熟悉的旋律。' +
      '今天，这份旋律里多了一丝不安：一份来自白石的信使昨晚抵达，带来了一则消息——' +
      '黑暗的势力正在东方集结，规模前所未有。）' +
      '"你叫什么名字，领主？"一个声音从身后传来。老学士梅林站在塔楼入口。' +
      '"在一切开始之前，让我记下你的名字。还有，你是谁。"',
  },
  worldRules: [
    {
      id: 'wr-corruption',
      name: '堕落值系统',
      description: '堕落值代表黑暗君主对你灵魂的侵蚀程度。范围0-100。使用黑暗力量会增加堕落值，在圣地祈祷或完成正义事迹可减少。堕落值达100触发"陨落"结局。',
      priority: 10,
      category: 'other',
    },
    {
      id: 'wr-shadow-whisper',
      name: '暗影低语',
      description: '当堕落值达到侵蚀阶段(41+)时，出现暗影低语选项。这些选项100%成功无需检定，但每次使用都有不可逆转的代价。命运的初次触碰在堕落值20-30时被动触发。',
      priority: 9,
      category: 'other',
    },
    {
      id: 'wr-death-save',
      name: '死亡豁免',
      description: '生命值降至0时进行死亡豁免：投D20≥10为成功，三次成功稳定；三次失败陨落。每次经历死亡豁免后获得永久伤痕。',
      priority: 9,
      category: 'combat',
    },
    {
      id: 'wr-costly-success',
      name: '代价性成功',
      description: '关键任务中不存在完美的胜利——要么使用暗影力量，要么伴随牺牲，要么以道德为代价。光明与黑暗各有其理，也各有其价。',
      priority: 8,
      category: 'other',
    },
    {
      id: 'wr-time-epoch',
      name: '纪元推进',
      description: '游戏分四个纪元：孤守要塞→联合诸族→光暗交锋→命运终局。时间仅在关键选择时推进。夜晚外出探索遭遇概率翻倍，暗影低语出现概率是白天的三倍。',
      priority: 7,
      category: 'other',
    },
    {
      id: 'wr-loyalty-trial',
      name: '忠诚度审判',
      description: '在关键剧情节点，同伴会基于核心信念对你进行审判。这不是简单的数值检测，而是有剧情、有对话、有痛苦抉择的事件。',
      priority: 6,
      category: 'social',
    },
  ],
  npcs: [
    {
      id: 'npc-merlin',
      name: '梅林',
      role: '老学士',
      description: '凛冬要塞最年长的居民，最后一位记得旧日荣光的记录者。他那双因年老而浑浊的眼睛里，偶尔会闪过锐利的光。',
      location: 'frosthold-library',
      personality: '睿智、沉默、保守着要塞的全部秘密',
    },
    {
      id: 'npc-thorin-copper',
      name: '塔林·铜锤',
      role: '矮人锻造大师',
      description: '来自灰炉山的矮人战士。他的铁锤能锻造出中洲最锋利的武器，心中始终燃烧着收复故土的火焰。',
      location: 'frosthold-forge',
      personality: '固执、骄傲、对精灵怀有深藏的不信任',
    },
    {
      id: 'npc-aelune-starwhisper',
      name: '艾琳·星语',
      role: '精灵游侠',
      description: '幽林精灵的箭术大师，暮色森林的守护者。她为你提供远程侦察与自然魔法支持。',
      location: 'twilight-forest-edge',
      personality: '优雅、疏离、时刻警惕着你的黑暗倾向',
    },
    {
      id: 'npc-roland',
      name: '罗兰爵士',
      role: '圣武士',
      description: '白石王国的圣武士，守护与牺牲的信徒。他的长剑只为保护无辜而挥，对黑暗力量持零容忍态度。',
      location: 'frosthold-chapel',
      personality: '正直、坚决、对黑暗有不可动摇的敌意',
    },
    {
      id: 'npc-lia',
      name: '莉亚·风行者',
      role: '半精灵法师',
      description: '在人类与精灵两个世界间挣扎的半精灵。她渴望被认同，渴望找到一个属于自己的位置。',
      location: 'frosthold-library',
      personality: '敏感、聪慧、容易被你的选择影响',
    },
  ],
  regions: [
    {
      id: 'frosthold-keep',
      name: '凛冬要塞',
      description: '阴影山脉隘口的古老黑花岗岩要塞。角塔半数坍塌，幕墙上爬满枯藤，但主堡依然倔强地矗立着。',
      theme: 'fortress',
      npcIds: ['npc-merlin', 'npc-thorin-copper', 'npc-roland', 'npc-lia'],
    },
    {
      id: 'winter-glen',
      name: '凛冬谷',
      description: '要塞周边已被清理的安全区域。农田、巡逻队和寻求庇护的难民构成这片区域的生活景象。',
      theme: 'plains',
    },
    {
      id: 'twilight-forest',
      name: '暮色森林',
      description: '古老森林，精灵遗迹散布其间。阳光透过枝叶洒下斑驳光影，但深处的阴影似乎永不消散。',
      theme: 'forest',
      npcIds: ['npc-aelune-starwhisper'],
    },
    {
      id: 'shadow-mountains',
      name: '阴影山脉',
      description: '曾经的矮人王国疆域，如今半兽人与黑暗生物盘踞。矿道深处仍有未开采的秘银矿脉。',
      theme: 'mountain',
    },
    {
      id: 'barren-plains',
      name: '荒芜平原',
      description: '古代战场遗址，亡灵与不死生物在夜间游荡。战争中遗留的兵器、铠甲和遗物散落各处。',
      theme: 'desert',
    },
    {
      id: 'obsidian-wastes',
      name: '黑曜石荒原',
      description: '黑暗君主力量的核心渗透区。永不熄灭的火山映红了天空，半兽人要塞隐藏其中。',
      theme: 'dungeon',
    },
  ],
  // ---- v1.1.0 Theme-Adaptive Data ----
  classes: [
    { id: 'gondor-knight', name: '白石骑士', desc: '以长剑与骑术闻名的人类战士。', icon: '' },
    { id: 'northern-ranger', name: '雪原游侠', desc: '阴影中的弓箭手，追踪与潜行大师。', icon: '' },
    { id: 'rivendell-scholar', name: '翠溪隐谷学者', desc: '钻研古代语与魔法的智者。', icon: '' },
    { id: 'lonely-mountain-smith', name: '灰炉山铁匠后裔', desc: '矮人工艺传承者，坚韧不拔。', icon: '' },
    { id: 'rohan-rider', name: '北境骠骑', desc: '草原骑射手与驯兽师。', icon: '' },
  ],
  attributes: [
    {
      id: 'strength',
      label: '力量',
      abbr: 'STR',
      desc: '肌肉的爆发力。决定你能否劈开兽人的护甲，也决定你能背着多少战利品走出地牢。',
      formula: '近战攻击加值 = (力量 - 3) ；负重上限 = 力量 × 15 磅',
      effects: [
        '近战攻击检定与伤害加值，长剑、战锤、骑枪均受其影响',
        '负重上限：力量过低会导致穿重甲时敏捷惩罚翻倍',
        '力量检定：破门、掀翻石棺、在雪崩中拉住同伴',
        '威慑对话：以武力压制谈判对手时使用力量而非魅力',
      ],
      lowValueWarning: '力量低于 2 时，你无法装备板甲与巨剑，近战几乎必败。',
    },
    {
      id: 'dexterity',
      label: '敏捷',
      abbr: 'DEX',
      desc: '身体的精确控制。它决定你在暗影中是猎手，还是猎物。',
      formula: '闪避 = 10 + (敏捷 - 3) ；先攻 = D20 + (敏捷 - 3)',
      effects: [
        '远程攻击：长弓、十字弓、投掷武器的命中与伤害',
        '闪避值：直接抬高敌人命中你所需的骰面',
        '先攻顺序：高敏捷让你在兽人举起弯刀前先行动',
        '潜行与开锁：夜袭营地、拆解古墓陷阱的核心检定',
      ],
      lowValueWarning: '敏捷低于 2 时，潜行几乎必然失败，陷阱触发率大幅上升。',
    },
    {
      id: 'constitution',
      label: '体质',
      abbr: 'CON',
      desc: '生命的韧性。在凛冬要塞，它同时是你抵抗严寒与抵抗堕落的护盾。',
      formula: '生命上限 = 50 + 体质 × 15 ；死亡豁免加值 = (体质 - 3)',
      effects: [
        '生命值上限：这是唯一直接决定你能挨几刀的属性',
        '抗性检定：毒素、疾病、极寒天候与长途行军疲劳',
        '抵抗堕落：暗影低语侵蚀灵魂时，体质决定堕落值增长速度',
        '死亡豁免：生命归零后的 D20 检定加值，决定你能否爬起来',
      ],
      lowValueWarning: '体质低于 2 时，一次伏击就足以让你进入死亡豁免。',
    },
    {
      id: 'intelligence',
      label: '智力',
      abbr: 'INT',
      desc: '知识与推演。奥术不为虔诚者敞开，只为理解它的人敞开。',
      formula: '法力上限 = 20 + 智力 × 10 ；奥术强度加值 = (智力 - 3)',
      effects: [
        '奥术法术强度：塑能系、幻术系、变化系的伤害与持续时间',
        '古代语解读：精灵碑文、矮人符文、魔君契约的翻译',
        '炼金与鉴定：辨识未知药剂与遗物，避免误用诅咒物品',
        '法力上限：决定你一场战斗中能连续施放几个法术',
      ],
      lowValueWarning: '智力低于 2 时，奥术学派技能树将保持锁定状态。',
    },
    {
      id: 'wisdom',
      label: '感知',
      abbr: 'WIS',
      desc: '直觉与洞察。它让你在暗影开口之前，就听见它的呼吸。',
      formula: '神圣强度加值 = (感知 - 3) ；察觉被动值 = 10 + (感知 - 3)',
      effects: [
        '神圣法术强度：治愈之光、祝福武器、圣光审判的效果',
        '察觉与追踪：发现埋伏、暗门、被雪掩埋的足迹',
        '抵抗诱惑：暗影低语提出交易时，感知决定你是否看穿代价',
        '同伴洞察：更早察觉同伴忠诚度下滑与潜在背叛',
      ],
      lowValueWarning: '感知低于 2 时，你几乎无法察觉暗影低语的真实代价。',
    },
    {
      id: 'charisma',
      label: '魅力',
      abbr: 'CHA',
      desc: '意志的投射。要塞不是靠一个人守住的，而是靠一个人说服所有人留下。',
      formula: '好感成长速率 ×(1 + (魅力 - 3) × 0.15) ；说服检定 = D20 + (魅力 - 3)',
      effects: [
        '同伴好感与忠诚：直接影响关系网络的成长速度与解锁进度',
        '外交与说服：与白石、北境骠骑、幽林精灵的阵营谈判成败',
        '领导加成：围城战中提升守军士气与防御值',
        '价格议价：商人处的买卖差价，间接影响金币收入',
      ],
      lowValueWarning: '魅力低于 2 时，同伴好感几乎停滞，多数支线与结局将无法开启。',
    },
  ],
  skillCategories: [
    {
      name: '武技',
      icon: '⚔️',
      desc: '不依赖法力的战场技艺。白石骑士与北境骠骑的立身之本。（非魔法学派）',
      skills: [
        { name: '盾墙式', desc: '架起盾牌，本回合受到的近战伤害减半', cost: 1, tier: 1, category: 'martial' },
        { name: '精准突刺', desc: '无视敌人 2 点护甲，对重甲目标格外有效', cost: 1, tier: 1, category: 'martial' },
        { name: '战吼', desc: '提升全队 1 点攻击加值，持续三回合', cost: 2, tier: 2, category: 'martial', fogHint: '需先在守夜人演武场完成一次实战指挥' },
        { name: '骑枪冲锋', desc: '骑乘状态下造成双倍伤害并击退目标', cost: 2, tier: 2, category: 'martial', fogHint: '需拥有坐骑并完成北境骠骑骑手试炼' },
        { name: '守夜人之誓', desc: '生命低于三成时，攻击与防御各 +3，持续至战斗结束', cost: 3, tier: 3, category: 'martial', fogHint: '需在一场围城战中独自守住城门' },
      ],
    },
    {
      name: '防护系',
      icon: '🛡️',
      desc: '将法力织成屏障。最不起眼，却最常救命的学派。',
      skills: [
        { name: '魔法护盾', desc: '获得吸收 20 点伤害的临时护盾', cost: 1, tier: 1, spellLevel: 'cantrip', mpCost: 1, category: 'magic' },
        { name: '防护邪恶', desc: '对黑暗生物的伤害减免 20%', cost: 2, tier: 2, spellLevel: 2, mpCost: 3, category: 'magic', fogHint: '需在圣所研读《防护圣典》' },
        { name: '反魔法力场', desc: '范围内所有施法被禁止，包括你自己', cost: 3, tier: 3, spellLevel: 4, mpCost: 7, category: 'magic', fogHint: '需击败一名敌方施法者并夺取其法杖' },
      ],
    },
    {
      name: '咒法系',
      icon: '🌀',
      desc: '撕开空间的褶皱，召来不属于此地的东西。',
      skills: [
        { name: '召唤仆从', desc: '召唤一只低阶生物协战三回合', cost: 2, tier: 1, spellLevel: 1, mpCost: 2, category: 'magic' },
        { name: '传送术', desc: '瞬间移动至已解锁的任意区域', cost: 3, tier: 2, spellLevel: 3, mpCost: 5, category: 'magic', fogHint: '需绘制过至少三处区域的传送锚点' },
        { name: '异界之门', desc: '开启短暂通道，可撤离整支队伍', cost: 3, tier: 3, spellLevel: 5, mpCost: 9, category: 'magic', fogHint: '需在龙脊冰峰寻得远古门枢' },
      ],
    },
    {
      name: '预言系',
      icon: '🔮',
      desc: '在事情发生之前看见它。代价是你无法再假装不知道。',
      skills: [
        { name: '侦测魔法', desc: '显示周围的魔法气息与隐藏附魔', cost: 1, tier: 1, spellLevel: 'cantrip', mpCost: 1, category: 'magic' },
        { name: '真知术', desc: '强制显露一名 NPC 的真实意图', cost: 2, tier: 2, spellLevel: 2, mpCost: 3, category: 'magic', fogHint: '需识破一次同伴的谎言' },
        { name: '命运一瞥', desc: '重投任意一次失败的检定，每 5 天限一次', cost: 3, tier: 3, spellLevel: 4, mpCost: 7, category: 'magic', fogHint: '需在暮色森林的星语池畔冥想' },
      ],
    },
    {
      name: '塑能系',
      icon: '🔥',
      desc: '最直白的暴力。元素不讲道理，只讲当量。',
      skills: [
        { name: '火焰箭', desc: '单体火焰伤害，可点燃易燃物', cost: 1, tier: 1, spellLevel: 'cantrip', mpCost: 1, category: 'magic' },
        { name: '火球术', desc: '对区域内所有敌人造成火焰伤害', cost: 2, tier: 2, spellLevel: 3, mpCost: 5, category: 'magic', fogHint: '需先掌握火焰箭并完成一次群体作战' },
        { name: '闪电束', desc: '直线穿透，可同时命中列队的敌人', cost: 3, tier: 2, spellLevel: 3, mpCost: 5, category: 'magic', fogHint: '需在雷暴天候下施法一次' },
        { name: '冰风暴', desc: '大范围冰冻与减速，对火系敌人加倍', cost: 3, tier: 3, spellLevel: 4, mpCost: 7, category: 'magic', fogHint: '需取得龙脊冰峰的寒霜结晶' },
      ],
    },
    {
      name: '幻术系',
      icon: '🌫️',
      desc: '不改变世界，只改变别人眼中的世界。',
      skills: [
        { name: '微光幻影', desc: '制造一个诱饵，吸引一次攻击', cost: 1, tier: 1, spellLevel: 'cantrip', mpCost: 1, category: 'magic' },
        { name: '隐形术', desc: '进入隐形，攻击或施法时解除', cost: 2, tier: 2, spellLevel: 2, mpCost: 3, category: 'magic', fogHint: '需完成一次全程未被发现的潜入' },
        { name: '镜像术', desc: '生成三个分身，各自可抵挡一次攻击', cost: 3, tier: 3, spellLevel: 4, mpCost: 7, category: 'magic', fogHint: '需在翠溪隐谷学者处研习镜之理论' },
      ],
    },
    {
      name: '变化系',
      icon: '🦅',
      desc: '肉体并非定数。问题在于，变回来的还是不是你。',
      skills: [
        { name: '变巨术', desc: '体型增大，力量与生命暂时提升', cost: 2, tier: 1, spellLevel: 1, mpCost: 2, category: 'magic' },
        { name: '飞行术', desc: '获得飞行能力，可跨越地形障碍', cost: 3, tier: 2, spellLevel: 3, mpCost: 5, category: 'magic', fogHint: '需在阴影山脉的崖顶完成一次坠落生还' },
        { name: '兽形化身', desc: '化为战兽形态，全属性重构', cost: 3, tier: 3, spellLevel: 5, mpCost: 9, category: 'magic', fogHint: '需与一名德鲁伊建立深度羁绊' },
      ],
    },
    {
      name: '神圣系',
      icon: '✨',
      desc: '光并非温柔之物。它灼烧黑暗，也灼烧持光者。（圣职神术，非魔法学派）',
      skills: [
        { name: '治愈之光', desc: '恢复生命值，可解除轻度中毒', cost: 1, tier: 1, spellLevel: 1, mpCost: 2, category: 'divine' },
        { name: '祝福武器', desc: '武器附加神圣伤害，持续整场战斗', cost: 2, tier: 2, spellLevel: 2, mpCost: 3, category: 'divine', fogHint: '需在要塞圣所完成一次晨祷' },
        { name: '驱散堕落', desc: '降低自身 10 点堕落值，每 5 天限一次', cost: 3, tier: 3, spellLevel: 3, mpCost: 5, category: 'divine', fogHint: '需堕落值曾超过 40 并主动求赎' },
        { name: '圣光审判', desc: '对亡灵与恶魔伤害翻倍，并短暂致盲', cost: 3, tier: 3, spellLevel: 5, mpCost: 9, category: 'divine', fogHint: '需获得罗兰爵士的完全信任' },
      ],
    },
    {
      name: '死灵系',
      icon: '💀',
      desc: '它给你想要的一切，然后慢慢地拿走你是谁。',
      darkSchool: true,
      skills: [
        { name: '恐惧术', desc: '使敌人恐慌逃窜', cost: 2, tier: 1, corruption: 2, spellLevel: 1, mpCost: 2, category: 'magic' },
        { name: '生命汲取', desc: '吸取敌人生命恢复自身', cost: 3, tier: 2, corruption: 3, spellLevel: 3, mpCost: 5, category: 'magic', fogHint: '需首次接受暗影低语的提议' },
        { name: '操控亡灵', desc: '让倒下的尸体重新站起为你而战', cost: 3, tier: 2, corruption: 5, spellLevel: 4, mpCost: 7, category: 'magic', fogHint: '需在荒芜平原的古战场逗留一夜' },
        { name: '灵魂契约', desc: '以永久生命上限换取一次绝对成功', cost: 3, tier: 3, corruption: 10, spellLevel: 5, mpCost: 9, category: 'magic', fogHint: '需堕落值达到 60 以上' },
      ],
    },
  ],
  startingItems: [
    { name: '钢制长剑', type: 'weapon', desc: '白石标准配发长剑，平衡而可靠' },
    { name: '皮甲', type: 'armor', desc: '轻便皮甲，适合长途行军' },
    { name: '领主徽章', type: 'key', desc: '刻着七星与银树的家族纹章' },
    { name: '治疗药剂', type: 'consumable', desc: '恢复生命值30点' },
    { name: '羊皮纸地图', type: 'tool', desc: '标记要塞周边已知区域的古旧地图' },
  ],
  mapRegions: [
    { name: '凛冬谷', desc: '要塞周边安全区域。', connections: ['暮色森林', '阴影山脉'] },
    { name: '暮色森林', desc: '古老森林，精灵遗迹。', connections: ['凛冬谷', '阴影山脉'] },
    { name: '阴影山脉', desc: '矮人故土，半兽人盘踞。', connections: ['凛冬谷', '暮色森林', '荒芜平原'] },
    { name: '荒芜平原', desc: '古代战场，亡灵游荡。', connections: ['阴影山脉', '黑曜石荒原'] },
    { name: '黑曜石荒原', desc: '黑暗力量核心区。', connections: ['荒芜平原', '龙脊冰峰'] },
    { name: '龙脊冰峰', desc: '极北冰封山脉，远古生物。', connections: ['黑曜石荒原'] },
  ],
  forbiddenTerms: ['电脑', '手机', '枪械', '外星人', '宇宙飞船', '现代', '科幻'],
  // ---- v2.0.0 Frosthold-specific fields ----
  origins: [
    {
      id: 'gondor-knight',
      name: '白石骑士',
      desc: '银树与七星之下受封的人类战士。你的长剑曾在白石王都的城墙上宣誓。',
      attrMods: { strength: 2, charisma: 1 },
      attrSummary: '力量+2 魅力+1',
      expertise: ['长剑', '骑术', '指挥'],
      startingGear: ['白石长剑', '骑士盾', '锁子甲', '领主徽章'],
      startingGold: 120,
      consequences: [
        '白石王国对你初始好感 +20，摄政王的信使会优先向你传达军情',
        '幽林精灵视你为「人类政治的延伸」，初始好感 -10',
        '围城战中你的指挥可为守军提供额外士气加成',
        '解锁专属抉择线「摄政王的密令」：忠于王命，还是忠于要塞',
        '暗影低语会以「保卫王国的必要之恶」为借口诱惑你，抗拒难度更高',
      ],
    },
    {
      id: 'northern-ranger',
      name: '雪原游侠',
      desc: '没有旗帜、没有封号的守望者。你在别人熟睡时，替他们盯着黑暗。',
      attrMods: { dexterity: 2, wisdom: 1 },
      attrSummary: '敏捷+2 感知+1',
      expertise: ['弓箭', '潜行', '追踪'],
      startingGear: ['游侠长弓', '精灵斗篷', '短剑', '追踪工具'],
      startingGold: 60,
      consequences: [
        '雪原游侠阵营初始好感 +25，游侠首领会在关键节点提供情报',
        '野外区域初始视野更广，暮色森林与阴影山脉提前暴露一处地点',
        '潜行进入敌营的选项在多数场景中默认开放',
        '起始金币较少（60），前期经济压力更大',
        '各大王国将你视为无名之辈，外交场合说服难度 +2',
      ],
    },
    {
      id: 'rivendell-scholar',
      name: '翠溪隐谷学者',
      desc: '你在谷主的书房里读过太多不该读的东西，因此知道暗影真正的名字。',
      attrMods: { intelligence: 2, wisdom: 1 },
      attrSummary: '智力+2 感知+1',
      expertise: ['古代语', '魔法', '医疗'],
      startingGear: ['魔法书', '水晶球', '草药包', '古代语词典'],
      startingGold: 90,
      consequences: [
        '翠溪隐谷与幽林精灵初始好感 +20',
        '奥术三系（塑能/幻术/变化）技能树首层直接解锁，无需前置',
        '所有古代碑文、遗物铭文自动翻译，无需检定',
        '体质基础偏低，前期战斗容错率显著下降',
        '解锁专属线「不该读完的那一页」：你早已知道魔君的真名意味着什么',
      ],
    },
    {
      id: 'lonely-mountain-smith',
      name: '灰炉山铁匠后裔',
      desc: '炉火映着你祖父的脸，他说：能修好的东西，就不该被丢掉。人也一样。',
      attrMods: { constitution: 2, strength: 1 },
      attrSummary: '体质+2 力量+1',
      expertise: ['锻造', '采矿', '陷阱'],
      startingGear: ['矮人锻造锤', '矿镐', '陷阱工具', '秘银碎片'],
      startingGold: 150,
      consequences: [
        '灰炉山矮人阵营初始好感 +25，可优先采购秘银装备',
        '解锁「锻造」经济玩法：可将战利品熔炼为金币或强化装备',
        '起始金币最高（150），前期可提前招募佣兵',
        '幽林精灵初始好感 -15（矮人与精灵的宿怨）',
        '抵抗堕落的体质检定加值更高，暗影侵蚀速度较慢',
      ],
    },
    {
      id: 'rohan-rider',
      name: '北境骠骑',
      desc: '你在马背上长大，风比屋顶更让你安心。骠骑不问归途，只问方向。',
      attrMods: { dexterity: 2, charisma: 1 },
      attrSummary: '敏捷+2 魅力+1',
      expertise: ['骑射', '长矛', '驯兽'],
      startingGear: ['复合弓', '骑枪', '驯兽哨', '北境骠骑战马'],
      startingGold: 100,
      consequences: [
        '北境骠骑国初始好感 +25，可在危急时呼叫骠骑增援一次',
        '唯一自带坐骑的出身：区域间移动消耗的时间减半',
        '解锁「骑枪冲锋」武技，无需前置试炼',
        '在地下城、洞穴等狭窄地形中，骑乘加成完全失效',
        '解锁专属线「骑王的号角」：当北境骠骑需要你时，你会回去吗',
      ],
    },
    {
      id: 'custom',
      name: '自定义',
      desc: '没有旗帜，没有师承，没有人替你写好开头。这既是负担，也是自由。',
      attrMods: {},
      attrSummary: '六维均衡，全部点数自由分配',
      expertise: ['自由发展'],
      startingGear: ['旅行者行囊', '短剑', '干粮x3'],
      startingGold: 80,
      consequences: [
        '所有属性点完全自由分配，可打造极端 build',
        '所有阵营初始好感均为中立 0，没有任何先天盟友',
        '不享有任何出身专属剧情线与免检定特权',
        '开局无人认识你，前期主线推进较慢，但后期路线不受出身束缚',
        '所有技能学派均需正常解锁，无跳过特权',
      ],
    },
  ],
  backgrounds: [
    {
      id: 'atonement',
      name: '赎罪',
      desc: '我曾在号角吹响时转身逃跑。那天死了十一个人，他们都叫过我的名字。',
      hiddenTrait: '负罪者往往是最勇敢的人。',
      storyHook: '每当有同伴在你面前倒下，你会听见那十一个声音再次响起。',
      corruptionMod: 5,
      factionBias: '对所有军事阵营抱有愧疚，谈判时更容易让步',
      consequences: [
        '起始堕落值 +5：你的灵魂已有裂缝，暗影更容易找到入口',
        '「牺牲自己保护同伴」类选项永久开放，且成功率提升',
        '同伴死亡时，你会获得永久的负面心理状态「回响」',
        '完成赎罪线可一次性清空 30 点堕落值，是全游戏最大的救赎机会',
        '解锁隐藏结局分支「第十二个名字」',
      ],
    },
    {
      id: 'exile',
      name: '流放',
      desc: '我在朝堂上说了实话。第二天，我的封地变成了这座冰冷的要塞。',
      hiddenTrait: '被放逐到边境的人，终将成为王国的救星。',
      storyHook: '一封来自故都的密信，将在第二章找到你。',
      corruptionMod: 0,
      factionBias: '白石王国初始好感 -15，但地方势力好感 +10',
      consequences: [
        '白石王国初始好感额外 -15，摄政王对你的请求多数会被驳回',
        '要塞内部平民与守军初始好感 +15（他们也是被遗忘的人）',
        '解锁「独立宣言」路线：可宣布凛冬要塞脱离白石自立',
        '洞察政治阴谋的检定自动成功，你太熟悉这套把戏了',
        '解锁隐藏结局分支「归来的流放者」，需在终章前恢复名誉',
      ],
    },
    {
      id: 'inheritance',
      name: '继承',
      desc: '父亲的守夜人斗篷还挂在主堡的墙上。我来把它取下来，穿上。',
      hiddenTrait: '这座要塞记得你的血脉。',
      storyHook: '要塞地下有一扇只认血脉的门，你迟早会找到它。',
      corruptionMod: -5,
      factionBias: '要塞老兵无条件信任，外部阵营态度不变',
      consequences: [
        '起始堕落值 -5：血脉中的守夜人誓约天然抵抗暗影',
        '要塞老兵与学士梅林初始好感 +30，可获得内部隐藏情报',
        '解锁要塞地下「血脉密室」，内含一件家族传承装备',
        '要塞建设与防御相关的所有花费降低 15%（金币收益）',
        '解锁隐藏结局分支「守夜人不死」，父辈的结局将由你改写',
      ],
    },
    {
      id: 'destiny',
      name: '使命',
      desc: '连续三百个夜晚，我梦见同一座燃烧的塔。醒来后，我朝北方走。',
      hiddenTrait: '最不可捉摸的道路，通向最不可逃避的终点。',
      storyHook: '梦境会持续更新，成为你的预警系统——也可能是陷阱。',
      corruptionMod: 0,
      factionBias: '所有阵营中立，但预言系 NPC 会主动接近你',
      consequences: [
        '每隔数日（约 5 天）获得一次「梦境预兆」，提示即将到来的关键风险',
        '预言系技能树全部首层解锁，感知检定额外 +1',
        '梦境有 20% 概率是暗影伪造的假预兆，误信将付出代价',
        '所有阵营初始中立，你不属于任何人，也不欠任何人',
        '解锁隐藏结局分支「梦的尽头」，只有此过往可通向真结局',
      ],
    },
  ],
  companions: [
    { id: 'thorin-copper', name: '塔林·铜锤', race: '矮人', role: '战士', coreBelief: '王冠与复兴', conflict: '对精灵的不信任根深蒂固' },
    { id: 'aelune-starwhisper', name: '艾琳·星语', race: '精灵', role: '游侠', coreBelief: '自然的守护', conflict: '对人类短视的失望' },
    { id: 'roland', name: '罗兰爵士', race: '人类', role: '圣武士', coreBelief: '守护与牺牲', conflict: '对黑暗力量的零容忍' },
    { id: 'lia-windwalker', name: '莉亚·风行者', race: '半精灵', role: '法师', coreBelief: '认同与归属', conflict: '在两个世界间挣扎' },
    { id: 'grim-darkforge', name: '格朗·铁砧', race: '矮人', role: '牧师', coreBelief: '治愈与救赎', conflict: '与罗兰理念冲突' },
    // v4.1.0: 艾拉 — 游离之魂事件的小女孩（world-setting 5.3），拯救后成为特殊同伴
    { id: 'aila', name: '艾拉', race: '人类', role: '被拯救的小女孩', coreBelief: '等待归来的誓言', conflict: '她相信你会回来，哪怕全世界都不信', appearance: '衣衫褴褛，抱着一个褪色的布偶，眼睛像雪原上未冻的湖', dialogueHints: ['她总在要塞的墙根下等你', '她会问起你头盔下的眼睛是什么颜色'] },
  ],
  magicSchools: [
    { name: '防护系', desc: '防御与保护', spells: ['魔法护盾', '防护邪恶', '反魔法力场'], consumesMP: true },
    { name: '咒法系', desc: '召唤与移动', spells: ['召唤生物', '传送术'], consumesMP: true },
    { name: '预言系', desc: '信息获取', spells: ['侦测魔法', '真知术'], consumesMP: true },
    { name: '塑能系', desc: '元素攻击', spells: ['火球术', '闪电束', '冰风暴'], consumesMP: true },
    { name: '幻术系', desc: '欺骗隐藏', spells: ['隐形术', '镜像术'], consumesMP: true },
    { name: '死灵系', desc: '黑暗力量', spells: ['恐惧术', '操控亡灵', '生命汲取'], consumesMP: true, addsCorruption: true },
    { name: '变化系', desc: '身体环境改变', spells: ['变巨术', '飞行术'], consumesMP: true },
  ],
  factions: [
    { id: 'gondor', name: '白石王国', leader: '摄政王', stance: '人类王国主力', attitudeToShadow: '敌视但实用主义' },
    { id: 'rohan', name: '北境骠骑国', leader: '骑王', stance: '忠诚盟友', attitudeToShadow: '不信任' },
    { id: 'lonely-mountain', name: '灰炉山矮人', leader: '炉王', stance: '中立封闭', attitudeToShadow: '实用主义' },
    { id: 'wood-elves', name: '幽林精灵', leader: '林王', stance: '孤立', attitudeToShadow: '绝对敌视' },
    { id: 'rivendell', name: '翠溪隐谷', leader: '谷主', stance: '逐渐撤离', attitudeToShadow: '警惕但理解' },
    { id: 'northern-rangers', name: '雪原游侠', leader: '游侠首领', stance: '暗中守护', attitudeToShadow: '以结果判断' },
  ],
  mapRegionsV2: [
    { name: '凛冬谷', desc: '要塞周边已清理的安全区域。', dangerLevel: 'safe', connections: ['暮色森林', '阴影山脉'] },
    { name: '暮色森林', desc: '古老森林，精灵遗迹散布。', dangerLevel: 'alert', connections: ['凛冬谷', '阴影山脉'] },
    { name: '阴影山脉', desc: '矮人故土，半兽人盘踞。', dangerLevel: 'danger', connections: ['凛冬谷', '暮色森林', '荒芜平原'] },
    { name: '荒芜平原', desc: '古代战场，亡灵游荡。', dangerLevel: 'danger', connections: ['阴影山脉', '黑曜石荒原'] },
    { name: '黑曜石荒原', desc: '黑暗力量核心渗透区。', dangerLevel: 'deadly', connections: ['荒芜平原', '龙脊冰峰'] },
    { name: '龙脊冰峰', desc: '极北冰封山脉，远古生物栖息。', dangerLevel: 'deadly', connections: ['黑曜石荒原'] },
  ],
  colorScheme: {
    primary: '#5B7B9A',
    secondary: '#A0522D',
    accent: '#D4A574',
    background: '#1A1D24',
    panel: '#252830',
    text: '#D3D9DF',
    textDim: '#8B95A5',
    danger: '#C41E3A',
    magic: '#6B3FA0',
    holy: '#4A7C59',
    shadow: '#1A1A2E',
  },
  initialHook: '巩固凛冬要塞，招募同伴，在暗影与光明的博弈中做出不可逆转的选择。',
  createdAt: new Date().toISOString(),
  createdBy: 'preset',
};

// ============================================================
// Built-in Presets Registry — v2.0.0: single Frosthold preset
// ============================================================
export const BUILT_IN_PRESETS: Record<string, GameSetting> = {
  'frosthold': FROSTHOLD_PRESET,
};

/**
 * Get a built-in preset by template ID.
 * Returns null if not found.
 */
export function getBuiltInPreset(templateId: string): GameSetting | null {
  return BUILT_IN_PRESETS[templateId] ?? null;
}

/**
 * List all available built-in preset IDs.
 */
export function listBuiltInPresets(): string[] {
  return Object.keys(BUILT_IN_PRESETS);
}

// ============================================================
// Template Metadata (for UI display)
// ============================================================

import type { GameSettingTemplate } from './types';

export const GAME_SETTING_TEMPLATES: GameSettingTemplate[] = [
  {
    id: 'frosthold',
    name: '凛冬要塞',
    description: '中世纪魔幻·龙与地下城风格。统御古老要塞，在光明与暗影的永恒博弈中做出不可逆转的选择。',
    genre: '中世纪魔幻',
    tone: '史诗吟游',
    icon: '🏰',
  },
];
