/**
 * DialogueSession — AI GM 对话会话状态机
 *
 * @description
 * 实现 IDialogueSystem 接口。管理完整对话生命周期：
 * 组装 Prompt → 调用 OpenRouter（流式/非流式）→ 解析响应 →
 * 记忆引擎 ingest → 状态更新。
 *
 * 状态机模式（GDD §2.1）:
 *   exploration ↔ conversation ↔ tension ↔ climax ↔ resolution
 *   combat ↔ exploration
 *   resting ↔ exploration
 *
 * @see design/gdd/dialogue-system.md §2, §4.1
 * @see docs/architecture/adr/003-prompt-context-assembly.md
 */

import { generateUUID } from '@/lib/utils/id';
import { estimateTokens } from '@/lib/utils/tokenizer';
import { MAX_PLAYER_INPUT_LENGTH } from '@/lib/constants';
import type {
  IDialogueSystem,
  DialogueConfig,
  DialogueMessage,
  DialogueSessionMeta,
  ContentBlock,
  StateDelta,
  SuggestedAction,
  DecisionNode,
  DecisionOption,
  NarrativeMode,
  NarrativeStateTransition,
  PlayerInput,
  AssemblyContext,
  MapContext,
  TimeContext,
  MemoryRetrievalRequest,
  NarrativeTag,
} from './types';
import { DEFAULT_DIALOGUE_CONFIG } from './types';
import { PromptAssembler } from './prompt-assembler';
import { ResponseParser } from './response-parser';
import type { ParseResult } from './response-parser';
import type { OpenRouterClient } from '@/infrastructure/openrouter/client';
import type { IMemoryEngine, EventLogEntry, EventTag } from '@/systems/memory/types';

// ============================================================
// DialogueSession
// ============================================================

export class DialogueSession implements IDialogueSystem {
  // ── 依赖 ──
  private openRouter: OpenRouterClient;
  private memoryEngine: IMemoryEngine;
  private promptAssembler: PromptAssembler;
  private responseParser: ResponseParser;

  // ── 配置 ──
  private config: DialogueConfig;

  // ── 状态 ──
  private messages: DialogueMessage[] = [];
  private narrativeMode: NarrativeMode = 'exploration';
  private decisionTree: DecisionNode[] = [];
  private sessionMeta: DialogueSessionMeta;
  private initialized: boolean = false;
  private shuttingDown: boolean = false;
  private currentSuggestions: SuggestedAction[] = [];

  // ── 版本号（缓存失效） ──
  private systemVersion: number = 0;
  private worldVersion: number = 0;
  private memoryVersion: number = 0;
  private lastEventId: string | null = null;

  // ── 地图上下文回调 ──
  private mapContextProvider: (() => MapContext) | null = null;
  private timeContextProvider: (() => TimeContext) | null = null;

  constructor(
    openRouterClient: OpenRouterClient,
    memoryEngine: IMemoryEngine
  ) {
    this.openRouter = openRouterClient;
    this.memoryEngine = memoryEngine;
    this.promptAssembler = new PromptAssembler();
    this.responseParser = new ResponseParser();
    this.config = { ...DEFAULT_DIALOGUE_CONFIG };

    // 注册记忆检索回调
    this.promptAssembler.setMemoryRetriever(async (req) => {
      return this.memoryEngine.retrieveForContext(req);
    });

    this.sessionMeta = this.createEmptySessionMeta();
  }

  // ============================================================
  // 生命周期 — GDD §4.1
  // ============================================================

  async init(config: DialogueConfig): Promise<void> {
    this.config = { ...DEFAULT_DIALOGUE_CONFIG, ...config };
    this.messages = [];
    this.narrativeMode = 'exploration';
    this.decisionTree = [];
    this.currentSuggestions = [];
    this.sessionMeta = this.createEmptySessionMeta();
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    this.initialized = false;
  }

  // ============================================================
  // 核心交互 — GDD §4.1
  // ============================================================

