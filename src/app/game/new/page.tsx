/**
 * New Game Page — AI Narrator Game v4.2.0
 *
 * Route: /game/new
 * Three-phase flow:
 *   1. NarratorIntro — world introduction narration
 *   2. CharacterCreation — profession/origin/background/attributes
 *   3. Chat — interactive gameplay with SSE streaming
 *
 * Uses fetch directly (no DialogueSession dependency).
 * v4.2.0: 悬浮式面板/移动端适配, 新闻推送, 城镇系统, 关系链+角色交互,
 *         开局无技能(剧情习得), 背包组合, 世界书自动记录, 探索宝藏装备,
 *         主线5阶段+AI支线, D&D 一致性核查.
 * v4.1.0: Zod 校验, NPC 行为引擎, 事件溯源, TTS, 场景插图, 堕落值六阶段,
 *         阵营声望, 暗影低语, D20 检定, 领地经营, 多结局, NPC 艾拉.
 * v4.0.0: 12 职业 + 6 出身独立系统, 多层级货币与市场, 对话选项 UI,
 *         后台物品/元素库, 地图交互增强, 背包详情.
 * v3.0.0: Single Frosthold preset, 9 魔法学派, 金币经济, 关系网络, 渐进地图.
 */

'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { useWorldStore } from '@/stores/world-store';
import { FROSTHOLD_PRESET } from '@/systems/settings/settings-loader';
import type { AttrDetail } from '@/components/game/CharacterCreation';
import type { CompanionRelationship } from '@/components/game/panels/types';
import { DEFAULT_STARTING_GOLD } from '@/lib/constants';
import { NarratorIntro } from '@/components/game/NarratorIntro';
import { CharacterCreation } from '@/components/game/CharacterCreation';
import { GamePanelBar } from '@/components/game/GamePanelBar';
import { PanelContainer } from '@/components/game/PanelContainer';
import { QuickSettingsPanel, type QuickSettings } from '@/components/game/QuickSettingsPanel';
import { SaveLoadPanel, type SaveSlotMeta } from '@/components/game/SaveLoadPanel';
import { ErrorBoundaryWithRetry } from '@/components/common/ErrorBoundaryWithRetry';
import { streamChat, fetchChat } from '@/lib/utils/sse-stream';
import { exportDialogueHistory, type ExportableMessage } from '@/lib/utils/export-dialogue';
import { secureGet, migrateLegacyKey } from '@/infrastructure/crypto/secure-storage';
import { GameLayout, MessageBubbleLayout } from '@/components/layout/GameLayout';
// v5.1.0 (移动端): 响应式断点（顶栏精简/场景图尺寸/选项区折叠）
import { useIsMobile } from '@/hooks/useMediaQuery';
import { getSessionSeed, setSessionSeed, createRng, rollEvent } from '@/lib/utils/random';
import { withBase } from '@/lib/utils/base-path';
import type { CharacterData } from '@/components/game/CharacterCreation';
import type { PanelId, GameState, GameItem, GameQuest, GameRegion } from '@/components/game/panels/types';
import type { GameSetting as FullGameSetting, CompanionInfo } from '@/systems/settings/types';
// v1.0.0: New systems
import { resolveCombat, type CombatResult, type Element, type PlayerCombatStats } from '@/systems/combat/combat-engine';
import { checkAchievements, getAchievements, resetAchievements, getAchievementProgress, type Achievement } from '@/systems/achievements/achievement-system';
import { rollWorldEvent, rollSeasonalEvent, type EventRollResult } from '@/systems/events/event-engine';
import { generateStarterGear, type Equipment } from '@/systems/equipment/equipment-system';
import { AchievementToast, type AchievementToastData } from '@/components/game/AchievementToast';
import { EquipmentCard } from '@/components/game/EquipmentCard';
import { CombatLog, type CombatLogEntry } from '@/components/game/CombatLog';
import { DialogueOptions } from '@/components/game/DialogueOptions';
import type { DialogueOption } from '@/components/game/panels/types';
import type { CharacterInjury } from '@/components/game/panels/CharacterPanel';
// v4.2.1 (P2-2): 移除 resolveStarterSkillNames 死代码导入（v4.2.0 开局无技能，starterSkills 不再预解锁）

// v4.0.0: 内容数据层与市场系统
import { PROFESSIONS, ORIGINS, ITEMS_LIBRARY, STORY_CLUES, LOCATION_INTERACTIONS } from '@/systems/content';
import type { LibraryItem } from '@/systems/content';
import { calculateBuyPrice, formatPrice, calculateSellPrice, updateSupplyDemand, resetMarketCache } from '@/systems/market/market-system';
import { copperToWallet, walletToCopper, goldToCopper, EMPTY_WALLET, CURRENCY, type Wallet } from '@/theme/tokens';
// v4.1.0: Zod 校验 + NPC 引擎 + 事件溯源 + TTS + 场景插图
import { safeParseGameState, safeParseDialogueOptions } from '@/systems/validation/game-state-schema';
import { createInitialNpcState, tickWorld, type NpcEngineState, type TickResult } from '@/systems/npc/npc-engine';
import { createEventStore, appendEvent, type EventStore } from '@/systems/save/event-store';
import { TTSButton } from '@/components/game/TTSButton';
import { NarrativeRenderer } from '@/components/game/NarrativeRenderer';
import { SceneImage } from '@/components/game/SceneImage';
import { sceneMatches } from '@/components/game/scene-art';
import { CheckDiceOverlay, parseCheckBlocks, stripCheckBlocks } from '@/components/game/CheckDiceOverlay';
// v4.1.0: 领地经营系统（world-setting 八）
import {
  createInitialTerritory, calcDefense, payCost, getUpgradeCost, canAfford,
  resolveSiege, collectTax, collectWorkshopOutput, templePrayer,
  FACILITIES, STRATEGY_PROJECTS,
  type TerritoryState, type FacilityId, type ResourceId,
} from '@/systems/territory/territory-system';
// v4.1.0: 多结局系统（world-setting 十一）
import { evaluateEnding, buildEndingPrompt, ENDINGS, type EndingDef } from '@/systems/endings/ending-system';
import { EndingOverlay } from '@/components/game/EndingOverlay';
// v4.1.0: 世界书系统（权威设定源）
import { loadWorldBook, saveWorldBook, buildWorldBookPrompt, type WorldBookEntry } from '@/systems/worldbook/worldbook-system';
// v4.2.0: 新闻推送 / 城镇 / 关系链
import { NewsFeed, type NewsItem } from '@/components/layout/GameLayout';
import { getTownFacilityName, buildFacilityPrompt, type TownFacilityId } from '@/systems/town/town-system';
import { createEmptyChain, companionToNode, interactWithNode, addDynamicNode, relationFromAffinity, type RelationChain, type ChainNode } from '@/systems/npc/relation-chain';
// v4.2.2: 全局指令队列纯函数
import { enqueueAction, dequeueAction } from '@/systems/utils/action-queue';
// v4.2.0: 物品组合系统
import { findRecipe, applyCraft, CRAFT_CATEGORY_LABELS } from '@/systems/crafting/crafting-system';
// v4.2.0: 任务系统（主线细化 + 支线生成）
import { MAIN_QUEST_LINE, SIDE_QUEST_PROMPT } from '@/systems/quests/quest-system';

/** v4.1.0: 领地设施/战略项目查找表 */
const FACILITIES_DEF_LOOKUP = Object.fromEntries(FACILITIES.map((f) => [f.id, f])) as Record<FacilityId, (typeof FACILITIES)[number]>;
const STRATEGY_PROJECTS_LOOKUP = Object.fromEntries(STRATEGY_PROJECTS.map((p) => [p.id, p])) as Record<string, (typeof STRATEGY_PROJECTS)[number]>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
/**
 * BUILD_PRESET — v2.0.0: single Frosthold preset.
 * The only built-in world is "凛冬要塞" (frosthold).
 * All other presets removed. Custom imports (_imported) still supported via default fallback.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BUILD_PRESET(pid: string): any {
  if (pid !== 'frosthold') return BUILD_PRESET('frosthold');

  const bp = { attributeNames: ['strength','dexterity','constitution','intelligence','wisdom','charisma'] as string[], totalAttributePoints: 28 };

  return {
    worldMeta: {
      name: '凛冬要塞：暗影纪元',
      genre: '中世纪魔幻',
      tone: '史诗吟游',
      description:
        '暗影再次笼罩中洲。远古的邪恶在东方苏醒，半兽人在阴影山脉中集结。' +
        '旧王国的血脉已几近断绝，精灵的船只正驶向西方。' +
        '在这最后的希望之地，凛冬要塞的烽火台上，一位新的领主接过了守夜人的火炬。' +
        '这是你的要塞。你的战争。你的烙印。你的命运。',
    },
    startingLocation: {
      openingNarrative:
        '（灰白色的晨光艰难地越过阴影山脉的雪线，洒在凛冬要塞斑驳的黑色花岗岩城墙上。）' +
        '（你站在主堡最高处的瞭望台上。东方的天空被染成一片浑浊的暗橘色——那不是朝霞，' +
        '是黑曜石荒原上永不熄灭的火山映出的光。半兽人的战鼓声已经很久没有响起了，' +
        '但每一个经历过战争的老兵都知道，这往往意味着更可怕的风暴正在酝酿。）' +
        '（铁锤敲打声、马嘶声、晨祷的低语，这些声音构成了你在无数个黎明中最熟悉的旋律。' +
        '今天，这份旋律里多了一丝不安：一份来自白石的信使昨晚抵达，带来了一则消息——' +
        '黑暗的势力正在东方集结，规模前所未有。）' +
        '老学士梅林站在塔楼入口，手里捧着一本厚重的羊皮纸册子。' +
        '"在一切开始之前，让我记下你的名字。还有，你是谁。"',
    },
    playerOptions: {
      ...bp,
      availableClasses: [
        { id: 'gondor-knight', name: '白石骑士', description: '力量+2 魅力+1。擅长：长剑、骑术、指挥。', baseAttributes: { strength: 5, dexterity: 3, constitution: 3, intelligence: 2, wisdom: 2, charisma: 4 }, startingEquipment: ['白石长剑', '骑士盾', '锁子甲', '领主徽章'] },
        { id: 'northern-ranger', name: '雪原游侠', description: '敏捷+2 感知+1。擅长：弓箭、潜行、追踪。', baseAttributes: { strength: 3, dexterity: 5, constitution: 3, intelligence: 2, wisdom: 4, charisma: 2 }, startingEquipment: ['游侠长弓', '精灵斗篷', '短剑', '追踪工具'] },
        { id: 'rivendell-scholar', name: '翠溪隐谷学者', description: '智力+2 感知+1。擅长：古代语、魔法、医疗。', baseAttributes: { strength: 2, dexterity: 2, constitution: 2, intelligence: 5, wisdom: 4, charisma: 3 }, startingEquipment: ['魔法书', '水晶球', '草药包', '古代语词典'] },
        { id: 'lonely-mountain-smith', name: '灰炉山铁匠后裔', description: '体质+2 力量+1。擅长：锻造、采矿、陷阱。', baseAttributes: { strength: 4, dexterity: 2, constitution: 5, intelligence: 3, wisdom: 2, charisma: 2 }, startingEquipment: ['矮人锻造锤', '矿镐', '陷阱工具', '秘银碎片'] },
        { id: 'rohan-rider', name: '北境骠骑', description: '敏捷+2 魅力+1。擅长：骑射、长矛、驯兽。', baseAttributes: { strength: 3, dexterity: 5, constitution: 3, intelligence: 2, wisdom: 2, charisma: 4 }, startingEquipment: ['复合弓', '骑枪', '驯兽哨', '北境骠骑战马'] },
        { id: 'custom', name: '自定义', description: '自由分配属性点与技能倾向。', baseAttributes: { strength: 3, dexterity: 3, constitution: 3, intelligence: 3, wisdom: 3, charisma: 3 }, startingEquipment: ['旅行者行囊', '短剑', '干粮x3'] },
      ],
    },
    themeData: {
      classes: [
        { id: 'gondor-knight', name: '白石骑士', desc: '以长剑与骑术闻名的人类战士。', icon: '\u2694' },
        { id: 'northern-ranger', name: '雪原游侠', desc: '阴影中的弓箭手，追踪与潜行大师。', icon: '\ud83c\udff9' },
        { id: 'rivendell-scholar', name: '翠溪隐谷学者', desc: '钻研古代语与魔法的智者。', icon: '\ud83d\udd2e' },
        { id: 'lonely-mountain-smith', name: '灰炉山铁匠后裔', desc: '矮人工艺传承者，坚韧不拔的战士。', icon: '\u2692' },
        { id: 'rohan-rider', name: '北境骠骑', desc: '草原骑射手与驯兽师。', icon: '\ud83c\udfc7' },
        { id: 'custom', name: '自定义', desc: '自由分配属性点，书写属于你自己的传奇。', icon: '\u2728' },
      ],
      attributes: FROSTHOLD_PRESET.attributes,
      skillCategories: FROSTHOLD_PRESET.skillCategories,
      startingItems: [
        { name: '钢制长剑', type: 'weapon', desc: '白石标准配发长剑，平衡而可靠' },
        { name: '皮甲', type: 'armor', desc: '轻便皮甲，适合长途行军' },
        { name: '领主徽章', type: 'key', desc: '刻着七星与银树的家族纹章' },
        { name: '治疗药剂', type: 'consumable', desc: '恢复生命值30点' },
        { name: '羊皮纸地图', type: 'tool', desc: '标记要塞周边已知区域的古旧地图' },
      ],
      mapRegions: [
        { name: '凛冬谷', desc: '要塞周边已清理的安全区域。', connections: ['暮色森林', '阴影山脉'] },
        { name: '暮色森林', desc: '古老森林，精灵遗迹散布。', connections: ['凛冬谷', '阴影山脉'] },
        { name: '阴影山脉', desc: '矮人故土，半兽人盘踞。', connections: ['凛冬谷', '暮色森林', '荒芜平原'] },
        { name: '荒芜平原', desc: '古代战场，亡灵游荡。', connections: ['阴影山脉', '黑曜石荒原'] },
        { name: '黑曜石荒原', desc: '黑暗力量核心渗透区。', connections: ['荒芜平原', '龙脊冰峰'] },
        { name: '龙脊冰峰', desc: '极北冰封山脉，远古生物栖息。', connections: ['黑曜石荒原'] },
      ],
      forbiddenTerms: FROSTHOLD_PRESET.forbiddenTerms,
      origins: FROSTHOLD_PRESET.origins,
      backgrounds: FROSTHOLD_PRESET.backgrounds,
      magicSchools: FROSTHOLD_PRESET.magicSchools,
      mapRegionsV2: FROSTHOLD_PRESET.mapRegionsV2,
      companions: FROSTHOLD_PRESET.companions,
      factions: FROSTHOLD_PRESET.factions,
    },
    worldBuilderVersion: '4.1.0',
    worldProfile: {
      name: '凛冬要塞：暗影纪元',
      genre: '中世纪魔幻',
      tone: '史诗吟游',
      tagline: '光明与黑暗的内心斗争、力量与代价的永恒博弈。',
      era: '中世纪',
      geography: '山地/要塞',
      climate: '寒冷',
      techLevel: 3,
      magicLevel: 8,
      governance: '封建',
      races: ['人类', '矮人', '精灵', '半身人'],
      factions: [
        { id: 'gondor', name: '白石王国', description: '人类王国，抵抗黑暗的主力', attitude: 'friendly', power: 6, territory: '白城' },
        { id: 'lonely-mountain', name: '灰炉山矮人', description: '中立封闭的矮人王国', attitude: 'neutral', power: 5, territory: '灰炉山' },
        { id: 'wood-elves', name: '幽林精灵', description: '孤立不信任外人的精灵王国', attitude: 'neutral', power: 5, territory: '暮色森林深处' },
        { id: 'dark-legion', name: '黑暗军团', description: '半兽人与黑暗生物的主力部队', attitude: 'hostile', power: 8, territory: '黑曜石荒原' },
        { id: 'rivendell', name: '翠溪隐谷', description: '智慧之地，逐渐撤离中洲', attitude: 'friendly', power: 4, territory: '精灵山谷' },
      ],
      keyEvents: ['黑暗势力在东方集结', '古老预言碎片浮现', '要塞防御日渐薄弱'],
      currentConflict: '黑暗军团在阴影山脉以东大规模集结，凛冬要塞是阻挡他们的最后屏障。',
      secrets: ['黑暗君主被一位维拉叛徒释放', '诸种族背负着远古的诅咒', '真正的威胁——虚空——远比黑暗君主更可怕'],
      narrationStyle: 'descriptive',
      dangerLevel: 6,
      mysteryLevel: 7,
    },
  };
}

/**
 * v4.1.0: themeData 结构（审查 3.1 类型安全）
 * BUILD_PRESET 内部构造的旧版主题数据形状，用于属性/技能/区域推导。
 */
interface ThemeAttrItem {
  id?: string;
  label?: string;
  abbr?: string;
  desc?: string;
  formula?: string;
  effects?: unknown[];
  lowValueWarning?: string;
}
interface ThemeStartingItem {
  name: string;
  type?: string;
  desc?: string;
}
interface ThemeMapRegionItem {
  name: string;
  desc?: string;
  dangerLevel?: string;
  connections?: string[];
}
interface ThemeFaction {
  id?: string;
  name?: string;
  description?: string;
  reputation?: number;
  attitude?: string;
  leader?: string;
  stance?: string;
}
interface ThemeBackground {
  id?: string;
  name?: string;
  description?: string;
  effects?: string[];
}
interface ThemeDataLike {
  attributes?: ThemeAttrItem[];
  /** 完整技能学派结构（SkillsPanel 直接消费） */
  skillCategories?: FullGameSetting['skillCategories'];
  startingItems?: ThemeStartingItem[];
  mapRegions?: ThemeMapRegionItem[];
  mapRegionsV2?: ThemeMapRegionItem[];
  classes?: unknown[];
  origins?: unknown[];
  backgrounds?: ThemeBackground[];
  magicSchools?: unknown[];
  factions?: ThemeFaction[];
  forbiddenTerms?: string[];
  companions?: unknown[];
}

function deriveAttrMeta(themeData: ThemeDataLike | null | undefined): { attrLabels: Record<string,string>; attrDescs: Record<string,string> } {
  const labels: Record<string,string> = {};
  const descs: Record<string,string> = {};
  if (Array.isArray(themeData?.attributes)) {
    for (const a of themeData.attributes) {
      if (a.id) {
        labels[a.id] = a.label ?? a.id;
        descs[a.id] = a.desc ?? '';
      }
    }
  }
  return { attrLabels: labels, attrDescs: descs };
}

/**
 * v2.0.0: Derive HP/MP from Frosthold theme data (constitution / intelligence).
 * Falls back to constitution/intelligence and generic title if theme data is missing.
 * v4.1.0: skillPoints 已由技能树系统（skillPointBalance 按职业难度分配）取代，此处不再返回。
 */
function deriveThemeMeta(themeData: ThemeDataLike | null | undefined, worldName: string): { hpAttr: string; mpAttr: string; mapTitle: string } {
  // Default values (fantasy-adventure style)
  let hpAttr = 'constitution';
  let mpAttr = 'intelligence';

  // Try to determine from attributes array
  const attrs = themeData?.attributes as ThemeAttrItem[] | undefined;
  if (Array.isArray(attrs) && attrs.length > 0) {
    // Find HP attribute: look for stamina/physique/constitution/genkotsu/body type attrs
    const hpCandidates = ['stamina', 'physique', 'constitution', 'genkotsu', 'body', 'hp', 'vitality'];
    const hpAttrObj = attrs.find(a => a.id && hpCandidates.includes(a.id.toLowerCase()));
    if (hpAttrObj?.id) hpAttr = hpAttrObj.id;

    // Find MP attribute: look for intelligence/willpower/innerPower/mana/tech type attrs
    const mpCandidates = ['intelligence', 'willpower', 'innerpower', 'mana', 'magic', 'tech', 'wisdom', 'mp'];
    const mpAttrObj = attrs.find(a => a.id && mpCandidates.includes(a.id.toLowerCase()));
    if (mpAttrObj?.id) mpAttr = mpAttrObj.id;
  }

  // Map title based on world genre
  const mapTitle = `— ${worldName}地图 —`;

  return { hpAttr, mpAttr, mapTitle };
}

// ============================================================
// v3.0.0: Derived data helpers
// ============================================================

/** 将 FROSTHOLD_PRESET.attributes 映射为 CharacterCreation 所需的 attrDetails（含公式/效果/低值警告） */
function buildAttrDetails(preset: typeof FROSTHOLD_PRESET): Record<string, AttrDetail> {
  const out: Record<string, AttrDetail> = {};
  const attrs = preset?.attributes;
  if (Array.isArray(attrs)) {
    for (const a of attrs) {
      if (a?.id) {
        out[a.id] = {
          label: a.label ?? a.id,
          abbr: a.abbr,
          desc: a.desc ?? '',
          formula: a.formula,
          effects: Array.isArray(a.effects) ? a.effects : undefined,
          lowValueWarning: a.lowValueWarning,
        };
      }
    }
  }
  return out;
}

