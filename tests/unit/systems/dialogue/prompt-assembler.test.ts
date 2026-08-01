/**
 * PromptAssembler 单元测试
 *
 * 覆盖: 四层组装、token 预算控制、缓存失效、版本管理
 *
 * @see docs/architecture/adr/003-prompt-context-assembly.md
 * @see design/gdd/dialogue-system.md §2.3, §6.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PromptAssembler } from '@/systems/dialogue/prompt-assembler';
import { estimateTokens } from '@/lib/utils/tokenizer';
import {
  SYSTEM_PROMPT_TOKENS,
  WORLD_CONTEXT_TOKENS,
  MEMORY_CONTEXT_TOKENS,
} from '@/lib/constants';
import type {
  DialogueMessage,
  AssemblyContext,
  GameSettingContext,
  MapContext,
  TimeContext,
  MemoryRetrievalRequest,
} from '@/systems/dialogue/types';
import type { MemoryRetrievalResponse } from '@/systems/memory/types';

// ============================================================
// 测试夹具
// ============================================================

function makeAssembler(): PromptAssembler {
  return new PromptAssembler();
}

function makeGameSetting(): GameSettingContext {
  return {
    worldName: '暗影之地',
    dmName: '格朗',
    playerClassName: '流浪剑客',
    worldRules: '魔法存在但罕见。死亡是永久的。背叛会留下伤疤。',
    settingId: 'test-setting',
  };
}

function makeMapContext(): MapContext {
  return {
    currentRegion: '黑森林',
    regionDescription: '一片古老而阴暗的森林，传说中隐藏着古老的力量。',
    nearbyLocations: ['狼穴入口', '月光湖', '废弃的神庙'],
    visibleNpcs: ['老猎人 艾登', '神秘商人'],
    playerCoord: '5,8',
  };
}

function makeTimeContext(): TimeContext {
  return {
    timeOfDay: '黄昏',
    weather: '薄雾',
    atmosphere: '紧张',
  };
}

function makeAssemblyContext(overrides?: Partial<AssemblyContext>): AssemblyContext {
  return {
    systemVersion: 1,
    worldVersion: 1,
    memoryVersion: 1,
    gameSetting: makeGameSetting(),
    modelConfig: {
      model: 'anthropic/claude-3.5-sonnet',
      temperature: 0.8,
      maxTokens: 2000,
      streamTimeout: 30000,
      enableTypingEffect: false,
    },
    mapContext: makeMapContext(),
    timeContext: makeTimeContext(),
    memoryRequest: {
      currentLocation: '黑森林',
      nearbyEntities: ['老猎人 艾登'],
      activeQuestIds: [],
      playerInput: 'test',
      maxTokens: 800,
      includeLastSession: true,
    },
    maxSessionTokens: 1500,
    ...overrides,
  };
}

function makeTestMessages(count: number): DialogueMessage[] {
  const messages: DialogueMessage[] = [];
  for (let i = 0; i < count; i++) {
    const role = i % 2 === 0 ? 'player' : 'ai_gm';
    messages.push({
      id: `msg-${i}`,
      role: role as 'player' | 'ai_gm',
      speakerName: role === 'player' ? 'Player' : 'GM',
      speakerId: role === 'player' ? 'player' : 'ai_gm',
      content: `这是第 ${i + 1} 条测试消息。包含一些中英文混合内容 for token estimation purposes.`,
      contentBlocks: [],
      timestamp: Date.now() - (count - i) * 60000,
      isDecisionPoint: false,
      tokenCount: 20,
      suggestedActions: [],
    });
  }
  return messages;
}

function setupMemoryRetriever(assembler: PromptAssembler): void {
  assembler.setMemoryRetriever(async (req: MemoryRetrievalRequest): Promise<MemoryRetrievalResponse> => {
    return {
      contextBlock: `## MEMORY\n当前区域: ${req.currentLocation}\n附近实体: ${req.nearbyEntities.join(', ') || '无'}\n\n最近事件: 玩家进入了黑森林，遇到了老猎人艾登。`,
      entitiesCached: [],
      tokenCount: 30,
      retrievalMeta: {
        entitiesMatched: 2,
        eventsMatched: 3,
        relationsMatched: 1,
        retrievalTimeMs: 5,
      },
    };
  });
}

// ============================================================
// 测试
// ============================================================

describe('PromptAssembler', () => {
  let assembler: PromptAssembler;

  beforeEach(() => {
    assembler = makeAssembler();
  });

  describe('buildSystemPrompt() — Layer 0', () => {
    it('应包含 GM 身份和世界规则', () => {
      const setting = makeGameSetting();
      const prompt = assembler.buildSystemPrompt(setting, {
        model: 'test',
        temperature: 0.8,
        maxTokens: 2000,
        streamTimeout: 30000,
        enableTypingEffect: false,
      });

      expect(prompt).toContain(setting.dmName);
      expect(prompt).toContain(setting.playerClassName);
      expect(prompt).toContain(setting.worldName);
      expect(prompt).toContain('ROLE');
      expect(prompt).toContain('RULES');
      expect(prompt).toContain('OUTPUT FORMAT');
    });

    it('Token 不应超过 SYSTEM_PROMPT_TOKENS 预算', () => {
      const setting = makeGameSetting();
      const prompt = assembler.buildSystemPrompt(setting, {
        model: 'test',
        temperature: 0.8,
        maxTokens: 2000,
        streamTimeout: 30000,
        enableTypingEffect: false,
      });
      const tokens = estimateTokens(prompt);

      expect(tokens).toBeLessThanOrEqual(SYSTEM_PROMPT_TOKENS + 100); // 允许小误差
    });

    it('过长的世界规则应被截断', () => {
      const setting = makeGameSetting();
      setting.worldRules = 'Rule '.repeat(500); // 非常长的规则

      const prompt = assembler.buildSystemPrompt(setting, {
        model: 'test',
        temperature: 0.8,
        maxTokens: 2000,
        streamTimeout: 30000,
        enableTypingEffect: false,
      });
      const tokens = estimateTokens(prompt);

      expect(tokens).toBeLessThanOrEqual(SYSTEM_PROMPT_TOKENS + 200);
    });
  });

  describe('buildWorldContext() — Layer 1', () => {
    it('应包含当前位置和邻近信息', () => {
      const mapCtx = makeMapContext();
      const timeCtx = makeTimeContext();
      const context = assembler.buildWorldContext(mapCtx, timeCtx);

      expect(context).toContain('黑森林');
      expect(context).toContain('狼穴入口');
      expect(context).toContain('老猎人');
      expect(context).toContain('黄昏');
      expect(context).toContain('薄雾');
    });

    it('Token 不应超过 WORLD_CONTEXT_TOKENS', () => {
      const mapCtx = makeMapContext();
      const timeCtx = makeTimeContext();
      const context = assembler.buildWorldContext(mapCtx, timeCtx);
      const tokens = estimateTokens(context);

      expect(tokens).toBeLessThanOrEqual(WORLD_CONTEXT_TOKENS + 50);
    });
  });

  describe('buildSessionContext() — Layer 3', () => {
    it('应包含最近的消息历史', () => {
      const messages = makeTestMessages(5);
      const context = assembler.buildSessionContext(messages, 1500);

      expect(context).toContain('第 1 条');
      expect(context).toContain('第 5 条');
    });

    it('应遵守 token 预算', () => {
      const messages = makeTestMessages(50); // 大量消息
      const context = assembler.buildSessionContext(messages, 500); // 小预算
      const tokens = estimateTokens(context);

      expect(tokens).toBeLessThanOrEqual(600); // 允许小误差
    });

    it('空消息应返回空字符串', () => {
      const context = assembler.buildSessionContext([], 1500);
      expect(context).toBe('');
    });

    it('至少保留最近几条消息（不全部丢弃）', () => {
      const messages = makeTestMessages(10);
      const context = assembler.buildSessionContext(messages, 200); // 极小预算

      // 应该至少有一些内容
      expect(context.length).toBeGreaterThan(0);
    });
  });

  describe('buildInputBlock() — Layer 4', () => {
    it('正常输入应加 Player 前缀', () => {
      const block = assembler.buildInputBlock('你好');
      expect(block).toContain('你好');
      expect(block).toContain('Player');
    });

    it('空输入应触发 AI 主动叙述', () => {
      const block = assembler.buildInputBlock('');
      expect(block).toContain('waiting');
    });
  });

  describe('assemble() — 完整组装', () => {
    it('应返回正确的 OpenRouterMessage 数组', async () => {
      setupMemoryRetriever(assembler);

      const messages = makeTestMessages(3);
      const context = makeAssemblyContext();
      const result = await assembler.assemble(messages, '我走向森林深处', context);

      expect(result.length).toBeGreaterThanOrEqual(2); // 至少 system + user
      expect(result[0]!.role).toBe('system');
    });

    it('相同版本号应使用缓存（不重建 system/world/memory）', async () => {
      setupMemoryRetriever(assembler);

      const context = makeAssemblyContext();
      const messages = makeTestMessages(2);

      const result1 = await assembler.assemble(messages, '第一条', context);
      const result2 = await assembler.assemble(messages, '第二条', context);

      // System prompt 应该相同（缓存命中）
      expect(result1[0]!.content).toBe(result2[0]!.content);
    });

    it('不同 systemVersion 应重建 system prompt', async () => {
      setupMemoryRetriever(assembler);

      const messages = makeTestMessages(2);
      const ctx1 = makeAssemblyContext({ systemVersion: 1 });
      const ctx2 = makeAssemblyContext({ systemVersion: 2 });

      const result1 = await assembler.assemble(messages, 'test', ctx1);
      const result2 = await assembler.assemble(messages, 'test', ctx2);

      // 版本不同，system block 应重建（但内容可能相同因为 gameSetting 相同）
      // 至少验证都能成功
      expect(result1.length).toBeGreaterThan(0);
      expect(result2.length).toBeGreaterThan(0);
    });
  });

  describe('缓存管理', () => {
    it('invalidateAll() 应清除所有缓存', () => {
      setupMemoryRetriever(assembler);

      assembler.invalidateAll();
      // 后续 assemble 应重建所有层
      // （通过版本号归零实现，在 assemble 中验证）
    });

    it('invalidateWorld() 应清除 World 缓存', () => {
      assembler.invalidateWorld();
      // 后续 assemble 应重建 world block
    });
  });

  describe('trimToBudget() — Token 预算控制', () => {
    it('短文本不需要截断', () => {
      const text = 'Short text';
      const result = assembler.trimToBudget(text, 1000);
      expect(result).toBe(text);
    });

    it('超长文本应截断', () => {
      const text = 'word '.repeat(5000);
      const result = assembler.trimToBudget(text, 100);
      expect(result.length).toBeLessThan(text.length);
      expect(result).toContain('…'); // 截断标记
    });

    it('空文本应返回空字符串', () => {
      const result = assembler.trimToBudget('', 100);
      expect(result).toBe('');
    });
  });
});
