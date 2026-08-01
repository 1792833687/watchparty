/**
 * GameClient — 游戏客户端整合组件 — Story 5.8
 *
 * @description
 * 整合所有UI组件：
 *   顶栏 (TopBar)
 *   三面板布局 (ThreePanelLayout)
 *     地图面板 (MapPanel)
 *     对话面板 (DialoguePanel)
 *     状态面板 (StatusPanel)
 *   决策面板 (DecisionModal)
 *   通知 (ToastContainer)
 *
 * 移动端TabBar切换逻辑、键盘导航完整Tab序
 *
 * @see design/art-bible.md §5 (布局系统)
 * @see design/ux-spec.md §5-7 (游戏流程)
 * @see design/accessibility-requirements.md (键盘导航)
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { useDialogueStore } from '@/stores/dialogue-store';
import { useMapStore } from '@/stores/map-store';
import { useWorldStore } from '@/stores/world-store';
import { TopBar } from '@/components/layout/TopBar';
import { ThreePanelLayout } from '@/components/layout/ThreePanelLayout';
import { MapPanel } from '@/components/map/MapPanel';
import { DialoguePanel } from '@/components/dialogue/DialoguePanel';
import { DecisionModal } from '@/components/dialogue/DecisionModal';
import { StatusPanel } from '@/components/status/StatusPanel';
import { ToastContainer, createToast } from '@/components/common/Toast';
import type { DecisionNode } from '@/stores/dialogue-store';

// ============================================================
// Mock 数据
// ============================================================

const MOCK_DECISION: DecisionNode = {
  id: 'test-decision-1',
  parentDecisionId: null,
  sessionId: 'test-session',
  timestamp: Date.now(),
  narrativeContext:
    '守卫队长单膝跪地，长剑横在膝上。他的眼神在火光中闪烁——是忠诚，还是恐惧？灰烬从城堡的高墙上飘落，在你们之间旋转。',
  promptText: '你必须做出选择。',
  options: [
    {
      id: 'opt_a',
      text: '接受他的效忠',
      sceneType: 'golden',
      predictedConsequence: '你将获得一位忠诚的同伴，但他的过去可能带来麻烦。',
    },
    {
      id: 'opt_b',
      text: '追问他的动机',
      sceneType: 'magic',
      predictedConsequence: '你可能会发现隐藏的真相——无论好坏。',
    },
    {
      id: 'opt_c',
      text: '拒绝——这可能是陷阱',
      sceneType: 'danger',
      predictedConsequence: '你将独自面对前方的危险，但至少不会腹背受敌。',
    },
    {
      id: 'opt_d',
      text: '让他证明自己',
      sceneType: 'golden',
      predictedConsequence: '给他一个任务来验证他的忠诚。结果取决于他的真实意图。',
    },
  ],
  chosenOptionIndex: -1,
  immediateConsequence: '',
  consequenceEventIds: [],
  sceneType: 'golden',
  tags: ['golden_choice'],
};

// ============================================================
// 组件
// ============================================================

export const GameClient: React.FC = () => {
  const addToast = useUIStore((s) => s.addToast);
  const openModal = useUIStore((s) => s.openModal);
  const activeDecision = useDialogueStore((s) => s.activeDecision);
  const setActiveDecision = useDialogueStore((s) => s.setActiveDecision);
  const playerCoord = useMapStore((s) => s.playerCoord);
  // Extract tiles from Map as array for MapPanel
  const tileEntries = useMapStore((s) => Array.from(s.tiles.entries()));

  // ── 全局键盘快捷键 ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S 存档
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // ── 存档 ──
  const handleSave = useCallback(() => {
    addToast(
      createToast('success', '存档成功', '游戏进度已保存', 3000)
    );
  }, [addToast]);

  // ── 设置 ──
  const handleSettings = useCallback(() => {
    openModal('settings');
  }, [openModal]);

  // ── 日志 ──
  const handleJournal = useCallback(() => {
    addToast(
      createToast('info', '冒险日志', '日志功能将在后续版本开放', 3000)
    );
  }, [addToast]);

  // ── 触发测试决策 ──
  const handleTriggerDecision = useCallback(() => {
    setActiveDecision(MOCK_DECISION);
  }, [setActiveDecision]);

  // ── 关闭决策 ──
  const handleCloseDecision = useCallback(() => {
    setActiveDecision(null);
  }, [setActiveDecision]);

  return (
    <div
      className="game-client"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg-deep)',
      }}
    >
      {/* 跳过导航链接 (可访问性) */}
      <div
        className="skip-links"
        style={{
          position: 'absolute',
          top: -999,
          left: -999,
          zIndex: 9999,
        }}
      >
        <a href="#map-panel" style={skipLinkStyle}>
          跳到地图
        </a>
        <a href="#dialogue-panel" style={skipLinkStyle}>
          跳到对话
        </a>
        <a href="#status-panel" style={skipLinkStyle}>
          跳到状态
        </a>
        <a href="#player-input" style={skipLinkStyle}>
          跳到输入框
        </a>
      </div>

      {/* ── 顶栏 ── */}
      <TopBar onSave={handleSave} onSettings={handleSettings} />

      {/* ── 三面板布局 ── */}
      <ThreePanelLayout
        mapPanel={
          <MapPanel
            tiles={tileEntries.map(([, tile]) => tile) as unknown as Parameters<typeof MapPanel>[0]['tiles']}
            playerCoord={playerCoord}
            onTileClick={(coord) => {
              addToast(
                createToast(
                  'info',
                  '移动到',
                  `(${coord.col}, ${coord.row})`,
                  1500
                )
              );
            }}
          />
        }
        dialoguePanel={
          <DialoguePanel onTriggerDecision={handleTriggerDecision} />
        }
        statusPanel={
          <StatusPanel
            onSave={handleSave}
            onJournal={handleJournal}
            onSettings={handleSettings}
          />
        }
      />

      {/* ── 决策 Modal ── */}
      <DecisionModal
        decision={activeDecision}
        onClose={handleCloseDecision}
      />

      {/* ── Toast 容器 ── */}
      <ToastContainer maxToasts={3} />
    </div>
  );
};

// ============================================================
// 样式
// ============================================================

const skipLinkStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  padding: '8px 16px',
  background: 'var(--accent-gold)',
  color: 'var(--bg-deep)',
  fontWeight: 600,
  fontSize: '0.875rem',
  textDecoration: 'none',
  borderRadius: '0 0 8px 0',
};
