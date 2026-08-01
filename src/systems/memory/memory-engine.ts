/**
 * MemoryEngine — 三层记忆引擎主类
 *
 * @description
 * 管理即时记忆 (RingBuffer)、短期记忆 (localStorage)、长期记忆 (IndexedDB 占位)
 * 的完整生命周期。实现 IMemoryEngine 接口。
 *
 * 核心职责:
 * - ingest(): 摄入事件 → 实体提取 → 关系构建 → 图谱更新
 * - retrieveForContext(): 检索相关记忆 → 组装纯文本上下文块
 * - shutdown(): 压缩即时记忆 → 生成会话摘要 → 写入存储
 * - init(): 加载存储 → 恢复图谱 → 创建新会话
 *
 * 并发控制（GDD §6.3）:
 * - Promise 队列串行化：同一时刻只能有一个 ingest 或 retrieve
 * - retrieve 会等待 ingest 完成
 * - shutdown() 期间不接受新的 ingest
 *
 * @see GDD §2, §3, §4.1, §6.3
 */

import type {
  EventLogEntry,
  IMemoryEngine,
  KeyEventDigest,
  MemoryEngineConfig,
  MemoryEntity,
  MemoryEntitySnapshot,
  MemoryGraph,
  MemoryRetrievalRequest,
  MemoryRetrievalResponse,
  Relation,
  RelationDelta,
  SessionMemory,
  UnresolvedHook,
  WorldStateDigest,
} from './types';
import { DEFAULT_MEMORY_ENGINE_CONFIG } from './types';
import { generateUUID } from '@/lib/utils/id';
import { RingBuffer } from './ring-buffer';
import { EntityExtractor } from './entity-extractor';
import { Compressor } from './compressor';
import { ContextRetriever } from './context-retriever';
import { StorageSync } from './storage-sync';
import type { IStorageAdapter } from '@/infrastructure/storage/IStorageAdapter';
import {
  MAX_IMMEDIATE_EVENTS,
  MAX_SHORT_TERM_SESSIONS,
  MAX_KEY_EVENT_DIGESTS,
} from '@/lib/constants';

// ============================================================
// MemoryEngine 实现
// ============================================================

export class MemoryEngine implements IMemoryEngine {
  // --- 依赖 ---
  private ringBuffer: RingBuffer;
  private entityExtractor: EntityExtractor;
  private compressor: Compressor;
  private contextRetriever: ContextRetriever;
  private storageSync: StorageSync | null = null;

  // --- 状态 ---
  private config: MemoryEngineConfig;
  private graph: MemoryGraph;
  private sessionMemories: SessionMemory[] = [];
  private currentSession: SessionMemory | null = null;
  private initialized: boolean = false;
  private shuttingDown: boolean = false;

  // --- 并发控制 ---
  private operationQueue: Promise<void> = Promise.resolve();

  // FIX: PERF-2 — name→id 索引，O(1) 实体查找替代 O(n) 线性扫描
  private entityNameIndex: Map<string, string> = new Map();

  /**
   * @param shortTermAdapter - 短期存储适配器
   * @param longTermAdapter - 长期存储适配器（MVP 可选）
   */
  constructor(
    shortTermAdapter?: IStorageAdapter,
    longTermAdapter?: IStorageAdapter | null
  ) {
    this.config = { ...DEFAULT_MEMORY_ENGINE_CONFIG };
    this.ringBuffer = new RingBuffer(this.config.maxImmediateEvents);
    this.entityExtractor = new EntityExtractor();
    this.compressor = new Compressor();
    this.contextRetriever = new ContextRetriever();

    if (shortTermAdapter) {
      this.storageSync = new StorageSync(shortTermAdapter, longTermAdapter ?? null);
    }

    this.graph = this.createEmptyGraph();
  }

  // ===========================================================================
  // 生命周期 — GDD §4.1
  // ===========================================================================

