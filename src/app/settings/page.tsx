/**
 * Settings Page — AI Narrator Game v4.1.0
 *
 * Route: /settings
 * Configure API Key, select game preset, or create custom games.
 *
 * v0.6.0: Added Text Import mode and Module Builder mode for custom game creation.
 * Custom games persist in localStorage and sync to useWorldStore.
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { withBase } from '@/lib/utils/base-path';
import { useWorldStore } from '@/stores/world-store';
import { GAME_SETTING_TEMPLATES } from '@/systems/settings/settings-loader';
import type { GameSettingTemplateId, CustomGameRecord, GameSetting } from '@/systems/settings/types';
import { TextImportPanel } from '@/components/settings/TextImportPanel';
import { ModuleBuilderPanel } from '@/components/settings/ModuleBuilderPanel';
import { CustomGameList } from '@/components/settings/CustomGameList';
import WorldBuilder from '@/components/settings/WorldBuilder';
import { secureSet, secureGet, secureRemove, migrateLegacyKey } from '@/infrastructure/crypto/secure-storage';

// ============================================================
// Constants
// ============================================================

/**
 * v3.0.0: 预设世界合并为唯一世界「凛冬要塞」。
 * 世界名即游戏名，不再提供多世界选择。
 */
const PRESET_IDS = ['frosthold'] as const;

const PRESET_LABELS: Record<string, string> = {
  frosthold: '🏰 凛冬要塞',
};

const PRESET_DESCS: Record<string, string> = {
  frosthold:
    '暗影再次笼罩中洲。你接过守夜人的火炬，在光明与黑暗的永恒博弈中做出不可逆转的选择。',
};

// Map settings page preset IDs to game page preset IDs
const PRESET_ID_MAP: Record<string, string> = {
  frosthold: 'frosthold',
};

declare global {
  interface CSSStyleDeclaration {
    [key: string]: string | number | null | undefined;
  }
}

// ============================================================
// Styles
// ============================================================

const S = {
  page: {
    minHeight: '100vh',
    background: '#0D0D12',
    color: '#E8E0D5',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    paddingBottom: '3rem',
  },
  header: {
    padding: '1.5rem 2rem',
    borderBottom: '1px solid #1E1B18',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 800,
    margin: '0 auto',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  logo: {
    fontSize: '1.5rem',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#C9A94E',
    margin: 0,
  },
  backLink: {
    color: '#A09888',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  content: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '1.5rem 2rem',
  },
  section: {
    marginBottom: '2rem',
  },
  sectionTitle: {
    fontSize: '1.0625rem',
    fontWeight: 600,
    color: '#C9A94E',
    marginBottom: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  sectionTitleIcon: {
    fontSize: '1.125rem',
  },
  sectionDesc: {
    color: '#8B8278',
    fontSize: '0.8125rem',
    marginBottom: '1rem',
    lineHeight: 1.5,
  },
  apiRow: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '0.5rem',
  },
  input: {
    flex: 1,
    padding: '0.625rem 0.875rem',
    borderRadius: 8,
    border: '1px solid #2E2924',
    background: '#1E1B18',
    color: '#E8E0D5',
    fontSize: '0.875rem',
    outline: 'none',
  },
  btn: {
    padding: '0.625rem 1.25rem',
    borderRadius: 8,
    border: 'none',
    background: '#2A2522',
    color: '#E8E0D5',
    fontWeight: 600,
    fontSize: '0.875rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  btnPrimary: {
    background: '#C9A94E',
    color: '#0D0D12',
  },
  btnDanger: {
    background: 'transparent',
    color: '#DC5050',
    border: '1px solid rgba(220,80,80,0.3)',
  },
  statusOk: {
    color: '#5A9E6F',
    fontSize: '0.75rem',
    fontWeight: 500,
    marginTop: '0.25rem',
  },
  statusError: {
    color: '#DC5050',
    fontSize: '0.75rem',
    fontWeight: 500,
    marginTop: '0.25rem',
  },
  presetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '0.75rem',
  },
  presetCard: {
    padding: '1rem',
    borderRadius: 10,
    background: '#1E1B18',
    border: '2px solid #2E2924',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
  },
  presetCardSelected: {
    borderColor: '#C9A94E',
    background: 'rgba(201,169,78,0.08)',
  },
  presetName: {
    color: '#E8E0D5',
    fontSize: '0.9375rem',
    fontWeight: 600,
    marginBottom: '0.375rem',
  },
  presetDesc: {
    color: '#A09888',
    fontSize: '0.8125rem',
    lineHeight: 1.4,
  },
  createModes: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '0.75rem',
    marginTop: '0.5rem',
  },
  createCard: {
    padding: '1.25rem',
    borderRadius: 10,
    background: 'linear-gradient(135deg, #1E1B18 0%, #25211D 100%)',
    border: '1px solid #2E2924',
    cursor: 'pointer',
    transition: 'border-color 0.2s, transform 0.15s',
  },
  createCardIcon: {
    fontSize: '1.5rem',
    marginBottom: '0.5rem',
  },
  createCardTitle: {
    color: '#E8E0D5',
    fontSize: '0.9375rem',
    fontWeight: 600,
    marginBottom: '0.375rem',
  },
  createCardDesc: {
    color: '#A09888',
    fontSize: '0.8125rem',
    lineHeight: 1.4,
  },
  goBtn: {
    display: 'block',
    width: '100%',
    padding: '0.875rem',
    borderRadius: 8,
    border: 'none',
    background: '#C9A94E',
    color: '#0D0D12',
    fontWeight: 700,
    fontSize: '1rem',
    cursor: 'pointer',
    marginTop: '1.5rem',
  },
  goBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  divider: {
    height: 1,
    background: '#2E2924',
    margin: '1.5rem 0',
  },
  infoBox: {
    padding: '0.75rem 1rem',
    borderRadius: 8,
    background: 'rgba(123,111,223,0.1)',
    border: '1px solid rgba(123,111,223,0.2)',
    color: '#A098B8',
    fontSize: '0.8125rem',
    lineHeight: 1.5,
  },
} as const;

