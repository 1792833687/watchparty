/**
 * SaveManager 单元测试
 *
 * @see Epic 6 Story 6.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SaveManager } from '@/systems/save/save-manager';
import { MemoryFallbackAdapter } from '@/infrastructure/storage/memory-fallback';
import type { StoreAccessors } from '@/systems/save/save-manager';
import type { SaveSlotMeta } from '@/systems/save/types';
import { MAX_SAVE_SLOTS, CURRENT_SAVE_VERSION } from '@/systems/save/types';
import type { MemoryEngine } from '@/systems/memory/memory-engine';

// ============================================================
// 测试辅助: Mock StoreAccessors
// ============================================================

function createMockStoreAccessors(overrides?: Partial<StoreAccessors>): StoreAccessors {
  const now = Date.now();
  return {
    getWorldState: () => ({
      playerName: '测试冒险者',
      playerClass: '游侠',
      playerAttributes: { hp: 100, mp: 50, str: 12 },
      gameSetting: {
        id: 'setting-1',
        name: '测试设定',
        version: '1.0.0',
        worldMeta: {
          name: '测试世界',
          genre: '奇幻',
          tone: '史诗',
          description: '一个测试世界。',
        },
      },
    }),
    getDialogueState: () => ({
      messages: [
        {
          id: 'msg-1',
          role: 'ai_gm',
          speakerName: 'GM',
          speakerId: 'ai_gm',
          content: '欢迎来到测试世界。',
          contentBlocks: [{ type: 'narrative', text: '欢迎来到测试世界。' }],
          timestamp: now - 60000,
          isDecisionPoint: false,
          tokenCount: 10,
          suggestedActions: [],
        },
      ],
      sessionId: 'session-1',
      totalTokensUsed: 100,
      startedAt: now - 3600000,
      modelId: 'anthropic/claude-3.5-sonnet',
    }),
    getUIState: () => ({
      theme: 'dark',
      selectedModel: 'anthropic/claude-3.5-sonnet',
      typingEffectEnabled: true,
      soundEnabled: false,
      reducedMotion: false,
      highContrast: false,
    }),
    getMapState: () => ({
      mapState: {
        playerCoord: { col: 0, row: 0 },
        currentRegionId: 'region-1',
        tileStates: {},
        entityStates: {},
        regionStates: {
          'region-1': { isUnlocked: true, visitCount: 1, firstVisitedAt: now },
        },
      },
    }),
    restoreWorldState: vi.fn(),
    restoreDialogueState: vi.fn(),
    restoreUIState: vi.fn(),
    restoreMapState: vi.fn(),
    resetAllStores: vi.fn(),
    ...overrides,
  };
}

// ============================================================
// SaveManager 测试
// ============================================================

describe('SaveManager', () => {
  let manager: SaveManager;
  let storage: MemoryFallbackAdapter;
  let accessors: StoreAccessors;

  beforeEach(() => {
    storage = new MemoryFallbackAdapter();
    manager = new SaveManager(storage);
    accessors = createMockStoreAccessors();
    manager.init(accessors);
  });

  afterEach(() => {
    manager.destroy();
  });

  // ===========================================================================
  // 保存
  // ===========================================================================

  describe('save', () => {
    it('成功保存到空槽位', async () => {
      const result = await manager.save(0, '手动存档');

      expect(result.success).toBe(true);
      expect(result.meta).toBeDefined();
      expect(result.meta!.slotIndex).toBe(0);
      expect(result.meta!.label).toBe('手动存档');
      expect(result.meta!.playerName).toBe('测试冒险者');
      expect(result.meta!.saveVersion).toEqual(CURRENT_SAVE_VERSION);
    });

    it('保存后槽位可列表', async () => {
      await manager.save(0, '存档 0');
      await manager.save(1, '存档 1');

      const saves = await manager.listSaves();
      expect(saves.length).toBe(2);
      expect(saves[0]!.slotIndex).toBe(0);
      expect(saves[1]!.slotIndex).toBe(1);
    });

    it('覆盖已有存档', async () => {
      await manager.save(0, '第一次存档');
      const result = await manager.save(0, '第二次存档');

      expect(result.success).toBe(true);
      expect(result.meta!.label).toBe('第二次存档');

      // createdAt 应保持不变
      const saves = await manager.listSaves();
      expect(saves.length).toBe(1);
    });

    it('槽位索引超出范围失败', async () => {
      const result = await manager.save(-1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('超出范围');

      const result2 = await manager.save(MAX_SAVE_SLOTS);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('超出范围');
    });

    it('未初始化时保存失败', async () => {
      const uninitManager = new SaveManager(storage);
      const result = await uninitManager.save(0);
      expect(result.success).toBe(false);
      expect(result.error).toContain('未初始化');
      uninitManager.destroy();
    });

    it('自动存档标记正确', async () => {
      const result = await manager.save(0, undefined, true);
      expect(result.success).toBe(true);
      expect(result.meta!.isAutoSave).toBe(true);
    });

    it('保存后 hasSave 返回 true', async () => {
      await manager.save(0);
      expect(await manager.hasSave(0)).toBe(true);
      expect(await manager.hasSave(1)).toBe(false);
    });
  });

  // ===========================================================================
  // 加载
  // ===========================================================================

  describe('load', () => {
    it('成功加载已保存的存档', async () => {
      await manager.save(0, '测试加载');

      const result = await manager.load(0);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.player.name).toBe('测试冒险者');
      expect(result.data!.label).toBe('测试加载');
      expect(result.meta).toBeDefined();

      // Store 恢复函数被调用
      expect(accessors.resetAllStores).toHaveBeenCalled();
      expect(accessors.restoreWorldState).toHaveBeenCalled();
      expect(accessors.restoreDialogueState).toHaveBeenCalled();
      expect(accessors.restoreUIState).toHaveBeenCalled();
      expect(accessors.restoreMapState).toHaveBeenCalled();
    });

    it('加载不存在的槽位失败', async () => {
      const result = await manager.load(0);
      expect(result.success).toBe(false);
      expect(result.error).toContain('没有存档');
    });

    it('槽位索引超出范围失败', async () => {
      const result = await manager.load(MAX_SAVE_SLOTS);
      expect(result.success).toBe(false);
    });

    it('未初始化时加载失败', async () => {
      const uninitManager = new SaveManager(storage);
      const result = await uninitManager.load(0);
      expect(result.success).toBe(false);
      uninitManager.destroy();
    });
  });

  // ===========================================================================
  // 删除
  // ===========================================================================

  describe('deleteSave', () => {
    it('成功删除已有存档', async () => {
      await manager.save(0, '待删除存档');
      expect(await manager.hasSave(0)).toBe(true);

      const result = await manager.deleteSave(0);

      expect(result.success).toBe(true);
      expect(await manager.hasSave(0)).toBe(false);
    });

    it('删除不存在的存档失败', async () => {
      const result = await manager.deleteSave(0);
      expect(result.success).toBe(false);
      expect(result.error).toContain('没有存档');
    });

    it('删除后列表更新', async () => {
      await manager.save(0, 'a');
      await manager.save(1, 'b');
      await manager.save(2, 'c');
      expect((await manager.listSaves()).length).toBe(3);

      await manager.deleteSave(1);
      const saves = await manager.listSaves();
      expect(saves.length).toBe(2);
      expect(saves.find((s) => s.slotIndex === 1)).toBeUndefined();
    });
  });

  // ===========================================================================
  // 列出存档
  // ===========================================================================

  describe('listSaves', () => {
    it('空列表', async () => {
      const saves = await manager.listSaves();
      expect(saves).toEqual([]);
    });

    it('按 slotIndex 排序', async () => {
      await manager.save(2, 'c');
      await manager.save(0, 'a');
      await manager.save(1, 'b');

      const saves = await manager.listSaves();
      expect(saves[0]!.slotIndex).toBe(0);
      expect(saves[1]!.slotIndex).toBe(1);
      expect(saves[2]!.slotIndex).toBe(2);
    });
  });

  // ===========================================================================
  // 导出/导入
  // ===========================================================================

  describe('exportSave / importSave', () => {
    it('导出存档为 JSON', async () => {
      await manager.save(0, '导出测试');

      const json = await manager.exportSave(0);
      expect(json).toBeTruthy();
      expect(json!.length).toBeGreaterThan(0);

      // 应该是合法的 JSON
      const parsed = JSON.parse(json!);
      expect(parsed.player.name).toBe('测试冒险者');
    });

    it('导出不存在的存档返回 null', async () => {
      const json = await manager.exportSave(0);
      expect(json).toBeNull();
    });

    it('导入 JSON 到空槽位', async () => {
      // 先保存再导出
      await manager.save(0, '源存档');
      const json = await manager.exportSave(0);

      // 导入到槽位 1
      const result = await manager.importSave(json!, 1);

      expect(result.success).toBe(true);
      expect(result.meta!.slotIndex).toBe(1);

      const saves = await manager.listSaves();
      expect(saves.length).toBe(2);
    });

    it('导入无效 JSON 失败', async () => {
      const result = await manager.importSave('not valid json', 0);
      expect(result.success).toBe(false);
    });
  });

  // ===========================================================================
  // 存储配额
  // ===========================================================================

  describe('checkQuota', () => {
    it('返回配额信息', async () => {
      const quota = await manager.checkQuota();
      expect(quota).toBeDefined();
      expect(quota.quotaBytes).toBeGreaterThan(0);
      expect(quota.usagePercent).toBeGreaterThanOrEqual(0);
      expect(quota.usagePercent).toBeLessThanOrEqual(100);
      expect(typeof quota.isWarning).toBe('boolean');
      expect(typeof quota.isCritical).toBe('boolean');
    });
  });

  // ===========================================================================
  // 游戏时长
  // ===========================================================================

  describe('getPlayTimeMs', () => {
    it('初始游戏时长为当前会话时长', () => {
      const time = manager.getPlayTimeMs();
      expect(time).toBeGreaterThanOrEqual(0);
    });

    it('设置累计时长后正确返回', () => {
      manager.setAccumulatedPlayTime(3600000); // 1 hour
      const time = manager.getPlayTimeMs();
      expect(time).toBeGreaterThanOrEqual(3600000);
    });
  });

  // ===========================================================================
  // getSlotMeta
  // ===========================================================================

  describe('getSlotMeta', () => {
    it('返回槽位元数据', async () => {
      await manager.save(0, '元数据测试');

      const meta = await manager.getSlotMeta(0);
      expect(meta).not.toBeNull();
      expect(meta!.slotIndex).toBe(0);
      expect(meta!.label).toBe('元数据测试');
    });

    it('空槽位返回 null', async () => {
      const meta = await manager.getSlotMeta(0);
      expect(meta).toBeNull();
    });
  });
});
