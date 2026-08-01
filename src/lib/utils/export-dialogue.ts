/**
 * export-dialogue.ts — AI Narrator Game
 *
 * 对话历史导出工具。将当前会话消息导出为：
 * - Markdown 文件（推荐，保留格式）
 * - 纯文本 TXT 文件
 *
 * 通过 Blob URL 触发浏览器下载。
 *
 * @module lib/utils/export-dialogue
 */

import { APP_VERSION } from '@/lib/constants';

// ============================================================
// Types
// ============================================================

export interface ExportableMessage {
  role: 'player' | 'narrator' | 'system';
  speakerName?: string;
  content: string;
  timestamp?: number;
}

export interface ExportOptions {
  /** 游戏名称 */
  worldName?: string;
  /** 角色名称 */
  playerName?: string;
  /** 格式 */
  format: 'markdown' | 'txt';
  /** 文件名字段（不含扩展名） */
  filename?: string;
}

// ============================================================
// 格式化工具
// ============================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatTimestamp(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function speakerLabel(msg: ExportableMessage): string {
  if (msg.role === 'player') return msg.speakerName || '玩家';
  if (msg.role === 'narrator') return msg.speakerName || 'AI 旁白';
  return '系统';
}

// ============================================================
// Markdown 生成
// ============================================================

function generateMarkdown(messages: ExportableMessage[], opts: ExportOptions): string {
  const lines: string[] = [];

  // 标题
  lines.push(`# ${opts.worldName || 'AI Narrator Game'} — 对话记录`);
  lines.push('');
  lines.push(`**角色**: ${opts.playerName || '冒险者'}`);
  lines.push(`**导出时间**: ${formatTimestamp(Date.now())}`);
  lines.push(`**消息总数**: ${messages.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // 消息列表
  for (const msg of messages) {
    const time = formatTimestamp(msg.timestamp);
    const label = speakerLabel(msg);
    const timeStr = time ? ` *(${time})*` : '';

    if (msg.role === 'system') {
      lines.push(`> *[系统 ${timeStr}]* ${msg.content}`);
    } else {
      lines.push(`### ${label}${timeStr}`);
      lines.push('');
      lines.push(msg.content);
    }
    lines.push('');
  }

  // 页脚
  lines.push('---');
  lines.push(`*由 凛冬要塞 Frosthold v${APP_VERSION} 导出*`);
  lines.push('');

  return lines.join('\n');
}

// ============================================================
// 纯文本生成
// ============================================================

function generateTxt(messages: ExportableMessage[], opts: ExportOptions): string {
  const lines: string[] = [];

  lines.push(`========================================`);
  lines.push(` ${opts.worldName || 'AI Narrator Game'} — 对话记录`);
  lines.push(`========================================`);
  lines.push(`角色: ${opts.playerName || '冒险者'}`);
  lines.push(`导出时间: ${formatTimestamp(Date.now())}`);
  lines.push(`消息总数: ${messages.length}`);
  lines.push(`========================================`);
  lines.push('');

  for (const msg of messages) {
    const time = formatTimestamp(msg.timestamp);
    const label = speakerLabel(msg);
    const timeStr = time ? ` [${time}]` : '';

    lines.push(`[${label}${timeStr}]`);
    lines.push(msg.content);
    lines.push('');
  }

  lines.push(`--- 由 凛冬要塞 Frosthold v${APP_VERSION} 导出 ---`);

  return lines.join('\n');
}

// ============================================================
// 导出函数
// ============================================================

/**
 * 导出对话历史为文件并触发浏览器下载。
 *
 * @param messages - 对话消息列表
 * @param opts - 导出选项
 */
export function exportDialogueHistory(
  messages: ExportableMessage[],
  opts: ExportOptions
): void {
  if (messages.length === 0) {
    console.warn('[ExportDialogue] 没有可导出的消息');
    return;
  }

  const format = opts.format || 'markdown';
  const content =
    format === 'markdown'
      ? generateMarkdown(messages, opts)
      : generateTxt(messages, opts);

  const ext = format === 'markdown' ? '.md' : '.txt';
  const mimeType = format === 'markdown' ? 'text/markdown' : 'text/plain';
  const defaultFilename =
    opts.filename ||
    `${(opts.worldName || 'dialogue').replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}`;

  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${defaultFilename}${ext}`;
  document.body.appendChild(link);
  link.click();

  // 清理
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}
