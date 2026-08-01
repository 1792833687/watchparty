/**
 * ContextRetriever — 上下文检索与组装
 *
 * @description
 * 从记忆图谱中检索相关记忆，组装为可直接注入 LLM prompt 的纯文本块。
 *
 * 设计决策（GDD §2.7, MEM-005）:
 * - 上下文块使用格式化纯文本而非 JSON
 * - LLM 对自然语言格式的理解优于 JSON
 * - 减少 token 浪费在结构标记上
 *
 * Token 预算控制:
 * - 默认 800 tokens（GDD §2.7）
 * - 优先级：关联实体关系 > 最近关键事件 > 上次会话摘要 > 相关世界书条目
 *
 * @see GDD §2.7, §4.2, MEM-005
 */

import type {
  EventLogEntry,
  MemoryEntity,
  MemoryEntitySnapshot,
  MemoryGraph,
  MemoryRetrievalRequest,
  MemoryRetrievalResponse,
  Relation,
  SessionMemory,
} from './types';
import { estimateTokens } from '@/lib/utils/tokenizer';

// ============================================================
// 常量
// ============================================================

/** 最近事件默认检索数量 */
const DEFAULT_RECENT_EVENTS = 5;

/** 实体摘要最大长度 */
const MAX_ENTITY_SUMMARY_LENGTH = 200;

/** token 缓冲比例（避免恰好填满） */
const TOKEN_BUFFER_RATIO = 0.85;

// ============================================================
// ContextRetriever 类
// ============================================================

