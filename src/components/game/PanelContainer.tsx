'use client';

import React, { useCallback, useEffect, useRef } from 'react';
// v5.1.0 (移动端): 全屏抽屉断点
import { useIsMobile } from '@/hooks/useMediaQuery';
import type { PanelId, GameState, GameItem, GameQuest, GameRegion, CompanionRelationship, Wallet } from './panels/types';
import { CharacterPanel, type CharacterInjury, type ClassMechanic } from './panels/CharacterPanel';
import { InventoryPanel } from './panels/InventoryPanel';
import { QuestPanel } from './panels/QuestPanel';
import { MapPanel } from './panels/MapPanel';
import { SkillsPanel, type SkillCategoryTheme } from './panels/SkillsPanel';
import { AchievementPanel } from './panels/AchievementPanel';
import { RelationsPanel } from './panels/RelationsPanel';
import { MarketPanel } from './panels/MarketPanel';
import { TerritoryPanel } from './panels/TerritoryPanel';
import { WorldBookPanel } from './panels/WorldBookPanel';
import { TownPanel } from './panels/TownPanel';
import type { TownFacilityId } from '@/systems/town/town-system';
import type { Achievement, AchievementCategory } from '@/systems/achievements/achievement-system';
import { EMPTY_WALLET, C } from '@/theme/tokens';
import type { LibraryItem } from '@/systems/content';
import type { TerritoryState, FacilityId } from '@/systems/territory/territory-system';

export interface PanelContainerProps {
  activePanel: PanelId;
  onClose: () => void;
  characterName: string;
  characterClass: string;
  characterAttributes: Record<string, number>;
  gameState: GameState;
  onUseItem?: (item: GameItem) => void;
  onTravel?: (regionId: string) => void;
  unlockedRegions?: string[];
  themeCategories?: SkillCategoryTheme[];
  attrLabels?: Record<string, string>;
  attrDescs?: Record<string, string>;
  startingItems?: GameItem[];
  startingQuests?: GameQuest[];
  mapRegions?: GameRegion[];
  mapTitle?: string;
  hpAttr?: string;
  mpAttr?: string;
  skillPoints?: number;
  achievements?: Achievement[];
  achievementProgress?: {
    total: number;
    unlocked: number;
    byCategory: Record<AchievementCategory, { unlocked: number; total: number }>;
  };
  origin?: string;
  background?: string;
  factions?: { id: string; name: string; description?: string; reputation?: number }[];
  /** v4.1.0: 阵营声望映射（world-setting 10.2） */
  factionReputations?: Record<string, number>;
  gold?: number;
  relationships?: CompanionRelationship[];
  /** v4.0.0: 多层级钱包 */
  wallet?: Wallet;
  /** v4.0.0: 市场购买回调 */
  onBuy?: (item: LibraryItem) => void;
  /** v4.0.0: 市场出售回调 */
  onSell?: (item: GameItem) => void;
  /** v4.0.0: 当前地点（市场定价） */
  currentLocation?: string;
  /** v4.1.0: 职业机制 */
  mechanics?: ClassMechanic[];
  /** v4.1.0: 当前处境 */
  currentSituation?: string;
  /** v4.1.0: 伤病列表 */
  injuries?: CharacterInjury[];
  /** v4.1.0: 装备槽位 */
  equipmentSlots?: Record<string, GameItem | null>;
  /** v4.1.0: 职业名称 */
  profession?: string;
  /** v4.1.0: 堕落值 0-100 */
  corruption?: number;
  /** v4.1.0: 领地经营状态 */
  territory?: TerritoryState;
  /** v4.1.0: 升级设施回调 */
  onTerritoryUpgrade?: (facilityId: FacilityId) => void;
  /** v4.1.0: 战略桌投入回调 */
  onTerritoryStrategy?: (projectId: string) => void;
  /** v4.1.0: 休整一日回调 */
  onTerritoryRest?: () => void;
  /** v4.1.0: 当前天数（围城战进度） */
  dayCount?: number;
  /** v4.1.0: 技能树 — 已习得技能名 */
  learnedSkillNames?: string[];
  /** v4.1.0: 技能树 — 可用技能点 */
  skillPointBalance?: number;
  /** v4.1.0: 技能树 — 习得回调（持久化） */
  onLearnSkill?: (skillName: string) => void;
  /** v5.0.0 (功能5): 本职业基础技能（技能名数组）— 开局可见 */
  classStarterSkills?: string[];
  /** v4.1.0: 装备回调（背包→槽位） */
  onEquipItem?: (item: GameItem) => void;
  /** v4.1.0: 卸下装备回调（槽位→背包） */
  onUnequipItem?: (slotId: string) => void;
  /** v4.1.0: 世界书条目 */
  worldBookEntries?: import('@/systems/worldbook/worldbook-system').WorldBookEntry[];
  /** v4.1.0: 世界书变更回调 */
  onWorldBookChange?: (entries: import('@/systems/worldbook/worldbook-system').WorldBookEntry[]) => void;
  /** v4.2.0: 城镇入口回调 */
  onEnterFacility?: (facilityId: TownFacilityId) => void;
  /** v4.2.0: 当前是否位于城镇（凛冬谷） */
  inTown?: boolean;
  /** v4.2.0: 当前地点名称 */
  currentLocationName?: string;
  /** v4.2.0: 物品组合回调 */
  onCraftItems?: (itemA: GameItem, itemB: GameItem) => void;
  /** v4.2.0: 关系链节点 */
  chainNodes?: import('@/systems/npc/relation-chain').ChainNode[];
  /** v4.2.0: 关系链交互回调 */
  onChainInteract?: (node: import('@/systems/npc/relation-chain').ChainNode, action: 'talk' | 'gift' | 'invite' | 'recruit') => void;
  /** v4.2.0: 好感度变化 */
  onChainAffinity?: (nodeId: string, delta: number) => void;
}

