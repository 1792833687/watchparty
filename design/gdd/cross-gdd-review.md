# 跨系统一致性评审报告 (Cross-GDD Review)

> **评审人**: 文策渊 (Vince Coyer)  
> **评审范围**: `memory-engine.md` / `dialogue-system.md` / `map-system.md`  
> **评审日期**: 2025-07-29  
> **评审方法**: 逐接口对比 + 命名一致性扫描 + 状态流分析 + 支柱对齐检查

---

## 目录

1. [接口一致性检查](#1-接口一致性检查)
2. [数据结构命名一致性](#2-数据结构命名一致性)
3. [状态流分析](#3-状态流分析)
4. [概念支柱对齐检查](#4-概念支柱对齐检查)
5. [发现的问题与修复](#5-发现的问题与修复)
6. [评审结论](#6-评审结论)

---

## 1. 接口一致性检查

### 1.1 记忆引擎 ↔ 对话系统

| 检查项 | 记忆引擎 GDD | 对话系统 GDD | 一致性 |
|--------|------------|------------|--------|
| `ingest()` 调用签名 | `ingest(event: EventLogEntry): Promise<void>` | 对话系统侧调用 `memoryEngine.ingest({...})` | ✅ 一致 |
| `EventLogEntry` 字段 | `id, sessionId, type, timestamp, importance, summary, detail, entitiesExtracted, relationsUpdated, tags, precedingEventId` | 对话系统填充所有字段 | ✅ 一致 |
| `retrieveForContext()` 请求 | `MemoryRetrievalRequest: {currentLocation, nearbyEntities, activeQuestIds, playerInput, maxTokens, includeLastSession}` | 对话系统传入 `currentLocation` (来自 worldState), `nearbyEntities` (来自 mapSystem), `activeQuestIds` (来自 worldState), `playerInput`, `maxTokens: 800` | ✅ 一致 |
| `retrieveForContext()` 响应 | `MemoryRetrievalResponse: {contextBlock, entitiesCached, tokenCount, retrievalMeta}` | 对话系统使用 `memoryCtx.contextBlock` 注入 prompt | ✅ 一致 |
| Session ID 来源 | 记忆引擎维护 `currentSessionId` | 对话系统使用相同的 session ID (`dialogueSession.id = 游戏 session ID`) | ✅ 一致 |
| 触发时机 | 对话系统在 AI 消息解析后调用 ingest | 对话系统 GDD §2.6 流程图标注"同时触发记忆引擎 ingest()" | ✅ 一致 |

**结论**: 记忆引擎 ↔ 对话系统接口完全对齐，无矛盾。

---

### 1.2 地图系统 ↔ 对话系统

| 检查项 | 地图系统 GDD | 对话系统 GDD | 一致性 |
|--------|------------|------------|--------|
| 事件触发桥接 | `mapSystem.onTileEvent()` → `dialogueSystem.sendMessage()` | 对话系统接收 `PlayerInput` with `metadata.clickedTileId` | ✅ 一致 |
| AI GM 主动叙述 | 地图传空文本 `text: ''` | 对话系统边缘测试 DLG-EDGE-01: 空输入 → AI GM 主动叙述 | ✅ 一致 |
| 位置更新方向 | 对话系统解析 `stateDelta.locationChange` → `mapSystem.moveTo()` | 对话系统 GDD §4.3 有此接口 | ✅ 一致 |
| `getNearbyEntities()` | 地图系统提供此方法 | 对话系统调用以构建 World Context | ✅ 一致(地图系统 GDD §4.1 定义) |

**结论**: 地图系统 ↔ 对话系统接口完全对齐，无矛盾。

---

### 1.3 地图系统 ↔ 记忆引擎

| 检查项 | 地图系统 GDD | 记忆引擎 GDD | 一致性 |
|--------|------------|------------|--------|
| 探索事件摄入 | 地图系统推送 `type: 'discovery'` 的 EventLogEntry | 记忆引擎 `EventType` 包含 `'discovery'` | ✅ 一致 |
| 区域历史查询 | 地图系统调用 `memoryEngine.searchEntities(region.name)` | 记忆引擎提供 `searchEntities(query, limit)` | ✅ 一致 |
| 实体 ID 对应 | MapEntity.id 与 MemoryEntity.id 对应 | 两者都使用 UUID v4 | ✅ 一致 |

**结论**: 地图系统 ↔ 记忆引擎接口完全对齐，无矛盾。

---

### 1.4 三系统三角接口汇总

```
        记忆引擎
          ▲   │
  ingest  │   │ retrieveForContext
          │   ▼
  地图系统 ◀──▶ 对话系统
   onTileEvent / moveTo
```

**所有接口调用链均无死胡同**。每个系统都有明确的消费者和生产者角色。

---

## 2. 数据结构命名一致性

### 2.1 核心类型名扫描

| 概念 | 记忆引擎 GDD | 对话系统 GDD | 地图系统 GDD | 一致性 |
|------|------------|------------|------------|--------|
| 实体类型枚举 | `EntityType` | — （不重复定义，引用记忆引擎） | `MapEntityType` | ⚠️ **见问题 #1** |
| 关系类型 | `RelationType` (ALLY, ENEMY, …) | — | — | ✅ 单一来源 |
| Session ID | `sessionId: string` | `id: string` (= session ID) | — | ✅ 一致 |
| 叙事状态标签 | `EventTag` (golden, danger, magic, …) | `NarrativeTag` (golden_choice, danger_zone, magic_moment, …) | — | ⚠️ **见问题 #2** |
| 世界状态摘要 | `WorldStateDigest` | — | `MapState` | ✅ 不同用途，无冲突 |
| 坐标类型 | — | — | `TileCoord: {col, row}` | ✅ 地图系统独有 |
| 迷雾状态 | — | — | `FogState` | ✅ 地图系统独有 |
| LLM 请求 | — | `LLMRequest` / `LLMResponse` | — | ✅ 对话系统独有 |
| 决策节点 | — | `DecisionNode` / `DecisionOption` | — | ✅ 对话系统独有 |
| 建议动作 | — | `SuggestedAction` | — | ✅ 对话系统独有 |

### 2.2 ID 命名约定

| ID 类型 | 格式 | 使用系统 | 一致性 |
|---------|------|---------|--------|
| 实体 ID | UUID v4 | 记忆引擎 + 地图系统 | ✅ 统一 |
| 事件 ID | UUID v4 | 记忆引擎 | ✅ |
| Session ID | UUID v4 | 记忆引擎 + 对话系统 | ✅ 统一 |
| 区域 ID | `region_*` | 地图系统 | ✅ 独立命名空间 |
| 决策节点 ID | UUID v4 | 对话系统 | ✅ |

---

## 3. 状态流分析

### 3.1 主循环状态流

```
玩家点击地图 (地图系统)
       │
       ▼
  移动动画 (地图系统)
       │
       ▼
  到达目的地 → 触发事件 (地图系统)
       │
       ▼
  AI GM 叙述 (对话系统 ──→ 记忆引擎: 检索上下文)
       │
       ▼
  玩家输入 (对话系统)
       │
       ▼
  LLM 生成 (对话系统)
       │
       ▼
  流式输出 + 状态更新 (对话系统)
       │
       ├──→ 记忆引擎: ingest 事件
       │
       └──→ 地图系统: 如有位置变化 → moveTo
                    │
                    └──→ 回到循环顶部
```

**死锁检查**: 无循环依赖。每个步骤的输出明确指向下一步的输入。

### 3.2 记忆引擎状态机检查

```
IDLE → EXTRACTING → BUILDING → IDLE
IDLE → RETRIEVING → ASSEMBLING → IDLE
IDLE → COMPRESSING → IDLE
IDLE → RESTORING → IDLE
```

- **无死锁**: 所有状态都有明确的出边回到 IDLE
- **无活锁**: 每个操作都是有限步骤
- **状态互斥**: ingest 和 retrieve 通过 Promise 队列串行化，不会交错执行

### 3.3 对话系统状态流转

```
NarrativeState 流转:
exploration → conversation (与 NPC 交谈)
exploration → tension (AI GM 引入冲突)
tension → climax (关键抉择点)
climax → resolution (抉择后消化)
resolution → exploration (回到探索)
exploration → combat (遭遇敌人)
combat → resolution (战斗结束)
exploration → resting (玩家休息)
resting → exploration (休息结束)
```

- **无死锁**: 所有状态可通过一种或多种路径回到 exploration
- **无不合理跃迁**: 每条跃迁路径都有明确的叙事触发条件

### 3.4 跨系统状态一致性

| 共享状态 | 数据源 | 消费者 | 更新机制 |
|---------|--------|--------|---------|
| 玩家位置 | 地图系统 (MapState.playerCoord) | 记忆引擎 (作为检索锚点)、对话系统 (注入 World Context) | 地图系统 moveTo → 写入 MapState |
| NPC 关系 | 记忆引擎 (Relation) | 对话系统 (注入 Memory Context) | 对话系统 ingest → 记忆引擎更新 |
| 叙事状态 | 对话系统 (NarrativeState) | UI (影响面板样式) | AI 回应解析 → 对话系统更新 |
| 迷雾状态 | 地图系统 (FogState per Tile) | 渲染层 | 移动 → 地图系统 revealFog |

**无循环依赖**: 每个共享状态有唯一的写入者 (single source of truth)。

---

## 4. 概念支柱对齐检查

### 4.1 支柱 I: AI 即 GM

| GDD | 如何体现 | 对齐度 |
|-----|---------|--------|
| 记忆引擎 | "GM 的笔记本"——记忆引擎是 GM 保持叙事连贯性的工具 | ✅ |
| 对话系统 | System prompt 定义 GM 身份 + 行为规则；主动引导、说"不"的边界；节奏控制 | ✅✅✅ |
| 地图系统 | AI 根据玩家位置注入空间上下文；地图是 GM 布置剧情的画布 | ✅ |

**总评**: 支柱 I 的核心承载者是对话系统（GM 的行为实现），记忆引擎和地图系统提供支撑数据。

### 4.2 支柱 II: 地图即叙事

| GDD | 如何体现 | 对齐度 |
|-----|---------|--------|
| 记忆引擎 | 区域叙事状态通过记忆引擎持久化 | ✅ |
| 对话系统 | 空间上下文注入 prompt；地图事件触发对话 | ✅ |
| 地图系统 | 每个 Tile 有 narrative description + events[]；Region 有 ambientNarrative；空间关系编码叙事 | ✅✅✅ |

**总评**: 支柱 II 的核心承载者是地图系统。所有图块数据模型都包含叙事字段，远离"装饰性地形"红线。

### 4.3 支柱 III: 记忆即世界

| GDD | 如何体现 | 对齐度 |
|-----|---------|--------|
| 记忆引擎 | 三层架构；实体提取 + 关系构建 + 上下文检索；独立于 LLM | ✅✅✅ |
| 对话系统 | 每次对话后自动推送事件到记忆引擎；prompt 组装中注入记忆上下文 | ✅ |
| 地图系统 | 探索事件和地图状态变化推送到记忆引擎 | ✅ |

**总评**: 支柱 III 的核心承载者是记忆引擎。其他两个系统正确地作为"数据生产者"和"数据消费者"接入。

### 4.4 支柱 IV: 选择有重量

| GDD | 如何体现 | 对齐度 |
|-----|---------|--------|
| 记忆引擎 | 关键决策作为 importance=3 的事件存储；因果链追踪（precedingEventId） | ✅ |
| 对话系统 | DecisionNode 决策树追踪每个选择；假选择检测机制；关键抉择面板 | ✅✅✅ |
| 地图系统 | 移动选择 → 走哪条路 → 引发不同区域事件 | ✅ |

**总评**: 支柱 IV 的核心承载者是对话系统（决策追踪 + 假选择检测），记忆引擎提供持久化保证。

---

## 5. 发现的问题与修复

### 问题 #1: MapEntityType vs EntityType 命名不一致 ⚠️

**位置**: 
- 记忆引擎 GDD §2.5: `EntityType` = `'character' | 'location' | 'item' | 'faction' | 'event' | 'concept' | 'quest'`
- 地图系统 GDD §3.1: `MapEntityType` = `'player' | 'npc' | 'monster' | 'item' | 'building' | 'trigger'`

**冲突**: 两个枚举定义了不同粒度的实体分类。`MapEntityType` 是 `EntityType` 的空间化投影，但缺少映射关系。

**修复**: 
- 在记忆引擎 GDD 中增加注释：`EntityType` 是全局抽象分类
- 在地图系统 GDD 中增加映射表：
  ```
  MapEntityType → EntityType 映射:
    player → character
    npc → character
    monster → character
    item → item
    building → location
    trigger → event
  ```
- **不合并为单枚举**：两个枚举服务于不同目的（记忆提取 vs 地图渲染），保持分离是正确的设计，但需要明确映射关系。

**此修复已应用到本报告，无需修改 GDD 原文。**

---

### 问题 #2: EventTag vs NarrativeTag 标签体系重叠 ⚠️

**位置**:
- 记忆引擎 GDD §3.1: `EventTag` = `'golden' | 'danger' | 'magic' | 'hook' | 'resolution' | 'betrayal'`
- 对话系统 GDD §3.1: `NarrativeTag` = `'golden_choice' | 'danger_zone' | 'magic_moment' | 'hook_set' | 'hook_resolved' | 'chapter_end'`

**冲突**: 两套标签描述的是同一件事（叙事事件的类型标记），但名称和粒度不同。

**分析**:
- `golden` ↔ `golden_choice` — 语义相同
- `danger` ↔ `danger_zone` — 语义相同
- `magic` ↔ `magic_moment` — 语义相同
- `hook` ↔ `hook_set` — 语义相同
- `resolution` ↔ `hook_resolved` — 语义相同
- `betrayal` — 仅 EventTag 有
- `chapter_end` — 仅 NarrativeTag 有

**修复**: 统一为 `EventTag`（记忆引擎定义），对话系统通过别名使用：
```typescript
// 对话系统侧：
type NarrativeTag = EventTag;  // 直接复用记忆引擎的标签体系
// 记忆引擎增加 'chapter_end' 到 EventTag 枚举
// 删除对话系统独立定义的 NarrativeTag
```

**推荐操作**: 
1. 在记忆引擎 GDD 的 `EventTag` 中增加 `'chapter_end'`
2. 对话系统 GDD 的 `NarrativeTag` 改为 `type NarrativeTag = EventTag`（引用记忆引擎）
3. 对话系统 UI 绑定表格使用 `EventTag` 的值进行颜色选择

**此修复将在 Phase 2 修订中应用。**

---

### 问题 #3: 缺少 explicit "世界状态"的统一引用 ✅ (不是问题)

**发现**: 三个 GDD 分别管理各自的状态片段（MemoryGraph, DialogueSession, MapState），但没有一个全局 WorldState 聚合类型。

**分析**: 这**不是问题**，而是刻意设计——每个子系统维护自己的状态片段，通过 API 暴露给其他系统，而非通过一个全局单例。这是微服务风格设计在游戏系统中的合理应用。

**验证**: 状态片段之间通过以下机制保持一致性：
- 记忆引擎是叙事状态的权威源
- 地图系统是空间状态的权威源
- 对话系统是交互状态的权威源
- 存档时三个状态片段一起序列化

**无需修改。**

---

### 问题 #4: 即时记忆容量软上限不一致 ⚠️ 轻微

**位置**:
- 记忆引擎 GDD §2.2.1: 软上限 ~200 条事件
- 记忆引擎 GDD §6.2: 极限 500 条 → 触发激进压缩
- 对话系统 GDD §6.2: 单次会话消息 > 500 条 → 即时记忆压缩

**冲突**: 对话系统说的"500 条消息"触发压缩，与记忆引擎自身的"200 条软上限"有差异。

**分析**: 这是个合理的两阶段策略——200 条温和压缩，500 条激进压缩。但对话系统 GDD 只提到了 500 条阈值。

**修复**: 在对话系统 GDD §6.2 中补充说明：
```
| 单次会话消息 > 200 条 | 记忆引擎自动温和压缩至 ~80 条 | 对用户透明 |
| 单次会话消息 > 500 条 | 记忆引擎激进压缩至 ~100 条 + session context 降至最近 50 条 | 提示用户"对话历史较长" |
```

**此修复为轻量级别，可在下一个修订中统一。**

---

### 问题 #5: 地图粒子层性能预算 vs 对话系统性能目标

**位置**:
- 美术圣经 §B: 粒子系统 30fps
- 地图系统 GDD §6.3: 移动帧率 60fps，迷雾更新 <10ms

**分析**: 这不是冲突。粒子层 30fps 是**目标帧率**，与地图渲染的 60fps 是不同图层。CSS 动画的图块层目标 60fps，Canvas 粒子层目标 30fps——这是合理的分层性能策略。

**无需修改。**

---

## 6. 评审结论

### 6.1 总体评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 接口一致性 | ⭐⭐⭐⭐⭐ | 三系统间所有接口调用链清晰，参数/返回值对齐 |
| 命名一致性 | ⭐⭐⭐⭐ | 发现 2 处命名不一致（问题 #1, #2），影响程度轻微，有明确修复方案 |
| 状态流分析 | ⭐⭐⭐⭐⭐ | 无死锁、无活锁、无循环依赖 |
| 支柱对齐 | ⭐⭐⭐⭐⭐ | 四大支柱各有一个主要承载系统 + 辅助系统，映射关系清晰 |
| 边缘处理 | ⭐⭐⭐⭐ | 每个 GDD 独立覆盖了 5+ 边缘情况，跨系统边缘情况（问题 #4）轻微不一致 |

**综合评分**: ⭐⭐⭐⭐½ (4.5/5)

### 6.2 必须修复 (Blocking)

无。当前问题均为轻微级别，不阻塞进入 Phase 3 实现。

### 6.3 建议修复 (Non-blocking，Phase 2 修订)

1. **统一 EventTag/NarrativeTag**（问题 #2）：记忆引擎增加 `chapter_end`，对话系统删除独立 NarrativeTag 定义。
2. **补充 MapEntityType → EntityType 映射表**（问题 #1）：在地图系统或记忆引擎 GDD 中增加映射关系说明。
3. **两阶段压缩阈值对齐**（问题 #4）：对话系统和记忆引擎的压缩触发阈值描述统一。

### 6.4 Phase 3 实现关注点

| 关注点 | 建议 |
|--------|------|
| Prompt 模板的 token 估算 | 在实现时实际测量各层的 token 消耗，可能需要动态调整各层预算 |
| 流式输出 + 记忆提取的竞态 | 确保 ingest 在流式输出完全结束后才进行，避免使用不完整的 AI 回应进行提取 |
| 等距渲染性能 | 在低端设备上测试分块渲染策略，确认帧率目标可达 |
| IndexedDB 跨 tab 一致性 | 实现 tab 锁机制，防止多 tab 同时写入导致数据损坏 |

---

> **评审完成。三个 GDD 已准备好进入 Phase 3 实现阶段。**
