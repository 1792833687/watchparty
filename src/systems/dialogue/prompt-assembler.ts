/**
 * PromptAssembler — 四层上下文组装器
 *
 * @description
 * 按 ADR-003 策略 B（预组装 + 增量更新）实现。
 * System/World/Memory 三层缓存 + 版本号失效机制。
 * Memory block 通过 precomputeMemoryBlock() 异步预计算。
 * Session + Input 每次调用重新构建。
 *
 * Token 预算（基于 8K 窗口）:
 *   System:  ~500 tokens
 *   World:   ~300 tokens
 *   Memory:  ~800 tokens
 *   Session: ~1500 tokens
 *
 * @see docs/architecture/adr/003-prompt-context-assembly.md
 * @see design/gdd/dialogue-system.md §2.3, §2.4
 */

import { estimateTokens } from '@/lib/utils/tokenizer';
import {
  SYSTEM_PROMPT_TOKENS,
  WORLD_CONTEXT_TOKENS,
  MEMORY_CONTEXT_TOKENS,
  SESSION_CONTEXT_TOKENS,
} from '@/lib/constants';
import type { DialogueMessage, OpenRouterMessage, AssemblyContext, GameSettingContext, MapContext, TimeContext, MemoryRetrievalRequest, LLMConfig } from './types';
import type { MemoryRetrievalResponse } from '@/systems/memory/types';

// ============================================================
// System Prompt 模板
// ============================================================

const SYSTEM_PROMPT_TEMPLATE = `## ROLE
You are {DM_NAME}, a Game Master guiding a single-player text adventure. Your player is a {PLAYER_CLASS}, currently in {REGION_NAME}.

## RULES (DO NOT VIOLATE)
1. Always maintain your GM identity — you are the world's manager, not the player's servant.
2. Players cannot do things the world rules don't allow. If a player tries, give an in-world explanation and refuse.
3. Actively drive the plot — don't let the narrative stagnate. If the player hesitates, provide guidance.
4. Every choice must have consequences. Never provide "fake choices" where all options lead to the same outcome.
5. Use vivid, literary language, but keep responses within 200 words (unless it's a key narrative scene).

## WORLD RULES
{WORLD_RULES}

## OUTPUT FORMAT
Every response must follow this format:

[NARRATIVE]
<Descriptive text — describe the environment, NPC reactions, event developments>

[ACTIONS]
- <Suggested action 1>
- <Suggested action 2>
- <Suggested action 3>

[STATE]
<State changes — HP, relationships, items, etc.>

// Only use at key narrative moments:
[DECISION]
Scene Type: <golden|danger|magic>
Option A: <Option description>
Option B: <Option description>
Option C: <Option description>

## RHYTHM
- Current session duration: {SESSION_DURATION}
- Soft limit: 90 minutes — when approaching, find natural chapter endings
- Time since last key event: {TIME_SINCE_LAST_EVENT}
- If > 30 minutes without a key event, actively advance the main storyline or introduce a sudden incident

## IMPORTANT
- The player's input and your responses should be in Chinese (中文).
- Use the output format tags ([NARRATIVE], [ACTIONS], [STATE], [DECISION]) exactly as shown.
- The [DECISION] block is OPTIONAL — only use it at true narrative crossroads.
- Every [DECISION] option must lead to meaningfully different outcomes.`;

// ============================================================
// PromptAssembler
// ============================================================

export class PromptAssembler {
  // 缓存块
  private systemBlock: string = '';
  private worldBlock: string = '';
  private memoryBlock: string = '';

  // 版本标记
  private systemVersion: number = -1;
  private worldVersion: number = -1;
  private memoryVersion: number = -1;

  // 外部回调：用于获取记忆上下文
  private memoryRetriever: ((req: MemoryRetrievalRequest) => Promise<MemoryRetrievalResponse>) | null = null;

  /**
   * 注册记忆检索回调。
   * 避免 PromptAssembler 直接依赖 MemoryEngine。
   */
  setMemoryRetriever(fn: (req: MemoryRetrievalRequest) => Promise<MemoryRetrievalResponse>): void {
    this.memoryRetriever = fn;
  }

  // ============================================================
  // 主组装方法
  // ============================================================