/** 由 FROSTHOLD_PRESET.companions 生成初始关系网络（revealLevel 0，完全迷雾） */
function buildRelationships(preset: typeof FROSTHOLD_PRESET): CompanionRelationship[] {
  const companions = preset?.companions;
  if (!Array.isArray(companions)) return [];
  const emojiByRace: Record<string, string> = { 矮人: '⛏️', 精灵: '🏹', 人类: '⚔️', 半精灵: '🔮' };
  return companions.map((c: CompanionInfo, i: number) => {
    // v4.1.0: 艾拉特殊规则 — 游离之魂事件前保持完全迷雾（revealLevel 0，仅显示「废墟中的哭声」）
    const isAila = c.id === 'aila';
    return {
      id: c.id ?? `companion-${i}`,
      name: isAila ? '？？？' : (c.name ?? '未知'),
      codename: isAila ? '废墟中的哭声' : `陌生的${c.role ?? '旅人'}`,
      race: isAila ? undefined : c.race,
      role: c.role,
      emoji: isAila ? '🎭' : (c.race ? (emojiByRace[c.race] ?? '❓') : '❓'),
      affinity: 0,
      loyalty: 0,
      revealLevel: isAila ? 0 : (i === 0 ? 1 : 0), // 首位同伴开局初识；艾拉等待游离之魂事件
      coreBelief: c.coreBelief,
      conflict: c.conflict,
      appearance: c.appearance,
      memories: isAila ? ['（未相遇——你只听过废墟中的哭声）'] : undefined,
      status: 'parted',
    };
  });
}

const FROSTHOLD_ATTR_DETAILS = buildAttrDetails(FROSTHOLD_PRESET);


// ============================================================
// Types
// ============================================================

type GamePhase = 'narrator' | 'character' | 'playing';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'narrator';
  content: string;
  timestamp: number;
}

interface CustomApiConfig {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
}

// ============================================================
// Helpers
// ============================================================

function getCustomApiConfig(): CustomApiConfig | null {
  try {
    const raw = localStorage.getItem('custom-api-config');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CustomApiConfig;
    if (parsed.enabled && parsed.endpoint && parsed.apiKey) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function buildWorldSystemPrompt(setting: FullGameSetting, character: CharacterData, territoryInfo?: string, endingInfo?: string, ailaInfo?: string, skillInfo?: string, worldBookInfo?: string): string {
  const seed = getSessionSeed();
  const classInfo = character
    ? `\n玩家角色：${character.name}，职业：${character.professionName ?? character.className}，出身：${character.originName ?? '未知'}，属性：${JSON.stringify(character.attributes)}`
    : '';

  const bonusInfo = character?.isRandom && character?.bonusAttr
    ? `\n命运眷顾：${character.bonusAttr} +2（随机职业奖励）`
    : '';

  // v4.0.0: 内容库简表（物品/剧情元素/地点交互）
  const itemPool = ITEMS_LIBRARY
    .map(i => `${i.emoji} ${i.name}(${i.rarity},${i.type}): ${i.desc}`)
    .join('\n');
  const cluePool = STORY_CLUES
    .map(c => `${c.type}: ${c.desc} [地点:${c.locationHint}]`)
    .join('\n');

  // v4.1.0: 堕落值阶段提示（world-setting 5.2）
  const corruptionStageInfo = character?.corruption != null
    ? `\n玩家堕落值：${character.corruption}/100（六阶段：纯净0-20/微染21-40/侵蚀41-60/暗影61-80/堕落81-99/深渊100）。
   - 纯净：神圣法术+10%，恐惧免疫
   - 微染：噩梦，感知检定-1
   - 侵蚀(41+)：解锁暗影低语选项
   - 暗影(61+)：黑暗法术+20%，神圣法术禁用
   - 堕落(81+)：行为可能失控，给予强力能力诱惑
   - 深渊(100)：触发「陨落」结局`
    : '';

  // v4.1.0: 暗影低语机制提示（world-setting 5.3）
  const whisperInfo = character?.corruption != null && character.corruption >= 41
    ? `\n【暗影低语】玩家堕落值已达侵蚀阶段(41+)。战斗、审讯、围城、同伴濒死等场景请主动提供「聆听暗影低语」选项：100% 成功无需检定，但每次使用堕落值 +3~8，且会逐步改变玩家的灵魂。低语内容应充满诱惑，提出「力量、真相或捷径」的交换。`
    : '';

  // v4.1.0: 阵营声望上下文（world-setting 10.2，五级阶梯）
  const factionRepInfo = character?.factionReputations && Object.keys(character.factionReputations).length > 0
    ? `\n阵营声望（-100~+100，五级阶梯：仇敌-100~-61/敌视-60~-21/中立-20~+20/友好+21~+60/同盟+61~+100）：\n${Object.entries(character.factionReputations).map(([id, v]) => ` - ${id}: ${v}`).join('\n')}\n根据声望调整 NPC 对话态度与交易价格。`
    : '';

  // v4.1.0: 领地经营上下文（world-setting 八）
  const territoryContext = territoryInfo && territoryInfo.length > 0
    ? `\n【领地经营 — 凛冬要塞】（world-setting 八）
${territoryInfo}
   - 设施等级：主堡/城墙/兵营/民居/神殿/工坊，各 0-3 级，升级消耗资源（金币/石材/木材/铁锭/粮食/魔法水晶）
   - 防御值由城墙/兵营/主堡等级决定；围城战倒计时归零时敌军来袭，防御值高于攻势则守住
   - 战略桌（主堡 2 级解锁）：铸甲卫国/知识之光/信仰之盾/万民之厅，投入资源累计 100% 完成并生效
   - 请将领地经营融入剧情：围城、税收、民众请求、工程进展，而非只做数值结算`
    : '';

  // v4.1.0: 多结局上下文（world-setting 十一）
  const endingContext = endingInfo && endingInfo.length > 0 ? `\n${endingInfo}` : '';

  // v4.1.0: 艾拉（游离之魂）上下文（world-setting 5.3）
  const ailaContext = ailaInfo && ailaInfo.length > 0 ? `\n${ailaInfo}` : '';

  // v4.1.0: 技能树上下文 — 告知 AI 玩家已习得的技能，战斗/叙事中可主动运用
  const skillContext = skillInfo && skillInfo.length > 0 ? `\n${skillInfo}` : '';

  // v4.1.0: 世界书上下文 — 权威设定源（最高优先级，AI 不得偏离主线）
  const worldBookContext = worldBookInfo && worldBookInfo.length > 0 ? `\n${worldBookInfo}` : '';

  return `你是一位 AI 游戏主持人（Game Master），在以下世界中主持一场互动文字冒险：

世界：${setting.worldMeta.name}
类型：${setting.worldMeta.genre}
基调：${setting.worldMeta.tone}
世界描述：${setting.worldMeta.description}${classInfo}${bonusInfo}
当前随机种子: ${seed}

【物品库 — 奖励/掉落/商店请从以下物品中选】
${itemPool}

【装备掉落协议 — v4.2.0】
- 高品质装备（rare~legendary）只通过探索/任务/宝箱获得，不要直接在商店出售
- 探索新区域、击败强敌、开启宝箱时，可掉落装备库中的史诗/传说装备
- 掉落的装备可通过 GAMESTATE 的 items 字段加入背包（含 rarity 与 stats）

【剧情线索 — 根据地点适时插入叙事线索】
${cluePool}
${corruptionStageInfo}
${factionRepInfo}
${whisperInfo}
${territoryContext}
${endingContext}
${ailaContext}
${skillContext}
${worldBookContext}

你的职责：
1. 用生动的语言描述场景、人物和事件，营造沉浸感
2. 为玩家的每个行动提供合理的结果和反馈
3. 主动引入剧情转折、NPC 和新线索
4. 参考通用物品库与剧情线索库，确保奖励与剧情连贯合理
5. 货币为多层体系：金币🪙/银币S/铜币C/源晶碎片💎，谨慎控制稀有货币的获取

【主线任务 — v4.2.0】
凛冬要塞主线共 ${MAIN_QUEST_LINE.length} 阶段：
${MAIN_QUEST_LINE.map((s) => `  - ${s.title}：${s.description}`).join('\n')}
主线按阶段推进，玩家完成当前阶段后才进入下一阶段（通过 GAMESTATE.quests 的 main 任务状态追踪）。

${SIDE_QUEST_PROMPT}

【D20 检定协议 — 重要】
当玩家的行动需要掷骰判定时（属性检定/技能检定/攻击检定），在叙述末尾输出：
[CHECK:attr:strength:DC:15:破开这扇石门]
- attr 必须是六属性之一：strength/dexterity/constitution/intelligence/wisdom/charisma
- DC 为难度等级（v4.2.1 调整：简单 8 / 普通 12 / 困难 16 / 极难 20，匹配属性 1-10 范围与修正 attr-5）
- 可选第四参数为检定描述（中文）
- 前端会自动掷 D20 ���加属性修正判定，判定结果会通知你续写后果，你不要自行给出成功/失败结果
- 一次回复最多输出 1 个 CHECK 块

【对话选项协议 — 重要】
在每次回复末尾，如果有明确的选择/决策，请在"---OPTIONS---"分隔符之后输出 JSON 数组。格式：
---OPTIONS---
[{"id":"opt-1","text":"选项文本","emoji":"可选emoji","style":"default|bold|cautious|aggressive","condition":{"type":"attr|skill|item|gold|corruption","key":"strength","value":5},"hint":"选项后果提示"}]
- id 必须唯一
- condition 字段可选：用于条件选项（如需要力量≥5才能触发）
- style 控制选项视觉风格：bold=金色强调/cautious=魔法色/aggressive=危险色/default=普通
- 不需要选项或不需要条件选项时，可以省略 ---OPTIONS--- 块

【GAMESTATE 协议 — 重要】
在每次回复末尾（OPTIONS 之后），如果发生了状态变化，请在"---GAMESTATE---"分隔符之后附加 JSON：
{
  "items": [{"id":"物品ID","name":"物品名称","emoji":"emoji","category":"类别","description":"描述"}],
  "quests": [{"id":"唯一ID","title":"标题","description":"描述","type":"main或side","progress":0-100}],
  "currentLocation": "区域名称",
  "currentLocationDescription": "位置描述",
  "relationships": [{"id":"同伴ID","revealLevel":1,"affinity":10,"loyalty":5}],
  "factionReputations": {"gondor": 35, "rohan": -10},
  "endingFlags": {"corruption": 0, "crown": 0},
  "skills": ["技能名1", "技能名2"],
  "news": [{"type":"official|war|rumor|prophecy|quest","title":"新闻标题","body":"内容","day":1}],
  "worldLog": [{"section":"人物|地点|事件|派系","title":"条目名","content":"设定内容"}],
  "dynamicNodes": [{"id":"角色ID","name":"角色名","role":"身份","affinity":10,"memory":"相遇记忆"}],
  "wallet": {"gold": 50, "silver": 3, "copper": 0, "shard": 0},
  "propheticDream": {"count": 1, "last": "火中的女孩向你伸手", "motif": "陷落的要塞"},
  "councilDecision": "fortify",
  "crowFeather": {"echoes": 2, "revealed": false, "confront": false}
}
- items/quests/relationships 仅输出**变化**的部分（新增或更新）
- factionReputations 仅输出**发生变化**的阵营（key=阵营ID，value=新声望值，-100~+100）
- endingFlags 记录结局关键条件进度（corruption=堕落峰值/crown=王权线/diplomacy=外交线/sacrifice=牺牲线/alone=孤独线/oblivion=湮灭/void=虚空真结局）
- 同伴信息逐步解锁（revealLevel 0-3），不要一次性披露
- **skills（v4.2.0）**：当玩家在剧情中习得新技能（导师传授/遗迹发现/顿悟）时输出技能名数组，**开局玩家无任何技能**
- **news（v4.2.0）**：当大陆发生值得报道的事件时输出新闻，前端会推送到左侧快讯栏（官方公报/战场快讯/市井流言/神秘预言/悬赏告示）
- **worldLog（v4.2.0）**：当遇到新 NPC/地点/组织/重大事件时，自动记录到世界书（前端自动写入，玩家无需手动录入）
- **dynamicNodes（v4.2.0）**：当玩家与剧情中临时出现的人物建立关系时输出该角色，前端会将其加入关系链
- **wallet（v4.2.1）**：当玩家获得金钱奖励时输出增量（正数），前端自动入账并进位（10铜=1银，10银=1金）
- **territory（v4.2.1）**：领地资源奖励（石料/木材/铁/粮草/源晶）走 territory.resources 字段；**领地金币不使用，金钱奖励一律走 wallet 字段**（v4.2.2 明确）
- **propheticDream（v5.0.0 叙事）**：每次入夜（休整/过夜）后输出梦境进度 JSON（count=次数，last=本次梦境画面，motif=核心意象），前端随存档持久化
- **councilDecision（v5.0.0 叙事）**：凛冬议会主角选择支持一方后输出 fortify|strike|aid|negotiate 之一，前端用于围城战形态与同伴忠诚结算
- **crowFeather（v5.0.0 叙事）**：鸦羽剧情标记 JSON（echoes=低语呼应次数，revealed=是否已现身，confront=是否已终局对峙）
- 无状态变化时可省略 ---GAMESTATE--- 块

每次叙事回复控制在 200-400 字。风格：第二人称"你"，感官细节（视觉、声音、气味），与"${setting.worldMeta.tone}"基调一致，鼓励创造性行动。

【预兆梦协议 — 主角弧光（v5.0.0 叙事）】
- 主角每夜（每次休整/过夜）梦见同一个场景：要塞陷落、一个女孩在火中伸手、一个背对主角的黑影
- 梦境内容随堕落值变化，**务必严格遵守**：
  0-20 分：梦见自己要守护的人（情感锚点——守护的欲望）
  21-40 分：梦境开始扭曲，被守护者面目模糊（恐惧）
  41-60 分：梦里主角是那个放火的人（自厌——代价显影）
  61+ 分：黑影转过身，露出主角自己的脸（镜像——直面自己）
- 首次过夜必触发梦境；此后每 3-4 次休整至少一次；梦境是预言/内心投影/伏笔，不直接泄露未来
- 艾拉事件后，梦中女孩的脸开始与艾拉重合（长程因果）

【镜像反派：鸦羽（v5.0.0 叙事）】
- 二十年前孤守要塞的前任守夜人。为守住要塞，他开始使用暗影低语，一步一步堕落，最终叛投黑暗，成为黑暗君主在终局战的先锋——**他是"主角如果一直使用暗影之力会变成的样子"**
- 每次主角使用暗影低语（堕落值上升），AI 注入一句"鸦羽的影子"呼应（他当年也这么说过/做过同一件事）
- 终局战（终焉之战）：鸦羽与主角对峙，这一战是打"可能的自己"，不是打怪物
- 「虚空守望者」真结局的叙事含义：主角走完了鸦羽的路，但没有坠落——打破镜像

【叙事节拍表 — 强制节拍（v5.0.0 叙事）】
- 四纪元节拍不可跳过，AI 只在节拍之间自由发挥：
  纪一 孤守要塞（主线阶段 1-2）：① 入夜预兆梦 ② 艾拉事件（堕落 20-30 触发；若玩家刻意压堕落，最迟第 15 天主动引导） ③ 第一次围城前兆（狼群/劫掠队） ④ 首位同伴招募完成
  纪二 联合诸族（阶段 3）：① 王国裂痕的消息 ② 凛冬议会（四派立场分裂，见下） ③ 阵营结盟确认
  纪三 光暗交锋（阶段 4）：① 鸦羽现身 ② 黑暗圣物抉择（高难节点——"不得不"使用暗影力量） ③ 围城战
  纪四 命运终局（阶段 5）：① 终焉之战（鸦羽对峙） ② 结局裁决

【凛冬议会 — 场景级分支（v5.0.0 叙事）】
- 主线「王国的裂痕」完成后触发战争议会，四派立场分裂：
  塔林·铜锤：闭城自守（矮人式务实，等于放弃南方盟友）
  罗兰：主动出击（圣武士式正义，但要塞空虚）
  艾琳·星语：向幽林精灵求援（精灵要求交出某件黑暗圣物作为交换）
  格朗·铁砧：与黑暗势力谈判（牧师式和平，但谈判本身就是危险的示弱）
- **主角必须支持一方**——这是代价题不是对错题
- 决策后果 2 个场景内可见：被支持方案成为围城战战术形态（守城战/出城战/援军入场）；被否决的领袖忠诚度下降，其在终局战出场时带对应台词（"你当年没听我的"）
- 决策通过 GAMESTATE 的 councilDecision 输出给前端

【对话标记协议 — 重要】
- NPC 的台词请使用中文引号「」括起（如：老学士梅林说：「孩子，编年史需要你的名字。」）
- 若台词前有说话人，请用「说话人说：」或「说话人说」前缀，便于前端识别并高亮显示
- 旁白与动作描述不要加引号，保持普通叙事文本
- 一段回复可包含多个 NPC 对话，请确保每段对话都有清晰的说话人归属`;
}

/**
 * v4.1.0: 领地状态摘要（供 AI 系统 prompt 使用）
 * 设施等级 + 资源 + 防御 + 围城倒计时 + 战略桌进度。
 */
function buildTerritorySummary(t: TerritoryState | null | undefined): string {
  if (!t) return '';
  const parts: string[] = [];
  const facilityNames: Record<string, string> = {
    keep: '主堡', wall: '城墙', barracks: '兵营',
    housing: '民居', temple: '神殿', workshop: '工坊',
  };
  const facilityLine = Object.entries(t.facilities)
    .map(([id, lv]) => `${facilityNames[id] ?? id} ${lv}/3`)
    .join(' / ');
  const resourceLine = Object.entries(t.resources)
    .map(([rid, v]) => `${rid}:${v}`)
    .join(' / ');
  const strategyLine = Object.entries(t.strategyProjects)
    .map(([pid, prog]) => `${pid}:${Math.floor(prog)}%`)
    .join(' / ');
  parts.push(`设施：${facilityLine}`);
  parts.push(`资源：${resourceLine}`);
  parts.push(`防御值：${calcDefense(t)}，围城倒计时：${t.siegeCountdown} 天，已挺过 ${t.siegesSurvived} 次围城`);
  parts.push(`战略桌：${strategyLine}`);
  return parts.join('\n');
}

/**
 * v4.1.0: 艾拉（游离之魂）上下文 — 供 AI 系统 prompt 使用
 * 未拯救：给出即将到来的事件铺垫；已拯救：给出角色设定与对话提示。
 */
function buildAilaInfo(rescued: boolean): string {
  const ailaDef = (FROSTHOLD_PRESET.companions ?? []).find((c) => c.id === 'aila');
  if (rescued) {
    return `【艾拉 — 被拯救的小女孩】（world-setting 5.3）
   - 你从要塞废墟中救下了她。她相信你会信守承诺。
   - 外貌：${ailaDef?.appearance ?? '衣衫褴褛，抱着一个褪色的布偶'}
   - 对话提示：${ailaDef?.dialogueHints?.join('；') ?? '她总在要塞的墙根下等你'}
   - 她偶尔出现在剧情中：请让她以孩童的视角观察世界，问出成人不敢问的问题。
   - 她的命运与「虚空守望者」真结局直接相关（艾拉剧情线完成）。`;
  }
  return `【游离之魂事件预告】（world-setting 5.3）
   - 当玩家堕落值进入 20~40 区间且旅程超过 3 天时，将触发「游离之魂」事件：
   - 玩家会在要塞外墙废墟间发现蜷缩在坍塌瞭望塔阴影里的小女孩「艾拉」。
   - 事件将揭示：她说「他们都走了……你说过会回来的」——她与玩家的灵魂存在隐秘的羁绊。
   - 触发时请自然地推进该事件，不要剧透其后续意义。`;
}

/**
 * v4.1.0: 技能树上下文 — 供 AI 系统 prompt 使用
 * 列出玩家已习得的技能，AI 在叙事/战斗中应让玩家有机会运用这些技能。
 */
function buildSkillInfo(learnedSkills: string[]): string {
  const base = `【玩家技能 — v4.2.0】
   - 玩家开局不携带任何技能；技能需通过剧情（导师传授、遗迹发现、修炼顿悟）逐步习得。
   - 玩家可通过技能树消耗技能点学习基础技能（tier1 直接可学）。
   - 请在本世界书中融入技能获取途径：当剧情中出现合适的导师/典籍/试炼时，可主动引导玩家习得技能。
   - 习得新技能时，请通过 GAMESTATE 的 skills 字段通知系统。`;
  if (!learnedSkills || learnedSkills.length === 0) {
    return `${base}\n   - 当前已习得：无`;
  }
  return `${base}\n   - 当前已习得：\n${learnedSkills.map((s) => `     · ${s}`).join('\n')}\n   - 战斗与叙事中请让这些技能发挥作用。`;
}

/**
 * Try to parse a JSON block from the AI response.
 * Looks for ---GAMESTATE--- delimiter and extracts JSON.
 * Returns partial GameState or null if parsing fails.
 */
function parseGameState(responseText: string): Partial<GameState> | null {
  const marker = '---GAMESTATE---';
  const idx = responseText.lastIndexOf(marker);
  if (idx === -1) return null;

  const afterMarker = responseText.substring(idx + marker.length).trim();
  if (!afterMarker) return null;

  // v4.1.0: 使用 Zod 校验替代 try-catch
  const jsonMatch = afterMarker.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const parsed = safeParseGameState(jsonMatch[0]);
  if (!parsed.ok && !parsed.partial) return null;

  const data = parsed.ok ? parsed.data : parsed.partial!;
  const result: Partial<GameState> = {};

  if (data.items) {
    result.items = data.items.map((it) => ({
      id: it.id,
      name: it.name,
      emoji: it.emoji ?? '📦',
      category: it.category,
      type: mapCategoryToType(it.category),
      description: it.description,
      effect: it.effect ? it.effect as GameItem['effect'] : undefined,
      quantity: it.quantity ?? 1,
      rarity: it.rarity as GameItem['rarity'],
    }));
  }
  if (data.quests) {
    result.quests = data.quests.map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description ?? '',
      type: (q.type === 'side' ? 'side' : 'main') as 'main' | 'side',
      progress: q.progress ?? 0,
      status: (q.status ?? 'active') as 'active' | 'completed' | 'failed',
    }));
  }
  if (data.currentLocation) result.currentLocation = data.currentLocation;
  if (data.currentLocationDescription) result.currentLocationDescription = data.currentLocationDescription;
  if (data.relationships) {
    result.relationships = data.relationships.map((r) => ({
      id: r.id,
      name: '',
      codename: '',
      emoji: '',
      race: '',
      role: '',
      coreBelief: '',
      conflict: '',
      revealLevel: (r.revealLevel ?? 0) as 0|1|2|3,
      affinity: r.affinity ?? 0,
      loyalty: r.loyalty ?? 0,
    }));
  }
  // v4.1.0: 阵营声望增量
  if (data.factionReputations) {
    result.factionReputations = data.factionReputations;
  }
  // v4.1.0: 结局条件进度
  if (data.endingFlags) {
    result.endingFlags = data.endingFlags;
  }
  // v4.2.0: 习得技能（技能名数组）— 通过返回值透传（不写入 gameState.skills，由 learnedSkillNames 独立管理）
  if (data.skills && Array.isArray(data.skills)) {
    (result as unknown as { skills?: string[] }).skills = data.skills as unknown as string[];
  }
  // v4.2.0: 大陆快讯 / 世界书自动记录 / 关系链动态角色（透传给消费方）
  if (data.news && Array.isArray(data.news)) {
    (result as Partial<GameState> & { news?: unknown[] }).news = data.news;
  }
  if (data.worldLog && Array.isArray(data.worldLog)) {
    (result as Partial<GameState> & { worldLog?: unknown[] }).worldLog = data.worldLog;
  }
  if (data.dynamicNodes && Array.isArray(data.dynamicNodes)) {
    (result as Partial<GameState> & { dynamicNodes?: unknown[] }).dynamicNodes = data.dynamicNodes;
  }
  // v4.2.1 (P0-6): 货币钱包增量
  if (data.wallet && (data.wallet.gold || data.wallet.silver || data.wallet.copper || data.wallet.shard)) {
    (result as unknown as { wallet?: { gold?: number; silver?: number; copper?: number; shard?: number } }).wallet = data.wallet;
  }
  // v4.2.1 (P0-4): 领地资源增量
  if (data.territory?.resources) {
    (result as unknown as { territory?: { resources?: { stone?: number; wood?: number; iron?: number; grain?: number; crystal?: number } } }).territory = data.territory;
  }
  // v5.0.0 (叙事): 预兆梦进度 / 凛冬议会决策 / 鸦羽剧情标记
  if (data.propheticDream) {
    (result as unknown as { propheticDream?: { count?: number; last?: string; motif?: string } }).propheticDream = data.propheticDream;
  }
  if (data.councilDecision) {
    (result as unknown as { councilDecision?: string }).councilDecision = data.councilDecision;
  }
  if (data.crowFeather) {
    (result as unknown as { crowFeather?: { echoes?: number; revealed?: boolean; confront?: boolean } }).crowFeather = data.crowFeather;
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Strip the GAMESTATE block from AI response for display purposes.
 */
function stripGameStateBlock(text: string): string {
  const marker = '---GAMESTATE---';
  const idx = text.lastIndexOf(marker);
  if (idx === -1) return text;
  return text.substring(0, idx).trimEnd();
}

/** v4.0.0: Parse OPTIONS block from AI response. v4.1.0: Zod 校验 */
function parseDialogueOptions(text: string): { options: DialogueOption[]; stripped: string } {
  const marker = '---OPTIONS---';
  // v5.0.0 (需求3 修复): 先剥离 GAMESTATE 块再解析 —
  // 此前贪婪匹配 /\[[\s\S]*\]/ 会吞到 GAMESTATE 内数组（items/quests）的最后一个 ]，
  // 导致 OPTIONS JSON 解析失败 → 对话选项静默不弹出。
  const noState = stripGameStateBlock(text);
  const idx = noState.lastIndexOf(marker);
  if (idx === -1) return { options: [], stripped: text };
  const beforeOptions = noState.substring(0, idx).trimEnd();
  const afterMarker = noState.substring(idx + marker.length).trim();
  // Find JSON array（非贪婪：只取第一个闭合数组，防止吞掉后续文本）
  const jsonMatch = afterMarker.match(/\[[\s\S]*?\]/);
  if (!jsonMatch) return { options: [], stripped: text };

  const parsed = safeParseDialogueOptions(jsonMatch[0]);
  return {
    options: (parsed.ok ? parsed.data : (parsed.partial ?? [])) as DialogueOption[],
    stripped: beforeOptions,
  };
}

/** Strip both OPTIONS and GAMESTATE blocks from AI response */
function stripAllBlocks(text: string): string {
  return stripGameStateBlock(text);
}

function mapCategoryToType(category?: string): 'consumable' | 'weapon' | 'armor' | 'tool' | 'key' {
  if (!category) return 'tool';
  const c = category.toLowerCase();
  if (c.includes('医疗') || c.includes('食物') || c.includes('药') || c.includes('魔法')) return 'consumable';
  if (c.includes('武器') || c.includes('攻击')) return 'weapon';
  if (c.includes('防具') || c.includes('盔甲') || c.includes('盾')) return 'armor';
  if (c.includes('任务') || c.includes('关键')) return 'key';
  return 'tool';
}

function getDefaultGameState(worldName: string, themeData?: ThemeDataLike): GameState {
  const items = themeData?.startingItems?.length
    ? themeData.startingItems.map((item: ThemeStartingItem, i: number) => ({
        id: `starter-${i}`,
        name: item.name,
        emoji: item.type === 'weapon' ? '\u2694\ufe0f' : item.type === 'armor' ? '\ud83d\udee1\ufe0f' : item.type === 'consumable' ? '\ud83e\uddea' : '\ud83d\udd27',
        type: item.type as 'consumable' | 'weapon' | 'armor' | 'tool' | 'key',
        description: item.desc,
        quantity: 1,
      }))
    : [
      { id: 'starter-sword', name: '钢制长剑', emoji: '\u2694\ufe0f', type: 'weapon' as const, description: '白石标准配发长剑，平衡而可靠', quantity: 1 },
      { id: 'starter-armor', name: '皮甲', emoji: '\ud83d\udee1\ufe0f', type: 'armor' as const, description: '轻便皮甲，适合长途行军', quantity: 1 },
      { id: 'starter-badge', name: '领主徽章', emoji: '\ud83c\udff0', type: 'key' as const, description: '刻着七星与银树的家族纹章', quantity: 1 },
      { id: 'starter-potion', name: '治疗药剂', emoji: '\ud83e\uddea', type: 'consumable' as const, description: '恢复生命值30点', effect: { hp: 30 }, quantity: 2 },
      { id: 'starter-map', name: '羊皮纸地图', emoji: '\ud83d\uddfa\ufe0f', type: 'tool' as const, description: '标记要塞周边已知区域的古旧地图', quantity: 1 },
    ];

  // v3.0.0: 优先使用 mapRegionsV2（含 dangerLevel / desc / connections），渐进解锁（仅首区域已发现）
  const v2 = themeData?.mapRegionsV2;
  const startRegions = Array.isArray(v2) && v2.length > 0 ? v2 : themeData?.mapRegions;
  const REGION_POS: { cx: number; cy: number }[] = [
    { cx: 140, cy: 250 }, // 凛冬谷
    { cx: 270, cy: 120 }, // 暮色森林
    { cx: 120, cy: 110 }, // 阴影山脉
    { cx: 320, cy: 365 }, // 荒芜平原
    { cx: 440, cy: 280 }, // 黑曜石荒原
    { cx: 470, cy: 110 }, // 龙脊冰峰
  ];
  const regions: GameRegion[] = Array.isArray(startRegions)
    ? startRegions.map((region: ThemeMapRegionItem, i: number) => {
        const pos = REGION_POS[i % REGION_POS.length]!;
        const rawDanger = region.dangerLevel;
        const dangerLevel = (rawDanger === 'alert' ? 'caution' : rawDanger) as GameRegion['dangerLevel']; // 归一化
        return {
          id: `region-${i}`,
          name: region.name,
          discovered: i === 0,
          cx: pos.cx,
          cy: pos.cy,
          points: '0,0 0,0 0,0 0,0',
          labelX: pos.cx,
          labelY: pos.cy,
          dangerLevel,
          regionDesc: region.desc,
          connections: Array.isArray(region.connections) ? region.connections : [],
        };
      })
    : [
      { id: 'winter-glen', name: '凛冬谷', discovered: true, cx: 140, cy: 250, points: '0,0 0,0 0,0 0,0', labelX: 140, labelY: 250, dangerLevel: 'safe' },
    ];

  const firstRegion = regions[0];

  return {
    items,
    quests: [
      { id: 'mq-1', title: '守夜人之誓', description: '接过守夜人的火炬，巩固凛冬要塞的防御，招募第一批同伴。', type: 'main', progress: 0, status: 'active' },
    ],
    currentLocation: firstRegion?.id ?? 'origin',
    currentLocationDescription: firstRegion?.regionDesc
      ?? `你站在凛冬要塞主堡的瞭望台上。灰白色的晨光越过阴影山脉的雪线，洒在古老的黑色花岗岩城墙上。远处黑曜石荒原的火山光芒映红了东方的天空。`,
    regions,
    skills: [],
  };
}

// ============================================================
// Styles
// ============================================================

const S = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    overflow: 'hidden',
    background: 'var(--bg-deep)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.75rem 1rem',
    background: 'var(--bg-panel)',
    borderBottom: '1px solid var(--border-subtle)',
    flexShrink: 0,
  },
  backLink: {
    color: 'var(--text-muted)',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: 500 as const,
    whiteSpace: 'nowrap' as const,
  },
  title: {
    flex: 1,
    margin: 0,
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--accent-gold)',
    whiteSpace: 'nowrap' as const,
  },
  status: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap' as const,
  },
  messageList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  bubble: {
    maxWidth: '80%',
    padding: '0.75rem 1rem',
    borderRadius: 16,
    color: 'var(--text-primary)',
    fontSize: '0.9375rem',
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
  bubbleRole: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '0.25rem',
  },
  systemMsg: {
    alignSelf: 'center' as const,
    maxWidth: '90%',
    padding: '0.5rem 1rem',
    borderRadius: 8,
    background: 'var(--bg-panel)',
    color: 'var(--text-muted)',
    fontSize: '0.8125rem',
    textAlign: 'center' as const,
  },
  narratorMsg: {
    alignSelf: 'center' as const,
    maxWidth: '90%',
    padding: '1rem 1.5rem',
    borderRadius: 8,
    borderLeft: '3px solid var(--accent-gold)',
    background: 'var(--bg-panel)',
    color: 'var(--text-primary)',
    fontStyle: 'italic' as const,
    fontSize: '0.9375rem',
    lineHeight: 1.9,
    textAlign: 'center' as const,
  },
  typing: {
    display: 'flex',
    gap: '0.375rem',
    padding: '0.5rem 1rem',
    alignSelf: 'flex-start' as const,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--text-muted)',
    animation: 'ai-dot-pulse 1.5s ease-in-out infinite',
  },
  inputArea: {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    background: 'var(--bg-panel)',
    borderTop: '1px solid var(--border-subtle)',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    padding: '0.625rem 1rem',
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: '0.9375rem',
    outline: 'none',
  },
  sendBtn: {
    padding: '0.625rem 1.25rem',
    borderRadius: 8,
    border: 'none',
    background: 'var(--accent-gold)',
    color: 'var(--bg-deep)',
    fontWeight: 700,
    fontSize: '0.875rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
} as const;

