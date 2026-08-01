# 主架构文档 — AI Narrator Game

> **版本**: 1.0.0
> **作者**: 程基岩 (Cheng Jiyan) — 游戏技术与引擎工程师
> **日期**: 2025-07-29
> **状态**: Draft — 待主理人审批
> **依赖**: `design/concept.md` / `design/art-bible.md` / `design/gdd/*.md` / `design/gdd/cross-gdd-review.md`

---

## 目录

1. [系统总��](#1-系统总览)
2. [技术栈决策](#2-技术栈决策)
3. [模块架构](#3-模块架构)
4. [目录结构](#4-目录结构)
5. [数据流设计](#5-数据流设计)
6. [状态管理方案](#6-状态管理方案)
7. [路由设计](#7-路由设计)
8. [数据持久化方案](#8-数据持久化方案)
9. [渲染架构](#9-渲染架构)
10. [LLM 接入架构](#10-llm-接入架构)
11. [Electron 扩展点预留](#11-electron-扩展点预��)
12. [构建与部署](#12-构建与部署)
13. [性能预算](#13-性能预算)

---

## 1. 系统总览

### 1.1 一句话定位

AI Narrator Game 是一个**纯前端 Web 应用**，通过 OpenRouter API 直连多个 LLM 模型，在浏览器内实现完整的 AI GM 驱动的 2.5D 文字冒险游戏。

### 1.2 架构全景图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER RUNTIME                               │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Next.js App Router                          │  │
│  │  ┌─────────────┐  ┌─────────────────┐  ┌──────────────────┐  │  │
│  │  │   Layout     │  │   Game Route    │  │  Settings Route  │  │  │
│  │  │ (三面板壳)   │  │   /game/[id]    │  │  /settings       │  │  │
│  │  └─────────────┘  └─────────────────┘  └──────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    State Layer (Zustand)                        │  │
│  │  ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌────────────┐  │  │
│  │  │ World    │  │ Dialogue   │  │ Map      │  │ UI         │  │  │
│  │  │ Store    │  │ Store      │  │ Store    │  │ Store      │  │  │
│  │  └──────────┘  └────────────┘  └──────────┘  └────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Core Systems                                │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐  │  │
│  │  │ Memory     │  │ Dialogue     │  │ Map                  │  │  │
│  │  │ Engine     │  │ System       │  │ System               │  │  │
│  │  │ (3-layer)  │  │ (Prompt+SSE) │  │ (CSS+Canvas Hybrid)  │  │  │
│  │  └────────────┘  └──────────────┘  └──────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Infrastructure                              │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │  │
│  │  │ OpenRouter│  │localStor.│  │IndexedDB │  │ Save/Load   │  │  │
│  │  │ Client   │  │ Adapter  │  │ Adapter  │  │ Manager     │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    UI Layer (React Components)                  │  │
│  │  ┌────────┐ ┌────────────┐ ┌──────────┐ ┌──────────────────┐ │  │
│  │  │ Map    │ │ Dialogue   │ │ Status   │ │ TopBar / Modal / │ │  │
│  │  │ Panel  │ │ Panel      │ │ Panel    │ │ Toast / Tooltip  │ │  │
│  │  └────────┘ └────────────┘ └──────────┘ └──────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ HTTPS (JSON + SSE)
                                     ▼
                          ┌───────────────────┐
                          │   OpenRouter API   │
                          │   (GPT-4o/Claude   │
                          │    3.5/Gemini)     │
                          └───────────────────┘
```

### 1.3 关键架构原则

| # | 原则 | 来源 |
|---|------|------|
| 1 | **纯前端无服务器** — 无后端依赖，应用完全在浏览器运行 | 概念 D008 |
| 2 | **子系统独立** — 记忆引擎/对话系统/地图系统各为独立模块，通过明确 API 通信 | 概念 D002, 交叉评审 §3.4 |
| 3 | **单一权威源** — 每个共享状态有唯一写入者 (MemoryEngine→叙事状态, MapSystem→空间状态, DialogueSystem→交互状态) | 交叉评审 §3.4 |
| 4 | **渐进增强渲染** — CSS 优先（60fps 图块布局），Canvas 降级（30fps 粒子/迷雾），纯色块兜底 | 地图 GDD §6.1 |
| 5 | **离线降级优雅** — 存储不可用时自动降级到内存模式，API 不可达时友好提示 | 记忆 GDD §6.1 / 对话 GDD §6.1 |
| 6 | **API Key 零暴露** — 密钥仅在浏览器内存/安全的 localStorage 中存储，不经过任何第三方服务器 | ADR-001 |

---

## 2. 技术栈决策

### 2.1 核心框架

| 技术 | 版本 | 选型理由 |
|------|------|---------|
| **Next.js** | 15.x (App Router) | React 生态 + SSR 可选（MVP 纯 CSR）+ 路由 + 构建优化 |
| **React** | 19.x | 组件生态、Hooks 模式、流式渲染（Suspense） |
| **TypeScript** | 5.x (strict) | 类型安全——GDD 中所有数据结构均为 TypeScript 接口 |

### 2.2 选型对比

#### Next.js App Router vs Vite SPA

| 维度 | Next.js App Router | Vite SPA | 判定 |
|------|-------------------|----------|------|
| 路由 | 文件系统路由，Layout 嵌套（天然三面板壳） | 需 react-router 手动配置 | Next.js 优势 |
| SSR | 可选 SSR/SSG（首屏加载优化、SEO） | 纯 CSR | 非关键（游戏内页），但 Landing 页 SSR 有用 |
| 构建 | Turbopack + SWC，生产构建优化好 | esbuild，极快冷启动 | Vite 更快但 Next.js 够用 |
| 静态导出 | `next export` → 纯静态，Electron 友好 | 天然 SPA | 平手 |
| 学习成本 | 中等 | 低 | Vite 稍优 |
| 社区/生态 | 最大 | 大 | Next.js 优势 |

**决定**: Next.js App Router。三面板 Layout 嵌套完美映射游戏布局，静态导出满足 Electron 扩展，SSG 可用于 Landing 页。

#### Zustand vs Redux Toolkit vs Jotai vs Context

| 维度 | Zustand | Redux Toolkit | Jotai | React Context |
|------|---------|---------------|-------|---------------|
| Bundle 大小 | ~1KB | ~11KB | ~3KB | 0 (built-in) |
| 学习成本 | 极低（Hook 即 API） | 中-高 | 低 | 极低 |
| 性能（选择性订阅） | ✅ 原生 selector | ✅ useSelector | ✅ 原子订阅 | ❌ 全局重渲染 |
| DevTools | 基础（Redux DevTools 兼容） | 完整 | 基础 | 无 |
| 游戏状态拟合 | ✅ 简单 store 切片 | ⚠️ 过度工程 | ✅ 原子化 | ❌ 性能问题 |
| 跨 Store 通信 | ✅ `useStore` 直接读 | ⚠️ 需 slice 间通信 | ⚠️ 需原子间派生 | ❌ 嵌套 Provider |

**决定**: **Zustand**。理由：① 四个独立 Store（World/Dialogue/Map/UI）天然匹配 Zustand 的切片模式；② 每个 store 的 selector 防止 React 全局重渲染（对话面板不需要知道地图粒子状态）；③ 极小的 bundle（~1KB）；④ 学习成本接近于零——团队成员可立即上手。

---

## 3. 模块架构

### 3.1 模块分层

```
src/
├── app/                        # Next.js App Router (页面 + 布局)
├── components/                 # React UI 组件
├── systems/                    # 核心游戏系统（纯逻辑，不依赖 React）
├── stores/                     # Zustand 状态管理
├── infrastructure/             # 基础设施层
├── lib/                        # 共享工具/类型/常量
└── assets/                     # 静态资源
```

### 3.2 模块依赖规则

```
Layer 0 (无依赖):        lib/          — 类型定义、常量、纯工具函数
Layer 1 (infra):         infrastructure/ — OpenRouter Client, Storage Adapters, Save/Load
Layer 2 (core systems):  systems/       — MemoryEngine, DialogueSystem, MapSystem
Layer 3 (state bridge):  stores/        — Zustand stores (桥接 systems ↔ components)
Layer 4 (UI):            components/    — React 组件
Layer 5 (routing):       app/           — 页面 + Layout
```

**依赖方向**: Layer N 只能依赖 Layer N-1 及以下。UI 绝对不能直接调用 `systems/`（必须通过 store）。

### 3.3 核心系统模块职责

| 模块 | 入口文件 | 依赖 | 暴露 API |
|------|---------|------|---------|
| `systems/memory/` | `MemoryEngine.ts` | `infrastructure/storage/` | `IMemoryEngine` (GDD §4.1) |
| `systems/dialogue/` | `DialogueSystem.ts` | `infrastructure/openrouter/`, `systems/memory/` | `IDialogueSystem` (GDD §4.1) |
| `systems/map/` | `MapSystem.ts` | `infrastructure/storage/` | `IMapSystem` (GDD §4.1) |
| `systems/world/` | `WorldState.ts` | 无 (纯数据容器) | 世界状态聚合类型 |

### 3.4 Zustand Store 设计

#### 3.4.1 WorldStore

```typescript
// stores/world-store.ts
interface WorldSlice {
  // 玩家
  playerName: string;
  playerClass: string;
  playerAttributes: Record<string, number>;
  
  // 世界状态摘要（从记忆引擎同步）
  worldStateDigest: WorldStateDigest | null;
  
  // 游戏设定
  gameSetting: GameSetting | null;
  isSettingLoaded: boolean;
  
  // 存档元数据
  saveSlots: SaveSlotMeta[];
  currentSaveSlotId: string | null;
  
  // Actions
  loadGameSetting: (setting: GameSetting) => void;
  updatePlayerAttribute: (key: string, delta: number) => void;
  syncWorldStateDigest: (digest: WorldStateDigest) => void;
}
```

#### 3.4.2 DialogueStore

```typescript
// stores/dialogue-store.ts
interface DialogueSlice {
  // 消息历史
  messages: DialogueMessage[];
  
  // 当前状态
  narrativeState: NarrativeState;
  currentSuggestions: SuggestedAction[];
  isStreaming: boolean;
  streamedText: string;               // 当前流式接收中的文本
  
  // 决策
  activeDecision: DecisionNode | null; // 当前关键抉择
  
  // 元数据
  sessionMeta: DialogueSessionMeta;
  
  // Actions
  sendMessage: (input: PlayerInput) => Promise<void>;
  executeSuggestion: (actionId: string) => Promise<void>;
  selectDecisionOption: (optionId: string) => Promise<void>;
  clearStreamedText: () => void;
}
```

#### 3.4.3 MapStore

```typescript
// stores/map-store.ts
interface MapSlice {
  // 地图数据
  currentRegionId: string;
  currentRegion: Region | null;
  tiles: Map<string, Tile>;
  entities: Map<string, MapEntity>;
  
  // 玩家位置
  playerCoord: TileCoord;
  isMoving: boolean;
  movePath: TileCoord[];              // 当前移动路径
  
  // 视图
  zoomLevel: number;
  cameraOffset: { x: number; y: number };
  
  // 战争迷雾
  fogStates: Record<string, FogState>; // key = "regionId:col,row"
  
  // Actions
  moveTo: (coord: TileCoord) => Promise<MoveResult>;
  cancelMovement: () => void;
  setZoom: (level: number) => void;
  centerOn: (coord: TileCoord) => void;
  revealFog: (coord: TileCoord, radius: number) => void;
  loadMapState: (state: MapState) => void;
}
```

#### 3.4.4 UIStore

```typescript
// stores/ui-store.ts
interface UISlice {
  // 布局
  theme: 'dark' | 'light';
  activePanel: 'map' | 'dialogue' | 'status'; // 移动端单面板切换
  
  // 模态
  activeModal: string | null;
  modalData: unknown;
  
  // 提示
  toasts: Toast[];
  
  // AI 状态
  aiAvatarState: 'idle' | 'thinking' | 'speaking' | 'warning';
  
  // 设置
  selectedModel: string;
  typingEffectEnabled: boolean;
  soundEnabled: boolean;
  
  // 可访问性
  reducedMotion: boolean;
  highContrast: boolean;
  
  // Actions
  setTheme: (theme: 'dark' | 'light') => void;
  openModal: (id: string, data?: unknown) => void;
  closeModal: () => void;
  addToast: (toast: Toast) => void;
  removeToast: (id: string) => void;
  setAiAvatarState: (state: UISlice['aiAvatarState']) => void;
  toggleTypingEffect: () => void;
}
```

### 3.5 Store 间通信策略

- **WorldStore ↔ DialogueStore**: DialogueStore 的 `sendMessage` 通过 `worldStore.getState().playerName` 获取玩家上下文
- **DialogueStore ↔ MapStore**: 位置变化通过 `mapStore.getState().playerCoord` 和 `mapStore.getState().moveTo()`
- **MemoryEngine → WorldStore**: 记忆引擎 `retrieveForContext()` 返回的 `WorldStateDigest` 通过 `worldStore.syncWorldStateDigest()` 同步
- **所有 Store → UIStore**: UI 状态仅被组件消费，无跨 store 通信

---

## 4. 目录结构

```
ai-narrator-game/
├── public/
│   ├── fonts/                     # 字体子集（Crimson Text, Inter, JetBrains Mono 子集）
│   ├── sprites/                   # 地图精灵图（Sprite Sheets）
│   │   ├── terrain/               # 地形精灵（forest/cave/town/water）
│   │   ├── decoration/            # 装饰精灵
│   │   └── entities/              # 实体精灵（NPC/怪物/物品图标）
│   ├── icons/                     # SVG UI 图标
│   ├── audio/                     # 环境音效（MP3/OGG，懒加载）
│   └── ai-avatar/                 # AI 主持人头像变体（SVG）
│
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx             # 根 Layout（主题提供者 + 字体加载）
│   │   ├── page.tsx               # Landing 页（游戏介绍 + 开始/继续/设置）
│   │   ├── game/
│   │   │   ├── layout.tsx         # 三面板 Layout（Map | Dialogue | Status）
│   │   │   └── [id]/
│   │   │       └── page.tsx       # 游戏主页面（从存档 ID 加载）
│   │   ├── settings/
│   │   │   └── page.tsx           # 设���页（API Key、模型、外观）
│   │   └── world-builder/
│   │       └── page.tsx           # ��戏设定导入/生成页
│   │
│   ├── components/                # UI 组件（按面板组织）
│   │   ├── layout/                # 布局壳
│   │   │   ├── TopBar.tsx
│   │   │   ├── ThreePanelLayout.tsx
│   │   │   ├── MobileTabBar.tsx
│   │   │   └── ResponsiveWrapper.tsx
│   │   ├── map/                   # 地图面板
│   │   │   ├── MapPanel.tsx
│   │   │   ├── MapCanvas.tsx      # Canvas 渲染层（粒子/迷雾）
│   │   │   ├── TileLayer.tsx      # CSS 图块层
│   │   │   ├── EntityLayer.tsx    # CSS 实体层
│   │   │   ├── FogOverlay.tsx     # 战争迷雾叠加
│   │   │   ├── PathLine.tsx       # SVG 路径线
│   │   │   ├── ZoomControls.tsx
│   │   │   └── TileTooltip.tsx
│   │   ├── dialogue/              # 对话面板
│   │   │   ├── DialoguePanel.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── AIAvatar.tsx
│   │   │   ├── PlayerInput.tsx
│   │   │   ├── SuggestedActions.tsx
│   │   │   ├── DecisionModal.tsx
│   │   │   ├── StreamText.tsx     # 流式文本渲染
│   │   │   └── SkeletonWave.tsx   # AI 思考骨架屏
│   │   ├── status/                # 状态面板
│   │   │   ├── StatusPanel.tsx
│   │   │   ├── PlayerStats.tsx
│   │   │   ├── InventoryPreview.tsx
│   │   │   ├── QuestLog.tsx
│   │   │   └── MemoryTimeline.tsx
│   │   ├── session/               # 会话管理
│   │   │   ├── RecapPanel.tsx     # 会话恢复摘要（§5.2 记忆引擎GDD）
│   │   │   ├── SaveLoadModal.tsx
│   │   │   └── SessionTimer.tsx   # 会话时长监控
│   │   └── shared/                # 共享 UI
│   │       ├── Button.tsx
│   │       ├── Modal.tsx
│   │       ├── Panel.tsx
│   │       ├── Toast.tsx
│   │       ├── Tooltip.tsx
│   │       ├── Scrollbar.tsx
│   │       └── Icon.tsx
│   │
│   ├── systems/                   # 核心游戏系统（纯 TypeScript）
│   │   ├── memory/                # 记忆引擎
│   │   │   ├── MemoryEngine.ts    # 主类 (IMemoryEngine)
│   │   │   ├── EntityExtractor.ts # 规则引擎实体提取
│   │   │   ├── GraphBuilder.ts    # 关系图谱构建
│   │   │   ├── ContextRetriever.ts# 上下文检索器
│   │   │   ├── Compressor.ts      # 记忆压缩（两阶段）
│   │   │   └── types.ts           # 记忆引擎类型（复用 GDD 定义）
│   │   ├── dialogue/              # 对话系统
│   │   │   ├── DialogueSystem.ts  # 主类 (IDialogueSystem)
│   │   │   ├── PromptAssembler.ts # 四层 Prompt 组装
│   │   │   ├── ResponseParser.ts  # [NARRATIVE]/[ACTIONS]/[STATE]/[DECISION] 解析
│   │   │   ├── FakeChoiceDetector.ts # 假选择检测
│   │   │   ├── TokenEstimator.ts  # Token 估算工具
│   │   │   └── types.ts           # 对话系统类型
│   │   ├── map/                   # 地图系统
│   │   │   ├── MapSystem.ts       # 主类 (IMapSystem)
│   │   │   ├── Pathfinder.ts      # A* 寻路
│   │   │   ├── FogManager.ts      # 战争迷雾管理
│   │   │   ├── CoordinateUtils.ts # 等距坐标 ↔ 屏幕坐标转换
│   │   │   ├── RegionLoader.ts    # 区域加载/卸载
│   │   │   └── types.ts           # 地图系统类型
│   │   └── world/                 # 世界状态
│   │       ├── WorldState.ts      # 世界状态聚合
│   │       ├── GameSetting.ts     # 游戏设定文件解析器
│   │       └── types.ts
│   │
│   ├── infrastructure/            # 基础设施
│   │   ├── openrouter/            # OpenRouter 客户端
│   │   │   ├── client.ts          # API 调用 (streaming + non-streaming)
│   │   │   ├── model-catalog.ts   # 可用模型列表 + 定价
│   │   │   └── types.ts
│   │   ├── storage/               # 持久化适配器
│   │   │   ├── localStorage.ts    # localStorage 封装（配额管理 + 降级）
│   │   │   ├── indexedDB.ts       # IndexedDB 封装（分片 + 压缩）
│   │   │   ├── memory-fallback.ts # 内存回退（隐私模式）
│   │   │   └── storage-router.ts  # 自动选��最佳存储后端
│   │   ├── save/                  # 存档系统
│   │   │   ├── SaveManager.ts     # 存档/读档/删除
│   │   │   ├── SaveSerializer.ts  # 世界状态序列化/反序列化
│   │   │   └── types.ts
│   │   └── analytics/             # 遥测（可选）
│   │       └── telemetry.ts       # 性能/行为遥测事件
│   │
│   ├── stores/                    # Zustand 状态管理
│   │   ├── world-store.ts
│   │   ├── dialogue-store.ts
│   │   ├── map-store.ts
│   │   ├── ui-store.ts
│   │   └── middleware/            # 自定义中间件
│   │       ├── persist.ts         # Zustand → localStorage 持久化中间件
│   │       └── logger.ts          # 开发日志中间件
│   │
│   ├── lib/                       # 共享工具
│   │   ├── types/                 # 全局类型（从 GDD 提取的共享接口）
│   ��   │   ├── entity.ts          # EntityType, RelationType, EventTag
│   │   │   ├── events.ts          # EventLogEntry, EventType
│   │   │   └── game.ts            # NarrativeState, SaveSlotMeta, GameSetting
│   │   ├── utils/                 # 纯工具函数
│   │   │   ├── id.ts              # UUID v4 生成
│   │   │   ├── tokenizer.ts       # 简单 token 计数（估算法）
│   │   │   ├── debounce.ts
│   │   │   └── clamp.ts
│   │   └── constants/             # 常量
│   │       ├── models.ts          # 默认模型列表
│   │       ├── limits.ts          # 各系统软/硬上限
│   │       └── theme.ts           # CSS 变量名映射
│   │
│   └── styles/                    # 全局样式
│       ├── globals.css            # CSS 变量 + 重置 + 字体
│       ├── themes/
│       │   ├── dark.css           # 暗色主题（美术圣经 §3.1）
│       │   └── light.css          # 亮色主题（美术圣经 §3.2）
│       └��─ accessibility/
│           ├── reduced-motion.css
│           └── high-contrast.css
│
├── tests/                         # 测试
│   ├── unit/                      # 单元测试（Vitest）
│   │   ├── systems/
│   │   │   ├── memory/
│   │   │   ├── dialogue/
│   │   │   └── map/
│   │   ├── infrastructure/
│   │   └── lib/
│   ├── integration/               # 集成测试
│   │   ├── memory-dialogue.test.ts
│   │   ├── map-dialogue.test.ts
│   │   └── save-load.test.ts
│   └── e2e/                       # E2E (Playwright)
│       └── game-flow.spec.ts
│
├── docs/
│   ├── architecture/
│   │   ├── overview.md            # 本文档
│   │   ├── adr/
│   │   │   ├── 001-frontend-vs-backend.md
│   │   │   ├── 002-map-rendering.md
│   │   │   └── 003-prompt-context-assembly.md
│   │   └── tech-checklist.md
│   └── engine-reference/          # 引擎参考（未来）
│
├── next.config.ts
├── tailwind.config.ts             # 如果使用 Tailwind（推荐）
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── package.json
└── CLAUDE.md                      # AI 助手指令
```

---

## 5. 数据流设计

### 5.1 主数据流：对话循环

```
┌──────────┐   PlayerInput    ┌──────────────┐
│  Player  │──────────────────▶│  Dialogue    │
│  Input    │                  │  System      │
└──────────┘                  └──────┬───────┘
                                     │
                         ① 请求记忆上下文
                                     │
                                     ▼
                              ┌──────────────┐
                              │  Memory      │
                              │  Engine      │
                              │  retrieve()  │
                              └──────┬───────┘
                                     │
                         ② 返回 MemoryContext
                                     │
                                     ▼
                              ┌──────────────┐
                              │  Prompt      │
                              │  Assembler   │
                              │  (4 layers)  │
                              └──────┬───────┘
                                     │
                         ③ 组装完成的 Prompt
                                     │
                                     ▼
                              ┌──────────────┐
                              │  OpenRouter  │
                              │  Client      │
                              │  (SSE Stream)│
                              └──────┬───────┘
                                     │
                         ④ 流式 Token → UI
                                     │
                                     ▼
                              ┌──────────────┐
                              │  Response    │
                              │  Parser      │
                              │ [NARRATIVE]  │
                              │ [ACTIONS]    │
                              │ [STATE]      │
                              │ [DECISION]   │
                              └──────┬───────┘
                                     │
                         ⑤ 解析后的内容块
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                 ▼
              ┌──────────┐   ┌──────────┐    ┌──────────────┐
              │UI 更新    │   │Memory    │    │Map System    │
              │- 消息列表 │   │Engine    │    │- 位置更新    │
              │- 建议动作 │   │ingest()  │    │- 实体移动    │
              │- 状态栏   │   │          │    │              │
              └──────────┘   └──────────┘    └──────────────┘
```

### 5.2 地图交互 → 对话触发流

```
┌──────────┐   click tile    ┌──────────────┐
│  Map     │─────────────────▶│  Map System  │
│  Panel   │                  │  moveTo()    │
└──────────┘                 └──────┬───────┘
                                    │
                         ① A* 寻路 + 移动动画
                                    │
                         ② 到达 → 检查 TileEvent
                                    │
                                    ▼
                              ┌──────────────┐
                              │  Dialogue    │
                              │  System      │
                              │  sendMessage │
                              │  (text: '')  │
                              └──────────────┘
                                    │
                         ③ 空文本触发 AI GM 主动叙述
                                    │
                         ④ [STATE] 含 locationChange
                                    │
                                    ▼
                              ┌──────────────┐
                              │  Map System  │
                              │  moveTo()    │
                              │  (如 AI 触发  │
                              │   传送等)    │
                              └──────────────┘
```

### 5.3 存档/读档数据流

```
存档 (Save):
  WorldStore ──▶ SaveSerializer ──▶ { worldState, mapState, memoryGraph, dialogueSession }
                                          │
                                          ▼
                                   localStorage / IndexedDB (3 slots)

读档 (Load):
  localStorage/IndexedDB ──▶ SaveSerializer ──▶ WorldStore.load()
                                                 MapStore.loadMapState()
                                                 MemoryEngine.init()
                                                 DialogueSystem.init()
```

---

## 6. 状态管理方案

### 6.1 最终决定：Zustand + 手动 persist 中间件

见 §2.2 对比表。补充关键理由：

1. **性能隔离**：地图 60fps 渲染循环只需要 `mapStore` 的 `playerCoord`，不应触发对话面板重渲染。Zustand 的 selector 模式天然支持。
2. **Bundle 预算**：~1KB vs Redux Toolkit ~11KB——游戏首屏 <500KB，每 KB 都有代价。
3. **测试友好**：Zustand store 可在测试中直接 `create()` 隔离实例，无需 Provider 包裹。

### 6.2 持久化中间件

```typescript
// stores/middleware/persist.ts
// 自定义 persist 中间件（替代 zustand/middleware persist）
// 原因：需要控制序列化时机（存档点），而非每次 state 变化都写入
//
// 手动触发：worldStore.getState().__persist()
// 自动触发：会话结束时 (beforeunload)
```

### 6.3 不可序列化对象的处理

- `Map<string, T>` → `Record<string, T>` (JSON 兼容)
- `MemoryEngine` / `DialogueSystem` / `MapSystem` 实例 → 不存入 store（它们是单例，由 Store 通过 ref 持有）
- 存储布局：

```typescript
// stores/dialogue-store.ts 内部
let dialogueSystemRef: DialogueSystem | null = null;

export const useDialogueStore = create<DialogueSlice>((set, get) => ({
  // ... 可序列化状态
  
  sendMessage: async (input) => {
    // 通过 ref 调用核心系统
    const result = await dialogueSystemRef!.sendMessage(input);
    // 更新 store 中的可序列化部分
    set({ messages: [...get().messages, result] });
  }
}));

// 初始化时注入
export function initializeDialogue(ds: DialogueSystem) {
  dialogueSystemRef = ds;
}
```

---

## 7. 路由设计

### 7.1 Next.js App Router 路由表

| 路由 | 页面 | 布局 | 说明 |
|------|------|------|------|
| `/` | Landing | `layout.tsx` (最小壳) | 游戏介绍、开始新游戏、继续游戏、设置入口 |
| `/game/[id]` | 游戏主页面 | `game/layout.tsx` (三面板) | id = 存档槽位 ID 或 'new' |
| `/settings` | 设置页面 | `layout.tsx` (最小壳) | API Key、模型选择、主题、音效 |
| `/world-builder` | 设定导入/生成 | `layout.tsx` (最小壳) | JSON/YAML 导入、AI 生成 Prompt 输入 |

### 7.2 布局嵌套

```
app/layout.tsx                    ← 主题 Provider + 字体 + 全局 Toast
├── app/page.tsx                  ← Landing
├── app/game/layout.tsx           ← 三面板壳 (TopBar + Map/Dialogue/Status)
│   └── app/game/[id]/page.tsx   ← 游戏主页面
├── app/settings/page.tsx         ← 设置
└── app/world-builder/page.tsx    ← 设定管理
```

### 7.3 路由守卫

- `/game/[id]` 进入前检查：
  - localStorage 中是否有有效的 API Key → 无则 redirect `/settings?redirect=/game/[id]`
  - 存档 ID 是否存在 → 不存在则 redirect `/`
- 使用 Next.js `middleware.ts` 实现（仅在客户端检查 API Key）：

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  // 仅对 /game/* 路由检查
  // 注意：API Key 仅在客户端可读（localStorage）
  // middleware 仅检查 cookie 中是否有 "hasApiKey=true" 标记
}
```

---

## 8. 数据持久化方案

### 8.1 三层存储架构

```
┌────────────────────────────────────────────────────────┐
│ Layer 1: 内存 (React State + Zustand)                    │
│ ─────────────────────────────────────────────────────── │
│ • 即时记忆 (~200 条事件)                                 │
│ • 当前会话消息历史                                       │
│ • 地图渲染状态（当前显示区域）                            │
│ • 流式接收中的文本                                       │
│                                                          │
│ 生命周期: 页面刷新 → 丢失                                │
│ 容量: ~50MB (浏览器内存限制)                             │
├────────────────────────────────────────────────────────┤
│ Layer 2: localStorage                                    │
│ ─────────────────────────────────────────────────────── │
│ • 短期记忆摘要 (最近 5 次会话)                            │
│ • API Key                                                │
│ • 用户偏好（主题、模型选择、音量）                        │
│ • 会话恢复元数据                                         │
│                                                          │
│ 生命周期: 手动清除 / 浏览器数据清除                       │
│ 容量: ~5-10MB (浏览器限制)                               │
│ 同步: 同步 API，读取无延迟，适合快速恢复                  │
├────────────────────────────────────────────────────────┤
│ Layer 3: IndexedDB                                       │
│ ─────────────────────────────────────────────────────── │
│ • 完整记忆图谱 (MemoryGraph)                             │
│ • 世界数据 (Region/Tile/Entity)                          │
│ • 存档快照 (3 slots × 完整世界状态)                      │
│ • 对话历史会话 (压缩后)                                  │
│                                                          │
│ 生命周期: 手动清除 / 浏览器数据清除                       │
│ 容量: ~浏览器磁盘配额的 50% (通常 >100MB)                │
│ 同步: 异步 API，支持索引查询                             │
└────────────────────────────────────────────────────────┘
```

### 8.2 存储后端选择逻辑

```typescript
// infrastructure/storage/storage-router.ts

async function getStorageBackend(): Promise<StorageBackend> {
  // 1. 尝试 IndexedDB
  if (await isIndexedDBAvailable()) {
    return 'indexeddb';
  }
  
  // 2. 降级到 localStorage
  if (isLocalStorageAvailable()) {
    console.warn('[Storage] IndexedDB 不可用，降级到 localStorage');
    return 'localstorage';
  }
  
  // 3. 内存模式（隐私浏览）
  console.warn('[Storage] 持久化存储不可用，数据将在页面刷新后丢失');
  return 'memory';
}
```

### 8.3 存档文件结构

```typescript
// infrastructure/save/types.ts

interface SaveFile {
  version: string;                    // 存档格式版本 "1.0.0"
  createdAt: number;
  lastPlayedAt: number;
  playTimeMs: number;                 // 累计游戏时间
  slotId: string;                     // slot_0 | slot_1 | slot_2
  label: string;                      // 玩家自定义标签
  
  // 三个子系统的状态快照
  worldState: {
    playerName: string;
    playerClass: string;
    playerAttributes: Record<string, number>;
    gameSettingId: string;
    narrativeState: NarrativeState;
  };
  mapState: MapState;                 // 见地图 GDD §3.1
  memoryGraph: MemoryGraph;           // 见记忆引擎 GDD §3.1
  
  // 对话历史（压缩版）
  dialogueHistory: {
    sessionSummaries: SessionMemory[];
    decisionTree: DecisionNode[];
  };
  
  // 校验
  checksum: string;                   // SHA-256 of above
}
```

### 8.4 存储容量监控

```typescript
// 定期检查（存档前 / 会话结束后）
async function checkStorageQuota(): Promise<QuotaReport> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage!,
      quota: estimate.quota!,
      usagePercent: (estimate.usage! / estimate.quota!) * 100
    };
  }
  // 降级：估算 localStorage 使用量
  return estimateLocalStorageUsage();
}

// 超过 80% 时提示用户清理
```

---

## 9. 渲染架构

### 9.1 地图渲染：CSS + Canvas 混合

详见 ADR-002。这里概述：

```
图层 (从底到顶):
  Layer 0 (地形层)     — CSS transforms, z-index: 0
  Layer 1 (装饰层)     — CSS transforms, z-index: 1
  Layer 2 (实体层)     — CSS transforms, z-index: 2
  Layer 3 (粒子层)     — Canvas 2D overlay, z-index: 3, 30fps
  Layer 4 (UI 叠加层)  — CSS/SVG, z-index: 4
  Layer 5 (战争迷雾)   — Canvas 2D overlay, z-index: 5
```

### 9.2 对话渲染：React 组件

- 消息列表：虚拟滚动（`react-window` 或 `@tanstack/virtual`），处理 500+ 消息
- 流式文本：`requestAnimationFrame` 批量更新 DOM，避免每次 token 触发 React 渲染
- Markdown 支持：使用 `react-markdown` + 安全过滤（XSS 防护）

### 9.3 字体加载策略

```html
<!-- app/layout.tsx head -->
<link rel="preload" as="font" href="/fonts/crimson-text-400.woff2" crossorigin>
<link rel="preload" as="font" href="/fonts/inter-400.woff2" crossorigin>
```
- `font-display: swap` — 防止 FOIT
- 子集化：仅包含 Latin + CJK 基本集（Google Fonts API `&subset=chinese-simplified`）

---

## 10. LLM 接入架构

### 10.1 OpenRouter 客户端设计

```typescript
// infrastructure/openrouter/client.ts

interface OpenRouterClient {
  // 流式调用（主要使用）
  streamChat(
    messages: OpenRouterMessage[],
    callbacks: {
      onToken: (token: string) => void;
      onComplete: (response: LLMResponse) => void;
      onError: (error: OpenRouterError) => void;
    },
    options?: { signal?: AbortSignal }
  ): Promise<void>;
  
  // 非流式（fallback）
  completeChat(
    messages: OpenRouterMessage[],
    options?: { signal?: AbortSignal }
  ): Promise<LLMResponse>;
  
  // 模型管理
  getAvailableModels(): Promise<ModelInfo[]>;
  validateApiKey(): Promise<boolean>;
}

// 重试策略：指数退避 1s → 3s → 9s，最多 3 次
// 超时：30s（可通过 AbortSignal 取消）
```

### 10.2 API Key 安全策略

详见 ADR-001。关键点：

- API Key 存储在 localStorage，仅在浏览器内存中使用
- 所有 OpenRouter 请求直接从浏览器发出（不经过任何中间服务器）
- `.env.local` 仅用于开发调试（`NEXT_PUBLIC_` 前缀不用于 API Key）
- 生产构建不包含任何硬编码 Key

### 10.3 Token 预算模型

```
上下文窗口: 8K tokens (GPT-4o / Claude 3.5 Sonnet / Gemini 1.5 Pro)

分配:
  System Prompt:     ~500 tokens  (固定)
  World Context:     ~300 tokens  (固定)
  Memory Context:    ~800 tokens  (记忆引擎注入)
  Session Context:   ~1500 tokens (最近 N 条对话，可压缩至 ~500)
  Current Input:     ~100 tokens  (平均)
  ───────────────────────────
  请求合计:          ~3200 tokens
  Response Budget:   ~2000 tokens
  ───────────────────────────
  总计:              ~5200 tokens (65% of 8K)
  安全余量:          ~2800 tokens
```

---

## 11. Electron 扩展点预留

### 11.1 抽象层设计

所有浏览器特定 API 通过**适配器接口**访问，Electron 打包时替换实现：

```typescript
// infrastructure/platform/IPlatformAdapter.ts

interface IPlatformAdapter {
  // 存储（Electron 可用 node fs 替代 IndexedDB）
  storage: IStorageBackend;
  
  // 文件对话框（Electron 用原生 dialog）
  showOpenDialog(options: OpenDialogOptions): Promise<string | null>;
  showSaveDialog(options: SaveDialogOptions): Promise<string | null>;
  
  // 窗口控制
  setWindowTitle(title: string): void;
  toggleFullscreen(): void;
  
  // 网络（Electron 可代理请求、管理证书）
  fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
  
  // 系统信息
  getPlatformInfo(): PlatformInfo;
}

// Web 实现
class WebPlatformAdapter implements IPlatformAdapter {
  storage = new StorageRouter();    // localStorage + IndexedDB
  showOpenDialog = webFileInput;    // <input type="file">
  showSaveDialog = webFileDownload;  // <a download>
  fetch = window.fetch.bind(window);
}

// Electron 实现（未来）
class ElectronPlatformAdapter implements IPlatformAdapter {
  storage = new NodeFSStorage();    // node:fs
  showOpenDialog = electronDialog;  // dialog.showOpenDialog()
  fetch = electronNetFetch;         // net.fetch() with cert management
}
```

### 11.2 构建配置预留

```json
// package.json
{
  "main": "electron/main.js",       // Electron 入口（后续添加）
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "export": "next build && next export",  // 静态导出（Electron 渲染进程）
    "electron:dev": "...",           // 后续添加
    "electron:build": "..."          // 后续添加
  }
}
```

### 11.3 关键注意事项

| 关注点 | Web 行为 | Electron 行为（预留） |
|--------|---------|---------------------|
| **API Key 存储** | localStorage | electron-store (加密) |
| **存档位置** | IndexedDB | `userData/saves/` |
| **CSP** | 严格的 Content-Security-Policy | 放宽（允许 node 集成） |
| **OpenRouter** | 浏览器 fetch + SSE | 可代理（本地 HTTP server 转发，隐藏 API Key） |
| **自动更新** | 无需（Web 直接部署） | electron-updater |
| **多窗口** | tab 检测 + 锁 | BrowserWindow 管理 |

---

## 12. 构建与部署

### 12.1 构建流程

```
开发:  next dev (Turbopack)
       ├── HMR (组件热更新)
       └── Fast Refresh

构建:  next build
       ├── TypeScript 类型检查
       ├── ESLint 检查
       ├── Vitest 单元测试
       ├── Playwright E2E (可选，CI)
       └── 产出: .next/static/ (JS/CSS/fonts/images)

部署:  静态导出 (next export) 或 Vercel/EdgeOne Pages
```

### 12.2 目标部署平台

| 平台 | 适用场景 | 注意事项 |
|------|---------|---------|
| **Vercel** | 首选（Next.js 原生支持） | Hobby 计划带宽限制 100GB/月 |
| **EdgeOne Pages** | 国内访问优化 | 需要额外配置 |
| **CloudStudio** | 快速预览 | 开发阶段 |
| **静态托管** (GitHub Pages / Netlify) | 免费部署 | `next export` 静态导出 |

### 12.3 CI/CD 建议

```yaml
# .github/workflows/ci.yml (建议)
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test:unit
      - run: npm run test:integration
  build:
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
      - run: npm run export
```

---

## 13. 性能预算

### 13.1 全应用预算

| 指标 | 目标 | 测量方式 |
|------|------|---------|
| 首屏总大小 (gzip) | < 500KB | Lighthouse / webpack-bundle-analyzer |
| 首屏加载 (FCP) | < 1.5s | Lighthouse |
| 可交互时间 (TTI) | < 3s | Lighthouse |
| JavaScript 主包 | < 150KB gzip | 代码分割 |
| 地图精灵图 | < 200KB | 单张 sprite sheet |
| 字体子集 | < 100KB 每个 | 子集化 + woff2 压缩 |
| 对话首 Token | < 500ms | Performance API |
| 地图渲染帧率 | 60fps (图块), 30fps (粒子) | requestAnimationFrame |
| 迷雾更新 | < 10ms | Performance API |
| 区域切换 | < 300ms (含动画) | Performance API |
| 记忆检索 | < 100ms (1000 条事件) | Performance API |

### 13.2 代码分割策略

```typescript
// 动态导入 - 仅游戏页面需要
const MapSystem = dynamic(() => import('@/systems/map/MapSystem'), { ssr: false });
const MemoryEngine = dynamic(() => import('@/systems/memory/MemoryEngine'), { ssr: false });

// Landing 页不加载游戏核心
// 设置页不加载地图引擎
// 地图页面不加载 react-markdown（仅对话面板需要）
```

### 13.3 运行时内存预算

| 区域 | 预算 | 说明 |
|------|------|------|
| React 组件树 | ~10MB | 虚拟 DOM + 状态 |
| 地图数据 | ~15MB | 当前 + 邻近区域 |
| 记忆图谱 | ~10MB | 实体 + 关系 + 事件日志 |
| Canvas 缓冲 | ~5MB | 粒子 + 迷雾叠加层 |
| 精灵图纹理 | ~5MB | 已解码的 sprite sheet |
| 其他 | ~5MB | |
| **总计** | **~50MB** | Chrome DevTools heap snapshot 测量 |

---

## 附录 A: 与 GDD 的追溯矩阵

| GDD 需求 | 架构对应 |
|---------|---------|
| 概念 M01 (地图点击导航) | `systems/map/` + `components/map/` |
| 概念 M02 (AI GM 对话循环) | `systems/dialogue/` + `infrastructure/openrouter/` |
| 概念 M03 (建议动作) | `components/dialogue/SuggestedActions.tsx` |
| 概念 M04 (基础记忆) | `systems/memory/` + `infrastructure/storage/` |
| 概念 M05 (角色创建) | `stores/world-store.ts` |
| 概念 M06 (基础 HUD) | `components/layout/ThreePanelLayout.tsx` |
| 概念 M07-M08 (游戏设定) | `systems/world/GameSetting.ts` + `app/world-builder/` |
| 概念 M09 (OpenRouter) | `infrastructure/openrouter/` |
| 概念 M10 (存档) | `infrastructure/save/` |
| 对话 GDD (流式 SSE) | `infrastructure/openrouter/client.ts` stream |
| 地图 GDD (CSS+Canvas 混合) | `components/map/TileLayer.tsx` + `MapCanvas.tsx` |
| 记忆 GDD (三层架构) | `systems/memory/MemoryEngine.ts` + `Compressor.ts` |
| 美术圣经 (三面板 360/flex/300) | `components/layout/ThreePanelLayout.tsx` |
| 美术圣经 (暗色主题 CSS 变量) | `styles/themes/dark.css` |

---

## 附录 B: 风险登记表

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| OpenRouter API 延迟/不可达 | 中 | 高 | 重试+降级，非流式 fallback，用户友好的错误提示 |
| IndexedDB 配额不足 | 低 | 中 | 压缩+配额监控+清理引导 |
| 等距渲染性能不达标 | 低 | 中 | 分块渲染+虚拟滚动+性能降级路径 |
| 记忆图谱数据损坏 | 低 | 高 | 版本校验+checksum+快照恢复 |
| 多模型输出格式不一致 | 中 | 中 | [NARRATIVE] 标记强制 + 全文 fallback |
| Token 预算超支 | 中 | 中 | 动态压缩+模型切换建议 |
| 浏览器兼容性问题 | 低 | 低 | 浏览器兼容性目标明确 (见 tech-checklist) |

---

> **下一步**: 主理人审批后，产出 Story 分解，进入实现阶段。
