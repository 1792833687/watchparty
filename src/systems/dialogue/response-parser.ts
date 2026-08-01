/**
 * ResponseParser — AI GM 输出结构化解析器
 *
 * @description
 * 解析 LLM 原始输出中的 [NARRATIVE]/[ACTIONS]/[STATE]/[DECISION] 标记块。
 * 支持假选择检测（非阻塞 warning）和 StateDelta 提取。
 *
 * @see design/gdd/dialogue-system.md §2.5, §3.1
 */

import type {
  ContentBlock,
  DecisionOption,
  StateDelta,
  SuggestedAction,
  FakeChoiceWarning,
  NarrativeTag,
  RelationshipChange,
  ItemChange,
  QuestUpdate,
} from './types';
import { generateUUID } from '@/lib/utils/id';

// ============================================================
// 解析结果
// ============================================================

export interface ParseResult {
  /** 解析后的内容块 */
  blocks: ContentBlock[];
  /** 原始文本 */
  raw: string;
  /** 是否检测到决策点 */
  isDecisionPoint: boolean;
  /** 叙事标签 */
  narrativeTags: NarrativeTag[];
  /** 状态变化 */
  stateDelta: StateDelta;
  /** 建议动作 */
  suggestedActions: SuggestedAction[];
  /** 假选择警告（如有） */
  fakeChoiceWarning: FakeChoiceWarning | null;
  /** 解析诊断信息 */
  diagnostics: ParseDiagnostics;
}

export interface ParseDiagnostics {
  /** 是否所有预期块都存在 */
  allBlocksFound: boolean;
  /** 缺失的块类型 */
  missingBlocks: string[];
  /** 解析耗时 (ms) */
  parseTimeMs: number;
  /** 原始块数 */
  rawBlockCount: number;
}

// ============================================================
// ResponseParser
// ============================================================

export class ResponseParser {
  /**
   * 解析 AI GM 原始输出。
   *
   * @param raw - LLM 返回的原始文本
   * @returns ParseResult 结构化解析结果
   */
  parse(raw: string): ParseResult {
    const startTime = performance.now();
    const blocks: ContentBlock[] = [];
    const missingBlocks: string[] = [];

    // 提取四个标记块
    const narrativeText = this.extractBlock(raw, 'NARRATIVE');
    const actionsText = this.extractBlock(raw, 'ACTIONS');
    const stateText = this.extractBlock(raw, 'STATE');
    const decisionText = this.extractBlock(raw, 'DECISION');

    // Narrative（必须存在）
    if (narrativeText) {
      blocks.push({ type: 'narrative', text: narrativeText.trim() });
    } else {
      missingBlocks.push('NARRATIVE');
      // 全文视为 narrative（降级策略 GDD §6.1）
      blocks.push({ type: 'narrative', text: raw.trim() });
    }

    // Actions
    if (actionsText !== null) {
      blocks.push({ type: 'action', text: actionsText.trim() });
    } else {
      missingBlocks.push('ACTIONS');
    }

    // State
    if (stateText !== null) {
      blocks.push({ type: 'state', text: stateText.trim() });
    } else {
      missingBlocks.push('STATE');
    }

    // Decision（可选）
    let isDecisionPoint = false;
    let decisionOptions: DecisionOption[] = [];
    if (decisionText !== null) {
      decisionOptions = this.parseDecisionOptions(decisionText);
      isDecisionPoint = decisionOptions.length > 0;
      blocks.push({
        type: 'decision',
        text: decisionText.trim(),
        options: decisionOptions,
      });
    }

    // 提取 StateDelta
    const stateDelta = this.extractStateDelta(stateText ?? '', narrativeText ?? '');

    // 提取 SuggestedActions
    const suggestedActions = this.parseSuggestedActions(actionsText ?? '');

    // 假选择检测
    const fakeChoiceWarning = isDecisionPoint ? this.detectFakeChoices(decisionOptions) : null;

    // 叙事标签
    const narrativeTags = this.extractNarrativeTags(narrativeText ?? '', stateText ?? '', decisionText ?? '', isDecisionPoint);

    const parseTimeMs = performance.now() - startTime;

    return {
      blocks,
      raw,
      isDecisionPoint,
      narrativeTags,
      stateDelta,
      suggestedActions,
      fakeChoiceWarning,
      diagnostics: {
        allBlocksFound: missingBlocks.length === 0,
        missingBlocks,
        parseTimeMs,
        rawBlockCount: blocks.length,
      },
    };
  }

