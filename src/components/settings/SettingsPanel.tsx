'use client';

/**
 * Settings Panel — AI Narrator Game
 *
 * One-page settings configuration flow:
 *   Step 1 (source):  Choose method — preset / import / AI generate
 *   Step 2 (configure): Configure selected method
 *   Step 3 (confirm):   Review & confirm
 *
 * Also includes: API Key input, model selection dropdown.
 *
 * Epic 7 Story 7.5. Concept M07, M08, M09. ADR-001 (API Key in localStorage).
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorldStore } from '@/stores/world-store';
import { useUIStore } from '@/stores/ui-store';
import { DEFAULT_MODELS } from '@/lib/constants';
import {
  loadFromJSON,
  validate,
  GAME_SETTING_TEMPLATES,
  getBuiltInPreset,
} from '@/systems/settings/settings-loader';
import { generateSetting, buildPromptSuggestion } from '@/systems/settings/ai-generator';
import { TextImportModal } from '@/components/settings/TextImportModal';
import type {
  GameSetting,
  SettingsStep,
  SettingSource,
  AIGenerationResult,
} from '@/systems/settings/types';

// Inline API key helpers (avoid importing heavy openrouter/client module)
const API_KEY_STORAGE = 'ai-narrator-openrouter-api-key';

function getKey(): string | null {
  try { return localStorage.getItem(API_KEY_STORAGE); }
  catch { return null; }
}
function saveKey(k: string): void {
  try { localStorage.setItem(API_KEY_STORAGE, k); } catch { /* ignore */ }
}
function clearKey(): void {
  try { localStorage.removeItem(API_KEY_STORAGE); } catch { /* ignore */ }
}

// ============================================================
// Custom API Config Types
// ============================================================

interface CustomApiConfig {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
}

const CUSTOM_API_STORAGE_KEY = 'custom-api-config';
const DEFAULT_CUSTOM_ENDPOINT = 'https://api.deepseek.com/v1';

function loadCustomApiConfig(): CustomApiConfig {
  try {
    const raw = localStorage.getItem(CUSTOM_API_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CustomApiConfig;
      return {
        enabled: parsed.enabled === true,
        endpoint: parsed.endpoint || DEFAULT_CUSTOM_ENDPOINT,
        apiKey: parsed.apiKey || '',
      };
    }
  } catch { /* ignore */ }
  return { enabled: false, endpoint: DEFAULT_CUSTOM_ENDPOINT, apiKey: '' };
}

function saveCustomApiConfig(config: CustomApiConfig): void {
  try {
    localStorage.setItem(CUSTOM_API_STORAGE_KEY, JSON.stringify(config));
  } catch { /* ignore */ }
}

// ============================================================
// Component
// ============================================================

