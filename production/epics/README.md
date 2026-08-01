# Epic & Story 拆分计划 — AI Narrator Game MVP

> **版本**: 1.0.0
> **作者**: 程基岩 (Cheng Jiyan) — 游戏技术与引擎工程师
> **日期**: 2025-07-30
> **状态**: Draft — 待主理人审批
> **依赖**: `design/concept.md` / `design/gdd/*.md` / `docs/architecture/overview.md` / `docs/architecture/tech-checklist.md` / `docs/architecture/adr/001-003.md`

---

## 概述

本文档将 AI Narrator Game MVP 的 10 项 Must Have 需求（概念 M01–M10）拆分为 **7 个 Epic**、**42 个 Story**。拆分遵循以下原则：

- 每个 Story 嵌 GDD 需求 ID 和 ADR 指引，确保需求可追溯
- Epic 按依赖关系排序——建造顺序即开发顺序
- T-shirt size 估算基于单人全职两周冲刺（S = 1-2天, M = 3-5天, L = 5-8天, XL = 8-12天）
- 每个 Story 含最小验收标准（至少一条 Given-When-Then）

---

## 依赖关系总图

```
Epic 1: 项目脚手架
  ├──▶ Epic 2: 记忆引擎
  ├──▶ Epic 4: 地图系统 (并行)
  │       │
  │       ▼
  ├──▶ Epic 3: 对话系统 (依赖 Epic 2)
  │       │
  │       ▼
  ├──▶ Epic 5: UI 组件 (依赖 Epic 2,3,4)
  │       │
  │       ▼
  ├──▶ Epic 6: 存档系统 (依赖 Epic 2,3,4)
  │
  └──▶ Epic 7: 游戏设定 + Landing (可与 Epic 2-6 并行)
```

**可并行路径**:
- Epic 2 (记忆引擎) 与 Epic 4 (地图系统) 可并行
- Epic 7 (设定 + Landing) 与 Epics 2-6 可并行（仅依赖 Epic 1）
- Epic 5 (UI) 的部分 Story 可与 Epic 3/4 并行（纯视图组件）

---

## Epic 1: 项目脚手架

**目标**: 搭建可运行、可测试的 Next.js 项目骨架，建立所有后续 Epic 的基础设施。

**优先级**: 🔴 P0 — 最高优先级（阻塞所有后续 Epic）
**估算**: M (3-5 天)
**依赖**: 无
**阻塞**: 所有 Epic 2-7

### 涉及 GDD 需求
- 架构 overview.md §4 目录结构
- 架构 overview.md §6 状态管理方案
- 架构 overview.md §8 数据持久化方案
- tech-checklist.md §1 依赖清单

### Story 列表

| # | Story | 估算 | 验收标准摘要 |
|---|-------|------|-------------|
| **1.1** | **Next.js 项目初始化** | S | `npx create-next-app` + TypeScript strict + Tailwind + 目录结构按 overview.md §4 创建 |
| **1.2** | **全局样式 & CSS 变量** | S | 暗色主题 CSS 变量（`--bg-table`, `--accent-gold` 等）按美术圣经 §3.1 定义；`tailwind.config.ts` 扩展 color tokens |
| **1.3** | **Zustand Store 骨架** | M | 四个 Store（world/dialogue/map/ui）的 TypeScript 接口 + 空实现 + Zustand `create()` 壳；每个 Store 含 `reset()` action |
| **1.4** | **存储适配器** | M | `StorageRouter` 实现 IndexedDB → localStorage → Memory 三级降级；`idb` 封装；`memory-fallback.ts` 实现无持久化模式 |
| **1.5** | **CSP & 安全 Headers** | S | `next.config.ts` 配置 CSP header（见 tech-checklist.md §3.3）+ X-Content-Type-Options 等安全 headers |
| **1.6** | **Vitest + Playwright 配置** | S | `vitest.config.ts`（覆盖率阈值 80%/50%）+ `playwright.config.ts` + `tests/setup.ts`（全局 mock） |
| **1.7** | **lib/ 共享工具层** | S | UUID v4 (`lib/utils/id.ts`) + token 估算器 (`lib/utils/tokenizer.ts`) + `debounce`/`clamp` + 常量文件 (`lib/constants/`) |