  /**
   * 初始化引擎：从存储加载图谱，创建新会话。
   */
  async init(config?: Partial<MemoryEngineConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
      this.ringBuffer = new RingBuffer(this.config.maxImmediateEvents);
    }

    // 尝试从存储加载图谱
    let loadedGraph: MemoryGraph | null = null;
    if (this.storageSync) {
      const shortTermAvailable = await this.storageSync.isShortTermAvailable();
      if (shortTermAvailable) {
        loadedGraph = await this.storageSync.loadShortTerm();
      }

      // 同时尝试长期存储
      if (!loadedGraph && this.config.enableLongTerm) {
        loadedGraph = await this.storageSync.loadLongTerm();
      }

      // 加载会话历史
      const loadedSessions = await this.storageSync.loadSessionMemories();
      this.sessionMemories = loadedSessions;

      const sessionCount = await this.storageSync.loadSessionCount();
      this.graph.metadata.totalSessions = Math.max(
        this.graph.metadata.totalSessions,
        sessionCount
      );
    }

    if (loadedGraph) {
      this.graph = loadedGraph;
      // FIX: PERF-2 — 重建名称索引
      for (const [id, entity] of this.graph.entities.entries()) {
        this.registerEntityNameIndex(id, entity.name);
      }
      // 注册已知实体名称到提取器
      const knownNames = Array.from(this.graph.entities.values()).map(
        (e) => e.name
      );
      this.entityExtractor.registerKnownNames(knownNames);

      // 恢复即时记忆到 RingBuffer
      for (const event of this.graph.eventLog) {
        this.ringBuffer.push(event);
      }
    }

    // 创建新会话
    const sessionId = generateUUID();
    this.graph.metadata.currentSessionId = sessionId;

    this.currentSession = {
      sessionId,
      startedAt: Date.now(),
      endedAt: null,
      keyEvents: [],
      relationshipDeltas: [],
      worldStateDigest: {
        playerLocation: '',
        playerHp: 100,
        playerMp: 100,
        activeQuests: [],
        factionStandings: {},
        inventorySummary: [],
      },
      unresolvedHooks: [],
      playerIntentGuess: '',
    };

    if (this.storageSync) {
      await this.storageSync.saveCurrentSessionId(sessionId);
    }

