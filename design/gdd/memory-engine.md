# GDD: 记忆引擎 (Memory Engine)

> **子系统编号**: SYS-MEM-001  
> **作者**: 文策渊 (Vince Coyer)  
> **状态**: Draft  
> **版本**: 0.1.0  
> **依赖**: 无（独立子系统，LLM 为消费者）  
> **最后更新**: 2025-07-29

---

## 目录

1. [概述](#1-概述)
2. [机制设计](#2-机制设计)
3. [数据结构](#3-数据结构)
4. [API 契约](#4-api-契约)
5. [UI 绑定](#5-ui-绑定)
6. [边界条件](#6-边界条件)
7. [测试要点](#7-测试要点)
8. [设计理论基础](#8-设计理论基础)

---

## 1. 概述

### 1.1 子系统定位

记忆引擎是 AI Narrator Game 的**叙事连续性基础设施**。它独立于 LLM，负责从游戏会话中提取、存储、衰减、检索所有对叙事有意义的信息，并在需要时以结构化形式注入 LLM 上下文窗口。

**一句话定义**：记忆引擎是"世界的记忆宫殿"——LLM 是讲述者，记忆引擎是讲述者手中的笔记。

### 1.2 与概念支柱的映射

| 支柱 | 记忆引擎如何支撑 |
|------|-----------------|
| **支柱 I: AI 即 GM** | GM 需要记住玩家做过什么——记忆引擎提供"GM 的笔记本" |
| **支柱 II: 地图即叙事** | 区域的叙事意义（被烧毁的村庄）依赖记忆引擎持久化 |
| **支柱 III: 记忆即世界** | ★★★ 核心支柱——记忆引擎是该支柱的**全部实现** |
| **支柱 IV: 选择有重量** | 因果链追踪依赖记忆引擎；"不可撤销"依赖记忆持久化 |

### 1.3 范围分层

| 层级 | 内容 | MVP 状态 |
|------|------|---------|
| **即时记忆 (Immediate)** | 当前会话内的完整对话上下文、状态变化序列 | ✅ Must Have |
| **短期记忆 (Short-term)** | 跨会话的关键事件摘要（最近 N 次会话，默认 5 次） | ✅ Must Have |
| **长期记忆 (Long-term)** | 持久化世界状态图谱、角色关系、全局因果链 | ⬜ Should Have |

### 1.4 子系统依赖图

```
                    ┌──────────────┐
                    │  对话系统     │
                    │  (Dialogue)  │
                    └──┬───────┬───┘
                       │       │
              触发提取  │       │ 检索注入
                       ▼       ▼
                    ┌──────────────┐
                    │  记忆引擎     │
                    │  (Memory)    │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  存储层       │
                    │  localStorage│
                    │  + IndexedDB │
                    └──────────────┘
```

**上游消费者**：对话系统（注入 prompt）、地图系统（读取区域历史状态）  
**上游生产者**：对话系统（传入对话日志触发提取）  
**下游依赖**：浏览器存储 API（localStorage + IndexedDB）

---

## 2. 机制设计

### 2.1 核心数据流

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 对话系统  │───▶│ 事件日志队列  │───▶│ 实体提取器    │───▶│ 关系构建器    │
│ 产生日志  │    │ (EventLog)   │    │ (Extractor)  │    │ (GraphBuilder)│
└──────────┘    └──────────────┘    └──────────────┘    └──────┬───────┘
                                                               │
                                                               ▼
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 对话系统  │◀───│ Prompt 组装  │◀───│ 上下文检索器  │◀───│ 记忆图谱      │
│ 注入记忆  │    │ (Assembler) │    │ (Retriever)  │    │ (MemoryGraph) │
└──────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

### 2.2 三层记忆架构

#### 2.2.1 即时记忆 (Immediate Memory)

**存储内容**：当前会话的完整对话历史、事件序列、状态变化  
**存储位置**：内存（React state / Zustand store）  
**生命周期**：会话开始 → 会话结束（关闭标签页/存档时写入短期记忆）  
**容量**：无硬上限，软上限 ~200 条事件（超出后触发压缩）  
**数据结构**：`ImmediateMemoryEntry[]` — 按时间戳排序的事件数组

**即时记忆条目类型**：
- `dialogue`: 玩家与 NPC/AI GM 的对话
- `action`: 玩家执行的动作（移动、使用物品、战斗）
- `state_change`: 世界状态变化（HP 变化、关系变化、物品获取/失去）
- `discovery`: 发现新地点/新信息
- `decision`: 关键抉择节点（记录选项 + 选择 + 即时后果）

#### 2.2.2 短期记忆 (Short-term Memory)

**存储内容**：最近 N 次会话（默认 5 次）的关键事件摘要  
**存储位置**：localStorage（JSON 序列化）  
**生命周期**：跨会话持久化，FIFO 队列（第 N+1 次会话摘要挤掉最早一次）  
**容量**：每次会话最多 20 条摘要条目  
**触发时机**：会话结束时自动生成

**摘要条目结构**：
```typescript
interface ShortTermMemoryEntry {
  sessionId: string;
  startedAt: number;        // Unix ms
  endedAt: number;          // Unix ms
  summary: SessionSummary;
}

interface SessionSummary {
  keyEvents: KeyEventDigest[];    // 最多 20 条
  relationshipChanges: RelationDelta[];
  worldStateSnapshot: WorldStateDigest;  // 精简版世界状态
  unresolvedHooks: string[];      // 未解决的悬念/线索
  playerIntent: string;           // AI 推测的玩家当前意图
}

interface KeyEventDigest {
  id: string;
  type: 'decision' | 'discovery' | 'combat' | 'dialogue' | 'travel';
  summary: string;            // ≤ 140 字符摘要
  importance: 1 | 2 | 3;     // 3 = 关键转折点
  entitiesInvolved: string[]; // 参与实体 ID
  timestamp: number;
}
```

#### 2.2.3 长期记忆 (Long-term Memory) — Should Have

**存储内容**：全局世界状态图谱（实体 + 关系 + 因果链）  
**存储位置**：IndexedDB（支持索引查询 / 未来 pgvector）  
**生命周期**：永久（除非世界规则允许"遗忘"）  
**容量**：无硬上限，预期 < 50MB 序列化数据  
**MVP 替代方案**：短期记忆 + 完整世界状态 JSON 存档提供足够的叙事连续性

### 2.3 记忆压缩策略

当即时记忆条目超过软上限（200 条）时触发压缩：

```
压缩算法 (Compression Pipeline):
1. 按 importance 排序（decision > discovery > combat > dialogue > travel > state_change）
2. 低重要性条目 (importance=1) 合并：连续同类型/同实体的条目合并为一条摘要
3. 旧条目 (超过 50 条新事件之前) 的高重要性条目保留原文，但元数据精简
4. 压缩后目标: ≤ 80 条即时记忆条目
5. 被压缩的条目写入短期记忆的"详细日志"槽位（最多保留 50 条被压缩条目）
```

### 2.4 记忆衰减模型

**当前不实现记忆衰减**（MVP 内所有记忆权重相等）。

**Should Have 阶段衰减规则**（仅供参考，不实现）：
- 基础权重 = importance × recency_factor
- recency_factor = e^(-λ × days_since_event)，λ = 0.05（半衰期 ~14 天）
- 被其他记忆引用的条目获得 +20% 权重
- "遗忘"不是删除，而是权重低于阈值的条目在检索时不被返回

### 2.5 实体提取 Schema

```typescript
// 实体提取器从对话日志中提取的结构
interface ExtractedEntity {
  name: string;               // 实体名称
  type: EntityType;
  attributes: Record<string, string | number | boolean>;
  confidence: number;         // 0.0 ~ 1.0（提取置信度）
  sourceEventId: string;      // 首次提取来源事件
}

type EntityType = 
  | 'character'    // NPC 或玩家
  | 'location'     // 地点
  | 'item'         // 物品
  | 'faction'      // 派系/组织
  | 'event'        // 重大事件
  | 'concept'      // 抽象概念（魔法规则、文化习俗等）
  | 'quest';       // 任务/目标
```

### 2.6 关系类型枚举

```typescript
type RelationType =
  // 社交关系
  | 'ALLY'        // 盟友
  | 'ENEMY'       // 敌对
  | 'NEUTRAL'     // 中立
  | 'FRIEND'      // 友好
  | 'LOVER'       // 爱恋
  | 'FAMILY'      // 亲属
  | 'RIVAL'       // 竞争
  | 'MENTOR'      // 导师
  | 'STUDENT'     // 学生
  // 空间关系
  | 'LOCATED_AT'  // 位于
  | 'ORIGIN_OF'   // 来自
  // 从属关系
  | 'PART_OF'     // 属于（组织/派系）
  | 'OWNS'        // 拥有
  | 'OWED_BY'     // 被拥有
  // 因果/事件关系
  | 'CAUSED_BY'   // 由…导致
  | 'TRIGGERED'   // 触发了
  | 'KNOWS_OF';   // 知晓（信息不对称）

interface Relation {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type: RelationType;
  strength: number;           // 0.0 ~ 1.0
  evidence: string[];         // 来源事件 ID 列表
  establishedAt: number;      // Unix ms
  lastUpdatedAt: number;
}
```

### 2.7 上下文窗口注入策略

每次 LLM 调用前，记忆引擎检索并组装以下上下文块：

```
Context Window Layout (优先级从高到低):

┌──────────────────────────────────────────┐
│ 1. System Prompt (固定，~500 tokens)     │  ← 对话系统提供
├──────────────────────────────────────────┤
│ 2. World Context (~300 tokens)           │  ← 当前区域 + 邻近 POI + 时间
├──────────────────────────────────────────┤
│ 3. Memory Context (~800 tokens)          │  ← 记忆引擎注入 ★
│    ├─ 当前关联实体的关系摘要              │
│    ├─ 最近 5 条即时记忆关键事件           │
│    ├─ 上次会话摘要（如有）                │
│    └─ 相关世界书条目（如有匹配）          │
├──────────────────────────────────────────┤
│ 4. Session Context (~1500 tokens)        │  ← 最近 N 条对话 (即时记忆)
├──────────────────────────────────────────┤
│ 5. Current Input (variable)              │  ← 玩家输入 + 当前页面状态
└──────────────────────────────────────────┘

总预算: ~4000 tokens (上下文窗口) + ~2000 tokens (响应预算)
MVP 模型最低上下文窗口: 8K tokens (GPT-4o / Claude 3.5 均满足)
```

### 2.8 状态机

```
                    ┌──────────┐
                    │   IDLE   │
                    └────┬─────┘
                         │
              对话系统推送事件日志
                         │
                         ▼
                    ┌──────────┐
                    │EXTRACTING│────── 实体提取 (LLM 调用或规则引擎)
                    └────┬─────┘
                         │
                         ▼
                    ┌──────────┐
                    │ BUILDING │────── 关系构建 + 图谱更新
                    └────┬─────┘
                         │
                         ▼
                    ┌──────────┐
                    │  IDLE    │
                    └────┬─────┘
                         │
              对话系统请求上下文
                         │
                         ▼
                    ┌──────────┐
                    │RETRIEVING│────── 检索相关记忆
                    └────┬─────┘
                         │
                         ▼
                    ┌──────────┐
                    │ASSEMBLING│────── 组装 prompt 上下文块
                    └────┬─────┘
                         │
                         ▼
                    ┌──────────┐
                    │  IDLE    │
                    └──────────┘

额外触发:
  会话结束 → COMPRESSING (生成短期记忆摘要) → IDLE
  会话开始 → RESTORING (加载短期记忆) → IDLE
```

---

## 3. 数据结构

### 3.1 核心 TypeScript 接口

```typescript
// ============================================================
// 记忆图谱 (MemoryGraph) — 核心数据结构
// ============================================================

interface MemoryGraph {
  version: string;                  // 图谱格式版本 (如 "1.0.0")
  entities: Map<string, MemoryEntity>;
  relations: Map<string, Relation>;
  eventLog: EventLogEntry[];
  metadata: GraphMetadata;
}

interface MemoryEntity {
  id: string;                       // UUID v4
  name: string;
  type: EntityType;
  aliases: string[];                // 别名/曾用名
  attributes: Record<string, unknown>;
  firstSeenAt: number;              // Unix ms
  lastSeenAt: number;
  occurrenceCount: number;          // 在事件日志中出现的次数
  importance: 1 | 2 | 3;           // 综合重要性评分
  isActive: boolean;                // 是否活跃（非"遗忘"状态）
}

interface GraphMetadata {
  totalSessions: number;
  currentSessionId: string;
  createdAt: number;
  lastUpdatedAt: number;
  worldName: string;
  gameSettingId: string;
}

// ============================================================
// 事件日志
// ============================================================

interface EventLogEntry {
  id: string;                       // UUID v4
  sessionId: string;
  type: EventType;
  timestamp: number;
  importance: 1 | 2 | 3;
  summary: string;                  // ≤ 140 chars
  detail: string;                   // 完整描述
  entitiesExtracted: string[];      // 关联实体 ID
  relationsUpdated: string[];       // 关联关系 ID
  tags: EventTag[];
  precedingEventId: string | null;  // 前驱事件（因果链）
}

type EventType = 
  | 'dialogue' 
  | 'action' 
  | 'state_change' 
  | 'discovery' 
  | 'decision'
  | 'combat'
  | 'travel';

type EventTag = 
  | 'golden'     // 关键选择
  | 'danger'     // 危险
  | 'magic'      // 魔法/神秘
  | 'hook'       // 悬念/未解决
  | 'resolution' // 已解决
  | 'betrayal';  // 背叛/转折

// ============================================================
// 短期记忆
// ============================================================

interface SessionMemory {
  sessionId: string;
  startedAt: number;
  endedAt: number | null;           // null = 会话进行中
  keyEvents: KeyEventDigest[];
  relationshipDeltas: RelationDelta[];
  worldStateDigest: WorldStateDigest;
  unresolvedHooks: UnresolvedHook[];
  playerIntentGuess: string;
}

interface KeyEventDigest {
  id: string;
  eventLogId: string;
  type: EventType;
  summary: string;                  // ≤ 140 chars
  importance: 1 | 2 | 3;
  entitiesInvolved: string[];
  tags: EventTag[];
  timestamp: number;
}

interface RelationDelta {
  relationId: string;
  fromEntityId: string;
  toEntityId: string;
  type: RelationType;
  strengthBefore: number;
  strengthAfter: number;
  reason: string;                   // 变化原因摘要
}

interface WorldStateDigest {
  playerLocation: string;           // 区域 ID
  playerHp: number;
  playerMp: number;
  activeQuests: string[];           // quest entity IDs
  factionStandings: Record<string, number>; // factionId → standing (-100 to 100)
  inventorySummary: string[];       // 物品名称列表（非完整数据）
}

interface UnresolvedHook {
  id: string;
  description: string;
  relatedEntityId: string;
  createdInSessionId: string;
  urgency: 1 | 2 | 3;              // 3 = 迫在眉睫
}

// ============================================================
// 上下文检索请求/响应
// ============================================================

interface MemoryRetrievalRequest {
  currentLocation: string;          // 当前区域 ID
  nearbyEntities: string[];         // 邻近实体 ID
  activeQuestIds: string[];
  playerInput: string;              // 玩家当前输入（用于相关性匹配）
  maxTokens: number;                // 分配给记忆上下文的 token 预算
  includeLastSession: boolean;      // 是否注入上次会话摘要
}

interface MemoryRetrievalResponse {
  contextBlock: string;             // 可直接注入 prompt 的格式化文本
  entitiesCached: MemoryEntitySnapshot[];  // 本轮关联实体（供 UI 侧使用）
  tokenCount: number;               // 上下文块 token 估算
  retrievalMeta: {
    entitiesMatched: number;
    eventsMatched: number;
    relationsMatched: number;
    retrievalTimeMs: number;
  };
}

interface MemoryEntitySnapshot {
  id: string;
  name: string;
  type: EntityType;
  aliases: string[];
  importance: 1 | 2 | 3;
  summary: string;                  // 一段话描述
}
```

### 3.2 存储布局

```
IndexedDB: "memory-engine"
├── ObjectStore: "memoryGraph"
│   └── key: "current" → MemoryGraph (完整图谱)
├── ObjectStore: "sessionMemories"
│   └── key: sessionId → SessionMemory
└── ObjectStore: "archivedGraphs"
    └── key: timestamp → MemoryGraph (存档快照)

localStorage: "memory-engine-meta"
├── key: "currentSessionId" → string
├── key: "sessionCount" → number
└── key: "compressionLog" → CompressionLogEntry[]
```

---

## 4. API 契约

### 4.1 记忆引擎内部 API

```typescript
// ============================================================
// MemoryEngine — 主接口
// ============================================================

interface IMemoryEngine {
  // --- 生命周期 ---
  /** 初始化引擎：从 IndexedDB 加载图谱，创建新会话 */
  init(config: MemoryEngineConfig): Promise<void>;
  
  /** 销毁引擎：压缩即时记忆 → 短期记忆，写入 IndexedDB */
  shutdown(): Promise<void>;

  // --- 事件摄入 ---
  /** 摄入新事件日志条目（由对话系统/地图系统推送） */
  ingest(event: EventLogEntry): Promise<void>;
  
  /** 批量摄入 */
  ingestBatch(events: EventLogEntry[]): Promise<void>;

  // --- 上下文检索 ---
  /** 检索相关记忆，返回格式化上下文块 */
  retrieveForContext(req: MemoryRetrievalRequest): Promise<MemoryRetrievalResponse>;

  // --- 实体与关系 ---
  /** 按 ID 获取实体 */
  getEntity(id: string): MemoryEntity | undefined;
  
  /** 按名称模糊搜索实体 */
  searchEntities(query: string, limit?: number): MemoryEntity[];
  
  /** 获取两个实体之间的关系 */
  getRelation(fromId: string, toId: string): Relation | undefined;
  
  /** 获取某实体的所有关系 */
  getEntityRelations(entityId: string): Relation[];

  // --- 会话管理 ---
  /** 获取上次会话摘要（用于会话恢复） */
  getLastSessionSummary(): SessionMemory | undefined;
  
  /** 获取当前会话的事件数 */
  getCurrentSessionEventCount(): number;

  // --- 查询 ---
  /** 获取所有未解决的悬念 */
  getUnresolvedHooks(): UnresolvedHook[];
  
  /** 导出完整图谱（用于存档） */
  exportGraph(): MemoryGraph;
}

interface MemoryEngineConfig {
  maxImmediateEvents: number;       // 默认 200
  shortTermSessionLimit: number;    // 默认 5
  compressionThreshold: number;     // 默认 200
  enableLongTerm: boolean;          // MVP: false
}
```

### 4.2 与对话系统的接口

```typescript
// 对话系统 → 记忆引擎：推送事件
// 每次对话轮次结束后调用
memoryEngine.ingest({
  id: crypto.randomUUID(),
  sessionId: currentSessionId,
  type: 'dialogue',
  timestamp: Date.now(),
  importance: 2,
  summary: '玩家在古老橡树处与守卫队长交谈',
  detail: '玩家询问了关于失踪商队的信息。守卫队长提到最近森林里出现了奇怪的嚎叫声...',
  entitiesExtracted: ['ent_guard_captain', 'ent_ancient_oak', 'ent_missing_caravan'],
  relationsUpdated: ['rel_player_guard_trust'],
  tags: ['hook'],
  precedingEventId: 'evt_00123'
});

// 记忆引擎 → 对话系统：提供上下文
// 每次 prompt 组装前调用
const memoryCtx: MemoryRetrievalResponse = await memoryEngine.retrieveForContext({
  currentLocation: 'region_dark_forest',
  nearbyEntities: ['ent_ancient_oak', 'ent_wolf_den'],
  activeQuestIds: ['quest_missing_caravan'],
  playerInput: '我想去狼穴看看',
  maxTokens: 800,
  includeLastSession: true
});

// memoryCtx.contextBlock 直接注入 prompt 的 memory_context 层
```

### 4.3 与地图系统的接口

```typescript
// 地图系统 → 记忆引擎：查询区域历史
const regionEntities = memoryEngine.searchEntities('dark_forest', 10);
// 返回该区域相关的所有实体（NPC、事件、物品）

// 地图系统 → 记忆引擎：推送探索事件
memoryEngine.ingest({
  // ... type: 'discovery', 发现新区域时
});

// 记忆引擎 → 地图系统：区域状态
// 地图系统通过 getEntityRelations(regionId) 获取
// LOCATED_AT 关系，判断哪些 NPC/物品位于该区域
```

---

## 5. UI 绑定

### 5.1 与美术圣经的映射

| 记忆引擎功能 | 美术圣经引用 | UI 元素 |
|-------------|-------------|---------|
| 会话恢复摘要 | §4.3 会话恢复摘要面板 | 入场阶段的 Recap 面板，5 条关键记忆卡片 |
| 世界状态面板 | 概念锚点 C "记忆之网" | React Flow 关系图谱，暗色背景 + 高亮连线 |
| 记忆时间线 | 概念锚点 C 水平滚动时间轴 | 水平滚动，关键事件以节点标记 |
| 世界书条目 | 概念锚点 C 卡片列表 | 卡片列表，已解锁条目有插图占位 |
| 日志更新动画 | §5.3 面板切换 200ms ease-out | 新记忆条目滑入动画 |
| 颜色编码 | §3.1 暗色主题 | accent-gold (玩家相关), accent-magic (AI/知识) |
| 排版 | §4.2 text-small (14px) 用于摘要条目 | 记忆卡片使用 text-small |

### 5.2 关键屏幕：会话恢复面板

```
┌─────────────────────────────────────────┐
│  📜 上次冒险回顾                [展开全部] │  ← 标题 text-h2
├─────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 🗡️ 你在黑暗森林击败了狼王          │   │  ← importance=3, golden 边框
│  │    ── 守卫队长对你好感上升          │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 🔍 发现了失踪商队的线索            │   │  ← importance=2
│  │    ── 商队的货物被运往北方洞穴     │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ ⚠️ 未完成的线索：奇怪的嚎叫声      │   │  ← hook tag, danger 边框
│  │    ── 嚎叫声似乎来自狼穴方向       │   │
│  └──────────────────────────────────┘   │
│                                          │
│              [继续冒险 →]                │
└─────────────────────────────────────────┘
```

### 5.3 世界状态图谱（Should Have）

```
React Flow 实现:
  - 当前角色居中，avatar 48px
  - 节点大小 = 15px + importance × 10px
  - 连线颜色: ALLY=accent-success, ENEMY=accent-danger, NEUTRAL=text-muted
  - 连线宽度 = 1px + strength × 4px
  - hover 节点 → 显示 mini 信息卡
  - 点击节点 → 跳转到世界书条目
```

---

## 6. 边界条件

### 6.1 错误处理

| 场景 | 处理策略 | 降级方案 |
|------|---------|---------|
| IndexedDB 不可用（隐私模式） | 回退到 localStorage（容量限制 ~5-10MB） | 如 localStorage 也不可用，内存模式（仅即时记忆，刷新丢失） |
| localStorage 满 | 触发紧急压缩：删除最早的短期记忆会话，importance=1 的事件优先丢弃 | 提示玩家清理存档 |
| 实体提取 LLM 调用失败 | 回退到规则引擎（正则 + 关键词匹配）提取实体 | 标记提取置信度为 0，仅保留原文引用 |
| 图谱序列化超过 IndexedDB 限制 | 分片存储（entity / relation / event 各一个 ObjectStore） | 压缩旧事件为摘要 |
| 上下文检索超时（>500ms） | 返回简化上下文（仅当前会话关键事件，跳过图谱查询） | 降级标记写入日志 |
| 图谱数据损坏 | 校验版本号 + checksum，损坏时从最近存档恢复 | 无存档则重建（损失部分历史） |

### 6.2 极限情况

| 极限 | 阈值 | 行为 |
|------|------|------|
| 单次会话事件数 > 500 | 触发激进压缩（目标 ≤ 100 条） | importance < 3 的旧事件合并为摘要 |
| 实体总数 > 1000 | 重要性衰减：importance=1 且 30 天未出现的实体标记为 inactive | 不删除，仅检索时不返回 |
| 关系总数 > 5000 | 合并弱关系：strength < 0.15 的同类型关系合并 | 影响图谱可视化性能 |
| 短期记忆会话 > 10 | 强制保留最后 5 次，其余写入"归档"（仅在存档中保留） | 归档数据可在设置中清除 |
| 图谱加载 > 3 秒 | 显示骨架屏 + 异步加载，优先恢复即时记忆 → 短期记忆 → 长期记忆 | 加载期间对话系统使用最小上下文 |

### 6.3 并发与一致性

- **单线程模型**：记忆引擎运行在主线程，所有操作串行化（JavaScript 单线程保证）
- **ingest 和 retrieve 竞态**：同一时刻只能有一个 ingest 或 retrieve 进行中。retrieve 会等待 ingest 完成。使用简单的 Promise 队列。
- **存档一致性**：shutdown() 期间不接受新的 ingest。存档时图谱快照原子写入（write → verify → commit）。

### 6.4 MVP 降级说明

MVP 阶段不实现：
- **向量检索**（pgvector/BGE）：用正则 + 关键词 + 实体 ID 精确匹配替代
- **长期记忆图谱**：短期记忆摘要 + 完整世界状态存档覆盖叙事连续性需求
- **记忆衰减**：所有记忆权重相等
- **因果链推理**：仅记录 precedingEventId，不做自动因果推断

---

## 7. 测试要点

### 7.1 单元测试场景（给严守真）

| 测试 ID | 测试场景 | 前置条件 | 预期结果 |
|---------|---------|---------|---------|
| MEM-UT-01 | 摄入单条对话事件 | 空图谱 | 事件存入 eventLog，实体自动提取 |
| MEM-UT-02 | 实体去重 | 图谱中已有 "守卫队长" | 摄入同名实体 → 更新已有的 entity，occurrenceCount +1 |
| MEM-UT-03 | 关系强度更新 | 已有 REL: player→guard_captain (strength=0.3) | 摄入新正面交互 → strength 上升至 0.5 |
| MEM-UT-04 | 压缩触发 | 即时记忆 201 条 | 自动压缩至 ≤ 80 条，低重要性条目合并 |
| MEM-UT-05 | 短期记忆生成 | 会话结束调用 shutdown() | 产生 ≤ 20 条 KeyEventDigest 的 SessionMemory |
| MEM-UT-06 | FIFO 会话管理 | 已有 5 次会话的短期记忆 | 第 6 次会话结束 → 最早一次被移除 |
| MEM-UT-07 | 上下文检索相关性 | 当前区域 "黑暗森林"，搜索 "狼" | 返回与 "狼" 相关的实体和事件 |
| MEM-UT-08 | 检索 token 预算控制 | maxTokens=300 | 返回的 contextBlock 不超过 ~350 tokens（含 buffer） |

### 7.2 集成测试场景

| 测试 ID | 测试场景 | 涉及系统 | 预期结果 |
|---------|---------|---------|---------|
| MEM-INT-01 | 对话 → 记忆 → 注入循环 | 对话系统 + 记忆引擎 | 对话触发提取，下一次 AI 回应引用之前的记忆 |
| MEM-INT-02 | 跨会话记忆恢复 | 存档 + 记忆引擎 | 关闭重开后，AI GM 能引用上次会话的关键事件 |
| MEM-INT-03 | 地图探索 → 记忆记录 | 地图系统 + 记忆引擎 | 发现新区域后，记忆引擎记录 discovery 事件 |
| MEM-INT-04 | 大量事件后性能 | 记忆引擎（单系统） | 1000 条事件时检索 < 100ms |

### 7.3 边缘测试场景

| 测试 ID | 测试场景 | 预期行为 |
|---------|---------|---------|
| MEM-EDGE-01 | 隐私模式浏览器 | 降级到内存模式，提示用户数据不会持久化 |
| MEM-EDGE-02 | localStorage 配额耗尽 | 触发紧急压缩，丢弃旧数据，提示用户 |
| MEM-EDGE-03 | 空图谱首次启动 | 正常初始化，无报错，返回空上下文 |
| MEM-EDGE-04 | 实体提取无结果 | 事件正常存储，entitiesExtracted 为空数组 |
| MEM-EDGE-05 | 图谱数据损坏 | 检测到版本不匹配/checksum 失败 → 重建 |

---

## 8. 设计理论基础

### 8.1 为什么记忆引擎是独立子系统

**核心论点**：LLM 的上下文窗口是**稀缺且昂贵的资源**。将记忆管理委托给外部系统是 AI-native 游戏的基本架构原则。

| 方案 | 优点 | 缺点 | 判定 |
|------|------|------|------|
| **全塞 prompt** (Open Dungeon) | 实现简单 | 成本线性增长、token 浪费、8K 窗口不够用 | ❌ 不可扩展 |
| **LLM 自行记忆** (依赖模型内化) | 零开发成本 | 幻觉、不可控、不可审计 | ❌ 不可靠 |
| **独立记忆引擎** (本方案) | 可控、可审计、可优化 | 开发成本高、需要提取逻辑 | ✅ 唯一正确方案 |

### 8.2 三层架构的理论依据

三层架构借鉴认知心理学中的**记忆多存储模型** (Atkinson-Shiffrin, 1968)：

- **即时记忆** ↔ 感官记忆/工作记忆：容量有限，信息鲜活但短暂
- **短期记忆** ↔ 短期记忆：经过编码和筛选，跨时间保持
- **长期记忆** ↔ 长期记忆：永久存储，通过检索线索访问

这一映射让记忆系统的行为对玩家"直觉可理解"——遗忘不是 bug，而是符合心智模型的设计。

### 8.3 竞品参考

| 竞品 | 借鉴点 | 差异点 |
|------|--------|--------|
| **RPG Roleplay Platform** | BM25 + pgvector 混合检索；世界书与记忆图谱共存 | 我们用更轻量的规则引擎做 MVP 实体提取，不引入向量数据库依赖 |
| **Narratium.ai** | Worldbook 的可视化管理；条目之间的交叉引用 | 我们强调 AI GM 主动管理记忆而非玩家手动编辑 Worldbook |
| **intra-game** | 结构化游戏状态作为 LLM 约束 | 我们的记忆图谱是他们的"结构化状态"的超集——包含关系和因果链 |
| **AIDungeon** | 简单的"记忆"和"世界信息"字段 | 我们不做纯文本记忆块，而是结构化图谱，支持精确检索 |
| **Disco Elysium** | 思维阁 (Thought Cabinet) 的概念——内化的想法影响对话 | 借鉴"想法内化"机制到 Should Have 阶段（记忆条目可被玩家"反思"升级重要性） |

### 8.4 设计决策记录

| 决策 ID | 决策 | 理由 | 日期 |
|---------|------|------|------|
| MEM-001 | 实体提取优先使用规则引擎，LLM 辅助 | MVP 不依赖额外 LLM 调用的延迟和成本；LLM 提取在 Should Have 作为增强 | 2025-07-29 |
| MEM-002 | 短期记忆存 localStorage 而非 IndexedDB | 短期记忆数据量小（< 100KB），localStorage 同步读取更快，适合会话恢复的快速加载 | 2025-07-29 |
| MEM-003 | 不做记忆衰减（MVP） | 减少复杂度；MVP 记忆总量可控（单次会话 + 5 次历史摘要） | 2025-07-29 |
| MEM-004 | importance 1-3 三级制而非连续值 | 便于 LLM prompt 中的优先级排序（"以下是关键事件…以下是次要事件…"），减少决策疲劳 | 2025-07-29 |
| MEM-005 | 上下文块使用格式化纯文本而非 JSON | LLM 对自然语言格式的理解优于 JSON；减少 token 浪费在结构标记上 | 2025-07-29 |

### 8.5 理论红线检查

| 红线 | 状态 |
|------|------|
| 杜绝"把整个历史塞进 prompt" | ✅ 上下文检索按需注入，token 预算可控 |
| 记忆引擎是独立子系统 | ✅ LLM 通过 API 消费记忆，不直接写入 |
| 遗忘具有叙事意义 | ✅ isActive 标记 + 未来衰减模型支持"魔法遗忘"叙事 |

---

> **下一步**: 本文档与对话系统 GDD 和地图系统 GDD 进行交叉评审，确保接口对齐。