### Epic 1 完成定义 (DoD)
- [ ] `npm run dev` 可启动，显示空 Landing 页
- [ ] `npm run typecheck` 通过（strict mode 零 error）
- [ ] `npm run lint` 通过
- [ ] `npm run test:unit` 通过（骨架测试）
- [ ] 四个 Zustand Store 实例化成功
- [ ] 存储适配器在 Chrome/Firefox/Safari 中三级降级正常

---

## Epic 2: 记忆引擎

**目标**: 实现独立记忆子系统——实体提取、关系构建、上下文检索、压缩——支撑叙事连续性（支柱 III）。

**优先级**: 🔴 P0 — 对话系统的前置依赖（Epic 3 依赖）
**估算**: L (5-8 天)
**依赖**: Epic 1
**阻塞**: Epic 3 (对话系统)

### 涉及 GDD 需求
- 记忆引擎 GDD §2 (机制设计) 全体
- 记忆引擎 GDD §3 (数据结构) 全体
- 记忆引擎 GDD §4.1 (IMemoryEngine API)
- 架构 overview.md §3.3 (MemoryEngine 模块)
- 概念 M04 (基础记忆系统)

### Story 列表

| # | Story | 估算 | 验收标准摘要 |
|---|-------|------|-------------|
| **2.1** | **核心类型定义 + MemoryGraph 数据结构** | S | `systems/memory/types.ts` 按 GDD §3.1 定义全部接口（`MemoryGraph`, `MemoryEntity`, `EventLogEntry`, `Relation` 等）；`Map<string, T>` 序列化辅助函数 |
| **2.2** | **EntityExtractor — 规则引擎实体提取** | M | 正则 + 关键词匹配提取 EntityType（character/location/item/faction/event/concept/quest）；置信度 score 0.0–1.0；专有名词识别（中文 + 英文）；100+ 词元规则库 |
| **2.3** | **MemoryEngine 主类 — ingest & retrieve** | L | `IMemoryEngine` 接口完整实现；`ingest()` 摄入事件 → 触发提取 + 关系构建；`retrieveForContext()` 按 `MemoryRetrievalRequest` 返回格式化上下文块；Promise 队列串行化（禁止并发 ingest/retrieve） |
| **2.4** | **GraphBuilder — 关系图谱构建** | M | 实体去重（同名 → `occurrenceCount +1`）；关系强度增量更新（正面交互 +0.1~0.2，负面 -0.1~0.3）；`precedingEventId` 因果链连接；`isActive` 标记 |
| **2.5** | **ContextRetriever — 上下文检索** | M | 按 `MemoryRetrievalRequest` 检索：实体匹配（名称/别名/类型）、事件匹配（标签/实体关联）、关系匹配；返回格式化纯文本 contextBlock（非 JSON，ADR-003）；token 预算控制（`estimateTokens`） |
| **2.6** | **Compressor — 两阶段压缩** | M | 阶段1：即时记忆 > 200 条 → 按 importance 排序 → 低重要性合并 → 目标 ≤ 80 条；阶段2：会话结束 → 生成 `SessionMemory`（≤ 20 条 KeyEventDigest + relationDeltas + unresolvedHooks）；FIFO 短期记忆管理（5 次会话上限） |
| **2.7** | **会话生命周期管理** | S | `init()` 从 IndexedDB 加载图谱 → 创建新 sessionId；`shutdown()` 压缩 → 存入 IndexedDB + localStorage；会话恢复：`getLastSessionSummary()` 返回上次摘要 |
| **2.8** | **错误处理 & 降级** | S | IndexedDB 不可用 → localStorage 降级；localStorage 不可用 → 内存模式（仅即时记忆）；图谱数据损坏 → checksum 校验 + 重建；检索超时 500ms → 返回简化上下文 |

### Epic 2 完成定义 (DoD)
- [ ] 所有 GDD §7.1 单元测试通过（MEM-UT-01 ~ MEM-UT-08）
- [ ] 内存模式下降级测试通过
- [ ] 压缩触发时即时记忆 ≤ 80 条
- [ ] 1000 条事件时检索 < 100ms
- [ ] 测试覆盖率 ≥ 80%

---

## Epic 3: 对话系统

