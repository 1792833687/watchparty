/**
 * SaveLoadPanel — AI Narrator Game
 *
 * 存档/读档面板。提供：
 * - 3 个存档槽位的手动保存/加载/删除
 * - 存档元数据展示（时间、游戏进度、角色名等）
 * - 基于 localStorage 的持久化（兼容现有存档系统）
 *
 * 存档 Key: ai-narrator-save-slot-{0|1|2}
 * 元数据 Key: ai-narrator-slot-meta-{0|1|2}
 *
 * @module components/game/SaveLoadPanel
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';

// ============================================================
// Types
// ============================================================

export interface SaveSlotMeta {
  slotIndex: number;
  label: string;
  savedAt: string;
  worldName: string;
  playerName: string;
  playTime: string;
  messageCount: number;
  isEmpty: boolean;
}

export interface SaveLoadPanelProps {
  /** 获取当前存档数据的回调 */
  onSave: (slotIndex: number) => SaveSlotMeta;
  /** 加载存档的回调 */
  onLoad: (slotIndex: number) => void;
  /** 删除存档的回调 */
  onDelete: (slotIndex: number) => void;
  /** 面板关闭回调 */
  onClose: () => void;
}

const MAX_SLOTS = 3;

// ============================================================
// Styles
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const S: Record<string, any> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    zIndex: 1100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    background: '#1A1714',
    border: '1px solid #2A2520',
    borderRadius: '12px',
    padding: '1.5rem',
    minWidth: '380px',
    maxWidth: '90vw',
    maxHeight: '85vh',
    overflow: 'auto',
    color: '#E8E0D5',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#C9A94E',
    marginBottom: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  slotCard: (isEmpty: boolean): React.CSSProperties => ({
    background: '#0D0D12',
    border: '1px solid #2A2520',
    borderRadius: '10px',
    padding: '1rem',
    marginBottom: '0.75rem',
    opacity: isEmpty ? 0.5 : 1,
  }),
  slotHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  slotIndex: {
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: '#C9A94E',
  },
  slotTime: {
    fontSize: '0.75rem',
    color: '#6B6358',
  },
  slotInfo: {
    fontSize: '0.8125rem',
    color: '#9B9188',
    marginBottom: '0.375rem',
  },
  slotEmpty: {
    fontSize: '0.875rem',
    color: '#6B6358',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '1rem 0',
  },
  slotActions: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.625rem',
  },
  btnPrimary: {
    flex: 1,
    padding: '0.5rem 0.75rem',
    background: '#C9A94E',
    color: '#0D0D12',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnSecondary: {
    flex: 1,
    padding: '0.5rem 0.75rem',
    background: '#2A2520',
    color: '#C0B8A8',
    border: '1px solid #3A3530',
    borderRadius: '6px',
    fontSize: '0.8125rem',
    cursor: 'pointer',
  },
  btnDanger: {
    flex: 1,
    padding: '0.5rem 0.75rem',
    background: 'transparent',
    color: '#B5583A',
    border: '1px solid #B5583A',
    borderRadius: '6px',
    fontSize: '0.8125rem',
    cursor: 'pointer',
  },
  closeBtn: {
    marginTop: '1rem',
    width: '100%',
    padding: '0.625rem',
    background: '#2A2520',
    border: '1px solid #3A3530',
    borderRadius: '8px',
    color: '#C0B8A8',
    fontSize: '0.9375rem',
    cursor: 'pointer',
  },
  confirmOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 1200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBox: {
    background: '#1A1714',
    border: '1px solid #B5583A',
    borderRadius: '10px',
    padding: '1.5rem',
    textAlign: 'center',
    minWidth: '280px',
  },
  confirmMsg: {
    fontSize: '0.9375rem',
    marginBottom: '1rem',
    color: '#E8E0D5',
  },
  confirmActions: {
    display: 'flex',
    gap: '0.75rem',
  },
};

// ============================================================
// Helpers
// ============================================================

