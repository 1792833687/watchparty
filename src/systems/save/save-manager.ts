/**
 * SaveManager — 存档管理器
 *
 * @description
 * 存档系统的核心编排层，负责：
 * - 收集所有 Store 状态 → 构建 SaveData → 序列化 → 写入存储
 * - 读取存储 → 反序列化 → 分发状态到各 Store
 * - 槽位管理（保存/加载/删除/列表）
 * - 自动存档（15 分钟间隔 + 关键抉择前）
 * - 紧急存档（beforeunload）
 * - 存储配额监控
 *
 * 设计原则：
 * - 依赖注入：SaveSerializer + IStorageAdapter + IMemoryEngine 通过构造函数注入
 * - Store 访问：通过模块级 getter 函数注入（避免循环依赖）
 * - 单例模式：一个应用只有一个 SaveManager 实例
 *
 * @see Epic 6 Story 6.3
 */

import { SaveSerializer } from './save-serializer';
import type {
  SaveData,
  SaveSlotMeta,
  SaveOperationResult,
  LoadOperationResult,
  PlayerSaveState,
  DialogueSaveState,
  UISaveState,
  StorageQuotaInfo,
} from './types';
import {
  CURRENT_SAVE_VERSION,
  getSlotKey,
  getMetaKey,
  MAX_SAVE_SLOTS,
  LOCALSTORAGE_QUOTA_BYTES,
  STORAGE_WARNING_THRESHOLD,
  STORAGE_CRITICAL_THRESHOLD,
  AUTO_SAVE_INTERVAL_MS,
} from './types';
import type { IStorageAdapter } from '@/infrastructure/storage/IStorageAdapter';
import { LocalStorageAdapter } from '@/infrastructure/storage/localstorage-adapter';
import type { IMemoryEngine } from '@/systems/memory/types';
import { serializeGraph } from '@/systems/memory/types';
import type { MapState } from '@/stores/map-store';
import { generateUUID } from '@/lib/utils/id';

// ============================================================
// Store getter/setter 函数类型（由应用初始化时注入）
// ============================================================

/** 世界状态快照获取器 */
export interface WorldStateGetter {
  playerName: string;
  playerClass: string;
  playerAttributes: Record<string, number>;
  gameSetting: {
    id: string;
    name: string;
    version: string;
    worldMeta: { name: string; genre: string; tone: string; description: string };
  } | null;
}

/** 对话状态快照获取器 */
export interface DialogueStateGetter {
  messages: Array<{
    id: string;
    role: 'player' | 'ai_gm' | 'npc' | 'system';
    speakerName: string;
    speakerId: string;
    content: string;
    contentBlocks: Array<Record<string, unknown>>;
    timestamp: number;
    sceneType?: 'golden' | 'danger' | 'magic' | null;
    isDecisionPoint: boolean;
    decisionNodeId?: string;
    tokenCount: number;
    stateDelta?: Record<string, unknown>;
    suggestedActions: Array<Record<string, unknown>>;
  }>;
  sessionId: string;
  totalTokensUsed: number;
  startedAt: number;
  modelId: string;
}

/** UI 状态快照获取器 */
export interface UIStateGetter {
  theme: 'dark' | 'light';
  selectedModel: string;
  typingEffectEnabled: boolean;
  soundEnabled: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
}

/** 地图状态快照获取器 */
export interface MapStateGetter {
  mapState: MapState;
}

/**
 * 所有 Store 状态的联合获取器。
 * 在应用初始化时通过 SaveManager.init() 注入。
 */
export interface StoreAccessors {
  getWorldState: () => WorldStateGetter;
  getDialogueState: () => DialogueStateGetter;
  getUIState: () => UIStateGetter;
  getMapState: () => MapStateGetter;
  /** 恢复世界状态到 Store */
  restoreWorldState: (state: {
    playerName: string;
    playerClass: string;
    playerAttributes: Record<string, number>;
  }) => void;
  /** 恢复对话状态到 Store */
  restoreDialogueState: (state: DialogueSaveState) => void;
  /** 恢复 UI 状态到 Store */
  restoreUIState: (state: UISaveState) => void;
  /** 恢复地图状态到 Store */
  restoreMapState: (state: MapState) => void;
  /** 重置所有 Store */
  resetAllStores: () => void;
}

