'use client';

/**
 * TextImportModal — AI Narrator Game v0.3.0
 *
 * Feature 2: Paste text → AI analysis → auto-generate GameSetting.
 * Accepts novel fragments, world descriptions, etc. and calls
 * OpenRouter/DeepSeek to produce structured game settings.
 */

import React, { useCallback, useState } from 'react';
import type { GameSetting, AIGenerationResult } from '@/systems/settings/types';

// ============================================================
// Types
// ============================================================

interface CustomApiConfig {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
}

export interface TextImportModalProps {
  /** Called when user confirms the generated setting */
  onConfirm: (setting: GameSetting) => void;
  /** Called when user closes the modal */
  onClose: () => void;
  /** OpenRouter API key (primary) */
  openRouterKey: string;
  /** Selected model ID */
  model: string;
}

// ============================================================
// AI Prompt
// ============================================================

const TEXT_ANALYZER_PROMPT = `你是一个专业的TRPG游戏设定设计师。请分析用户提供的文本内容，从中提取或推断出一个完整的游戏世界设定。

## 输出格式要求

首先，用2-3句话简要总结你从文本中分析出的世界观概要（类型、基调、核心冲突）。

然后，在 \`\`\`json 代码块中输出完整的游戏设定JSON：

\`\`\`json
{
  "gameIntro": "<2-3句世界观概要>",
  "id": "text-import-<随机字符串>",
  "name": "<设定名称>",
  "version": "1.0.0",
  "worldMeta": {
    "name": "<世界名称>",
    "genre": "<类型，如：奇幻/科幻/恐怖/武侠/现代>",
    "tone": "<基调，如：史诗冒险/黑暗压抑/轻松幽默/神秘悬疑>",
    "description": "<世界整体描述，200-500字>",
    "tags": ["<标签1>", "<标签2>", "..."],
    "languageHints": "<给AI GM的语言风格建议>"
  },
  "playerOptions": {
    "totalAttributePoints": 15,
    "availableClasses": [
      {
        "id": "<职业ID>",
        "name": "<职业名称>",
        "description": "<职业描述>",
        "baseAttributes": {
          "strength": <数值>,
          "agility": <数值>,
          "intelligence": <数值>,
          "constitution": <数值>,
          "charisma": <数值>
        },
        "startingEquipment": ["<初始装备>", "..."]
      }
    ],
    "attributeNames": ["strength", "agility", "intelligence", "constitution", "charisma"],
    "characterCreationPrompt": "<创角引导文案>"
  },
  "startingLocation": {
    "regionId": "<起始区域ID>",
    "description": "<起始场景描述>",
    "openingNarrative": "<开场叙事，300-500字>"
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
      "theme": "<village|forest|mountain|city|desert|ocean|dungeon>",
      "npcIds": ["<关联NPC ID>"]
    }
  ],
  "initialHook": "<初始剧情钩子>",
  "createdBy": "ai-generated"
}
\`\`\`

## 要求：
1. 尽可能从文本中提取世界观元素（地点、人物、事件、规则）
2. 提供至少3个玩家职业，每个职业的baseAttributes中5项属性总和应在12-18之间
3. 开场叙事要有悬念感
4. 所有文本使用中文
5. JSON必须是合法的，不要有注释或省略
6. 优先输出 gameIntro 概要，然后输出完整JSON`;

// ============================================================
// Component
// ============================================================

