'use client';

/**
 * Landing Actions — Client component for interactive buttons on the landing page.
 *
 * v4.1.0 重设计：
 * - 修复存档读取：从 `ai-narrator-save-slot-{i}` / `ai-narrator-slot-meta-{i}` 读取（原旧键无数据导致按钮永远禁用）
 * - 修复 API Key 检测：读取 `deepseek-api-key`（新键，兼容旧键）
 * - 视觉：主按钮发光 + 位移、存档卡 hover、下拉动效
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface SaveSlotMeta {
  slotIndex: number;
  label: string;
  worldName: string;
  playerName: string;
  savedAt: string;
  isEmpty?: boolean;
}

/** 读取所有非空存档槽（兼容新键 ai-narrator-slot-meta-N） */
function readSaveSlots(): SaveSlotMeta[] {
  try {
    const metas: SaveSlotMeta[] = [];
    for (let i = 0; i < 6; i += 1) {
      const raw = window.localStorage.getItem(`ai-narrator-slot-meta-${i}`);
      if (raw) {
        try {
          const meta = JSON.parse(raw) as SaveSlotMeta;
          if (meta && !meta.isEmpty) metas.push(meta);
        } catch {
          // skip corrupt slot
        }
      }
    }
    return metas.sort((a, b) => b.slotIndex - a.slotIndex);
  } catch {
    return [];
  }
}

/** 检测是否已配置 API Key（新键 deepseek-api-key 优先，兼容旧键） */
function hasStoredApiKey(): boolean {
  try {
    return (
      localStorage.getItem('deepseek-api-key') !== null ||
      localStorage.getItem('ai-narrator-openrouter-api-key') !== null
    );
  } catch {
    return false;
  }
}

export function LandingActions(): React.ReactElement {
  const router = useRouter();
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [saveSlots, setSaveSlots] = useState<SaveSlotMeta[]>([]);
  const [showSaves, setShowSaves] = useState(false);

  useEffect(() => {
    setHasApiKey(hasStoredApiKey());
    setSaveSlots(readSaveSlots());
  }, []);

  const handleStartAdventure = useCallback((): void => {
    router.push('/settings');
  }, [router]);

  const handleContinue = useCallback((): void => {
    if (saveSlots.length === 0) return;
    setShowSaves((prev) => !prev);
  }, [saveSlots.length]);

  const handleLoadSlot = useCallback(
    (slotIndex: number): void => {
      // 游戏页按 slotIndex 加载存档
      router.push(`/game/new?slot=${slotIndex}`);
    },
    [router]
  );

  const formatSavedAt = (savedAt: string): string => {
    try {
      const t = new Date(savedAt).getTime();
      if (Number.isNaN(t)) return '';
      const diff = Date.now() - t;
      const hours = Math.floor(diff / 3600000);
      if (hours < 1) return '刚刚';
      if (hours < 24) return `${hours} 小时前`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days} 天前`;
      const months = Math.floor(days / 30);
      return `${months} 个月前`;
    } catch {
      return '';
    }
  };

  return (
    <div className="mt-6 flex flex-col items-center gap-5">
      <div className="flex flex-wrap items-center justify-center gap-4">
        {/* 开始冒险 — 主按钮 */}
        <button
          onClick={handleStartAdventure}
          className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-b from-[#F5E3B3] to-accent-gold px-9 py-3.5 font-bold text-bg-deep shadow-lg shadow-accent-gold/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent-gold/40 active:translate-y-0 active:scale-95"
        >
          <span className="text-lg transition-transform duration-300 group-hover:rotate-12">⚔️</span>
          <span className="text-base">开始冒险</span>
          <span className="ml-1 transition-transform duration-300 group-hover:translate-x-1.5">→</span>
          {/* 顶部高光 */}
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/60" />
        </button>

        {/* 继续游戏 */}
        <button
          onClick={handleContinue}
          disabled={saveSlots.length === 0}
          className="group inline-flex items-center gap-2.5 rounded-xl border border-border-subtle bg-bg-panel/70 px-7 py-3.5 font-semibold text-text-primary backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-gold/40 hover:bg-bg-panel-raised disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
        >
          <span className="text-lg transition-transform duration-300 group-hover:scale-110">📂</span>
          <span>继续游戏</span>
          {saveSlots.length > 0 && (
            <span className="rounded-full bg-accent-gold/15 px-2 py-0.5 text-xs font-bold text-accent-gold">
              {saveSlots.length}
            </span>
          )}
        </button>
      </div>

      {/* 存档下拉 */}
      <div
        className={`w-full max-w-sm overflow-hidden rounded-xl border border-border-subtle bg-bg-panel shadow-xl transition-all duration-300 ${
          showSaves ? 'max-h-80 opacity-100' : 'max-h-0 border-transparent opacity-0'
        }`}
      >
        {showSaves && saveSlots.length > 0 && (
          <div className="p-4">
            <h3 className="mb-3 text-sm font-semibold tracking-wide text-text-muted">
              选择存档 · 凛冬要塞编年史
            </h3>
            <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
              {saveSlots.map((slot) => (
                <button
                  key={slot.slotIndex}
                  onClick={() => handleLoadSlot(slot.slotIndex)}
                  className="group flex items-center justify-between rounded-lg border border-border-subtle bg-bg-input px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-gold/40 hover:bg-bg-panel-raised"
                >
                  <div>
                    <div className="font-semibold text-text-primary">
                      {slot.label}
                      <span className="ml-2 text-xs font-normal text-text-muted">
                        {slot.worldName}
                      </span>
                    </div>
                    <div className="mt-0.5 text-sm text-secondary">
                      {slot.playerName || '无名领主'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-text-muted">
                      {formatSavedAt(slot.savedAt)}
                    </div>
                    <div className="mt-1 text-xs text-accent-gold opacity-0 transition-opacity group-hover:opacity-100">
                      继续 →
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* API Key 提示 */}
      {hasApiKey === false && (
        <p className="flex items-center gap-1.5 text-sm text-text-muted">
          <span className="text-accent-gold">✦</span>
          首次使用？配置 API Key 后即可开启冒险
        </p>
      )}
    </div>
  );
}