  /**
   * 发送玩家输入（自由文本或选项 ID）。
   * 完整流程：组装 Prompt → 调用 LLM → 解析 → 记忆 ingest → 返回。
   */
  async sendMessage(input: PlayerInput): Promise<DialogueMessage> {
    this.ensureInitialized();

    // 1. 输入处理
    const processedInput = this.processInput(input);

    // 2. 存储玩家消息
    const playerMessage = this.createPlayerMessage(processedInput);
    this.messages.push(playerMessage);

    // 3. 组装 Prompt
    const context = this.buildAssemblyContext(processedInput);
    const promptMessages = await this.promptAssembler.assemble(
      this.messages,
      processedInput,
      context
    );

    // 4. 调用 LLM（非流式）
    const llmResponse = await this.openRouter.sendChatCompletion(
      {
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        streamTimeout: this.config.streamTimeout,
        enableTypingEffect: this.config.enableTypingEffect,
      },
      promptMessages
    );

    // 5. 解析响应
    const parseResult = this.responseParser.parse(llmResponse.content);

    // 6. 创建 AI 消息
    const aiMessage = this.createAiMessage(parseResult, llmResponse.content);

    // 7. 更新状态
    this.updateState(parseResult, aiMessage);

    // 8. 记忆引擎 ingest
    await this.ingestToMemory(aiMessage, parseResult);

    // 9. 预计算 Memory Block
    this.precomputeMemory().catch((err) => {
      console.warn('[DialogueSession] Memory precompute failed:', err);
    });

    return aiMessage;
  }

  /**
   * 流式发送，通过回调逐步返回。
   */
  async sendMessageStream(
    input: PlayerInput,
    onToken: (token: string) => void,
    onBlock: (block: ContentBlock) => void,
    onComplete: (message: DialogueMessage) => void
  ): Promise<void> {
    this.ensureInitialized();

    const processedInput = this.processInput(input);

    // 存储玩家消息
    const playerMessage = this.createPlayerMessage(processedInput);
    this.messages.push(playerMessage);

    // 组装 Prompt
    const context = this.buildAssemblyContext(processedInput);
    const promptMessages = await this.promptAssembler.assemble(
      this.messages,
      processedInput,
      context
    );

    // 流式调用
    let accumulatedText = '';

    const llmResponse = await this.openRouter.streamChatCompletion(
      {
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        streamTimeout: this.config.streamTimeout,
        enableTypingEffect: this.config.enableTypingEffect,
      },
      promptMessages,
      (chunk) => {
        accumulatedText += chunk;
        onToken(chunk);
      }
    );

    // 解析累积文本
    const parseResult = this.responseParser.parse(accumulatedText || llmResponse.content);

    // 回调各块
    for (const block of parseResult.blocks) {
      onBlock(block);
    }

    // 创建 AI 消息
    const aiMessage = this.createAiMessage(parseResult, accumulatedText || llmResponse.content);

    // 更新状态
    this.updateState(parseResult, aiMessage);

    // 记忆引擎 ingest
    await this.ingestToMemory(aiMessage, parseResult);

    // 回调完成
    onComplete(aiMessage);

    // 预计算 Memory Block
    this.precomputeMemory().catch((err) => {
      console.warn('[DialogueSession] Memory precompute failed:', err);
    });
  }

  // ============================================================
  // 建议动作 — GDD §4.1
  // ============================================================

  getCurrentSuggestions(): SuggestedAction[] {
    return this.currentSuggestions;
  }

  async executeSuggestion(actionId: string): Promise<DialogueMessage> {
    const action = this.currentSuggestions.find((a) => a.id === actionId);
    if (!action) {
      throw new Error(`Suggestion ${actionId} not found`);
    }

    return this.sendMessage({
      type: 'suggested_action',
      text: action.text,
      actionId,
    });
  }

  // ============================================================
  // 历史 — GDD §4.1
  // ============================================================

  getRecentMessages(count: number): DialogueMessage[] {
    return this.messages.slice(-count);
  }

  getSessionHistory(): DialogueMessage[] {
    return [...this.messages];
  }

  getDecisionTree(): DecisionNode[] {
    return this.decisionTree;
  }

  // ============================================================
  // 状态 — GDD §4.1
  // ============================================================

  getNarrativeMode(): NarrativeMode {
    return this.narrativeMode;
  }

  getSessionMeta(): DialogueSessionMeta {
    return { ...this.sessionMeta };
  }

  // ============================================================
  // 上下文提供者注册
  // ============================================================

  setMapContextProvider(fn: () => MapContext): void {
    this.mapContextProvider = fn;
  }

  setTimeContextProvider(fn: () => TimeContext): void {
    this.timeContextProvider = fn;
  }

  // ============================================================
  // 私有：输入处理
  // ============================================================

  private processInput(input: PlayerInput): string {
    let text = input.text || '';

    // 空输入 → AI GM 主动叙述
    if (!text.trim()) {
      return '';
    }

    // 截断过长输入
    if (text.length > MAX_PLAYER_INPUT_LENGTH) {
      text = text.slice(0, MAX_PLAYER_INPUT_LENGTH);
    }

    return text;
  }

  // ============================================================
  // 私有：消息创建
  // ============================================================