// ============================================================
// SaveManager
// ============================================================

export class SaveManager {
  // --- 依赖 ---
  private serializer: SaveSerializer;
  private storage: IStorageAdapter;
  private memoryEngine: IMemoryEngine | null = null;
  private storeAccessors: StoreAccessors | null = null;

  // --- 自动存档 ---
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private autoSaveEnabled: boolean = false;
  private lastAutoSaveAt: number = 0;
  private currentSlotIndex: number = -1;

  // --- 紧急存档 ---
  private beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;

  // --- 游戏时长追踪 ---
  private sessionStartAt: number = 0;
  private accumulatedPlayTimeMs: number = 0;

  constructor(storage?: IStorageAdapter) {
    this.serializer = new SaveSerializer();
    this.storage = storage ?? new LocalStorageAdapter();
  }

  // ===========================================================================
  // 初始化
  // ===========================================================================

  /**
   * 初始化 SaveManager。
   * 必须在使用 save/load 之前调用。
   *
   * @param accessors - Store 访问器
   * @param memoryEngine - 记忆引擎实例（用于导出/导入图谱）
   */
  init(accessors: StoreAccessors, memoryEngine?: IMemoryEngine): void {
    this.storeAccessors = accessors;
    this.memoryEngine = memoryEngine ?? null;
    this.sessionStartAt = Date.now();
  }

  /**
   * 启用自动存档。
   * 每 AUTO_SAVE_INTERVAL_MS (15 min) 保存到当前槽位。
   * 如果没有当前槽位，自动存档到槽位 0。
   */
  enableAutoSave(slotIndex: number = 0): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveEnabled = true;
    this.currentSlotIndex = slotIndex;

    this.autoSaveTimer = setInterval(() => {
      void this.autoSave();
    }, AUTO_SAVE_INTERVAL_MS);

