/**
 * AI Setting Generator — AI Narrator Game
 *
 * Generates a complete game setting via OpenRouter API based on user prompt.
 * Corresponds to Epic 7 Story 7.3 and concept M08.
 *
 * Uses the existing OpenRouterClient from infrastructure.
 *
 * @module systems/settings/ai-generator
 */

import { OpenRouterClient } from '@/infrastructure/openrouter/client';
import type { LLMConfig, OpenRouterMessage } from '@/systems/dialogue/types';
import { validate } from './settings-loader';
import type {
  AIGenerationConfig,
  AIGenerationResult,
  GameSetting,
} from './types';

// ============================================================
// System Prompt Template
// ============================================================

const SETTING_GENERATOR_PROMPT = `你是一个专业的游戏设定设计师。根据用户的描述，生成一个完整的 TRPG 风格游戏世界设定。

输出必须是一个严格的 JSON 对象，包含以下结构：

{
  "id": "ai-generated-<随机字符串>",
  "name": "<设定名称>",
  "version": "1.0.0",
  "worldMeta": {
    "name": "<世界名称>",
    "genre": "<类型，如：奇幻/科幻/恐怖/武侠/现代>",
    "tone": "<基调，如：史诗冒险/黑暗压抑/轻松幽默/神秘悬疑>",
    "description": "<世界整体描述，200-500字>",
    "tags": ["<标签1>", "<标签2>", ...],
    "languageHints": "<给AI GM的语言风格建议>"
  },
  "playerOptions": {
    "availableClasses": [
      {
        "id": "<职业ID>",
        "name": "<职业名称>",
        "description": "<职业描述>",
        "baseAttributes": {
          "hp": <数值>,
          "mp": <数值>,
          ...
        },
        "startingEquipment": ["<初始装备>", ...]
      }
    ],
    "attributeNames": ["<属性名1>", "<属性名2>", ...],
    "characterCreationPrompt": "<创角引导文案>"
  },
  "startingLocation": {
    "regionId": "<起始区域ID>",
    "description": "<起始场景描述>",
    "openingNarrative": "<开场叙事，300-500字，包含悬念钩子>"
  },
  "worldRules": [
    {
      "id": "wr-<规则简称>",
      "name": "<规则名称>",
      "description": "<规则描述>",
      "priority": <1-10>,
      "category": "combat|magic|social|economy|lore|other"
    }
  ],
  "npcs": [
    {
      "id": "npc-<名称>",
      "name": "<NPC名称>",
      "role": "<NPC角色/职业>",
      "description": "<NPC描述>",
      "location": "<所在区域ID>",
      "personality": "<性格特征>"
    }
  ],
  "regions": [
    {
      "id": "region-<名称>",
      "name": "<区域名称>",
      "description": "<区域描述>",
      "theme": "<主题，如：village/forest/mountain/city/desert/ocean/dungeon>",
      "npcIds": ["<关联NPC ID>", ...]
    }
  ],
  "initialHook": "<初始剧情钩子，一句话>",
  "createdBy": "ai-generated"
}

要求：
1. 提供至少 3 个不同的玩家职业
2. 提供至少 4 个属性维度（如 hp, mp, strength, dexterity 等）
3. 至少 3 个世界规则
4. 至少 3 个 NPC
5. 至少 2 个区域
6. 开场叙事必须包含悬念钩子，吸引玩家继续探索
7. 所有文本使用中文
8. 确保所有 ID 是唯一的
9. JSON 必须是合法的，不要有注释或省略` as const;

// ============================================================
// JSON Extraction
// ============================================================

/**
 * Extract JSON object from AI response text.
 * Handles cases where AI wraps JSON in markdown code blocks.
 */
function extractJSON(text: string): string {
  // Try markdown code block first
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1]!.trim();
  }

  // Try to find JSON object boundaries
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  return text.trim();
}

// ============================================================
// Generate Setting
// ============================================================

/**
 * Generate a game setting using AI.
 *
 * @param config - AI generation configuration
 * @param timeoutMs - Maximum wait time in milliseconds (default 60s)
 * @returns AIGenerationResult with the parsed setting or error details
 */
export async function generateSetting(
  config: AIGenerationConfig,
  timeoutMs: number = 60000
): Promise<AIGenerationResult> {
  const client = new OpenRouterClient({
    apiKey: config.apiKey,
  });

  const llmConfig: LLMConfig = {
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens ?? 4096,
    streamTimeout: timeoutMs,
    enableTypingEffect: false,
  };

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: SETTING_GENERATOR_PROMPT },
    { role: 'user', content: config.prompt },
  ];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await client.sendChatCompletion(llmConfig, messages, controller.signal);
    clearTimeout(timeoutId);

    const rawContent = response.content;
    if (!rawContent) {
      return {
        success: false,
        error: 'AI 未返回有效内容，请尝试调整 prompt 后重试',
        rawOutput: JSON.stringify(response),
      };
    }

    // Extract and parse JSON
    const jsonStr = extractJSON(rawContent);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return {
        success: false,
        error: 'AI 返回的内容不是有效的 JSON 格式，请重试',
        rawOutput: rawContent,
      };
    }

    // Validate the parsed setting
    const validationResult = validate(parsed);
    if (!validationResult.valid) {
      return {
        success: false,
        error: 'AI 生成的设定缺少必需字段',
        rawOutput: rawContent,
        validationErrors: validationResult.errors,
      };
    }

    // Ensure createdBy is set
    const setting = parsed as GameSetting;
    setting.createdBy = 'ai-generated';
    if (!setting.createdAt) {
      setting.createdAt = new Date().toISOString();
    }
    if (!setting.id || setting.id === 'ai-generated-<随机字符串>') {
      setting.id = `ai-generated-${Date.now().toString(36)}`;
    }

    return {
      success: true,
      setting,
      rawOutput: jsonStr,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : '未知错误';
    return {
      success: false,
      error: `AI 生成失败: ${errorMessage}`,
    };
  }
}

// ============================================================
// Prompt Template Helpers
// ============================================================

/**
 * Build a suggested prompt for the user based on common themes.
 */
export function buildPromptSuggestion(theme: string): string {
  const suggestions: Record<string, string> = {
    fantasy: '创建一个中世纪奇幻世界，魔法正在消退，人类王国面临来自北方的未知威胁。世界需要至少3个独特种族。',
    scifi: '创建一个近未来科幻世界，人类已殖民太阳系。AI治理与人类自由之间的张力是核心冲突。',
    horror: '创建一个克苏鲁式恐怖世界，设定在1920年代的美国新英格兰地区。隐秘的邪教与不可名状的存在潜伏在阴影中。',
    wuxia: '创建一个武侠世界，江湖门派林立，一本失传已久的武功秘籍重新现世，引发天下纷争。',
    postapocalyptic: '创建一个后末日世界，核战后的废土上，幸存者在废墟中建立了新的文明雏形。',
  };

  return suggestions[theme] ?? '请创建一个有趣的游戏世界设定。';
}
