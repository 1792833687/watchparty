/**
 * v4.1.0 世界书系统（沉浸式设定管理）
 *
 * 世界书 = 权威设定源。AI 叙事必须基于世界书内容推进，避免偏离主线。
 * 支持查看与编辑（新增/修改条目），条目可锁定（默认条目不可删除）。
 * 持久化：localStorage（键 ai-narrator-worldbook）。
 *
 * @module systems/worldbook/worldbook-system
 */

export interface WorldBookEntry {
  id: string;
  /** 章节/分组 */
  section: string;
  title: string;
  /** 正文（支持多行文本） */
  content: string;
  /** 默认条目不可删除 */
  locked?: boolean;
  /** 是否启用（关闭的条目不注入 AI prompt） */
  enabled?: boolean;
  /** 排序权重（越小越靠前） */
  order?: number;
}

export const WORLDBOOK_STORAGE_KEY = 'ai-narrator-worldbook';

// ============================================================
// 默认世界书条目（从 world-setting.md 权威设定抽取）
// ============================================================

export function createDefaultWorldBook(): WorldBookEntry[] {
  return [
    {
      id: 'wb-world', section: '世界观', title: '世界概览', order: 1, locked: true,
      content:
        '凛冬要塞：暗影纪元 — 中世纪魔幻，史诗吟游基调。\n' +
        '暗影再次笼罩中洲。远古的邪恶在东方苏醒，半兽人在阴影山脉中集结。\n' +
        '旧王国的血脉已几近断绝，精灵的船只正驶向西方。\n' +
        '在这最后的希望之地，凛冬要塞的烽火台上，一位新的领主接过了守夜人的火炬。\n' +
        '这是你的要塞。你的战争。你的烙印。你的命运。',
    },
    {
      id: 'wb-geo', section: '世界观', title: '地理区域（6 区）', order: 2, locked: true,
      content:
        '1. 凛冬谷 — 要塞周边已清理的安全区域。农田、巡逻队和难民构成生活景象。\n' +
        '2. 暮色森林 — 古老森林，精灵遗迹散布。阳光斑驳，深处阴影永不消散。\n' +
        '3. 阴影山脉 — 曾经的矮人王国疆域，半兽人与黑暗生物盘踞，矿道深处有秘银矿脉。\n' +
        '4. 荒芜平原 — 古代战场遗址，亡灵与不死生物夜间游荡。\n' +
        '5. 黑曜石荒原 — 黑暗君主力量核心渗透区，永不熄灭的火山映红天空。\n' +
        '6. 龙脊冰峰 — 极北冰封山脉，龙、远古魔法与预言遗迹静候。\n' +
        '区域随剧情渐进解锁；连线由 connections 决定。',
    },
    {
      id: 'wb-factions', section: '世界观', title: '阵营（6 大阵营）', order: 3, locked: true,
      content:
        '白石王国（人类王国主力，实用主义）/ 北境骠骑国（忠诚盟友，不信任暗影）/\n' +
        '灰炉山矮人（中立封闭，实用主义）/ 幽林精灵（孤立，绝对敌视暗影）/\n' +
        '翠溪隐谷（逐渐撤离，警惕但理解）/ 雪原游侠（暗中守护，以结果判断）。\n' +
        '声望 -100~+100 五级阶梯：仇敌/敌视/中立/友好/同盟。',
    },
    {
      id: 'wb-magic', section: '设定', title: '魔法学派（7 学派）', order: 4, locked: true,
      content:
        '防护系/咒法系/预言系/塑能系/幻术系/死灵系（暗系，习得 +堕落）/变化系。\n' +
        '另含「武技」（战斗技艺）与「神圣」（圣职神术）两个非魔法分类。\n' +
        '法术等级：戏法/1环~5环，消耗魔力。',
    },
    {
      id: 'wb-corruption', section: '设定', title: '堕落值系统', order: 5, locked: true,
      content:
        '堕落值 0-100 六阶段：纯净0-20/微染21-40/侵蚀41-60/暗影61-80/堕落81-99/深渊100。\n' +
        '侵蚀解锁暗影低语选项；深渊触发「湮灭」结局。\n' +
        '灵魂印记：关键选择留下不可消除的叙事印记（如艾拉的命运）。',
    },
    {
      id: 'wb-territory', section: '设定', title: '领地经营', order: 6, locked: true,
      content:
        '6 设施（主堡/城墙/兵营/民居/神殿/工坊）× 3 级；战略桌 4 项目；防御值与围城战。\n' +
        '围城战倒计时归零时敌军来袭，防御值高于攻势则守住。',
    },
    {
      id: 'wb-endings', section: '设定', title: '多结局（7+1）', order: 7, locked: true,
      content:
        '人类纪元/王者归来/精灵西渡/矮人复兴（光明线）/魔君陨落（黑暗·英雄）/\n' +
        '最后的联盟（光明·牺牲）/ 虚空守望者（隐藏·真结局，需预言碎片+堕落40-60+全阵营≥60+艾拉线）。\n' +
        'AI 需通过 endingFlags 追踪结局关键进度。',
    },
    {
      id: 'wb-characters', section: '人物', title: '关键 NPC', order: 8, locked: true,
      content:
        '同伴：塔林·铜锤（矮人铁匠）、艾琳·星语（精灵学者）、罗兰爵士（圣骑士）、\n' +
        '莉亚·风行者（游侠斥候）、格朗·铁砧（堕落领主）。\n' +
        '艾拉：被拯救的小女孩，游离之魂事件后成为特殊同伴，与真结局直接相关。\n' +
        '老学士梅林：主堡的学者，掌管编年史。',
    },
    {
      id: 'wb-rules', section: '规则', title: '特殊规则', order: 9, locked: true,
      content:
        '· 双维关系：好感度 + 忠诚度，关键剧情触发同伴信念审判。\n' +
        '· 代价性成功：完美胜利需暗影力量；光荣成功伴随牺牲；妥协成功以道德/同伴关系为代价。\n' +
        '· 传承系统：失败后新局继承编年史传说 + 遗物装备 + 部分世界状态。\n' +
        '· 通关书信：《致领主书》根据结局生成。\n' +
        '· D20 检定：简单10/普通15/困难20/极难25。',
    },
  ];
}