**目标**: 实现 AI GM 对话核心——四层 Prompt 组装、OpenRouter SSE 流式、结构化输出解析、混合输入模式。

**优先级**: 🔴 P0 — 核心交互（概念 M02, M03, M09）
**估算**: L (5-8 天)
**依赖**: Epic 1 + Epic 2 (记忆引擎)
**阻塞**: Epic 5 (对话 UI 面板)

### 涉及 GDD 需求
- 对话系统 GDD §2 (机制设计) 全体
- 对话系统 GDD §3 (数据结构) 全体
- 对话系统 GDD §4 (API 契约) 全体
- 对话系统 GDD §6 (边界条件)
- ADR-003 (Prompt 上下文组装策略)
- 概念 M02 (AI GM 对话核心循环), M03 (建议动作), M09 (OpenRouter)

### Story 列表

| # | Story | 估算 | 验收标准摘要 |
|---|-------|------|-------------|
| **3.1** | **核心类型定义** | S | `systems/dialogue/types.ts` 按 GDD §3.1 定义全部接口（`DialogueMessage`, `ContentBlock`, `StateDelta`, `LLMRequest/Response` 等） |
| **3.2** | **OpenRouter Client** | M | `infrastructure/openrouter/client.ts`：流式 `streamChat()` + 非流式 `completeChat()` fallback；重试策略（指数退避 1s/3s/9s，最多 3 次）；`AbortController` 取消支持；API Key 验证 `validateApiKey()` |
| **3.3** | **PromptAssembler — 四层组装** | M | 按 ADR-003 策略 B 实现：System/World/Memory 三层缓存 + 版本号失效；`precomputeMemoryBlock()` 异步预计算；`buildSessionContext()` 滑动窗口基于 `estimateTokens` |
| **3.4** | **ResponseParser — 结构化输出解析** | M | 解析 `[NARRATIVE]`/`[ACTIONS]`/`[STATE]`/`[DECISION]` 四个标记块；StateDelta 转结构化数据（hp/mp/relationship/item/quest 变化）；`FakeChoiceDetector` 假选择检测（选项 STATE 块完全相同时 warning） |
| **3.5** | **DialogueSystem 主类** | L | `IDialogueSystem` 接口完整实现；`sendMessage()` 自由文本 + 决策选项 + 建议动作；`sendMessageStream()` 流式回调（onToken/onBlock/onComplete）；`executeSuggestion()` 建议动作执行 |
| **3.6** | **SSE 流式解析** | M | `fetch` + `ReadableStream` + `TextDecoder` 逐 chunk 解析 SSE `data: [DONE]`；500ms 首 token 目标；流中断 → 非流式 fallback；超时 30s → abort |
| **3.7** | **模型切换 & 目录管理** | S | `model-catalog.ts` 模型列表（GPT-4o/Claude 3.5 Sonnet/Gemini 1.5 Pro）+ 定价 + 上下文窗口；`switchModel()` 验证可用性 → 更新 config → 用户提示 |
| **3.8** | **System Prompt 模板** | S | `[ROLE]`/`[RULES]`/`[WORLD RULES]`/`[OUTPUT FORMAT]`/`[RHYTHM]` 五段模板；`[WORLD RULES]` 与 `[RHYTHM]` 为动态注入槽位；模板文件 `systems/dialogue/prompts/` |

### Epic 3 完成定义 (DoD)
- [ ] 所有 GDD §7.1 单元测试通过（DLG-UT-01 ~ DLG-UT-08）
- [ ] Mock OpenRouter 的集成测试通过
- [ ] 流式 SSE 解析测试（模拟 chunk 序列）
- [ ] 假选择检测正确识别警告
- [ ] Token 预算控制在 8K 窗口 65% 以内
- [ ] Prompt 组装延迟（缓存命中）< 5ms
- [ ] 测试覆盖率 ≥ 70%

---

## Epic 4: 地图系统

**目标**: 实现 2.5D 等距地图——图块渲染、A* 寻路、战争迷雾、区域切换——支撑空间叙事（支柱 II）。

**优先级**: 🔴 P0
**估算**: L (5-8 天)
**依赖**: Epic 1
**阻塞**: Epic 5 (地图 UI 面板)

