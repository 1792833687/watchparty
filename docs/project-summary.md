---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: b9b1429a9bfb109779f3dca1b6d368d4_465ec8a78c1e11f18559525400f8a581
    ReservedCode1: 33pX71C7/Qxae1nwIJymKSaSJJGjrPeXS4Ev4JsI1miuGNGU7dXfxHL/MNp1UqXlpYyU7JDw4a/KYIlzK6SFNd4g8uSrX7iTFWO9pNho9u+FjPycq1d1FP2Sb2akLML/UT/o5ildrG54zyEgMO4Klr4+qefPvqLOyOLUDE99ZfjPD77HQJZ/SIgmKMw=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: b9b1429a9bfb109779f3dca1b6d368d4_465ec8a78c1e11f18559525400f8a581
    ReservedCode2: 33pX71C7/Qxae1nwIJymKSaSJJGjrPeXS4Ev4JsI1miuGNGU7dXfxHL/MNp1UqXlpYyU7JDw4a/KYIlzK6SFNd4g8uSrX7iTFWO9pNho9u+FjPycq1d1FP2Sb2akLML/UT/o5ildrG54zyEgMO4Klr4+qefPvqLOyOLUDE99ZfjPD77HQJZ/SIgmKMw=
---

# AI Narrator Game — 项目完整状态总结

> **生成时间**: 2026-07-30  
> **当前版本**: v1.0.0（代码） / v0.6.0（界面标注）  
> **审查方式**: 逐一读取全部核心源文件（约 60+ 文件，15000+ 行）

---

## 一、项目概览

### 1.1 基本信息

| 项 | 值 |
|----|-----|
| 项目名称 | AI Narrator Game（AI GM 文字冒险游戏） |
| 实际版本 | v1.0.0（代码内常量），界面标记为 v0.6.0 |
| 框架 | Next.js 15.5 (App Router) |
| React 版本 | 19（React 19.0.0） |
| 构建模式 | 静态导出 `output: 'export'` |
| 状态管理 | Zustand 5.2.0 + Immer 10 + React useState/useContext |
| 包管理 | npm，Node 22.22.2 managed |
| LLM API | DeepSeek API（直连 `api.deepseek.com/v1/chat/completions`） |
| 默认模型 | `deepseek-chat` |
| 身份验证 | 用户提供的 DeepSeek API Key（`sk-xxxxxxxx`） |
| 已部署 | CloudStudio 静态托管（agentos-app.net 域名） |

### 1.2 运行方式

```bash
# 1. 安装
npm install

# 2. 开发
"C:/Users/17928/.workbuddy/binaries/node/versions/22.22.2/npx" next dev

# 3. 构建（生成 out/ 目录）
"C:/Users/17928/.workbuddy/binaries/node/versions/22.22.2/npx" next build

# 4. 部署到 CloudStudio
# 自动上传 out/ 目录
```

**环境限制**：需要 bypass sandbox（`dangerouslyDisableSandbox`），构建前可能需要删除 `.next/trace`。

### 1.3 完整目录结构

