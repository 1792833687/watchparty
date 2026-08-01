/**
 * 世界观约束引擎 — AI Narrator Game v1.1.0
 *
 * 确保生成的职业/属性/物品/地图严格贴合世界观。
 * 现代都市 ≠ 战士法师。奇幻 ≠ 黑客工程师。
 */

// ============================================================
// Genre Classification
// ============================================================

export type SettingGenre = 'fantasy' | 'scifi' | 'modern' | 'survival' | 'wuxia' | 'horror' | 'postapocalyptic' | 'steampunk' | 'cyberpunk' | 'historical';

interface GenreProfile {
  genre: SettingGenre;
  /** 允许的职业 */
  classes: string[];
  /** 禁用词（绝不出现） */
  banned: string[];
  /** 属性配置 */
  attributes: Record<string, { min: number; max: number; label: string }>;
  /** 包裹物品池 */
  itemPool: { type: string; items: string[] }[];
  /** 地图地形 */
  biomes: string[];
  /** 建筑风格 */
  architecture: string[];
}

// ============================================================
// Genre Profiles — 强约束映射
// ============================================================

const GENRE_PROFILES: Record<SettingGenre, GenreProfile> = {
  fantasy: {
    genre: 'fantasy',
    classes: ['战士', '法师', '游侠', '牧师', '盗贼', '圣骑士', '德鲁伊', '术士'],
    banned: ['电脑', '手机', '汽车', '枪械', '黑客', '工程师', '宇航员'],
    attributes: {
      strength: { min: 1, max: 10, label: '力量' },
      agility: { min: 1, max: 10, label: '敏捷' },
      intelligence: { min: 1, max: 10, label: '智力' },
      wisdom: { min: 1, max: 10, label: '感知' },
      charisma: { min: 1, max: 10, label: '魅力' },
    },
    itemPool: [
      { type: '武器', items: ['长剑', '法杖', '弓箭', '匕首', '战锤', '魔杖', '双手斧'] },
      { type: '防具', items: ['皮甲', '锁子甲', '板甲', '法师袍', '斗篷', '盾牌'] },
      { type: '消耗品', items: ['治疗药水', '魔力药水', '解毒草', '卷轴', '符文石'] },
      { type: '宝物', items: ['龙鳞', '凤凰羽毛', '魔法水晶', '古金币', '精灵宝石'] },
    ],
    biomes: ['翠绿森林', '荒芜沙漠', '冰封雪山', '地下城', '精灵之森', '龙息山脉', '魔法塔'],
    architecture: ['石砌城堡', '精灵树屋', '矮人矿洞', '法师塔', '神殿'],
  },

  scifi: {
    genre: 'scifi',
    classes: ['舰长', '工程师', '外星学家', '医疗官', '安保员', 'AI专家', '飞行员'],
    banned: ['弓箭', '长剑', '魔法', '法术', '符文', '卷轴', '牧师'],
    attributes: {
      strength: { min: 1, max: 10, label: '体能' },
      agility: { min: 1, max: 10, label: '反应' },
      intelligence: { min: 1, max: 10, label: '智力' },
      constitution: { min: 1, max: 10, label: '辐射抗性' },
      charisma: { min: 1, max: 10, label: '沟通' },
    },
    itemPool: [
      { type: '武器', items: ['等离子步枪', '激光手枪', '电击棒', 'EMP手雷', '力场切割器'] },
      { type: '防具', items: ['能量护盾', '太空服', '纳米装甲', '反重力靴', '隐形斗篷'] },
      { type: '消耗品', items: ['医疗针', '能量电池', '氧气罐', '修复纳米机器人'] },
      { type: '宝物', items: ['外星遗物', '暗物质碎片', '量子芯片', '宇宙水晶'] },
    ],
    biomes: ['舰桥甲板', '引擎室', '冷冻舱', '外星废墟', '轨道站', '异星地表', '虚空裂隙'],
    architecture: ['合金走廊', '穹顶殖民地', '深空哨站', '轨道电梯', '地下掩体'],
  },

  modern: {
    genre: 'modern',
    classes: ['侦探', '记者', '医生', '律师', '黑客', '商人', '警察'],
    banned: ['魔法', '法术', '龙', '精灵', '长剑', '弓箭', '外星人', '太空'],
    attributes: {
      strength: { min: 1, max: 10, label: '体能' },
      agility: { min: 1, max: 10, label: '敏捷' },
      intelligence: { min: 1, max: 10, label: '智力' },
      constitution: { min: 1, max: 10, label: '心理韧性' },
      charisma: { min: 1, max: 10, label: '社交' },
    },
    itemPool: [
      { type: '工具', items: ['手机', '笔记本电脑', '手电筒', '撬锁工具', '录音笔', '相机'] },
      { type: '防具', items: ['防弹衣', '战术手套', '头盔', '防刺背心'] },
      { type: '消耗品', items: ['咖啡', '止痛药', '能量饮料', '绷带', '镇定剂'] },
      { type: '关键物品', items: ['案件档案', '钥匙', 'U盘', '匿名信', '照片'] },
    ],
    biomes: ['市中心', '贫民窟', '工业区', '大学城', '码头', '郊区住宅区', '地下停车场'],
    architecture: ['公寓楼', '写字楼', '警察局', '医院', '图书馆', '咖啡馆'],
  },

  survival: {
    genre: 'survival',
    classes: ['幸存者', '猎人', '医生', '技工', '侦察兵', '采集者'],
    banned: ['魔法', '高科技', '外星', '精灵', '飞船'],
    attributes: {
      strength: { min: 1, max: 10, label: '力量' },
      agility: { min: 1, max: 10, label: '敏捷' },
      intelligence: { min: 1, max: 10, label: '智力' },
      constitution: { min: 1, max: 10, label: '耐力' },
      charisma: { min: 1, max: 10, label: '领导力' },
    },
    itemPool: [
      { type: '武器', items: ['石斧', '弓箭', '长矛', '匕首', '弹弓'] },
      { type: '工具', items: ['绳索', '火石', '水壶', '急救包', '鱼竿', '指南针'] },
      { type: '消耗品', items: ['干粮', '草药', '净水片', '绷带', '能量棒'] },
      { type: '材料', items: ['木材', '石头', '纤维', '骨头', '树脂', '贝壳'] },
    ],
    biomes: ['海滩', '密林', '山洞', '悬崖', '沼泽', '河流', '废弃村落'],
    architecture: ['临时庇护所', '树屋', '洞穴', '废弃建筑', '瞭望塔'],
  },

  wuxia: {
    genre: 'wuxia',
    classes: ['剑客', '医师', '刺客', '镖师', '道士', '琴师', '铁匠'],
    banned: ['枪械', '电脑', '汽车', '外星', '科幻', '机器人'],
    attributes: {
      strength: { min: 1, max: 10, label: '内力' },
      agility: { min: 1, max: 10, label: '身法' },
      intelligence: { min: 1, max: 10, label: '悟性' },
      constitution: { min: 1, max: 10, label: '根骨' },
      charisma: { min: 1, max: 10, label: '气度' },
    },
    itemPool: [
      { type: '武器', items: ['长剑', '折扇', '飞镖', '暗器', '棍棒', '短刀', '九节鞭'] },
      { type: '防具', items: ['丝质长衫', '铁甲', '护心镜', '皮护腕', '轻功靴'] },
      { type: '消耗品', items: ['金疮药', '内力丹', '解毒丸', '茶', '酒', '干粮'] },
      { type: '秘籍', items: ['剑谱', '心法', '轻功秘籍', '拳法图', '毒经'] },
    ],
    biomes: ['古来客栈', '少林寺', '华山之巅', '江南水乡', '塞外大漠', '竹林', '繁华京城'],
    architecture: ['寺庙', '武馆', '茶楼', '客栈', '官府', '镖局'],
  },

  horror: {
    genre: 'horror',
    classes: ['调查员', '通灵者', '幸存者', '学者', '神父', '记者'],
    banned: ['高科技武器', '魔法', '龙', '精灵'],
    attributes: {
      strength: { min: 1, max: 10, label: '力量' },
      agility: { min: 1, max: 10, label: '敏捷' },
      intelligence: { min: 1, max: 10, label: '知识' },
      constitution: { min: 1, max: 10, label: '意志力' },
      charisma: { min: 1, max: 10, label: '魅力' },
    },
    itemPool: [
      { type: '武器', items: ['手电筒', '撬棍', '猎枪', '圣水', '银匕首'] },
      { type: '防具', items: ['厚外套', '护身符', '防毒面具'] },
      { type: '消耗品', items: ['镇定剂', '绷带', '蜡烛', '盐', '火柴'] },
      { type: '关键物品', items: ['旧日记', '神秘钥匙', '古照片', '录音带'] },
    ],
    biomes: ['废弃医院', '古老宅邸', '迷雾沼泽', '地下墓穴', '荒废小镇', '精神病院'],
    architecture: ['哥特式洋馆', '废弃教堂', '学校', '旅馆', '灯塔'],
  },

  postapocalyptic: {
    genre: 'postapocalyptic',
    classes: ['拾荒者', '机械师', '游骑兵', '商人', '医生', '农夫'],
    banned: ['魔法', '精灵', '高科技'],
    attributes: {
      strength: { min: 1, max: 10, label: '力量' },
      agility: { min: 1, max: 10, label: '敏捷' },
      intelligence: { min: 1, max: 10, label: '智力' },
      constitution: { min: 1, max: 10, label: '辐射抗性' },
      charisma: { min: 1, max: 10, label: '魅力' },
    },
    itemPool: [
      { type: '武器', items: ['自制步枪', '铁管', '十字弓', '燃烧瓶', '砍刀'] },
      { type: '防具', items: ['废铁护甲', '防风镜', '防毒面具', '厚皮靴'] },
      { type: '消耗品', items: ['罐头', '净水片', '抗生素', '电池'] },
      { type: '宝物', items: ['战前科技', '完整地图', '太阳能板', '纯净水'] },
    ],
    biomes: ['废墟城市', '辐射荒漠', '地下避难所', '变种森林', '废弃公路', '幸存者营地'],
    architecture: ['坍塌大楼', '地下掩体', '铁皮棚屋', '要塞围墙'],
  },

  steampunk: {
    genre: 'steampunk',
    classes: ['发明家', '飞行家', '机械师', '探险家', '炼金术师', '海盗'],
    banned: ['电脑', '塑料', '纳米', '外星'],
    attributes: {
      strength: { min: 1, max: 10, label: '力量' },
      agility: { min: 1, max: 10, label: '敏捷' },
      intelligence: { min: 1, max: 10, label: '才智' },
      constitution: { min: 1, max: 10, label: '体质' },
      charisma: { min: 1, max: 10, label: '魅力' },
    },
    itemPool: [
      { type: '武器', items: ['蒸汽步枪', '齿轮剑', '发条手枪', '电击手套', '气压炮'] },
      { type: '防具', items: ['黄铜护甲', '护目镜', '皮革飞行服', '齿轮靴'] },
      { type: '消耗品', items: ['蒸汽罐', '齿轮油', '火药', '绷带', '茶'] },
      { type: '宝物', items: ['蓝图', '精密齿轮', '永动核心', '飞行器碎片'] },
    ],
    biomes: ['蒸汽都市', '浮空岛', '机械工厂', '飞艇码头', '地下管道', '钟楼广场'],
    architecture: ['黄铜建筑', '蒸汽管道', '齿轮工厂', '飞艇港', '钟楼'],
  },

  cyberpunk: {
    genre: 'cyberpunk',
    classes: ['黑客', '雇佣兵', '义体医生', '情报贩子', '街头武士', '企业特工'],
    banned: ['魔法', '精灵', '龙', '中世纪武器'],
    attributes: {
      strength: { min: 1, max: 10, label: '体能' },
      agility: { min: 1, max: 10, label: '反射' },
      intelligence: { min: 1, max: 10, label: '智力' },
      constitution: { min: 1, max: 10, label: '义体耐受' },
      charisma: { min: 1, max: 10, label: '魅力' },
    },
    itemPool: [
      { type: '武器', items: ['智能手枪', '单分子刀', 'EMP手雷', '蜘蛛无人机', '电击鞭'] },
      { type: '义体', items: ['光学义眼', '强化手臂', '神经加速器', '皮下护甲'] },
      { type: '消耗品', items: ['神经兴奋剂', '数据芯片', '能量棒', '义体维修包'] },
      { type: '关键物品', items: ['加密数据', '通行卡', '身份芯片', '黑市货币'] },
    ],
    biomes: ['霓虹街道', '企业大厦', '地下黑市', '义体诊所', '数据堡垒', '废弃工业区'],
    architecture: ['摩天大楼', '全息广告牌', '地下通道', '服务器农场', '悬浮车道'],
  },

  historical: {
    genre: 'historical',
    classes: ['将军', '谋士', '医师', '商人', '工匠', '学者', '农民'],
    banned: ['枪械', '电脑', '机器人', '外星', '魔法'],
    attributes: {
      strength: { min: 1, max: 10, label: '武力' },
      agility: { min: 1, max: 10, label: '敏捷' },
      intelligence: { min: 1, max: 10, label: '智谋' },
      constitution: { min: 1, max: 10, label: '体质' },
      charisma: { min: 1, max: 10, label: '威望' },
    },
    itemPool: [
      { type: '武器', items: ['长剑', '长枪', '弓箭', '盾牌', '战马'] },
      { type: '防具', items: ['铠甲', '头盔', '护心镜', '战靴'] },
      { type: '消耗品', items: ['干粮', '草药', '酒', '金疮药'] },
      { type: '宝物', items: ['玉玺', '古卷', '金印', '兵符', '名画'] },
    ],
    biomes: ['皇城', '边关', '江南', '西域', '草原', '中原小镇'],
    architecture: ['皇宫', '衙门', '军营', '书院', '市集', '驿站'],
  },
};