  // ============================================================
  // 块提取
  // ============================================================

  /**
   * 从原始文本中提取指定标记块的内容。
   * 支持 [TAG]\n...\n[/TAG] 和 [TAG]\n...\n\n（到下一个块或文本结束）两种格式。
   */
  extractBlock(raw: string, tag: string): string | null {
    // 修复 PCRE 无 s 标志问题 — 使用 [\s\S] 匹配任意字符包括换行
    const patterns = [
      // 格式1: [TAG]...[/TAG]（显式结束标记）
      new RegExp(`\\[${tag}\\][\\s\\S]*?\\[\\/${tag}\\]`, 'i'),
      // 格式2: [TAG]\n...（到下一个 [ 标记或文本结束）
      new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\n\\s*\\[|$)`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = raw.match(pattern);
      if (match) {
        let content = match[0];
        // 去掉开头的 [TAG]
        content = content.replace(new RegExp(`^\\[${tag}\\]\\s*`, 'i'), '');
        // 去掉结尾的 [/TAG]（如果有）
        content = content.replace(new RegExp(`\\[\\/${tag}\\]\\s*$`, 'i'), '');
        return content.trim() || null;
      }
    }

    return null;
  }

  // ============================================================
  // 决策选项解析
  // ============================================================

  /**
   * 解析 [DECISION] 块中的选项。
   *
   * 期望格式:
   * ```
   * Scene Type: golden
   * Option A: 接受他的效忠
   * Option B: 追问他的动机
   * Option C: 拒绝——这可能是陷阱
   * ```
   */
  parseDecisionOptions(decisionText: string): DecisionOption[] {
    const options: DecisionOption[] = [];

    // 提取 Scene Type
    const sceneTypeMatch = decisionText.match(/scene\s*type\s*:\s*(golden|danger|magic)/i);
    const sceneType = (sceneTypeMatch?.[1]?.toLowerCase() || 'golden') as 'golden' | 'danger' | 'magic';

    // 提取选项（Option A/B/C 或 选项 A/B/C）
    const optionPattern = /(?:Option|选项)\s*([A-Ca-c])\s*[:：]\s*(.+?)(?=\n\s*(?:Option|选项)\s*[A-Ca-c]\s*[:：]|$)/gis;

    let match: RegExpExecArray | null;
    while ((match = optionPattern.exec(decisionText)) !== null) {
      const label = match[1]?.toUpperCase();
      const description = match[2]?.trim();

      if (label && description) {
        options.push({
          id: generateUUID(),
          text: description,
          sceneType,
          predictedConsequence: '',
        });
      }
    }

    // 如果正则没匹配到，尝试按行解析
    if (options.length === 0) {
      const lines = decisionText.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        // 匹配 "A: xxx" 或 "A) xxx" 格式
        const lineMatch = trimmed.match(/^([A-Ca-c])\s*[:)）]\s*(.+)/);
        if (lineMatch) {
          options.push({
            id: generateUUID(),
            text: lineMatch[2]!.trim(),
            sceneType,
            predictedConsequence: '',
          });
        }
      }
    }

    return options;
  }

  // ============================================================
  // 建议动作解析
  // ============================================================

  /**
   * 从 [ACTIONS] 块解析建议动作列表。
   *
   * 期望格式:
   * ```
   * - Look around the room
   * - Talk to the guard
   * - Leave through the door
   * ```
   */
  parseSuggestedActions(actionsText: string): SuggestedAction[] {
    const actions: SuggestedAction[] = [];
    if (!actionsText) return actions;

    const lines = actionsText.split('\n');
    for (const line of lines) {
      // 匹配 "- xxx" 或 "* xxx" 或 "• xxx" 列表项
      const match = line.trim().match(/^[-*•]\s*(.+)/);
      if (match && match[1]) {
        const text = match[1].trim();
        if (text.length > 0) {
          actions.push({
            id: generateUUID(),
            text,
            type: this.classifyActionType(text),
            icon: this.actionIcon(this.classifyActionType(text)),
            priority: actions.length < 3 ? 1 : 2,
          });
        }
      }
    }

    // 如果没解析到列表，每行作为一个动作
    if (actions.length === 0 && actionsText.trim()) {
      const text = actionsText.trim();
      if (text.length > 0 && text.length < 200) {
        actions.push({
          id: generateUUID(),
          text,
          type: 'conversation',
          icon: '💬',
          priority: 2,
        });
      }
    }

    return actions;
  }

  /**
   * 根据文本内容推断动作类型。
   */
  classifyActionType(text: string): SuggestedAction['type'] {
    const lower = text.toLowerCase();
    if (/移动|走|前往|去|离开|进入|返回|move|go|leave|enter|travel|head/i.test(lower)) return 'movement';
    if (/查看|检查|搜索|观察|探索|look|examine|search|inspect|explore|investigate/i.test(lower)) return 'examination';
    if (/战斗|攻击|拔出|武器|战斗|fight|attack|draw.*weapon|combat/i.test(lower)) return 'combat';
    if (/休息|坐下|等待|睡觉|rest|sit|wait|sleep/i.test(lower)) return 'rest';
    if (/使用|装备|喝|吃|use|equip|drink|eat|consume/i.test(lower)) return 'item_use';
    return 'conversation';
  }

  actionIcon(type: SuggestedAction['type']): string {
    switch (type) {
      case 'movement': return '🚶';
      case 'examination': return '🔍';
      case 'combat': return '⚔️';
      case 'rest': return '🔥';
      case 'item_use': return '🎒';
      case 'conversation': return '💬';
    }
  }

  // ============================================================
  // StateDelta 提取
  // ============================================================

  /**
   * 从 [STATE] 块和 Narrative 块中提取状态变化。
   *
   * 使用模式匹配提取 HP 变化、关系变化、物品变化、位置变化、任务更新。
   */
  extractStateDelta(stateText: string, narrativeText: string): StateDelta {
    const combined = `${narrativeText}\n${stateText}`;

    const delta: StateDelta = {
      relationshipChanges: [],
      itemChanges: [],
      questUpdates: [],
      narrativeTags: [],
    };

    // HP 变化
    const hpMatch = combined.match(/HP\s*[-:：]\s*([+-]?\d+)/i);
    if (hpMatch) {
      delta.hpChange = parseInt(hpMatch[1]!, 10);
    }

    // MP 变化
    const mpMatch = combined.match(/MP\s*[-:：]\s*([+-]?\d+)/i);
    if (mpMatch) {
      delta.mpChange = parseInt(mpMatch[1]!, 10);
    }

    // 关系变化（模式匹配）
    const relationPattern = /([^\s,，。.]+?)\s*(?:关系|好感|信任|声望|友好度|relation)\s*(?:[+＋\-﹣]|增加|减少|提升|降低|改善|恶化)\s*(\d+)?/gi;
    let relMatch: RegExpExecArray | null;
    while ((relMatch = relationPattern.exec(combined)) !== null) {
      const entityName = relMatch[1]?.trim();
      if (entityName && entityName.length < 30) {
        delta.relationshipChanges.push({
          entityId: '',
          entityName,
          delta: 0,
          reason: relMatch[0],
        });
      }
    }

    // 物品变化
    const acquirePattern = /(?:获得|得到|拾取|捡起|拿到|acquire[d]?|obtain(?:ed)?|pick(?:ed)?\s*up)\s*(.+?)(?:[，,。.\n]|$)/gi;
    const losePattern = /(?:失去|丢失|消耗|丢弃|使用\s*(?:了)?|lose|lost|consumed?|used?)\s*(.+?)(?:[，,。.\n]|$)/gi;

    let itemMatch: RegExpExecArray | null;
    while ((itemMatch = acquirePattern.exec(combined)) !== null) {
      const itemName = itemMatch[1]?.trim();
      if (itemName && itemName.length < 50) {
        delta.itemChanges.push({ itemName, action: 'acquire' });
      }
    }
    while ((itemMatch = losePattern.exec(combined)) !== null) {
      const itemName = itemMatch[1]?.trim();
      if (itemName && itemName.length < 50) {
        delta.itemChanges.push({ itemName, action: 'lose' });
      }
    }

    // 位置变化
    const locationMatch = combined.match(/(?:来到|到达|进入|前往|arrive[d]?\s*(?:at|in)|enter(?:ed)?|move[d]?\s*to)\s*(.+?)(?:[，,。.\n]|$)/i);
    if (locationMatch) {
      delta.locationChange = locationMatch[1]?.trim().slice(0, 100);
    }

    return delta;
  }

  // ============================================================
  // 假选择检测
  // ============================================================

  /**
   * 检测假选择。
   *
   * 逻辑（GDD §2.5）:
   * - 如果多个选项的选项描述指向完全相同的语义结果 → 假选择
   * - 当前实现：检查选项描述是否有足够的文本差异性
   * - 非阻塞：仅生成 warning，不中断体验
   */
  detectFakeChoices(options: DecisionOption[]): FakeChoiceWarning | null {
    if (options.length < 2) return null;

    // 简化的文本差异检测
    const texts = options.map((o) => o.text.toLowerCase().trim());

    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i]!;
        const b = texts[j]!;

        // 完全相同或高度相似（编辑距离占比 < 20%）
        const similarity = this.textSimilarity(a, b);
        if (similarity > 0.85) {
          return {
            decisionNodeId: '',
            options: options.map((o) => o.text),
            reason: `选项 ${i + 1} 和 ${j + 1} 高度相似（相似度 ${(similarity * 100).toFixed(0)}%），可能是假选择`,
            stateDeltaComparison: `"${a}" ≈ "${b}"`,
            severity: similarity > 0.95 ? 'error' : 'warning',
          };
        }
      }
    }

    return null;
  }

  /**
   * 简单的文本相似度计算（Jaccard-like 字符级）。
   */
  private textSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    if (!a || !b) return 0.0;

    const aChars = new Set(a.split(''));
    const bChars = new Set(b.split(''));

    let intersection = 0;
    for (const ch of aChars) {
      if (bChars.has(ch)) intersection++;
    }

    const union = aChars.size + bChars.size - intersection;
    if (union === 0) return 0;

    return intersection / union;
  }

  // ============================================================
  // 叙事标签提取
  // ============================================================

  extractNarrativeTags(
    narrative: string,
    state: string,
    decision: string,
    isDecisionPoint: boolean
  ): NarrativeTag[] {
    const tags: NarrativeTag[] = [];
    const combined = `${narrative} ${state} ${decision}`;
    const lower = combined.toLowerCase();

    if (isDecisionPoint) {
      tags.push('golden_choice');

      // 根据决策场景类型细分
      if (lower.includes('danger') || lower.includes('危险') || lower.includes('威胁')) {
        tags.push('danger_zone');
      }
      if (lower.includes('magic') || lower.includes('魔法') || lower.includes('神秘')) {
        tags.push('magic_moment');
      }
    }

    if (lower.includes('悬念') || lower.includes('谜') || lower.includes('秘密') || lower.includes('hook') || lower.includes('cliffhanger')) {
      tags.push('hook_set');
    }

    if (lower.includes('解决') || lower.includes('揭开') || lower.includes('reveal') || lower.includes('resolve')) {
      tags.push('hook_resolved');
    }

    if (lower.includes('章节') || lower.includes('chapter') || lower.includes('结束')) {
      tags.push('chapter_end');
    }

    // 从 memory EventTag 映射
    if (lower.includes('黄金') || lower.includes('golden')) tags.push('golden');
    if (lower.includes('背叛') || lower.includes('betray')) tags.push('betrayal');

    return [...new Set(tags)];
  }
}
