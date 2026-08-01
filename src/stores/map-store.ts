import { create } from 'zustand';
import type {
  TileCoord,
  Tile,
  TileEvent,
  MapEntity,
  FogState,
} from '@/systems/map/types';

// ============================================================
// Store-specific types
// ============================================================

/** 区域 */
export interface Region {
  id: string;
  name: string;
  description: string;
  theme: string;
  bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number };
  tiles: Map<string, Tile>;
  entities: Map<string, MapEntity>;
  entryPoints: TileCoord[];
  ambientNarrative: string;
}

/** 移动结果 */
export interface MoveResult {
  success: boolean;
  path: TileCoord[];
  destinationCoord: TileCoord;
  blockedReason?: string;
  triggeredEvents: TileEvent[];
}

/** 地图状态 */
export interface MapState {
  playerCoord: TileCoord;
  currentRegionId: string;
  tileStates: Record<string, { fogState: FogState; isDiscovered: boolean }>;
  entityStates: Record<string, { coord: TileCoord; isActive: boolean }>;
  regionStates: Record<string, { isUnlocked: boolean; visitCount: number; firstVisitedAt: number }>;
}

// ============================================================
// Store 接口
// ============================================================

export interface MapSlice {
  // ── 地图数据 ──
  currentRegionId: string;
  currentRegion: Region | null;
  tiles: Map<string, Tile>;
  entities: Map<string, MapEntity>;

  // ── 玩家位置 ──
  playerCoord: TileCoord;
  isMoving: boolean;
  movePath: TileCoord[];

  // ── 视图 ──
  zoomLevel: number;
  cameraOffset: { x: number; y: number };

  // ── 战争迷雾 ──
  fogStates: Record<string, FogState>;

  // ── Actions ──
  moveTo: (coord: TileCoord) => Promise<MoveResult>;
  cancelMovement: () => void;
  setZoom: (level: number) => void;
  centerOn: (coord: TileCoord) => void;
  revealFog: (coord: TileCoord, radius: number) => void;
  loadMapState: (state: MapState) => void;
  setCurrentRegion: (region: Region) => void;
  setPlayerCoord: (coord: TileCoord) => void;
  reset: () => void;
}

// ============================================================
// 初始状态
// ============================================================

function getInitialPlayerCoord(): TileCoord {
  return { col: 0, row: 0 };
}

function getInitialState(): Omit<
  MapSlice,
  | 'moveTo'
  | 'cancelMovement'
  | 'setZoom'
  | 'centerOn'
  | 'revealFog'
  | 'loadMapState'
  | 'setCurrentRegion'
  | 'setPlayerCoord'
  | 'reset'
> {
  return {
    currentRegionId: '',
    currentRegion: null,
    tiles: new Map(),
    entities: new Map(),
    playerCoord: getInitialPlayerCoord(),
    isMoving: false,
    movePath: [],
    zoomLevel: 1.0,
    cameraOffset: { x: 0, y: 0 },
    fogStates: {},
  };
}

// ============================================================
// Store 创建
// ============================================================

export const useMapStore = create<MapSlice>((set) => ({
  ...getInitialState(),

  moveTo: async (coord: TileCoord): Promise<MoveResult> => {
    // v1.1.0: Returns a valid result instead of throwing (Epic 4 full impl pending).
    console.warn('[MapStore] moveTo: 完整路径寻路 (BFS/A*) 计划在 Epic 4 实现');
    const path: TileCoord[] = [];
    const cellKey = `${coord.col},${coord.row}`;
    set((state) => ({
      playerCoord: coord,
      isMoving: false,
      movePath: path,
      fogStates: { ...state.fogStates, [cellKey]: 'visible' },
    }));
    return {
      success: true,
      path,
      destinationCoord: coord,
      triggeredEvents: [],
    };
  },

  cancelMovement: (): void => {
    set({ isMoving: false, movePath: [] });
  },

  setZoom: (level: number): void => {
    set({ zoomLevel: Math.max(0.5, Math.min(2.0, level)) });
  },

  centerOn: (coord: TileCoord): void => {
    set({ cameraOffset: { x: coord.col, y: coord.row } });
  },

  revealFog: (coord: TileCoord, radius: number): void => {
    const key = `${coord.col},${coord.row}`;
    set((state) => ({
      fogStates: { ...state.fogStates, [key]: 'visible' },
    }));
    // Note: 实际实现需 Bresenham 视线算法 (Epic 4)
    void radius;
  },

  loadMapState: (mapState: MapState): void => {
    set({
      playerCoord: mapState.playerCoord,
      currentRegionId: mapState.currentRegionId,
      fogStates: {},
    });
    // 恢复 tileStates 和 entityStates
    for (const [key, tileState] of Object.entries(mapState.tileStates)) {
      set((state) => ({
        fogStates: { ...state.fogStates, [key]: tileState.fogState },
      }));
    }
  },

  setCurrentRegion: (region: Region): void => {
    set({
      currentRegionId: region.id,
      currentRegion: region,
      tiles: region.tiles,
      entities: region.entities,
    });
  },

  setPlayerCoord: (coord: TileCoord): void => {
    set({ playerCoord: coord });
  },

  reset: (): void => {
    set(getInitialState());
  },
}));
