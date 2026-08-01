'use client';

/**
 * SaveLoadPanel — 存档管理 UI 组件
 *
 * @description
 * Modal 形式的存档管理面板，支持：
 * - 3 个存档槽位列表
 * - 保存 / 加载 / 删除操作
 * - 导出 / 导入 JSON 文件
 * - 确认对话框防止误操作
 * - 存储配额警告
 *
 * 从状态栏或 Esc 菜单打开。
 *
 * @see Epic 6 Story 6.4
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { saveManager } from '@/systems/save/save-manager';
import type { SaveSlotMeta, StorageQuotaInfo } from '@/systems/save/types';
import { MAX_SAVE_SLOTS } from '@/systems/save/types';
import { useUIStore } from '@/stores/ui-store';
import { useWorldStore } from '@/stores/world-store';

// ============================================================
// 类型
// ============================================================

/** 确认对话框类型 */
type ConfirmAction =
  | { type: 'overwrite'; slotIndex: number; meta: SaveSlotMeta }
  | { type: 'load'; slotIndex: number; meta: SaveSlotMeta }
  | { type: 'delete'; slotIndex: number; meta: SaveSlotMeta }
  | null;

/** 槽位数据 */
interface SlotData {
  meta: SaveSlotMeta | null;
  isEmpty: boolean;
}

// ============================================================
// 辅助函数
// ============================================================