// ============================================================
// Component
// ============================================================

export default function SettingsPage(): React.ReactElement {
  const router = useRouter();
  const loadGameSetting = useWorldStore((s) => s.loadGameSetting);

  // ── API Key ──
  const [apiKey, setApiKey] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState<'empty' | 'saved' | 'testing'>('empty');
  const [customApiEndpoint, setCustomApiEndpoint] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [showCustomApi, setShowCustomApi] = useState(false);

  // ── Selected Preset ──
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  // ── Custom Games ──
  const [customGames, setCustomGames] = useState<CustomGameRecord[]>([]);
  const [selectedCustomGameId, setSelectedCustomGameId] = useState<string | null>(null);

  // ── Modals ──
  const [showTextImport, setShowTextImport] = useState(false);
  const [showModuleBuilder, setShowModuleBuilder] = useState(false);
  const [showWorldBuilder, setShowWorldBuilder] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CustomGameRecord | null>(null);

  // ── Init localStorage ──
  useEffect(() => {
    async function init() {
      try {
        // API Key — FIX: SEC-1 使用安全加密存储替代明文 localStorage
        // 先尝试迁移旧明文 Key
        await migrateLegacyKey('ai-narrator-openrouter-api-key', 'deepseek-api-key');
        const savedKey = await secureGet('deepseek-api-key');
        if (savedKey) {
          setApiKey(savedKey);
          setApiKeyStatus('saved');
        }

      // Custom API config
      const customConf = localStorage.getItem('custom-api-config');
      if (customConf) {
        const parsed = JSON.parse(customConf);
        if (parsed.enabled) {
          setCustomApiEndpoint(parsed.endpoint ?? '');
          setCustomApiKey(parsed.apiKey ?? '');
          setShowCustomApi(true);
        }
      }

      // Preset
      const savedPreset = localStorage.getItem('ai-narrator-selected-preset');
      if (savedPreset) {
        // v3.0.0: 单一世界。旧存档中的任何旧预设 ID 统一迁移到 frosthold
        const reverseMap: Record<string, string> = {
          frosthold: 'frosthold',
          _imported: '_imported',
        };
        setSelectedPreset(reverseMap[savedPreset] ?? 'frosthold');
        if (savedPreset === '_imported') {
          // Find matching custom game
          const games = loadCustomGames();
          const imported = localStorage.getItem('ai-narrator-imported-setting');
          if (imported && games.length > 0) {
            const matching = games.find((g) => g.id === '_active');
            if (matching) setSelectedCustomGameId(matching.id);
            else setSelectedCustomGameId(games[0]?.id ?? null);
          }
          setCustomGames(games);
        }
      }

      // Custom games
      const games = loadCustomGames();
      setCustomGames(games);
    } catch {
      // Silent fail
    }
    }
    init();
  }, []);

  // ── Actions ──

  const handleSaveApiKey = useCallback(async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    // FIX: SEC-1 — 使用 AES-GCM 加密存储替代明文 localStorage
    await secureSet('deepseek-api-key', trimmed);
    setApiKeyStatus('saved');
  }, [apiKey]);

  const handleClearApiKey = useCallback(() => {
    secureRemove('deepseek-api-key');
    localStorage.removeItem('ai-narrator-openrouter-api-key'); // 兼容旧版本
    setApiKey('');
    setApiKeyStatus('empty');
  }, []);

  const handleSaveCustomApi = useCallback(() => {
    if (!customApiEndpoint.trim() || !customApiKey.trim()) return;
    localStorage.setItem(
      'custom-api-config',
      JSON.stringify({ enabled: true, endpoint: customApiEndpoint.trim(), apiKey: customApiKey.trim() })
    );
  }, [customApiEndpoint, customApiKey]);

  const handleClearCustomApi = useCallback(() => {
    localStorage.removeItem('custom-api-config');
    setCustomApiEndpoint('');
    setCustomApiKey('');
    setShowCustomApi(false);
  }, []);

  const handleSelectPreset = useCallback((presetId: string) => {
    setSelectedPreset(presetId);
    setSelectedCustomGameId(null);
      localStorage.setItem('ai-narrator-selected-preset', PRESET_ID_MAP[presetId] ?? presetId);
  }, []);

  const handleSelectCustomGame = useCallback(
    (record: CustomGameRecord) => {
      setSelectedCustomGameId(record.id);
      setSelectedPreset('_imported');
      localStorage.setItem('ai-narrator-selected-preset', '_imported');
      localStorage.setItem('ai-narrator-imported-setting', JSON.stringify(record.setting));
    },
    []
  );

  // ── Custom Game CRUD ──

  const handleSaveCustomGame = useCallback(
    (record: CustomGameRecord) => {
      const games = loadCustomGames();
      const existingIdx = games.findIndex((g) => g.id === record.id);
      if (existingIdx >= 0) {
        games[existingIdx] = record;
      } else {
        games.push(record);
      }
      saveCustomGames(games);
      setCustomGames(games);

      // Set as active
      setSelectedCustomGameId(record.id);
      setSelectedPreset('_imported');
      localStorage.setItem('ai-narrator-selected-preset', '_imported');
      localStorage.setItem('ai-narrator-imported-setting', JSON.stringify(record.setting));

      // Close modals
      setShowTextImport(false);
      setShowModuleBuilder(false);
      setShowWorldBuilder(false);
      setEditingRecord(null);
    },
    []
  );

  const handleWorldBuilderSave = useCallback(
    (setting: GameSetting) => {
      const now = new Date().toISOString();
      const record: CustomGameRecord = {
        id: setting.id,
        name: setting.worldMeta.name,
        createdBy: 'import',
        createdAt: now,
        updatedAt: now,
        setting,
        moduleSelection: undefined,
        rawText: undefined,
      };
      handleSaveCustomGame(record);
    },
    [handleSaveCustomGame]
  );

  const handleEditCustomGame = useCallback((record: CustomGameRecord) => {
    setEditingRecord(record);
    if (record.createdBy === 'import') {
      setShowTextImport(true);
      setShowModuleBuilder(false);
    } else {
      setShowModuleBuilder(true);
      setShowTextImport(false);
    }
  }, []);

  const handleDeleteCustomGame = useCallback((recordId: string) => {
    const games = loadCustomGames().filter((g) => g.id !== recordId);
    saveCustomGames(games);
    setCustomGames(games);

    if (selectedCustomGameId === recordId) {
      setSelectedCustomGameId(null);
      setSelectedPreset('');
      localStorage.removeItem('ai-narrator-selected-preset');
      localStorage.removeItem('ai-narrator-imported-setting');
    }
  }, [selectedCustomGameId]);

  // ── Go to game ──

  const handlePlay = useCallback(() => {
    if (!apiKey.trim() && !customApiKey.trim()) {
      return; // Need API key
    }

    // Determine and persist preset selection
    const effectivePreset = selectedPreset || 'frosthold';
    if (effectivePreset === '_imported') {
      localStorage.setItem('ai-narrator-selected-preset', '_imported');
      if (selectedCustomGameId) {
        const games = loadCustomGames();
        const target = games.find((g) => g.id === selectedCustomGameId);
        if (target) {
          localStorage.setItem('ai-narrator-imported-setting', JSON.stringify(target.setting));
          // Sync to store
          loadGameSetting({
            id: target.setting.id,
            name: target.setting.worldMeta.name,
            version: '1.0.0',
            worldMeta: target.setting.worldMeta,
          });
        }
      }
    } else {
      const gamePresetId = PRESET_ID_MAP[effectivePreset] ?? effectivePreset;
      localStorage.setItem('ai-narrator-selected-preset', gamePresetId);
      // Sync preset to store
      const presetMeta = GAME_SETTING_TEMPLATES.find((t) => t.id === effectivePreset);
      loadGameSetting({
        id: gamePresetId,
        name: presetMeta?.name ?? effectivePreset,
        version: '1.0.0',
        worldMeta: {
          name: presetMeta?.name ?? '',
          genre: presetMeta?.genre ?? '',
          tone: presetMeta?.tone ?? '',
          description: presetMeta?.description ?? '',
        },
      });
    }

    router.push('/game/new');
  }, [apiKey, customApiKey, selectedPreset, selectedCustomGameId, loadGameSetting, router]);

  const canPlay = !!(apiKey.trim() || customApiKey.trim());

  // ── Render ──

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <span style={S.logo}>🦊</span>
          <h1 style={S.title}>游戏设定</h1>
        </div>
        <a href={withBase('/')} style={S.backLink}>← 返回首页</a>
      </div>

      <div style={S.content}>
        {/* ── Section: API Key ── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>
            <span style={S.sectionTitleIcon}>🔑</span> API 配置
          </div>
          <div style={S.sectionDesc}>
            输入你的 DeepSeek API Key 以启用 AI 游戏主持人。API Key 仅存储在浏览器本地。
          </div>
          <div style={S.apiRow}>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setApiKeyStatus('empty'); }}
              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              style={S.input}
            />
            <button
              onClick={handleSaveApiKey}
              disabled={!apiKey.trim()}
              style={{
                ...S.btn,
                ...(apiKey.trim() ? S.btnPrimary : {}),
                opacity: apiKey.trim() ? 1 : 0.4,
              }}
            >
              保存
            </button>
            {apiKeyStatus === 'saved' && (
              <button onClick={handleClearApiKey} style={{ ...S.btn, ...S.btnDanger }}>
                清除
              </button>
            )}
          </div>
          {apiKeyStatus === 'saved' && (
            <div style={S.statusOk}>API Key 已保存 ✓</div>
          )}
          {apiKeyStatus === 'empty' && !apiKey && (
            <div style={S.statusError}>请输入 API Key</div>
          )}

          {/* Custom API Toggle */}
          <div style={{ marginTop: '0.75rem' }}>
            <button
              onClick={() => setShowCustomApi(!showCustomApi)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8B8278',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              {showCustomApi ? '收起自定义 API 配置' : '+ 自定义 API 端点'}
            </button>
          </div>
          {showCustomApi && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={S.apiRow}>
                <input
                  type="text"
                  value={customApiEndpoint}
                  onChange={(e) => setCustomApiEndpoint(e.target.value)}
                  placeholder="https://your-api.example.com/v1"
                  style={S.input}
                />
              </div>
              <div style={{ ...S.apiRow, marginTop: '0.5rem' }}>
                <input
                  type="password"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="自定义 API Key"
                  style={S.input}
                />
                <button
                  onClick={handleSaveCustomApi}
                  disabled={!customApiEndpoint.trim() || !customApiKey.trim()}
                  style={{
                    ...S.btn,
                    ...(customApiEndpoint.trim() && customApiKey.trim() ? S.btnPrimary : {}),
                    opacity: customApiEndpoint.trim() && customApiKey.trim() ? 1 : 0.4,
                  }}
                >
                  保存
                </button>
                <button onClick={handleClearCustomApi} style={{ ...S.btn, ...S.btnDanger }}>
                  清除
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={S.divider} />

        {/* ── Section: Presets ── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>
            <span style={S.sectionTitleIcon}>🎭</span> 预设游戏世界
          </div>
          <div style={S.sectionDesc}>
            选择一个预设世界，直接开始冒险。预设世界包含完整的背景故事、职业系统和开场叙事。
          </div>
          <div style={S.presetGrid}>
            {PRESET_IDS.map((pid) => {
              const template = GAME_SETTING_TEMPLATES.find((t) => t.id === pid);
              const isSelected = selectedPreset === pid;
              return (
                <div
                  key={pid}
                  onClick={() => handleSelectPreset(pid)}
                  style={{
                    ...S.presetCard,
                    ...(isSelected ? S.presetCardSelected : {}),
                  }}
                >
                  <div style={S.presetName}>
                    {PRESET_LABELS[pid] ?? template?.name ?? pid}
                  </div>
                  <div style={S.presetDesc}>
                    {PRESET_DESCS[pid] ?? template?.description ?? ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={S.divider} />

        {/* ── Section: Custom Games ── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>
            <span style={S.sectionTitleIcon}>🛠️</span> 创建自定义游戏
          </div>
          <div style={S.sectionDesc}>
            打造属于你自己的游戏世界。导入文本让 AI 解析世界观，或通过模块组合生成完整设定。
          </div>

          {/* Create Mode Buttons */}
          <div style={S.createModes}>
            <div
              onClick={() => { setEditingRecord(null); setShowTextImport(true); setShowModuleBuilder(false); }}
              style={S.createCard}
            >
              <div style={S.createCardIcon}>📋</div>
              <div style={S.createCardTitle}>文本导入模式</div>
              <div style={S.createCardDesc}>
                粘贴游戏设定文档，AI 自动解析世界观、职业、规则等结构化信息。
              </div>
            </div>
            <div
              onClick={() => { setEditingRecord(null); setShowModuleBuilder(true); setShowTextImport(false); }}
              style={S.createCard}
            >
              <div style={S.createCardIcon}>🧩</div>
              <div style={S.createCardTitle}>模块化拼搭模式</div>
              <div style={S.createCardDesc}>
                从 6 个维度选择游戏特性，AI 根据组合生成完整世界设定。
              </div>
            </div>
            <div
              onClick={() => setShowWorldBuilder(true)}
              style={S.createCard}
            >
              <div style={S.createCardIcon}>🧬</div>
              <div style={S.createCardTitle}>自定义世界观</div>
              <div style={S.createCardDesc}>
                自由定义世界观设定：时代、环境、社会、种族、势力、历史、叙事风格，一键生成完整 GameSetting。
              </div>
            </div>
          </div>

          {/* Custom Game List */}
          <div style={{ marginTop: '1.5rem' }}>
            <CustomGameList
              games={customGames}
              selectedId={selectedCustomGameId}
              onSelect={handleSelectCustomGame}
              onEdit={handleEditCustomGame}
              onDelete={handleDeleteCustomGame}
            />
          </div>
        </div>

        {/* ── Play Button ── */}
        <button
          onClick={handlePlay}
          disabled={!canPlay}
          style={{
            ...S.goBtn,
            ...(!canPlay ? S.goBtnDisabled : {}),
          }}
        >
          {canPlay ? '🎮 开始游戏' : '请先配置 API Key'}
        </button>
      </div>

      {/* ── Modals ── */}
      {showTextImport && (
        <TextImportPanel
          apiKey={apiKey}
          onSave={handleSaveCustomGame}
          onCancel={() => { setShowTextImport(false); setEditingRecord(null); }}
          existingRecord={editingRecord}
        />
      )}
      {showModuleBuilder && (
        <ModuleBuilderPanel
          apiKey={apiKey}
          onSave={handleSaveCustomGame}
          onCancel={() => { setShowModuleBuilder(false); setEditingRecord(null); }}
          existingRecord={editingRecord}
        />
      )}
      {showWorldBuilder && (
        <WorldBuilder
          onSave={handleWorldBuilderSave}
          onClose={() => setShowWorldBuilder(false)}
        />
      )}
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function loadCustomGames(): CustomGameRecord[] {
  try {
    const raw = localStorage.getItem('ai-narrator-custom-games');
    if (!raw) return [];
    return JSON.parse(raw) as CustomGameRecord[];
  } catch {
    return [];
  }
}

function saveCustomGames(games: CustomGameRecord[]): void {
  try {
    localStorage.setItem('ai-narrator-custom-games', JSON.stringify(games));
  } catch {
    // Storage full — ignore
  }
}
