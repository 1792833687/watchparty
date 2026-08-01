/**
 * TextImportPanel — AI Narrator Game
 *
 * Enhanced text import mode for custom game creation.
 * User pastes a full game setting document → AI parses to structured JSON →
 * preview cards → confirm → save to localStorage + sync to useWorldStore.
 *
 * Supports re-editing of previously imported text.
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { GameSetting, CustomGameRecord } from '@/systems/settings/types';

// ============================================================
// Props
// ============================================================

interface TextImportPanelProps {
  apiKey: string;
  onSave: (record: CustomGameRecord) => void;
  onCancel: () => void;
  /** If provided, we're editing an existing import */
  existingRecord?: CustomGameRecord | null;
}

// ============================================================
// Styles
// ============================================================

const S = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  panel: {
    background: '#1E1B18',
    borderRadius: 12,
    border: '2px solid #C9A94E',
    padding: '2rem',
    maxWidth: 640,
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
  },
  title: {
    color: '#C9A94E',
    fontSize: '1.25rem',
    fontWeight: 700,
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: '#A09888',
    fontSize: '0.875rem',
    marginBottom: '1.25rem',
    lineHeight: 1.6,
  },
  textarea: {
    width: '100%',
    padding: '0.875rem',
    borderRadius: 8,
    border: '1px solid #2E2924',
    background: '#2A2522',
    color: '#E8E0D5',
    fontSize: '0.875rem',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
    marginBottom: '1rem',
    fontFamily: 'system-ui, sans-serif',
    lineHeight: 1.6,
    minHeight: 180,
  },
  btnRow: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'flex-end',
    marginTop: '1rem',
  },
  btnCancel: {
    padding: '0.625rem 1.5rem',
    borderRadius: 8,
    border: '1px solid #2E2924',
    background: 'transparent',
    color: '#A09888',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  btnParse: {
    padding: '0.625rem 1.5rem',
    borderRadius: 8,
    border: 'none',
    background: '#7B6FDF',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  btnConfirm: {
    padding: '0.625rem 1.5rem',
    borderRadius: 8,
    border: 'none',
    background: '#C9A94E',
    color: '#0D0D12',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  errorBox: {
    marginTop: '1rem',
    padding: '0.75rem',
    borderRadius: 8,
    background: 'rgba(220,80,80,0.15)',
    border: '1px solid rgba(220,80,80,0.3)',
    color: '#DC5050',
    fontSize: '0.875rem',
  },
  previewCard: {
    background: '#2A2522',
    borderRadius: 10,
    border: '1px solid #3E3832',
    padding: '1.25rem',
    marginBottom: '0.75rem',
  },
  previewTitle: {
    color: '#C9A94E',
    fontSize: '1rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  previewLabel: {
    color: '#8B8278',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '0.25rem',
  },
  previewValue: {
    color: '#D8D0C8',
    fontSize: '0.875rem',
    lineHeight: 1.5,
    marginBottom: '0.75rem',
  },
  tagRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.375rem',
    marginBottom: '0.75rem',
  },
  tag: {
    display: 'inline-block',
    padding: '0.25rem 0.625rem',
    borderRadius: 4,
    background: 'rgba(201,169,78,0.15)',
    color: '#C9A94E',
    fontSize: '0.75rem',
    fontWeight: 500,
  },
  classCard: {
    background: '#25211D',
    borderRadius: 8,
    border: '1px solid #3E3832',
    padding: '0.75rem',
    marginBottom: '0.5rem',
  },
  className: {
    color: '#E8E0D5',
    fontSize: '0.875rem',
    fontWeight: 600,
    marginBottom: '0.25rem',
  },
  classDesc: {
    color: '#A09888',
    fontSize: '0.8125rem',
    marginBottom: '0.25rem',
  },
  classAttr: {
    color: '#7B6FDF',
    fontSize: '0.75rem',
  },
  parsingIndicator: {
    textAlign: 'center' as const,
    color: '#C9A94E',
    padding: '2rem',
    fontSize: '0.9375rem',
  },
  divider: {
    height: 1,
    background: '#2E2924',
    margin: '1rem 0',
  },
} as const;

// ============================================================
// AI Parsing Prompt
// ============================================================

const PARSE_SYSTEM_PROMPT = `你是一个游戏设定分析器。用户会提供一段文字描述（可能包含世界观、角色设定、剧情、规则等），你需要从中提取并生成一个完整的游戏设定 JSON。

严格按照以下 JSON Schema 输出（仅输出 JSON，不要其他内容）：

{
  "worldMeta": {
    "name": "世界名称（简洁，5-15字）",
    "genre": "类型标签（如奇幻/科幻/武侠/现代等）",
    "tone": "基调（如史诗/黑暗/轻松/悬疑等）",
    "description": "世界描述（100-200字，概括世界观）",
    "tags": ["标签1", "标签2", "标签3"]
  },
  "startingLocation": {
    "regionId": "区域ID（英文，kebab-case）",
    "description": "起始地点简短描述",
    "openingNarrative": "开场叙事（150-250字，以第二人称'你'视角，营造沉浸感）"
  },
  "playerOptions": {
    "availableClasses": [
      {
        "id": "职业ID（英文）",
        "name": "职业名称（中文）",
        "description": "职业描述（20-40字）",
        "baseAttributes": {"strength": 3, "agility": 3, "intelligence": 3, "constitution": 3, "charisma": 3},
        "startingEquipment": ["装备1", "装备2"]
      }
    ],
    "attributeNames": ["strength", "agility", "intelligence", "constitution", "charisma"],
    "characterCreationPrompt": "角色创建引导语",
    "totalAttributePoints": 15
  },
  "worldRules": [
    {
      "id": "规则ID",
      "name": "规则名称",
      "description": "规则描述",
      "priority": 8,
      "category": "combat|magic|social|economy|lore|other"
    }
  ],
  "regions": [
    {
      "id": "区域ID",
      "name": "区域名称",
      "description": "区域描述",
      "theme": "village|city|forest|mountain|ocean|desert|dungeon"
    }
  ],
  "npcs": [
    {
      "id": "npc ID",
      "name": "NPC名称",
      "role": "角色",
      "description": "描述",
      "location": "所在区域ID",
      "personality": "性格简述"
    }
  ],
  "initialHook": "初始剧情钩子（一句话）"
}

要求：
1. availableClasses 至少提供 3 个职业，baseAttributes 中的 5 个属性总和在 15-18 之间
2. regions 至少提供 3 个区域
3. npcs 至少提供 3 个 NPC
4. worldRules 至少提供 2 条规则
5. 如果用户文本中没有明确提到某些字段，请根据世界观合理推断生成
6. 仅输出 JSON，不要 Markdown 包装或解释`;

// ============================================================
// Component
// ============================================================

export function TextImportPanel({
  apiKey,
  onSave,
  onCancel,
  existingRecord,
}: TextImportPanelProps): React.ReactElement {
  const [text, setText] = useState(existingRecord?.rawText ?? '');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedSetting, setParsedSetting] = useState<GameSetting | null>(
    existingRecord?.setting ?? null
  );
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(!!existingRecord?.setting);

  // Reset when existingRecord changes
  useEffect(() => {
    if (existingRecord) {
      setText(existingRecord.rawText ?? '');
      setParsedSetting(existingRecord.setting);
      setShowPreview(true);
      setError('');
    }
  }, [existingRecord]);

  const handleParse = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('请先粘贴游戏设定文本');
      return;
    }
    if (!apiKey.trim()) {
      setError('请先在 API 配置中输入 DeepSeek API Key');
      return;
    }

    setIsParsing(true);
    setError('');
    setShowPreview(false);

    try {
      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: PARSE_SYSTEM_PROMPT },
            { role: 'user', content: trimmed.slice(0, 4000) },
          ],
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });

      if (!resp.ok) {
        if (resp.status === 401) throw new Error('API Key 无效，请检查。');
        if (resp.status === 429) throw new Error('请求过于频繁，请稍后重试。');
        throw new Error(`API 错误 (${resp.status})`);
      }

      const data = await resp.json();
      const raw = data?.choices?.[0]?.message?.content ?? '';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI 未返回有效的 JSON 结构，请尝试提供更详细的设定文本。');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Ensure base structure
      const setting: GameSetting = {
        id: `custom-import-${Date.now()}`,
        name: parsed.worldMeta?.name ?? '自定义世界',
        version: '1.0.0',
        worldMeta: {
          name: parsed.worldMeta?.name ?? '自定义世界',
          genre: parsed.worldMeta?.genre ?? '奇幻',
          tone: parsed.worldMeta?.tone ?? '中性',
          description: parsed.worldMeta?.description ?? '',
          tags: parsed.worldMeta?.tags ?? [],
          languageHints: parsed.worldMeta?.languageHints,
        },
        startingLocation: parsed.startingLocation
          ? {
              regionId: parsed.startingLocation.regionId ?? 'start',
              description: parsed.startingLocation.description ?? '',
              openingNarrative: parsed.startingLocation.openingNarrative ?? '',
            }
          : undefined,
        playerOptions: parsed.playerOptions
          ? {
              availableClasses: (parsed.playerOptions.availableClasses ?? []).map(
                (c: Record<string, unknown>) => ({
                  id: String(c.id ?? ''),
                  name: String(c.name ?? ''),
                  description: String(c.description ?? ''),
                  baseAttributes: c.baseAttributes as Record<string, number> ?? {},
                  startingEquipment: Array.isArray(c.startingEquipment)
                    ? c.startingEquipment.map(String)
                    : undefined,
                })
              ),
              attributeNames: parsed.playerOptions.attributeNames ?? [
                'strength', 'agility', 'intelligence', 'constitution', 'charisma',
              ],
              characterCreationPrompt: parsed.playerOptions.characterCreationPrompt,
              totalAttributePoints: parsed.playerOptions.totalAttributePoints ?? 15,
            }
          : undefined,
        worldRules: Array.isArray(parsed.worldRules)
          ? parsed.worldRules.map((r: Record<string, unknown>) => ({
              id: String(r.id ?? ''),
              name: String(r.name ?? ''),
              description: String(r.description ?? ''),
              priority: Number(r.priority ?? 8),
              category: r.category as GameSetting['worldRules'] extends (infer U)[] | undefined
                ? U extends { category?: infer C } ? C : undefined : undefined,
            }))
          : undefined,
        regions: Array.isArray(parsed.regions)
          ? parsed.regions.map((r: Record<string, unknown>) => ({
              id: String(r.id ?? ''),
              name: String(r.name ?? ''),
              description: String(r.description ?? ''),
              theme: String(r.theme ?? 'village'),
              npcIds: Array.isArray(r.npcIds)
                ? r.npcIds.map(String)
                : undefined,
            }))
          : undefined,
        npcs: Array.isArray(parsed.npcs)
          ? parsed.npcs.map((n: Record<string, unknown>) => ({
              id: String(n.id ?? ''),
              name: String(n.name ?? ''),
              role: String(n.role ?? ''),
              description: String(n.description ?? ''),
              location: typeof n.location === 'string' ? n.location : undefined,
              personality: typeof n.personality === 'string' ? n.personality : undefined,
            }))
          : undefined,
        initialHook: typeof parsed.initialHook === 'string' ? parsed.initialHook : undefined,
        createdAt: new Date().toISOString(),
        createdBy: 'import',
      };

      setParsedSetting(setting);
      setShowPreview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '解析失败，请重试');
    } finally {
      setIsParsing(false);
    }
  }, [text, apiKey]);

  const handleConfirm = useCallback(() => {
    if (!parsedSetting) return;
    const now = new Date().toISOString();
    const record: CustomGameRecord = {
      id: existingRecord?.id ?? `custom-${Date.now()}`,
      name: parsedSetting.worldMeta.name,
      createdBy: 'import',
      createdAt: existingRecord?.createdAt ?? now,
      updatedAt: now,
      setting: parsedSetting,
      rawText: text,
    };
    onSave(record);
  }, [parsedSetting, text, onSave, existingRecord]);

  return (
    <div style={S.overlay}>
      <div style={S.panel}>
        <h2 style={S.title}>
          {existingRecord ? '📋 编辑自定义设定' : '📋 文本导入模式'}
        </h2>
        <p style={S.subtitle}>
          粘贴完整的游戏设定文档（世界观、角色、规则、剧情等），AI 会自动分析并结构化。
          支持粘贴小说片段、RPG模组描述、自创设定等任何格式的文本。
        </p>

        {/* Text Input */}
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (showPreview) setShowPreview(false);
          }}
          placeholder={`在此粘贴游戏设定文本...\n\n示例：\n这是一个名为"星辰帝国"的太空歌剧世界。人类已经遍布银河系，但帝国正面临分裂...\n\n有三种主要职业：\n- 帝国军官：指挥舰队...\n- 自由商人：贸易与走私...\n- 星际探险家：探索未知星域...`}
          style={S.textarea}
          rows={10}
        />

        {/* Button Row */}
        <div style={S.btnRow}>
          <button onClick={onCancel} style={S.btnCancel}>
            取消
          </button>
          <button
            onClick={handleParse}
            disabled={isParsing || !text.trim() || !apiKey.trim()}
            style={{
              ...S.btnParse,
              ...(isParsing || !text.trim() || !apiKey.trim() ? S.btnDisabled : {}),
            }}
          >
            {isParsing ? '解析中...' : '🤖 AI 解析'}
          </button>
        </div>

        {/* Error */}
        {error && <div style={S.errorBox}>{error}</div>}

        {/* Parsing Indicator */}
        {isParsing && (
          <div style={S.parsingIndicator}>
            正在分析文本，提取游戏设定结构...
          </div>
        )}

        {/* Preview */}
        {showPreview && parsedSetting && !isParsing && (
          <>
            <div style={S.divider} />

            {/* World Meta Preview */}
            <div style={S.previewCard}>
              <div style={S.previewTitle}>
                🌍 {parsedSetting.worldMeta.name}
              </div>
              <div style={S.previewLabel}>类型</div>
              <div style={S.previewValue}>
                {parsedSetting.worldMeta.genre} · {parsedSetting.worldMeta.tone}
              </div>
              <div style={S.previewLabel}>描述</div>
              <div style={S.previewValue}>
                {parsedSetting.worldMeta.description}
              </div>
              {parsedSetting.worldMeta.tags && parsedSetting.worldMeta.tags.length > 0 && (
                <div style={S.tagRow}>
                  {parsedSetting.worldMeta.tags.map((t) => (
                    <span key={t} style={S.tag}>{t}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Starting Location */}
            {parsedSetting.startingLocation?.openingNarrative && (
              <div style={S.previewCard}>
                <div style={S.previewLabel}>开场叙事</div>
                <div style={S.previewValue}>
                  {parsedSetting.startingLocation.openingNarrative.slice(0, 200)}
                  {parsedSetting.startingLocation.openingNarrative.length > 200 ? '...' : ''}
                </div>
              </div>
            )}

            {/* Classes */}
            {parsedSetting.playerOptions?.availableClasses &&
              parsedSetting.playerOptions.availableClasses.length > 0 && (
                <div style={S.previewCard}>
                  <div style={S.previewLabel}>
                    职业 ({parsedSetting.playerOptions.availableClasses.length})
                  </div>
                  {parsedSetting.playerOptions.availableClasses.map((c) => (
                    <div key={c.id} style={S.classCard}>
                      <div style={S.className}>{c.name}</div>
                      <div style={S.classDesc}>{c.description}</div>
                      <div style={S.classAttr}>
                        {Object.entries(c.baseAttributes)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' | ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            {/* Regions */}
            {parsedSetting.regions && parsedSetting.regions.length > 0 && (
              <div style={S.previewCard}>
                <div style={S.previewLabel}>
                  区域 ({parsedSetting.regions.length})
                </div>
                <div style={S.tagRow}>
                  {parsedSetting.regions.map((r) => (
                    <span key={r.id} style={{ ...S.tag, background: 'rgba(123,111,223,0.15)', color: '#7B6FDF' }}>
                      {r.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* NPCs */}
            {parsedSetting.npcs && parsedSetting.npcs.length > 0 && (
              <div style={S.previewCard}>
                <div style={S.previewLabel}>
                  NPC ({parsedSetting.npcs.length})
                </div>
                {parsedSetting.npcs.map((n) => (
                  <div key={n.id} style={{ marginBottom: '0.5rem' }}>
                    <span style={{ color: '#E8E0D5', fontSize: '0.875rem', fontWeight: 600 }}>
                      {n.name}
                    </span>
                    <span style={{ color: '#A09888', fontSize: '0.8125rem', marginLeft: '0.5rem' }}>
                      — {n.role}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Confirm Button */}
            <div style={S.btnRow}>
              <button onClick={handleParse} style={S.btnCancel}>
                重新解析
              </button>
              <button onClick={handleConfirm} style={S.btnConfirm}>
                ✓ 确认并保存
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