```
C:\Users\17928\WorkBuddy\游戏开发\
├── package.json                   # Next.js 15 + React 19 + Zustand 5 + Immer 10 + idb 8
├── next.config.ts                 # output:'export' + CSP headers
├── tsconfig.json                  # strict 模式，@/* 路径别名
├── design/                        # 设计文档（GDD、art-bible、ux-spec 等）
├── docs/                          # 交接文档（handover.md 等）
├── tests/                         # vitest 单元测试
├── backup/                        # 面板文件备份
├── src/
│   ├── app/
│   │   ├── layout.tsx             # 根布局：CSP meta 标签 + 字体
│   │   ├── page.tsx               # 首页 Landing（v1.0.0，SSG）
│   │   ├── error.tsx / global-error.tsx / loading.tsx / not-found.tsx
│   │   ├── settings/
│   │   │   └── page.tsx           # ★ 设置页：API Key 管理 + 预设选择 + 三种自定义游戏创建
│   │   └── game/
│   │       ├── new/page.tsx       # ★★★ 游戏主页面（1353行，三阶段：旁白→角色→聊天）
│   │       └── [id]/page.tsx      # 旧版游戏页面（未维护）
│   ├── components/
│   │   ├── common/
│   │   │   ├── AIAvatar.tsx       # AI头像（emoji 🦊）
│   │   │   └── ErrorBoundaryWithRetry.tsx  # API 错误边界 + 自动重试
│   │   ├── layout/
│   │   │   ├── GameClient.tsx     # 游戏布局客户端
│   │   │   ├── TopBar.tsx         # 顶部状态栏
│   │   │   └── ThreePanelLayout.tsx # 三面板布局（地图|对话|状态，响应式）
│   │   ├── dialogue/
│   │   │   ├── DialoguePanel.tsx  # 对话面板
│   │   │   └── DecisionModal.tsx  # 决策弹窗
│   │   ├── game/
│   │   │   ├── PanelContainer.tsx        # ★ 面板容器（右侧滑入，420px）
│   │   │   ├── GamePanelBar.tsx          # ★ 底部5按钮功能栏（64px圆形按钮）
│   │   │   ├── CharacterCreation.tsx     # 角色创建（职业选择+属性分配）
│   │   │   ├── NarratorIntro.tsx         # 旁白叙事组件
│   │   │   ├── QuickSettingsPanel.tsx    # 游戏内快速设置（齿轮按钮）
│   │   │   └── panels/
│   │   │       ├── types.ts              # PanelId / GameState / GameItem / GameQuest / GameRegion
│   │   │       ├── CharacterPanel.tsx    # 角色属性面板
│   │   │       ├── InventoryPanel.tsx    # 物品背包面板（绑定 GameState.items）
│   │   │       ├── QuestPanel.tsx        # 任务日志面板（绑定 GameState.quests）
│   │   │       ├── SkillsPanel.tsx       # 技能树面板（按职业 classId 分类）
│   │   │       └── MapPanel.tsx          # 地图导航面板（绑定 GameState.regions）
│   │   ├── map/
│   │   │   └── MapPanel.tsx             # 地图组件
│   │   ├── status/
│   │   │   └── StatusPanel.tsx          # 状态栏（HP/MP/属性/背包预览）
│   │   ├── settings/
│   │   │   ├── TextImportPanel.tsx       # 文本导入面板（AI 解析）
│   │   │   ├── ModuleBuilderPanel.tsx    # 模块化拼搭面板（6维度）
│   │   │   └── CustomGameList.tsx        # 已创建游戏列表（可编辑/删除）
│   │   └── save/
│   │       └── SaveLoadPanel.tsx         # 存档管理UI（3槽位，导入/导出JSON）
│   ├── infrastructure/
│   │   ├── openrouter/
│   │   │   └── client.ts                # OpenRouter 客户端（668行，多模型支持）
│   │   ├── crypto/
│   │   │   └── secure-storage.ts        # ★ AES-GCM 加密存储（Web Crypto API）
│   │   └── storage/
│   │       ├── IStorageAdapter.ts        # 存储接口
│   │       ├── LocalStorageAdapter.ts    # localStorage 实现
│   │       └── IndexedDBAdapter.ts       # IndexedDB 实现
│   ├── lib/
│   │   ├── constants/
│   │   │   └── index.ts                 # 全局常量（token预算/地图/存档/UI/模型）
│   │   └── utils/
│   │       ├── tokenizer.ts             # Token 计数器
│   │       ├── id.ts                    # UUID 生成器
│   │       ├── sse-stream.ts            # ★ SSE 流式输出（streamChat + fetchChat 降级）
│   │       └── export-dialogue.ts       # ★ 对话导出 Markdown/TXT
│   ├── stores/
│   │   ├── world-store.ts              # Zustand: 玩家属性/游戏设定/存档槽
│   │   ├── dialogue-store.ts           # Zustand: 对话状态（IDialogueSystem 注入）
│   │   ├── ui-store.ts                 # Zustand: 面板管理/Toast/设置状态
│   │   └── map-store.ts                # Zustand: 地图状态（moveTo 未实现）
│   └── systems/
│       ├── dialogue/
│       │   ├── types.ts                # DialogueMessage / StateDelta / DecisionNode
│       │   ├── dialogue-session.ts     # IDialogueSystem 实现（worldVersion 条件自增）
│       │   ├── prompt-assembler.ts     # Prompt 组装器（含动态 sessionDurationMinutes）
│       │   └── response-parser.ts      # AI 响应解析器
│       ├── memory/
│       │   ├── types.ts                # 记忆系统类型
│       │   ├── entity-extractor.ts     # NER 实体提取（词典外置 JSON）
│       │   ├── memory-engine.ts        # 三层记忆引擎（entityNameIndex Map 索引）
│       │   ├── compressor.ts           # 记忆压缩器（温和/激进两阶段）
│       │   ├── context-retriever.ts    # 上下文检索
│       │   └── storage-sync.ts         # 存储同步（降级通知）
│       ├── combat/
│       │   └── combat-engine.ts        # 战斗引擎（6元素反应表 + 连击 + 环境修饰）
│       ├── achievements/
│       │   └── achievement-system.ts   # 成就系统（20+成就，4类别）
│       ├── events/
│       │   └── event-engine.ts         # 世界事件引擎（加权随机 + 事件链 + 季节事件）
│       ├── equipment/
│       │   └── equipment-system.ts     # 装备系统（5稀有度 + 词缀池 + 随机生成）
│       ├── faction/
│       │   └── types.ts                # 势力系统类型定义
│       ├── map/
│       │   ├── map-manager.ts          # 地图管理器
│       │   ├── pathfinder.ts           # ★ A* 寻路（二叉堆 MinHeap 优化）
│       │   ├── fog-manager.ts          # 战争迷雾系统
│       │   └── coordinates.ts          # 坐标系统
│       ├── save/
│       │   ├── types.ts                # 存档类型（SaveData / SaveSlotMeta）
│       │   ├── save-manager.ts         # ★ 存档管理器（779行，单例 + 依赖注入）
│       │   └── save-serializer.ts      # ★ 序列化器（版本检查 + 数据迁移 + SHA-256 校验）
│       └── settings/
│           ├── types.ts                # 类型（GameSetting / WorldMeta / CustomGameRecord）
│           ├── settings-loader.ts      # 设定加载（JSON/YAML 加载 + 校验）
│           └── yaml-parser.ts          # YAML 解析器（独立文件，QUAL-1 修复）
```

