/**
 * v4.1.0 叙事渲染器 — AI 输出中旁白与对话的可视化区分
 *
 * 解析 AI 文本：
 * - 「」/「」与 ""/'' 引号内的内容 → 对话块（金色描边 + 斜体 + 说话人标签）
 * - 其余文本 → 旁白（默认样式）
 * - 括号内动作描述保持旁白样式（以 *斜体* 呈现，弱化显示）
 *
 * 说话人识别：引号前出现「xxx说/喊道/低语/问道/答道/怒吼/回应」等动词时提取为说话人。
 * @module components/game/NarrativeRenderer
 */
'use client';

import React, { useMemo } from 'react';
// v5.1.0 技术美术：渲染层色板统一走 tokens（parseNarrativeSegments 红线不动）
import { C } from '@/theme/tokens';

export interface NarrativeSegment {
  type: 'narration' | 'dialogue' | 'action';
  text: string;
  speaker?: string;
}

/** 识别「某某说」前缀中的说话人（引号前 12 字内找说话动词） */
const SPEAKER_VERBS = /(说|说道|喊道|低语|轻声说|问道|答道|怒吼|咆哮|回应|喃喃|笑道|冷笑|叹道|喝道|宣称|承诺|警告|恳求|劝道|提醒)/;

export function parseNarrativeSegments(text: string): NarrativeSegment[] {
  if (!text) return [];
  const segments: NarrativeSegment[] = [];
  // v5.0.0 (需求2): 匹配「」『』与 "" '' 引号（含中文弯引号）
  const re = /「([^」]+)」|『([^』]+)』|"([^"]+)"|“([^”]+)”|'([^']+)'|‘([^’]+)’/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const quoted = match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5] ?? match[6] ?? '';
    const start = match.index;
    const end = start + match[0].length;

    // 引号前的旁白（含可能的说话人前缀）
    const before = text.slice(lastIndex, start);
    if (before.trim()) {
      // 检查 before 是否以说话人前缀结尾（如「塔林说：」或「塔林说」）
      const speakerMatch = SPEAKER_VERBS.exec(before.slice(-14));
      if (speakerMatch) {
        // verbIdx 是相对 before 的索引（slice(-14) 最多截断 14 字符）
        const sliceOffset = Math.max(0, before.length - 14);
        const verbRelIdx = sliceOffset + speakerMatch.index;
        const speakerPart = before.slice(0, verbRelIdx + speakerMatch[0].length);
        const narrationPart = before.slice(verbRelIdx + speakerMatch[0].length);
        // v5.0.0 (需求2 修复): 说话人提取 — 说话人 = 最后一个句子分隔符后的片段（≤8字），
        // 分隔符之前的前置旁白归位（此前「你推开门。罗兰说：」会把『你推开门。』吞进说话人）
        const speakerClean = speakerPart
          .replace(SPEAKER_VERBS, '')
          .replace(/[：:，,。;；\s]+$/, '')
          .trim();
        const sepSplit = speakerClean.match(/^(.*[。！？!?；;])([^。！？!?；;]*)$/);
        const preNarration = sepSplit?.[1] ?? '';
        const speakerText = sepSplit?.[2] ?? speakerClean;
        const speaker = speakerText && speakerText.length <= 8 ? speakerText : null;
        if (speaker) {
          if (preNarration) segments.push({ type: 'narration', text: preNarration });
          // 说话人后仅剩标点（：，等）时不再作为独立旁白输出
          if (narrationPart.trim() && !/^[：:，,。;；\s]+$/.test(narrationPart)) {
            segments.push({ type: 'narration', text: narrationPart.trim() });
          }
          segments.push({ type: 'dialogue', text: quoted, speaker });
        } else {
          segments.push({ type: 'narration', text: before });
          segments.push({ type: 'dialogue', text: quoted });
        }
      } else {
        segments.push({ type: 'narration', text: before });
        segments.push({ type: 'dialogue', text: quoted });
      }
    } else {
      segments.push({ type: 'dialogue', text: quoted });
    }
    lastIndex = end;
  }

  // 尾部旁白
  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex);
    if (tail.trim()) segments.push({ type: 'narration', text: tail });
  }

  return segments;
}

export interface NarrativeRendererProps {
  content: string;
  /** 是否显示「旁白」段落标签（可关闭以减噪） */
  showNarrationLabel?: boolean;
}

export function NarrativeRenderer({ content, showNarrationLabel = false }: NarrativeRendererProps): React.ReactElement {
  const segments = useMemo(() => parseNarrativeSegments(content), [content]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      {segments.map((seg, i) => {
        if (seg.type === 'dialogue') {
          return (
            <div
              key={i}
              style={{
                // v5.0.0 (需求2): 强化对话视觉 — 金色描边块 + 米金色正文，与旁白明显区分
                borderLeft: `3px solid ${C.gold}`,
                background: C.bgHover,
                padding: '0.375rem 0.75rem',
                borderRadius: 6,
                fontSize: '0.9375rem',
                fontStyle: 'italic',
                // v5.1.0 技术美术：叙事正文用本地打包 Crimson Text（拉丁）衬线
                fontFamily: "'Crimson Text','Noto Serif SC',serif",
                color: C.goldLight,
                lineHeight: 1.6,
                margin: '0.25rem 0',
              }}
            >
              {seg.speaker && (
                <span style={{
                  fontSize: '0.6875rem', fontWeight: 700, color: C.gold,
                  marginRight: '0.375rem', fontStyle: 'normal',
                }}>
                  💬 {seg.speaker}：
                </span>
              )}
              「{seg.text}」
            </div>
          );
        }
        if (seg.type === 'action') {
          return (
            <span key={i} style={{ fontSize: '0.8125rem', color: C.magic, fontStyle: 'italic', lineHeight: 1.6 }}>
              {seg.text}
            </span>
          );
        }
        // narration
        return (
          <span key={i} style={{
            fontSize: '0.9375rem', lineHeight: 1.7, color: C.text,
            fontFamily: "'Crimson Text','Noto Serif SC',serif",
          }}>
            {seg.text}
          </span>
        );
      })}
    </div>
  );
}

export default NarrativeRenderer;