export function SettingsPanel(): React.ReactElement {
  const router = useRouter();
  const loadGameSetting = useWorldStore((s) => s.loadGameSetting);
  const selectedModel = useUIStore((s) => s.selectedModel);
  const setSelectedModel = useUIStore((s) => s.setSelectedModel);

  // ── API Key State ──
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [keyError, setKeyError] = useState('');

  // ── Flow State ──
  const [step, setStep] = useState<SettingsStep>('source');
  const [source, setSource] = useState<SettingSource>(null);

  // ── Preset State ──
  const [selectedTemplateId, setSelectedTemplateId] = useState('frosthold');

  // ── Import State ──
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

  // ── AI Generate State ──
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<AIGenerationResult | null>(null);
  const [aiError, setAiError] = useState('');

  // ── Custom API Config ──
  const [customConfig, setCustomConfig] = useState<CustomApiConfig>(loadCustomApiConfig);
  const [showCustomApi, setShowCustomApi] = useState(false);

  // ── Text Import Modal ──
  const [showTextImport, setShowTextImport] = useState(false);

  // ── Final Setting ──
  const [finalSetting, setFinalSetting] = useState<GameSetting | null>(null);

  // ── Load stored API Key on mount ──
  useEffect(() => {
    const stored = getKey();
    if (stored) {
      setApiKey(stored);
      setKeyStatus('valid');
    }
  }, []);

  // ============================================================
  // API Key Handlers
  // ============================================================

  const handleSaveKey = useCallback(() => {
    if (!apiKey.trim()) return;
    saveKey(apiKey.trim());
    setKeyStatus('valid');
  }, [apiKey]);

  const handleClearKey = useCallback(() => {
    clearKey();
    setApiKey('');
    setKeyStatus('idle');
    setKeyError('');
  }, []);

  // ── Custom API Handlers ──
  const handleCustomToggle = useCallback((enabled: boolean) => {
    setCustomConfig((prev) => {
      const next = { ...prev, enabled };
      saveCustomApiConfig(next);
      return next;
    });
  }, []);

  const handleCustomEndpointChange = useCallback((endpoint: string) => {
    setCustomConfig((prev) => {
      const next = { ...prev, endpoint };
      saveCustomApiConfig(next);
      return next;
    });
  }, []);

  const handleCustomApiKeyChange = useCallback((apiKey: string) => {
    setCustomConfig((prev) => {
      const next = { ...prev, apiKey };
      saveCustomApiConfig(next);
      return next;
    });
  }, []);

  // ── Text Import Handler ──
  const handleTextImportConfirm = useCallback((setting: GameSetting) => {
    setFinalSetting(setting);
    setStep('confirm');
    setShowTextImport(false);
  }, []);

  // ============================================================
  // Source Selection
  // ============================================================

  const handleSelectSource = useCallback((s: SettingSource) => {
    setSource(s);
    setStep('configure');
    setImportError('');
    setAiError('');
    setAiResult(null);
  }, []);

  // ============================================================
  // Preset Handler
  // ============================================================

  const handlePresetConfirm = useCallback(() => {
    const preset = getBuiltInPreset(selectedTemplateId);
    if (preset) {
      setFinalSetting(preset);
      setStep('confirm');
    }
  }, [selectedTemplateId]);

  // ============================================================
  // Import Handler
  // ============================================================

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

  // ============================================================
  // AI Generate Handler
  // ============================================================

  const handleAIGenerate = useCallback(async () => {
    if (!aiPrompt.trim() || !apiKey.trim()) return;

    setAiGenerating(true);
    setAiError('');
    setAiResult(null);

    try {
      const result = await generateSetting({
        prompt: aiPrompt.trim(),
        temperature: 0.8,
        model: selectedModel,
        apiKey: apiKey.trim(),
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
  }, [aiPrompt, apiKey, selectedModel]);

  const handleAIApprove = useCallback(() => {
    if (aiResult?.setting) {
      setFinalSetting(aiResult.setting);
      setStep('confirm');
    }
  }, [aiResult]);

  // ============================================================
  // Final Confirm
  // ============================================================

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

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-bold text-accent-gold">
          冒险准备
        </h1>
        <p className="mt-2 text-secondary">配置你的 AI 冒险之旅</p>
      </div>

      {/* ── Step 0: 准备工作 (API 配置) ── */}
      <section className="mb-6 rounded-xl border-2 border-accent-gold/30 bg-bg-panel p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-gold text-sm font-bold text-bg-deep">
            0
          </span>
          <h2 className="text-lg font-semibold text-accent-gold">
            准备工作：配置 API
          </h2>
          {keyStatus === 'valid' && (
            <span className="rounded-full bg-accent-success/20 px-2 py-0.5 text-xs text-accent-success">
              ✓ 已就绪
            </span>
          )}
        </div>
        <p className="mb-4 text-sm text-secondary">
          在开始冒险之前，需要先配置 AI 模型连接。API Key 仅存储在浏览器本地（ADR-001）。
        </p>

        {/* OpenRouter API Key */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-text-primary">
            OpenRouter API Key
          </label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setKeyStatus('idle');
                }}
                placeholder="sk-or-..."
                className="w-full rounded-lg border border-border-subtle bg-bg-input px-4 py-2.5 pr-10 text-text-primary placeholder:text-text-muted focus:border-accent-gold focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                aria-label={showKey ? '隐藏 API Key' : '显示 API Key'}
              >
                {showKey ? '🙈' : '👁️'}
              </button>
            </div>
            <button
              onClick={handleSaveKey}
            disabled={!apiKey.trim()}
            className="rounded-lg bg-accent-gold px-5 py-2.5 font-medium text-bg-deep transition-all hover:bg-accent-gold/90 disabled:opacity-40"
          >
            保存
            </button>
            {keyStatus === 'valid' && (
              <button
                onClick={handleClearKey}
                className="rounded-lg border border-accent-danger/30 px-3 py-2.5 text-sm text-accent-danger hover:bg-accent-danger/10"
              >
                清除
              </button>
            )}
          </div>
          {keyStatus === 'valid' && (
            <p className="mt-2 text-sm text-accent-success">✓ API Key 验证通过</p>
          )}
          {keyStatus === 'invalid' && (
            <p className="mt-2 text-sm text-accent-danger">✗ {keyError}</p>
          )}
        </div>

        {/* Custom API (collapsible) */}
        <div className="mb-4 border-t border-border-subtle pt-4">
          <button
            type="button"
            onClick={() => setShowCustomApi(!showCustomApi)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-sm font-medium text-text-primary">
              自定义 API 配置（可选）
            </span>
            <span className="text-text-muted text-xs transition-transform" style={{ transform: showCustomApi ? 'rotate(90deg)' : 'rotate(0deg)' }}>
              ▶
            </span>
          </button>
          <p className="mt-1 text-xs text-text-muted">
            使用自定义 API 端点（如 DeepSeek 直连）替代 OpenRouter。
          </p>

          {showCustomApi && (
            <div className="mt-3 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={customConfig.enabled}
                    onChange={(e) => handleCustomToggle(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`h-6 w-11 rounded-full transition-colors ${
                      customConfig.enabled ? 'bg-accent-gold' : 'bg-bg-input border border-border-subtle'
                    }`}
                  />
                  <div
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      customConfig.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
                <span className="text-sm text-text-primary">使用自定义配置</span>
              </label>

              <div>
                <label className="mb-1 block text-xs text-text-secondary">API 端点 URL</label>
                <input
                  type="text"
                  value={customConfig.endpoint}
                  onChange={(e) => handleCustomEndpointChange(e.target.value)}
                  placeholder={DEFAULT_CUSTOM_ENDPOINT}
                  disabled={!customConfig.enabled}
                  className="w-full rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-gold focus:outline-none disabled:opacity-40"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-text-secondary">自定义 API Key</label>
                <input
                  type="password"
                  value={customConfig.apiKey}
                  onChange={(e) => handleCustomApiKeyChange(e.target.value)}
                  placeholder="sk-..."
                  disabled={!customConfig.enabled}
                  className="w-full rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-gold focus:outline-none disabled:opacity-40"
                />
              </div>

              {customConfig.enabled && (
                <div className="rounded-lg border border-accent-gold/30 bg-accent-gold/5 p-2 text-xs text-accent-gold">
                  ⚡ 已启用自定义 API：{customConfig.endpoint || DEFAULT_CUSTOM_ENDPOINT}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Model Selection */}
        <div className="border-t border-border-subtle pt-4">
          <label className="mb-2 block text-sm font-medium text-text-primary">
            AI 模型选择
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            {DEFAULT_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedModel(m.id)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                  selectedModel === m.id
                    ? 'border-accent-gold bg-accent-gold/10 text-accent-gold'
                    : 'border-border-subtle bg-bg-input text-text-secondary hover:border-border-active'
                }`}
              >
                <div className="font-medium">{m.name}</div>
                <div className="text-xs opacity-60">{m.provider}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

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

      {/* Step Content */}
      <div className="rounded-xl border border-border-subtle bg-bg-panel p-6">
        {step === 'source' && (
          <SourceStep onSelect={handleSelectSource} />
        )}

        {step === 'configure' && source === 'preset' && (
          <PresetConfigStep
            templateId={selectedTemplateId}
            onTemplateChange={setSelectedTemplateId}
            onConfirm={handlePresetConfirm}
          />
        )}

        {step === 'configure' && source === 'import' && (
          <ImportStep
            importText={importText}
            onImportTextChange={setImportText}
            error={importError}
            onPreview={handleImportPreview}
            onTextPaste={() => setShowTextImport(true)}
          />
        )}

        {step === 'configure' && source === 'ai-generate' && (
          <AIGenerateStep
            prompt={aiPrompt}
            onPromptChange={setAiPrompt}
            onGenerate={handleAIGenerate}
            generating={aiGenerating}
            result={aiResult}
            error={aiError}
            onApprove={handleAIApprove}
            hasApiKey={keyStatus === 'valid'}
          />
        )}

        {step === 'confirm' && finalSetting && (
          <ConfirmStep
            setting={finalSetting}
            onConfirm={handleConfirm}
          />
        )}
      </div>

      {/* Back Button */}
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

      {/* Text Import Modal (Feature 2: v0.3.0) */}
      {showTextImport && (
        <TextImportModal
          onConfirm={handleTextImportConfirm}
          onClose={() => setShowTextImport(false)}
          openRouterKey={apiKey}
          model={selectedModel}
        />
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function SourceStep({
  onSelect,
}: {
  onSelect: (source: SettingSource) => void;
}): React.ReactElement {
  return (
    <div>
      <h3 className="mb-4 text-xl font-semibold text-text-primary">
        选择设定来源
      </h3>
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Preset */}
        <button
          onClick={() => onSelect('preset')}
          className="rounded-xl border border-border-subtle bg-bg-input p-6 text-center transition-all hover:border-accent-gold hover:bg-bg-panel-raised"
        >
          <div className="mb-3 text-4xl">🏰</div>
          <div className="font-semibold text-text-primary">预置模板</div>
          <div className="mt-1 text-sm text-secondary">
            使用内置的奇幻冒险世界
          </div>
        </button>

        {/* Import */}
        <button
          onClick={() => onSelect('import')}
          className="rounded-xl border border-border-subtle bg-bg-input p-6 text-center transition-all hover:border-accent-gold hover:bg-bg-panel-raised"
        >
          <div className="mb-3 text-4xl">📄</div>
          <div className="font-semibold text-text-primary">导入设定</div>
          <div className="mt-1 text-sm text-secondary">
            粘贴 JSON 格式的游戏设定
          </div>
        </button>

        {/* AI Generate */}
        <button
          onClick={() => onSelect('ai-generate')}
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
  );
}

function PresetConfigStep({
  templateId,
  onTemplateChange,
  onConfirm,
}: {
  templateId: string;
  onTemplateChange: (id: string) => void;
  onConfirm: () => void;
}): React.ReactElement {
  const template = GAME_SETTING_TEMPLATES.find((t) => t.id === templateId);
  const preset = getBuiltInPreset(templateId);

  return (
    <div>
      <h3 className="mb-4 text-xl font-semibold text-text-primary">
        选择预设模板
      </h3>

      {/* Template selection */}
      <div className="mb-6 grid gap-3">
        {GAME_SETTING_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => onTemplateChange(t.id)}
            className={`rounded-lg border p-4 text-left transition-all ${
              templateId === t.id
                ? 'border-accent-gold bg-accent-gold/10'
                : 'border-border-subtle bg-bg-input hover:border-border-active'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{t.icon}</span>
              <div>
                <div className="font-semibold text-text-primary">{t.name}</div>
                <div className="text-sm text-secondary">
                  {t.genre} · {t.tone}
                </div>
                <div className="mt-1 text-sm text-text-muted">
                  {t.description}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Preset Preview */}
      {preset && (
        <div className="mb-6 rounded-lg border border-border-subtle bg-bg-input p-4">
          <h4 className="mb-2 font-semibold text-text-primary">
            {preset.worldMeta.name}
          </h4>
          <p className="mb-3 text-sm text-secondary">
            {preset.worldMeta.description}
          </p>
          <div className="grid gap-1 text-sm text-text-muted">
            <div>
              📍 {preset.regions?.length ?? 0} 个区域
            </div>
            <div>
              👥 {preset.npcs?.length ?? 0} 个 NPC
            </div>
            <div>
              ⚔️ {preset.playerOptions?.availableClasses.length ?? 0} 个职业
            </div>
            <div>
              📜 {preset.worldRules?.length ?? 0} 条世界规则
            </div>
          </div>
        </div>
      )}

      <button
        onClick={onConfirm}
        className="w-full rounded-lg bg-accent-gold py-3 font-semibold text-bg-deep transition-all hover:bg-accent-gold/90"
      >
        使用此设定 →
      </button>
    </div>
  );
}

function ImportStep({
  importText,
  onImportTextChange,
  error,
  onPreview,
  onTextPaste,
}: {
  importText: string;
  onImportTextChange: (text: string) => void;
  error: string;
  onPreview: () => void;
  onTextPaste: () => void;
}): React.ReactElement {
  return (
    <div>
      <h3 className="mb-4 text-xl font-semibold text-text-primary">
        导入设定
      </h3>
      <p className="mb-3 text-sm text-secondary">
        选择导入方式：粘贴 JSON 格式的游戏设定，或粘贴文本让 AI 自动分析生成。
      </p>

      {/* Text Paste Button (Feature 2: v0.3.0) */}
      <button
        onClick={onTextPaste}
        className="mb-4 w-full rounded-lg border-2 border-dashed border-accent-magic/50 bg-accent-magic/5 py-4 text-center transition-all hover:border-accent-magic hover:bg-accent-magic/10"
      >
        <div className="text-3xl">📝</div>
        <div className="mt-1 font-semibold text-accent-magic">粘贴文本 → AI 分析生成</div>
        <div className="mt-0.5 text-sm text-text-muted">
          粘贴小说片段或世界观描述，AI 自动生成游戏设定
        </div>
      </button>

      <div className="mb-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-border-subtle" />
        <span className="text-sm text-text-muted">或</span>
        <div className="h-px flex-1 bg-border-subtle" />
      </div>

      {/* JSON Import */}
      <p className="mb-3 text-sm text-secondary">
        直接粘贴完整的游戏设定 JSON。
      </p>
      <textarea
        value={importText}
        onChange={(e) => {
          onImportTextChange(e.target.value);
        }}
        placeholder='{ "id": "my-world", "name": "我的世界", ... }'
        rows={12}
        className="mb-4 w-full rounded-lg border border-border-subtle bg-bg-input px-4 py-3 font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-accent-gold focus:outline-none"
      />
      {error && (
        <div className="mb-4 whitespace-pre-wrap rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-3 text-sm text-accent-danger">
          {error}
        </div>
      )}
      <button
        onClick={onPreview}
        disabled={!importText.trim()}
        className="w-full rounded-lg bg-accent-gold py-3 font-semibold text-bg-deep transition-all hover:bg-accent-gold/90 disabled:opacity-40"
      >
        验证并预览 →
      </button>
    </div>
  );
}

function AIGenerateStep({
  prompt,
  onPromptChange,
  onGenerate,
  generating,
  result,
  error,
  onApprove,
  hasApiKey,
}: {
  prompt: string;
  onPromptChange: (p: string) => void;
  onGenerate: () => void;
  generating: boolean;
  result: AIGenerationResult | null;
  error: string;
  onApprove: () => void;
  hasApiKey: boolean;
}): React.ReactElement {
  return (
    <div>
      <h3 className="mb-4 text-xl font-semibold text-text-primary">
        AI 生成游戏设定
      </h3>

      {!hasApiKey && (
        <div className="mb-4 rounded-lg border border-accent-gold/30 bg-accent-gold/10 p-3 text-sm text-accent-gold">
          ⚠️ 请先在上方配置并验证 OpenRouter API Key
        </div>
      )}

      <p className="mb-3 text-sm text-secondary">
        描述你想要的游戏世界——类型、风格、关键元素等。AI 将为你生成完整的游戏设定。
      </p>

      {/* Quick suggestions */}
      <div className="mb-3 flex flex-wrap gap-2">
        {['fantasy', 'scifi', 'horror', 'wuxia'].map((theme) => (
          <button
            key={theme}
            type="button"
            onClick={() =>
              onPromptChange(buildPromptSuggestion(theme))
            }
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
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder="例如：创建一个蒸汽朋克风格的奇幻世界，魔法与科技并存。天空中有浮空岛，地面上是迷雾笼罩的废土..."
        rows={4}
        className="mb-4 w-full rounded-lg border border-border-subtle bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-gold focus:outline-none"
      />

      <button
        onClick={onGenerate}
        disabled={!prompt.trim() || generating || !hasApiKey}
        className="mb-6 w-full rounded-lg bg-accent-magic py-3 font-semibold text-white transition-all hover:bg-accent-magic/90 disabled:opacity-40"
      >
        {generating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            AI 正在创作世界…
          </span>
        ) : (
          '🤖 生成游戏设定'
        )}
      </button>

      {error && (
        <div className="mb-4 rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-3 text-sm text-accent-danger">
          {error}
        </div>
      )}

      {/* AI Result Preview */}
      {result?.success && result.setting && (
        <div className="rounded-lg border border-accent-success/30 bg-accent-success/5 p-4">
          <h4 className="mb-3 font-semibold text-accent-success">
            ✓ 设定生成成功
          </h4>
          <div className="mb-3 space-y-2 text-sm">
            <div>
              <span className="text-text-muted">世界名称：</span>
              <span className="text-text-primary">
                {result.setting.worldMeta.name}
              </span>
            </div>
            <div>
              <span className="text-text-muted">类型：</span>
              <span className="text-text-primary">
                {result.setting.worldMeta.genre}
              </span>
            </div>
            <div>
              <span className="text-text-muted">基调：</span>
              <span className="text-text-primary">
                {result.setting.worldMeta.tone}
              </span>
            </div>
            <p className="text-secondary">
              {result.setting.worldMeta.description.slice(0, 200)}
              {(result.setting.worldMeta.description.length ?? 0) > 200
                ? '…'
                : ''}
            </p>
          </div>
          <button
            onClick={onApprove}
            className="w-full rounded-lg bg-accent-gold py-2.5 font-semibold text-bg-deep transition-all hover:bg-accent-gold/90"
          >
            使用此设定 →
          </button>
        </div>
      )}
    </div>
  );
}

function ConfirmStep({
  setting,
  onConfirm,
}: {
  setting: GameSetting;
  onConfirm: () => void;
}): React.ReactElement {
  return (
    <div>
      <h3 className="mb-4 text-xl font-semibold text-text-primary">
        确认游戏设定
      </h3>

      <div className="mb-6 space-y-4 rounded-lg border border-border-subtle bg-bg-input p-4">
        <div>
          <h4 className="text-lg font-bold text-accent-gold">
            {setting.worldMeta.name}
          </h4>
          <p className="text-sm text-text-muted">
            {setting.name} · v{setting.version}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-text-muted">类型：</span>
            <span className="text-text-primary">
              {setting.worldMeta.genre}
            </span>
          </div>
          <div>
            <span className="text-text-muted">基调：</span>
            <span className="text-text-primary">
              {setting.worldMeta.tone}
            </span>
          </div>
          <div>
            <span className="text-text-muted">职业：</span>
            <span className="text-text-primary">
              {setting.playerOptions?.availableClasses.length ?? 0} 种
            </span>
          </div>
          <div>
            <span className="text-text-muted">区域：</span>
            <span className="text-text-primary">
              {setting.regions?.length ?? 0} 个
            </span>
          </div>
          <div>
            <span className="text-text-muted">NPC：</span>
            <span className="text-text-primary">
              {setting.npcs?.length ?? 0} 个
            </span>
          </div>
          <div>
            <span className="text-text-muted">来源：</span>
            <span className="text-text-primary">
              {setting.createdBy === 'preset' && '预置模板'}
              {setting.createdBy === 'import' && '自定义导入'}
              {setting.createdBy === 'ai-generated' && 'AI 生成'}
            </span>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-secondary">
          {setting.worldMeta.description}
        </p>

        {setting.startingLocation && (
          <div className="rounded border border-border-subtle bg-bg-deep/40 p-3">
            <div className="mb-1 text-xs font-semibold text-text-muted">
              📍 开场叙事
            </div>
            <p className="text-sm italic text-text-primary">
              {setting.startingLocation.openingNarrative.slice(0, 300)}
              {setting.startingLocation.openingNarrative.length > 300
                ? '…'
                : ''}
            </p>
          </div>
        )}
      </div>

      <button
        onClick={onConfirm}
        className="w-full rounded-lg bg-accent-gold py-4 text-lg font-bold text-bg-deep transition-all hover:bg-accent-gold/90 hover:shadow-lg hover:shadow-accent-gold/20"
      >
        ⚔️ 开始冒险
      </button>
    </div>
  );
}