---

## 二、功能清单（按模块分类）

### 2.1 核心游戏流程（v0.5.0+）

| 功能 | 状态 | 文件 | 说明 |
|------|------|------|------|
| 首页落地页 | ✅ 完成 | `app/page.tsx` | SSG 静态页面，标记 v1.0.0，"开始冒险"跳转 settings |
| API Key 配置 | ✅ 完成 | `app/settings/page.tsx` | AES-GCM 加密存储 + 明文兼容 + 旧版自动迁移 |
| 预设世界选择 | ✅ 完成 | `app/settings/page.tsx` | 荒岛求生 / 奇幻冒险 / 科幻探索 / 现代都市 / 古代武侠 |
| 旁白叙事 | ✅ 完成 | `NarratorIntro.tsx` | 游戏开场叙事过渡动画 |
| 角色创建 | ✅ 完成 | `CharacterCreation.tsx` | 职业选择（每世界3职业）+ 5属性分配（力量/敏捷/智力/体质/魅力） |
| AI GM 聊天 | ✅ 完成 | `game/new/page.tsx` | `handleSend` → DeepSeek API → 流式 SSE 输出 |
| 底部功能栏 | ✅ 完成 | `GamePanelBar.tsx` | 5按钮圆形导航栏（属性/背包/任务/技能/地图），64px |

### 2.2 游戏面板系统（v0.6.0+）

