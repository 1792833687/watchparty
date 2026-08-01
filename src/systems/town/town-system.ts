/**
 * v4.2.0 城镇系统（D&D 风格）
 *
 * 凛冬谷是凛冬要塞的核心城镇。进入后可访问：
 * - 酒馆：接取任务、收集情报（AI 动态生成）
 * - 商店：买卖物品（复用市场系统）
 * - 旅馆：休息恢复（HP/MP）、触发随机事件
 * - 铁匠铺：装备锻造/升级（品质分级）
 * - 神殿：祈祷（减堕落值）、接受祝福
 * @module systems/town/town-system
 */

export type TownFacilityId = 'tavern' | 'shop' | 'inn' | 'smithy' | 'temple';

export interface TownFacility {
  id: TownFacilityId;
  name: string;
  icon: string;
  desc: string;
  /** 互动能力标签 */
  actions: string[];
  /** 是否解锁（随剧情） */
  unlocked?: boolean;
}

export const TOWN_FACILITIES: TownFacility[] = [
  {
    id: 'tavern', name: '酒馆「烽火与麦酒」', icon: '🍺',
    desc: '冒险者的聚集地。吧台后的老板娘永远知道比表面更多的事。',
    actions: ['接取委托', '打听情报', '聆听流言', '招募同伴'],
  },
  {
    id: 'shop', name: '杂货铺「铁与皮」', icon: '🏪',
    desc: '经营补给与日用品的店铺。老板是退役的商队护卫。',
    actions: ['购买补给', '出售战利品', '以物易物'],
  },
  {
    id: 'inn', name: '旅馆「白鹿旅店」', icon: '🛏️',
    desc: '要塞内最温暖的床铺。传说旅店老板的阁楼藏着旧日王国的秘密。',
    actions: ['休息恢复', '触发事件', '存档点'],
  },
  {
    id: 'smithy', name: '铁匠铺「炉火」', icon: '🔨',
    desc: '矮人铁匠塔林·铜锤的工坊。炉火终日不熄，好装备出自这里。',
    actions: ['锻造装备', '升级强化', '修复耐久'],
  },
  {
    id: 'temple', name: '神殿「圣光礼拜堂」', icon: '⛪',
    desc: '供奉着旧日诸神的礼拜堂。微弱的圣光在暗影纪元依然不熄。',
    actions: ['祈祷', '治愈伤病', '接受祝福'],
  },
];

export const TOWN_FACILITY_LOOKUP = Object.fromEntries(TOWN_FACILITIES.map((f) => [f.id, f])) as Record<TownFacilityId, TownFacility>;

export function getTownFacilityName(id: TownFacilityId): string {
  return TOWN_FACILITY_LOOKUP[id]?.name ?? '未知场所';
}

export interface TownVisitResult {
  facilityId: TownFacilityId;
  /** 供 AI 注入的提示文本 */
  promptHint: string;
}

/** 进入场所时向 AI 发送的指令 */
export function buildFacilityPrompt(facilityId: TownFacilityId): string {
  const f = TOWN_FACILITY_LOOKUP[facilityId];
  if (!f) return '我走进了凛冬谷的街道。';
  switch (facilityId) {
    case 'tavern':
      return `我走进了${f.name}。请描述酒馆氛围，安排 1-2 位可互动的 NPC（可包括老板娘或冒险者），并给出一条可接取的委托或有价值的情报。`;
    case 'shop':
      return `我走进了${f.name}。请介绍货架上的商品与老板，说明可以购买什么、老板对当前局势的看法。`;
    case 'inn':
      return `我走进了${f.name}。请描述旅店环境与老板娘，安排我办理入住（若需要休息请提示）。`;
    case 'smithy':
      return `我走进了${f.name}。塔林·铜锤正在打铁，请描述工坊与可锻造的装备，说明当前材料能打造什么品质的装备。`;
    case 'temple':
      return `我走进了${f.name}。请描述礼拜堂的肃穆氛围，神职人员会提供祈祷与祝福，说明圣光在暗影纪元的意义。`;
    default:
      return `我来到了凛冬谷的${f.name}。`;
  }
}