### 涉及 GDD 需求
- 地图系统 GDD §2 (机制设计) 全体
- 地图系统 GDD §3 (数据结构) 全体
- 地图系统 GDD §4.1 (IMapSystem API)
- ADR-002 (CSS + Canvas 混合渲染)
- 概念 M01 (2.5D 地图图块渲染与点击导航)

### Story 列表

| # | Story | 估算 | 验收标准摘要 |
|---|-------|------|-------------|
| **4.1** | **核心类型定义 + CoordinateUtils** | S | `systems/map/types.ts` 按 GDD §3.1 定义全部接口；`CoordinateUtils.ts` 实现 `isoToScreen()`/`screenToIso()`/`getNeighbors()`/`distance()` |
| **4.2** | **Pathfinder — A* 寻路** | M | 八方向寻路；`moveCost` 权重考虑（沼泽 > 草地 > 道路）；阻挡物不可通行（wall/cliff/water_deep）；返回 `TileCoord[]` 或 null（无路径）；性能：500 格路径 < 50ms |
| **4.3** | **FogManager — 战争迷雾** | M | 三层迷雾状态（unexplored/explored/visible）；Bresenham 视线算法（考虑阻挡物）；视野半径 6 格可配置；`revealFog(coord, radius)` 批量揭示 |
| **4.4** | **MapSystem 主类 — 移动 & 事件** | L | `IMapSystem` 接口完整实现；`moveTo()` A* 寻路 → 路径预览 → 逐格移动 → 到达触发事件；移动中可 `cancelMovement()`；图块事件系统（`TileEvent` on_enter/on_every_enter/on_examine/on_proximity/on_time/on_condition） |
| **4.5** | **RegionLoader — 区域加载/切换** | M | `loadWorld()` 从 IndexedDB 加载世界数据；`switchRegion()` 淡出 → 卸载 → 加载 → 淡入（200ms 动画）；邻近区域预加载（仅地形数据） |
| **4.6** | **TileLayer 渲染 — CSS DOM 图块** | M | 组件 `TileLayer.tsx`：视口内图块虚拟化（`IntersectionObserver`）；等距 2D 投影定位（非 3D transform，ADR-002）；clip-path 菱形裁剪；hover/selected/reachable 三态 CSS；缩放 < 0.75x 时隐藏实体层 |
| **4.7** | **Canvas 叠加层 — 粒子 & 迷雾** | M | `MapCanvas.tsx`：Canvas 2D 粒子系统（30fps `requestAnimationFrame`）；战争迷雾 Canvas 叠加（径向渐变羽化）；`pointer-events: none` 透传鼠标事件；主题粒子配置（树叶/孢子/炊烟/波纹） |
| **4.8** | **等距渲染逃逸测试** | S | 极限测试：10000 图块区域 → 仅渲染视口内（< 200 DOM 节点）；缩放 0.5x–2x 流畅；主题切换（4 套色板）毫秒级；低端设备降级路径验证 |

### Epic 4 完成定义 (DoD)
- [ ] 所有 GDD §7.1 单元测试通过（MAP-UT-01 ~ MAP-UT-08）
- [ ] A* 寻路在各种障碍配置下正确
- [ ] 战争迷雾揭示/恢复正确
- [ ] 区域切换 < 300ms（含动画）
- [ ] 图块渲染 60fps，粒子 30fps
- [ ] 测试覆盖率 ≥ 70%

---

## Epic 5: UI 组件

**目标**: 实现完整的三面板游戏界面——地图/对话/状态栏——以及所有共享 UI 组件。

**优先级**: 🟡 P1 — 核心交互界面
**估算**: L (5-8 天)
**依赖**: Epic 1 + Epic 2 + Epic 3 + Epic 4
**阻塞**: 无（最终集成）

### 涉及 GDD 需求
- 概念 M06 (基础 HUD — 状态栏 + 对话面板 + 小地图)
- 对话系统 GDD §5 (UI 绑定)
- 地图系统 GDD §5 (UI 绑定)
- 记忆引擎 GDD §5 (UI 绑定)
- 美术圣经 §5-9 (组件规范、动效、无障碍)

### Story 列表