// ============================================================
// 持久化
// ============================================================

/** 从 localStorage 读取世界书（容错） */
export function loadWorldBook(): WorldBookEntry[] {
  try {
    const raw = localStorage.getItem(WORLDBOOK_STORAGE_KEY);
    if (!raw) return createDefaultWorldBook();
    const parsed = JSON.parse(raw) as WorldBookEntry[];
    if (!Array.isArray(parsed)) return createDefaultWorldBook();
    // 合并默认条目（新增默认条目时旧存档自动补齐）
    const defaults = createDefaultWorldBook();
    const merged = [...parsed];
    for (const d of defaults) {
      if (!merged.some((e) => e.id === d.id)) merged.push(d);
    }
    return merged.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  } catch {
    return createDefaultWorldBook();
  }
}

/** 保存世界书到 localStorage */
export function saveWorldBook(entries: WorldBookEntry[]): boolean {
  try {
    localStorage.setItem(WORLDBOOK_STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

/** 重置为默认世界书 */
export function resetWorldBook(): WorldBookEntry[] {
  try { localStorage.removeItem(WORLDBOOK_STORAGE_KEY); } catch { /* ignore */ }
  return createDefaultWorldBook();
}

// ============================================================
// AI Prompt 构建
// ============================================================

/**
 * 构建世界书约束文本（注入系统 prompt）。
 * 世界书 = 权威设定源：AI 必须遵循，不得与其中设定矛盾或偏离主线。
 * 仅注入 enabled 的条目。
 */
export function buildWorldBookPrompt(entries: WorldBookEntry[]): string {
  const active = entries.filter((e) => e.enabled !== false && e.content.trim().length > 0);
  if (active.length === 0) return '';
  const body = active
    .map((e) => `【${e.section}·${e.title}】\n${e.content.trim()}`)
    .join('\n\n');
  return `【世界书 — 权威设定源】（最高优先级）
以下内容是本世界的权威设定，AI 叙事必须严格遵循，不得与其中任何条目矛盾或偏离主线：
${body}
   - 世界书条目优先级高于你生成的其他内容；当剧情走向与设定冲突时，以世界书为准。
   - 玩家可能在世界书面板中编辑设定，请依据最新内容推进叙事。`;
}

/** 章节分组统计（供面板渲染） */
export function groupBySection(entries: WorldBookEntry[]): { section: string; entries: WorldBookEntry[] }[] {
  const map = new Map<string, WorldBookEntry[]>();
  for (const e of entries) {
    const list = map.get(e.section) ?? [];
    list.push(e);
    map.set(e.section, list);
  }
  return Array.from(map.entries()).map(([section, list]) => ({
    section,
    entries: list.sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
  }));
}
