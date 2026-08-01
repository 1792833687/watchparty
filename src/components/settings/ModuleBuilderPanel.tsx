/**
 * ModuleBuilderPanel — AI Narrator Game
 *
 * Modular building mode for custom game creation.
 * User selects options across 6 categories → compatibility check →
 * AI generates complete game setting → preview → confirm → save.
 *
 * Supports re-editing of previously built games.
 */

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  GameSetting,
  ModuleCategory,
  ModuleSelection,
  CompatibilityRule,
  CustomGameRecord,
} from '@/systems/settings/types';

// ============================================================
// Props
// ============================================================

interface ModuleBuilderPanelProps {
  apiKey: string;
  onSave: (record: CustomGameRecord) => void;
  onCancel: () => void;
  existingRecord?: CustomGameRecord | null;
}

// ============================================================
// Module Definitions
// ============================================================

const MODULE_CATEGORIES: ModuleCategory[] = [
  {
    id: 'worldType',
    name: '世界观类型',
    description: '选择游戏世界的底层设定',
    options: [
      { id: 'fantasy', name: '奇幻', icon: '🧙', description: '剑与魔法，龙与地下城，史诗冒险' },
      { id: 'sci-fi', name: '科幻', icon: '🚀', description: '太空探索，AI觉醒，赛博朋克' },
      { id: 'modern', name: '现代', icon: '🌃', description: '都市生活，悬疑推理，现实题材' },
      { id: 'wuxia', name: '武侠', icon: '⚔️', description: '江湖恩怨，内力修为，侠义之道' },
      { id: 'post-apocalyptic', name: '末日', icon: '☢️', description: '废土生存，资源争夺，文明重建' },
      { id: 'custom-world', name: '自定义', icon: '✨', description: '自由组合，不拘泥于传统类型' },
    ],
  },
  {
    id: 'coreGameplay',
    name: '核心玩法',
    description: '决定游戏的主要推进方式',
    options: [
      { id: 'story-driven', name: '剧情驱动', icon: '📖', description: '线性或分支剧情，沉浸式叙事' },
      { id: 'free-exploration', name: '自由探索', icon: '🗺️', description: '开放世界，探索发现驱动' },
      { id: 'survival', name: '生存挑战', icon: '🔥', description: '资源管理，生命威胁，高压决策' },
      { id: 'puzzle-mystery', name: '解谜推理', icon: '🔍', description: '线索收集，逻辑推理，真相揭露' },
    ],
  },
  {
    id: 'characterSystem',
    name: '角色系统',
    description: '定义角色的成长与定制方式',
    options: [
      { id: 'classic-rpg', name: '经典RPG属性', icon: '🎯', description: '力量/敏捷/智力等基础属性 + 职业' },
      { id: 'skill-tree', name: '技能树', icon: '🌳', description: '分支技能解锁，个性化成长路线' },
      { id: 'class-advancement', name: '职业进阶', icon: '⬆️', description: '职业等级提升，转职系统' },
      { id: 'simple-attributes', name: '简化属性', icon: '📊', description: '极简属性面板，轻量玩法' },
    ],
  },
  {
    id: 'mapStyle',
    name: '地图风格',
    description: '决定游戏世界的空间结构',
    options: [
      { id: 'open-world', name: '开放世界', icon: '🌍', description: '无缝大地图，自由移动' },
      { id: 'linear-levels', name: '线性关卡', icon: '🏰', description: '顺序推进，章节式关卡' },
      { id: 'hub-teleport', name: '据点传送', icon: '🔮', description: '据点间传送，区域式探索' },
      { id: 'random-generation', name: '随机生成', icon: '🎲', description: '每次不同的地图布局' },
    ],
  },
  {
    id: 'difficultyCurve',
    name: '难度曲线',
    description: '控制游戏挑战的节奏',
    options: [
      { id: 'gentle', name: '平缓渐进', icon: '📈', description: '逐步提升难度，适合叙事体验' },
      { id: 'steep', name: '陡峭挑战', icon: '⛰️', description: '高难度Boss战，硬核体验' },
      { id: 'adaptive', name: '动态适应', icon: '🔄', description: '根据玩家表现自动调整' },
    ],
  },
  {
    id: 'plotDirection',
    name: '剧情走向',
    description: '决定故事的分支与结局',
    options: [
      { id: 'linear-narrative', name: '线性叙事', icon: '➡️', description: '固定剧情线，沉浸式体验' },
      { id: 'branching-endings', name: '分支多结局', icon: '🔀', description: '选择影响结局，高重玩性' },
      { id: 'sandbox', name: '沙盒自由', icon: '🏜️', description: '无强制主线，玩家定义目标' },
    ],
  },
];