| # | Story | 估算 | 验收标准摘要 |
|---|-------|------|-------------|
| **5.1** | **布局壳 — ThreePanelLayout** | M | 三面板响应式布局：左侧地图 360px / 中央对话 flex / 右侧状态 300px；移动端单面板切换（Bottom TabBar）；TopBar 含标题 + 设置入口 + 存档入口 |
| **5.2** | **对话面板 — DialoguePanel** | L | `MessageList` 虚拟滚动（@tanstack/react-virtual）；`MessageBubble` 玩家/AI GM/NPC 三种样式（GDD §5.2）；`StreamText` 流式文本渲染（`requestAnimationFrame` 批量更新）；`AIAvatar` 四种状态（idle/thinking/speaking/warning）动画 |
| **5.3** | **玩家输入区 — PlayerInput + SuggestedActions** | M | `PlayerInput` free text textarea + 发送按钮；`SuggestedActions` 交错滑入动画（GDD §5.4）；建议动作卡片按类型图标 + 优先级排序；点击建议 → 填入输入框或直接发送 |
| **5.4** | **关键抉择面板 — DecisionModal** | M | 全屏 Modal（GDD §5.3）；三色边框（golden/danger/magic 发光）；选项卡片 + hover/active 动效；"其他选择…（自由输入）"折叠项；假选择 warning 开发者标记（不打断玩家） |
| **5.5** | **地图面板 — MapPanel** | M | 集成 Epic 4 的 `TileLayer` + `EntityLayer` + `MapCanvas` + `FogOverlay`；`PathLine` SVG 路径线（solid/dashed/dotted）；`ZoomControls` +/- 按钮 + 鼠标滚轮；`TileTooltip` hover 显示图块信息 |
| **5.6** | **状态栏面板 — StatusPanel** | M | `PlayerStats` HP/MP/属性条；`InventoryPreview` 精简背包列表；`QuestLog` 活跃任务；`MemoryTimeline` 会话关键事件时间线（暗色背景 + 节点） |
| **5.7** | **共享 UI 组件** | M | `Modal`（动画 + 焦点陷阱 + Escape 关闭）；`Toast`（自动消失 + 四种类型）；`Tooltip`（hover 延迟 300ms）；`Button`（Primary/Ghost/Danger/Icon 变体）；`Panel` 容器；`Scrollbar` 细滚动条 |
| **5.8** | **会话恢复面板 — RecapPanel** | S | 入场 Recap（记忆引擎 GDD §5.2）；3-5 条关键记忆卡片（importance 颜色编码）；unresolvedHook 危险边框；"继续冒险" / "完整回顾" 按钮 |

### Epic 5 完成定义 (DoD)
- [ ] 三面板在所有响应式断点下正确布局
- [ ] 对话流式文本渲染流畅（无视觉闪烁）
- [ ] 抉择面板动画符合 GDD §5.3
- [ ] 键盘导航：Tab 穿越主要交互区
- [ ] `prefers-reduced-motion` 减少动效正确
- [ ] 组件测试覆盖率 ≥ 50%
- [ ] 无障碍：关键交互元素有 aria-label

---

## Epic 6: 存档系统

**目标**: 实现完整游戏状态持久化——存档/读档/校验——支撑跨会话连续性。

**优先级**: 🟡 P1 — 数据持久化
**估算**: M (3-5 天)
**依赖**: Epic 1 + Epic 2 + Epic 3 + Epic 4
**阻塞**: 无

### 涉及 GDD 需求
- 概念 M10 (基础存档/读档 3 个存档位)
- 架构 overview.md §5.3 (存档/读档数据流)
- 架构 overview.md §8.3 (存档文件结构)
- tech-checklist.md §3.4 (checksum 校验)

### Story 列表