/** 格式化毫秒为可读时长 */
function formatPlayTime(ms: number): string {
  if (ms <= 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours} 小时 ${minutes} 分钟`;
  }
  return `${minutes} 分钟`;
}

/** 格式化时间戳为可读日期 */
function formatTimestamp(ts: number): string {
  if (ts <= 0) return '—';
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 格式化字节为可读大小 */
function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

// ============================================================
// SaveLoadPanel 组件
// ============================================================

export default function SaveLoadPanel() {
  // --- Store ---
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const playerName = useWorldStore((s) => s.playerName);
  const playerClass = useWorldStore((s) => s.playerClass);
  const gameSetting = useWorldStore((s) => s.gameSetting);

  // --- 本地状态 ---
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error'>('info');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [quota, setQuota] = useState<StorageQuotaInfo | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isOpen = activeModal === 'save-load';

  // --- 刷新槽位列表 ---
  const refreshSlots = useCallback(async () => {
    try {
      const metas = await saveManager.listSaves();
      const slotMap = new Map<number, SaveSlotMeta>();
      for (const m of metas) {
        slotMap.set(m.slotIndex, m);
      }

      const list: SlotData[] = [];
      for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
        const meta = slotMap.get(i) ?? null;
        list.push({ meta, isEmpty: meta === null });
      }
      setSlots(list);

      // 刷新配额
      const q = await saveManager.checkQuota();
      setQuota(q);
    } catch {
      // 静默处理
    }
  }, []);

  // --- 打开时刷新 ---
  useEffect(() => {
    if (isOpen) {
      void refreshSlots();
    }
  }, [isOpen, refreshSlots]);

  // --- 关闭面板 ---
  const handleClose = useCallback(() => {
    setConfirmAction(null);
    setStatusMsg(null);
    closeModal();
  }, [closeModal]);

  // --- 显示状态消息 ---
  const showStatus = useCallback(
    (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
      setStatusMsg(msg);
      setStatusType(type);
      // 3 秒后自动清除
      setTimeout(() => setStatusMsg(null), 3000);
    },
    []
  );

  // ===========================================================================
  // 操作处理
  // ===========================================================================

  /** 保存到槽位 */
  const handleSave = useCallback(
    async (slotIndex: number, meta: SaveSlotMeta | null) => {
      if (meta) {
        // 有存档 → 确认覆盖
        setConfirmAction({ type: 'overwrite', slotIndex, meta });
        return;
      }

      // 空槽位 → 直接保存
      await doSave(slotIndex);
    },
    []
  );

  /** 执行保存 */
  const doSave = useCallback(
    async (slotIndex: number) => {
      setLoading(true);
      setStatusMsg(null);

      const result = await saveManager.save(slotIndex);

      if (result.success) {
        showStatus(`已保存到槽位 ${slotIndex + 1}`, 'success');
      } else {
        showStatus(result.error ?? '保存失败', 'error');
      }

      setLoading(false);
      setConfirmAction(null);
      await refreshSlots();
    },
    [showStatus, refreshSlots]
  );

  /** 加载存档 */
  const handleLoad = useCallback((slotIndex: number, meta: SaveSlotMeta) => {
    setConfirmAction({ type: 'load', slotIndex, meta });
  }, []);

  /** 执行加载 */
  const doLoad = useCallback(
    async (slotIndex: number) => {
      setLoading(true);
      setStatusMsg(null);

      const result = await saveManager.load(slotIndex);

      if (result.success) {
        showStatus(`已从槽位 ${slotIndex + 1} 加载存档`, 'success');
        // 加载成功后延迟关闭面板
        setTimeout(() => handleClose(), 1000);
      } else {
        showStatus(result.error ?? '加载失败', 'error');
      }

      setLoading(false);
      setConfirmAction(null);
    },
    [showStatus, handleClose]
  );

  /** 删除存档 */
  const handleDelete = useCallback((slotIndex: number, meta: SaveSlotMeta) => {
    setConfirmAction({ type: 'delete', slotIndex, meta });
  }, []);

  /** 执行删除 */
  const doDelete = useCallback(
    async (slotIndex: number) => {
      setLoading(true);
      setStatusMsg(null);

      const result = await saveManager.deleteSave(slotIndex);

      if (result.success) {
        showStatus(`槽位 ${slotIndex + 1} 的存档已删除`, 'success');
      } else {
        showStatus(result.error ?? '删除失败', 'error');
      }

      setLoading(false);
      setConfirmAction(null);
      await refreshSlots();
    },
    [showStatus, refreshSlots]
  );

  /** 导出存档 */
  const handleExport = useCallback(
    async (slotIndex: number) => {
      setLoading(true);
      const json = await saveManager.exportSave(slotIndex);
      setLoading(false);

      if (!json) {
        showStatus('导出失败：无法读取存档数据。', 'error');
        return;
      }

      // 触发浏览器下载
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-narrator-save-slot-${slotIndex + 1}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showStatus(`槽位 ${slotIndex + 1} 已导出为 JSON 文件`, 'success');
    },
    [showStatus]
  );

  /** 触发导入文件选择 */
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /** 处理导入文件 */
  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // 找到第一个空槽位
      const emptySlot = slots.find((s) => s.isEmpty);
      const targetSlot = emptySlot ? slots.indexOf(emptySlot) : 0;

      try {
        const text = await file.text();
        setLoading(true);

        const result = await saveManager.importSave(text, targetSlot);

        if (result.success) {
          showStatus(`存档已导入到槽位 ${targetSlot + 1}`, 'success');
        } else {
          showStatus(result.error ?? '导入失败：存档格式无效。', 'error');
        }
      } catch {
        showStatus('导入失败：无法读取文件。', 'error');
      }

      setLoading(false);
      await refreshSlots();

      // 重置 file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [slots, showStatus, refreshSlots]
  );

  // ===========================================================================
  // 确认对话框
  // ===========================================================================

  const confirmDialog = confirmAction && (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div className="w-96 rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <h3 className="mb-2 text-lg font-semibold text-zinc-100">
          {confirmAction.type === 'overwrite' && '确认覆盖'}
          {confirmAction.type === 'load' && '确认加载'}
          {confirmAction.type === 'delete' && '确认删除'}
        </h3>
        <p className="mb-4 text-sm text-zinc-400">
          {confirmAction.type === 'overwrite' && (
            <>
              槽位 {confirmAction.slotIndex + 1} 已有存档
              {confirmAction.meta.label ? `「${confirmAction.meta.label}」` : ''}，
              覆盖后将无法恢复。
            </>
          )}
          {confirmAction.type === 'load' && (
            <>
              将加载槽位 {confirmAction.slotIndex + 1} 的存档
              {confirmAction.meta.label ? `「${confirmAction.meta.label}」` : ''}。
              当前未保存的进度将会丢失。
            </>
          )}
          {confirmAction.type === 'delete' && (
            <>
              将永久删除槽位 {confirmAction.slotIndex + 1} 的存档
              {confirmAction.meta.label ? `「${confirmAction.meta.label}」` : ''}，
              此操作无法撤销。
            </>
          )}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setConfirmAction(null)}
            disabled={loading}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={() => {
              if (confirmAction.type === 'overwrite') doSave(confirmAction.slotIndex);
              else if (confirmAction.type === 'load') doLoad(confirmAction.slotIndex);
              else if (confirmAction.type === 'delete') doDelete(confirmAction.slotIndex);
            }}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 ${
              confirmAction.type === 'delete'
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-amber-600 hover:bg-amber-500'
            }`}
          >
            {loading
              ? '处理中…'
              : confirmAction.type === 'delete'
                ? '确认删除'
                : '确认'}
          </button>
        </div>
      </div>
    </div>
  );

  // ===========================================================================
  // 状态消息
  // ===========================================================================

  const statusBar = statusMsg && (
    <div
      className={`mb-4 rounded-lg px-4 py-2 text-sm ${
        statusType === 'success'
          ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700'
          : statusType === 'error'
            ? 'bg-red-900/50 text-red-300 border border-red-700'
            : 'bg-blue-900/50 text-blue-300 border border-blue-700'
      }`}
    >
      {statusMsg}
    </div>
  );

  // ===========================================================================
  // 配额警告
  // ===========================================================================

  const quotaWarning = quota?.isWarning && (
    <div
      className={`mb-4 rounded-lg px-4 py-2 text-sm ${
        quota.isCritical
          ? 'bg-red-900/50 text-red-300 border border-red-700'
          : 'bg-amber-900/50 text-amber-300 border border-amber-700'
      }`}
    >
      {quota.isCritical
        ? `⚠️ 存储空间严重不足 (${quota.usagePercent.toFixed(0)}%)，请清理存档或导出备份。`
        : `⚡ 存储空间使用 ${quota.usagePercent.toFixed(0)}%，建议清理旧存档。`}
      <span className="ml-2 text-zinc-500 text-xs">
        ({formatFileSize(quota.usedBytes)} / ~{formatFileSize(quota.quotaBytes)})
      </span>
    </div>
  );

  // ===========================================================================
  // 主渲染
  // ===========================================================================

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[560px] max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl">
        {/* 标题栏 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-100">存档管理</h2>
            {gameSetting && (
              <p className="text-sm text-zinc-500">
                {gameSetting.worldMeta.name} · {playerName || '未命名'} {playerClass ? `(${playerClass})` : ''}
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
            aria-label="关闭"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 状态消息 */}
        {statusBar}

        {/* 配额警告 */}
        {quotaWarning}

        {/* 槽位列表 */}
        <div className="space-y-3 mb-6">
          {slots.map((slot, index) => (
            <SlotRow
              key={index}
              slotIndex={index}
              slot={slot}
              loading={loading}
              onSave={() => handleSave(index, slot.meta)}
              onLoad={() => slot.meta && handleLoad(index, slot.meta)}
              onDelete={() => slot.meta && handleDelete(index, slot.meta)}
              onExport={() => handleExport(index)}
            />
          ))}
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
          <button
            onClick={handleImportClick}
            disabled={loading}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            📥 导入存档
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={(e) => { void handleImportFile(e); }}
            className="hidden"
          />
          <div className="text-xs text-zinc-600">
            {quota && `存储: ${formatFileSize(quota.usedBytes)} / ~${formatFileSize(quota.quotaBytes)}`}
          </div>
        </div>
      </div>

      {/* 确认对话框 */}
      {confirmDialog}
    </div>
  );
}

