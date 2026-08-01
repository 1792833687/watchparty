/**
 * AI Generator Unit Tests — Epic 7 Story 7.6
 *
 * Tests for AI-powered game setting generation with mocked OpenRouterClient.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { generateSetting, buildPromptSuggestion } from '@/systems/settings/ai-generator';
import type { AIGenerationConfig } from '@/systems/settings/types';

// ============================================================
// Mock OpenRouterClient
// ============================================================

const mockSendChatCompletion = vi.fn();

vi.mock('@/infrastructure/openrouter/client', () => ({
  OpenRouterClient: vi.fn().mockImplementation(() => ({
    sendChatCompletion: mockSendChatCompletion,
  })),
  getStoredApiKey: vi.fn(() => 'test-api-key'),
  storeApiKey: vi.fn(),
  removeStoredApiKey: vi.fn(),
  hasStoredApiKey: vi.fn(() => true),
  validateApiKey: vi.fn(async () => ({ valid: true })),
}));

// ============================================================
// Test fixtures
// ============================================================

const VALID_AI_RESPONSE = {
  id: 'test-resp',
  model: 'openai/gpt-4o',
  content: JSON.stringify({
    id: 'ai-test-world',
    name: 'AI Test World',
    version: '1.0.0',
    worldMeta: {
      name: 'AI Realm',
      genre: '奇幻',
      tone: '史诗冒险',
      description: '一个由AI创造的测试世界，充满了神秘与奇迹。古老的力量正在苏醒，英雄们必须团结起来面对即将到来的黑暗。',
      tags: ['奇幻', '魔法', '冒险'],
      languageHints: '使用古典中文风格',
    },
    playerOptions: {
      availableClasses: [
        {
          id: 'warrior',
          name: '战士',
          description: '前线的勇者',
          baseAttributes: { hp: 100, mp: 20, strength: 8, dexterity: 5 },
          startingEquipment: ['剑', '盾'],
        },
        {
          id: 'mage',
          name: '法师',
          description: '元素之主',
          baseAttributes: { hp: 60, mp: 100, strength: 2, dexterity: 4 },
          startingEquipment: ['法杖', '法袍'],
        },
        {
          id: 'rogue',
          name: '盗贼',
          description: '暗影行者',
          baseAttributes: { hp: 70, mp: 30, strength: 4, dexterity: 9 },
          startingEquipment: ['匕首', '斗篷'],
        },
      ],
      attributeNames: ['hp', 'mp', 'strength', 'dexterity'],
      characterCreationPrompt: '描述你的英雄...',
    },
    startingLocation: {
      regionId: 'village-start',
      description: '起始村庄',
      openingNarrative: '晨光穿透薄雾，你从旅店的床上醒来。窗外传来铁匠铺的叮当声和市集的喧嚣。一封没有署名的信不知何时被塞进了你的门缝——上面只写着一行字："封印正在瓦解，命运在召唤你。"',
    },
    worldRules: [
      {
        id: 'wr-magic',
        name: '魔法体系',
        description: '魔法分为元素、治愈、暗影三系',
        priority: 9,
        category: 'magic',
      },
      {
        id: 'wr-guild',
        name: '冒险者公会',
        description: '各地设有冒险者公会',
        priority: 7,
        category: 'social',
      },
      {
        id: 'wr-seal',
        name: '古老封印',
        description: '上古封印正在瓦解',
        priority: 10,
        category: 'lore',
      },
    ],
    npcs: [
      { id: 'npc-elder', name: '村长老', role: '村长', description: '老村长', location: 'village-start', personality: '睿智' },
      { id: 'npc-smith', name: '铁匠王', role: '铁匠', description: '铁匠', location: 'village-start', personality: '豪爽' },
      { id: 'npc-mage', name: '神秘法师', role: '法师', description: '神秘法师', location: 'tower-mage', personality: '神秘' },
    ],
    regions: [
      { id: 'village-start', name: '起始村', description: '起始村庄', theme: 'village', npcIds: ['npc-elder', 'npc-smith'] },
      { id: 'tower-mage', name: '法师塔', description: '古老法师塔', theme: 'dungeon', npcIds: ['npc-mage'] },
    ],
    initialHook: '调查封印的秘密',
  }),
  usage: {
    prompt_tokens: 500,
    completion_tokens: 800,
    total_tokens: 1300,
  },
  latency: 2000,
  timeToFirstToken: 2000,
};

const VALID_AI_RESPONSE_IN_CODE_BLOCK = {
  id: 'test-resp-2',
  model: 'openai/gpt-4o',
  content: '```json\n' + JSON.stringify({
    id: 'ai-codeblock-world',
    name: 'CodeBlock World',
    version: '1.0.0',
    worldMeta: {
      name: 'CodeBlock Realm',
      genre: '科幻',
      tone: '黑暗',
      description: '一个被AI在代码块中生成的科幻世界。人类已经离开了地球，现在的家园是一个巨大的环形空间站。',
      tags: ['科幻', '太空'],
      languageHints: '使用科技感强的语言',
    },
    playerOptions: {
      availableClasses: [
        { id: 'engineer', name: '工程师', description: '技术专家', baseAttributes: { hp: 70, mp: 50, tech: 9, strength: 4 }, startingEquipment: ['维修工具'] },
        { id: 'soldier', name: '士兵', description: '战斗专家', baseAttributes: { hp: 100, mp: 20, tech: 3, strength: 9 }, startingEquipment: ['步枪'] },
        { id: 'scout', name: '侦察兵', description: '探索专家', baseAttributes: { hp: 60, mp: 40, tech: 6, strength: 5 }, startingEquipment: ['传感器'] },
      ],
      attributeNames: ['hp', 'mp', 'tech', 'strength'],
      characterCreationPrompt: '你是谁？',
    },
    startingLocation: {
      regionId: 'station-hub',
      description: '空间站中枢',
      openingNarrative: '警报声在走廊中回荡。红色的应急灯光一闪一闪。你从休眠舱中醒来，发现自己是这层甲板上唯一活着的人——或者说，看起来是唯一的。什么出错了？',
    },
    worldRules: [
      { id: 'wr-ai', name: 'AI治理', description: 'AI管理站内一切', priority: 10, category: 'lore' },
      { id: 'wr-oxygen', name: '氧气配给', description: '氧气是稀缺资源', priority: 8, category: 'economy' },
      { id: 'wr-factions', name: '派系对立', description: '科学家vs军方', priority: 7, category: 'social' },
    ],
    npcs: [
      { id: 'npc-ai', name: 'MAVIS', role: 'AI系统', description: '空间站AI', location: 'station-hub', personality: '冷静' },
      { id: 'npc-commander', name: '李指挥官', role: '军事指挥官', description: '军方领袖', location: 'station-hub', personality: '严厉' },
      { id: 'npc-scientist', name: '陈博士', role: '首席科学家', description: '科学家', location: 'lab-deep', personality: '偏执' },
    ],
    regions: [
      { id: 'station-hub', name: '中枢甲板', description: '主甲板', theme: 'city', npcIds: ['npc-ai', 'npc-commander'] },
      { id: 'lab-deep', name: '深层实验室', description: '秘密实验室', theme: 'dungeon', npcIds: ['npc-scientist'] },
    ],
    initialHook: '找出休眠舱故障的真相',
  }) + '\n```',
  usage: {
    prompt_tokens: 400,
    completion_tokens: 700,
    total_tokens: 1100,
  },
  latency: 1500,
  timeToFirstToken: 1500,
};

const DEFAULT_CONFIG: AIGenerationConfig = {
  prompt: '创建一个奇幻冒险世界',
  temperature: 0.8,
  model: 'openai/gpt-4o',
  apiKey: 'test-key',
};

// ============================================================
// Tests
// ============================================================

describe('generateSetting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a valid setting from AI response', async () => {
    mockSendChatCompletion.mockResolvedValueOnce(VALID_AI_RESPONSE);

    const result = await generateSetting(DEFAULT_CONFIG);

    expect(result.success).toBe(true);
    expect(result.setting).toBeDefined();
    expect(result.setting!.worldMeta.name).toBe('AI Realm');
    expect(result.setting!.worldMeta.genre).toBe('奇幻');
    expect(result.setting!.playerOptions?.availableClasses).toHaveLength(3);
    expect(result.setting!.npcs?.length).toBe(3);
    expect(result.setting!.regions?.length).toBe(2);
    expect(result.setting!.createdBy).toBe('ai-generated');
  });

  it('should parse JSON from markdown code block', async () => {
    mockSendChatCompletion.mockResolvedValueOnce(VALID_AI_RESPONSE_IN_CODE_BLOCK);

    const result = await generateSetting(DEFAULT_CONFIG);

    expect(result.success).toBe(true);
    expect(result.setting!.worldMeta.name).toBe('CodeBlock Realm');
    expect(result.setting!.worldMeta.genre).toBe('科幻');
  });

  it('should fail on empty AI response', async () => {
    mockSendChatCompletion.mockResolvedValueOnce({
      ...VALID_AI_RESPONSE,
      content: '',
    });

    const result = await generateSetting(DEFAULT_CONFIG);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should fail on invalid JSON from AI', async () => {
    mockSendChatCompletion.mockResolvedValueOnce({
      ...VALID_AI_RESPONSE,
      content: 'This is not JSON at all, just some random text from the AI.',
    });

    const result = await generateSetting(DEFAULT_CONFIG);
    expect(result.success).toBe(false);
    expect(result.error).toContain('JSON');
    expect(result.rawOutput).toBeDefined();
  });

  it('should fail on incomplete setting (missing required fields)', async () => {
    mockSendChatCompletion.mockResolvedValueOnce({
      ...VALID_AI_RESPONSE,
      content: JSON.stringify({
        id: 'incomplete',
        // missing name, version, worldMeta
      }),
    });

    const result = await generateSetting(DEFAULT_CONFIG);
    expect(result.success).toBe(false);
    expect(result.error).toContain('缺少必需字段');
  });

  it('should assign unique IDs for AI-generated settings', async () => {
    mockSendChatCompletion.mockResolvedValueOnce(VALID_AI_RESPONSE);

    const result = await generateSetting(DEFAULT_CONFIG);
    expect(result.success).toBe(true);
    expect(result.setting!.id).toBe('ai-test-world');
  });

  it('should handle API errors gracefully', async () => {
    mockSendChatCompletion.mockRejectedValueOnce(new Error('Network error'));

    const result = await generateSetting(DEFAULT_CONFIG);
    expect(result.success).toBe(false);
    expect(result.error).toContain('AI 生成失败');
  });

  it('should pass correct messages to OpenRouter', async () => {
    mockSendChatCompletion.mockResolvedValueOnce(VALID_AI_RESPONSE);

    await generateSetting({
      ...DEFAULT_CONFIG,
      prompt: 'custom prompt',
      temperature: 0.5,
      model: 'anthropic/claude-3.5-sonnet',
    });

    expect(mockSendChatCompletion).toHaveBeenCalledTimes(1);

    const [llmConfig, messages] = mockSendChatCompletion.mock.calls[0] as [
      { model: string; temperature: number },
      Array<{ role: string; content: string }>,
    ];

    expect(llmConfig.model).toBe('anthropic/claude-3.5-sonnet');
    expect(llmConfig.temperature).toBe(0.5);
    expect(messages).toHaveLength(2);
    expect(messages[0]!.role).toBe('system');
    expect(messages[1]!.role).toBe('user');
    expect(messages[1]!.content).toBe('custom prompt');
  });
});

// ============================================================
// buildPromptSuggestion
// ============================================================

describe('buildPromptSuggestion', () => {
  it('should return fantasy prompt', () => {
    const prompt = buildPromptSuggestion('fantasy');
    expect(prompt).toContain('奇幻');
    expect(prompt).toContain('中世纪');
  });

  it('should return scifi prompt', () => {
    const prompt = buildPromptSuggestion('scifi');
    expect(prompt).toContain('科幻');
  });

  it('should return horror prompt', () => {
    const prompt = buildPromptSuggestion('horror');
    expect(prompt).toContain('克苏鲁');
  });

  it('should return wuxia prompt', () => {
    const prompt = buildPromptSuggestion('wuxia');
    expect(prompt).toContain('武侠');
  });

  it('should return default prompt for unknown theme', () => {
    const prompt = buildPromptSuggestion('unknown-theme');
    expect(prompt).toContain('有趣的');
  });
});