| 功能 | 状态 | 文件 | 说明 |
|------|------|------|------|
| 面板容器 | ✅ 完成 | `PanelContainer.tsx` | 右侧滑入 420px，遮罩层 + ESC 关闭 |
| 角色属性面板 | ✅ 完成 | `CharacterPanel.tsx` | 显示当前角色名/职业/5属性 |
| 背包面板 | ✅ 完成 | `InventoryPanel.tsx` | 绑定 `gameState.items`，支持使用/丢弃，默认物品兜底 |
| 任务面板 | ✅ 完成 | `QuestPanel.tsx` | 绑定 `gameState.quests`，主线/支线分类，进度条 |
| 地图面板 | ✅ 完成 | `MapPanel.tsx` | 绑定 `gameState.regions`，可点击传送，5区域预设 |
| 技能面板 | ✅ 完成 | `SkillsPanel.tsx` | 按职业 `classId` 分类显示技能树，3技能点 |

### 2.3 自定义游戏创建（v0.7.0）

| 功能 | 状态 | 文件 | 说明 |
|------|------|------|------|
| 文本导入模式 | ✅ 完成 | `TextImportPanel.tsx` | textarea 粘贴 → AI 解析 → 结构化预览 → 确认保存 |
| 模块化拼搭模式 | ✅ 完成 | `ModuleBuilderPanel.tsx` | 6维度卡片选择 + 兼容性校验 + AI 生成 |
| 已创建游戏列表 | ✅ 完成 | `CustomGameList.tsx` | 可编辑 / 二次编辑 / 删除卡片 |

### 2.4 v1.0.0 新系统

| 功能 | 状态 | 文件 | 说明 |
|------|------|------|------|
| 战斗系统 | ✅ 完成 | `combat-engine.ts` | 6元素（火水风土光暗）→ 20+ 元素反应表，连击链，环境修饰 |
| 成就系统 | ✅ 完成 | `achievement-system.ts` | 20+ 成就（探索/战斗/收集/叙事），每次 AI 响应后检查 |
| 世界事件 | ✅ 完成 | `event-engine.ts` | 区域危险等级加权，10% 触发率，事件链，季节事件（每30天） |
| 装备系统 | ✅ 完成 | `equipment-system.ts` | 5 稀有度（普通→传说），词缀池，耐久度，起始装备生成 |
| 势力系统 | ⚠️ 骨架 | `faction/types.ts` | 类型定义完成，UI 未集成 |

### 2.5 品质功能

| 功能 | 状态 | 文件 | 说明 |
|------|------|------|------|
| SSE 流式输出 | ✅ 完成 | `sse-stream.ts` | 打字机效果，失败自动降级 `fetchChat` |
| 存档/读档 | ✅ 完成 | `SaveLoadPanel.tsx` | 3 槽位，保存/加载/删除，JSON 导入/导出，紧急存档 |
| API Key 加密 | ✅ 完成 | `secure-storage.ts` | AES-GCM（Web Crypto），密钥不可提取，sessionStorage 降级 |
| 游戏内快捷设置 | ✅ 完成 | `QuickSettingsPanel.tsx` | 齿轮按钮 → 模型/温度/流式开关 |
| 错误边界 + 重试 | ✅ 完成 | `ErrorBoundaryWithRetry.tsx` | API 错误自动重试 + 手动重试按钮 |
| 对话导出 | ✅ 完成 | `export-dialogue.ts` | 导出 Markdown/TXT |

### 2.6 底层基础设施

| 功能 | 状态 | 文件 | 说明 |
|------|------|------|------|
| 三层记忆引擎 | ✅ 完成 | `memory-engine.ts` | 即时(RingBuffer)→短期(localStorage)→长期(IndexedDB占位) |
| OpenRouter 客户端 | ✅ 完成 | `infrastructure/openrouter/client.ts` | 多模型路由，自动重试，超时控制 |
| A* 寻路 | ✅ 完成 | `pathfinder.ts` | 二叉堆 MinHeap，对角线裁剪，< 1000 次迭代 |
| 战争迷雾 | ✅ 完成 | `fog-manager.ts` | 视野半径可见性计算 |
| 存储适配器 | ✅ 完成 | `IStorageAdapter.ts` | localStorage + IndexedDB 双实现 |

---