const PANEL_WIDTH = '420px';
const PANEL_MAX_WIDTH = '420px';

// v5.1.0 (移动端): 全屏抽屉基础样式（isMobile 时覆盖 width/maxWidth/height）
const S = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 100,
    background: 'rgba(0,0,0,0.35)',
    transition: 'opacity 0.3s ease',
  },
  panel: {
    position: 'fixed' as const,
    top: 0,
    right: 0,
    width: PANEL_WIDTH,
    maxWidth: PANEL_MAX_WIDTH,
    height: 'var(--app-height)',
    // v5.1.0 技术美术：色板统一走 tokens
    background: C.bgPanel,
    borderLeft: `1px solid ${C.borderActive}`,
    zIndex: 101,
    boxShadow: '0 4px 16px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.03)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    transform: 'translateX(100%)',
    transition: 'transform 0.3s ease',
  },
  panelVisible: {
    transform: 'translateX(0)',
  },
  closeBtn: {
    position: 'absolute' as const,
    top: '0.875rem',
    right: '0.875rem',
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: '1px solid rgba(201,169,78,0.35)',
    background: 'rgba(30,27,24,0.9)',
    color: '#C9A94E',
    fontSize: '1.125rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 102,
    lineHeight: 1,
  },
} as const;

function getDefaultItems(): GameItem[] {
  return [
    { id: 'medkit', name: '急救包', emoji: '💊', category: '医疗', description: '恢复少量生命值' },
    { id: 'knife', name: '小刀', emoji: '🔪', category: '武器', description: '基础防身武器' },
    { id: 'rope', name: '绳索', emoji: '🪢', category: '工具', description: '攀爬或捆绑用' },
    { id: 'flask', name: '水壶', emoji: '🧴', category: '生存', description: '保持水分' },
  ];
}

function getDefaultQuests(worldName: string): GameQuest[] {
  return [
    {
      id: 'q-main-1',
      title: '探索周边',
      description: `调查 ${worldName} 的周围环境，了解当前的处境和可用的资源。`,
      type: 'main',
      progress: 0,
      status: 'active',
    },
  ];
}

/**
 * v4.1.0: 默认回退区域对齐凛冬要塞六大区域（world-setting.md 7.1），
 * 与 MapPanel.DEFAULT_REGIONS / FROSTHOLD_PRESET.mapRegionsV2 保持一致。
 */
