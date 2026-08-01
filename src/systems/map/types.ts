/**
 * @file 地图系统核心类型定义 — Epic 4
 * @description
 * 对齐 GDD §3 数据结构，包含三层空间 (Region→Tile→Entity) 全部接口。
 * 与 src/stores/map-store.ts 的内联类型保持兼容——本文件为权威源。
 * @see design/gdd/map-system.md §3
 * @see design/art-bible.md §7.5
 */

// ============================================================
// 空间坐标
// ============================================================

/** 等距图块坐标（列/行） */
export interface TileCoord {
  col: number;
  row: number;
}

// ============================================================
// 地形类型
// ============================================================

/** 地形类型 — GDD §3.1 */
export type TerrainType =
  | 'grass'
  | 'dirt'
  | 'stone'
  | 'sand'
  | 'water_shallow'
  | 'water_deep'
  | 'road'
  | 'bridge'
  | 'wall'
  | 'door_locked'
  | 'door_open'
  | 'cliff'
  | 'pit'
  | 'building_floor';

// ============================================================
// 战争迷雾
// ============================================================

/** 战争迷雾三态 — GDD §2.2 */
export type FogState = 'unexplored' | 'explored' | 'visible';

// ============================================================
// 地图主题
// ============================================================

/** 地图主题 — GDD §2.5, 美术圣经 §7.5 */
export type MapTheme = 'forest' | 'cave' | 'town' | 'water';

/** 主题色板 */
export interface ThemePalette {
  base: string;
  highlight: string;
  shadow: string;
  accent: string;
  particleColor: string;
  particleColorAlt: string;
}

/** 四种主题色板 — 美术圣经 §7.5 */
export const THEME_PALETTES: Record<MapTheme, ThemePalette> = {
  forest: {
    base: '#3A5A2E',
    highlight: '#5C8A42',
    shadow: '#2A4020',
    accent: '#7AB648',
    particleColor: '#A8D870',
    particleColorAlt: '#E8D48B',
  },
  cave: {
    base: '#2A2420',
    highlight: '#4A3A30',
    shadow: '#1A1410',
    accent: '#6A5ACD',
    particleColor: '#7B6FDF',
    particleColorAlt: '#4ECDC4',
  },
  town: {
    base: '#8B7D6B',
    highlight: '#C4B5A0',
    shadow: '#5C5040',
    accent: '#C9A94E',
    particleColor: '#F0D080',
    particleColorAlt: '#E8A040',
  },
  water: {
    base: '#2E4A6B',
    highlight: '#4A7A9B',
    shadow: '#1A3048',
    accent: '#5B8CBE',
    particleColor: '#8BC4EA',
    particleColorAlt: '#C8E8F8',
  },
} as const;

// ============================================================
// 图块事件
// ============================================================

/** 事件触发类型 — GDD §2.4 */
export type TileEventTrigger =
  | 'on_enter'
  | 'on_every_enter'
  | 'on_examine'
  | 'on_proximity'
  | 'on_time'
  | 'on_condition';

/** 事件条件 */
export interface EventCondition {
  type: string;
  params: Record<string, unknown>;
}

/** 事件动作 */
export interface EventAction {
  type: 'narrative' | 'dialogue' | 'state_change' | 'teleport' | 'spawn';
  payload: Record<string, unknown>;
}

/** 图块事件 — GDD §2.4 */
export interface TileEvent {
  id: string;
  trigger: TileEventTrigger;
  /** 兼容 store 简化版: narrative 文本可直接使用 */
  narrative?: string;
  condition?: EventCondition;
  conditions?: Record<string, unknown>;
  action: EventAction;
  repeatable: boolean;
  hasFired: boolean;
  cooldown?: number;
  cooldownMs?: number;
  lastTriggeredAt?: number;
}

// ============================================================
// 图块
// ============================================================

/** 图块主题颜色覆盖 */
export interface TileThemeColors {
  base: string;
  highlight: string;
  shadow: string;
}

/** 图块 — GDD §3.1 Tile 接口 */
export interface Tile {
  coord: TileCoord;
  terrain: TerrainType | string;
  elevation: number;

  /** 视觉覆盖 */
  themeOverrides?: Partial<TileThemeColors>;
  decorationId?: string;

  /** 游戏逻辑 */
  isWalkable: boolean;
  isExplorable: boolean;
  moveCost: number;

  /** 叙事 */
  name: string;
  description: string;
  labels?: string[];

  /** 事件 */
  events: TileEvent[];

  /** 状态 */
  fogState: FogState;
  isDiscovered: boolean;

  /** 实体 */
  entityIds: string[];
}

// ============================================================
// 地图实体
// ============================================================

/** 地图实体类型 — GDD §3.1 */
export type MapEntityType = 'player' | 'npc' | 'monster' | 'item' | 'building' | 'trigger' | 'decoration';

/** Sprite 尺寸 */
export interface SpriteSize {
  width: number;
  height: number;
}

/** 实体动画状态 */
export type EntityAnimationState =
  | 'idle'
  | 'walking'
  | 'interacting'
  | 'combat'
  | 'disabled';

/** 移动模式 */
export type MovementPattern =
  | 'stationary'
  | 'patrol'
  | 'wander'
  | 'follow_player';