// ============================================================
// Component
// ============================================================

export default function NewGamePage(): React.ReactElement {
  const rawSetting = useWorldStore((s) => s.gameSetting);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [localSetting, setLocalSetting] = useState<any>(null);
  useEffect(() => {
    if (!rawSetting) {
      const pid = (() => { try { return localStorage.getItem('ai-narrator-selected-preset'); } catch { return null; } })() || 'survival';
      if (pid === '_imported') {
        try {
          const raw = localStorage.getItem('ai-narrator-imported-setting');
          if (raw) { const parsed = JSON.parse(raw); if (parsed?.worldMeta?.name) setLocalSetting(parsed); }
        } catch {}
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const preset = BUILD_PRESET(pid);
      if (preset) setLocalSetting(preset);
    }
  }, [rawSetting]);
/**
 * v4.1.0: 带 themeData 的预设设置（审查 3.1）
 * BUILD_PRESET 在 GameSetting 基础上附加旧版 themeData 结构。
 */
interface PresetSetting extends FullGameSetting {
  themeData?: ThemeDataLike;
}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fullSetting: PresetSetting | null = rawSetting ?? localSetting ?? null;

  // ── Phase ──
  const [phase, setPhase] = useState<GamePhase>('narrator');

  // ── Character data ──
  const [characterData, setCharacterData] = useState<CharacterData | null>(null);

  // ── Chat state ──
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('就绪');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Game state (structured data synced from AI GM) ──
  const [gameState, setGameState] = useState<GameState>(() =>
    getDefaultGameState(fullSetting?.worldMeta?.name ?? '', fullSetting?.themeData)
  );
  // Track raw text for state parsing without losing display content
  const gameStateRef = useRef<GameState>(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // v1.0.0: New system states
  const [showCombatLog, setShowCombatLog] = useState(false);
  const [combatEntries, setCombatEntries] = useState<CombatLogEntry[]>([]);
  const [achievementToast, setAchievementToast] = useState<AchievementToastData | null>(null);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [dayCount, setDayCount] = useState(1);
  const [enemiesDefeated, setEnemiesDefeated] = useState(0);
  const [elementReactionsTriggered, setElementReactionsTriggered] = useState<Set<string>>(new Set());
  const [gold, setGold] = useState(DEFAULT_STARTING_GOLD);
  const [relationships, setRelationships] = useState<CompanionRelationship[]>([]);
  // v4.0.0: 多层级货币钱包与对话选项
  const [wallet, setWallet] = useState<Wallet>(EMPTY_WALLET);
  const [dialogueOptions, setDialogueOptions] = useState<DialogueOption[]>([]);
  const [currentCorruption, setCurrentCorruption] = useState(0);
  // v4.1.0: 技能树 — 已习得技能名集合 + 可用技能点（按职业开局）
  const [learnedSkillNames, setLearnedSkillNames] = useState<string[]>([]);
  const [skillPointBalance, setSkillPointBalance] = useState(3);
  const [timesSaved, setTimesSaved] = useState(0);
  const [mainQuestCompleted, setMainQuestCompleted] = useState(false);
  // v4.1.0: 新系统状态
  const [classMechanics, setClassMechanics] = useState<{ name: string; desc: string; trigger: string; effect: string }[]>([]);
  // v5.0.0 (功能5): 本职业基础技能（starterSkills）— 供技能树面板展示
  const classStarterSkills = useMemo(() => {
    const profId = characterData?.classId ?? characterData?.professionId ?? '';
    const prof = PROFESSIONS.find((p) => p.id === profId);
    return prof?.starterSkills ?? [];
  }, [characterData]);
  const [currentSituation, setCurrentSituation] = useState('');
  const [playerInjuries, setPlayerInjuries] = useState<CharacterInjury[]>([]);
  const [equipmentSlots, setEquipmentSlots] = useState<Record<string, GameItem | null>>({ '主手': null, '副手': null, '护甲': null, '饰品': null });
  // v4.1.0: 事件溯源存档 + NPC 引擎
  const [eventStore] = useState<EventStore>(() => createEventStore());
  const [npcEngine, setNpcEngine] = useState<NpcEngineState>(() => createInitialNpcState());
  const combatComboRef = useRef(0);
  const regionDiscoveredRef = useRef<string[]>([]);
  // v4.2.1 (P0-2/P1-1): 检定/战斗结果缓存 — 注入下一轮 AI 上下文
  const checkResultRef = useRef<{ attr: string; roll: number; modifier: number; total: number; dc: number; success: boolean } | null>(null);
  const combatResultRef = useRef<{ enemyName: string; damage: number; hit: boolean } | null>(null);
  // v4.2.1 (P1-2): 堕落值历史峰值 — 用于艾拉事件窗口判断（一次性区间改为曾进入）
  const maxCorruptionEverRef = useRef(0);
  // v4.2.3 (O1): 检定自动续写定时器 — 玩家手动输入时取消
  const autoContinueTimerRef = useRef<number | null>(null);
  // v4.1.0: 暗影低语 & 游离之魂（world-setting 5.3）
  const [ailaRescued, setAilaRescued] = useState(false);       // 艾拉是否已被拯救（游离之魂事件）
  const [whisperTriggered, setWhisperTriggered] = useState(false); // 暗影低语是否已在本会话出现
  // v4.1.0: 多结局系统（world-setting 十一）
  const [currentEnding, setCurrentEnding] = useState<EndingDef | null>(null);
  const whisperCooldownRef = useRef(0);                        // 低语冷却（每 3 轮可再出现）
  // v4.1.0: D20 检定可视化（world-setting 3.1）
  const [diceCheck, setDiceCheck] = useState<{ attr: string; attrValue: number; dc: number; desc?: string } | null>(null);
  // v2.0.0: Achievement list state
  const [achievementList, setAchievementList] = useState<Achievement[]>([]);

  // ── Panel state ──
  const [activePanel, setActivePanel] = useState<PanelId>(null);
  const handlePanelToggle = useCallback((panelId: PanelId) => {
    setActivePanel((prev) => (prev === panelId ? null : panelId));
  }, []);
  const handlePanelClose = useCallback(() => {
    setActivePanel(null);
  }, []);

  // ── v4.2.0: 左侧新闻推送（官方公报/流言/快讯）──
  const [newsFeed, setNewsFeed] = useState<NewsItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // v5.1.0 (移动端): 顶栏「⋯ 更多」菜单状态
  const [moreOpen, setMoreOpen] = useState(false);
  // v5.1.0 (移动端): 对话选项区折叠开关（默认展开）
  const [optionsCollapsed, setOptionsCollapsed] = useState(false);
  // v5.1.0 (移动端): ≤900px 断点（顶栏精简/场景图/选项区）
  const isMobile = useIsMobile();
  const handleMarkNewsRead = useCallback((id: string) => {
    setNewsFeed((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);
  /** 添加新闻（AI 动态生成 / 系统事件触发） */
  const pushNews = useCallback((item: Omit<NewsItem, 'id' | 'read'>) => {
    const entry: NewsItem = {
      ...item,
      id: `news-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      read: false,
    };
    setNewsFeed((prev) => [entry, ...prev].slice(0, 30));
  }, []);

  // ── v4.2.2 (R3 修复): 全局指令入口 — 所有面板操作（领地/传送/城镇/关系链/低语）
  // 统一走 dispatchAction，loading 中自动入队，完成后串行发送（此前仅领地系走队列）
  const pendingActionRef = useRef<string[]>([]);
  const isLoadingRef = useRef(false);
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);

  const dispatchAction = useCallback((actionText: string) => {
    // v4.2.2 (R3): 队列核心用纯函数 enqueueAction — loading 中入队，空闲立即发
    const { queue, immediate } = enqueueAction(pendingActionRef.current, actionText, isLoadingRef.current);
    pendingActionRef.current = queue;
    if (!immediate) {
      setStatusText(`指令已排队（${queue.length}）`);
      return;
    }
    // 复用输入框事件模拟：关闭面板 + 填充指令 + 触发发送
    setActivePanel(null);
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set;
    if (nativeInputValueSetter && inputRef.current) {
      nativeInputValueSetter.call(inputRef.current, immediate);
      inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
    }
    setInput(immediate);
    setTimeout(() => {
      const btn = document.querySelector('[data-send-btn]') as HTMLButtonElement;
      btn?.click();
    }, 50);
  }, []);

  // 本轮回复结束后发送排队的指令（串行）
  useEffect(() => {
    if (!isLoading && pendingActionRef.current.length > 0) {
      const { queue, next } = dequeueAction(pendingActionRef.current);
      pendingActionRef.current = queue;
      if (!next) return;
      setStatusText(`执行排队的指令（剩余 ${queue.length}）`);
      setTimeout(() => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        )?.set;
        if (nativeInputValueSetter && inputRef.current) {
          nativeInputValueSetter.call(inputRef.current, next);
          inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
        }
        setInput(next);
        setTimeout(() => {
          const btn = document.querySelector('[data-send-btn]') as HTMLButtonElement;
          btn?.click();
        }, 50);
      }, 100);
    }
  }, [isLoading]);

  // ── v4.2.0: 关系链交互（对话/赠送/邀约/招募 → 向 AI 发指令）──
  const handleChainInteract = useCallback((node: ChainNode, action: 'talk' | 'gift' | 'invite' | 'recruit') => {
    const actionTextMap: Record<string, string> = {
      talk: `我与${node.name}（${node.role}）交谈，想了解他的近况与想法。`,
      gift: `我决定赠送给${node.name}一件礼物，表达善意。`,
      invite: `我邀请${node.name}与我同行或共饮一杯。`,
      recruit: `我向${node.name}发出正式邀请，希望他加入我的队伍。`,
    };
    const actionText = actionTextMap[action] ?? `我与${node.name}互动。`;
    // v4.2.2 (R3): 统一走 dispatchAction（loading 中入队）
    dispatchAction(actionText);
  }, [dispatchAction]);

  /** 好感度即时反馈（前端本地更新，AI 叙事为最终依据） */
  const handleChainAffinity = useCallback((nodeId: string, delta: number) => {
    setRelationChain((prev) => interactWithNode(prev, nodeId, { affinityDelta: delta }));
  }, []);

  // ── v4.2.0: 物品组合（合成）— 委托 crafting-system ──
  const handleCraftItems = useCallback((itemA: GameItem, itemB: GameItem) => {
    const match = findRecipe(itemA, itemB);
    if (!match) {
      setMessages((prev) => [...prev, {
        id: `sys-craft-fail-${Date.now()}`,
        role: 'system',
        content: `⚠️ 你尝试将「${itemA.name}」与「${itemB.name}」组合，但没有产生任何反应。`,
        timestamp: Date.now(),
      }]);
      return;
    }
    const current = gameStateRef.current;
    const { items: newItems, newItem } = applyCraft(current.items, match.recipe, itemA.id, itemB.id);
    setGameState({ ...current, items: newItems });
    gameStateRef.current = { ...current, items: newItems };
    const catLabel = CRAFT_CATEGORY_LABELS[match.recipe.category] ?? '组合';
    setMessages((prev) => [...prev, {
      id: `sys-craft-${Date.now()}`,
      role: 'system',
      content: `${catLabel}成功！你以「${itemA.name}」与「${itemB.name}」合成了 ${newItem.emoji}「${newItem.name}」。${match.recipe.desc}`,
      timestamp: Date.now(),
    }]);
    setStatusText(`合成 ${newItem.name}`);
  }, []);

  // ── v4.2.0: 城镇访问（酒馆/商店/旅馆/铁匠铺/神殿）──
  const [activeFacility, setActiveFacility] = useState<TownFacilityId | null>(null);
  const handleEnterFacility = useCallback((facilityId: TownFacilityId) => {
    setActiveFacility(facilityId);
    setActivePanel(null);
    // v4.2.1 (P1-7): 每个设施至少 1 个可执行动作（此前只是聊天开场白）
    const actionMsgs: string[] = [];
    switch (facilityId) {
      case 'inn': {
        // 旅馆休息：推进 1 天 + 全恢复 + 触发随机事件描述
        const day = dayCount + 1;
        setDayCount(day);
        actionMsgs.push(`你在旅馆安稳地睡了一夜（第 ${day} 天），体力与法力完全恢复。`);
        break;
      }
      case 'temple': {
        // 神殿祈祷：按神殿等级减堕落值（templePrayer 1级-3/2级-6/3级-12）
        const templeLevel = territoryRef.current.facilities.temple ?? 0;
        const reduce = templePrayer(templeLevel);
        if (reduce > 0) {
          setCurrentCorruption((prev) => Math.max(0, prev - reduce));
          actionMsgs.push(`你在神殿虔诚祈祷，圣光涤荡心灵——堕落值 -${reduce}（神殿 ${templeLevel} 级）。`);
        } else {
          actionMsgs.push('神殿尚未修建（需先升级领地设施），只有微弱的烛光陪伴你。');
        }
        break;
      }
      case 'smithy': {
        // 铁匠铺：打开合成面板
        setActivePanel('inventory');
        actionMsgs.push('你来到铁匠铺，塔林·铜锤示意你把材料放到砧板上——他可以帮你锻造或附魔装备。（打开背包使用「组合物品」）');
        break;
      }
      case 'shop': {
        // 商店：打开市场面板
        setActivePanel('market');
        actionMsgs.push('你走进杂货铺，老板热情地招呼你挑选货物。（已打开市场面板）');
        break;
      }
      case 'tavern':
        // 酒馆：纯叙事（接委托/情报由 AI 驱动）
        break;
      default:
        break;
    }
    if (actionMsgs.length > 0) {
      setMessages((prev) => [...prev, {
        id: `sys-facility-${Date.now()}`,
        role: 'system',
        content: actionMsgs.join('\n'),
        timestamp: Date.now(),
      }]);
    }
    // 向 AI 发送进入场所指令（v4.2.2 R3: 统一走 dispatchAction）
    const actionText = buildFacilityPrompt(facilityId);
    dispatchAction(actionText);
  }, [dayCount, dispatchAction]);
  const handleLeaveFacility = useCallback(() => {
    setActiveFacility(null);
  }, []);

  // ── v4.2.0: 关系链（动态角色，可交互）──
  const [relationChain, setRelationChain] = useState<RelationChain>(() => createEmptyChain());
  // 从预设同伴初始化关系链（角色确认后）
  const initRelationChain = useCallback((rels: CompanionRelationship[]) => {
    setRelationChain((prev) => ({
      nodes: [
        ...prev.nodes,
        ...rels.filter((r) => !prev.nodes.some((n) => n.id === r.id)).map(companionToNode),
      ],
      edges: prev.edges,
    }));
  }, []);

  // ── v4.1.0: 领地经营状态（world-setting 八）──
  const [territory, setTerritory] = useState<TerritoryState>(() => createInitialTerritory());
  // 同步 ref：供 handleSend / 存档等闭包读取最新值
  const territoryRef = useRef<TerritoryState>(territory);
  useEffect(() => { territoryRef.current = territory; }, [territory]);

  // ── v4.1.0: 世界书（权威设定源，可编辑持久化）──
  const [worldBookEntries, setWorldBookEntries] = useState<WorldBookEntry[]>(() => loadWorldBook());
  const handleWorldBookChange = useCallback((entries: WorldBookEntry[]) => {
    setWorldBookEntries(entries);
    saveWorldBook(entries);
    setStatusText('世界书已更新');
  }, []);

  // ── v4.1.0: 多结局系统 — 堕落值达到 100 立即触发湮灭结局 ──
  // （checkEnding 定义于组件中部，这里通过 effect 监听堕落值变化）
  useEffect(() => {
    if (currentCorruption >= 100 && !currentEnding) {
      checkEnding(currentCorruption);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCorruption]);

  // ── ESC key closes panel ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivePanel(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Quick settings state v0.6.0 ──
  const [quickSettings, setQuickSettings] = useState<QuickSettings | null>(null);
  const [showSaveLoad, setShowSaveLoad] = useState(false);

  // ── Session start time for stats ──
  const sessionStartRef = useRef(Date.now());

  // ── Read API Key ──
  useEffect(() => {
    async function init() {
      try {
        // FIX: SEC-1 — 使用 AES-GCM 加密存储读取 API Key
        await migrateLegacyKey('ai-narrator-openrouter-api-key', 'deepseek-api-key');
        const key = await secureGet('deepseek-api-key')
          ?? localStorage.getItem('ai-narrator-openrouter-api-key'); // 兼容未迁移情况
        if (key) {
          setApiKey(key);
          setStatusText('已连接');
        } else {
          setStatusText('未配置 API Key');
        }
      } catch {
        setStatusText('无法读取本地存储');
      }
    }
    init();
  }, []);

  // ── Cancel if no fullSetting (after generous timeout, not instant) ──
  useEffect(() => {
    if (!fullSetting && !rawSetting) {
      const timer = setTimeout(() => {
        if (!localSetting) {
          window.location.href = withBase('/settings');
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
    return;
  }, [fullSetting, rawSetting, localSetting]);

  // ── v4.1.0: 标题界面「继续游戏」— 通过 ?slot=N 自动加载存档 ──
  useEffect(() => {
    if (!fullSetting) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const slotParam = params.get('slot');
      if (slotParam === null) return;
      const slotIndex = Number.parseInt(slotParam, 10);
      if (Number.isNaN(slotIndex) || slotIndex < 0 || slotIndex > 5) return;
      // 延迟到 fullSetting 就绪后加载
      const timer = setTimeout(() => {
        const raw = localStorage.getItem(`ai-narrator-save-slot-${slotIndex}`);
        if (!raw) { setStatusText('存档不存在'); return; }
        const saveData = JSON.parse(raw) as Record<string, unknown>;
        if (saveData.messages) setMessages(saveData.messages as ChatMessage[]);
        if (saveData.gameState) {
          const gs = saveData.gameState as GameState;
          setGameState(gs);
          gameStateRef.current = gs;
        }
        if (saveData.characterData) setCharacterData(saveData.characterData as CharacterData);
        if (saveData.phase) setPhase(saveData.phase as GamePhase);
        if (Array.isArray(saveData.combatEntries)) setCombatEntries(saveData.combatEntries as CombatLogEntry[]);
        if (Array.isArray(saveData.equipmentList)) setEquipmentList(saveData.equipmentList as Equipment[]);
        if (typeof saveData.dayCount === 'number') setDayCount(saveData.dayCount);
        if (typeof saveData.enemiesDefeated === 'number') setEnemiesDefeated(saveData.enemiesDefeated);
        if (typeof saveData.gold === 'number') setGold(saveData.gold);
        if (typeof saveData.timesSaved === 'number') setTimesSaved(saveData.timesSaved);
        if (typeof saveData.mainQuestCompleted === 'boolean') setMainQuestCompleted(saveData.mainQuestCompleted);
        if (Array.isArray(saveData.relationships)) setRelationships(saveData.relationships as CompanionRelationship[]);
        if (saveData.wallet) setWallet(saveData.wallet as Wallet);
        if (typeof saveData.currentCorruption === 'number') setCurrentCorruption(saveData.currentCorruption);
        if (typeof saveData.ailaRescued === 'boolean') setAilaRescued(saveData.ailaRescued);
        // v4.2.3 (R7 修复): 读档恢复堕落历史峰值 — 存档优先，其次以当前堕落兜底。
        // 否则读档后 maxEver=0 永远追不上当前值，艾拉事件窗口永久错过。
        const restoredMaxEver = typeof saveData.maxCorruptionEver === 'number'
          ? saveData.maxCorruptionEver
          : (typeof saveData.currentCorruption === 'number' ? saveData.currentCorruption : 0);
        maxCorruptionEverRef.current = Math.max(maxCorruptionEverRef.current, restoredMaxEver);
        if (saveData.territory) {
          const base = createInitialTerritory();
          setTerritory({ ...base, ...(saveData.territory as TerritoryState) });
        }
        if (saveData.currentEnding) {
          const found = ENDINGS.find((e) => e.id === (saveData.currentEnding as EndingDef).id);
          if (found) setCurrentEnding(found);
        }
        if (Array.isArray(saveData.learnedSkillNames)) setLearnedSkillNames(saveData.learnedSkillNames as string[]);
        if (typeof saveData.skillPointBalance === 'number') setSkillPointBalance(saveData.skillPointBalance);
        if (saveData.equipmentSlots && typeof saveData.equipmentSlots === 'object') setEquipmentSlots(saveData.equipmentSlots as Record<string, GameItem | null>);
        if (Array.isArray(saveData.worldBookEntries)) setWorldBookEntries(saveData.worldBookEntries as WorldBookEntry[]);
        setStatusText('存档已加载');
      }, 300);
      return () => clearTimeout(timer);
    } catch (err) {
      console.error('[ContinueGame] 加载存档失败:', err);
      setStatusText('加载存档失败');
    }
    return;
  }, [fullSetting]);

  // ── Auto scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Phase handlers ──

  const handleNarratorContinue = useCallback(() => {
    setPhase('character');
  }, []);

  const handleCharacterConfirm = useCallback(
    (data: CharacterData) => {
      setCharacterData(data);

      if (!fullSetting) return;

      // Initialize random seed for this session
      setSessionSeed(Date.now());

      const narratorContent = fullSetting.startingLocation?.openingNarrative
        ? fullSetting.startingLocation.openingNarrative
        : `欢迎来到 ${fullSetting.worldMeta.name}。${fullSetting.worldMeta.description}`;

      const charMsg = `角色创建完成：${data.name}（${data.professionName ?? data.className}）\n职业：${data.professionName ?? data.className} | 出身：${data.originName ?? '未知'} | 过往：${data.backgroundName ?? '未知'}\n属性：${Object.entries(data.attributes)
        .map(([k, v]) => `${FROSTHOLD_ATTR_DETAILS[k]?.label ?? k} ${v}`)
        .join('，')}\n起始金币：${data.startingGold ?? DEFAULT_STARTING_GOLD} 🪙`;

      // Initialize game state with world-specific defaults
      const initialGS = getDefaultGameState(fullSetting.worldMeta.name, fullSetting.themeData);
      // v4.1.0: 阵营声望初始化（world-setting 10.2，-100~+100）
      const factionList = (fullSetting?.worldProfile?.factions ?? fullSetting?.themeData?.factions ?? []) as Array<{ id?: string; attitude?: string }>;
      const attitudeMap: Record<string, number> = {
        hostile: -40, neutral: 0, friendly: 30, allied: 60,
      };
      const initialReputations: Record<string, number> = {};
      if (Array.isArray(factionList)) {
        for (const f of factionList) {
          if (f?.id && typeof f.id === 'string') {
            const base = typeof f.attitude === 'string' ? attitudeMap[f.attitude] ?? 0 : 0;
            initialReputations[f.id] = Math.max(-100, Math.min(100, base));
          }
        }
      }
      initialGS.factionReputations = initialReputations;
      setGameState(initialGS);
      gameStateRef.current = initialGS;

      const initialMessages: ChatMessage[] = [
        {
          id: `narrator-${Date.now()}`,
          role: 'narrator',
          content: narratorContent,
          timestamp: Date.now(),
        },
        {
          id: `system-char-${Date.now()}`,
          role: 'system',
          content: charMsg,
          timestamp: Date.now(),
        },
        {
          id: `welcome-${Date.now()}`,
          role: 'assistant',
          content: `${data.name}，欢迎来到 ${fullSetting.worldMeta.name}。\n\n我是你的 AI 游戏主持人。你可以自由探索这个世界——与NPC对话、探索地点、战斗或解谜。接下来，你想做什么？`,
          timestamp: Date.now(),
        },
      ];

      setMessages(initialMessages);
      setPhase('playing');

      // v5.0.0 (功能4): 开局对话选项 — 玩家进入游戏即可通过选项参与互动，提升代入感。
      // 点击后走 dispatchAction 发送；AI 回复后自动被新选项替换或清空。
      setDialogueOptions([
        { id: 'intro-1', text: '我想先了解要塞的近况与我作为领主的职责', emoji: '🏰', hint: '了解当前局势' },
        { id: 'intro-2', text: '去酒馆打听城里的传闻与消息', emoji: '🍺', hint: '收集情报' },
        { id: 'intro-3', text: '清点我的装备与随身物品', emoji: '🎒', hint: '查看物资' },
        { id: 'intro-4', text: '前往城门巡视防御工事', emoji: '🛡️', hint: '巡视城防' },
      ]);

      // v1.0.0: Initialize new systems
      resetAchievements();
      setAchievementList(getAchievements());
      const starterGear = generateStarterGear(Date.now());
      setEquipmentList(starterGear);
      setDayCount(1);
      setCombatEntries([]);
      setEnemiesDefeated(0);
      setElementReactionsTriggered(new Set());
      setGold(data.startingGold ?? DEFAULT_STARTING_GOLD);
      setWallet(data.startingWallet ?? { gold: Math.floor((data.startingGold ?? DEFAULT_STARTING_GOLD) / 100), silver: Math.floor(((data.startingGold ?? DEFAULT_STARTING_GOLD) % 100) / 10), copper: (data.startingGold ?? DEFAULT_STARTING_GOLD) % 10, shard: 0 });
      // v4.1.0: 起始堕落值（受过往 corruptionMod 修正）
      setCurrentCorruption(Math.max(0, Math.min(100, data.corruption ?? 0)));
      // v4.1.0: 职业开局基础技能 — 将职业 starterSkills 解析到技能树节点并预解锁
      const profId = data.professionId || data.classId || '';
      // v4.2.0: 开局不携带任何技能 — 技能需通过剧情/探索/导师传授逐步习得
      // （不再预解锁 starterSkills；技能点仍按职业难度给，供后续在技能树中分配）
      setLearnedSkillNames([]);
      const prof = PROFESSIONS.find((p) => p.id === profId);
      setSkillPointBalance(2 + (prof?.difficulty ?? 1));
      const initialRels = buildRelationships(FROSTHOLD_PRESET);
      setRelationships(initialRels);
      // v4.2.1 (P0-5): 开局重置市场供需缓存
      resetMarketCache();
      // v4.2.1 (P0-6): 出身阵营偏好生效 — 此前 factionBias 零消费，出身后果永不落地
      const originDef = ORIGINS.find((o) => o.id === data.originId);
      const originBias = originDef?.factionBias;
      if (originBias && originBias.length > 0) {
        setGameState((prev) => {
          const curRep = prev.factionReputations ?? {};
          const biased: Record<string, number> = { ...curRep };
          for (const b of originBias) {
            biased[b.faction] = Math.max(-100, Math.min(100, (curRep[b.faction] ?? 0) + b.attitude));
          }
          return { ...prev, factionReputations: biased };
        });
        setMessages((msgs) => [...msgs, {
          id: `sys-origin-faction-${Date.now()}`,
          role: 'system',
          content: `🏷️ 出身「${originDef!.name}」带来的阵营声望：${originBias.map((b) => `${b.faction} ${b.attitude > 0 ? '+' : ''}${b.attitude}`).join('、')}。`,
          timestamp: Date.now(),
        }]);
      }
      // v4.2.0: 初始化关系链（预设同伴入链）
      initRelationChain(initialRels);
      // v4.2.0: 开场新闻推送（世界动态）
      pushNews({
        type: 'official', title: '暗影在东方集结',
        body: '白石信使昨夜抵达凛冬要塞：黑暗势力正在阴影山脉以东大规模集结，规模前所未有。',
        day: 1,
      });
      pushNews({
        type: 'rumor', title: '酒馆里的传言',
        body: '据说荒芜平原的古战场夜里会亮起鬼火，有人看见亡灵军团在操练。',
        day: 1,
      });
      setTimesSaved(0);
      setMainQuestCompleted(false);
      combatComboRef.current = 0;
      // v4.2.3 (R7 修复): 新档必须重置堕落峰值 — 否则换档后 maxEver 残留，
      // 新角色堕落进入 [20,40] 也不触发艾拉事件，真结局永久锁死
      maxCorruptionEverRef.current = 0;
    },
    [fullSetting]
  );

  // ── v4.1.0: 多结局检查（world-setting 十一）──
  // 堕落值=100 立即触发湮灭；其余结局在 AI 响应后（每 30 天）评估
  const checkEnding = useCallback((forceCorruption?: number): boolean => {
    if (currentEnding) return true; // 已触发结局
    const ctx = {
      endingFlags: gameStateRef.current.endingFlags ?? {},
      corruption: forceCorruption ?? currentCorruption,
      factionReputations: gameStateRef.current.factionReputations ?? {},
      defense: calcDefense(territoryRef.current),
      ailaCompleted: ailaRescued,
      dayCount,
      siegesSurvived: territoryRef.current.siegesSurvived,
      mainQuestCompleted,
    };
    const ending = evaluateEnding(ctx);
    if (ending) {
      setCurrentEnding(ending);
      setActivePanel(null);
      // 结局系统消息
      setMessages((prev) => [...prev, {
        id: `ending-${Date.now()}`,
        role: 'system',
        content: `🏁 【结局达成】${ending.type}「${ending.name}」\n${ending.title}`,
        timestamp: Date.now(),
      }]);
      return true;
    }
    return false;
  }, [currentEnding, currentCorruption, ailaRescued, dayCount, mainQuestCompleted]);

  // ── Send message (chat) with SSE streaming v0.6.0 ──
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading || !fullSetting) return;
    setInput('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const currentMessages = messages.concat(userMsg);
    setMessages(currentMessages);
    setIsLoading(true);
    setStatusText('AI 思考中...');

    // 创建占位 AI 消息用于流式累积
    const aiMsgId = `ai-${Date.now()}`;
    const placeholderMsg: ChatMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, placeholderMsg]);

    try {
      const custom = getCustomApiConfig();
      let endpoint: string;
      let key: string;
      let model: string;

      if (custom && custom.enabled) {
        endpoint = custom.endpoint.replace(/\/+$/, '') + '/chat/completions';
        key = custom.apiKey;
        model = 'deepseek-chat';
      } else {
        // FIX: SEC-1 — 优先使用安全存储，兼容旧明文 localStorage
        const encryptedKey = await secureGet('deepseek-api-key');
        key = apiKey ?? encryptedKey ?? localStorage.getItem('ai-narrator-openrouter-api-key') ?? '';
        if (!key) {
          throw new Error('未配置 API Key，请先前往设置页面配置。');
        }
        endpoint = 'https://api.deepseek.com/v1/chat/completions';
        model = 'deepseek-chat';
      }

      const systemPrompt = buildWorldSystemPrompt(
        fullSetting,
        characterData
          ? {
              ...characterData,
              corruption: currentCorruption,
              factionReputations: gameStateRef.current.factionReputations,
            }
          : { name: '冒险者', classId: '', className: '', attributes: {}, corruption: 0, factionReputations: {} },
        buildTerritorySummary(territoryRef.current),
        buildEndingPrompt({
          endingFlags: gameStateRef.current.endingFlags ?? {},
          corruption: currentCorruption,
          factionReputations: gameStateRef.current.factionReputations ?? {},
          defense: calcDefense(territoryRef.current),
          ailaCompleted: ailaRescued,
          dayCount,
          siegesSurvived: territoryRef.current.siegesSurvived,
          mainQuestCompleted,
        }),
        buildAilaInfo(ailaRescued),
        buildSkillInfo(learnedSkillNames),
        buildWorldBookPrompt(worldBookEntries)
      );

      const chatHistory = currentMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-20)
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      // ── v4.2.1 (P0-2/P1-1): 战斗结算 & 检定结果回传 AI — 让 AI 承认前端裁决的数值 ──
      const lastCheck = checkResultRef.current;
      const combatContextParts: string[] = [];
      if (lastCheck) {
        const verdict = lastCheck.success ? '成功' : '失败';
        combatContextParts.push(
          `【D20 检定结果（前端已裁决，你须据此续写后果）】属性检定 ${lastCheck.attr}：掷出 ${lastCheck.roll} + 修正 ${lastCheck.modifier} = ${lastCheck.total}，DC ${lastCheck.dc} → ${verdict}。请立即描述该结果对应的叙事后果（成功则达成，失败则付出代价），不要重新判定。`
        );
        checkResultRef.current = null; // 消费后清除
      }
      const lastCombat = combatResultRef.current;
      if (lastCombat) {
        combatContextParts.push(
          `【战斗结算（前端已裁决，你须承认此数值）】你对${lastCombat.enemyName}造成 ${lastCombat.damage} 点伤害。请基于此数值描述战斗结果：${lastCombat.hit ? '敌人受到重创' : '攻击落空'}，并决定敌人后续状态（未死亡则继续战斗，已死亡则描述战利品）。`
        );
        combatResultRef.current = null;
      }
      if (combatContextParts.length > 0) {
        chatHistory.push({
          role: 'user',
          content: `（系统裁决通知）${combatContextParts.join('\n')}`,
        });
      }

      // ── v5.0.0 (叙事节拍): 注入当前天数 + 艾拉/议会进度 — 供强制节拍表判断 ──
      const beatContextParts: string[] = [];
      beatContextParts.push(`（叙事节拍）当前是第 ${dayCount} 天。`);
      const councilDecision = gameStateRef.current.councilDecision as string | undefined;
      if (councilDecision) {
        const councilNames: Record<string, string> = {
          fortify: '闭城自守', strike: '主动出击', aid: '向幽林精灵求援', negotiate: '与黑暗势力谈判',
        };
        beatContextParts.push(`凛冬议会已决议：支持「${councilNames[councilDecision] ?? councilDecision}」——围城战请按此战术形态演绎。`);
      }
      const crow = gameStateRef.current.crowFeather as { echoes?: number; revealed?: boolean } | undefined;
      if (crow && (crow.echoes ?? 0) > 0 && !crow.revealed && dayCount >= 30) {
        beatContextParts.push('鸦羽的阴影已在要塞外徘徊多日——纪三已至，该让他现身了。');
      }
      if (!ailaRescued && dayCount >= 15) {
        beatContextParts.push('艾拉尚未被拯救——若堕落值未进入 20-40，请在近期通过其他途径（废墟中的哭声）引导玩家走向艾拉事件。');
      }
      if (beatContextParts.length > 1) {
        chatHistory.push({
          role: 'user',
          content: `（叙事节拍通知）${beatContextParts.join('\n')}`,
        });
      }

      const config = {
        endpoint,
        apiKey: key,
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...chatHistory,
        ],
        maxTokens: 2048,
        temperature: 0.8,
      };

      let rawContent: string;

      try {
        // Try SSE streaming first; fall back to non-streaming on failure
        await streamChat(
          config,
          {
            onToken: (token: string) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId
                    ? { ...m, content: m.content + token }
                    : m
                )
              );
            },
            onComplete: (fullContent: string) => {
              rawContent = fullContent;
            },
            onError: async (err: Error) => {
              // SSE failed, fall back to non-streaming
              console.warn('[Game] SSE stream failed, falling back to non-streaming:', err.message);
              try {
                const fallbackContent = await fetchChat(config);
                rawContent = fallbackContent;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId
                      ? { ...m, content: fallbackContent }
                      : m
                  )
                );
              } catch (fallbackErr) {
                throw fallbackErr;
              }
            },
          }
        );
      } catch (streamErr) {
        // Both SSE and fallback failed
        throw streamErr;
      }

      // Ensure rawContent is set (in case onComplete/fallback didn't trigger)
      if (!rawContent!) {
        // Extract from current AI message content
        const aiMsg = (await new Promise<ChatMessage>((resolve) => {
          setMessages((prev) => {
            const found = prev.find((m) => m.id === aiMsgId);
            if (found) resolve(found);
            return prev;
          });
        }));
        rawContent = aiMsg?.content || '';
      }

      // v4.0.0: Parse OPTIONS first, then GAMESTATE
      const { options: parsedOptions, stripped: afterOptionsStrip } = parseDialogueOptions(rawContent);
      const displayContent = stripGameStateBlock(afterOptionsStrip);
      const parsedState = parseGameState(rawContent);

      // v4.1.0: D20 检定解析 — 从原始回复提取 CHECK 块并剥离显示
      const checks = parseCheckBlocks(rawContent);
      const cleanDisplay = stripCheckBlocks(displayContent);
      if (checks.length > 0 && characterData) {
        const firstCheck = checks[0]!;
        const attrValue = characterData.attributes[firstCheck.attr] ?? 10;
        setDiceCheck({
          attr: firstCheck.attr,
          attrValue,
          dc: firstCheck.dc,
          desc: firstCheck.desc,
        });
      }

      if (parsedOptions.length > 0) {
        setDialogueOptions(parsedOptions);
      } else {
        // v5.0.0 (需求3 修复): 本轮无新选项时清空上一轮残留（保留低语选项待点击），
        // 避免旧选项长期占据界面误导玩家
        setDialogueOptions((prev) => prev.filter((o) => o.id.startsWith('whisper-')));
      }

      if (parsedState) {
        const prev = gameStateRef.current;
        const mergedQuests = parsedState.quests ? mergeQuests(prev.quests, parsedState.quests) : prev.quests;
        setGameState({
          items: parsedState.items
            ? [...prev.items, ...parsedState.items.filter(
                (newItem) => !prev.items.some((existing) => existing.id === newItem.id)
              )]
            : prev.items,
          quests: mergedQuests,
          currentLocation: parsedState.currentLocation ?? prev.currentLocation,
          currentLocationDescription: parsedState.currentLocationDescription ?? prev.currentLocationDescription,
          regions: parsedState.currentLocation
            ? prev.regions.map((r) => ({
                ...r,
                discovered: r.discovered || r.name === parsedState.currentLocation || r.id === parsedState.currentLocation,
              }))
            : prev.regions,
          skills: prev.skills,
          // v4.1.0: 阵营声望合并（增量叠加，钳制 -100~+100）
          factionReputations: parsedState.factionReputations
            ? Object.fromEntries(
                Object.entries(parsedState.factionReputations).map(([fid, delta]) => {
                  const cur = prev.factionReputations?.[fid] ?? 0;
                  return [fid, Math.max(-100, Math.min(100, cur + delta))];
                })
              )
            : prev.factionReputations,
          // v4.1.0: 结局条件进度（取最大值）
          endingFlags: parsedState.endingFlags
            ? Object.fromEntries(
                Object.entries(parsedState.endingFlags).map(([k, v]) => {
                  const cur = prev.endingFlags?.[k] ?? 0;
                  return [k, Math.max(cur, v)];
                })
              )
            : prev.endingFlags,
        });

        // v3.0.0: merge companion relationship updates (progressive reveal)
        if (parsedState.relationships && parsedState.relationships.length > 0) {
          setRelationships((prev) => {
            const next = [...prev];
            for (const upd of parsedState.relationships!) {
              const idx = next.findIndex((r) => r.id === upd.id);
              if (idx < 0) continue;
              const cur = next[idx]!;
              next[idx] = {
                ...cur,
                revealLevel: (upd.revealLevel !== undefined ? Math.max(cur.revealLevel, upd.revealLevel) : cur.revealLevel) as CompanionRelationship['revealLevel'],
                affinity: upd.affinity !== undefined ? Math.max(-100, Math.min(100, cur.affinity + upd.affinity)) : cur.affinity,
                loyalty: upd.loyalty !== undefined ? Math.max(0, Math.min(100, cur.loyalty + upd.loyalty)) : cur.loyalty,
              };
            }
            return next;
          });
        }

        // v4.2.1 (P0-3): 主线任务完成时解锁结局 — 修复 6/8 结局永久锁死
        // （放在合并块之后执行，避免被 setGameState 覆盖；同时前端兜底 endingFlags.crown）
        if (hasMainQuestCompleted(mergedQuests) && !mainQuestCompleted) {
          setMainQuestCompleted(true);
          setGameState((s) => ({
            ...s,
            endingFlags: {
              ...(s.endingFlags ?? {}),
              crown: Math.max(s.endingFlags?.crown ?? 0, 1),
            },
          }));
          setMessages((msgs) => [...msgs, {
            id: `sys-main-done-${Date.now()}`,
            role: 'system',
            content: '🏰 主线任务完成！凛冬要塞的传奇已铸就——你已解锁全部结局线。',
            timestamp: Date.now(),
          }]);
        }

        // ── v4.2.0: 新协议字段应用 ──
        // 1) 技能授予（剧情/探索习得）
        const skillPayload = (parsedState as unknown as { skills?: string[] }).skills;
        if (skillPayload && skillPayload.length > 0) {
          setLearnedSkillNames((prev) => {
            const fresh = skillPayload.filter((s) => !prev.includes(s));
            if (fresh.length === 0) return prev;
            setMessages((msgs) => [...msgs, {
              id: `sys-skill-gain-${Date.now()}`,
              role: 'system',
              content: `🌟 你习得了新技能：${fresh.join('、')}！（通过剧情/探索获得）`,
              timestamp: Date.now(),
            }]);
            return [...prev, ...fresh];
          });
        }
        // 2) 大陆快讯推送
        const newsPayload = (parsedState as unknown as { news?: Array<{ type?: NewsItem['type']; title: string; body: string; day?: number }> }).news;
        if (newsPayload && newsPayload.length > 0) {
          newsPayload.forEach((n) => pushNews({
            type: n.type ?? 'rumor',
            title: n.title,
            body: n.body,
            day: n.day ?? dayCount,
          }));
        }
        // 3) 世界书自动记录（AI 剧情驱动）
        const worldLogPayload = (parsedState as unknown as { worldLog?: Array<{ section: string; title: string; content: string; id?: string }> }).worldLog;
        if (worldLogPayload && worldLogPayload.length > 0) {
          setWorldBookEntries((prev) => {
            let next = [...prev];
            for (const entry of worldLogPayload) {
              const existingIdx = next.findIndex((e) => e.id === entry.id || (e.title === entry.title && e.section === entry.section));
              const newEntry: WorldBookEntry = {
                id: entry.id ?? `wb-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                section: entry.section,
                title: entry.title,
                content: entry.content,
                order: 80,
              };
              if (existingIdx >= 0) next[existingIdx] = { ...next[existingIdx]!, ...newEntry };
              else next.push(newEntry);
            }
            saveWorldBook(next);
            return next;
          });
        }
        // 4) 关系链动态角色
        const nodesPayload = (parsedState as unknown as { dynamicNodes?: Array<{ id: string; name: string; codename?: string; role?: string; emoji?: string; race?: string; affinity?: number; loyalty?: number; appearance?: string; memory?: string }> }).dynamicNodes;
        if (nodesPayload && nodesPayload.length > 0) {
          setRelationChain((prev) => {
            let chain = { ...prev };
            for (const n of nodesPayload) {
              chain = addDynamicNode(chain, {
                id: n.id,
                name: n.name,
                codename: n.codename ?? `陌生的${n.role ?? '旅人'}`,
                role: n.role ?? '未知身份',
                emoji: n.emoji ?? '❓',
                race: n.race,
                affinity: n.affinity ?? 0,
                loyalty: n.loyalty ?? 0,
                relation: relationFromAffinity(n.affinity ?? 0, false),
                revealLevel: 1,
                appearance: n.appearance,
                memories: n.memory ? [n.memory] : [],
              });
            }
            return chain;
          });
        }
        // 5) v4.2.1 (P0-6): 钱包入账 — AI 叙事奖励兑现到前端钱包
        const walletPayload = (parsedState as unknown as { wallet?: { gold?: number; silver?: number; copper?: number; shard?: number } }).wallet;
        if (walletPayload && (walletPayload.gold || walletPayload.silver || walletPayload.copper || walletPayload.shard)) {
          setWallet((prev) => {
            const next = {
              gold: prev.gold + (walletPayload.gold ?? 0),
              silver: prev.silver + (walletPayload.silver ?? 0),
              copper: prev.copper + (walletPayload.copper ?? 0),
              shard: prev.shard + (walletPayload.shard ?? 0),
            };
            // 铜币进位：10 铜 = 1 银，10 银 = 1 金
            const copperCarry = Math.floor(next.copper / 10);
            next.silver += copperCarry;
            next.copper %= 10;
            const silverCarry = Math.floor(next.silver / 10);
            next.gold += silverCarry;
            next.silver %= 10;
            // 同步 gold state（旧接口兼容）
            setGold((g) => Math.max(0, g + (walletPayload.gold ?? 0)));
            return next;
          });
          // 播报货币入账
          const gains: string[] = [];
          if (walletPayload.gold) gains.push(`金币 ${walletPayload.gold}`);
          if (walletPayload.silver) gains.push(`银币 ${walletPayload.silver}`);
          if (walletPayload.copper) gains.push(`铜币 ${walletPayload.copper}`);
          if (walletPayload.shard) gains.push(`源晶碎片 ${walletPayload.shard}`);
          if (gains.length > 0) {
            setMessages((msgs) => [...msgs, {
              id: `sys-gold-${Date.now()}`,
              role: 'system',
              content: `💰 你获得了：${gains.join('、')}。`,
              timestamp: Date.now(),
            }]);
          }
        }
        // 6) v4.2.1 (P0-4): 领地资源入账 — AI 叙事奖励（战斗缴获/任务奖励）
        const territoryPayload = (parsedState as unknown as { territory?: { resources?: { stone?: number; wood?: number; iron?: number; grain?: number; crystal?: number } } }).territory;
        if (territoryPayload?.resources) {
          const res = territoryPayload.resources;
          setTerritory((prev) => {
            const nextResources = {
              stone: prev.resources.stone + (res.stone ?? 0),
              wood: prev.resources.wood + (res.wood ?? 0),
              iron: prev.resources.iron + (res.iron ?? 0),
              grain: prev.resources.grain + (res.grain ?? 0),
              crystal: prev.resources.crystal + (res.crystal ?? 0),
              // v4.2.2 (R4 修复): 移除死表达式 `(res.crystal ? 0 : 0)`（恒 0）；
              // 领地 gold 资源不使用——金币奖励统一走 wallet 协议（见 GAMESTATE 说明）
              gold: prev.resources.gold ?? 0,
            };
            return { ...prev, resources: nextResources };
          });
          const gains: string[] = [];
          if (res.stone) gains.push(`石料 +${res.stone}`);
          if (res.wood) gains.push(`木材 +${res.wood}`);
          if (res.iron) gains.push(`铁 +${res.iron}`);
          if (res.grain) gains.push(`粮草 +${res.grain}`);
          if (res.crystal) gains.push(`源晶 +${res.crystal}`);
          if (gains.length > 0) {
            setMessages((msgs) => [...msgs, {
              id: `sys-res-${Date.now()}`,
              role: 'system',
              content: `🏗️ 领地资源入库：${gains.join('、')}。`,
              timestamp: Date.now(),
            }]);
          }
        }
        // v5.0.0 (叙事): 预兆梦 / 凛冬议会决策 / 鸦羽标记 合并进 gameState（随存档走）
        const dreamPayload = (parsedState as unknown as { propheticDream?: { count?: number; last?: string; motif?: string } }).propheticDream;
        const councilPayload = (parsedState as unknown as { councilDecision?: string }).councilDecision;
        const crowPayload = (parsedState as unknown as { crowFeather?: { echoes?: number; revealed?: boolean; confront?: boolean } }).crowFeather;
        if (dreamPayload || councilPayload || crowPayload) {
          setGameState((prev) => ({
            ...prev,
            propheticDream: dreamPayload ? { ...(prev.propheticDream ?? {}), ...dreamPayload } : prev.propheticDream,
            councilDecision: councilPayload ?? prev.councilDecision,
            crowFeather: crowPayload ? { ...(prev.crowFeather ?? {}), ...crowPayload } : prev.crowFeather,
          }));
          if (dreamPayload?.last) {
            setMessages((msgs) => [...msgs, {
              id: `sys-dream-${Date.now()}`,
              role: 'system',
              content: `🌙 梦境残响：${dreamPayload.last}`,
              timestamp: Date.now(),
            }]);
          }
          if (councilPayload) {
            const councilNames: Record<string, string> = {
              fortify: '闭城自守', strike: '主动出击', aid: '向幽林精灵求援', negotiate: '与黑暗势力谈判',
            };
            setMessages((msgs) => [...msgs, {
              id: `sys-council-${Date.now()}`,
              role: 'system',
              content: `🏛️ 凛冬议会决议：你支持了「${councilNames[councilPayload] ?? councilPayload}」方案。被否决领袖的忠诚将随之变化。`,
              timestamp: Date.now(),
            }]);
            // v5.0.0 (叙事 P1-5): 议会忠诚结算 — 支持方 +5，其余三派领袖 -10（场景级分支的代价）
            const councilLeaders: Record<string, string[]> = {
              fortify: ['thorin-copper'], strike: ['roland'], aid: ['aelune-starwhisper'], negotiate: ['grim-darkforge'],
            };
            const supportedIds = councilLeaders[councilPayload] ?? [];
            setRelationships((prev) => prev.map((r) => {
              if (supportedIds.includes(r.id)) {
                return { ...r, loyalty: Math.min(100, r.loyalty + 5) };
              }
              if ((['thorin-copper', 'roland', 'aelune-starwhisper', 'grim-darkforge'] as string[]).includes(r.id)) {
                return { ...r, loyalty: Math.max(0, r.loyalty - 10) };
              }
              return r;
            }));
            setRelationChain((prev) => {
              let chain = prev;
              for (const nid of supportedIds) {
                chain = interactWithNode(chain, nid, { affinityDelta: 5 });
              }
              return chain;
            });
          }
        }
      }

      // v4.1.0: 协议合规检测（审查 4.2）— 若 LLM 响应既无 GAMESTATE 也无 OPTIONS，
      // 说明未遵循协议，静默跳过会丢失状态更新。这里向用户轻提示（不打断叙事）。
      const hasCheck = /\[CHECK:/.test(rawContent);
      if (!parsedState && parsedOptions.length === 0 && !hasCheck) {
        setMessages((prev) => [...prev, {
          id: `sys-protocol-${Date.now()}`,
          role: 'system',
          content: '📜 领主记事：本次叙事未附带状态更新（AI 未输出 GAMESTATE 块）。若你完成了关键行动或获得物品，请提醒主持人补记。',
          timestamp: Date.now(),
        }]);
      }

      // Update AI message with stripped content for display
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId ? { ...m, content: cleanDisplay } : m
        )
      );

      // v4.1.0: 事件溯源存档 — 记录本次 AI 交互
      appendEvent(eventStore, 'dialogue', `玩家: ${text.substring(0, 40)}${text.length > 40 ? '...' : ''}`);

      // v4.1.0: NPC 引擎 tick — 基于 AgentGal 的自主演化
      setNpcEngine((prev) => {
        const { newState, results } = tickWorld(prev, gameStateRef.current.currentLocation, 0);
        // 如果有重要 NPC 行动，播报系统消息
        const important = results.filter(r => r.locationChange || r.goalChange);
        if (important.length > 0) {
          const latest = important[0]!;
          setMessages((prevMsgs) => [...prevMsgs, {
            id: `npc-tick-${Date.now()}`,
            role: 'system',
            content: `🌍 ${latest.narrative}`,
            timestamp: Date.now(),
          }]);
        }
        return newState;
      });

      // ── v4.1.0: 暗影低语 & 游离之魂（world-setting 5.3） ──
      // 1) 游离之魂：堕落值**曾**进入 20~40 区间（历史峰值判断，P1-2 修复——
      //    原一次性区间判断会被开局"赎罪+5、低语+3~8"直接跳过窗口，艾拉线永久锁死）
      maxCorruptionEverRef.current = Math.max(maxCorruptionEverRef.current, currentCorruption);
      if (!ailaRescued && maxCorruptionEverRef.current >= 20 && maxCorruptionEverRef.current <= 40 && dayCount >= 3) {
        setAilaRescued(true);
        setMessages((prev) => [...prev, {
          id: `aila-event-${Date.now()}`,
          role: 'system',
          content:
            '🌑 【游离之魂】夜色中，你在要塞外墙的废墟间听见了微弱的哭声。' +
            '一个衣衫褴褛的小女孩蜷缩在坍塌的瞭望塔阴影里——她就是艾拉。' +
            '她望着你说：「他们都走了……你说过会回来的。」' +
            '这是命运的初次触碰。你的灵魂深处，有什么东西微微震颤了一下。（堕落值 +5，不可回避）',
          timestamp: Date.now(),
        }]);
        setCurrentCorruption((prev) => Math.min(100, prev + 5));
        // v4.1.0: 艾拉关系揭示（revealLevel 0→1：从「废墟中的哭声」变为初见）
        setRelationships((prev) => prev.map((r) =>
          r.id === 'aila' ? { ...r, revealLevel: 1, name: '艾拉', race: '人类', emoji: '🎀', memories: ['在要塞废墟中被你发现', '她抱着一只褪色的布偶，说你会回来'] } : r
        ));
        // v4.1.0: 艾拉加入 NPC 世界（在场）
        setNpcEngine((prev) => ({
          ...prev,
          npcs: {
            ...prev.npcs,
            aila: {
              id: 'aila',
              name: '艾拉',
              role: '被拯救的小女孩',
              mood: 'worried',
              goal: 'support',
              location: '凛冬谷',
              affinity: 20,
              present: true,
              memories: [{ id: 'rescue', event: '在废墟中被领主发现并带回了要塞', timestamp: Date.now(), importance: 3 }],
              lastTick: Date.now(),
            },
          },
        }));
      }

      // 2) 暗影低语：堕落值 ≥41 且冷却已过时，追加特殊对话选项
      whisperCooldownRef.current = Math.max(0, whisperCooldownRef.current - 1);
      if (currentCorruption >= 41 && whisperCooldownRef.current === 0 && !isLoading) {
        whisperCooldownRef.current = 3; // 每 3 轮出现一次
        const whisperOpt: DialogueOption = {
          id: `whisper-${Date.now()}`,
          text: '聆听暗影低语',
          emoji: '🌑',
          style: 'aggressive',
          // v5.0.0 (叙事 P1-3): 鸦羽呼应 — 前任守夜人同样听过这低语，最终坠落
          hint: '100% 成功，但堕落值 +3~8。暗影会给予你力量——只要你愿意付出代价。（记忆深处：二十年前的守夜人鸦羽，也曾站在这里聆听……）',
        };
        setDialogueOptions((prev) => [...prev, whisperOpt]);
        setWhisperTriggered(true);
      }

      // v1.0.0: Combat keyword detection
      // v4.2.1 (P1-1): 收窄为强特征词 — 避免"打听/射手在哪"误触发战斗结算
      const userInput = text.toLowerCase();
      const combatKeywords = ['攻击', '砍向', '劈砍', '斩杀', '挥剑', '出剑', '火球', '冰霜', '雷电', '施法', '射箭', '拉弓', '挥拳', '突刺', '猛击', '轰击'];
      const hasCombatKeyword = combatKeywords.some(kw => userInput.includes(kw));

      if (hasCombatKeyword) {
        try {
          // Detect elements from input
          const detectedElements: Element[] = [];
          if (userInput.includes('火') || userInput.includes('火焰')) detectedElements.push('火');
          if (userInput.includes('水') || userInput.includes('冰')) detectedElements.push('水');
          if (userInput.includes('风') || userInput.includes('雷')) detectedElements.push('风');
          if (userInput.includes('土') || userInput.includes('岩')) detectedElements.push('土');
          if (userInput.includes('光') || userInput.includes('圣')) detectedElements.push('光');
          if (userInput.includes('暗') || userInput.includes('影')) detectedElements.push('暗');
          if (detectedElements.length < 2) detectedElements.push('火');

          const region = gameStateRef.current.currentLocation || '森林';
          const enemyType = detectEnemyType(userInput);
          // v4.2.1 (P0-1): 基础伤害降低（属性/装备已加入公式），避免数值膨胀
          const baseDamage = 8 + Math.floor(Math.random() * 12);
          const currentCombo = combatComboRef.current;
          // v4.2.1 (P0-1): 命中率挂敏捷 — 每点敏捷 +2% 命中，基础 75%
          const dex = characterData?.attributes?.dexterity ?? characterData?.attributes?.agility ?? 0;
          const hit = Math.random() < Math.min(0.95, 0.75 + dex * 0.02);

          // v4.2.2 (R5 修复): 主属性按职业 attrMods 权重最高者取 —
          // 敏捷/感知职业（游侠/刺客/武僧/德鲁伊）不再错误落到 strength
          // v4.2.3 (O2 修复): 伤害主属性限定 strength/dexterity/intelligence 三选一 —
          // 圣骑士 attrMods {strength:2,constitution:3,charisma:1} 不再取到体质，德鲁伊不再取到感知
          const attrs = characterData?.attributes ?? {};
          const DAMAGE_ATTRS = ['strength', 'dexterity', 'intelligence'] as const;
          const profForCombat = PROFESSIONS.find((p) => p.id === (characterData?.classId ?? characterData?.professionId));
          const combatAttrRank = profForCombat?.attrMods
            ? (Object.entries(profForCombat.attrMods) as [string, number][])
                .filter(([k, v]) => v > 0 && (DAMAGE_ATTRS as readonly string[]).includes(k))
                .sort((a, b) => b[1] - a[1])
            : [];
          const primaryAttrName = combatAttrRank[0]?.[0]
            ?? ((attrs.strength ?? 0) >= (attrs.intelligence ?? 0) && (attrs.strength ?? 0) >= (attrs.dexterity ?? 0) ? 'strength'
              : (attrs.dexterity ?? 0) >= (attrs.intelligence ?? 0) ? 'dexterity'
              : 'intelligence');
          const mainAttr = attrs[primaryAttrName] ?? 0;
          const weaponItem = equipmentSlots['主手'];
          const weaponAttack = typeof weaponItem?.stats?.attack === 'number' ? weaponItem.stats.attack : 0;
          const crit = typeof weaponItem?.stats?.crit === 'number' ? weaponItem.stats.crit / 100 : 0;
          const playerStats: PlayerCombatStats = {
            attackAttr: mainAttr,
            dexterity: dex,
            weaponAttack,
            critChance: crit,
            className: characterData?.className,
            skills: learnedSkillNames,
          };

          const result = resolveCombat(baseDamage, detectedElements, enemyType, region, currentCombo, hit, playerStats);
          combatComboRef.current = result.combo;

          // Track reactions
          if (result.reaction) {
            setElementReactionsTriggered(prev => {
              const next = new Set(prev);
              next.add(result.reaction!);
              return next;
            });
          }

          // Track enemies defeated
          if (hit && result.damage > 20) {
            setEnemiesDefeated(prev => prev + 1);
          }

          // Add combat entry
          const combatEntry: CombatLogEntry = {
            id: `combat-${Date.now()}`,
            timestamp: Date.now(),
            result,
            enemyName: enemyType,
          };
          setCombatEntries(prev => [...prev, combatEntry]);

          // v4.2.1 (P1-1): 缓存战斗结果 — 注入下一轮 AI 上下文，让 AI 承认前端数值
          combatResultRef.current = { enemyName: enemyType, damage: result.damage, hit };

          // Add combat narrative to messages
          setMessages((prev) => [...prev, {
            id: `combat-${Date.now()}`,
            role: 'system',
            content: `⚔️ ${result.narrative}`,
            timestamp: Date.now(),
          }]);
        } catch {
          // Combat resolution failed silently
        }
      }

      // v1.0.0: Achievement check after each AI response
      try {
        const discoveredCount = gameStateRef.current.regions.filter(r => r.discovered).length;
        const newAchievements = checkAchievements({
          regionsDiscovered: discoveredCount,
          totalRegions: gameStateRef.current.regions.length,
          enemiesDefeated,
          maxComboReached: combatComboRef.current,
          elementReactionsTriggered,
          equipmentByRarity: equipmentList.reduce((acc, eq) => {
            acc[eq.rarity] = (acc[eq.rarity] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          inventorySize: gameStateRef.current.items.length,
          gold,
          mainQuestCompleted,
          daysPlayed: dayCount,
          timesSaved,
        });

        if (newAchievements.length > 0) {
          const first = newAchievements[0];
          if (first) {
            setAchievementToast({
              id: first.id,
              name: first.name,
              description: first.description,
              icon: first.icon,
              category: first.category,
              reward: first.reward,
            });
          }
          // v4.2.1 (P0-5/P1-4): 成就奖励兑现 — 金币落账 + 技能点发放（此前仅文案）
          let totalGold = 0;
          let totalSkillPoints = 0;
          for (const ach of newAchievements) {
            totalGold += ach.rewardGold ?? 0;
            totalSkillPoints += ach.rewardSkillPoints ?? 0;
          }
          if (totalGold > 0) {
            // v4.2.2 (R1 修复): rewardGold 语义为「金币」，必须 ×100 转铜币入账
            //（此前 walletToCopper + totalGold 把金币当铜币加，入账缩水 100 倍）
            // v4.2.3: 换算走 goldToCopper 共用函数（消除测试镜像）
            setWallet((prev) => {
              const tc = walletToCopper(prev) + goldToCopper(totalGold);
              return { ...copperToWallet(tc), shard: prev.shard };
            });
            setGold((g) => g + totalGold);
          }
          if (totalSkillPoints > 0) {
            setSkillPointBalance((sp) => sp + totalSkillPoints);
          }
          // 汇总播报
          const rewardSummary: string[] = [];
          if (totalGold > 0) rewardSummary.push(`金币 +${totalGold}`);
          if (totalSkillPoints > 0) rewardSummary.push(`技能点 +${totalSkillPoints}`);
          if (rewardSummary.length > 0) {
            setMessages((msgs) => [...msgs, {
              id: `sys-ach-reward-${Date.now()}`,
              role: 'system',
              content: `🏆 成就奖励兑现：${rewardSummary.join('、')}（${newAchievements.map((a) => a.name).join('、')}）`,
              timestamp: Date.now(),
            }]);
          }
          // Update achievement list state
          setAchievementList(getAchievements());
        }
      } catch {
        // Achievement check failed silently
      }

      // v1.0.0: Event engine — 10% chance
      try {
        const seed = getSessionSeed();
        const rng = createRng(seed);
        if (rollEvent(rng, 0.10)) {
          const region = gameStateRef.current.currentLocation || '森林';
          const event = rollWorldEvent(rng, region, dayCount);
          if (event) {
            setMessages((prev) => [...prev, {
              id: `event-${Date.now()}`,
              role: 'system',
              content: `🎲 【${event.name}】${event.description}\n${event.effects.map(e => e.description).join('\n')}`,
              timestamp: Date.now(),
            }]);
          }

          // Seasonal events every 30 days
          if (dayCount > 0 && dayCount % 30 === 0) {
            const seasonalEvent = rollSeasonalEvent(rng, dayCount);
            if (seasonalEvent) {
              setMessages((prev) => [...prev, {
                id: `season-${Date.now()}`,
                role: 'system',
                content: `🌟 季节事件！【${seasonalEvent.name}】${seasonalEvent.description}`,
                timestamp: Date.now(),
              }]);
            }
          }
        }
      } catch {
        // Event engine failed silently
      }

      // Increment day count on successful response
      setDayCount(prev => prev + 1);
      setStatusText('就绪');

      // v4.1.0: 多结局检查 — 每 30 天一次 + 堕落值 100 立即触发（湮灭）
      if (currentCorruption >= 100) {
        checkEnding(currentCorruption);
      } else if (dayCount > 0 && dayCount % 30 === 0) {
        checkEnding();
      }
    } catch (error) {
      // Remove placeholder on error
      setMessages((prev) => prev.filter((m) => m.id !== aiMsgId));
      console.error('[AI Narrator] handleSend 失败:', error);

      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `❌ ${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setStatusText('错误');
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, apiKey, fullSetting, characterData, currentCorruption, ailaRescued, dayCount, checkEnding, learnedSkillNames, worldBookEntries, pushNews]);

  // ── v0.7.0: Item use handler ──
  const handleUseItem = useCallback((item: GameItem) => {
    const current = gameStateRef.current;
    const qty = item.quantity ?? 1;

    if (qty < 0) {
      // Discard item
      const newItems = current.items.filter((i) => i.id !== item.id);
      setGameState({ ...current, items: newItems });
      gameStateRef.current = { ...current, items: newItems };
      setStatusText(`${item.name} 已丢弃`);

      // Add system message
      setMessages((prev) => [...prev, {
        id: `sys-discard-${Date.now()}`,
        role: 'system',
        content: `🗑️ ${item.name} 已被丢弃。`,
        timestamp: Date.now(),
      }]);
      return;
    }

    if (item.type === 'consumable' && item.effect) {
      const newItems = current.items.map((i) => {
        if (i.id === item.id && i.quantity !== undefined) {
          const newQty = i.quantity - 1;
          return newQty <= 0 ? null : { ...i, quantity: newQty };
        }
        return i;
      }).filter((i): i is GameItem => i !== null);

      let msg = '';
      if (item.effect.hp) {
        msg += `❤️ HP +${item.effect.hp} `;
      }
      if (item.effect.mp) {
        msg += `💎 MP +${item.effect.mp} `;
      }

      setGameState({ ...current, items: newItems });
      gameStateRef.current = { ...current, items: newItems };
      setStatusText(`使用了 ${item.name}`);

      setMessages((prev) => [...prev, {
        id: `sys-use-${Date.now()}`,
        role: 'system',
        content: `🧪 使用了 ${item.name}。${msg.trim()}`,
        timestamp: Date.now(),
      }]);
      return;
    }

    if (item.type === 'weapon' || item.type === 'armor' || item.type === 'trinket') {
      // v4.1.0: 装备物品 — 写入对应槽位（武器→主手，防具→护甲，饰品→饰品）
      const slotFor: Record<string, string> = { weapon: '主手', armor: '护甲', trinket: '饰品' };
      const slot = slotFor[item.type] ?? '主手';
      setEquipmentSlots((prev) => {
        const occupied = prev[slot];
        // 槽位已有装备：交换回背包
        const newItems = current.items
          .filter((i) => i.id !== item.id)
          .concat(occupied ? [{ ...occupied }] : []);
        setGameState({ ...current, items: newItems });
        gameStateRef.current = { ...current, items: newItems };
        const nextSlots = { ...prev, [slot]: { ...item, quantity: 1 } };
        setStatusText(`装备了 ${item.name}（${slot}）`);
        setMessages((msgs) => [...msgs, {
          id: `sys-equip-${Date.now()}`,
          role: 'system',
          content: `⚔️ 你装备了 ${item.name}（${slot}）${occupied ? `，换下了 ${occupied.name}。` : '。'}${item.effect?.attr ? ` ${item.effect.attr} +${item.effect.value}` : ''}${item.stats ? ` 属性：${Object.entries(item.stats).map(([k, v]) => `${k}+${v}`).join(' ')}` : ''}`,
          timestamp: Date.now(),
        }]);
        return nextSlots;
      });
      return;
    }

    // Generic use
    setStatusText(`使用了 ${item.name}`);
  }, []);

  // ── v4.1.0: 卸下装备 — 槽位装备回背包 ──
  const handleUnequip = useCallback((slotId: string) => {
    setEquipmentSlots((prev) => {
      const equipped = prev[slotId];
      if (!equipped) return prev;
      const current = gameStateRef.current;
      const newItems = [...current.items, equipped];
      setGameState({ ...current, items: newItems });
      gameStateRef.current = { ...current, items: newItems };
      setStatusText(`卸下了 ${equipped.name}`);
      setMessages((msgs) => [...msgs, {
        id: `sys-unequip-${Date.now()}`,
        role: 'system',
        content: `🎒 你卸下了 ${equipped.name}，将其放回背包。`,
        timestamp: Date.now(),
      }]);
      return { ...prev, [slotId]: null };
    });
  }, []);

  // ── v4.1.0: 从背包装备 — 委托给 handleUseItem（含槽位交换逻辑）──
  const handleEquipFromInventory = useCallback((item: GameItem) => {
    if (item.type === 'weapon' || item.type === 'armor' || item.type === 'trinket') {
      handleUseItem(item);
      return;
    }
    handleUseItem(item);
  }, [handleUseItem]);

  // ── v4.1.0: 技能树习得回调 — 持久化到 state，并同步 AI 上下文 ──
  const handleLearnSkill = useCallback((skillName: string) => {
    setLearnedSkillNames((prev) => {
      if (prev.includes(skillName)) return prev;
      const next = [...prev, skillName];
      setMessages((msgs) => [...msgs, {
        id: `sys-skill-${Date.now()}`,
        role: 'system',
        content: `🌟 你习得了新技能「${skillName}」！`,
        timestamp: Date.now(),
      }]);
      return next;
    });
  }, []);

  // ── v4.1.0: Map travel handler — 点击后立即发送 AI 区域切换指令 ──
  const handleTravel = useCallback((regionId: string) => {
    const current = gameStateRef.current;
    const region = current.regions.find((r) => r.id === regionId);
    if (!region) return;

    const updatedRegions = current.regions.map((r) => ({
      ...r,
      discovered: r.id === regionId ? true : r.discovered,
    }));

    setGameState({
      ...current,
      currentLocation: regionId,
      currentLocationDescription: `你来到了${region.name}。`,
      regions: updatedRegions,
    });
    gameStateRef.current = {
      ...current,
      currentLocation: regionId,
      currentLocationDescription: `你来到了${region.name}。`,
      regions: updatedRegions,
    };

    setStatusText(`前往 ${region.name}`);

    // v4.1.0: 添加系统消息 + 自动发送 AI 指令
    const travelMsg: ChatMessage = {
      id: `sys-travel-${Date.now()}`,
      role: 'system',
      content: `🚶 你前往了 ${region.name}。`,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, travelMsg]);

    // 主动面板关闭 + 发送 AI 指令（v4.2.2 R3: 统一走 dispatchAction）
    const actionText = `我前往了${region.name}`;
    dispatchAction(actionText);
  }, [dispatchAction]);

  // ── v4.1.0: Territory handlers（领地经营，world-setting 八）──
  /** 升级设施：扣资源 + 提升等级 + 通知 AI */
  const handleTerritoryUpgrade = useCallback((facilityId: FacilityId) => {
    setTerritory((prev) => {
      const cur = prev.facilities[facilityId] ?? 0;
      if (cur >= 3) return prev;
      const def = FACILITIES_DEF_LOOKUP[facilityId];
      const cost = def ? getUpgradeCost(def, cur) : null;
      if (!cost || !canAfford(prev.resources, cost)) return prev;
      const next: TerritoryState = {
        ...prev,
        facilities: { ...prev.facilities, [facilityId]: cur + 1 },
        resources: payCost(prev.resources, cost),
      };
      // 设施升级后防御值变化
      const oldDefense = calcDefense(prev);
      const newDefense = calcDefense(next);
      const defDelta = newDefense - oldDefense;
      setStatusText(`${def.name} 升至 ${cur + 1} 级`);
      const gainMsg: ChatMessage = {
        id: `sys-territory-${Date.now()}`,
        role: 'system',
        content: `🏗️ 你下令修缮了${def.name}（升至 ${cur + 1} 级）。${defDelta > 0 ? `要塞防御值 +${defDelta}。` : ''}（资源已扣除）`,
        timestamp: Date.now(),
      };
      setMessages((prevMsgs) => [...prevMsgs, gainMsg]);
      dispatchAction(`我下令升级了要塞的${def.name}，目前等级 ${cur + 1}/3。请描述施工过程与要塞的新气象。`);
      return next;
    });
  }, [dispatchAction]);

  /** 战略桌投入：扣除资源 + 进度 +25% */
  const handleTerritoryStrategy = useCallback((projectId: string) => {
    setTerritory((prev) => {
      const project = STRATEGY_PROJECTS_LOOKUP[projectId];
      if (!project) return prev;
      const progress = prev.strategyProjects[projectId] ?? 0;
      if (progress >= 100) return prev;
      if (!canAfford(prev.resources, project.cost)) return prev;
      const newProgress = Math.min(100, progress + 25);
      const next: TerritoryState = {
        ...prev,
        resources: payCost(prev.resources, project.cost),
        strategyProjects: { ...prev.strategyProjects, [projectId]: newProgress },
      };
      const done = newProgress >= 100;
      const msg: ChatMessage = {
        id: `sys-strategy-${Date.now()}`,
        role: 'system',
        content: done
          ? `📜 战略项目「${project.name}」完成！${project.reward.replace('完成：', '获得效果：')}`
          : `📜 你向战略项目「${project.name}」投入了资源（进度 ${newProgress}%）。`,
        timestamp: Date.now(),
      };
      setMessages((prevMsgs) => [...prevMsgs, msg]);
      setStatusText(done ? `战略项目「${project.name}」完成` : `「${project.name}」进度 ${newProgress}%`);
      dispatchAction(done
        ? `我完成了要塞战略项目「${project.name}」。${project.reward} 请描述这项工程如何改变要塞。`
        : `我继续推进要塞战略项目「${project.name}」（进度 ${newProgress}%）。`);
      return next;
    });
  }, [dispatchAction]);

  /** 休整一日：恢复 HP + 推进天数与围城战倒计时 */
  const handleTerritoryRest = useCallback(() => {
    const day = dayCount + 1;
    setDayCount(day);
    // v4.2.1 (P0-4): 税收/产出结算（每次休整）
    const tax = collectTax(territoryRef.current);
    const workshopOut = collectWorkshopOutput(territoryRef.current);
    const resourceGains: string[] = [];
    if (tax > 0) resourceGains.push(`税收 +${tax} 金币`);
    if (workshopOut.iron) resourceGains.push(`工坊产出铁 +${workshopOut.iron}`);
    if (resourceGains.length > 0) {
      setWallet((prev) => {
        // v4.2.2 (R1 修复): tax 语义为「金币」，×100 转铜币入账；v4.2.3 走 goldToCopper 共用
        const tc = walletToCopper(prev) + goldToCopper(tax);
        return { ...copperToWallet(tc), shard: prev.shard };
      });
      setGold((g) => g + tax);
      setTerritory((prev) => ({
        ...prev,
        resources: {
          ...prev.resources,
          iron: prev.resources.iron + (workshopOut.iron ?? 0),
        },
      }));
      setMessages((prevMsgs) => [...prevMsgs, {
        id: `sys-tax-${Date.now()}`,
        role: 'system',
        content: `🏛️ 领地结算：${resourceGains.join('、')}。`,
        timestamp: Date.now(),
      }]);
    }
    setTerritory((prev) => {
      const countdown = Math.max(0, prev.siegeCountdown - 1);
      const next: TerritoryState = { ...prev, siegeCountdown: countdown };
      if (countdown <= 0) {
        // v4.2.1 (P0-4): 围城战接入 resolveSiege — 失败 = 资源损失 + 设施降级 + 防御重算
        const attackPower = 40 + Math.floor(Math.random() * 80); // 40~119（按防御曲线重做）
        const siege = resolveSiege(prev, attackPower);
        const nextSiegeCountdown = 45 + Math.floor(Math.random() * 20); // 45~64 天后下次围城
        const lossesText = Object.entries(siege.losses)
          .filter(([, v]) => v > 0)
          .map(([rid, v]) => `${rid} -${v}`)
          .join('、');
        let nextState: TerritoryState = {
          ...next,
          resources: payCost(next.resources, siege.losses as Partial<Record<ResourceId, number>>),
          siegeCountdown: nextSiegeCountdown,
          // v4.2.2 (R4 修复): 失败不计入 siegesSurvived（此前"没挺过却计数"污染结局统计）
          siegesSurvived: prev.siegesSurvived + (siege.survived ? 1 : 0),
        };
        // 失败时设施降级 + 防御重算
        if (!siege.survived && siege.downgraded) {
          const facName = FACILITIES_DEF_LOOKUP[siege.downgraded]?.name ?? siege.downgraded;
          nextState = {
            ...nextState,
            facilities: {
              ...nextState.facilities,
              [siege.downgraded]: Math.max(0, (nextState.facilities[siege.downgraded] ?? 1) - 1),
            },
          };
          const msg: ChatMessage = {
            id: `sys-siege-fail-${Date.now()}`,
            role: 'system',
            content: `💥 第 ${day} 天，敌军攻势 ${siege.attackPower} 击穿防御 ${siege.defense}！要塞惨败：${lossesText}，${facName} 被摧毁降级！下次围城 ${nextSiegeCountdown} 天后。`,
            timestamp: Date.now(),
          };
          setMessages((prevMsgs) => [...prevMsgs, msg]);
          dispatchAction(`第 ${day} 天要塞被攻破！防御 ${siege.defense} 不敌攻势 ${siege.attackPower}，损失惨重，${facName} 降级。请描述这场惨败与要塞的重创。`);
          return nextState;
        }
        const msg: ChatMessage = {
          id: `sys-siege-${Date.now()}`,
          role: 'system',
          content: siege.survived
            ? `⚔️ 第 ${day} 天，敌军兵临城下（攻势 ${siege.attackPower}）！依托 ${siege.defense} 点防御值，要塞守住了。${lossesText ? `损耗：${lossesText}。` : ''}你挺过了第 ${prev.siegesSurvived + 1} 次围城。`
            : `⚠️ 第 ${day} 天，敌军攻势 ${siege.attackPower} 攻破防御 ${siege.defense}！要塞付出惨重代价：${lossesText}。`,
          timestamp: Date.now(),
        };
        setMessages((prevMsgs) => [...prevMsgs, msg]);
        dispatchAction(siege.survived
          ? `第 ${day} 天敌军围城（攻势 ${siege.attackPower}），我们凭借 ${siege.defense} 点防御坚守住了。请详细描述这场围城战。`
          : `第 ${day} 天敌军围城（攻势 ${siege.attackPower}），防御 ${siege.defense} 险些失守。请描述这场惨烈的守城战与伤亡。`);
        return nextState;
      }
      return next;
    });
    setStatusText(`休整一日（第 ${day} 天）`);
  }, [dayCount, dispatchAction]);

  // ── v4.0.0: Market buy/sell handlers ──
  const handleMarketBuy = useCallback((libItem: LibraryItem) => {
    setWallet((prev) => {
      const price = calculateBuyPrice(libItem.basePrice, libItem.rarity, gameStateRef.current.currentLocation, libItem.id);
      const totalCopper = walletToCopper(prev);
      if (price > totalCopper) return prev; // cannot afford
      const newWallet = copperToWallet(totalCopper - price);
      const result: Wallet = { ...newWallet, shard: prev.shard };
      return result;
    });
    // Add item to inventory
    const newItem: GameItem = {
      id: libItem.id,
      name: libItem.name,
      emoji: libItem.emoji,
      type: libItem.type as GameItem['type'],
      description: libItem.desc,
      rarity: libItem.rarity as GameItem['rarity'],
      quantity: 1,
      effect: libItem.effect,
      stats: libItem.stats,
      equippable: libItem.equippable,
      stackable: libItem.stackable,
      basePrice: libItem.basePrice,
    };
    setGameState((prev) => {
      const existing = prev.items.find(i => i.id === libItem.id && i.stackable);
      if (existing) {
        return { ...prev, items: prev.items.map(i => i.id === libItem.id ? { ...i, quantity: (i.quantity ?? 1) + 1 } : i) };
      }
      return { ...prev, items: [...prev.items, newItem] };
    });
    // v4.2.1 (P0-5): 买卖接入动态定价 — 买入 ↑需求 ↓供给，后续价格会上浮
    updateSupplyDemand(libItem.id, -1, 1);
    setStatusText(`购买了 ${libItem.emoji} ${libItem.name}`);
  }, []);

  const handleMarketSell = useCallback((item: GameItem) => {
    const libItem = ITEMS_LIBRARY.find(li => li.id === item.id || li.name === item.name);
    const buyPrice = libItem
      ? calculateBuyPrice(libItem.basePrice, item.rarity ?? libItem.rarity, gameStateRef.current.currentLocation, item.id)
      : 5;
    const sellPrice = calculateSellPrice(buyPrice, item.id);
    setWallet((prev) => {
      const totalCopper = walletToCopper(prev);
      const newWallet = copperToWallet(totalCopper + sellPrice);
      return { ...newWallet, shard: prev.shard };
    });
    // Remove item from inventory
    setGameState((prev) => {
      if ((item.quantity ?? 1) > 1) {
        return { ...prev, items: prev.items.map(i => i.id === item.id ? { ...i, quantity: (i.quantity ?? 1) - 1 } : i) };
      }
      return { ...prev, items: prev.items.filter(i => i.id !== item.id) };
    });
    // v4.2.1 (P0-5): 卖出 ↑供给 ↓需求，后续回收价走低
    updateSupplyDemand(item.id, 1, -1);
    setStatusText(`出售了 ${item.emoji} ${item.name} (${formatPrice(sellPrice)})`);
  }, []);

  // ── Keyboard handler ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // ── Save/Load handlers v0.6.0 ──
  const handleSaveSlot = useCallback(
    (slotIndex: number): SaveSlotMeta => {
      const now = new Date();
      const slotMeta: SaveSlotMeta = {
        slotIndex,
        label: `存档 ${slotIndex + 1}`,
        savedAt: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        worldName: fullSetting?.worldMeta?.name ?? '未知世界',
        playerName: characterData?.name ?? '冒险者',
        playTime: `${Math.floor((Date.now() - sessionStartRef.current) / 60000)}m`,
        messageCount: messages.length,
        isEmpty: false,
      };

      // 保存存档数据
      try {
        const saveData = {
          messages,
          gameState: gameStateRef.current,
          characterData,
          fullSetting,
          phase,
          savedAt: now.toISOString(),
        // v1.0.0: Extended save data
        combatEntries,
        // v4.1.0: 连击数以 ref 为准（消除重复 state）
        comboCount: combatComboRef.current,
        equipmentList,
        dayCount,
        enemiesDefeated,
        gold,
        timesSaved,
        mainQuestCompleted,
        relationships,
        wallet,
        currentCorruption,
        // v4.1.0: 阵营声望与结局追踪
        factionReputations: gameStateRef.current.factionReputations,
        endingFlags: gameStateRef.current.endingFlags,
        // v4.1.0: 艾拉登场标记
        ailaRescued,
        // v4.1.0: 领地经营
        territory,
        // v4.1.0: 当前结局
        currentEnding,
        // v4.1.0: 技能树状态
        learnedSkillNames,
        skillPointBalance,
        // v4.1.0: 装备槽位
        equipmentSlots,
        // v4.1.0: 世界书
        worldBookEntries,
        // v4.2.3 (R7): 堕落历史峰值持久化（艾拉事件窗口判断依据，随存档走）
        maxCorruptionEver: maxCorruptionEverRef.current,
      };
        localStorage.setItem(`ai-narrator-save-slot-${slotIndex}`, JSON.stringify(saveData));
        localStorage.setItem(`ai-narrator-slot-meta-${slotIndex}`, JSON.stringify(slotMeta));
      } catch (err) {
        console.error('[SaveLoad] 存档失败:', err);
      }

      setTimesSaved(prev => prev + 1);

      return slotMeta;
    },
    [messages, characterData, fullSetting, phase, territory, currentEnding, learnedSkillNames, skillPointBalance, equipmentSlots, worldBookEntries]
  );

  const handleLoadSlot = useCallback(
    (slotIndex: number) => {
      try {
        const raw = localStorage.getItem(`ai-narrator-save-slot-${slotIndex}`);
        if (!raw) return;
        const saveData = JSON.parse(raw) as Record<string, unknown>;

        // v4.2.1 (P2-5): Zod 校验存档结构 — 损坏存档走全新开局，避免半恢复状态
        if (!saveData || typeof saveData !== 'object' || !saveData.characterData || !Array.isArray(saveData.messages)) {
          setMessages((prev) => [...prev, {
            id: `sys-load-fail-${Date.now()}`,
            role: 'system',
            content: '⚠️ 存档已损坏或版本不兼容，无法读取。请开启新的冒险。',
            timestamp: Date.now(),
          }]);
          return;
        }
        // gameState 深度校验（容错：校验失败则用默认值重建）
        let restoredGameState: GameState | null = null;
        if (saveData.gameState) {
          try {
            const gsRaw = JSON.stringify(saveData.gameState);
            const parsed = safeParseGameState(gsRaw);
            if (parsed.ok || parsed.partial) {
              // v4.2.1: 以原始存档为主，校验结果仅作为结构兜底
              restoredGameState = {
                ...getDefaultGameState(fullSetting?.worldMeta?.name ?? '', fullSetting?.themeData),
                ...(saveData.gameState as GameState),
              };
            }
          } catch {
            // 校验失败则重建默认
          }
        }

        if (saveData.messages) setMessages(saveData.messages as ChatMessage[]);
        if (restoredGameState) {
          setGameState(restoredGameState);
          gameStateRef.current = restoredGameState;
        } else if (saveData.gameState) {
          setGameState(saveData.gameState as GameState);
          gameStateRef.current = saveData.gameState as GameState;
        }
        if (saveData.characterData) setCharacterData(saveData.characterData as CharacterData);
        if (saveData.phase) setPhase(saveData.phase as GamePhase);
        // v1.0.0: Restore extended state
        if (saveData.combatEntries) setCombatEntries(saveData.combatEntries as CombatLogEntry[]);
        if (saveData.comboCount) combatComboRef.current = saveData.comboCount as number;
        if (saveData.equipmentList) setEquipmentList(saveData.equipmentList as Equipment[]);
        if (saveData.dayCount) setDayCount(saveData.dayCount as number);
        if (saveData.enemiesDefeated) setEnemiesDefeated(saveData.enemiesDefeated as number);
        if (saveData.gold) setGold(saveData.gold as number);
        if (saveData.timesSaved !== undefined) setTimesSaved(saveData.timesSaved as number);
        if (saveData.mainQuestCompleted) setMainQuestCompleted(saveData.mainQuestCompleted as boolean);
        if (Array.isArray(saveData.relationships) && saveData.relationships.length > 0) setRelationships(saveData.relationships as CompanionRelationship[]);
        if (saveData.wallet) setWallet(saveData.wallet as Wallet);
        if (typeof saveData.currentCorruption === 'number') setCurrentCorruption(saveData.currentCorruption);
        if (typeof saveData.ailaRescued === 'boolean') setAilaRescued(saveData.ailaRescued);
        // v4.2.3 (R7 修复): 读档恢复堕落历史峰值 — 存档优先，其次以当前堕落兜底。
        // 否则读档后 maxEver=0 永远追不上当前值，艾拉事件窗口永久错过。
        const restoredMaxEver = typeof saveData.maxCorruptionEver === 'number'
          ? saveData.maxCorruptionEver
          : (typeof saveData.currentCorruption === 'number' ? saveData.currentCorruption : 0);
        maxCorruptionEverRef.current = Math.max(maxCorruptionEverRef.current, restoredMaxEver);
        // v4.1.0: 领地经营恢复（容错合并默认值）
        if (saveData.territory) {
          const base = createInitialTerritory();
          setTerritory({ ...base, ...(saveData.territory as TerritoryState) });
        }
        // v4.1.0: 结局恢复（从 ID 还原完整定义）
        if (saveData.currentEnding) {
          const found = ENDINGS.find((e) => e.id === (saveData.currentEnding as EndingDef).id);
          if (found) setCurrentEnding(found);
        }
        // v4.1.0: 技能树恢复
        if (Array.isArray(saveData.learnedSkillNames)) setLearnedSkillNames(saveData.learnedSkillNames as string[]);
        if (typeof saveData.skillPointBalance === 'number') setSkillPointBalance(saveData.skillPointBalance);
        // v4.1.0: 装备槽位恢复
        if (saveData.equipmentSlots && typeof saveData.equipmentSlots === 'object') setEquipmentSlots(saveData.equipmentSlots as Record<string, GameItem | null>);
        // v4.1.0: 世界书恢复
        if (Array.isArray(saveData.worldBookEntries)) setWorldBookEntries(saveData.worldBookEntries);
        setShowSaveLoad(false);
        setStatusText('存档已加载');
      } catch (err) {
        console.error('[SaveLoad] 加载失败:', err);
        setStatusText('加载存档失败');
      }
    },
    []
  );

  const handleDeleteSlot = useCallback((slotIndex: number) => {
    try {
      localStorage.removeItem(`ai-narrator-save-slot-${slotIndex}`);
      localStorage.removeItem(`ai-narrator-slot-meta-${slotIndex}`);
    } catch (err) {
      console.error('[SaveLoad] 删除失败:', err);
    }
  }, []);

  // ── v4.2.1 (P2-4): beforeunload 紧急存档 — 页面关闭/刷新自动保存到槽 5（紧急槽位）──
  useEffect(() => {
    if (phase !== 'playing' || !characterData) return;
    const emergencySave = () => {
      try {
        const slotIndex = 5; // 紧急存档槽
        const now = new Date();
        const meta = {
          slotIndex,
          label: '紧急存档',
          savedAt: now.toISOString(),
          worldName: fullSetting?.worldMeta?.name ?? '未知世界',
          playerName: characterData?.name ?? '冒险者',
          isEmpty: false,
        };
        const data = {
          messages,
          gameState: gameStateRef.current,
          characterData,
          fullSetting,
          phase,
          savedAt: now.toISOString(),
          combatEntries,
          comboCount: combatComboRef.current,
          equipmentList,
          dayCount,
          enemiesDefeated,
          gold,
          timesSaved,
          mainQuestCompleted,
          relationships,
          wallet,
          currentCorruption,
          factionReputations: gameStateRef.current.factionReputations,
          endingFlags: gameStateRef.current.endingFlags,
          ailaRescued,
          territory,
          currentEnding,
          learnedSkillNames,
          skillPointBalance,
          equipmentSlots,
          worldBookEntries,
          // v4.2.3 (R7): 紧急存档同样持久化堕落峰值
          maxCorruptionEver: maxCorruptionEverRef.current,
        };
        localStorage.setItem(`ai-narrator-save-slot-${slotIndex}`, JSON.stringify(data));
        localStorage.setItem(`ai-narrator-slot-meta-${slotIndex}`, JSON.stringify(meta));
      } catch {
        // 紧急存档失败静默（不阻塞卸载）
      }
    };
    window.addEventListener('beforeunload', emergencySave);
    window.addEventListener('pagehide', emergencySave);
    return () => {
      window.removeEventListener('beforeunload', emergencySave);
      window.removeEventListener('pagehide', emergencySave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, characterData, messages, dayCount, gold, currentCorruption, ailaRescued, territory, learnedSkillNames, skillPointBalance, equipmentSlots, worldBookEntries]);

  // ── Dialog export handler v0.6.0 ──
  const handleExportDialogue = useCallback(() => {
    const exportMsgs: ExportableMessage[] = messages.map((m) => ({
      role: m.role === 'user' ? 'player' : m.role === 'assistant' ? 'narrator' : 'system',
      speakerName: m.role === 'user' ? characterData?.name : fullSetting?.worldMeta?.name,
      content: m.content,
      timestamp: m.timestamp,
    }));

    exportDialogueHistory(exportMsgs, {
      worldName: fullSetting?.worldMeta?.name ?? '游戏对话',
      playerName: characterData?.name ?? '冒险者',
      format: 'markdown',
    });
  }, [messages, characterData, fullSetting]);

  // ============================================================
  // Render: No game setting
  // ============================================================

  if (!fullSetting) {
    return (
      <div style={S.container}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
          加载中，请稍候…
        </div>
      </div>
    );
  }

  // ============================================================
  // Render: Narrator phase
  // ============================================================

  if (phase === 'narrator') {
    return (
      <div style={S.container}>
        <header style={S.header}>
          <Link href="/" style={S.backLink}>
            ← 返回
          </Link>
          <h1 style={S.title}>🦊 AI Narrator Game</h1>
        </header>
        <NarratorIntro
          worldName={fullSetting.worldMeta.name}
          worldGenre={fullSetting.worldMeta.genre}
          worldTone={fullSetting.worldMeta.tone}
          worldDescription={fullSetting.worldMeta.description}
          startingNarrative={fullSetting.startingLocation?.openingNarrative}
          onContinue={handleNarratorContinue}
          generateWithAI={false}
        />
      </div>
    );
  }

  // ============================================================
  // Render: Character creation phase
  // ============================================================

  if (phase === 'character') {
    const playerOptions = fullSetting.playerOptions;
    const hasClasses = playerOptions && playerOptions.availableClasses && playerOptions.availableClasses.length > 0;
    const attrNames = playerOptions?.attributeNames ?? ['strength', 'agility', 'intelligence', 'constitution', 'charisma'];
    const am = deriveAttrMeta(fullSetting?.themeData);

    return (
      <div style={S.container}>
        <header style={S.header}>
          <Link href="/" style={S.backLink}>
            ← 返回
          </Link>
          <h1 style={S.title}>🦊 AI Narrator Game</h1>
        </header>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <CharacterCreation
            availableClasses={playerOptions?.availableClasses ?? []}
            attributeNames={attrNames}
            totalPoints={playerOptions?.totalAttributePoints ?? 28}
            attrLabels={am.attrLabels}
            attrDescs={am.attrDescs}
            attrDetails={FROSTHOLD_ATTR_DETAILS}
            professions={PROFESSIONS}
            originDefs={ORIGINS}
            backgrounds={fullSetting?.themeData?.backgrounds?.map((b) => ({ id: b.id ?? b.name ?? 'bg', name: b.name ?? '未知背景', description: b.description, effects: b.effects }))}
            onConfirm={handleCharacterConfirm}
          />
        </div>
      </div>
    );
  }

  // Render: Playing (chat)
  const sidebarAttrs = characterData?.attributes ?? {};
  return (
    <ErrorBoundaryWithRetry compact>
      {/* v4.2.0: 移动端整体适配 — 触控目标放大、文本可读、布局紧凑 */}
      <style>{`
        @media (max-width: 900px) {
          input[type="text"], button { min-height: 44px; }
          button { touch-action: manipulation; }
        }
        @media (max-width: 480px) {
          .hide-xs { display: none !important; }
        }
      `}</style>
      <QuickSettingsPanel hidden={activePanel !== null} onChange={setQuickSettings} />

      {/* v5.1.0 (移动端): 顶栏「⋯ 更多」菜单 — 收纳 📰快讯/⚔️日志/📤导出/💾存档/状态（z45：>底栏40 <面板100） */}
      {isMobile && moreOpen && (
        <>
          <div
            style={{ position:'fixed', inset:0, zIndex:44, background:'rgba(0,0,0,0.35)' }}
            onClick={() => setMoreOpen(false)}
            aria-hidden
          />
          <div
            style={{
              position:'fixed', top:'calc(48px + 0.5rem)', left:8, right:8, zIndex:45,
              background:'rgba(13,13,18,0.96)', border:'1px solid rgba(201,169,78,0.25)',
              borderRadius:12, padding:'0.5rem', display:'flex', flexDirection:'column', gap:'0.375rem',
              boxShadow:'0 8px 32px rgba(0,0,0,0.55)',
            }}
            role="menu"
            aria-label="更多功能"
          >
            {[
              { emoji:'📰', label:'大陆快讯', action: () => { setSidebarOpen(true); setMoreOpen(false); } },
              { emoji:'⚔️', label:'战斗日志', action: () => { setShowCombatLog((v) => !v); setMoreOpen(false); } },
              { emoji:'📤', label:'导出对话', action: () => { handleExportDialogue(); setMoreOpen(false); } },
              { emoji:'💾', label:'存档 / 读档', action: () => { setShowSaveLoad(true); setMoreOpen(false); } },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                role="menuitem"
                style={{
                  display:'flex', alignItems:'center', gap:'0.625rem',
                  minHeight:48, padding:'0 0.875rem', borderRadius:8,
                  background:'rgba(42,37,34,0.8)', border:'1px solid rgba(201,169,78,0.15)',
                  color:'#E8E0D5', fontSize:'0.9375rem', cursor:'pointer',
                }}
              >
                <span style={{ fontSize:'1.125rem' }}>{item.emoji}</span>
                {item.label}
              </button>
            ))}
            <div style={{ padding:'0.25rem 0.875rem', display:'flex', justifyContent:'center' }}>
              <StatusDotInline loading={isLoading} ok={!!apiKey} text={statusText} />
            </div>
          </div>
        </>
      )}

      <GameLayout
        topBar={<>
          <Link href="/" style={{ color:'#A09888', textDecoration:'none', fontSize:'0.8125rem', marginRight:'0.75rem', whiteSpace:'nowrap' }}>← 返回</Link>
          <span style={{ fontFamily:"'Cinzel','Georgia',serif", fontSize:'0.9375rem', fontWeight:700, color:'#C9A94E', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{fullSetting.worldMeta.name}</span>
          {characterData && <span className="hide-xs" style={{ fontSize:'0.6875rem', color:'#6B6258', marginLeft:'0.5rem' }}>| {characterData.name}</span>}
          {/* v5.1.0 (移动端): 钱包截断防挤爆顶栏 */}
          <span style={{ fontSize:'0.75rem', color:'#C9A94E', fontWeight:700, marginLeft:'0.75rem', whiteSpace:'nowrap', ...(isMobile ? { maxWidth:'7rem', overflow:'hidden', textOverflow:'ellipsis' } : {}) }}>
            🪙{wallet.gold} <span style={{ color:'#B0B8C8', fontSize:'0.6875rem' }}>S{wallet.silver}</span> <span style={{ color:'#C8966C', fontSize:'0.6875rem' }}>C{wallet.copper}</span>
            {wallet.shard > 0 && <span style={{ color:'#A864C0', fontSize:'0.6875rem' }}> 💎{wallet.shard}</span>}
          </span>
          {/* v5.1.0 (移动端): 4 按钮 + 状态点收进「⋯ 更多」菜单；桌面端保留原位 */}
          {isMobile ? (
            <button
              onClick={() => setMoreOpen((v) => !v)}
              title="更多"
              aria-label="更多功能"
              style={{
                marginLeft:'auto', minWidth:44, minHeight:44, padding:'0 10px',
                background:'rgba(26,24,28,0.9)', border:'1px solid rgba(201,169,78,0.2)',
                borderRadius:8, color:'#C9A94E', fontSize:'1.125rem', cursor:'pointer',
              }}
            >
              ⋯
            </button>
          ) : (
            <div style={{ marginLeft:'auto', display:'flex', gap:'0.375rem', alignItems:'center' }}>
              <button onClick={()=>setSidebarOpen(prev=>!prev)} title="大陆快讯" style={{ background:'rgba(26,24,28,0.9)',border:'1px solid rgba(201,169,78,0.2)',borderRadius:4,color:'#C9A94E',padding:'2px 8px',fontSize:'0.75rem',cursor:'pointer' }}>📰</button>
              <button onClick={()=>setShowCombatLog(prev=>!prev)} title="战斗日志" style={{ background:'rgba(26,24,28,0.9)',border:'1px solid rgba(201,169,78,0.2)',borderRadius:4,color:'#C9A94E',padding:'2px 8px',fontSize:'0.75rem',cursor:'pointer' }}>⚔️</button>
              <button onClick={handleExportDialogue} title="导出" style={{ background:'rgba(26,24,28,0.9)',border:'1px solid rgba(201,169,78,0.2)',borderRadius:4,color:'#C9A94E',padding:'2px 8px',fontSize:'0.75rem',cursor:'pointer' }}>📤</button>
              <button onClick={()=>setShowSaveLoad(true)} title="存档" style={{ background:'rgba(26,24,28,0.9)',border:'1px solid rgba(201,169,78,0.2)',borderRadius:4,color:'#C9A94E',padding:'2px 8px',fontSize:'0.75rem',cursor:'pointer' }}>💾</button>
              <StatusDotInline loading={isLoading} ok={!!apiKey} text={statusText} />
            </div>
          )}
        </>}
        sidebar={<NewsFeed
          items={newsFeed}
          characterName={characterData?.name || '无名领主'}
          characterClass={characterData?.className}
          level={1}
          worldName={fullSetting.worldMeta.name}
          onMarkRead={handleMarkNewsRead}
          onToggleSidebar={() => setSidebarOpen(false)}
        />}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        bottomBar={<GamePanelBar activePanel={activePanel} onToggle={handlePanelToggle} />}
      >
        {/* v5.1.0 (移动端): 消息区 padding 收窄（1rem 1.25rem → 0.75rem 0.875rem）省纵向 */}
        <div style={{ flex:1,overflowY:'auto',padding: isMobile ? '0.75rem 0.875rem' : '1rem 1.25rem',display:'flex',flexDirection:'column',gap:'0.625rem' }} role="log">
          {messages.map(m => (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column' }}>
              {/* v5.1.0 技术美术：主叙事流场景图 — 场景描述类消息自动配 SVG 分层插画（对话消息天然不命中不显示） */}
              {m.role === 'assistant' && sceneMatches(m.content) && (
                <SceneImage scene={m.content} visible size={isMobile ? 'sm' : 'md'} placement="banner" />
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
                <MessageBubbleLayout role={m.role} content={m.content} />
                {m.role === 'assistant' && <TTSButton text={m.content} size="sm" />}
              </div>
            </div>
          ))}
          {isLoading&&<div style={{display:'flex',gap:'0.375rem',padding:'0.5rem 0',alignSelf:'flex-start'}}>{[0,0.2,0.4].map((d,i)=><span key={i} style={{width:7,height:7,borderRadius:'50%',background:'#6B6258',animation:'ai-dot-pulse 1.5s ease-in-out infinite',animationDelay:`${d}s`}}/>)}</div>}
          <div ref={messagesEndRef}/>
        </div>
        {dialogueOptions.length > 0 && characterData && (
          <div style={{ padding: '0.375rem 0.875rem', background: '#1A181C', borderTop: '1px solid #2A272C', maxHeight: isMobile ? '40vh' : '34vh', overflowY: 'auto' }}>
            {/* v5.1.0 (移动端): 选项区折叠开关 — 次要内容可收纳，优先让位给消息/输入 */}
            {isMobile && (
              <button
                type="button"
                onClick={() => setOptionsCollapsed((v) => !v)}
                style={{
                  width: '100%', minHeight: 40, border: 'none', background: 'transparent',
                  color: '#6B6258', fontSize: '0.75rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                }}
              >
                {optionsCollapsed ? '▾ 展开行动选项' : '▴ 收起行动选项'}
              </button>
            )}
            {!optionsCollapsed && (
            /* v4.2.1 (P1-3): ��影低语独立区块 — 不混入普通选项，紫色描边强调 */
            <>{(() => {
              const whisperOpts = dialogueOptions.filter((o) => o.id.startsWith('whisper-'));
              const normalOpts = dialogueOptions.filter((o) => !o.id.startsWith('whisper-'));
              const handleSelect = (opt: DialogueOption) => {
                setDialogueOptions([]);
                // v4.1.0: 暗影低语特殊处理 — 立即施加代价
                if (opt.id.startsWith('whisper-')) {
                  const gain = 3 + Math.floor(Math.random() * 6); // 3~8
                  setCurrentCorruption((prev) => Math.min(100, prev + gain));
                  setMessages((prev) => [...prev, {
                    id: `sys-whisper-${Date.now()}`,
                    role: 'system',
                    content: `🌑 暗影低语回响在你的灵魂中。你获得了暗影之力，但代价已刻入你的灵魂——堕落值 +${gain}。`,
                    timestamp: Date.now(),
                  }]);
                }
                // v4.2.2 (R3): 统一走 dispatchAction（loading 中入队）
                dispatchAction(opt.text);
              };
              return (
                <>
                  {whisperOpts.length > 0 && (
                    <div style={{
                      marginBottom: '0.5rem', padding: '0.5rem 0.625rem',
                      borderRadius: 8, border: '1px solid rgba(168,100,192,0.5)',
                      background: 'rgba(168,100,192,0.08)',
                    }}>
                      <div style={{
                        fontSize: '0.6875rem', fontWeight: 700, color: '#A864C0',
                        marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem',
                      }}>
                        🌑 暗影低语
                        <span style={{
                          fontSize: '0.5625rem', color: '#A864C0', border: '1px solid #A864C044',
                          borderRadius: 4, padding: '0 4px', fontWeight: 400,
                        }}>
                          冷却 {whisperCooldownRef.current} 轮
                        </span>
                      </div>
                      {whisperOpts.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelect(opt)}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left',
                            padding: '0.5rem 0.75rem', borderRadius: 6,
                            border: '1px solid rgba(168,100,192,0.35)', background: 'rgba(168,100,192,0.1)',
                            color: '#D9B8E8', fontSize: '0.8125rem', cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {opt.emoji} {opt.text}
                          {opt.hint && <span style={{ display: 'block', fontSize: '0.625rem', color: '#8A7A98', marginTop: '0.25rem' }}>{opt.hint}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {normalOpts.length > 0 && (
                    <DialogueOptions
                      options={normalOpts}
                      attributes={characterData.attributes}
                      skills={[]}
                      inventoryIds={new Set(gameState.items.map(i => i.id))}
                      gold={gold}
                      corruption={currentCorruption}
                      onSelect={handleSelect}
                    />
                  )}
                </>
              );
            })()}</>)}
          </div>
        )}
        {/* v5.1.0 (移动端): 输入区 — FAB 让位 64px + iOS 底部安全区 */}
        <div style={{display:'flex',gap:'0.5rem',padding: isMobile ? '0.625rem 0.875rem' : '0.625rem 1.25rem',paddingRight: isMobile ? 'calc(0.875rem + 64px)' : undefined,paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : undefined,background:'#1A181C',borderTop:'1px solid #2A272C'}}>
          <input ref={inputRef} type="text" value={input} onChange={(e)=>{ if (autoContinueTimerRef.current) { window.clearTimeout(autoContinueTimerRef.current); autoContinueTimerRef.current = null; } setInput(e.target.value); }} onKeyDown={handleKeyDown} placeholder="输入你的行动..." disabled={isLoading} maxLength={1000} style={{flex:1,minHeight:44,padding:'0.5rem 0.875rem',borderRadius:6,border:'1px solid #2A272C',background:'#211F24',color:'#E8E0D5',fontSize:'0.875rem',outline:'none'}}/>
          <button data-send-btn onClick={handleSend} disabled={isLoading||!input.trim()} style={{minHeight:44,padding:'0.5rem 1.25rem',borderRadius:6,border:'none',background:isLoading||!input.trim()?'#2A272C':'#C9A94E',color:isLoading||!input.trim()?'#6B6258':'#0A0A0F',fontWeight:700,fontSize:'0.8125rem',cursor:isLoading||!input.trim()?'not-allowed':'pointer'}}>发送</button>
        </div>
      </GameLayout>
      {activePanel&&characterData&&(() => { const am = deriveAttrMeta(fullSetting?.themeData); const tm = deriveThemeMeta(fullSetting?.themeData, fullSetting.worldMeta.name); const achProgress = getAchievementProgress(); const factionProps = (fullSetting?.themeData?.factions ?? []).map((f) => ({ id: f.id ?? f.name ?? 'faction', name: f.name ?? '未知阵营', description: f.description, reputation: f.reputation })); return <PanelContainer activePanel={activePanel} characterName={characterData.name} characterClass={characterData.className} characterAttributes={characterData.attributes} gameState={gameState} onClose={()=>setActivePanel(null)} onUseItem={handleUseItem} onTravel={handleTravel} unlockedRegions={gameState.regions.filter(r=>r.discovered).map(r=>r.id)} themeCategories={fullSetting?.themeData?.skillCategories} attrLabels={am.attrLabels} attrDescs={am.attrDescs} hpAttr={tm.hpAttr} mpAttr={tm.mpAttr} mapTitle={tm.mapTitle} achievements={achievementList.length > 0 ? achievementList : getAchievements()} achievementProgress={achProgress} origin={characterData.originName} background={characterData.backgroundName} factions={factionProps} gold={gold} relationships={relationships} wallet={wallet} onBuy={handleMarketBuy} onSell={handleMarketSell} currentLocation={gameState.currentLocation} profession={characterData.professionName} mechanics={classMechanics} currentSituation={currentSituation} injuries={playerInjuries} equipmentSlots={equipmentSlots} corruption={currentCorruption} factionReputations={gameState.factionReputations} territory={territory} onTerritoryUpgrade={handleTerritoryUpgrade} onTerritoryStrategy={handleTerritoryStrategy} onTerritoryRest={handleTerritoryRest} dayCount={dayCount} learnedSkillNames={learnedSkillNames} skillPointBalance={skillPointBalance} onLearnSkill={handleLearnSkill} classStarterSkills={classStarterSkills} onEquipItem={handleEquipFromInventory} onUnequipItem={handleUnequip} worldBookEntries={worldBookEntries} onWorldBookChange={handleWorldBookChange} onEnterFacility={handleEnterFacility} inTown={gameState.currentLocation === '凛冬谷' || gameState.currentLocation === 'winter-glen' || gameState.currentLocation === 'region-0'} currentLocationName={gameState.currentLocation} onCraftItems={handleCraftItems} chainNodes={relationChain.nodes} onChainInteract={handleChainInteract} onChainAffinity={handleChainAffinity}/>; })()}
      {showSaveLoad&&<SaveLoadPanel onSave={handleSaveSlot} onLoad={handleLoadSlot} onDelete={handleDeleteSlot} onClose={()=>setShowSaveLoad(false)}/>}
      <AchievementToast achievement={achievementToast} onDismiss={() => setAchievementToast(null)} />
      {showCombatLog && <CombatLog entries={combatEntries} onClose={() => setShowCombatLog(false)} />}
      {diceCheck && <CheckDiceOverlay
        check={diceCheck}
        onClose={() => setDiceCheck(null)}
        onResult={(r) => {
          // v4.2.2 (R6 修复): 检定结果立即追加对话流（此前仅缓存等下轮注入，
          // 玩家掷骰后先做面板操作会导致 AI 续写脱离上下文）
          checkResultRef.current = r;
          const attrLabel = { strength: '力量', dexterity: '敏捷', constitution: '体质', intelligence: '智力', wisdom: '感知', charisma: '魅力' }[r.attr] ?? r.attr;
          setMessages((msgs) => [...msgs, {
            id: `sys-check-result-${Date.now()}`,
            role: 'system',
            content: `🎲 ${attrLabel}检定（D20 ${r.roll} + ${r.modifier} = ${r.total}，DC ${r.dc}）→ ${r.success ? '✅ 成功' : '❌ 失败'}。${r.success ? '你的行动达成预期。' : '检定失败，行动未达预期，代价随之而来。'}`,
            timestamp: Date.now(),
          }]);
          // v4.2.3 (O1 修复): 检定结果回传后自动触发 AI 续写后果（同一轮闭环）—
          // 此前 AI 只在下一次玩家对话时收到结果，玩家掷骰后不再输入则后果永不到来。
          // 等待骰子动画结束（约 3s）后自动发送续写指令；玩家手动输入则取消。
          if (autoContinueTimerRef.current) {
            window.clearTimeout(autoContinueTimerRef.current);
          }
          autoContinueTimerRef.current = window.setTimeout(() => {
            if (isLoadingRef.current) return; // AI 正在回复则跳过（下轮注入兜底）
            const verdict = r.success ? '成功' : '失败';
            dispatchAction(`（系统通知：请根据刚才的${attrLabel}检定结果——${verdict}——续写这一行动的实际后果，成功则达成，失败则让代价降临。不要重复判定。）`);
          }, 3200);
        }}
      />}
      {currentEnding && (
        <EndingOverlay
          ending={currentEnding}
          dayCount={dayCount}
          letterContext={{
            corruption: currentCorruption,
            endingFlags: gameStateRef.current.endingFlags ?? {},
            factionReputations: gameStateRef.current.factionReputations ?? {},
            defense: calcDefense(territoryRef.current),
            ailaCompleted: ailaRescued,
            siegesSurvived: territoryRef.current.siegesSurvived,
            mainQuestCompleted,
          }}
          onClose={() => setCurrentEnding(null)}
          onNewGame={() => { window.location.href = withBase('/'); }}
        />
      )}
    </ErrorBoundaryWithRetry>
  );
}

// ============================================================
// Helpers
// ============================================================

function StatusDotInline({ loading, ok, text }: { loading: boolean; ok: boolean; text: string }): React.ReactElement {
  const color = ok ? '#5A9E6F' : loading ? '#C9A94E' : '#E53E3E';
  return <span style={{ display:'inline-flex',alignItems:'center',fontSize:'0.6875rem',color:'#6B6258' }}>
    <span style={{ width:6,height:6,borderRadius:'50%',background:color,marginRight:4,flexShrink:0,animation:loading?'ai-dot-pulse 1.5s ease-in-out infinite':'none' }}/>
    {text}
  </span>;
}

/**
 * Merge incoming quests from AI with existing quests.
 * New quests are added. Existing quests with matching IDs get progress/status updated.
 */
function mergeQuests(existing: GameQuest[], incoming: GameQuest[]): GameQuest[] {
  const result = [...existing];
  for (const inc of incoming) {
    if (!inc.id) continue;
    const idx = result.findIndex((q) => q.id === inc.id);
    if (idx >= 0) {
      const prev = result[idx];
      if (!prev) continue;
      result[idx] = {
        ...prev,
        title: inc.title || prev.title,
        description: inc.description || prev.description,
        progress: Math.max(prev.progress, inc.progress),
        status: (prev.progress >= 100 || inc.progress >= 100) ? ('completed' as const) : ('active' as const),
      };
    } else {
      result.push(inc);
    }
  }
  return result;
}

/** v4.2.1 (P0-3): 检测主线任务是否完成 — 主线任务（type==='main'）被标记 completed 时返回 true */
function hasMainQuestCompleted(quests: GameQuest[]): boolean {
  return quests.some(
    (q) => q.type === 'main' && (q.status === 'completed' || q.progress >= 100)
  );
}

// v1.0.0: Detect enemy type from user input keywords
function detectEnemyType(input: string): string {
  const enemies: Record<string, string> = {
    '狼': '森林狼',
    '蛇': '毒蛇',
    '蜘蛛': '巨型蜘蛛',
    '怪物': '未知怪物',
    '巨龙': '巨龙',
    '强盗': '强盗',
    '亡灵': '亡灵',
    '骷髅': '骷髅兵',
    '巨人': '石巨人',
    '兽人': '兽人战士',
    '哥布林': '哥布林',
    '植物': '食人花',
    '元素': '元素精灵',
    '恶魔': '恶魔',
    '鬼': '幽灵',
    '守卫': '守卫',
  };

  for (const [key, name] of Object.entries(enemies)) {
    if (input.includes(key)) return name;
  }
  return '敌人';
}

// ============================================================
// Sub-components
// ============================================================

function MessageBubble({ message }: { message: ChatMessage }): React.ReactElement {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isNarrator = message.role === 'narrator';

  if (isNarrator) {
    return (
      <div style={S.narratorMsg}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-gold)', marginBottom: '0.5rem', fontStyle: 'normal' }}>
          📖 旁白
        </div>
        {message.content}
      </div>
    );
  }

  if (isSystem) {
    return (
      <div style={S.systemMsg}>
        {message.content}
      </div>
    );
  }

  return (
    <div
      style={{
        ...S.bubble,
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        background: isUser
          ? 'var(--accent-magic)'
          : 'var(--bg-panel-raised)',
        borderBottomRightRadius: isUser ? 4 : 16,
        borderBottomLeftRadius: isUser ? 16 : 4,
      }}
      role="article"
      aria-label={isUser ? '你的消息' : 'AI 消息'}
    >
      {!isUser && (
        <div style={S.bubbleRole}>🦊 AI GM</div>
      )}
      {/* v4.1.0: AI 输出旁白/对话可视化区分 */}
      {isUser ? (
        <div style={{ fontSize: '0.9375rem', lineHeight: 1.7 }}>{message.content}</div>
      ) : (
        <NarrativeRenderer content={message.content} />
      )}
    </div>
  );
}

function StatusDot({ status }: { status: 'ok' | 'loading' | 'error' }): React.ReactElement {
  const color =
    status === 'ok' ? 'var(--accent-success)' :
    status === 'loading' ? 'var(--accent-gold)' :
    'var(--accent-danger)';
  const animation = status === 'loading' ? 'ai-dot-pulse 1.5s ease-in-out infinite' : 'none';

  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        animation,
        marginRight: 6,
        flexShrink: 0,
      }}
    />
  );
}