export function TextImportModal({
  onConfirm,
  onClose,
  openRouterKey,
  model,
}: TextImportModalProps): React.ReactElement {
  const [text, setText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [analyzingStage, setAnalyzingStage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<GameSetting | null>(null);
  const [editableJson, setEditableJson] = useState('');
  const [editMode, setEditMode] = useState(false);

  // ── Get custom API config ──
  const getCustomConfig = useCallback((): CustomApiConfig | null => {
    try {
      const raw = localStorage.getItem('custom-api-config');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CustomApiConfig;
      if (parsed.enabled && parsed.endpoint && parsed.apiKey) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // ── Extract JSON from AI response ──
  const extractJSON = useCallback((content: string): string | null => {
    // Strategy 1: code block with json tag
    const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1]!.trim();
    }
    // Strategy 2: find outermost braces
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return content.slice(firstBrace, lastBrace + 1).trim();
    }
    return null;
  }, []);

  // ── Single API call ──
  const callAI = useCallback(async (
    endpoint: string,
    key: string,
    isCustom: boolean,
    signal?: AbortSignal,
  ): Promise<string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    };

    if (!isCustom) {
      headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : '';
      headers['X-Title'] = 'AI Narrator Game';
    }

    const body: Record<string, unknown> = {
      model: isCustom ? 'deepseek-chat' : model,
      messages: [
        { role: 'system', content: TEXT_ANALYZER_PROMPT },
        { role: 'user', content: `请分析以下文本，提取游戏世界设定：\n\n${text}` },
      ],
      stream: false,
      max_tokens: 4096,
      temperature: 0.7,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      if (response.status === 401) throw new Error('API Key 无效，请检查配置');
      if (response.status === 429) throw new Error('请求过于频繁，请等待30秒后重试');
      if (response.status === 403) throw new Error('API 访问被拒绝，请检查权限');
      throw new Error(`API 错误 (${response.status}): ${errText.slice(0, 100)}`);
    }

    const data = await response.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '';

    if (!content) {
      throw new Error('AI 未返回有效内容，请尝试缩短文本或更换模型');
    }

    return content;
  }, [text, model]);

  // ── AI Analysis with retry ──
  const handleAnalyze = useCallback(async () => {
    if (!text.trim()) return;

    setGenerating(true);
    setError('');
    setResult(null);
    setAnalyzingStage('正在调用 AI 分析文本…');

    const custom = getCustomConfig();
    const isCustom = !!custom;

    let endpoint: string;
    let key: string;

    if (custom) {
      endpoint = custom.endpoint.replace(/\/+$/, '') + '/chat/completions';
      key = custom.apiKey;
    } else {
      if (!openRouterKey) {
        setError('请先在 API 配置中设置 OpenRouter API Key');
        setGenerating(false);
        setAnalyzingStage('');
        return;
      }
      endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      key = openRouterKey;
    }

    // First attempt
    let content: string;
    try {
      content = await callAI(endpoint, key, isCustom);
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败');
      setGenerating(false);
      setAnalyzingStage('');
      return;
    }

    // Try to parse JSON from response
    setAnalyzingStage('正在解析 AI 返回的设定…');
    let jsonStr = extractJSON(content);
    let parsed: GameSetting | null = null;

    if (jsonStr) {
      try {
        parsed = JSON.parse(jsonStr) as GameSetting;
      } catch {
        // JSON parse failed, will retry
        parsed = null;
      }
    }

    // Retry once if JSON extraction/parsing failed
    if (!parsed) {
      setAnalyzingStage('JSON 解析失败，正在重试（1/1）…');
      try {
        // Use a shorter, more explicit retry prompt
        const retryHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        };
        if (!isCustom) {
          retryHeaders['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : '';
          retryHeaders['X-Title'] = 'AI Narrator Game';
        }

        const retryBody: Record<string, unknown> = {
          model: isCustom ? 'deepseek-chat' : model,
          messages: [
            { role: 'system', content: TEXT_ANALYZER_PROMPT },
            { role: 'user', content: `请分析以下文本，提取游戏世界设定：\n\n${text}` },
            { role: 'assistant', content: content },
            { role: 'user', content: '你上次返回的JSON格式不正确，无法解析。请严格按照要求，在```json代码块中输出完整合法的JSON。确保所有字符串使用双引号，数值不使用引号。不要添加注释或省略号。' },
          ],
          stream: false,
          max_tokens: 4096,
          temperature: 0.3,
        };

        const retryResponse = await fetch(endpoint, {
          method: 'POST',
          headers: retryHeaders,
          body: JSON.stringify(retryBody),
          signal: AbortSignal.timeout(60000),
        });

        if (!retryResponse.ok) {
          throw new Error('重试请求失败');
        }

        const retryData = await retryResponse.json();
        const retryContent: string = retryData?.choices?.[0]?.message?.content ?? '';

        if (!retryContent) {
          throw new Error('重试未返回内容');
        }

        const retryJson = extractJSON(retryContent);
        if (retryJson) {
          parsed = JSON.parse(retryJson) as GameSetting;
        }
      } catch {
        // Retry also failed
        setError('AI 返回的内容无法解析为有效 JSON。请尝试：\n1. 更换输入文本\n2. 使用更简短的描述\n3. 切换 AI 模型后重试');
        setGenerating(false);
        setAnalyzingStage('');
        return;
      }
    }

    if (!parsed) {
      setError('AI 返回的内容无法解析。请尝试使用更简短的文本描述，或更换 AI 模型。');
      setGenerating(false);
      setAnalyzingStage('');
      return;
    }

    // Ensure required fields
    parsed.id = parsed.id || `text-import-${Date.now().toString(36)}`;
    parsed.createdBy = 'ai-generated';
    parsed.createdAt = new Date().toISOString();

    setResult(parsed);
    setEditableJson(JSON.stringify(parsed, null, 2));
    setAnalyzingStage('');
    setGenerating(false);
  }, [text, openRouterKey, model, getCustomConfig, callAI, extractJSON]);

  // ── Edit handler ──
  const handleEditSave = useCallback(() => {
    try {
      const parsed = JSON.parse(editableJson) as GameSetting;
      setResult(parsed);
      setEditMode(false);
      setError('');
    } catch {
      setError('JSON 格式无效，请修正');
    }
  }, [editableJson]);

  // ── Confirm ──
  const handleConfirm = useCallback(() => {
    if (result) {
      onConfirm(result);
    }
  }, [result, onConfirm]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg-panel)',
          borderRadius: 16,
          border: '1px solid var(--border-subtle)',
          padding: '1.5rem',
          maxWidth: 700,
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            📄 粘贴文本导入
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          粘贴小说片段、世界观描述或任何文本。AI 将分析内容并自动生成游戏设定。
        </p>

        {/* Text Input */}
        {!result && (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="例如：在这片被遗忘的大陆上，三大帝国已经争战了千年。北方的冰原帝国掌握着古老的符文魔法，南方的丛林王国精通自然之力，而中央的钢铁联邦则依赖蒸汽与机械..."
              rows={10}
              disabled={generating}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '0.9375rem',
                lineHeight: 1.6,
                resize: 'vertical',
                outline: 'none',
                marginBottom: '1rem',
              }}
            />

            {error && (
              <div
                style={{
                  marginBottom: '1rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 8,
                  background: 'rgba(255, 60, 60, 0.1)',
                  border: '1px solid rgba(255, 60, 60, 0.3)',
                  color: 'var(--accent-danger)',
                  fontSize: '0.875rem',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={!text.trim() || generating}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: 8,
                border: 'none',
                background: 'var(--accent-magic)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: !text.trim() || generating ? 'not-allowed' : 'pointer',
                opacity: !text.trim() || generating ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              {generating ? (
                <>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      animation: 'ai-dot-pulse 0.8s linear infinite',
                    }}
                  />
                  {analyzingStage || 'AI 正在分析文本…'}
                </>
              ) : (
                '🤖 AI 分析并生成设定'
              )}
            </button>
          </>
        )}

        {/* Result Preview */}
        {result && (
          <div>
            {!editMode ? (
              <>
                {/* Summary */}
                <div
                  style={{
                    padding: '1rem',
                    borderRadius: 8,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '1rem',
                  }}
                >
                  <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', color: 'var(--accent-gold)' }}>
                    {(result as unknown as Record<string, unknown>).gameIntro
                      ? String((result as unknown as Record<string, unknown>).gameIntro)
                      : result.worldMeta.name}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 1rem', fontSize: '0.875rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>类型：</span>
                      <span style={{ color: 'var(--text-primary)' }}>{result.worldMeta.genre}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>基调：</span>
                      <span style={{ color: 'var(--text-primary)' }}>{result.worldMeta.tone}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>NPC：</span>
                      <span style={{ color: 'var(--text-primary)' }}>{result.npcs?.length ?? 0} 个</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>职业：</span>
                      <span style={{ color: 'var(--text-primary)' }}>{result.playerOptions?.availableClasses.length ?? 0} 种</span>
                    </div>
                  </div>
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {result.worldMeta.description.slice(0, 200)}
                    {result.worldMeta.description.length > 200 ? '…' : ''}
                  </p>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <button
                    onClick={() => setEditMode(true)}
                    style={{
                      flex: 1,
                      padding: '0.625rem',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ✏️ 手动编辑
                  </button>
                  <button
                    onClick={handleConfirm}
                    style={{
                      flex: 1,
                      padding: '0.625rem',
                      borderRadius: 8,
                      border: 'none',
                      background: 'var(--accent-gold)',
                      color: 'var(--bg-deep)',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ✓ 确认使用
                  </button>
                </div>
                <button
                  onClick={() => {
                    setResult(null);
                    setError('');
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 8,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  ← 重新分析
                </button>
              </>
            ) : (
              <>
                <textarea
                  value={editableJson}
                  onChange={(e) => setEditableJson(e.target.value)}
                  rows={18}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontFamily: 'monospace',
                    fontSize: '0.8125rem',
                    lineHeight: 1.5,
                    resize: 'vertical',
                    outline: 'none',
                    marginBottom: '1rem',
                  }}
                />

                {error && (
                  <div
                    style={{
                      marginBottom: '1rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 8,
                      background: 'rgba(255,0,0,0.1)',
                      border: '1px solid rgba(255,0,0,0.3)',
                      color: 'var(--accent-danger)',
                      fontSize: '0.875rem',
                    }}
                  >
                    {error}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => {
                      setEditMode(false);
                      setError('');
                    }}
                    style={{
                      flex: 1,
                      padding: '0.625rem',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleEditSave}
                    style={{
                      flex: 1,
                      padding: '0.625rem',
                      borderRadius: 8,
                      border: 'none',
                      background: 'var(--accent-success)',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ✓ 保存编辑
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