  private createPlayerMessage(text: string): DialogueMessage {
    return {
      id: generateUUID(),
      role: 'player',
      speakerName: 'Player',
      speakerId: 'player',
      content: text || '[等待中…]',
      contentBlocks: [],
      timestamp: Date.now(),
      isDecisionPoint: false,
      tokenCount: estimateTokens(text),
      suggestedActions: [],
    };
  }

  private createAiMessage(parseResult: ParseResult, rawContent: string): DialogueMessage {
    return {
      id: generateUUID(),
      role: 'ai_gm',
      speakerName: 'GM',
      speakerId: 'ai_gm',
      content: rawContent,
      contentBlocks: parseResult.blocks,
      timestamp: Date.now(),
      sceneType: parseResult.isDecisionPoint
        ? (parseResult.blocks.find((b) => b.type === 'decision')?.options?.[0]?.sceneType || 'golden')
        : null,
      isDecisionPoint: parseResult.isDecisionPoint,
      decisionNodeId: undefined, // 在 updateState 中设置
      tokenCount: estimateTokens(rawContent),
      stateDelta: parseResult.stateDelta,
      suggestedActions: parseResult.suggestedActions,
    };
  }

  // ============================================================
  // 私有：状态更新
  // ============================================================

  private updateState(parseResult: ParseResult, aiMessage: DialogueMessage): void {
    // 存储消息
    this.messages.push(aiMessage);

    // 更新建议动作
    this.currentSuggestions = parseResult.suggestedActions;

    // 更新叙事模式
    if (parseResult.isDecisionPoint) {
      const prevMode = this.narrativeMode;
      this.narrativeMode = 'climax';

      // 创建决策节点
      const decisionBlock = parseResult.blocks.find((b) => b.type === 'decision');
      const decisionNode = this.createDecisionNode(parseResult, decisionBlock);
      this.decisionTree.push(decisionNode);
      aiMessage.decisionNodeId = decisionNode.id;

      this.sessionMeta.narrativeStateHistory.push({
        from: prevMode,
        to: 'climax',
        timestamp: Date.now(),
        trigger: 'decision_point',
      });
      this.sessionMeta.lastKeyEventTime = Date.now();
    } else {
      // 根据叙事标签推断模式
      this.inferNarrativeMode(parseResult);
    }

    // 更新会话元数据
    this.sessionMeta.messageCount = this.messages.length;
    this.sessionMeta.decisionCount = this.decisionTree.length;
    this.sessionMeta.totalTokensUsed += aiMessage.tokenCount;

    // 更新版本号
    this.memoryVersion++;
    // FIX: BUG-3 — worldVersion 仅在 StateDelta 实际包含世界状态变更时递增，避免缓存频繁失效
    if (parseResult.stateDelta && Object.keys(parseResult.stateDelta).length > 0) {
      this.worldVersion++;
    }
  }

  private inferNarrativeMode(parseResult: ParseResult): void {
    const tags = parseResult.narrativeTags;
    const prev = this.narrativeMode;

    if (tags.includes('danger_zone') || tags.includes('danger')) {
      this.narrativeMode = 'tension';
    } else if (tags.includes('hook_resolved') || tags.includes('chapter_end')) {
      this.narrativeMode = 'resolution';
    } else if (tags.includes('hook_set')) {
      this.narrativeMode = 'tension';
    }
    // 否则保持当前模式

    if (prev !== this.narrativeMode) {
      this.sessionMeta.narrativeStateHistory.push({
        from: prev,
        to: this.narrativeMode,
        timestamp: Date.now(),
        trigger: `tags: ${tags.join(',')}`,
      });
    }
  }

  private createDecisionNode(
    parseResult: ParseResult,
    decisionBlock?: ContentBlock
  ): DecisionNode {
    const options = decisionBlock?.options || [];
    // 找到前一条 AI 消息的内容作为叙事上下文
    const narrativeBlock = parseResult.blocks.find((b) => b.type === 'narrative');
    const sceneType = options[0]?.sceneType ?? 'golden';

    return {
      id: generateUUID(),
      parentDecisionId: this.decisionTree.length > 0
        ? this.decisionTree[this.decisionTree.length - 1]!.id
        : null,
      sessionId: this.sessionMeta.sessionId,
      timestamp: Date.now(),
      narrativeContext: narrativeBlock?.text || '',
      promptText: decisionBlock?.text || '',
      options,
      chosenOptionIndex: -1,
      immediateConsequence: '',
      consequenceEventIds: [],
      sceneType,
      tags: parseResult.narrativeTags,
    };
  }

  // ============================================================
  // 私有：记忆引擎
  // ============================================================