| # | Story | 估算 | 验收标准摘要 |
|---|-------|------|-------------|
| **6.1** | **SaveSerializer — 序列化/反序列化** | M | 按 overview.md §8.3 `SaveFile` 接口完整实现；`serialize()` 收集 WorldStore + MapState + MemoryGraph + DialogueHistory → JSON；`deserialize()` 验证 version + checksum → 恢复各子系统状态 |
| **6.2** | **SaveManager — 存档 CRUD** | M | 3 个存档位（slot_0/1/2）；`save(slotId)` 调用序列化 → 写入 IndexedDB（含降级）；`load(slotId)` 反序列化 → 恢复各系统；`delete(slotId)` 清除；存档元数据（label/playTime/lastPlayedAt） |
| **6.3** | **checksum 校验** | S | SHA-256 checksum（Web Crypto API `SubtleCrypto.digest`）；存档写入时计算 + 写入；读档时校验 → 不匹配拒绝加载 + 提示"存档损坏" |
| **6.4** | **存储配额监控** | S | `navigator.storage.estimate()` 定期检查；≥ 80% 时 Toast 提示用户清理；存档前预检查（是否足够空间）；紧急压缩触发（丢弃旧短期记忆会话） |
| **6.5** | **会话结束自动保存** | S | `beforeunload` 事件 → `shutdown()` 记忆引擎 + 自动存档到最近槽位；存档中显示进度指示器（"正在保存…"）；多 tab 检测 → 仅主 tab 执行保存 |

### Epic 6 完成定义 (DoD)
- [ ] 存档 → 刷新页面 → 读档 → 全部状态恢复正确
- [ ] 3 个存档位独立管理（不互相污染）
- [ ] checksum 损坏时拒绝加载 + 友好提示
- [ ] 存储不足时优雅降级
- [ ] 集成测试：存档-读档完整循环

---

## Epic 7: 游戏设定 + Landing

**目标**: 实现游戏设定加载/生成 + Landing 页 SSG + 设置面板（API Key/模型切换）。

**优先级**: 🟡 P1
**估算**: M (3-5 天)
**依赖**: Epic 1（可与 Epic 2-6 并行）
**阻塞**: 无

### 涉及 GDD 需求
- 概念 M07 (游戏设定加载 1 个预设 + 导入)
- 概念 M08 (AI 生成游戏设定)
- 概念 M05 (角色创建与基础属性)
- 架构 overview.md §7 (路由设计)
- ADR-001 §4 (API Key 安全策略)

### Story 列表

| # | Story | 估算 | 验收标准摘要 |
|---|-------|------|-------------|
| **7.1** | **GameSetting 解析器** | M | `systems/world/GameSetting.ts`：JSON/YAML 格式验证（JSON Schema）；支持的字段：worldMeta/rules/regions/npcs/playerClass/initialState；`validateSetting()` 返回 validation errors |
| **7.2** | **预设游戏设定 ×1** | S | 至少 1 个完整预设（奇幻主题）：`public/settings/default-fantasy.json`；包含至少 3 个区域 + 5 个 NPC + 初始剧情钩子；可直接加载并开始游戏 |
| **7.3** | **AI 设定生成** | M | `app/world-builder/page.tsx`：Prompt 输入 → 调用 OpenRouter → 解析 AI 输出为 JSON → 验证 → 展示预览 → 确认保存；System Prompt 模板：`systems/dialogue/prompts/setting-generator.md` |
| **7.4** | **Landing 页 SSG** | M | `app/page.tsx`：游戏介绍 + 视觉展示；"开始新游戏"按钮 → `/world-builder`；"继续游戏"按钮 → 读取存档列表 → 选择存档 → `/game/[id]`；"设置"入口 → `/settings`；Next.js SSG (`generateStaticParams`) |
| **7.5** | **设置面板** | M | `app/settings/page.tsx`：API Key 输入（type=password，前缀校验 `sk-or-`）；模型选择（下拉列表 + 可用性检查）；主题切换（dark/light）；打字机效果开关；音量控制（未来）；"忘记 Key"清除按钮 |
| **7.6** | **角色创建流程** | S | 姓名输入 + 外观描述 textarea + 3 项基础属性选择（预设 class 模板）；从 GameSetting 加载可选 class；创建完成后跳转 `/game/new` |

### Epic 7 完成定义 (DoD)
- [ ] Landing 页 SSG 构建成功，Lighthouse 首屏 < 1.5s
- [ ] 预设设定可完整加载并开始游戏（M07）
- [ ] AI 设定生成流程端到端可走通（M08）
- [ ] API Key 验证 + 模型切换正常工作
- [ ] 角色创建 → 跳转游戏页面正确
- [ ] 路由守卫：无 API Key → redirect `/settings`

---