export class ContextRetriever {
  /**
   * 从图谱中检索并组装上下文块。
   *
   * @param graph - 当前记忆图谱
   * @param request - 检索请求
   * @param lastSession - 上次会话摘要（可选）
   * @returns 格式化检索响应
   */
  retrieve(
    graph: MemoryGraph,
    request: MemoryRetrievalRequest,
    lastSession?: SessionMemory
  ): MemoryRetrievalResponse {
    const startTime = performance.now();
    const effectiveBudget = Math.floor(
      request.maxTokens * TOKEN_BUFFER_RATIO
    );

    // 1. 收集相关实体
    const relevantEntities = this.findRelevantEntities(graph, request);

    // 2. 收集相关事件
    const relevantEvents = this.findRelevantEvents(
      graph,
      request,
      relevantEntities
    );

    // 3. 收集相关关系
    const relevantRelations = this.findRelevantRelations(
      graph,
      relevantEntities
    );

    // 4. 组装上下文块
    let contextBlock = '';
    let remainingBudget = effectiveBudget;

    // 4a. 关联实体关系摘要（优先级最高）
    if (relevantRelations.length > 0) {
      const relationBlock = this.formatRelationBlock(
        relevantRelations,
        graph.entities
      );
      const relationTokens = estimateTokens(relationBlock);
      if (relationTokens <= remainingBudget) {
        contextBlock += relationBlock;
        remainingBudget -= relationTokens;
      } else {
        // 截断：只保留前几条关系
        const truncated = this.formatRelationBlock(
          relevantRelations.slice(0, 3),
          graph.entities
        );
        contextBlock += truncated;
        remainingBudget -= estimateTokens(truncated);
      }
    }

    // 4b. 最近关键事件
    if (relevantEvents.length > 0) {
      const eventBlock = this.formatEventBlock(
        relevantEvents.slice(0, DEFAULT_RECENT_EVENTS)
      );
      const eventTokens = estimateTokens(eventBlock);
      if (eventTokens <= Math.max(remainingBudget, 100)) {
        contextBlock += eventBlock;
        remainingBudget -= eventTokens;
      } else {
        // 截断到预算
        const truncated = this.formatEventBlock(relevantEvents.slice(0, 2));
        contextBlock += truncated;
        remainingBudget -= estimateTokens(truncated);
      }
    }

    // 4c. 上次会话摘要（如果请求且预算充足）
    if (request.includeLastSession && lastSession && remainingBudget > 100) {
      const sessionBlock = this.formatSessionBlock(lastSession);
      const sessionTokens = estimateTokens(sessionBlock);
      if (sessionTokens <= remainingBudget) {
        contextBlock += sessionBlock;
        remainingBudget -= sessionTokens;
      }
    }

    // 4d. 相关实体简要信息（如有剩余预算）
    if (relevantEntities.length > 0 && remainingBudget > 50) {
      const entityBlock = this.formatEntityBlock(relevantEntities.slice(0, 3));
      contextBlock += entityBlock;
    }

    // 构建实体快照（供 UI 侧使用）
    const entitiesCached: MemoryEntitySnapshot[] = relevantEntities
      .slice(0, 10)
      .map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        aliases: e.aliases,
        importance: e.importance,
        summary: `${e.name}(${e.type}, 出现${e.occurrenceCount}次)`,
      }));

    const retrievalTimeMs = performance.now() - startTime;

    return {
      contextBlock: contextBlock || '[无相关记忆]',
      entitiesCached,
      tokenCount: estimateTokens(contextBlock),
      retrievalMeta: {
        entitiesMatched: relevantEntities.length,
        eventsMatched: relevantEvents.length,
        relationsMatched: relevantRelations.length,
        retrievalTimeMs: Math.round(retrievalTimeMs),
      },
    };
  }

  /**
   * 直接组装上下文块（简化接口，用于 MemoryEngine 内部调用）。
   */
  assembleContextBlock(
    graph: MemoryGraph,
    request: MemoryRetrievalRequest,
    lastSession?: SessionMemory
  ): string {
    return this.retrieve(graph, request, lastSession).contextBlock;
  }

  // ---------------------------------------------------------------------------
  // Private: 检索方法
  // ---------------------------------------------------------------------------

  /**
   * 查找与当前请求相关的实体。
   * 匹配策略：名称/别名包含 query 子串，或实体 ID 在 nearbyEntities/activeQuestIds 中。
   */
  private findRelevantEntities(
    graph: MemoryGraph,
    request: MemoryRetrievalRequest
  ): MemoryEntity[] {
    const results: MemoryEntity[] = [];
    const seen = new Set<string>();
    const queryLower = request.playerInput.toLowerCase();

    // 直接匹配 nearbyEntities 和 activeQuestIds
    const directIds = new Set([
      ...request.nearbyEntities,
      ...request.activeQuestIds,
    ]);

    for (const [id, entity] of graph.entities.entries()) {
      if (!entity.isActive) continue;

      // 直接 ID 匹配
      if (directIds.has(id)) {
        results.push(entity);
        seen.add(id);
        continue;
      }

      // 位置匹配
      if (request.currentLocation) {
        const locationLower = request.currentLocation.toLowerCase();
        if (
          entity.name.toLowerCase().includes(locationLower) ||
          entity.aliases.some((a) => a.toLowerCase().includes(locationLower))
        ) {
          if (!seen.has(id)) {
            results.push(entity);
            seen.add(id);
            continue;
          }
        }
      }

      // 名称/别名模糊匹配
      if (queryLower.length > 0) {
        if (
          entity.name.toLowerCase().includes(queryLower) ||
          entity.aliases.some((a) => a.toLowerCase().includes(queryLower))
        ) {
          if (!seen.has(id)) {
            results.push(entity);
            seen.add(id);
          }
        }
      }
    }

    // 按 importance 排序
    results.sort((a, b) => b.importance - a.importance);
    return results;
  }

  /**
   * 查找相关事件。
   */
  private findRelevantEvents(
    graph: MemoryGraph,
    request: MemoryRetrievalRequest,
    relevantEntities: MemoryEntity[]
  ): EventLogEntry[] {
    const entityIds = new Set(relevantEntities.map((e) => e.id));
    const queryLower = request.playerInput.toLowerCase();

    return graph.eventLog
      .filter((event) => {
        // 实体关联匹配
        if (
          event.entitiesExtracted.some((id) => entityIds.has(id))
        ) {
          return true;
        }
        // 摘要/详情模糊匹配（仅当 query 非空）
        if (queryLower.length > 0) {
          if (
            event.summary.toLowerCase().includes(queryLower) ||
            event.detail.toLowerCase().includes(queryLower)
          ) {
            return true;
          }
        }
        return false;
      })
      .sort((a, b) => {
        // importance 降序 → 时间戳降序
        if (b.importance !== a.importance)
          return b.importance - a.importance;
        return b.timestamp - a.timestamp;
      });
  }

  /**
   * 查找相关关系。
   */
  private findRelevantRelations(
    graph: MemoryGraph,
    relevantEntities: MemoryEntity[]
  ): Relation[] {
    const entityIds = new Set(relevantEntities.map((e) => e.id));

    return Array.from(graph.relations.values()).filter(
      (rel) =>
        entityIds.has(rel.fromEntityId) || entityIds.has(rel.toEntityId)
    );
  }

  // ---------------------------------------------------------------------------
  // Private: 格式化方法
  // ---------------------------------------------------------------------------

  /**
   * 格式化关系块。
   */
  private formatRelationBlock(
    relations: Relation[],
    entities: Map<string, MemoryEntity>
  ): string {
    const lines: string[] = ['[关系摘要]'];

    for (const rel of relations) {
      const from = entities.get(rel.fromEntityId);
      const to = entities.get(rel.toEntityId);
      const fromName = from?.name ?? rel.fromEntityId;
      const toName = to?.name ?? rel.toEntityId;
      const strengthLabel =
        rel.strength > 0.7 ? '强' : rel.strength > 0.3 ? '中' : '弱';

      lines.push(
        `- ${fromName} → ${toName}: ${rel.type} (${strengthLabel}, ${rel.strength.toFixed(1)})`
      );
    }

    return lines.join('\n') + '\n\n';
  }

  /**
   * 格式化事件块。
   */
  private formatEventBlock(events: EventLogEntry[]): string {
    if (events.length === 0) return '';

    const lines: string[] = ['[最近关键事件]'];

    for (const event of events) {
      const importanceStar =
        event.importance === 3
          ? '★★★'
          : event.importance === 2
            ? '★★'
            : '★';
      const tagStr =
        event.tags.length > 0 ? ` [${event.tags.join(', ')}]` : '';
      lines.push(
        `- ${importanceStar} ${event.summary}${tagStr}`
      );
    }

    return lines.join('\n') + '\n\n';
  }

  /**
   * 格式化上次会话摘要块。
   */
  private formatSessionBlock(session: SessionMemory): string {
    const lines: string[] = ['[上次冒险回顾]'];

    if (session.keyEvents.length > 0) {
      for (const event of session.keyEvents.slice(0, 5)) {
        const prefix =
          event.importance === 3
            ? '关键'
            : event.importance === 2
              ? '重要'
              : '';
        lines.push(`- ${prefix}${event.summary}`);
      }
    }

    if (session.unresolvedHooks.length > 0) {
      lines.push('\n[未完成的线索]');
      for (const hook of session.unresolvedHooks.slice(0, 3)) {
        lines.push(`- ${hook.description}`);
      }
    }

    if (session.playerIntentGuess) {
      lines.push(`\n玩家意图推测: ${session.playerIntentGuess}`);
    }

    return lines.join('\n') + '\n\n';
  }

  /**
   * 格式化实体简要信息块。
   */
  private formatEntityBlock(entities: MemoryEntity[]): string {
    const lines: string[] = ['[相关存在]'];

    for (const entity of entities) {
      const typeLabel: Record<string, string> = {
        character: '角色',
        location: '地点',
        item: '物品',
        faction: '势力',
        event: '事件',
        concept: '概念',
        quest: '任务',
      };
      const label = typeLabel[entity.type] ?? entity.type;
      lines.push(`- ${entity.name} (${label})`);
    }

    return lines.join('\n') + '\n';
  }
}