## 三、数据流架构

### 3.1 Zustand Store 映射

```
┌─────────────────────────────────────────────────────────────┐
│                     Zustand Stores                          │
├───────────────┬───────────────┬───────────────┬─────────────┤
│  world-store  │dialogue-store │   ui-store    │  map-store  │
│               │               │               │             │
│ • playerName  │ • messages[]  │ • activePanel │ • tiles     │
│ • playerClass │ • isLoading   │ • toasts[]    │ • viewport  │
│ • attributes  │ • sessionId   │ • modals      │ • fog       │
│ • gameSetting │ • worldVer    │ • settings    │ • playerPos │
│ • saveSlots   │ • decisionNode│               │ • moveTo()  │
│               │               │               │   (骨架)    │
└───────────────┴───────────────┴───────────────┴─────────────┘
                          ↑
               React useState (game/new/page.tsx)
          characterData / gameState / messages / phase
```

### 3.2 localStorage Key 清单

| Key | 用途 | 存储方式 |
|-----|------|----------|
| `ai-narrator-sec:deepseek-api-key` | API Key | **AES-GCM 加密**（`secureSet`/`secureGet`） |
| `ai-narrator-openrouter-api-key` | API Key（旧版明文） | 明文兼容，已标记迁移 |
| `ai-narrator-selected-preset` | 选择的预设ID | 明文 |
| `ai-narrator-imported-setting` | AI导入的自定义游戏设定JSON | 明文 |
| `custom-api-config` | 自定义API端点配置 | 明文 |
| `ai-narrator-save-slots` | 存档位 | 明文（含 SHA-256 校验和） |
| `ai-narrator-custom-games` | 自定义游戏列表 | 明文 |
| `ai-narrator-game-state` | 游戏状态快照 | 明文 |
| IndexedDB: `ai-narrator-secure-storage` | AES-GCM 密钥 | **不可提取** CryptoKey |

### 3.3 API 调用链路

```
用户输入 text
    │
    ▼
handleSend() [game/new/page.tsx]
    │
    ├── 1. 构建 system prompt (buildWorldSystemPrompt)
    │       └── 世界设定 + 角色属性 + ---GAMESTATE--- JSON 格式指令
    │
    ├── 2. 读取 API Key
    │       └── secureGet('deepseek-api-key') → localStorage fallback → custom-api-config
    │
    ├── 3. 发送请求
    │       ├── 优先: streamChat() ── SSE 流式 ── onToken 逐字渲染
    │       └── 降级: fetchChat() ── 非流式 ── onError 回调中兜底
    │
    ├── 4. 解析响应
    │       ├── stripGameStateBlock() ── 移除 ---GAMESTATE--- 块
    │       ├── parseGameState() ── 解析结构化 JSON → 更新 gameState
    │       └── displayContent ── 纯叙事文本展示
    │
    ├── 5. v1.0.0 后处理
    │       ├── 战斗关键词检测 → resolveCombat() → 元素反应/连击/Log
    │       ├── 成就检查 → checkAchievements() → 弹窗 Toast
    │       └── 世界事件 → rollWorldEvent() → 10% 概率系统消息
    │
    └── 6. dayCount++
```

### 3.4 面板数据绑定

```
PanelContainer
│  props: gameState, characterName, characterClass, characterAttributes
│
├── CharacterPanel ← characterName / characterClass / characterAttributes
├── InventoryPanel ← gameState.items (空数组时使用 getDefaultItems 兜底)
├── QuestPanel     ← gameState.quests (空数组时使用 getDefaultQuests 兜底)
├── SkillsPanel    ← classId（按职业分类） + skillPoints=3
└── MapPanel       ← gameState.currentLocation / regions / unlockedRegions
                     支持 onTravel() 点击传送
```

---

## 四、已修复的 BUG 汇总（18 项）

