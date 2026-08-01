import { create } from 'zustand';

// ============================================================
// 类型定义 — 对应 overview.md §3.4.1
// ============================================================

/** 世界状态摘要（从记忆引擎同步） */
export interface WorldStateDigest {
  activeRegionId: string;
  activeNpcs: string[];
  activeQuests: string[];
  unresolvedHooks: string[];
  lastUpdatedAt: number;
}

/** 游戏设定 */
export interface GameSetting {
  id: string;
  name: string;
  version: string;
  worldMeta: {
    name: string;
    genre: string;
    tone: string;
    description: string;
  };
}

/** 存档元数据 */
export interface SaveSlotMeta {
  slotId: string;
  label: string;
  playerName: string;
  playerClass: string;
  playTimeMs: number;
  lastPlayedAt: number;
  createdAt: number;
  gameSettingId: string;
}

/** 玩家属性映射 */
export type PlayerAttributes = Record<string, number>;

// ============================================================
// Store 接口
// ============================================================

export interface WorldSlice {
  // ── 玩家 ──
  playerName: string;
  playerClass: string;
  playerAttributes: PlayerAttributes;

  // ── 世界状态摘要 ──
  worldStateDigest: WorldStateDigest | null;

  // ── 游戏设定 ──
  gameSetting: GameSetting | null;
  isSettingLoaded: boolean;

  // ── 存档元数据 ──
  saveSlots: SaveSlotMeta[];
  currentSaveSlotId: string | null;

  // ── Actions ──
  loadGameSetting: (setting: GameSetting) => void;
  updatePlayerAttribute: (key: string, delta: number) => void;
  syncWorldStateDigest: (digest: WorldStateDigest) => void;
  setPlayerName: (name: string) => void;
  setPlayerClass: (className: string) => void;
  initPlayerAttributes: (attrs: PlayerAttributes) => void;
  addSaveSlot: (slot: SaveSlotMeta) => void;
  removeSaveSlot: (slotId: string) => void;
  setCurrentSaveSlotId: (slotId: string | null) => void;
  reset: () => void;
}

// ============================================================
// 初始状态
// ============================================================

function getInitialState(): Omit<
  WorldSlice,
  | 'loadGameSetting'
  | 'updatePlayerAttribute'
  | 'syncWorldStateDigest'
  | 'setPlayerName'
  | 'setPlayerClass'
  | 'initPlayerAttributes'
  | 'addSaveSlot'
  | 'removeSaveSlot'
  | 'setCurrentSaveSlotId'
  | 'reset'
> {
  return {
    playerName: '',
    playerClass: '',
    playerAttributes: {},
    worldStateDigest: null,
    gameSetting: null,
    isSettingLoaded: false,
    saveSlots: [],
    currentSaveSlotId: null,
  };
}

// ============================================================
// Store 创建
// ============================================================

export const useWorldStore = create<WorldSlice>((set) => ({
  ...getInitialState(),

  loadGameSetting: (setting: GameSetting): void => {
    set({ gameSetting: setting, isSettingLoaded: true });
  },

  updatePlayerAttribute: (key: string, delta: number): void => {
    set((state) => ({
      playerAttributes: {
        ...state.playerAttributes,
        [key]: (state.playerAttributes[key] ?? 0) + delta,
      },
    }));
  },

  syncWorldStateDigest: (digest: WorldStateDigest): void => {
    set({ worldStateDigest: digest });
  },

  setPlayerName: (name: string): void => {
    set({ playerName: name });
  },

  setPlayerClass: (className: string): void => {
    set({ playerClass: className });
  },

  initPlayerAttributes: (attrs: PlayerAttributes): void => {
    set({ playerAttributes: { ...attrs } });
  },

  // FIX: QUAL-3 — addSaveSlot 去重，避免同一槽位重复出现在列表中
  addSaveSlot: (slot: SaveSlotMeta): void => {
    set((state) => {
      const existingIdx = state.saveSlots.findIndex((s) => s.slotId === slot.slotId);
      if (existingIdx >= 0) {
        // 替换已存在的槽位
        const updated = [...state.saveSlots];
        updated[existingIdx] = slot;
        return { saveSlots: updated };
      }
      return { saveSlots: [...state.saveSlots, slot] };
    });
  },

  removeSaveSlot: (slotId: string): void => {
    set((state) => ({
      saveSlots: state.saveSlots.filter((s) => s.slotId !== slotId),
    }));
  },

  setCurrentSaveSlotId: (slotId: string | null): void => {
    set({ currentSaveSlotId: slotId });
  },

  reset: (): void => {
    set(getInitialState());
  },
}));
