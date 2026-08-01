/**
 * Sprint 0 — Epic 1 验收测试: 四个 Zustand Store 实例化验证
 *
 * @ai-generated
 * @prompt: "创建 4 个 Zustand Store 的实例化 + reset() 功能验证测试"
 * @date: 2025-07-30
 * @model: claude-sonnet-4-20250514
 */

import { describe, expect, it } from 'vitest';
import { useWorldStore } from '../../../src/stores/world-store';
import { useDialogueStore } from '../../../src/stores/dialogue-store';
import { useMapStore } from '../../../src/stores/map-store';
import { useUIStore } from '../../../src/stores/ui-store';

describe('Store Instantiation — Epic 1 验收', () => {
  it('1. WorldStore 应成功实例化', () => {
    const store = useWorldStore;
    expect(store).toBeDefined();
    const state = store.getState();

    expect(state.playerName).toBe('');
    expect(state.playerClass).toBe('');
    expect(state.playerAttributes).toEqual({});
    expect(state.worldStateDigest).toBeNull();
    expect(state.gameSetting).toBeNull();
    expect(state.isSettingLoaded).toBe(false);
    expect(state.saveSlots).toEqual([]);
    expect(state.currentSaveSlotId).toBeNull();

    // 验证 actions 存在
    expect(typeof state.loadGameSetting).toBe('function');
    expect(typeof state.updatePlayerAttribute).toBe('function');
    expect(typeof state.syncWorldStateDigest).toBe('function');
    expect(typeof state.reset).toBe('function');
  });

  it('2. WorldStore.reset() 应恢复初始状态', () => {
    const store = useWorldStore;

    // 先修改状态
    store.setState({
      playerName: 'Test Hero',
      playerClass: 'Warrior',
      playerAttributes: { strength: 10 },
      isSettingLoaded: true,
    });

    // 验证修改成功
    expect(store.getState().playerName).toBe('Test Hero');

    // 重置
    store.getState().reset();

    // 验证回到初始状态
    expect(store.getState().playerName).toBe('');
    expect(store.getState().playerClass).toBe('');
    expect(store.getState().playerAttributes).toEqual({});
    expect(store.getState().isSettingLoaded).toBe(false);
  });

  it('3. DialogueStore 应成功实例化', () => {
    const store = useDialogueStore;
    expect(store).toBeDefined();
    const state = store.getState();

    expect(state.messages).toEqual([]);
    expect(state.narrativeState.currentAct).toBe(1);
    expect(state.isStreaming).toBe(false);
    expect(state.streamedText).toBe('');
    expect(state.currentSuggestions).toEqual([]);
    expect(state.activeDecision).toBeNull();
    expect(state.sessionMeta).toBeNull();

    expect(typeof state.sendMessage).toBe('function');
    expect(typeof state.clearStreamedText).toBe('function');
    expect(typeof state.reset).toBe('function');
  });

  it('4. DialogueStore.reset() 应恢复初始状态', () => {
    const store = useDialogueStore;

    store.setState({
      messages: [
        {
          id: 'test-1',
          role: 'ai_gm',
          speakerName: 'GM',
          speakerId: 'ai_gm',
          content: 'test',
          contentBlocks: [],
          timestamp: Date.now(),
          isDecisionPoint: false,
          tokenCount: 5,
          suggestedActions: [],
        },
      ],
      isStreaming: true,
      streamedText: 'some text...',
    });

    expect(store.getState().messages.length).toBe(1);

    store.getState().reset();

    expect(store.getState().messages).toEqual([]);
    expect(store.getState().isStreaming).toBe(false);
    expect(store.getState().streamedText).toBe('');
  });

  it('5. MapStore 应成功实例化', () => {
    const store = useMapStore;
    expect(store).toBeDefined();
    const state = store.getState();

    expect(state.currentRegionId).toBe('');
    expect(state.currentRegion).toBeNull();
    expect(state.tiles instanceof Map).toBe(true);
    expect(state.entities instanceof Map).toBe(true);
    expect(state.playerCoord).toEqual({ col: 0, row: 0 });
    expect(state.isMoving).toBe(false);
    expect(state.movePath).toEqual([]);
    expect(state.zoomLevel).toBe(1.0);

    expect(typeof state.moveTo).toBe('function');
    expect(typeof state.cancelMovement).toBe('function');
    expect(typeof state.setZoom).toBe('function');
    expect(typeof state.reset).toBe('function');
  });

  it('6. MapStore.reset() 应恢复初始状态', () => {
    const store = useMapStore;

    store.setState({
      playerCoord: { col: 5, row: 3 },
      isMoving: true,
      zoomLevel: 1.5,
    });

    expect(store.getState().playerCoord.col).toBe(5);

    store.getState().reset();

    expect(store.getState().playerCoord).toEqual({ col: 0, row: 0 });
    expect(store.getState().isMoving).toBe(false);
    expect(store.getState().zoomLevel).toBe(1.0);
  });

  it('7. UIStore 应成功实例化', () => {
    const store = useUIStore;
    expect(store).toBeDefined();
    const state = store.getState();

    expect(state.theme).toBe('dark');
    expect(state.activePanel).toBe('dialogue');
    expect(state.activeModal).toBeNull();
    expect(state.toasts).toEqual([]);
    expect(state.aiAvatarState).toBe('idle');
    expect(state.selectedModel).toBe('openai/gpt-4o');
    expect(state.typingEffectEnabled).toBe(true);
    expect(state.soundEnabled).toBe(false);
    expect(state.reducedMotion).toBe(false);

    expect(typeof state.setTheme).toBe('function');
    expect(typeof state.openModal).toBe('function');
    expect(typeof state.closeModal).toBe('function');
    expect(typeof state.addToast).toBe('function');
    expect(typeof state.reset).toBe('function');
  });

  it('8. UIStore.reset() 应恢复初始状态', () => {
    const store = useUIStore;

    store.setState({
      theme: 'light',
      activeModal: 'settings',
      aiAvatarState: 'thinking',
      typingEffectEnabled: false,
    });

    expect(store.getState().theme).toBe('light');

    store.getState().reset();

    expect(store.getState().theme).toBe('dark');
    expect(store.getState().activeModal).toBeNull();
    expect(store.getState().aiAvatarState).toBe('idle');
    expect(store.getState().typingEffectEnabled).toBe(true);
  });
});