  private async ingestToMemory(aiMessage: DialogueMessage, parseResult: ParseResult): Promise<void> {
    if (this.shuttingDown) return;

    // 将 NarrativeTag 映射到 EventTag
    const eventTags = this.mapNarrativeTagsToEventTags(parseResult.narrativeTags);

    const event: EventLogEntry = {
      id: generateUUID(),
      sessionId: this.sessionMeta.sessionId,
      type: parseResult.isDecisionPoint ? 'decision' : 'dialogue',
      timestamp: Date.now(),
      importance: parseResult.isDecisionPoint ? 3 : 2,
      summary: aiMessage.content.slice(0, 140),
      detail: aiMessage.content,
      entitiesExtracted: [],
      relationsUpdated: [],
      tags: eventTags,
      precedingEventId: this.lastEventId,
    };

    await this.memoryEngine.ingest(event);
    this.lastEventId = event.id;
  }

  /**
   * 将 NarrativeTag 映射到 EventTag。
   * 仅保留与 EventTag 兼容的标签。
   */
  private mapNarrativeTagsToEventTags(narrativeTags: NarrativeTag[]): EventTag[] {
    const validEventTags = new Set<EventTag>(['golden', 'danger', 'magic', 'hook', 'resolution', 'betrayal']);
    const result: EventTag[] = [];

    for (const tag of narrativeTags) {
      // 直接映射
      if (tag === 'golden' || tag === 'danger' || tag === 'magic' || tag === 'hook' || tag === 'resolution' || tag === 'betrayal') {
        result.push(tag);
      }
      // golden_choice → golden
      if (tag === 'golden_choice') result.push('golden');
      // danger_zone → danger
      if (tag === 'danger_zone') result.push('danger');
      // magic_moment → magic
      if (tag === 'magic_moment') result.push('magic');
      // hook_set → hook
      if (tag === 'hook_set') result.push('hook');
      // hook_resolved → resolution
      if (tag === 'hook_resolved') result.push('resolution');
    }

    // 去重
    return [...new Set(result)];
  }

  private async precomputeMemory(): Promise<void> {
    const req = this.buildMemoryRetrievalRequest('');
    await this.promptAssembler.precomputeMemoryBlock(req);
  }

  // ============================================================
  // 私有：上下文组装
  // ============================================================

  private buildAssemblyContext(playerInput: string): AssemblyContext {
    const mapContext = this.mapContextProvider?.() || this.emptyMapContext();
    const timeContext = this.timeContextProvider?.() || this.emptyTimeContext();
    const memoryRequest = this.buildMemoryRetrievalRequest(playerInput);

    return {
      systemVersion: this.systemVersion,
      worldVersion: this.worldVersion,
      memoryVersion: this.memoryVersion,
      gameSetting: {
        worldName: 'AI Narrator World',
        dmName: 'Game Master',
        playerClassName: 'Adventurer',
        worldRules: 'Standard fantasy rules: magic exists but is rare; death is permanent; actions have consequences.',
        settingId: 'default',
        sessionDurationMinutes: 0,
        timeSinceLastKeyEventMinutes: 0,
      },
      modelConfig: {
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        streamTimeout: this.config.streamTimeout,
        enableTypingEffect: this.config.enableTypingEffect,
      },
      mapContext,
      timeContext,
      memoryRequest,
      maxSessionTokens: 1500,
    };
  }

  private buildMemoryRetrievalRequest(playerInput: string): MemoryRetrievalRequest {
    return {
      currentLocation: this.mapContextProvider?.().currentRegion || 'Unknown',
      nearbyEntities: this.mapContextProvider?.().visibleNpcs || [],
      activeQuestIds: [],
      playerInput,
      maxTokens: 800,
      includeLastSession: true,
    };
  }

  private emptyMapContext(): MapContext {
    return {
      currentRegion: 'Unknown',
      regionDescription: '',
      nearbyLocations: [],
      visibleNpcs: [],
      playerCoord: '0,0',
    };
  }

  private emptyTimeContext(): TimeContext {
    return {
      timeOfDay: 'Morning',
      weather: 'Clear',
      atmosphere: 'Neutral',
    };
  }

  // ============================================================
  // 私有：辅助
  // ============================================================

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('[DialogueSession] Not initialized. Call init() first.');
    }
    if (this.shuttingDown) {
      throw new Error('[DialogueSession] Session is shutting down.');
    }
  }

  private createEmptySessionMeta(): DialogueSessionMeta {
    const sessionId = generateUUID();
    return {
      sessionId,
      sessionDuration: 0,
      messageCount: 0,
      decisionCount: 0,
      lastKeyEventTime: 0,
      narrativeStateHistory: [],
      modelId: this.config.model,
      totalTokensUsed: 0,
      startedAt: Date.now(),
    };
  }
}