// ============================================================
// Compatibility Rules
// ============================================================

const COMPATIBILITY_RULES: CompatibilityRule[] = [
  {
    categories: ['coreGameplay', 'mapStyle'],
    conflicts: [
      ['free-exploration', 'linear-levels'],
      ['story-driven', 'random-generation'],
    ],
    message: '自由探索与线性关卡存在设计冲突，建议选择开放世界或据点传送。',
  },
  {
    categories: ['coreGameplay', 'plotDirection'],
    conflicts: [
      ['free-exploration', 'linear-narrative'],
      ['story-driven', 'sandbox'],
      ['survival', 'linear-narrative'],
    ],
    message: '核心玩法与剧情走向不兼容，自由探索更适合沙盒/分支结局。',
  },
  {
    categories: ['difficultyCurve', 'coreGameplay'],
    conflicts: [
      ['gentle', 'survival'],
    ],
    message: '生存挑战通常需要较高难度，平缓渐进可能削弱紧张感。',
  },
  {
    categories: ['mapStyle', 'plotDirection'],
    conflicts: [
      ['linear-levels', 'sandbox'],
      ['random-generation', 'linear-narrative'],
    ],
    message: '线性关卡与沙盒自由互斥；随机生成与线性叙事不兼容。',
  },
];

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
    maxWidth: 720,
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
    marginBottom: '1.5rem',
    lineHeight: 1.6,
  },
  categorySection: {
    marginBottom: '1.5rem',
  },
  categoryTitle: {
    color: '#C9A94E',
    fontSize: '1rem',
    fontWeight: 600,
    marginBottom: '0.375rem',
  },
  categoryDesc: {
    color: '#6B6258',
    fontSize: '0.8125rem',
    marginBottom: '0.75rem',
  },
  optionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '0.5rem',
  },
  optionCard: {
    padding: '0.75rem',
    borderRadius: 8,
    border: '1px solid #2E2924',
    background: '#2A2522',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
  },
  optionCardSelected: {
    border: '2px solid #C9A94E',
    background: 'rgba(201,169,78,0.1)',
  },
  optionName: {
    color: '#E8E0D5',
    fontSize: '0.9375rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.25rem',
  },
  optionDesc: {
    color: '#A09888',
    fontSize: '0.75rem',
    lineHeight: 1.4,
  },
  optionIcon: {
    fontSize: '1.125rem',
  },
  warningBox: {
    marginTop: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: 8,
    background: 'rgba(201,169,78,0.1)',
    border: '1px solid rgba(201,169,78,0.3)',
    color: '#C9A94E',
    fontSize: '0.8125rem',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
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
  btnRow: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'flex-end',
    marginTop: '1.5rem',
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
  btnGenerate: {
    padding: '0.625rem 1.5rem',
    borderRadius: 8,
    border: 'none',
    background: '#C9A94E',
    color: '#0D0D12',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '0.9375rem',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  generatingIndicator: {
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
  // Summary styles
  summaryRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.75rem',
    borderRadius: 6,
    background: '#25211D',
    marginBottom: '0.375rem',
  },
  summaryLabel: {
    color: '#8B8278',
    fontSize: '0.8125rem',
    fontWeight: 600,
    minWidth: 80,
  },
  summaryValue: {
    color: '#E8E0D5',
    fontSize: '0.875rem',
  },
} as const;

// ============================================================
// AI Generation Prompt
// ============================================================

function buildGenerationPrompt(selections: ModuleSelection): string {
  const details = MODULE_CATEGORIES.map((cat) => {
    const optId = selections[cat.id];
    const opt = cat.options.find((o) => o.id === optId);
    return `- ${cat.name}: ${opt?.name ?? '未选择'}（${opt?.description ?? ''}）`;
  }).join('\n');

  return `你是一个游戏设定设计师。用户通过模块选择定义了一个游戏框架，请根据以下模块组合生成一个完整的游戏设定 JSON。

【模块选择】
${details}

严格按照以下 JSON Schema 输出（仅输出 JSON，不要其他内容）：

{
  "worldMeta": {
    "name": "世界名称（简洁有力，5-15字）",
    "genre": "类型标签",
    "tone": "基调",
    "description": "世界描述（150-250字，结合所有模块选择）",
    "tags": ["标签1", "标签2", "标签3", "标签4", "标签5"],
    "languageHints": "语言风格提示"
  },
  "startingLocation": {
    "regionId": "起始区域ID（英文，kebab-case）",
    "description": "起始地点简短描述",
    "openingNarrative": "开场叙事（200-350字，第二人称\"你\"视角，营造沉浸感，体现世界特色）"
  },
  "playerOptions": {
    "availableClasses": [
      {
        "id": "职业ID",
        "name": "职业名称（中文，有创意）",
        "description": "职业描述（30-50字）",
        "baseAttributes": {"strength": N, "agility": N, "intelligence": N, "constitution": N, "charisma": N},
        "startingEquipment": ["装备1", "装备2", "装备3"]
      }
    ],
    "attributeNames": ["strength", "agility", "intelligence", "constitution", "charisma"],
    "characterCreationPrompt": "角色创建引导语（50-100字）",
    "totalAttributePoints": 15
  },
  "worldRules": [
    {
      "id": "规则ID",
      "name": "规则名称",
      "description": "规则描述（详细说明规则如何影响游戏）",
      "priority": N,
      "category": "combat|magic|social|economy|lore|other"
    }
  ],
  "regions": [
    {
      "id": "区域ID",
      "name": "区域名称（有特色）",
      "description": "区域描述（50-100字）",
      "theme": "village|city|forest|mountain|ocean|desert|dungeon"
    }
  ],
  "npcs": [
    {
      "id": "npc ID",
      "name": "NPC名称",
      "role": "角色",
      "description": "描述（50-80字）",
      "location": "所在区域ID",
      "personality": "性格简述"
    }
  ],
  "initialHook": "初始剧情钩子（一句话，吸引玩家）"
}

重要要求：
1. availableClasses 必须提供 4 个职业，baseAttributes 总和在 15-18 之间，且分布符合职业特色
2. regions 必须提供 5 个区域，各具特色，覆盖不同主题
3. npcs 必须提供 5 个 NPC，分布在各个区域，有完整的性格描述
4. worldRules 必须提供 4 条规则，覆盖至少 2 个不同类别
5. 所有内容必须与用户选择的模块组合协调一致
6. 开场叙事必须出色——这是玩家对游戏的第一印象
7. 仅输出 JSON，不要 Markdown 包装或解释`;
}

// ============================================================
// Component
// ============================================================

export function ModuleBuilderPanel({
  apiKey,
  onSave,
  onCancel,
  existingRecord,
}: ModuleBuilderPanelProps): React.ReactElement {
  const [selections, setSelections] = useState<ModuleSelection>(
    existingRecord?.moduleSelection ?? {}
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSetting, setGeneratedSetting] = useState<GameSetting | null>(
    existingRecord?.setting ?? null
  );
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(!!existingRecord?.setting);

  // Reset when existingRecord changes
  useEffect(() => {
    if (existingRecord) {
      setSelections(existingRecord.moduleSelection ?? {});
      setGeneratedSetting(existingRecord.setting);
      setShowPreview(true);
      setError('');
    }
  }, [existingRecord]);

  // Compute compatibility warnings
  const warnings = useMemo(() => {
    const result: string[] = [];
    for (const rule of COMPATIBILITY_RULES) {
      const cat1 = rule.categories[0];
      const cat2 = rule.categories[1];
      const opt1 = selections[cat1];
      const opt2 = selections[cat2];
      if (!opt1 || !opt2) continue;

      const isConflict = rule.conflicts.some(
        ([c1, c2]) => (c1 === opt1 && c2 === opt2) || (c1 === opt2 && c2 === opt1)
      );
      if (isConflict) {
        result.push(rule.message);
      }
    }
    return result;
  }, [selections]);

  // Check if all categories have a selection
  const allSelected = MODULE_CATEGORIES.every((cat) => !!selections[cat.id]);
  const selectedCount = MODULE_CATEGORIES.filter((cat) => !!selections[cat.id]).length;

  const handleSelect = useCallback((categoryId: string, optionId: string) => {
    setSelections((prev) => ({ ...prev, [categoryId]: optionId }));
    if (showPreview) setShowPreview(false);
  }, [showPreview]);

  const handleGenerate = useCallback(async () => {
    if (!allSelected) {
      setError('请完成所有模块的选择');
      return;
    }
    if (!apiKey.trim()) {
      setError('请先在 API 配置中输入 DeepSeek API Key');
      return;
    }

    setIsGenerating(true);
    setError('');
    setShowPreview(false);

    try {
      const prompt = buildGenerationPrompt(selections);
      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: '你是一个游戏设定设计师，擅长根据模块化选择创造丰富、协调的游戏世界。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.8,
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
        throw new Error('AI 未返回有效的 JSON，请重试。');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Normalize into GameSetting
      const setting: GameSetting = {
        id: existingRecord?.id ?? `custom-module-${Date.now()}`,
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
              category: r.category as 'combat' | 'magic' | 'social' | 'economy' | 'lore' | 'other' | undefined,
            }))
          : undefined,
        regions: Array.isArray(parsed.regions)
          ? parsed.regions.map((r: Record<string, unknown>) => ({
              id: String(r.id ?? ''),
              name: String(r.name ?? ''),
              description: String(r.description ?? ''),
              theme: String(r.theme ?? 'village'),
              npcIds: Array.isArray(r.npcIds) ? r.npcIds.map(String) : undefined,
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
        createdBy: 'ai-generated',
      };

      setGeneratedSetting(setting);
      setShowPreview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  }, [allSelected, selections, apiKey, existingRecord]);

  const handleConfirm = useCallback(() => {
    if (!generatedSetting) return;
    const now = new Date().toISOString();
    const record: CustomGameRecord = {
      id: existingRecord?.id ?? `custom-${Date.now()}`,
      name: generatedSetting.worldMeta.name,
      createdBy: 'module-build',
      createdAt: existingRecord?.createdAt ?? now,
      updatedAt: now,
      setting: generatedSetting,
      moduleSelection: selections,
    };
    onSave(record);
  }, [generatedSetting, selections, onSave, existingRecord]);

  // Only show module selection or preview
  if (showPreview && generatedSetting) {
    return (
      <div style={S.overlay}>
        <div style={S.panel}>
          <h2 style={S.title}>
            {existingRecord ? '🛠️ 编辑游戏设定' : '🛠️ 生成预览'}
          </h2>

          {/* Module Selection Summary */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ color: '#8B8278', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              当前模块组合
            </div>
            {MODULE_CATEGORIES.map((cat) => {
              const opt = cat.options.find((o) => o.id === selections[cat.id]);
              return (
                <div key={cat.id} style={S.summaryRow}>
                  <span style={S.summaryLabel}>{cat.name}</span>
                  <span style={S.summaryValue}>
                    {opt?.icon} {opt?.name}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={S.divider} />

          {/* World Preview */}
          <div style={{
            background: '#2A2522',
            borderRadius: 10,
            border: '1px solid #3E3832',
            padding: '1.25rem',
            marginBottom: '0.75rem',
          }}>
            <div style={{ color: '#C9A94E', fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              🌍 {generatedSetting.worldMeta.name}
            </div>
            <div style={{ color: '#8B8278', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              {generatedSetting.worldMeta.genre} · {generatedSetting.worldMeta.tone}
            </div>
            <div style={{ color: '#D8D0C8', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '0.75rem' }}>
              {generatedSetting.worldMeta.description}
            </div>
            {generatedSetting.worldMeta.tags && generatedSetting.worldMeta.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {generatedSetting.worldMeta.tags.map((t) => (
                  <span key={t} style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.625rem',
                    borderRadius: 4,
                    background: 'rgba(201,169,78,0.15)',
                    color: '#C9A94E',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                  }}>{t}</span>
                ))}
              </div>
            )}
          </div>

          {/* Opening Narrative */}
          {generatedSetting.startingLocation?.openingNarrative && (
            <div style={{
              background: '#2A2522',
              borderRadius: 10,
              border: '1px solid #3E3832',
              padding: '1.25rem',
              marginBottom: '0.75rem',
            }}>
              <div style={{ color: '#8B8278', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                开场叙事
              </div>
              <div style={{ color: '#D8D0C8', fontSize: '0.875rem', lineHeight: 1.7, fontStyle: 'italic' }}>
                {generatedSetting.startingLocation.openingNarrative.slice(0, 400)}
                {generatedSetting.startingLocation.openingNarrative.length > 400 ? '...' : ''}
              </div>
            </div>
          )}

          {/* Stats Summary */}
          <div style={{
            background: '#2A2522',
            borderRadius: 10,
            border: '1px solid #3E3832',
            padding: '1.25rem',
            marginBottom: '0.75rem',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.5rem',
              textAlign: 'center',
            }}>
              <div>
                <div style={{ color: '#C9A94E', fontSize: '1.25rem', fontWeight: 700 }}>
                  {generatedSetting.playerOptions?.availableClasses?.length ?? 0}
                </div>
                <div style={{ color: '#8B8278', fontSize: '0.75rem' }}>职业</div>
              </div>
              <div>
                <div style={{ color: '#7B6FDF', fontSize: '1.25rem', fontWeight: 700 }}>
                  {generatedSetting.regions?.length ?? 0}
                </div>
                <div style={{ color: '#8B8278', fontSize: '0.75rem' }}>区域</div>
              </div>
              <div>
                <div style={{ color: '#5A9E6F', fontSize: '1.25rem', fontWeight: 700 }}>
                  {generatedSetting.npcs?.length ?? 0}
                </div>
                <div style={{ color: '#8B8278', fontSize: '0.75rem' }}>NPC</div>
              </div>
            </div>
          </div>

          <div style={S.btnRow}>
            <button onClick={() => setShowPreview(false)} style={S.btnCancel}>
              调整模块
            </button>
            <button onClick={handleGenerate} style={{ ...S.btnCancel, color: '#7B6FDF', borderColor: '#7B6FDF' }}>
              重新生成
            </button>
            <button onClick={handleConfirm} style={S.btnGenerate}>
              ✓ 确认并保存
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Module selection view
  return (
    <div style={S.overlay}>
      <div style={S.panel}>
        <h2 style={S.title}>
          {existingRecord ? '🛠️ 编辑模块组合' : '🛠️ 模块化拼搭'}
        </h2>
        <p style={S.subtitle}>
          从 6 个维度选择你想要的游戏特性，AI 将根据组合生成完整的游戏设定。
          已完成 {selectedCount}/6 项选择。
        </p>

        {/* Module Categories */}
        {MODULE_CATEGORIES.map((cat) => (
          <div key={cat.id} style={S.categorySection}>
            <div style={S.categoryTitle}>{cat.name}</div>
            <div style={S.categoryDesc}>{cat.description}</div>
            <div style={S.optionGrid}>
              {cat.options.map((opt) => {
                const isSelected = selections[cat.id] === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => handleSelect(cat.id, opt.id)}
                    style={{
                      ...S.optionCard,
                      ...(isSelected ? S.optionCardSelected : {}),
                    }}
                  >
                    <div style={S.optionName}>
                      <span style={S.optionIcon}>{opt.icon}</span>
                      {opt.name}
                    </div>
                    <div style={S.optionDesc}>{opt.description}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Compatibility Warnings */}
        {warnings.map((w, i) => (
          <div key={i} style={S.warningBox}>
            <span>⚠️</span>
            <span>{w}</span>
          </div>
        ))}

        {/* Error */}
        {error && <div style={S.errorBox}>{error}</div>}

        {/* Generating */}
        {isGenerating && (
          <div style={S.generatingIndicator}>
            正在根据你的模块组合生成完整游戏设定...
          </div>
        )}

        {/* Buttons */}
        <div style={S.btnRow}>
          <button onClick={onCancel} style={S.btnCancel}>
            取消
          </button>
          <button
            onClick={handleGenerate}
            disabled={!allSelected || isGenerating || !apiKey.trim()}
            style={{
              ...S.btnGenerate,
              ...(!allSelected || isGenerating || !apiKey.trim() ? S.btnDisabled : {}),
            }}
          >
            {isGenerating ? '生成中...' : '🎲 生成游戏'}
          </button>
        </div>
      </div>
    </div>
  );
}