function getDefaultRegions(): GameRegion[] {
  return [
    { id: 'winter-glen', name: '凛冬谷', discovered: true, cx: 220, cy: 320, points: '220,240 300,320 220,400 140,320', labelX: 220, labelY: 320, dangerLevel: 'safe', regionDesc: '要塞周边已清理的安全区域。', connections: ['暮色森林', '阴影山脉'] },
    { id: 'twilight-forest', name: '暮色森林', discovered: false, cx: 110, cy: 180, points: '110,100 200,180 110,260 20,180', labelX: 110, labelY: 180, dangerLevel: 'caution', regionDesc: '古老森林，精灵遗迹散布。', connections: ['凛冬谷', '阴影山脉'] },
    { id: 'shadow-mountains', name: '阴影山脉', discovered: false, cx: 300, cy: 110, points: '300,30 390,110 300,190 210,110', labelX: 300, labelY: 110, dangerLevel: 'danger', regionDesc: '矮人故土，半兽人盘踞。', connections: ['凛冬谷', '暮色森林', '荒芜平原'] },
    { id: 'barren-plains', name: '荒芜平原', discovered: false, cx: 330, cy: 330, points: '330,250 420,330 330,410 240,330', labelX: 330, labelY: 330, dangerLevel: 'danger', regionDesc: '古代战场，亡灵游荡。', connections: ['阴影山脉', '黑曜石荒原'] },
    { id: 'obsidian-wastes', name: '黑曜石荒原', discovered: false, cx: 440, cy: 250, points: '440,170 530,250 440,330 350,250', labelX: 440, labelY: 250, dangerLevel: 'deadly', regionDesc: '黑暗力量核心渗透区。', connections: ['荒芜平原', '龙脊冰峰'] },
    { id: 'dragon-spine', name: '龙脊冰峰', discovered: false, cx: 470, cy: 80, points: '470,0 560,80 470,160 380,80', labelX: 470, labelY: 80, dangerLevel: 'deadly', regionDesc: '极北冰封山脉，远古生物栖息。', connections: ['黑曜石荒原'] },
  ];
}