// ============================================================
// Classification Engine
// ============================================================

function classifyGenre(worldMeta: { name?: string; genre?: string; tone?: string; description?: string; era?: string }): SettingGenre {
  const signals = [
    worldMeta.genre?.toLowerCase() ?? '',
    worldMeta.tone?.toLowerCase() ?? '',
    worldMeta.name?.toLowerCase() ?? '',
    worldMeta.description?.toLowerCase() ?? '',
    worldMeta.era?.toLowerCase() ?? '',
  ].join(' ');

  // Priority matching
  if (/cyber|赛博|义体|神经/.test(signals)) return 'cyberpunk';
  if (/蒸汽|steam|齿轮|黄铜/.test(signals)) return 'steampunk';
  if (/末日|废土|核战后|辐射/.test(signals)) return 'postapocalyptic';
  if (/恐怖|horror|惊悚|诡异/.test(signals)) return 'horror';
  if (/太空|宇宙|star|星际|飞船|火星|alien/.test(signals)) return 'scifi';
  if (/龙|dragon|魔法|精灵|orc|矮人|地牢/.test(signals)) return 'fantasy';
  if (/武侠|江湖|武林|门派|内力/.test(signals)) return 'wuxia';
  if (/荒岛|海难|飞机|生存|survival|幸存/.test(signals)) return 'survival';
  if (/三国|唐朝|宋朝|明朝|古代|historical|历史/.test(signals)) return 'historical';
  if (/都市|city|侦探|现代|城市/.test(signals)) return 'modern';

  return 'fantasy'; // 默认奇幻
}

// ============================================================
// Public API
// ============================================================

export function getGenreProfile(genre: SettingGenre): GenreProfile {
  return GENRE_PROFILES[genre];
}

export function detectAndGetProfile(worldMeta: {
  name?: string; genre?: string; tone?: string; description?: string; era?: string;
}): GenreProfile {
  const genre = classifyGenre(worldMeta);
  return GENRE_PROFILES[genre];
}

/** 验证某元素是否适合某世界观 */
export function validateConsistency(genre: SettingGenre, items: string[]): { valid: boolean; violations: string[] } {
  const profile = GENRE_PROFILES[genre];
  const violations = items.filter((item) =>
    profile.banned.some((banned) => item.toLowerCase().includes(banned.toLowerCase()))
  );
  return { valid: violations.length === 0, violations };
}

export { GENRE_PROFILES };
export type { GenreProfile };