// ============================================================
// SlotRow 子组件
// ============================================================

interface SlotRowProps {
  slotIndex: number;
  slot: SlotData;
  loading: boolean;
  onSave: () => void;
  onLoad: () => void;
  onDelete: () => void;
  onExport: () => void;
}

function SlotRow({
  slotIndex,
  slot,
  loading,
  onSave,
  onLoad,
  onDelete,
  onExport,
}: SlotRowProps) {
  const { meta, isEmpty } = slot;

  return (
    <div
      className={`rounded-xl border p-4 transition ${
        isEmpty
          ? 'border-zinc-800 bg-zinc-900/50'
          : 'border-zinc-700 bg-zinc-900'
      }`}
    >
      <div className="flex items-center justify-between">
        {/* 左侧：槽位信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-zinc-100">
              槽位 {slotIndex + 1}
            </span>
            {meta?.isAutoSave && (
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                自动
              </span>
            )}
            {!isEmpty && (
              <span className="text-[10px] text-zinc-600">
                {formatFileSize(meta?.fileSizeBytes ?? 0)}
              </span>
            )}
          </div>

          {isEmpty ? (
            <p className="text-sm text-zinc-600">空槽位</p>
          ) : (
            <div className="space-y-0.5">
              <p className="text-sm text-zinc-300 truncate">
                {meta?.label || '未命名存档'}
              </p>
              <div className="flex flex-wrap gap-x-4 text-xs text-zinc-500">
                {meta?.gameSettingName && (
                  <span>🌍 {meta.gameSettingName}</span>
                )}
                {meta?.playerName && (
                  <span>👤 {meta.playerName}</span>
                )}
                {meta && meta.playTimeMs > 0 && (
                  <span>⏱ {formatPlayTime(meta.playTimeMs)}</span>
                )}
              </div>
              {meta && meta.savedAt > 0 && (
                <p className="text-[10px] text-zinc-600">
                  {formatTimestamp(meta.savedAt)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 右侧：操作按钮 */}
        <div className="ml-4 flex items-center gap-1.5">
          {isEmpty ? (
            <button
              onClick={onSave}
              disabled={loading}
              className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-600 disabled:opacity-50"
            >
              💾 保存
            </button>
          ) : (
            <>
              <button
                onClick={onSave}
                disabled={loading}
                className="rounded-lg border border-zinc-700 px-2 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-800 disabled:opacity-50"
                title="覆盖保存"
              >
                💾
              </button>
              <button
                onClick={onLoad}
                disabled={loading}
                className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50"
              >
                📂 加载
              </button>
              <button
                onClick={onExport}
                disabled={loading}
                className="rounded-lg border border-zinc-700 px-2 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-800 disabled:opacity-50"
                title="导出 JSON"
              >
                📤
              </button>
              <button
                onClick={onDelete}
                disabled={loading}
                className="rounded-lg border border-zinc-700 px-2 py-1.5 text-xs text-red-400 transition hover:bg-red-900/30 disabled:opacity-50"
                title="删除存档"
                onContextMenu={(e) => {
                  e.preventDefault();
                  onDelete();
                }}
              >
                🗑
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