| # | 类别 | 文件 | 修复内容 |
|---|------|------|----------|
| BUG-1 | 🔴 逻辑 | `memory-engine.ts:460` | 重要性提升 `+0` → `+1` |
| BUG-2 | 🟡 逻辑 | `memory-engine.ts:573` | `findExistingEntity` 使用 `entityNameIndex` Map 替代数组索引 |
| BUG-3 | 🟡 逻辑 | `dialogue-session.ts:405` | `worldVersion` 仅在 StateDelta 包含世界状态变更时递增 |
| BUG-4 | 🟡 补全 | `prompt-assembler.ts:188` | `{SESSION_DURATION}` / `{TIME_SINCE_LAST_EVENT}` 从 `gameSetting` 动态传入 |
| BUG-5 | 🟢 健壮 | `save-serializer.ts:335` | `btoa(String.fromCharCode(...))` 分块处理避免栈溢出 |
| BUG-6 | 🟡 逻辑 | `pathfinder.ts:112` | `isDiagonalMove()` 动态判断替代硬编码索引 |
| PERF-1 | 🟡 性能 | `pathfinder.ts:53-98` | A* 优先队列从线性搜索 → 二叉堆 `MinHeap` |
| PERF-2 | 🟡 性能 | `memory-engine.ts:76` | 新增 `entityNameIndex: Map<string,string>` 替代全量扫描 |
| PERF-3 | 🟢 性能 | `save-manager.ts:618` | `structuredClone()` 替代 `JSON.parse(JSON.stringify())` |
| QUAL-1 | 🟡 维护 | `yaml-parser.ts` | YAML 解析器从 `settings-loader.ts`(1434行) 提取为独立文件 |
| QUAL-2 | 🟡 维护 | `dictionaries.json` | 词典数据从 `entity-extractor.ts`(707行) 外置为 JSON |
| QUAL-3 | 🟢 逻辑 | `world-store.ts:143` | `addSaveSlot` 增加去重逻辑 |
| QUAL-5 | 🟢 逻辑 | `dialogue-store.ts:322` | `sceneType` 使用 `??` 替代 `||`，空字符串不再误 fallback |
| ERR-1 | 🟡 错误 | `save-manager.ts:763` | `emergencySave` 捕获异常后 `console.error` 记录 |
| ERR-2 | 🟡 错误 | `storage-sync.ts:38` | IndexedDB 降级时通过回调通知用户（Toast） |
| ERR-3 | 🟢 错误 | `indexeddb-adapter.ts:70` | 区分 `NotFoundError`（key 不存在）和真实读取错误 |
| SEC-1 | 🔴 安全 | `settings/page.tsx` + `game/new/page.tsx` | API Key 从 `localStorage` 明文 → `secureSet`/`secureGet` AES-GCM 加密 |
| SEC-2 | 🟡 安全 | `next.config.ts` + `layout.tsx` | 新增 CSP 头配置（服务端 + meta 标签浏览器端防线） |

---

## 五、待办 / 未完成项

### 5.1 已知缺陷

| # | 严重度 | 位置 | 问题 |
|---|--------|------|------|
| TODO-1 | 🟡 | `map-store.ts` | `moveTo()` 方法仅为骨架（抛出 `Not implemented` 错误），地图移动未集成 |
| TODO-2 | 🟡 | `faction/types.ts` | 势力系统仅类型定义，无 UI 组件和游戏内集成 |
| TODO-3 | 🟡 | `SkillsPanel.tsx` | 技能数据按 `classId` 硬编码，不支持通过 GameState.skills 动态更新 |
| TODO-4 | 🟢 | `page.tsx:517` | `setSessionSeed` 调用但方法未定义（可能遗漏 export），不影响主流程 |
| TODO-5 | 🟢 | `ThreePanelLayout.tsx` | 三面板布局已经实现但 `game/new/page.tsx` 未使用它，仍用旧版单栏布局 |
| TODO-6 | 🟢 | `GamePanelBar.tsx` | 按钮尺寸硬编码 64px，移动端 320px 屏宽可能溢出 |
| TODO-7 | 🟢 | 全局 | 多处 `try/catch` 静默吞掉异常（如战斗解析、成就检查、事件引擎），调试困难 |

### 5.2 扩展建议

