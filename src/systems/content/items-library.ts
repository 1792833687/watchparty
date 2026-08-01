/**
 * v4.0.0 通用物品库 — AI 叙事物品池
 * 供 AI 根据剧情进展合理分配物品。
 * 每个物品含 basePrice（铜币）、稀有度、来源、描述、效果。
 * @module systems/content/items-library
 */

import type { Rarity } from '@/theme/tokens';

export type ItemSource = 'market' | 'drop' | 'quest' | 'craft' | 'explore' | 'starting' | 'smithy' | 'tavern';

export interface LibraryItem {
  id: string;
  name: string;
  emoji: string;
  type: string;
  rarity: Rarity;
  /** 铜币基准价 */
  basePrice: number;
  /** 来源途径 */
  sources: ItemSource[];
  desc: string;
  lore?: string;
  /** 使用效果 */
  effect?: { hp?: number; mp?: number; attr?: string; value?: number };
  /** 武器/防具属性 */
  stats?: Record<string, number>;
  /** 是否堆叠 */
  stackable: boolean;
  /** 是否可装备 */
  equippable: boolean;
}

export const ITEMS_LIBRARY: LibraryItem[] = [
  // ==================== 消耗品 ====================
  {
    id: 'hp-potion-small', name: '小型生命药剂', emoji: '🧪', type: 'consumable',
    rarity: 'common', basePrice: 15, sources: ['market', 'drop', 'craft'],
    desc: '回复 25 点生命值。瓶子上贴着一张潦草的标签："有效的"。', effect: { hp: 25 },
    stackable: true, equippable: false,
  },
  {
    id: 'hp-potion-medium', name: '中型生命药剂', emoji: '🧪', type: 'consumable',
    rarity: 'uncommon', basePrice: 40, sources: ['market', 'drop', 'craft'],
    desc: '回复 60 点生命值。深红色的液体散发微弱的光芒。', effect: { hp: 60 },
    stackable: true, equippable: false,
  },
  {
    id: 'hp-potion-large', name: '大型生命药剂', emoji: '🧪', type: 'consumable',
    rarity: 'rare', basePrice: 100, sources: ['craft', 'quest'],
    desc: '回复 120 点生命值。药液在瓶中自主旋转，仿佛知道自己的使命。', effect: { hp: 120 },
    stackable: true, equippable: false,
  },
  {
    id: 'mp-potion-small', name: '小型法力药剂', emoji: '💠', type: 'consumable',
    rarity: 'common', basePrice: 12, sources: ['market', 'drop'],
    desc: '回复 20 点法力。淡蓝色的液体泛着冷光。', effect: { mp: 20 },
    stackable: true, equippable: false,
  },
  {
    id: 'mp-potion-medium', name: '中型法力药剂', emoji: '💠', type: 'consumable',
    rarity: 'uncommon', basePrice: 35, sources: ['market', 'drop', 'craft'],
    desc: '回复 50 点法力。瓶中有细小水晶悬浮，取之不尽。', effect: { mp: 50 },
    stackable: true, equippable: false,
  },
  {
    id: 'elixir-full', name: '万能复苏药剂', emoji: '🧪', type: 'consumable',
    rarity: 'epic', basePrice: 250, sources: ['quest', 'explore'],
    desc: '全回复生命与法力。传说只有三位炼金术师掌握了这个配方，其中两位已经不能说话了。',
    effect: { hp: 999, mp: 999 }, stackable: true, equippable: false,
  },
  {
    id: 'antidote', name: '解毒剂', emoji: '🌿', type: 'consumable',
    rarity: 'common', basePrice: 8, sources: ['market', 'craft', 'drop'],
    desc: '解除中毒状态。配方来自山间老妪，她说："蜘蛛从不说谎，但它们的毒会。"',
    stackable: true, equippable: false,
  },
  {
    id: 'bandage', name: '止血绷带', emoji: '🩹', type: 'consumable',
    rarity: 'common', basePrice: 5, sources: ['market', 'starting'],
    desc: '回复 10 点生命，解除流血。凛冬要塞守军的标准配给之一。',
    effect: { hp: 10 }, stackable: true, equippable: false,
  },
  {
    id: 'food-ration', name: '干粮', emoji: '🍞', type: 'consumable',
    rarity: 'common', basePrice: 3, sources: ['market', 'starting'],
    desc: '粗陋但管饱的黑面包。远征时的第四位伙伴。',
    effect: { hp: 5 }, stackable: true, equippable: false,
  },

  // ==================== 武器 ====================
  {
    id: 'iron-sword', name: '铁剑', emoji: '🗡️', type: 'weapon',
    rarity: 'common', basePrice: 30, sources: ['market', 'starting'],
    desc: '一把普通的铁剑，出鞘时有一声低沉的嗡鸣。',
    stats: { attack: 5 }, stackable: false, equippable: true,
  },
  {
    id: 'steel-blade', name: '精钢长剑', emoji: '🗡️', type: 'weapon',
    rarity: 'uncommon', basePrice: 80, sources: ['market', 'quest'],
    desc: '出自灰炉山铁匠之手。剑身上刻着：铸于寒夜，不知温暖为何物。',
    stats: { attack: 10, crit: 2 }, stackable: false, equippable: true,
  },
  {
    id: 'shadowfang', name: '暗影之牙', emoji: '🗡️', type: 'weapon',
    rarity: 'rare', basePrice: 220, sources: ['quest', 'explore'],
    desc: '剑刃由黑曜石削成，永不反光。据说它饮过的第一滴血就是铸剑者自己的。',
    stats: { attack: 18, crit: 5 }, stackable: false, equippable: true,
  },
  {
    id: 'frostguard', name: '霜卫之戟', emoji: '🗡️', type: 'weapon',
    rarity: 'epic', basePrice: 500, sources: ['quest'],
    desc: '凛冬要塞第一任指挥官的长戟。戟刃没有一丝锈迹，仿佛时间绕过了它。',
    stats: { attack: 28, crit: 8, magic: 5 }, stackable: false, equippable: true,
  },
  {
    id: 'hunter-bow', name: '猎弓', emoji: '🏹', type: 'weapon',
    rarity: 'common', basePrice: 25, sources: ['market', 'starting'],
    desc: '用阴影山脉的紫杉木制成。射程比普通长弓短，但沉默。',
    stats: { attack: 4, speed: 2 }, stackable: false, equippable: true,
  },
  {
    id: 'staff-apprentice', name: '学徒法杖', emoji: '🪄', type: 'weapon',
    rarity: 'common', basePrice: 20, sources: ['market', 'starting'],
    desc: '最基础的施法媒介。杖头镶嵌着一颗暗淡的月光石。',
    stats: { magic: 5, attack: 1 }, stackable: false, equippable: true,
  },
  {
    id: 'staff-archmage', name: '大法师权杖', emoji: '🪄', type: 'weapon',
    rarity: 'legendary', basePrice: 1200, sources: ['quest'],
    desc: '杖身缠绕着七条银龙脊椎。持有者曾在黑曜石荒原独自对抗一整支暗影军团——并赢了。',
    stats: { magic: 35, hp: 20, mp: 50 }, stackable: false, equippable: true,
  },

  // ==================== 防具 ====================
  {
    id: 'leather-armor', name: '皮甲', emoji: '🛡️', type: 'armor',
    rarity: 'common', basePrice: 20, sources: ['market', 'starting'],
    desc: '三层鞣制牛皮缝制，内侧还有上一任主人的汗味。',
    stats: { defense: 3 }, stackable: false, equippable: true,
  },
  {
    id: 'chainmail', name: '锁子甲', emoji: '🛡️', type: 'armor',
    rarity: 'uncommon', basePrice: 65, sources: ['market', 'quest'],
    desc: '两千三百个铁环，一个不漏。证明了一名铁匠长达三个月的耐心。',
    stats: { defense: 8 }, stackable: false, equippable: true,
  },
  {
    id: 'frostplate', name: '凛冬胸甲', emoji: '🛡️', type: 'armor',
    rarity: 'epic', basePrice: 400, sources: ['quest', 'craft'],
    desc: '肩甲部位浮雕着一棵枯树——那是凛冬要塞的旗帜。穿上它，你就是要塞本身。',
    stats: { defense: 18, hp: 30, coldResist: 10 }, stackable: false, equippable: true,
  },
  {
    id: 'cloak-night', name: '夜行斗篷', emoji: '🛡️', type: 'armor',
    rarity: 'uncommon', basePrice: 45, sources: ['market', 'quest'],
    desc: '在黑暗中几乎不可见的斗篷。你闻起来像阴影本身。',
    stats: { defense: 2, stealth: 8 }, stackable: false, equippable: true,
  },
  {
    id: 'ring-noble', name: '贵族纹章戒指', emoji: '💍', type: 'trinket',
    rarity: 'uncommon', basePrice: 75, sources: ['starting', 'quest'],
    desc: '纯金打造，戒面是你的家族纹章。它提醒你——也提醒别人——你的来处。',
    stats: { charisma: 2 }, stackable: false, equippable: true,
  },

  // ==================== 材料 ====================
  // v4.2.1 (P0-5): 合成配方原料补全 — 此前配方（crafting-system）原料在物品库零命中导致无法触发
  {
    id: 'herb', name: '草药', emoji: '🌿', type: 'material',
    rarity: 'common', basePrice: 8, sources: ['market', 'drop', 'explore'],
    desc: '凛冬谷野地里常见的草药。晒干后可用于炼金或煮茶。',
    stackable: true, equippable: false,
  },
  {
    id: 'empty-bottle', name: '空瓶', emoji: '🍶', type: 'material',
    rarity: 'common', basePrice: 3, sources: ['market', 'starting'],
    desc: '一只干净的玻璃瓶。酒馆老板总会多备几只。',
    stackable: true, equippable: false,
  },
  {
    id: 'sulfur', name: '硫磺', emoji: '🟨', type: 'material',
    rarity: 'common', basePrice: 10, sources: ['market', 'drop'],
    desc: '散发着刺鼻气味的黄色粉末。炼金与解毒的常用材料。',
    stackable: true, equippable: false,
  },
  {
    id: 'iron-ingot', name: '铁锭', emoji: '⚙️', type: 'material',
    rarity: 'common', basePrice: 25, sources: ['market', 'smithy', 'drop'],
    desc: '熔炼过的铁锭，铁匠铺的常备货。',
    stackable: true, equippable: false,
  },
  {
    id: 'wooden-handle', name: '木柄', emoji: '🪵', type: 'material',
    rarity: 'common', basePrice: 5, sources: ['market', 'smithy'],
    desc: '打磨光滑的硬木柄，武器的基础部件。',
    stackable: true, equippable: false,
  },
  {
    id: 'steel', name: '精钢', emoji: '🔩', type: 'material',
    rarity: 'uncommon', basePrice: 45, sources: ['market', 'smithy', 'quest'],
    desc: '掺了碳与秘法矿粉锻出的精钢，比普通铁更锋利。',
    stackable: true, equippable: false,
  },
  {
    id: 'leather', name: '皮革', emoji: '🧵', type: 'material',
    rarity: 'common', basePrice: 12, sources: ['market', 'drop'],
    desc: '鞣制过的动物皮革，可制甲或修补装备。',
    stackable: true, equippable: false,
  },
  {
    id: 'iron-nail', name: '铁钉', emoji: '📌', type: 'material',
    rarity: 'common', basePrice: 4, sources: ['market'],
    desc: '一袋粗铁钉，木工与制甲的必需品。',
    stackable: true, equippable: false,
  },
  {
    id: 'jerky', name: '肉干', emoji: '🥓', type: 'material',
    rarity: 'common', basePrice: 15, sources: ['market', 'drop'],
    desc: '风干的兽肉条，耐储存的旅人干粮。',
    stackable: true, equippable: false,
  },
  {
    id: 'spiced-wine', name: '香料酒', emoji: '🍷', type: 'material',
    rarity: 'common', basePrice: 18, sources: ['market', 'tavern'],
    desc: '加了香料的热酒，驱寒暖身，也是炖肉的灵魂。',
    stackable: true, equippable: false,
  },
  {
    id: 'clean-water', name: '清水', emoji: '💧', type: 'material',
    rarity: 'common', basePrice: 2, sources: ['market', 'explore'],
    desc: '一壶干净的水。要塞的井水始终清冽。',
    stackable: true, equippable: false,
  },
  {
    id: 'magic-crystal', name: '魔法水晶', emoji: '🔮', type: 'material',
    rarity: 'uncommon', basePrice: 60, sources: ['explore', 'quest', 'market'],
    desc: '蕴含微量魔力的水晶，附魔与法力药水的核心材料。',
    stackable: true, equippable: false,
  },
  {
    id: 'moonstone', name: '月光石', emoji: '💎', type: 'material',
    rarity: 'uncommon', basePrice: 30, sources: ['explore', 'drop'],
    desc: '采自冰峰深处的发光矿石。法师们说它能储存一个最小的愿望。',
    stackable: true, equippable: false,
  },
  {
    id: 'shadow-dust', name: '暗影尘', emoji: '⚫', type: 'material',
    rarity: 'rare', basePrice: 55, sources: ['drop', 'explore'],
    desc: '从暗影生物残骸中提取的黑色粉末。不要碰太久——它会和你说话。',
    stackable: true, equippable: false,
  },
  {
    id: 'dragon-scale', name: '龙鳞碎片', emoji: '🟡', type: 'material',
    rarity: 'epic', basePrice: 180, sources: ['drop', 'quest'],
    desc: '一片冰龙的鳞片，大小如手掌。握在手中时，你能感觉到龙脊冰峰上的风。',
    stackable: true, equippable: false,
  },
  {
    id: 'iron-ore', name: '铁矿石', emoji: '⛰️', type: 'material',
    rarity: 'common', basePrice: 6, sources: ['explore', 'market'],
    desc: '粗铁矿石，敲击时有低沉的闷响。不错的锻材。',
    stackable: true, equippable: false,
  },

  // ==================== 任务物品 ====================
  {
    id: 'torn-letter', name: '残破的信', emoji: '📜', type: 'quest',
    rarity: 'common', basePrice: 0, sources: ['quest', 'starting'],
    desc: '一封被雪水浸透的信，只余三分之一的字迹。可以辨认出：……要塞……钥匙……第四枚……',
    stackable: false, equippable: false,
  },
  {
    id: 'frozen-key', name: '冰霜之钥', emoji: '🔑', type: 'quest',
    rarity: 'epic', basePrice: 0, sources: ['quest'],
    desc: '一把永远冰凉的钥匙。它不打开任何一扇已知的门——而是打开一扇被遗忘的门。',
    stackable: false, equippable: false,
  },
  {
    id: 'old-pendant', name: '古老坠饰', emoji: '📿', type: 'quest',
    rarity: 'rare', basePrice: 0, sources: ['quest', 'explore'],
    desc: '坠饰里有一张微型画像。你认得那张脸——那是要塞建成之前的一位领主。',
    stackable: false, equippable: false,
  },

  // ==================== 宝物 ====================
  {
    id: 'silver-coins-pouch', name: '银币袋', emoji: '👛', type: 'treasure',
    rarity: 'common', basePrice: 0, sources: ['drop', 'explore'],
    desc: '一个小皮袋，装着若干银币。',
    stackable: false, equippable: false,
  },
  {
    id: 'ancient-coin', name: '古代金币', emoji: '🪙', type: 'treasure',
    rarity: 'rare', basePrice: 0, sources: ['explore'],
    desc: '铸有着早已湮灭的王国徽记。收藏家会出高价，但也许它本身就是一把钥匙。',
    stackable: false, equippable: false,
  },
  {
    id: 'source-shard', name: '源晶碎片', emoji: '💎', type: 'treasure',
    rarity: 'legendary', basePrice: 0, sources: ['quest', 'explore'],
    desc: '原始的魔法本源凝结成的晶体。整个凛冬要塞据传只有七枚——你手中的是第几枚？',
    stackable: true, equippable: false,
  },

  // ==================== 典籍 ====================
  {
    id: 'old-journal', name: '守夜人日志', emoji: '📖', type: 'tome',
    rarity: 'uncommon', basePrice: 12, sources: ['explore', 'quest'],
    desc: '前任守夜人的记录。他写道：今晚，阴影山脉那边又传来呼喊。我不想再去听了。',
    stackable: false, equippable: false,
  },
  {
    id: 'rune-book', name: '符文入门', emoji: '📖', type: 'tome',
    rarity: 'common', basePrice: 18, sources: ['market'],
    desc: '一本破旧的符文入门教材。封面写着：给那些关上门还觉得不够安全的人。',
    stackable: false, equippable: false,
  },
  {
    id: 'forbidden-tome', name: '禁咒抄本', emoji: '📖', type: 'tome',
    rarity: 'legendary', basePrice: 800, sources: ['quest'],
    desc: '翠溪隐谷塔楼的禁书目录中最靠前的一本。读第一页就会头痛，读到第三页……还没人活到过第三页。',
    stackable: false, equippable: false,
  },

  // ==================== v4.2.0 探索宝藏装备（埋藏于剧情探索） ====================
  // 高品质装备：仅通过探索/任务/宝箱获得，品质分级（uncommon~legendary），
  // 每件含 lore 背景与特殊属性（stats），供 AI 掉落协议引用。
  {
    id: 'blade-emberfang', name: '余烬獠牙', emoji: '🔥', type: 'weapon',
    rarity: 'epic', basePrice: 420, sources: ['explore', 'quest'],
    desc: '被灰烬王庭的火焰淬炼过的短刀，刀身永远温热。传闻它曾在黄昏时分斩断过一整个军团。',
    stats: { attack: 14, fire: 6, crit: 5 }, stackable: false, equippable: true,
    lore: '灰烬王庭覆灭前，最后一位铸刀师将自己的名字刻进了刀柄内侧，然后走进火里。',
  },
  {
    id: 'staff-windcaller', name: '唤风者之杖', emoji: '🌪️', type: 'weapon',
    rarity: 'epic', basePrice: 480, sources: ['explore', 'quest'],
    desc: '杖身盘绕着风化的符文，顶部的水晶在风中发出低鸣。持杖者可以读懂风向，也可以命令它。',
    stats: { spellPower: 16, windResist: 8 }, stackable: false, equippable: true,
    lore: '德鲁伊议会曾用它平息过一场持续七年的风暴。',
  },
  {
    id: 'bow-moonshade', name: '月影长弓', emoji: '🏹', type: 'weapon',
    rarity: 'legendary', basePrice: 900, sources: ['explore'],
    desc: '精灵工匠用月光下的白蜡木打造，弓弦是银丝与独角兽鬃毛编织。射出的箭在月光下隐形。',
    stats: { attack: 20, stealth: 10, crit: 8 }, stackable: false, equippable: true,
    lore: '只有被森林承认的射手才能拉开它。',
  },
  {
    id: 'armor-starplate', name: '星辉板甲', emoji: '🛡️', type: 'armor',
    rarity: 'epic', basePrice: 520, sources: ['explore', 'quest'],
    desc: '矮人铸匠以陨铁打造，表面嵌着细碎的星辉石。穿上它，连影子都会被压得喘不过气。',
    stats: { defense: 22, hp: 40, resist: 10 }, stackable: false, equippable: true,
    lore: '灰炉山深处的矿脉早已枯竭，这套板甲是最后一批陨铁锻造品。',
  },
  {
    id: 'cloak-voidweave', name: '虚空编织斗篷', emoji: '🌌', type: 'armor',
    rarity: 'legendary', basePrice: 850, sources: ['explore'],
    desc: '用暗影边缘的丝线织成。穿戴者可以短暂融入阴影——但每次使用，都会听见一声不属于任何人的轻笑。',
    stats: { defense: 6, stealth: 15, dodge: 8 }, stackable: false, equippable: true,
    lore: '它来自黑曜石荒原最深处的裂隙，没人知道是谁织的。',
  },
  {
    id: 'ring-dragonbreath', name: '龙息之戒', emoji: '💍', type: 'trinket',
    rarity: 'legendary', basePrice: 700, sources: ['explore', 'quest'],
    desc: '戒面是一枚微缩的龙炎宝石。佩戴者每天可呼唤一次小型龙息，冷却后宝石黯淡如死灰。',
    stats: { fire: 12, charisma: 3 }, stackable: false, equippable: true,
    lore: '龙脊冰峰上最后一条龙在沉睡时失去了它——它不希望任何人知道。',
  },
  {
    id: 'amulet-warden', name: '守夜人徽记', emoji: '🏅', type: 'trinket',
    rarity: 'rare', basePrice: 260, sources: ['quest', 'explore'],
    desc: '凛冬要塞历代守夜人的传承徽记。佩戴者面对黑暗生物时，会感到一股熟悉的暖意。',
    stats: { defense: 4, darkResist: 12, wisdom: 2 }, stackable: false, equippable: true,
    lore: '每一任守夜人在离任时都会把徽记交给继任者——至今已传了三十七代。',
  },
  {
    id: 'shield-mithril', name: '秘银圆盾', emoji: '🛡️', type: 'armor',
    rarity: 'rare', basePrice: 300, sources: ['explore', 'craft'],
    desc: '以阴影山脉矿道深处的秘银打造，轻若无物却坚不可摧。盾面刻着矮人古语：不破。',
    stats: { defense: 14, block: 10 }, stackable: false, equippable: true,
    lore: '阴影山脉的矿道早已被半兽人占据，但秘银的传说仍在流传。',
  },
];