/** NPC 倾向 */
export type EntityDisposition = 'friendly' | 'neutral' | 'hostile' | 'fleeing';

/** 地图实体 — GDD §3.1 MapEntity 接口 */
export interface MapEntity {
  id: string;
  name: string;
  /** 完整 GDD 类型使用 MapEntityType，兼容 store 的简化版 string */
  type: MapEntityType | string;
  coord: TileCoord;

  /** 视觉 */
  spriteId?: string;
  /** 兼容 store 的 spriteKey */
  spriteKey?: string;
  spriteSize?: SpriteSize;
  animationState?: EntityAnimationState;

  /** 行为 */
  isMovable?: boolean;
  movementPattern?: MovementPattern;
  isInteractable?: boolean;
  /** 兼容 store 的 isInteractive */
  isInteractive?: boolean;
  interactionRadius?: number;

  /** 状态 */
  isActive?: boolean;
  currentHp?: number;
  disposition?: EntityDisposition;

  /** 叙事 */
  dialogueTrigger?: string;
  examineText?: string;
}

// ============================================================
// MapEntityType → EntityType 映射 (对齐跨系统评审问题#1)
// ============================================================

/** 记忆引擎 EntityType */
export type MemoryEntityType =
  | 'character'
  | 'location'
  | 'item'
  | 'faction'
  | 'event'
  | 'concept'
  | 'quest';

/** MapEntityType → MemoryEntityType 映射表 */
export const MAP_ENTITY_TO_MEMORY_TYPE: Record<MapEntityType, MemoryEntityType> = {
  player: 'character',
  npc: 'character',
  monster: 'character',
  item: 'item',
  building: 'location',
  trigger: 'event',
  decoration: 'location',
};

// ============================================================
// 区域
// ============================================================

/** 罗盘方向 */
export type CompassDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/** 区域边界 */
export interface RegionBounds {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

/** 区域入口点 */
export interface RegionEntryPoint {
  id: string;
  tileCoord: TileCoord;
  targetRegionId: string;
  targetTileCoord: TileCoord;
  direction: CompassDirection;
  isLocked: boolean;
  unlockCondition?: EventCondition;
}

/** 区域 — GDD §3.1 Region 接口 */
export interface Region {
  id: string;
  name: string;
  description: string;
  theme: MapTheme | string;
  bounds: RegionBounds | { minCol: number; maxCol: number; minRow: number; maxRow: number };
  tiles: Map<string, Tile>;
  entities: Map<string, MapEntity>;
  entryPoints: RegionEntryPoint[] | TileCoord[];
  ambientNarrative: string;
}

// ============================================================
// 地图状态
// ============================================================

/** 地图状态（可序列化） — GDD §3.1 MapState */
export interface MapState {
  playerCoord: TileCoord;
  currentRegionId: string;
  tileStates: Record<string, {
    fogState: FogState;
    isDiscovered: boolean;
  }>;
  entityStates: Record<string, {
    coord: TileCoord;
    isActive: boolean;
    currentHp?: number;
    disposition?: EntityDisposition;
  }>;
  regionStates: Record<string, {
    isUnlocked: boolean;
    visitCount: number;
    firstVisitedAt?: number;
  }>;
}

// ============================================================
// 移动
// ============================================================

/** 移动结果 — GDD §4.1 MoveResult */
export interface MoveResult {
  success: boolean;
  path: TileCoord[];
  /** 兼容 store */
  destinationCoord?: TileCoord;
  tilesEntered?: TileCoord[];
  eventsTriggered: TileEvent[];
  destinationReached: boolean;
  blockedReason?: string;
}

// ============================================================
// 地图配置
// ============================================================

/** 地图系统配置 — GDD §4.1 MapConfig */
export interface MapConfig {
  defaultZoom: number;
  minZoom: number;
  maxZoom: number;
  labelZoomThreshold: number;
  entityHideZoomThreshold: number;
  moveSpeedMs: number;
  defaultViewRadius: number;
  tileWidth: number;
  tileHeight: number;
}

/** 默认地图配置 */
export const DEFAULT_MAP_CONFIG: MapConfig = {
  defaultZoom: 1.0,
  minZoom: 0.5,
  maxZoom: 2.0,
  labelZoomThreshold: 1.5,
  entityHideZoomThreshold: 0.75,
  moveSpeedMs: 300,
  defaultViewRadius: 6,
  tileWidth: 128,
  tileHeight: 64,
};

// ============================================================
// 区域状态
// ============================================================

/** 区域运行时状态 */
export interface RegionState {
  isUnlocked: boolean;
  visitCount: number;
  firstVisitedAt?: number;
}

// ============================================================
// 工具类型
// ============================================================

/** 坐标键（"col,row" 格式） */
export type CoordKey = string;

/** 将 TileCoord 转为 CoordKey */
export function coordToKey(coord: TileCoord): CoordKey {
  return `${coord.col},${coord.row}`;
}

/** 将 CoordKey 解析为 TileCoord */
export function keyToCoord(key: CoordKey): TileCoord {
  const [col, row] = key.split(',').map(Number);
  return { col: col!, row: row! };
}