| 优先级 | 项目 | 说明 |
|--------|------|------|
| 高 | 多人预设世界切换 | `BUILD_PRESET` switch 已就绪，但未实现在游戏内切换世界 |
| 高 | 长期记忆 IndexedDB | `memory-engine.ts` 中 IndexedDB 持久化仅为占位 |
| 中 | 存档云同步 | 当前仅本地存储，可扩展导入/导出或云同步 |
| 中 | 流式降级 UI 指示 | SSE 失败降级静默，用户无感知 |
| 低 | 集成三面板布局 | `ThreePanelLayout` 已实现但未接入 `game/new/page.tsx` |
| 低 | 势力系统前端 | `faction/types.ts` 类型完成，待 UI 和交互 |

---

## 六、交接要点

### 6.1 构建命令

```bash
# 开发环境
cd "C:\Users\17928\WorkBuddy\游戏开发"

# 使用 Node 22.22.2 managed 版本
"C:/Users/17928/.workbuddy/binaries/node/versions/22.22.2/npx" next dev

# 构建（静态导出 → out/）
"C:/Users/17928/.workbuddy/binaries/node/versions/22.22.2/npx" next build

# 清除锁文件（若构建失败）
rm -f .next/trace
```

### 6.2 关键注意事项

| # | 事项 | 说明 |
|---|------|------|
| 1 | **禁止导入 `openrouter/client`** | 老旧模块有导入链问题，会导致 settings 页面崩溃。如需 LLM 调用，使用 `infrastructure/openrouter/client.ts` |
| 2 | **不使用 Tailwind** | 全局使用纯内联 `style` 对象，Tailwind 仅在 `layout.tsx` 残留 |
| 3 | **CSS 变量依赖** | `game/new/page.tsx` 使用了 `var(--bg-deep)`, `var(--accent-gold)` 等 CSS 自定义变量，定义在全局 `:root` |
| 4 | **preset ID 映射** | 设置页使用 `island-survival`，游戏页使用 `survival`，通过 `PRESET_ID_MAP` 双向映射 |
| 5 | **`_imported` 特殊值** | 预设 ID `_imported` 表示从文本导入或模块拼搭创建的自定义游戏 |
| 6 | **DeepSeek Key 格式** | `sk-xxxxxxxx`（32位），不要混用 OpenRouter key（`sk-or-v1-...`） |
| 7 | **属性名固定** | `strength | agility | intelligence | constitution | charisma`（5属性，不可变） |
| 8 | **API Key 读取优先级** | `secureGet('deepseek-api-key')` → `localStorage('ai-narrator-openrouter-api-key')` → `custom-api-config` |
| 9 | **GAMESTATE 协议** | AI GM 在 `---GAMESTATE---` 分隔符后输出结构化 JSON，页面通过 `parseGameState()` 解析并更新面板数据 |
| 10 | **紧急存档** | `beforeunload` 事件自动触发 `emergencySave()`，但存档是异步的，可能不完整 |

### 6.3 禁止事项

- ❌ 使用 Tailwind class（改用纯内联 style）
- ❌ 导入 `openrouter/client` 旧模块
- ❌ 修改 5 属性名（`strength/agility/intelligence/constitution/charisma`）
- ❌ 在 `game/new/page.tsx` 外部直接修改 `gameState`（必须通过 `setGameState` + `gameStateRef`）
- ❌ 删除 `.next/trace` 外的 `.next` 目录内容（可能导致依赖缓存丢失）
- ❌ 在静态导出中使用 `next/font/google` 在线字体（无网络环境会降级）

### 6.4 技术债务概览

| 严重度 | 数量 | 说明 |
|--------|------|------|
| 🔴 高 | 0 | 所有高优问题已修复 |
| 🟡 中 | 6 | 3 个未完成（map/faction/SkillsPanel）+ 3 个静默异常吞没 |
| 🟢 低 | 5 | 细节优化（三面板未接入、按钮溢出、setSessionSeed 未定义等） |

---

*此文档基于 2026-07-30 实际代码审查，覆盖约 60+ 源文件，15000+ 行代码。*
*（内容由AI生成，仅供参考）*
