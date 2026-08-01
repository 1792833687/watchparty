'use client';

/**
 * Setup Panel — Simplified settings flow (no API Key step).
 *
 * Used when user already has API Key configured.
 * Route: /settings/setup
 *
 * Epic 7 Story 7.5 (subset).
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorldStore } from '@/stores/world-store';
import {
  loadFromJSON,
  validate,
  GAME_SETTING_TEMPLATES,
  getBuiltInPreset,
} from '@/systems/settings/settings-loader';
import { generateSetting, buildPromptSuggestion } from '@/systems/settings/ai-generator';
import { useUIStore } from '@/stores/ui-store';
import type {
  GameSetting,
  SettingsStep,
  SettingSource,
  AIGenerationResult,
} from '@/systems/settings/types';

export function SetupPanel(): React.ReactElement {
  const router = useRouter();
  const loadGameSetting = useWorldStore((s) => s.loadGameSetting);
  const selectedModel = useUIStore((s) => s.selectedModel);

  const [step, setStep] = useState<SettingsStep>('source');
  const [source, setSource] = useState<SettingSource>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('frosthold');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<AIGenerationResult | null>(null);
  const [aiError, setAiError] = useState('');
  const [finalSetting, setFinalSetting] = useState<GameSetting | null>(null);

  const handleSelectSource = useCallback((s: SettingSource) => {
    setSource(s);
    setStep('configure');
    setImportError('');
    setAiError('');
    setAiResult(null);
  }, []);

  const handlePresetConfirm = useCallback(() => {
    const preset = getBuiltInPreset(selectedTemplateId);
    if (preset) {
      setFinalSetting(preset);
      setStep('confirm');
    }
  }, [selectedTemplateId]);

  const handleImportPreview = useCallback(() => {
    setImportError('');
    try {
      const setting = loadFromJSON(importText);
      const result = validate(setting);
      if (!result.valid) {
        setImportError(
          result.errors
            .filter((e) => e.severity === 'error')
            .map((e) => `${e.field}: ${e.message}`)
            .join('\n')
        );
        return;
      }
      setting.createdBy = 'import';
      setFinalSetting(setting);
      setStep('confirm');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '导入失败');
    }
  }, [importText]);

  const handleAIGenerate = useCallback(async () => {
    const apiKey = (() => { try { return localStorage.getItem('ai-narrator-openrouter-api-key'); } catch { return null; } })();
    if (!aiPrompt.trim() || !apiKey) return;

    setAiGenerating(true);
    setAiError('');
    setAiResult(null);

    try {
      const result = await generateSetting({
        prompt: aiPrompt.trim(),
        temperature: 0.8,
        model: selectedModel,
        apiKey,
      });
      setAiResult(result);
      if (!result.success) {
        setAiError(result.error ?? '生成失败');
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setAiGenerating(false);
    }
  }, [aiPrompt, selectedModel]);

  const handleAIApprove = useCallback(() => {
    if (aiResult?.setting) {
      setFinalSetting(aiResult.setting);
      setStep('confirm');
    }
  }, [aiResult]);

  const handleConfirm = useCallback(() => {
    if (finalSetting) {
      loadGameSetting(finalSetting);
      router.push('/game/new');
    }
  }, [finalSetting, loadGameSetting, router]);

  const handleBack = useCallback(() => {
    if (step === 'confirm') {
      setStep('configure');
    } else if (step === 'configure') {
      setStep('source');
      setSource(null);
    }
  }, [step]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-bold text-accent-gold">
          冒险设定
        </h1>
        <p className="mt-2 text-secondary">
          选择你的世界，开启独一无二的冒险
        </p>
      </div>

      {/* Step Indicator */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {(['source', 'configure', 'confirm'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                step === s
                  ? 'bg-accent-gold text-bg-deep'
                  : i < ['source', 'configure', 'confirm'].indexOf(step)
                    ? 'bg-accent-success/20 text-accent-success'
                    : 'bg-bg-input text-text-muted'
              }`}
            >
              {i < ['source', 'configure', 'confirm'].indexOf(step) ? '✓' : i + 1}
            </div>
            {i < 2 && <div className="h-px w-8 bg-border-subtle" />}
          </div>
        ))}
      </div>
      <div className="mb-8 flex justify-center gap-8 text-sm text-text-muted">
        <span className={step === 'source' ? 'text-accent-gold' : ''}>
          选择方式
        </span>
        <span className={step === 'configure' ? 'text-accent-gold' : ''}>
          配置设定
        </span>
        <span className={step === 'confirm' ? 'text-accent-gold' : ''}>
          确认开始
        </span>
      </div>

      <div className="rounded-xl border border-border-subtle bg-bg-panel p-6">
        {step === 'source' && (
          <div>
            <h3 className="mb-4 text-xl font-semibold text-text-primary">
              选择设定来源
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <button
                onClick={() => handleSelectSource('preset')}
                className="rounded-xl border border-border-subtle bg-bg-input p-6 text-center transition-all hover:border-accent-gold hover:bg-bg-panel-raised"
              >
                <div className="mb-3 text-4xl">🏰</div>
                <div className="font-semibold text-text-primary">预置模板</div>
                <div className="mt-1 text-sm text-secondary">
                  使用内置的奇幻冒险世界
                </div>
              </button>
              <button
                onClick={() => handleSelectSource('import')}
                className="rounded-xl border border-border-subtle bg-bg-input p-6 text-center transition-all hover:border-accent-gold hover:bg-bg-panel-raised"
              >
                <div className="mb-3 text-4xl">📄</div>
                <div className="font-semibold text-text-primary">导入设定</div>
                <div className="mt-1 text-sm text-secondary">
                  粘贴 JSON 格式的游戏设定
                </div>
              </button>
              <button
                onClick={() => handleSelectSource('ai-generate')}
                className="rounded-xl border border-border-subtle bg-bg-input p-6 text-center transition-all hover:border-accent-gold hover:bg-bg-panel-raised"
              >
                <div className="mb-3 text-4xl">🤖</div>
                <div className="font-semibold text-text-primary">AI 生成</div>
                <div className="mt-1 text-sm text-secondary">
                  描述你想要的世界，AI 为你创造
                </div>
              </button>
            </div>
          </div>
        )}

        {step === 'configure' && source === 'preset' && (
          <div>
            <h3 className="mb-4 text-xl font-semibold text-text-primary">
              选择预设模板
            </h3>
            {GAME_SETTING_TEMPLATES.map((t) => {
              const preset = getBuiltInPreset(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplateId(t.id)}
                  className={`mb-3 w-full rounded-lg border p-4 text-left transition-all ${
                    selectedTemplateId === t.id
                      ? 'border-accent-gold bg-accent-gold/10'
                      : 'border-border-subtle bg-bg-input hover:border-border-active'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{t.icon}</span>
                    <div>
                      <div className="font-semibold text-text-primary">
                        {t.name}
                      </div>
                      <div className="text-sm text-secondary">
                        {t.genre} · {t.tone}
                      </div>
                    </div>
                  </div>
                  {preset && selectedTemplateId === t.id && (
                    <div className="mt-3 grid grid-cols-2 gap-1 text-xs text-text-muted">
                      <div>📍 {preset.regions?.length ?? 0} 个区域</div>
                      <div>👥 {preset.npcs?.length ?? 0} 个 NPC</div>
                      <div>⚔️ {preset.playerOptions?.availableClasses.length ?? 0} 个职业</div>
                      <div>📜 {preset.worldRules?.length ?? 0} 条规则</div>
                    </div>
                  )}
                </button>
              );
            })}
            <button
              onClick={handlePresetConfirm}
              className="mt-4 w-full rounded-lg bg-accent-gold py-3 font-semibold text-bg-deep transition-all hover:bg-accent-gold/90"
            >
              使用此设定 →
            </button>
          </div>
        )}

        {step === 'configure' && source === 'import' && (
          <div>
            <h3 className="mb-4 text-xl font-semibold text-text-primary">
              导入 JSON 设定
            </h3>
            <p className="mb-3 text-sm text-secondary">
              粘贴完整的游戏设定 JSON。
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='{ "id": "my-world", "name": "我的世界", ... }'
              rows={12}
              className="mb-4 w-full rounded-lg border border-border-subtle bg-bg-input px-4 py-3 font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-accent-gold focus:outline-none"
            />
            {importError && (
              <div className="mb-4 whitespace-pre-wrap rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-3 text-sm text-accent-danger">
                {importError}
              </div>
            )}
            <button
              onClick={handleImportPreview}
              disabled={!importText.trim()}
              className="w-full rounded-lg bg-accent-gold py-3 font-semibold text-bg-deep transition-all hover:bg-accent-gold/90 disabled:opacity-40"
            >
              验证并预览 →
            </button>
          </div>
        )}

        {step === 'configure' && source === 'ai-generate' && (
          <div>
            <h3 className="mb-4 text-xl font-semibold text-text-primary">
              AI 生成游戏设定
            </h3>
            <p className="mb-3 text-sm text-secondary">
              描述你想要的游戏世界——AI 将为你生成完整的游戏设定。
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              {['fantasy', 'scifi', 'horror', 'wuxia'].map((theme) => (
                <button
                  key={theme}
                  type="button"
                  onClick={() => setAiPrompt(buildPromptSuggestion(theme))}
                  className="rounded-full border border-border-subtle px-3 py-1 text-xs text-text-muted transition-colors hover:border-border-active hover:text-text-secondary"
                >
                  {theme === 'fantasy' && '🏰 奇幻'}
                  {theme === 'scifi' && '🚀 科幻'}
                  {theme === 'horror' && '🦑 恐怖'}
                  {theme === 'wuxia' && '⚔️ 武侠'}
                </button>
              ))}
            </div>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="例如：创建一个蒸汽朋克风格的奇幻世界..."
              rows={4}
              className="mb-4 w-full rounded-lg border border-border-subtle bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-gold focus:outline-none"
            />
            <button
              onClick={handleAIGenerate}
              disabled={!aiPrompt.trim() || aiGenerating}
              className="mb-6 w-full rounded-lg bg-accent-magic py-3 font-semibold text-white transition-all hover:bg-accent-magic/90 disabled:opacity-40"
            >
              {aiGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  AI 正在创作世界…
                </span>
              ) : (
                '🤖 生成游戏设定'
              )}
            </button>
            {aiError && (
              <div className="mb-4 rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-3 text-sm text-accent-danger">
                {aiError}
              </div>
            )}
            {aiResult?.success && aiResult.setting && (
              <div className="rounded-lg border border-accent-success/30 bg-accent-success/5 p-4">
                <h4 className="mb-3 font-semibold text-accent-success">
                  ✓ 设定生成成功
                </h4>
                <div className="mb-3 space-y-2 text-sm">
                  <div>
                    <span className="text-text-muted">世界名称：</span>
                    <span className="text-text-primary">
                      {aiResult.setting.worldMeta.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">类型：</span>
                    <span className="text-text-primary">
                      {aiResult.setting.worldMeta.genre}
                    </span>
                  </div>
                  <p className="text-secondary">
                    {aiResult.setting.worldMeta.description.slice(0, 200)}…
                  </p>
                </div>
                <button
                  onClick={handleAIApprove}
                  className="w-full rounded-lg bg-accent-gold py-2.5 font-semibold text-bg-deep transition-all hover:bg-accent-gold/90"
                >
                  使用此设定 →
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'confirm' && finalSetting && (
          <div>
            <h3 className="mb-4 text-xl font-semibold text-text-primary">
              确认游戏设定
            </h3>
            <div className="mb-6 space-y-4 rounded-lg border border-border-subtle bg-bg-input p-4">
              <div>
                <h4 className="text-lg font-bold text-accent-gold">
                  {finalSetting.worldMeta.name}
                </h4>
                <p className="text-sm text-text-muted">
                  {finalSetting.name} · v{finalSetting.version}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-text-muted">类型：</span>
                  <span className="text-text-primary">{finalSetting.worldMeta.genre}</span>
                </div>
                <div>
                  <span className="text-text-muted">基调：</span>
                  <span className="text-text-primary">{finalSetting.worldMeta.tone}</span>
                </div>
                <div>
                  <span className="text-text-muted">职业：</span>
                  <span className="text-text-primary">
                    {finalSetting.playerOptions?.availableClasses.length ?? 0} 种
                  </span>
                </div>
                <div>
                  <span className="text-text-muted">区域：</span>
                  <span className="text-text-primary">
                    {finalSetting.regions?.length ?? 0} 个
                  </span>
                </div>
              </div>
              <p className="text-sm text-secondary">{finalSetting.worldMeta.description}</p>
            </div>
            <button
              onClick={handleConfirm}
              className="w-full rounded-lg bg-accent-gold py-4 text-lg font-bold text-bg-deep transition-all hover:bg-accent-gold/90 hover:shadow-lg hover:shadow-accent-gold/20"
            >
              ⚔️ 开始冒险
            </button>
          </div>
        )}
      </div>

      {step !== 'source' && (
        <div className="mt-6 text-center">
          <button
            onClick={handleBack}
            className="text-sm text-text-muted hover:text-text-secondary"
          >
            ← 返回上一步
          </button>
        </div>
      )}
    </div>
  );
}