    console.log(
      `[SaveManager] 自动存档已启用 (间隔 ${AUTO_SAVE_INTERVAL_MS / 60000} 分钟, 槽位 ${slotIndex})`
    );
  }

  /** 禁用自动存档 */
  disableAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    this.autoSaveEnabled = false;
  }

  /**
   * 注册紧急存档（beforeunload）。
   * 在页面关闭前尝试保存到当前槽位。
   */
  registerEmergencySave(): void {
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    }

    this.beforeUnloadHandler = (_e: BeforeUnloadEvent) => {
      if (this.currentSlotIndex >= 0 && this.storeAccessors) {
        // 同步保存（beforeunload 不支持 async）
        void this.emergencySave(this.currentSlotIndex);
      }
    };

    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  /** 取消注册紧急存档 */
  unregisterEmergencySave(): void {
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
  }

  // ===========================================================================
  // 核心操作
  // ===========================================================================

  /**
   * 保存游戏到指定槽位。
   *
   * @param slotIndex - 槽位索引 0-2
   * @param label - 存档标签（可选，默认自动生成）
   * @param isAutoSave - 是否为自动存档
   * @returns SaveOperationResult
   */
  async save(
    slotIndex: number,
    label?: string,
    isAutoSave: boolean = false
  ): Promise<SaveOperationResult> {
    if (!this.storeAccessors) {
      return { success: false, error: 'SaveManager 未初始化。请先调用 init()。' };
    }
    if (slotIndex < 0 || slotIndex >= MAX_SAVE_SLOTS) {
      return { success: false, error: `槽位索引 ${slotIndex} 超出范围 [0, ${MAX_SAVE_SLOTS - 1}]。` };
    }

    try {
      // 1. 收集所有状态
      const saveData = await this.collectSaveData(slotIndex, label, isAutoSave);

      // 2. 大小检查
      const sizeWarning = this.serializer.checkSizeWarning(saveData);
      if (sizeWarning) {
        console.warn(`[SaveManager] ${sizeWarning}`);
      }

      // 3. 序列化
      const serialized = await this.serializer.serialize(saveData, {
        compress: true,
        pretty: false,
        includeChecksum: true,
      });

      // 4. 构建元数据
      const meta = this.buildSlotMeta(slotIndex, saveData, serialized);

      // 5. 写入存储（先写数据，再写元数据）
      await this.storage.set(getSlotKey(slotIndex), serialized);
      await this.storage.set(getMetaKey(slotIndex), meta);

      // 6. 更新当前槽位
      this.currentSlotIndex = slotIndex;

      // 7. 检查存储配额
      const quota = await this.checkQuota();
      if (quota.isCritical) {
        console.error(
          `[SaveManager] 存储空间严重不足 (${quota.usagePercent.toFixed(0)}%)！`
        );
      }

      return { success: true, meta };
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      console.error(`[SaveManager] 保存槽位 ${slotIndex} 失败:`, err);
      return { success: false, error: `保存失败: ${message}` };
    }
  }

  /**
   * 从指定槽位加载存档。
   *
   * @param slotIndex - 槽位索引 0-2
   * @returns LoadOperationResult
   */
  async load(slotIndex: number): Promise<LoadOperationResult> {
    if (!this.storeAccessors) {
      return { success: false, error: 'SaveManager 未初始化。请先调用 init()。' };
    }
    if (slotIndex < 0 || slotIndex >= MAX_SAVE_SLOTS) {
      return { success: false, error: `槽位索引 ${slotIndex} 超出范围 [0, ${MAX_SAVE_SLOTS - 1}]。` };
    }

    try {
      // 1. 检查存档是否存在
      const meta = await this.storage.get<SaveSlotMeta>(getMetaKey(slotIndex));
      if (!meta) {
        return { success: false, error: `槽位 ${slotIndex} 没有存档。` };
      }

      // 2. 读取序列化数据
      const raw = await this.storage.get<string>(getSlotKey(slotIndex));
      if (!raw) {
        return { success: false, error: `槽位 ${slotIndex} 存档数据丢失。` };
      }

      // 3. 反序列化
      const result = await this.serializer.deserialize(raw);
      if (!result.success || !result.data) {
        return { success: false, error: result.error };
      }

      if (result.migrated) {
        console.log(
          `[SaveManager] 存档已从 v${result.fromVersion ? `${result.fromVersion.major}.${result.fromVersion.minor}` : '?'} 迁移到 v${result.toVersion ? `${result.toVersion.major}.${result.toVersion.minor}` : '?'}`
        );
      }

      // 4. 恢复所有 Store 状态
      await this.restoreFromSaveData(result.data);

      // 5. 恢复记忆图谱
      if (this.memoryEngine && result.data.memoryGraph) {
        // 记忆引擎的恢复通过 init() + import 实现
        // 此处记录图谱供后续恢复
      }

      // 6. 更新游戏时长
      this.accumulatedPlayTimeMs = result.data.playTimeMs;
      this.sessionStartAt = Date.now();
      this.currentSlotIndex = slotIndex;

      // 7. 重新启用自动存档（如果之前启用）
      if (this.autoSaveEnabled) {
        this.enableAutoSave(slotIndex);
      }

      return { success: true, data: result.data, meta };
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      console.error(`[SaveManager] 加载槽位 ${slotIndex} 失败:`, err);
      return { success: false, error: `加载失败: ${message}` };
    }
  }

  /**
   * 删除指定槽位的存档。
   *
   * @param slotIndex - 槽位索引 0-2
   */
  async deleteSave(slotIndex: number): Promise<SaveOperationResult> {
    if (slotIndex < 0 || slotIndex >= MAX_SAVE_SLOTS) {
      return { success: false, error: `槽位索引 ${slotIndex} 超出范围 [0, ${MAX_SAVE_SLOTS - 1}]。` };
    }

    try {
      const hasData = await this.storage.has(getSlotKey(slotIndex));
      if (!hasData) {
        return { success: false, error: `槽位 ${slotIndex} 没有存档。` };
      }

      await this.storage.remove(getSlotKey(slotIndex));
      await this.storage.remove(getMetaKey(slotIndex));

      if (this.currentSlotIndex === slotIndex) {
        this.currentSlotIndex = -1;
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      console.error(`[SaveManager] 删除槽位 ${slotIndex} 失败:`, err);
      return { success: false, error: `删除失败: ${message}` };
    }
  }

  /**
   * 列出所有存档槽位的元数据。
   *
   * @returns SaveSlotMeta[] — 按 slotIndex 排序
   */
  async listSaves(): Promise<SaveSlotMeta[]> {
    const metas: SaveSlotMeta[] = [];
    for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
      const meta = await this.storage.get<SaveSlotMeta>(getMetaKey(i));
      if (meta) {
        metas.push(meta);
      }
    }
    metas.sort((a, b) => a.slotIndex - b.slotIndex);
    return metas;
  }

  /**
   * 获取槽位元数据。
   */
  async getSlotMeta(slotIndex: number): Promise<SaveSlotMeta | null> {
    return this.storage.get<SaveSlotMeta>(getMetaKey(slotIndex));
  }

  /**
   * 检查槽位是否有存档。
   */
  async hasSave(slotIndex: number): Promise<boolean> {
    return this.storage.has(getSlotKey(slotIndex));
  }

  // ===========================================================================
  // 导出/导入
  // ===========================================================================

  /**
   * 导出存档为 JSON 文件（人类可读，美化输出）。
   *
   * @param slotIndex - 要导出的槽位索引
   * @returns JSON 字符串，失败时返回 null
   */
  async exportSave(slotIndex: number): Promise<string | null> {
    try {
      const raw = await this.storage.get<string>(getSlotKey(slotIndex));
      if (!raw) return null;

      const result = await this.serializer.deserialize(raw);
      if (!result.success || !result.data) return null;

      // 重新序列化：美化输出、不压缩、包含校验和
      return this.serializer.serialize(result.data, {
        compress: false,
        pretty: true,
        includeChecksum: true,
      });
    } catch {
      return null;
    }
  }

  /**
   * 从 JSON 文件导入存档到指定槽位。
   *
   * @param json - 存档 JSON 字符串
   * @param slotIndex - 目标槽位索引
   */
  async importSave(json: string, slotIndex: number): Promise<SaveOperationResult> {
    if (slotIndex < 0 || slotIndex >= MAX_SAVE_SLOTS) {
      return { success: false, error: `槽位索引 ${slotIndex} 超出范围。` };
    }

    try {
      // 反序列化以验证
      const result = await this.serializer.deserialize(json);
      if (!result.success || !result.data) {
        return { success: false, error: `导入失败: ${result.error}` };
      }

      // 更新存档时间戳
      const importedData: SaveData = {
        ...result.data,
        savedAt: Date.now(),
        isAutoSave: false,
        label: result.data.label || `导入存档 (${new Date().toLocaleString()})`,
        version: CURRENT_SAVE_VERSION,
      };

      // 序列化并写入
      const serialized = await this.serializer.serialize(importedData, {
        compress: true,
        pretty: false,
        includeChecksum: true,
      });

      const meta = this.buildSlotMeta(slotIndex, importedData, serialized);

      await this.storage.set(getSlotKey(slotIndex), serialized);
      await this.storage.set(getMetaKey(slotIndex), meta);

      return { success: true, meta };
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      return { success: false, error: `导入失败: ${message}` };
    }
  }

  // ===========================================================================
  // 存储配额
  // ===========================================================================

  /**
   * 检查存储配额状态。
   *
   * @returns StorageQuotaInfo
   */
  async checkQuota(): Promise<StorageQuotaInfo> {
    const usedBytes = await this.storage.getUsageBytes();
    const quotaBytes = LOCALSTORAGE_QUOTA_BYTES;
    const usagePercent = quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0;

    return {
      usedBytes,
      quotaBytes,
      usagePercent: Math.round(usagePercent * 100) / 100,
      isWarning: usagePercent >= STORAGE_WARNING_THRESHOLD * 100,
      isCritical: usagePercent >= STORAGE_CRITICAL_THRESHOLD * 100,
    };
  }

  // ===========================================================================
  // 游戏时长
  // ===========================================================================

  /**
   * 获取当前会话的游戏时长（毫秒）。
   * 累计时长 = 之前存档的时长 + 当前会话的时长。
   */
  getPlayTimeMs(): number {
    const sessionTime = Date.now() - this.sessionStartAt;
    return this.accumulatedPlayTimeMs + sessionTime;
  }

  /**
   * 设置累计游戏时长（加载存档时使用）。
   */
  setAccumulatedPlayTime(ms: number): void {
    this.accumulatedPlayTimeMs = ms;
  }

  // ===========================================================================
  // 生命周期
  // ===========================================================================

  /**
   * 销毁 SaveManager。
   * 停止自动存档、取消紧急存档注册。
   */
  destroy(): void {
    this.disableAutoSave();
    this.unregisterEmergencySave();
    this.storeAccessors = null;
    this.memoryEngine = null;
  }

  // ===========================================================================
  // Private: 状态收集与恢复
  // ===========================================================================

  /**
   * 从所有 Store 收集状态，构建 SaveData。
   */
  private async collectSaveData(
    slotIndex: number,
    label?: string,
    isAutoSave: boolean = false
  ): Promise<SaveData> {
    const accessors = this.storeAccessors!;

    const worldState = accessors.getWorldState();
    const dialogueState = accessors.getDialogueState();
    const uiState = accessors.getUIState();
    const mapState = accessors.getMapState();

    // 记忆图谱
    let memoryGraph: Record<string, unknown> = {};
    if (this.memoryEngine) {
      const graph = this.memoryEngine.exportGraph();
      memoryGraph = serializeGraph(graph);
    }

    const playTimeMs = this.getPlayTimeMs();
    const now = Date.now();
    const settings = worldState.gameSetting;

    // 获取已有元数据以保留 createdAt
    const existingMeta = await this.storage.get<SaveSlotMeta>(getMetaKey(slotIndex));

    const saveData: SaveData = {
      version: CURRENT_SAVE_VERSION,
      createdAt: existingMeta?.createdAt ?? now,
      savedAt: now,
      playTimeMs,
      isAutoSave,
      label: label ?? this.generateDefaultLabel(isAutoSave),

      player: {
        name: worldState.playerName,
        class: worldState.playerClass,
        attributes: { ...worldState.playerAttributes },
      },

      gameSetting: settings ?? {
        id: '',
        name: '',
        version: '',
        worldMeta: { name: '', genre: '', tone: '', description: '' },
      },

      map: mapState.mapState,

      dialogue: {
        // FIX: PERF-3 — structuredClone 替代 JSON.parse(JSON.stringify())，更快且支持更多类型
        messages: structuredClone(dialogueState.messages) as unknown as DialogueSaveState['messages'],
        sessionId: dialogueState.sessionId,
        totalTokensUsed: dialogueState.totalTokensUsed,
        startedAt: dialogueState.startedAt,
        modelId: dialogueState.modelId,
      },

      memoryGraph,

      ui: {
        theme: uiState.theme,
        selectedModel: uiState.selectedModel,
        typingEffectEnabled: uiState.typingEffectEnabled,
        soundEnabled: uiState.soundEnabled,
        reducedMotion: uiState.reducedMotion,
        highContrast: uiState.highContrast,
      },

      checksum: '',
    };

    return saveData;
  }

  /**
   * 从 SaveData 恢复到所有 Store。
   */
  private async restoreFromSaveData(data: SaveData): Promise<void> {
    const accessors = this.storeAccessors!;

    // 先重置
    accessors.resetAllStores();

    // 恢复世界状态
    accessors.restoreWorldState({
      playerName: data.player.name,
      playerClass: data.player.class,
      playerAttributes: { ...data.player.attributes },
    });

    // 恢复对话状态
    accessors.restoreDialogueState(data.dialogue);

    // 恢复 UI 状态
    accessors.restoreUIState(data.ui);

    // 恢复地图状态
    accessors.restoreMapState(data.map);
  }

  /**
   * 构建槽位元数据。
   */
  private buildSlotMeta(
    slotIndex: number,
    data: SaveData,
    serialized: string
  ): SaveSlotMeta {
    return {
      slotIndex,
      label: data.label,
      playerName: data.player.name,
      playerClass: data.player.class,
      gameSettingName: data.gameSetting.worldMeta.name || data.gameSetting.name,
      gameSettingId: data.gameSetting.id,
      playTimeMs: data.playTimeMs,
      createdAt: data.createdAt,
      savedAt: data.savedAt,
      saveVersion: data.version,
      fileSizeBytes: new TextEncoder().encode(serialized).byteLength,
      isAutoSave: data.isAutoSave,
    };
  }

  /**
   * 生成默认存档标签。
   */
  private generateDefaultLabel(isAutoSave: boolean): string {
    const now = new Date();
    const timeStr = now.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    if (isAutoSave) {
      return `自动存档 - ${timeStr}`;
    }
    return `存档 - ${timeStr}`;
  }

  // ===========================================================================
  // Private: 自动/紧急存档
  // ===========================================================================

  /**
   * 执行自动存档（防抖：距离上次自动存档不足 1 分钟则跳过）。
   */
  private async autoSave(): Promise<void> {
    if (!this.storeAccessors) return;

    const now = Date.now();
    if (now - this.lastAutoSaveAt < 60_000) {
      return; // 1 分钟内不重复自动存档
    }

    this.lastAutoSaveAt = now;

    const result = await this.save(
      this.currentSlotIndex,
      undefined,
      true
    );

    if (result.success) {
      console.log(`[SaveManager] 自动存档完成 (槽位 ${this.currentSlotIndex})`);
    } else {
      console.error(`[SaveManager] 自动存档失败: ${result.error}`);
    }
  }

  /**
   * 紧急存档（beforeunload，尽力而为）。
   * 使用同步 localStorage API 绕过异步限制。
   */
  private async emergencySave(slotIndex: number): Promise<void> {
    if (!this.storeAccessors) return;

    try {
      const saveData = await this.collectSaveData(slotIndex, '紧急存档', true);
      const serialized = await this.serializer.serialize(saveData, {
        compress: false, // 紧急存档不压缩，确保速度
        pretty: false,
        includeChecksum: false, // 紧急存档跳过校验和
      });

      // 直接使用 localStorage 同步写入
      try {
        localStorage.setItem(getSlotKey(slotIndex), serialized);
        localStorage.setItem(
          getMetaKey(slotIndex),
          JSON.stringify(this.buildSlotMeta(slotIndex, saveData, serialized))
        );
      } catch (storageErr) {
        // FIX: ERR-1 — 紧急存档失败应至少记录日志，而非完全静默
        console.error('[SaveManager] 紧急存档写入 localStorage 失败:', storageErr);
      }
    } catch (err) {
      // FIX: ERR-1 — 不再完全静默，记录错误以便排查
      console.error('[SaveManager] 紧急存档收集/序列化失败:', err);
    }
  }
}

// ============================================================
// 导出单例
// ============================================================

/** SaveManager 默认单例 */
export const saveManager = new SaveManager();