  /**
   * 组装完整的 Prompt 消息数组。
   *
   * 仅重新计算版本号发生变化的层。
   */
  async assemble(
    sessionMessages: DialogueMessage[],
    playerInput: string,
    context: AssemblyContext
  ): Promise<OpenRouterMessage[]> {
    // Layer 0: System — 仅在游戏设定/模型切换时重建
    if (context.systemVersion !== this.systemVersion) {
      this.systemBlock = this.buildSystemPrompt(context.gameSetting, context.modelConfig);
      this.systemVersion = context.systemVersion;
    }

    // Layer 1: World — 仅在玩家移动/区域切换/时间推进时重建
    if (context.worldVersion !== this.worldVersion) {
      this.worldBlock = this.buildWorldContext(context.mapContext, context.timeContext);
      this.worldVersion = context.worldVersion;
    }

    // Layer 2: Memory — 使用最新版本，如缓存过期则同步检索
    if (context.memoryVersion !== this.memoryVersion) {
      if (this.memoryRetriever) {
        const memResult = await this.memoryRetriever(context.memoryRequest);
        this.memoryBlock = memResult.contextBlock;
      } else {
        this.memoryBlock = this.buildEmptyMemoryBlock();
      }
      this.memoryVersion = context.memoryVersion;
    }

    // Layer 3: Session — 每次调用必须重建（滑动窗口）
    const sessionBlock = this.buildSessionContext(sessionMessages, context.maxSessionTokens);

    // Layer 4: Input — 直接使用
    const inputBlock = this.buildInputBlock(playerInput, context.currentPageState);

    // 组装为 OpenRouter 消息格式（多条 system + 单条 user）
    const messages: OpenRouterMessage[] = [];

    // System prompt（主角色 + 规则）
    messages.push({ role: 'system', content: this.systemBlock });

    // World context（如非空）
    if (this.worldBlock) {
      messages.push({ role: 'system', content: this.worldBlock });
    }

    // Memory context（如非空）
    if (this.memoryBlock) {
      messages.push({ role: 'system', content: this.memoryBlock });
    }

    // Session + Input 合并到 user 消息
    const userContent = sessionBlock ? `${sessionBlock}\n\n---\n\n${inputBlock}` : inputBlock;
    messages.push({ role: 'user', content: userContent });

    return messages;
  }

  // ============================================================
  // 层构建方法
  // ============================================================

  /**
   * Layer 0: System Prompt (~500 tokens)
   *
   * GM 身份 + 行为规则 + 世界规则 + 输出格式规范 + 节奏控制
   */
  buildSystemPrompt(gameSetting: GameSettingContext, _modelConfig: LLMConfig): string {
    let prompt = SYSTEM_PROMPT_TEMPLATE
      .replace('{DM_NAME}', gameSetting.dmName || 'Game Master')
      .replace('{PLAYER_CLASS}', gameSetting.playerClassName || 'Adventurer')
      .replace('{REGION_NAME}', gameSetting.worldName || 'an unknown realm')
      .replace('{WORLD_RULES}', gameSetting.worldRules || 'Standard fantasy world rules apply.')
      // FIX: BUG-4 — 使用实际传入的会话时长和关键事件间隔，而非硬编码占位值
      .replace('{SESSION_DURATION}', `${gameSetting.sessionDurationMinutes || 0} minutes`)
      .replace('{TIME_SINCE_LAST_EVENT}', gameSetting.timeSinceLastKeyEventMinutes != null
        ? `${gameSetting.timeSinceLastKeyEventMinutes} minutes`
        : 'N/A');

    // Token 预算控制：如果超过预算，截断世界规则部分
    const tokens = estimateTokens(prompt);
    if (tokens > SYSTEM_PROMPT_TOKENS) {
      // 压缩世界规则
      const excessRatio = SYSTEM_PROMPT_TOKENS / tokens;
      const worldRulesMaxLen = Math.floor((gameSetting.worldRules?.length || 0) * excessRatio * 0.8);
      const truncatedRules = (gameSetting.worldRules || 'Standard fantasy world rules apply.').slice(0, worldRulesMaxLen) + '...';
      prompt = SYSTEM_PROMPT_TEMPLATE
        .replace('{DM_NAME}', gameSetting.dmName || 'Game Master')
        .replace('{PLAYER_CLASS}', gameSetting.playerClassName || 'Adventurer')
        .replace('{REGION_NAME}', gameSetting.worldName || 'an unknown realm')
        .replace('{WORLD_RULES}', truncatedRules)
        .replace('{SESSION_DURATION}', '0 minutes')
        .replace('{TIME_SINCE_LAST_EVENT}', 'N/A');
    }

    return prompt;
  }