## 冲刺计划建议

### Sprint 0: 基础设施（第 1 周）
| Epic | 计划 |
|------|------|
| Epic 1 | 全部 Story 1.1–1.7 |

### Sprint 1: 核心系统并行（第 2–3 周）
| Epic | 计划 |
|------|------|
| Epic 2 | Story 2.1–2.8（记忆引擎） |
| Epic 4 | Story 4.1–4.8（地图系统） |

### Sprint 2: 对话 + 集成（第 4–5 周）
| Epic | 计划 |
|------|------|
| Epic 3 | Story 3.1–3.8（对话系统） |
| Epic 7 | Story 7.1–7.6（与 Epic 3 并行） |

### Sprint 3: UI + 存档（第 6–7 周）
| Epic | 计划 |
|------|------|
| Epic 5 | Story 5.1–5.8（UI 组件） |
| Epic 6 | Story 6.1–6.5（存档系统） |

### Sprint 4: 集成测试 + 打磨（第 8 周）
- 全系统集成测试（记忆↔对话↔地图↔存档）
- E2E 测试（Playwright 完整游戏流程）
- 性能优化 + Lighthouse 达标
- Bug 修复 + 边缘情况补完

---

## 风险与缓解

| 风险 | 概率 | 影响 Epic | 缓解措施 |
|------|------|----------|---------|
| OpenRouter API 格式变更 | 低 | Epic 3 | 版本化 API 调用 + mock server 测试独立 |
| IndexedDB 浏览器差异 | 中 | Epic 2, 6 | 三级降级 + 存储路由 + 多浏览器测试 |
| 等距渲染性能不达标 | 低 | Epic 4 | DOM 虚拟化 + 分块渲染 + 性能降级路径已规划 |
| 记忆压缩质量影响叙事 | 中 | Epic 2 | 压缩策略含 importance 优先 + 可调参数 |
| Token 预算超支（长篇叙事） | 中 | Epic 3 | 动态窗口调整 + 模型切换建议 |
| Zustand Store 跨依赖死锁 | 低 | Epic 1, 5 | Store 间通信仅通过 `getState()` 读取，不跨 Store 写入 |

---

## 附录 A: Story → GDD 需求追溯

| Story | GDD 需求 | ADR 引用 |
|-------|---------|---------|
| 1.3 (Store 骨架) | overview.md §6 | — |
| 1.4 (存储适配器) | overview.md §8 | — |
| 2.2 (EntityExtractor) | 记忆 GDD §2.5, MEM-001 | — |
| 2.3 (MemoryEngine) | 记忆 GDD §4.1 | — |
| 2.5 (ContextRetriever) | 记忆 GDD §2.7, §4.1 | ADR-003 |
| 2.6 (Compressor) | 记忆 GDD §2.3, §2.4 | — |
| 3.2 (OpenRouter) | 对话 GDD §4.4, M09 | ADR-001 |
| 3.3 (PromptAssembler) | 对话 GDD §2.3, M02 | ADR-003 |
| 3.4 (ResponseParser) | 对话 GDD §2.5, DLG-003 | — |
| 3.6 (SSE 流式) | 对话 GDD §2.6 | — |
| 4.2 (Pathfinder) | 地图 GDD §2.1 | — |
| 4.3 (FogManager) | 地图 GDD §2.2 | — |
| 4.6 (TileLayer) | 地图 GDD §5.2, M01 | ADR-002 |
| 4.7 (Canvas 粒子) | 地图 GDD §2.5 | ADR-002 |
| 5.2 (DialoguePanel) | 对话 GDD §5.2, M06 | — |
| 5.4 (DecisionModal) | 对话 GDD §5.3 | — |
| 5.6 (StatusPanel) | 概念 M06 | — |
| 6.1 (SaveSerializer) | overview.md §8.3, M10 | — |
| 6.3 (checksum) | tech-checklist.md §3.4 | — |
| 7.1 (GameSetting) | 概念 M07 | — |
| 7.3 (AI 设定生成) | 概念 M08 | — |
| 7.5 (设置面板) | 概念 M09 | ADR-001 |

---

> **下一步**: 主理人审批 Epic 拆分计划。审批通过后，进入 Sprint 0 → Story 1.1 实现。