    this.initialized = true;
  }

  /**
   * 关闭引擎：压缩即时记忆 → 生成会话摘要 → 写入存储。
   */
  async shutdown(): Promise<void> {
    this.shuttingDown = true;

    // 等待所有进行中的操作完成
    await this.operationQueue;

    if (!this.currentSession) {
      this.shuttingDown = false;
      return;
    }

    // 完成当前会话
    this.currentSession.endedAt = Date.now();

    // 生成 KeyEventDigests
    const allEvents = this.ringBuffer.toArray();
    const topEvents = this.compressor.buildSessionSummaryEvents(
      allEvents,
      MAX_KEY_EVENT_DIGESTS
    );

    this.currentSession.keyEvents = topEvents.map(
      (event): KeyEventDigest => ({
        id: generateUUID(),
        eventLogId: event.id,
        type: event.type,
        summary: event.summary,
        importance: event.importance,
        entitiesInvolved: event.entitiesExtracted,
        tags: event.tags,
        timestamp: event.timestamp,
      })
    );

    // 收集未解决悬念
    this.currentSession.unresolvedHooks = this.collectUnresolvedHooks();

    // 添加到会话记忆列表（FIFO，GDD §2.2.2）
    this.sessionMemories.push(this.currentSession);
    if (this.sessionMemories.length > this.config.shortTermSessionLimit) {
      this.sessionMemories = this.sessionMemories.slice(
        -this.config.shortTermSessionLimit
      );
    }

    // 更新图谱
    this.graph.eventLog = this.ringBuffer.toArray();
    this.graph.metadata.totalSessions++;
    this.graph.metadata.lastUpdatedAt = Date.now();

    // 写入存储
    if (this.storageSync) {
      await this.storageSync.saveShortTerm(this.graph);
      await this.storageSync.saveSessionMemories(this.sessionMemories);
      await this.storageSync.saveSessionCount(
        this.graph.metadata.totalSessions
      );

      if (this.config.enableLongTerm) {
        await this.storageSync.saveLongTerm(this.graph);
      }
    }

    this.initialized = false;
    this.shuttingDown = false;
  }

  // ===========================================================================
  // 事件摄入 — GDD §4.1
  // ===========================================================================

  /**
   * 摄入单条事件日志条目。
   */
  async ingest(event: EventLogEntry): Promise<void> {
    if (this.shuttingDown) {
      console.warn('[MemoryEngine] ingest rejected: engine is shutting down.');
      return;
    }

    // 串行化
    await this.enqueue(async () => {
      await this.doIngest(event);
    });
  }

  /**
   * 批量摄入事件。
   */
  async ingestBatch(events: EventLogEntry[]): Promise<void> {
    if (this.shuttingDown) {
      console.warn('[MemoryEngine] ingestBatch rejected: engine is shutting down.');
      return;
    }

    await this.enqueue(async () => {
      for (const event of events) {
        await this.doIngest(event);
      }
    });
  }

  // ===========================================================================
  // 上下文检索 — GDD §4.1, §4.2
  // ===========================================================================

  /**
   * 检索相关记忆，返回格式化上下文块。
   */
  async retrieveForContext(
    req: MemoryRetrievalRequest
  ): Promise<MemoryRetrievalResponse> {
    // 串行化：等待所有进行中的 ingest 完成
    await this.operationQueue;

    const lastSession =
      this.sessionMemories.length > 0
        ? this.sessionMemories[this.sessionMemories.length - 1]
        : undefined;

    return this.contextRetriever.retrieve(this.graph, req, lastSession);
  }

  // ===========================================================================
  // 实体与关系查询 — GDD §4.1
  // ===========================================================================

  getEntity(id: string): MemoryEntity | undefined {
    return this.graph.entities.get(id);
  }

  searchEntities(query: string, limit: number = 10): MemoryEntity[] {
    const queryLower = query.toLowerCase();
    const results: MemoryEntity[] = [];

    for (const entity of this.graph.entities.values()) {
      if (!entity.isActive) continue;

      if (
        entity.name.toLowerCase().includes(queryLower) ||
        entity.aliases.some((a) => a.toLowerCase().includes(queryLower)) ||
        entity.type.toLowerCase().includes(queryLower)
      ) {
        results.push(entity);
      }
    }

    // 按 importance 降序
    results.sort((a, b) => b.importance - a.importance);
    return results.slice(0, limit);
  }

  getRelation(fromId: string, toId: string): Relation | undefined {
    for (const rel of this.graph.relations.values()) {
      if (rel.fromEntityId === fromId && rel.toEntityId === toId) {
        return rel;
      }
    }
    return undefined;
  }

  getEntityRelations(entityId: string): Relation[] {
    const result: Relation[] = [];
    for (const rel of this.graph.relations.values()) {
      if (rel.fromEntityId === entityId || rel.toEntityId === entityId) {
        result.push(rel);
      }
    }
    return result;
  }

  // ===========================================================================
  // 会话管理 — GDD §4.1
  // ===========================================================================

  getLastSessionSummary(): SessionMemory | undefined {
    if (this.sessionMemories.length === 0) return undefined;
    return this.sessionMemories[this.sessionMemories.length - 1];
  }

  getCurrentSessionEventCount(): number {
    return this.ringBuffer.size;
  }

  getUnresolvedHooks(): UnresolvedHook[] {
    // 收集所有会话中未解决的悬念
    const hooks: UnresolvedHook[] = [];
    for (const session of this.sessionMemories) {
      for (const hook of session.unresolvedHooks) {
        hooks.push(hook);
      }
    }
    if (this.currentSession) {
      for (const hook of this.currentSession.unresolvedHooks) {
        hooks.push(hook);
      }
    }
    return hooks;
  }

  exportGraph(): MemoryGraph {
    return {
      ...this.graph,
      eventLog: this.ringBuffer.toArray(),
      entities: new Map(this.graph.entities),
      relations: new Map(this.graph.relations),
    };
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * 创建空的记忆图谱。
   */
  private createEmptyGraph(): MemoryGraph {
    return {
      version: '1.0.0',
      entities: new Map(),
      relations: new Map(),
      eventLog: [],
      metadata: {
        totalSessions: 0,
        currentSessionId: '',
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
        worldName: '',
        gameSettingId: '',
      },
    };
  }

  /**
   * Promise 队列串行化。
   */
  private enqueue(fn: () => Promise<void>): Promise<void> {
    const current = this.operationQueue;
    this.operationQueue = current.then(fn, fn);
    return this.operationQueue;
  }

  /**
   * 实际执行 ingest 逻辑。
   */
  private async doIngest(event: EventLogEntry): Promise<void> {
    // 1. 添加到即时记忆
    const evicted = this.ringBuffer.push(event);
    if (evicted) {
      // 被驱逐的事件仍保留在 eventLog 中（仅从 RingBuffer 移除）
      this.graph.eventLog.push(evicted);
    }

    // 同时追加到图谱事件日志
    this.graph.eventLog.push(event);

    // 2. 实体提取（从 detail 和 summary 字段）
    const extractText = `${event.summary} ${event.detail}`;
    const extractedEntities = this.entityExtractor.extractEntities(
      extractText,
      event.id
    );

    // 3. 实体去重与合并
    const entityIds: string[] = [];
    for (const extracted of extractedEntities) {
      const existingId = this.findExistingEntity(extracted.name);
      if (existingId) {
        // 更新已有实体
        const entity = this.graph.entities.get(existingId)!;
        entity.occurrenceCount++;
        entity.lastSeenAt = event.timestamp;
        // FIX: BUG-1 — +0 为无效操作，应为 +1 以实际提升实体重要性
        if (extracted.confidence > 0.8) {
          entity.importance = Math.min(3, entity.importance + 1) as 1 | 2 | 3;
        }
        entityIds.push(existingId);
      } else {
        // 创建新实体
        const newId = generateUUID();
        const newEntity: MemoryEntity = {
          id: newId,
          name: extracted.name,
          type: extracted.type,
          aliases: [],
          attributes: extracted.attributes as Record<string, unknown>,
          firstSeenAt: event.timestamp,
          lastSeenAt: event.timestamp,
          occurrenceCount: 1,
          importance: this.guessImportance(extracted.confidence, event.importance),
          isActive: true,
        };
        this.graph.entities.set(newId, newEntity);
        // FIX: PERF-2 — 注册到名称索引
        this.registerEntityNameIndex(newId, extracted.name);
        entityIds.push(newId);

        // 注册到提取器
        this.entityExtractor.registerKnownNames([extracted.name]);
      }
    }

    // 更新事件的实体关联
    event.entitiesExtracted = [...new Set([...event.entitiesExtracted, ...entityIds])];

    // 4. 关系提取
    if (extractedEntities.length >= 2) {
      const newRelations = this.entityExtractor.extractRelations(
        extractedEntities,
        extractText
      );
      const relationIds: string[] = [];

      for (const newRel of newRelations) {
        // FIX: BUG-2 — 通过实体名称而非硬编码索引查找 from/to 实体
        // extractRelations 现在附带 fromEntityName/toEntityName 字段
        const fromName = (newRel as Record<string, unknown>).fromEntityName as string | undefined;
        const toName = (newRel as Record<string, unknown>).toEntityName as string | undefined;

        if (!fromName || !toName) continue;

        const fromEntity = extractedEntities.find((e) => e.name === fromName);
        const toEntity = extractedEntities.find((e) => e.name === toName);

        if (!fromEntity || !toEntity) continue;

        const fromId = this.findExistingEntity(fromEntity.name) ?? '';
        const toId = this.findExistingEntity(toEntity.name) ?? '';

        if (!fromId || !toId) continue;

        // 检查是否已存在同类型关系
        const existingRel = this.findExistingRelation(fromId, toId, newRel.type);
        if (existingRel) {
          // 更新关系强度
          existingRel.strength = this.clampStrength(
            existingRel.strength + 0.1
          );
          existingRel.evidence.push(event.id);
          existingRel.lastUpdatedAt = event.timestamp;
          relationIds.push(existingRel.id);
        } else {
          // 创建新关系
          const relId = generateUUID();
          const relation: Relation = {
            id: relId,
            fromEntityId: fromId,
            toEntityId: toId,
            type: newRel.type,
            strength: newRel.strength,
            evidence: [event.id],
            establishedAt: event.timestamp,
            lastUpdatedAt: event.timestamp,
          };
          this.graph.relations.set(relId, relation);
          relationIds.push(relId);
        }
      }

      event.relationsUpdated = [
        ...new Set([...event.relationsUpdated, ...relationIds]),
      ];
    }

    // 5. 检查压缩触发
    if (this.ringBuffer.size >= this.config.compressionThreshold) {
      const allEvents = this.ringBuffer.toArray();
      const mode = Compressor.autoMode(allEvents.length);
      if (mode) {
        const result = this.compressor.compress(allEvents, mode);

        // 用压缩后的结果重建 RingBuffer
        this.ringBuffer.clear();
        for (const e of result.retained) {
          this.ringBuffer.push(e);
        }
      }
    }
  }

  /**
   * 按名称查找已有实体 ID（O(1) 索引查找）。
   * FIX: PERF-2 — 使用 name→id Map 替代 O(n) 线性扫描
   */
  private findExistingEntity(name: string): string | undefined {
    const nameLower = name.toLowerCase();
    // 先查索引
    const indexed = this.entityNameIndex.get(nameLower);
    if (indexed && this.graph.entities.has(indexed)) return indexed;
    // 兜底：遍历 aliases（别名不建索引以避免膨胀）
    for (const [id, entity] of this.graph.entities.entries()) {
      if (entity.aliases.some((a) => a.toLowerCase() === nameLower)) return id;
    }
    return undefined;
  }

  /**
   * 注册实体到名称索引。
   * FIX: PERF-2 — 实体创建时同步维护 name→id 索引
   */
  private registerEntityNameIndex(id: string, name: string): void {
    this.entityNameIndex.set(name.toLowerCase(), id);
  }

  /**
   * 根据置信度和事件重要性推断实体重要性。
   */
  private guessImportance(
    confidence: number,
    eventImportance: 1 | 2 | 3
  ): 1 | 2 | 3 {
    if (confidence > 0.9 && eventImportance >= 2) return 2;
    if (eventImportance === 3) return 2;
    return 1;
  }

  /**
   * 查找已有关系（同 from/to 和类型）。
   */
  private findExistingRelation(
    fromId: string,
    toId: string,
    type: string
  ): Relation | undefined {
    for (const rel of this.graph.relations.values()) {
      if (
        rel.fromEntityId === fromId &&
        rel.toEntityId === toId &&
        rel.type === type
      ) {
        return rel;
      }
    }
    return undefined;
  }

  /**
   * 限制关系强度在 0.0-1.0 范围内。
   */
  private clampStrength(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  /**
   * 收集所有未解决的悬念。
   */
  private collectUnresolvedHooks(): UnresolvedHook[] {
    const hooks: UnresolvedHook[] = [];
    const recentEvents = this.ringBuffer.peek(50);

    for (const event of recentEvents) {
      if (event.tags.includes('hook') && !event.tags.includes('resolution')) {
        hooks.push({
          id: generateUUID(),
          description: event.summary,
          relatedEntityId: event.entitiesExtracted[0] ?? '',
          createdInSessionId: event.sessionId,
          urgency: event.importance === 3 ? 3 : event.importance === 2 ? 2 : 1,
        });
      }
    }

    return hooks;
  }
}