  /**
   * Layer 1: World Context (~300 tokens)
   *
   * 当前区域描述 + 邻近位置 + 可见 NPC + 时间/天气/氛围
   */
  buildWorldContext(mapContext: MapContext, timeContext: TimeContext): string {
    const parts: string[] = [];

    parts.push('## CURRENT LOCATION');
    parts.push(`You are in **${mapContext.currentRegion}**.`);
    if (mapContext.regionDescription) {
      parts.push(mapContext.regionDescription);
    }

    if (mapContext.nearbyLocations.length > 0) {
      parts.push('\nNearby locations:');
      for (const loc of mapContext.nearbyLocations.slice(0, 5)) {
        parts.push(`- ${loc}`);
      }
    }

    if (mapContext.visibleNpcs.length > 0) {
      parts.push('\nVisible NPCs:');
      for (const npc of mapContext.visibleNpcs.slice(0, 5)) {
        parts.push(`- ${npc}`);
      }
    }

    parts.push(`\n## ENVIRONMENT`);
    parts.push(`Time: ${timeContext.timeOfDay || 'Unknown'}`);
    parts.push(`Weather: ${timeContext.weather || 'Clear'}`);
    parts.push(`Atmosphere: ${timeContext.atmosphere || 'Neutral'}`);

    const full = parts.join('\n');
    return this.trimToBudget(full, WORLD_CONTEXT_TOKENS);
  }

  /**
   * Layer 2: Memory Context (~800 tokens)
   *
   * 来自记忆引擎检索结果。
   */
  async assembleMemoryContext(memoryResponse: MemoryRetrievalResponse): Promise<string> {
    const context = memoryResponse.contextBlock || '';
    return this.trimToBudget(context, MEMORY_CONTEXT_TOKENS);
  }

  /**
   * Layer 3: Session Context (~1500 tokens)
   *
   * 最近 N 条对话历史（滑动窗口，从最新往前取直到 token 预算用尽）。
   */
  buildSessionContext(messages: DialogueMessage[], maxTokens: number): string {
    if (messages.length === 0) return '';

    const maxBudget = maxTokens || SESSION_CONTEXT_TOKENS;
    const parts: string[] = [];
    let tokenCount = 0;

    // 从最新消息开始反向收集
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]!;
      const roleLabel = this.roleLabel(msg.role, msg.speakerName);
      const msgText = `${roleLabel}: ${msg.content}`;
      const msgTokens = estimateTokens(msgText);

      if (tokenCount + msgTokens > maxBudget) {
        // 如果收集的消息太少（< 3 条），截断当前消息
        if (parts.length < 3) {
          const remaining = maxBudget - tokenCount;
          const truncated = msgText.slice(0, Math.floor(remaining * 4)) + '…';
          parts.unshift(truncated);
        }
        break;
      }

      tokenCount += msgTokens;
      parts.unshift(msgText);
    }

    return parts.join('\n');
  }

  /**
   * Layer 4: Input Block
   *
   * 玩家输入文本 + 当前页面状态
   */
  buildInputBlock(input: string, _pageState?: { selectedTileId?: string; openPanel?: string }): string {
    if (!input || input.trim() === '') {
      return '[The player is waiting. Describe the current scene and suggest what to do next.]';
    }
    return `Player: ${input}`;
  }

  // ============================================================
  // 缓存管理
  // ============================================================

  /**
   * 在记忆引擎 ingest 后调用，预计算 Memory Block。
   * 在对话流中异步执行（不阻塞 UI）。
   */
  async precomputeMemoryBlock(request: MemoryRetrievalRequest): Promise<void> {
    if (!this.memoryRetriever) return;

    const result = await this.memoryRetriever(request);
    this.memoryBlock = result.contextBlock;
    this.memoryVersion++;
  }

  /**
   * 强制失效所有缓存（切换游戏设定时使用）
   */
  invalidateAll(): void {
    this.systemVersion = -1;
    this.worldVersion = -1;
    this.memoryVersion = -1;
    this.systemBlock = '';
    this.worldBlock = '';
    this.memoryBlock = '';
  }

  /**
   * 强制失效 World 缓存（地图切换时）
   */
  invalidateWorld(): void {
    this.worldVersion = -1;
    this.worldBlock = '';
  }

  // ============================================================
  // 辅助
  // ============================================================

  /**
   * 将文本截断到 token 预算内。
   */
  trimToBudget(text: string, maxTokens: number): string {
    if (!text) return '';
    const tokens = estimateTokens(text);
    if (tokens <= maxTokens) return text;

    // 粗略按字符比例截断
    const ratio = maxTokens / tokens;
    const targetLen = Math.floor(text.length * ratio * 0.9);
    return text.slice(0, targetLen) + '…';
  }

  private roleLabel(role: string, speakerName: string): string {
    switch (role) {
      case 'player':
        return `🧑 ${speakerName || 'Player'}`;
      case 'ai_gm':
        return `🦊 ${speakerName || 'GM'}`;
      case 'npc':
        return `👤 ${speakerName || 'NPC'}`;
      case 'system':
        return `⚙️ System`;
      default:
        return speakerName || role;
    }
  }

  private buildEmptyMemoryBlock(): string {
    return '## MEMORY\nNo previous memories available. This is a new adventure.';
  }
}