function getSlotMeta(slotIndex: number): SaveSlotMeta {
  try {
    const raw = localStorage.getItem(`ai-narrator-slot-meta-${slotIndex}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch { /* ignore */ }
  return {
    slotIndex,
    label: `存档 ${slotIndex + 1}`,
    savedAt: '',
    worldName: '',
    playerName: '',
    playTime: '0m',
    messageCount: 0,
    isEmpty: true,
  };
}

// ============================================================
// Component
// ============================================================

export function SaveLoadPanel({
  onSave,
  onLoad,
  onDelete,
  onClose,
}: SaveLoadPanelProps): React.ReactElement {
  const [slots, setSlots] = useState<SaveSlotMeta[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  // 加载槽位信息
  useEffect(() => {
    setSlots(Array.from({ length: MAX_SLOTS }, (_, i) => getSlotMeta(i)));
  }, []);

  const handleSave = useCallback(
    (slotIndex: number) => {
      const meta = onSave(slotIndex);
      setSlots((prev) => {
        const next = [...prev];
        next[slotIndex] = meta;
        return next;
      });
    },
    [onSave]
  );

  const handleLoad = useCallback(
    (slotIndex: number) => {
      if (slots[slotIndex]?.isEmpty) return;
      onLoad(slotIndex);
    },
    [slots, onLoad]
  );

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget === null) return;
    onDelete(deleteTarget);
    setSlots((prev) => {
      const next = [...prev];
      next[deleteTarget] = {
        slotIndex: deleteTarget,
        label: `存档 ${deleteTarget + 1}`,
        savedAt: '',
        worldName: '',
        playerName: '',
        playTime: '0m',
        messageCount: 0,
        isEmpty: true,
      };
      return next;
    });
    setDeleteTarget(null);
  }, [deleteTarget, onDelete]);

  return (
    <>
      <div style={S.overlay} onClick={onClose}>
        <div style={S.panel} onClick={(e) => e.stopPropagation()}>
          <div style={S.title}>
            &#128190; 存档管理
          </div>

          {slots.map((slot, idx) => (
            <div key={idx} style={S.slotCard(slot.isEmpty)}>
              <div style={S.slotHeader}>
                <span style={S.slotIndex}>存档 {idx + 1}</span>
                {!slot.isEmpty && (
                  <span style={S.slotTime}>{slot.savedAt}</span>
                )}
              </div>

              {slot.isEmpty ? (
                <div style={S.slotEmpty}>空槽位</div>
              ) : (
                <>
                  <div style={S.slotInfo}>世界: {slot.worldName || '未知'}</div>
                  <div style={S.slotInfo}>角色: {slot.playerName || '未知'}</div>
                  <div style={S.slotInfo}>
                    进度: {slot.messageCount} 条消息 | 时长: {slot.playTime}
                  </div>
                </>
              )}

              <div style={S.slotActions}>
                <button style={S.btnPrimary} onClick={() => handleSave(idx)}>
                  &#128427; 保存
                </button>
                <button
                  style={S.btnSecondary}
                  onClick={() => handleLoad(idx)}
                  disabled={slot.isEmpty}
                >
                  &#128214; 加载
                </button>
                <button
                  style={S.btnDanger}
                  onClick={() => setDeleteTarget(idx)}
                  disabled={slot.isEmpty}
                >
                  &#128465; 删除
                </button>
              </div>
            </div>
          ))}

          <button style={S.closeBtn} onClick={onClose}>关闭</button>
        </div>
      </div>

      {/* 删除确认 */}
      {deleteTarget !== null && (
        <div style={S.confirmOverlay} onClick={() => setDeleteTarget(null)}>
          <div style={S.confirmBox} onClick={(e) => e.stopPropagation()}>
            <div style={S.confirmMsg}>
              确定要删除存档 {deleteTarget + 1} 吗？此操作不可撤销。
            </div>
            <div style={S.confirmActions}>
              <button style={S.btnDanger} onClick={handleDeleteConfirm}>
                确认删除
              </button>
              <button style={S.btnSecondary} onClick={() => setDeleteTarget(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