export function PanelContainer({
  activePanel,
  onClose,
  characterName,
  characterClass,
  characterAttributes,
  gameState,
  onUseItem,
  onTravel,
  unlockedRegions,
  themeCategories,
  attrLabels,
  attrDescs,
  startingItems,
  startingQuests,
  mapRegions,
  mapTitle,
  hpAttr = 'constitution',
  mpAttr = 'intelligence',
  // skillPoints 已由 skillPointBalance 取代（v4.1.0 技能树）
  achievements = [],
  achievementProgress,
  origin,
  background,
  factions,
  gold,
  relationships,
  wallet,
  onBuy,
  onSell,
  currentLocation,
  mechanics,
  currentSituation,
  injuries,
  equipmentSlots,
  profession,
  corruption,
  factionReputations,
  territory,
  onTerritoryUpgrade,
  onTerritoryStrategy,
  onTerritoryRest,
  dayCount = 1,
  learnedSkillNames = [],
  skillPointBalance = 3,
  onLearnSkill,
  classStarterSkills = [],
  onEquipItem,
  onUnequipItem,
  worldBookEntries = [],
  onWorldBookChange,
  onEnterFacility,
  inTown,
  currentLocationName,
  onCraftItems,
  chainNodes = [],
  onChainInteract,
  onChainAffinity,
}: PanelContainerProps): React.ReactElement {
  const panelRef = useRef<HTMLDivElement>(null);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // v1.2.0: Use theme-specific defaults if provided, otherwise fall back to built-in defaults
  const defaultItems = startingItems && startingItems.length > 0 ? startingItems : getDefaultItems();
  const defaultQuests = startingQuests && startingQuests.length > 0 ? startingQuests : getDefaultQuests(mapTitle || '这片土地');
  const defaultRegions = mapRegions && mapRegions.length > 0 ? mapRegions : getDefaultRegions();

  const resolvedItems: GameItem[] = gameState.items.length > 0 ? gameState.items : defaultItems;
  const resolvedQuests: GameQuest[] = gameState.quests.length > 0 ? gameState.quests : defaultQuests;
  const resolvedRegions: GameRegion[] = gameState.regions.length > 0 ? gameState.regions : defaultRegions;
  const resolvedLocation = gameState.currentLocation || (defaultRegions[0]?.id ?? 'beach');
  const resolvedLocationDesc = gameState.currentLocationDescription || '你在这片未知的区域中开始了冒险。';

  const renderPanel = (): React.ReactElement | null => {
    switch (activePanel) {
      case 'character':
        return (
          <CharacterPanel
            name={characterName}
            className={characterClass}
            attributes={characterAttributes}
            attrLabels={attrLabels}
            attrDescs={attrDescs}
            hpAttr={hpAttr}
            mpAttr={mpAttr}
            origin={origin}
            background={background}
            factions={(factions ?? []).map((f) => ({
              ...f,
              reputation: factionReputations?.[f.id] ?? f.reputation ?? 0,
            }))}
            gold={gold}
            wallet={wallet}
            profession={profession}
            mechanics={mechanics}
            currentSituation={currentSituation}
            injuries={injuries}
            equipmentSlots={equipmentSlots}
            corruption={corruption}
            onUnequip={onUnequipItem}
          />
        );
      case 'inventory':
        return (
          <InventoryPanel
            items={resolvedItems}
            onUseItem={onUseItem}
            equippedSlots={equipmentSlots}
            onEquip={onEquipItem}
            onCraft={onCraftItems}
          />
        );
      case 'quest':
        return <QuestPanel quests={resolvedQuests} />;
      case 'skills':
        return (
          <SkillsPanel
            classId={characterClass}
            skillPoints={skillPointBalance}
            themeCategories={themeCategories}
            unlockedSkills={learnedSkillNames}
            onUnlockSkill={onLearnSkill}
            classStarterSkills={classStarterSkills}
          />
        );
      case 'map':
        return (
          <MapPanel
            currentRegion={resolvedLocation}
            currentLocation={resolvedLocation}
            currentLocationDescription={resolvedLocationDesc}
            regions={resolvedRegions}
            unlockedRegions={unlockedRegions}
            onTravel={onTravel}
            mapTitle={mapTitle}
          />
        );
      case 'achievements':
        return (
          <AchievementPanel
            achievements={achievements}
            totalProgress={achievementProgress ?? {
              total: achievements.length,
              unlocked: achievements.filter(a => a.unlocked).length,
              byCategory: {
                exploration: { unlocked: 0, total: 0 },
                combat: { unlocked: 0, total: 0 },
                collection: { unlocked: 0, total: 0 },
                narrative: { unlocked: 0, total: 0 },
              },
            }}
          />
        );
      case 'relations':
        return (
          <RelationsPanel
            relationships={relationships ?? []}
            chainNodes={chainNodes}
            onInteract={onChainInteract}
            onAffinityChange={onChainAffinity}
          />
        );
      case 'market':
        return (
          <MarketPanel
            wallet={wallet ?? EMPTY_WALLET}
            inventory={gameState.items ?? []}
            currentLocation={currentLocation ?? (activePanel === 'market' ? gameState.currentLocation : undefined)}
            onBuy={onBuy}
            onSell={onSell}
          />
        );
      case 'territory':
        return territory ? (
          <TerritoryPanel
            territory={territory}
            onUpgrade={onTerritoryUpgrade}
            onStrategy={onTerritoryStrategy}
            onRest={onTerritoryRest}
            dayCount={dayCount}
          />
        ) : null;
      case 'worldbook':
        return (
          <WorldBookPanel entries={worldBookEntries} onChange={onWorldBookChange ?? (() => {})} />
        );
      case 'town':
        return (
          <TownPanel
            onEnterFacility={onEnterFacility ?? (() => {})}
            inTown={inTown ?? false}
            currentLocationName={currentLocationName}
          />
        );
      default:
        return null;
    }
  };

  const isVisible = activePanel !== null;
  // v5.1.0 (移动端): ≤900px 全屏抽屉 — 宽度占满屏幕、遮罩加深、关闭按钮放大到 48px 命中区
  const isMobile = useIsMobile();

  return (
    <>
      <div
        style={{
          ...S.overlay,
          background: isMobile ? 'rgba(0,0,0,0.5)' : S.overlay.background,
          opacity: isVisible ? 1 : 0,
          pointerEvents: isVisible ? 'auto' : 'none',
        }}
        onClick={handleOverlayClick}
        aria-hidden={!isVisible}
      />

      <div
        ref={panelRef}
        style={{
          ...S.panel,
          width: isMobile ? '100%' : S.panel.width,
          maxWidth: isMobile ? '100%' : S.panel.maxWidth,
          ...(isVisible ? S.panelVisible : {}),
        }}
        role="dialog"
        aria-modal="true"
        aria-label={activePanel ? `${activePanel} panel` : ''}
      >
        <button
          onClick={onClose}
          style={{
            ...S.closeBtn,
            width: isMobile ? 48 : S.closeBtn.width,
            height: isMobile ? 48 : S.closeBtn.height,
            fontSize: isMobile ? '1.375rem' : S.closeBtn.fontSize,
          }}
          aria-label="关闭面板"
          type="button"
        >
          ✕
        </button>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          {renderPanel()}
        </div>
      </div>
    </>
  );
}
