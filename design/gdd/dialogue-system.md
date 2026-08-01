# GDD: 对话系统 (Dialogue System)

> **子系统编号**: SYS-DLG-001  
> **作者**: 文策渊 (Vince Coyer)  
> **状态**: Draft  
> **版本**: 0.1.0  
> **依赖**: 记忆引擎 (SYS-MEM-001)、OpenRouter API  
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

对话系统是 AI Narrator Game 的**核心交互界面**——它是玩家与 AI GM 之间的唯一通信通道。不同于传统 RPG 的"选项菜单"或纯 AI 聊天机器人的"无约束对话"，本系统实现了一种**结构化自由对话**：日常交互中玩家可以自由表达，在叙事关键节点 AI GM 主动收敛为预设选项，防止选择瘫痪。

**一句话定义**：对话系统是"AI GM 的嘴和耳朵"——它将玩家意图翻译为游戏动作，将 AI 的叙事回应翻译为沉浸式体验。

### 1.2 与概念支柱的映射

| 支柱 | 对话系统如何支撑 |
|------|-----------------|
| **支柱 I: AI 即 GM** | ★★★ 核心支柱——对话系统承载 AI GM 的全部叙事输出；主动引导、说"不"的边界、叙事约束均在此实现 |
| **支柱 II: 地图即叙事** | 对话中注入空间上下文（当前区域、邻近 POI），地图状态影响对话内容 |
| **支柱 III: 记忆即世界** | 对话是记忆引擎的**主要数据源**；每次对话后记忆引擎提取实体并更新图谱 |
| **支柱 IV: 选择有重量** | 关键抉择在对话系统中呈现；选择分支被追踪、后果不可撤销 |

### 1.3 输入模式：混合对偶

| 模式 | 触发条件 | 交互形式 | 设计意图 |
|------|---------|---------|---------|
| **自由文本** | 日常探索、NPC 对话、环境交互 | `<textarea>` + 发送按钮 | 最大化玩家表达自由度 |
| **关键抉择** | 剧情转折点、道德困境、生死抉择 | 2-5 个预设选项卡片（AI 动态生成） | 防止选择瘫痪，确保分支可追踪 |
| **建议动作** | 每次 AI 回应之后 | 2-5 个可选动作气泡 | 降低"我不知道该干什么"的焦虑 |

**模式切换逻辑**：
```
if (narrativeState === 'climax' || narrativeState === 'decision_point') {
  呈现关键抉择预设选项
  自由文本输入框折叠为次要选项（"其他…"链接）
} else {
  呈现自由文本输入框
  建议动作为辅助（浮动在输入区上方）
}
```

### 1.4 子系统依赖图

```
                    ┌──────────────┐
                    │ OpenRouter   │
                    │ (LLM API)    │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  对话系统     │◀──── 地图系统 (空间上下文)
                    │  (Dialogue)  │◀──── 记忆引擎 (记忆上下文)
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ 记忆引擎  │ │ 地图系统  │ │ 状态管理  │
        │ (推送日志) │ │ (触发事件)│ │ (更新HUD) │
        └──────────┘ └──────────┘ └──────────┘
```

---

## 2. 机制设计

### 2.1 对话核心循环

```
   ┌───────────────────────────────────────────────────┐
   │                                                   │
   ▼                                                   │
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────┐
│玩家输入  │───▶│ Prompt   │───▶│ LLM 调用  │───▶│ AI 流式回应  │
│(文本/选项)│    │ 组装     │    │ (OpenRouter)│   │ + 建议动作    │
└─────────┘    └──────────┘    └──────────┘    └──────┬───────┘
     ▲                                                │
     │                                          ┌─────▼──────┐
     │                                          │ 记忆引擎    │
     │                                          │ 提取+存储   │
     │                                          └─────┬──────┘
     │                                                │
     │                                          ┌─────▼──────┐
     │                                          │ 状态更新    │
     │                                          │ HUD/地图    │
     └──────────────────────────────────────────└────────────┘
                    ← 等待下一次输入 ←
```

### 2.2 AI GM 行为模型

AI 不是被动响应者，而是**主动叙事引导者**。行为由以下约束定义：

| 行为 | 触发条件 | 实现方式 |
|------|---------|---------|
| **环境叙述** | 玩家进入新区域 | 系统 prompt 指示 AI 主动描述环境 |
| **事件推进** | 玩家探索时间过长无进展 | 系统 prompt 含"主动推进"策略，记忆引擎提供未解决 hook |
| **说"不"** | 玩家尝试违反世界规则 | 系统 prompt 含世界规则边界，AI 以 GM 身份拒绝并解释 |
| **呈现抉择** | 剧情达到关键节点 | AI 在回应末尾输出 `[DECISION]` 标记，触发前端抉择面板 |
| **情绪调节** | 连续高强度场景后 | 系统 prompt 含节奏控制策略，AI 引导至安全区域 |
| **结尾钩子** | 会话接近 60-90 分钟 | AI 监测会话时长，在自然停顿点设置悬念 |

### 2.3 Prompt 工程分层架构

```
┌─────────────────────────────────────────────────────┐
│ LAYER 0: System Prompt (固定，~500 tokens)           │
│ ─────────────────────────────────────────────────── │
│ • AI GM 角色定义 ("你是一个桌游主持人…")              │
│ • 行为规则 (主动引导、说"不"的边界、叙事风格)         │
│ • 世界规则 (从游戏设定文件注入的规则约束)             │
│ • 输出格式规范 (叙述文本 + 建议动作 + 可能的选择标记)  │
│ • 节奏控制策略                                        │
├─────────────────────────────────────────────────────┤
│ LAYER 1: World Context (~300 tokens)                 │
│ ─────────────────────────────────────────────────── │
│ • 当前区域描述 + 邻近区域列表 + 可见 NPC              │
│ • 当前时间 / 天气 / 氛围                             │
│ • 从游戏设定注入的世界知识 (派系、魔法规则、历史)     │
├─────────────────────────────────────────────────────┤
│ LAYER 2: Memory Context (~800 tokens)                │
│ ─────────────────────────────────────────────────── │
│ • 相关实体的当前关系摘要                              │
│ • 最近 5 条关键事件                                  │
│ • 上次会话摘要（如果有）                              │
│ • 未解决的悬念/线索                                   │
│ • 当前任务状态                                        │
├─────────────────────────────────────────────────────┤
│ LAYER 3: Session Context (~1500 tokens)              │
│ ─────────────────────────────────────────────────── │
│ • 最近 N 条对话历史 (即时记忆，滑动窗口)              │
│ • 当前会话内的重要状态变化                            │
├─────────────────────────────────────────────────────┤
│ LAYER 4: Current Input (variable)                    │
│ ─────────────────────────────────────────────────── │
│ • 玩家输入文本 (或选中的预设选项)                     │
│ • 当前页面状态 (如选中的地图图块、打开的面板)         │
└─────────────────────────────────────────────────────┘
```

### 2.4 System Prompt 模板核心结构

```markdown
## ROLE
你是一个名为 [DM_NAME] 的桌游主持人 (Game Master)，引导一个单人文字冒险游戏。
你的玩家是一名 [CHARACTER_CLASS]，当前位于 [REGION_NAME]。

## RULES (不可违反)
1. 始终保持 GM 身份——你是世界的管理者，不是玩家的仆人。
2. 玩家不能做世界规则不允许的事。如果玩家尝试，给出合理的世界内解释并拒绝。
3. 主动推进剧情——不要让叙事停滞。如果玩家犹豫，提供引导。
4. 每一个选择都应该有后果。不要提供"假选择"。
5. 用生动的文学化语言描述，但保持响应在 200 字以内（除非是关键叙事场景）。

## WORLD RULES
[从游戏设定文件动态注入的世界规则]

## OUTPUT FORMAT
每次回应按以下格式输出：

[NARRATIVE]
<叙述文本——描述环境、NPC 反应、事件发展>

[ACTIONS]
- <建议动作 1>
- <建议动作 2>
- <建议动作 3>

[STATE]
<状态变化摘要——HP、关系、物品等的文本描述>

// 仅在叙事关键节点使用：
[DECISION]
场景类型: <golden|danger|magic>
选项 A: <选项描述>
选项 B: <选项描述>
选项 C: <选项描述>

## RHYTHM
- 当前会话已进行: [SESSION_DURATION]
- 软上限: 90 分钟——接近上限时寻找自然的章节结束点
- 距离上次关键事件: [TIME_SINCE_LAST_EVENT]
- 如果 > 30 分钟无关键事件，主动推进主线或引入突发事件
```

### 2.5 选择分支追踪

每次关键抉择生成唯一分支 ID，形成决策树：

```typescript
interface DecisionNode {
  id: string;                   // UUID
  parentDecisionId: string | null; // null = 根节点
  sessionId: string;
  timestamp: number;
  
  // 上下文
  narrativeContext: string;     // 抉择前的叙事状态
  promptText: string;           // AI GM 呈现的抉择文本
  
  // 选项
  options: DecisionOption[];
  chosenOptionIndex: number;    // 玩家选择的索引
  
  // 后果追踪
  immediateConsequence: string; // AI 描述的��时后果
  consequenceEventIds: string[]; // 后续产生的事件 ID
  
  // 元数据
  sceneType: 'golden' | 'danger' | 'magic';
  tags: string[];
}
```

**假选择检测机制**：
- AI 回应中的 `[DECISION]` 块被解析后，检查各选项是否导向至少一个可区分的世界状态变化
- 如果两个选项的 `[STATE]` 块完全相同 → 触发假选择警告
- 警告记录到开发日志，但在玩家侧不中断体验（由 AI 自我修正此后的输出）

### 2.6 流式输出策略

```
用户发送输入
    │
    ▼
┌─────────────────────────────────────────────┐
│ 0-500ms: 显示 AI 思考状态                    │
│   - 头像脉动动画                             │
│   - 对话区域底部 skeleton wave 光效          │
├─────────────────────────────────────────────┤
│ 500ms-: 流式接收 token                       │
│   - 逐词/逐句渲染叙述文本                    │
│   - 打字机效果 (可选，默认关闭)              │
│   - 目标: < 3 秒完成首次可见文本输出         │
├─────────────────────────────────────────────┤
│ 完成后:                                      │
│   - [NARRATIVE] → 渲染为叙事气泡             │
│   - [ACTIONS] → 渲染为建议动作卡片           │
│   - [STATE] → 触发 HUD 更新动画              │
│   - [DECISION] → 展开抉择面板 (如有)         │
│   - 同时触发记忆引擎 ingest()                │
└─────────────────────────────────────────────┘
```

### 2.7 对话建议动作生成

每次 AI 回应后自动解析 `[ACTIONS]` 块生成建议：

| 建议类型 | 示例 | 视觉样式 |
|---------|------|---------|
| **对话延续** | "继续询问关于失踪商队的事" | 对话气泡图标 + ghost 按钮 |
| **行动** | "前往狼穴入口" | 地图图标 + ghost 按钮 |
| **检视** | "仔细查看地面上的痕迹" | 放大镜图标 + ghost 按钮 |
| **战斗** | "拔出武器准备战斗" | 剑图标 + danger 边框 |
| **休整** | "在橡树下休息一会儿" | 篝火图标 + ghost 按钮 |

建议动作以浮动卡片形式出现在输入区上方，可点击填入输入框，也可直接点击执行（等同于发送该文本）。

---

## 3. 数据结构

### 3.1 核心 TypeScript 接口

```typescript
// ============================================================
// 对话会话
// ============================================================

interface DialogueSession {
  id: string;                       // = 游戏 session ID
  messages: DialogueMessage[];
  currentNarrativeState: NarrativeState;
  decisionTree: DecisionNode[];
  metadata: DialogueSessionMeta;
}

interface DialogueMessage {
  id: string;
  role: 'player' | 'ai_gm' | 'npc' | 'system';
  speakerName: string;              // 玩家名 / AI GM 名 / NPC 名
  speakerId: string;                // 实体 ID (玩家='player', AI GM='ai_gm')
  content: string;                  // 完整文本
  contentBlocks: ContentBlock[];    // 解析后的结构化块
  timestamp: number;
  
  // 元数据
  sceneType?: 'golden' | 'danger' | 'magic' | null;
  isDecisionPoint: boolean;
  decisionNodeId?: string;          // 如果这是决策回应
  tokenCount: number;               // 估算 token 数
  
  // 状态变化
  stateDelta?: StateDelta;          // 本条消息引发的状态变化
  
  // 建议动作
  suggestedActions: SuggestedAction[];
}

interface ContentBlock {
  type: 'narrative' | 'action' | 'state' | 'decision';
  text: string;
  options?: DecisionOption[];       // type='decision' 时
}

interface StateDelta {
  hpChange?: number;
  mpChange?: number;
  relationshipChanges: Array<{
    entityId: string;
    entityName: string;
    delta: number;                  // -100 ~ +100
    reason: string;
  }>;
  itemChanges: Array<{
    itemName: string;
    action: 'acquire' | 'lose' | 'use';
  }>;
  locationChange?: string;          // 新位置 ID
  questUpdates: Array<{
    questId: string;
    status: 'started' | 'progressed' | 'completed' | 'failed';
    description: string;
  }>;
  narrativeTags: NarrativeTag[];
}

type NarrativeTag = 
  | 'golden_choice'    // 重要选择
  | 'danger_zone'      // 危险
  | 'magic_moment'     // 魔法/神秘
  | 'hook_set'         // 悬念设定
  | 'hook_resolved'    // 悬念解决
  | 'chapter_end';     // 章节结束

interface SuggestedAction {
  id: string;
  text: string;                     // 显示文本
  type: 'conversation' | 'movement' | 'examination' | 'combat' | 'rest' | 'item_use';
  icon: string;                     // 图标代码 (emoji 或 icon ID)
  targetEntityId?: string;          // 如指向特定 NPC/地点
  priority: 1 | 2 | 3;             // 建议优先级
}

interface DecisionOption {
  id: string;
  text: string;
  sceneType: 'golden' | 'danger' | 'magic';
  predictedConsequence: string;     // AI 推测的后果（可显示给玩家）
}

// ============================================================
// 叙事状态
// ============================================================

type NarrativeState = 
  | 'exploration'      // 自由探索
  | 'conversation'     // 与 NPC 交谈中
  | 'tension'          // 紧张/冲突升级
  | 'climax'           // 关键转折 / 高潮
  | 'resolution'       // 后果消化
  | 'combat'           // 战斗中
  | 'resting';         // 休息

interface DialogueSessionMeta {
  sessionDuration: number;          // 累计对话时间 (ms)
  messageCount: number;
  decisionCount: number;
  lastKeyEventTime: number;         // 上次关键事件的时间戳
  narrativeStateHistory: Array<{
    from: NarrativeState;
    to: NarrativeState;
    timestamp: number;
    trigger: string;
  }>;
}

// ============================================================
// LLM 请求/响应
// ============================================================

interface LLMRequest {
  model: string;                    // 'openai/gpt-4o' | 'anthropic/claude-3.5-sonnet' | 'google/gemini-1.5-pro'
  messages: OpenRouterMessage[];
  stream: boolean;
  maxTokens: number;
  temperature: number;
  // 额外 OpenRouter 参数
  provider?: {
    order?: string[];
    allow_fallbacks?: boolean;
  };
}

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMResponse {
  id: string;
  model: string;
  content: string;                  // 完整回复文本
  parsedBlocks: ContentBlock[];     // 解析后的结构化块
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latency: number;                  // 从发送请求到完成的时间 (ms)
  timeToFirstToken: number;         // 首 token 时间 (ms)
}

// ============================================================
// 假选择检测
// ============================================================

interface FakeChoiceWarning {
  decisionNodeId: string;
  options: string[];
  reason: string;                   // 为什么判定为假选择
  stateDeltaComparison: string;     // 各选项的状态变化对比
  severity: 'warning' | 'error';    // warning = 轻微差异, error = 完全相同
}
```

### 3.2 对话历史存储

```
IndexedDB: "dialogue-system"
├── ObjectStore: "sessionHistory"
│   └── key: sessionId → DialogueSession (压缩后的消息数组)
└── ObjectStore: "decisionTrees"
    └── key: worldId → DecisionNode[] (跨会话决策树)

localStorage: "dialogue-system-meta"
├── key: "currentSessionId" → string
├── key: "preferredModel" → string (如 'openai/gpt-4o')
└── key: "narrativeState" → NarrativeState
```

---

## 4. API 契约

### 4.1 对话系统内部 API

```typescript
interface IDialogueSystem {
  // --- 生命周期 ---
  init(config: DialogueConfig): Promise<void>;
  shutdown(): Promise<void>;

  // --- 核心交互 ---
  /** 发送玩家输入（自由文本或选项 ID） */
  sendMessage(input: PlayerInput): Promise<DialogueMessage>;
  
  /** 流式发送，通过回调逐步返回 */
  sendMessageStream(
    input: PlayerInput, 
    onToken: (token: string) => void,
    onBlock: (block: ContentBlock) => void,
    onComplete: (message: DialogueMessage) => void
  ): Promise<void>;

  // --- 建议动作 ---
  /** 获取当前可用的建议动作（可从最近一条 AI 消息中提取） */
  getCurrentSuggestions(): SuggestedAction[];
  
  /** 执行建议动作（等同于发送该建议的文本） */
  executeSuggestion(actionId: string): Promise<DialogueMessage>;

  // --- 历史 ---
  /** 获取最近 N 条消息 */
  getRecentMessages(count: number): DialogueMessage[];
  
  /** 获取完整会话历史 */
  getSessionHistory(): DialogueMessage[];
  
  /** 获取决策树 */
  getDecisionTree(): DecisionNode[];

  // --- 状态 ---
  /** 获取当前叙事状态 */
  getNarrativeState(): NarrativeState;
  
  /** 获取会话元数据 */
  getSessionMeta(): DialogueSessionMeta;
}

interface PlayerInput {
  type: 'free_text' | 'decision_option' | 'suggested_action';
  text: string;
  optionId?: string;
  actionId?: string;
  metadata?: {
    clickedTileId?: string;         // 如果从地图触发
    clickedEntityId?: string;       // 如果点击 NPC/物品
  };
}

interface DialogueConfig {
  model: string;
  temperature: number;              // 默认 0.8
  maxTokens: number;                // 默认 2000
  streamTimeout: number;            // 默认 30000ms
  systemPromptTemplate: string;     // 系统 prompt 模板路径
  enableTypingEffect: boolean;      // 默认 false
}
```

### 4.2 与记忆引擎的接口

```typescript
// 对话系统 → 记忆引擎
// 在每条 AI 消息解析完毕后调用
await memoryEngine.ingest({
  id: crypto.randomUUID(),
  sessionId: dialogueSession.id,
  type: 'dialogue',
  timestamp: Date.now(),
  importance: message.isDecisionPoint ? 3 : 2,
  summary: summarizeForMemory(message.content),      // 内部生成 ≤ 140 字符摘要
  detail: message.content,
  entitiesExtracted: extractEntityIds(message),
  relationsUpdated: extractRelationIds(message),
  tags: message.stateDelta?.narrativeTags ?? [],
  precedingEventId: getLastEventId()
});

// 对话系统 → 记忆引擎: 获取上下���
// 在每次 prompt 组装前调用
const memoryCtx = await memoryEngine.retrieveForContext({
  currentLocation: worldState.playerLocation,
  nearbyEntities: mapSystem.getNearbyEntities(),
  activeQuestIds: worldState.activeQuests,
  playerInput: input.text,
  maxTokens: 800,
  includeLastSession: true
});
```

### 4.3 与地图系统的接口

```typescript
// 地图系统 → 对话系统: 触发区域事件对话
// 当玩家移动到一个有触发事件的图块时
dialogueSystem.sendMessage({
  type: 'free_text',
  text: '',  // 空文本触发 AI GM 主动叙述
  metadata: {
    clickedTileId: tile.id,
    clickedEntityId: tile.entities[0]?.id
  }
});

// 对话系统 → 地图系统: 状态更新
// 解析 [STATE] 块后，如有位置变化
if (stateDelta.locationChange) {
  mapSystem.movePlayer(stateDelta.locationChange);
}
```

### 4.4 OpenRouter 接入

```typescript
interface OpenRouterConfig {
  apiKey: string;                   // 用户提供的 API key
  baseUrl: string;                  // 'https://openrouter.ai/api/v1'
  defaultModel: string;             // 默认 'anthropic/claude-3.5-sonnet'
  availableModels: ModelInfo[];
  httpReferer: string;              // 应用 URL
  appTitle: string;                 // 'AI Narrator Game'
}

interface ModelInfo {
  id: string;                       // OpenRouter model ID
  name: string;                     // 显示名称
  contextLength: number;            // 上下文窗口大小
  promptCost: number;               // $/1M tokens
  completionCost: number;           // $/1M tokens
  supportsStreaming: boolean;
  supportsFunctions: boolean;
}

// 模型切换
async function switchModel(modelId: string): Promise<void> {
  // 验证模型可用性
  // 更新 dialogueConfig.model
  // 提示用户：切换模型可能导致叙事风格变化
}
```

---

## 5. UI 绑定

### 5.1 与美术圣经的映射

| 对话系统功能 | 美术圣经引用 | UI 元素 |
|-------------|-------------|---------|
| 对话面板 | §5.1 三面板布局-对话交互区 | 中央 flex 面板，半透明深色底 + 柔和边框光 |
| AI 叙述文本 | §4.2 text-narrative (17px, 1.75 line-height) | 衬线字体，暖白色，气泡样式 |
| AI 头像 | §8.1 Level 2 头像模式 | 48px 圆形水晶狐狸，左边框 accent-magic 3px |
| AI 思考中 | §8.3 AI 生成内容中 + §8.4 思考中 | skeleton wave + 旋转虚线圆状态指示器 |
| 建议动作卡片 | §6.3 Ghost 按钮 | 漂浮在输入区上方的可选卡片 |
| 关键抉择面板 | §6.5 Modal 样式变体 | 全屏面板，金色/红色/蓝色边框发光 |
| 叙事状态标签 | §3.1 accent-gold/danger/magic | 金色=重要选择，红色=危险，蓝色=魔法 |
| 玩家输入区 | §6.3 按钮尺寸 Medium | 输入框 bg-input + 发送按钮 accent-gold |
| 对话历史滚动 | §6.7 细滚动条 | 4px 半透明滚动条 |
| 流式输出 | §8.3 AI 说话动画 | 文字逐行淡入 + 头像脉动 2s 周期 |
| 减少动效 | §9.5 prefers-reduced-motion | 即时显示，无动画 |

### 5.2 关键屏幕：对话面板布局

```
┌─────────────────────────────────────────────────┐
│                                                  │
│  [对话历史区域 — 可滚动]                          │
│                                                  │
│  ┌─────────────────────────────────────┐        │
│  │ 🦊 DM · 格里姆                       │        │
│  │ ┌─ accent-magic 3px left border     │        │
│  │ │ "你推开沉重的橡木门，一股霉味       │        │
│  │ │  扑面而来。烛光照亮了石壁上古老     │        │
│  │ │  的符文——它们似乎在对你的到来做     │        │
│  │ │  出反应，微微发光……"               │        │
│  │ └────────────────────────────────── │        │
│  └─────────────────────────────────────┘        │
│                                                  │
│              ┌────────┐ ┌────────┐ ┌────────┐   │
│  建议动作:    │🔍查看符文│ │🚶深入走廊│ │📖回忆知识│   │
│              └────────┘ └────────┘ └────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ 输入你想做什么…                    [发送] │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 5.3 关键抉择面板

```
     ╔═══════════════════════════════════╗
     ║  ⚡ 关键时刻                  ✕   ║  ← 金色边框发光 (accent-gold)
     ╠═══════════════════════════════════╣
     ║                                   ║
     ║  "守卫队长单膝跪地，长剑横在      ║  ← AI 叙述文本
     ║   膝上。他的眼神——                     ║
     ║   是忠诚，还是恐惧？"                   ║
     ║                                   ║
     ║  ┌─────────────────────────────┐ ║
     ║  │ 🛡️ 接受他的效忠              │ ║  ← 选项 A, gold border
     ║  │   "起来吧，我需要你的剑。"    │ ║
     ║  └─────────────────────────────┘ ║
     ║  ┌─────────────────────────────┐ ║
     ║  │ ❓ 追问他的动机              │ ║  ← 选项 B
     ║  │  "你为什么现在选择效忠？"    │ ║
     ║  └─────────────────────────────┘ ║
     ║  ┌─────────────────────────────┐ ║
     ║  │ 🗡️ 拒绝——这可能是陷阱       │ ║  ← 选项 C, danger border
     ║  │  "我不信任你。"              │ ║
     ║  └─────────────────────────────┘ ║
     ║                                   ║
     ║        [其他选择…（自由输入）]      ║  ← 折叠的次要选项
     ╚═══════════════════════════════════╝
```

### 5.4 对话建议动作卡片动画

```
选项卡片交错滑入:
  卡片 1: delay 0ms,   slideInUp 300ms ease-out
  卡片 2: delay 50ms,  slideInUp 300ms ease-out
  卡片 3: delay 100ms, slideInUp 300ms ease-out
  卡片 4: delay 150ms, slideInUp 300ms ease-out
  卡片 5: delay 200ms, slideInUp 300ms ease-out

hover: 左移 4px + accent-gold 左边框
active: 缩放 0.98 + 亮度 0.95
```

---

## 6. 边界条件

### 6.1 错误处理

| 场景 | 处理策略 | 降级方案 |
|------|---------|---------|
| OpenRouter API 不可达 | 重试 3 次（指数退避: 1s/3s/9s） | 显示"AI GM 暂时失联"提示 + "重试"按钮 |
| API Key 无效/过期 | 捕获 401 → 弹出设置面板，引导用户更新 key | 本地缓存最后一次有效对话，允许离线阅读 |
| 流式连接中断 | 尝试非流式补全（fallback） | 如非流式也失败，显示已收到的部分 + 重试 |
| 模型响应超时 (>30s) | 中止请求，切换到备用模型 | 提示用户切换模型或重试 |
| 响应内容无法解析 | 检查是否含 `[NARRATIVE]` 标记，如无则全文视为 narrative | 记录原始响应到日志供调试 |
| Token 超限 | 压缩 session context（减少历史对话条数） | 提示用户"上下文过长，较早的对话可能被遗忘" |
| 假选择检测触发 | 前端记录 warning，不中断 | 在 AI 下一条 prompt 中追加"确保选择有可区分的后果" |
| 敏感内容检测 | 过滤 AI 输出中的极端暴力/色情内容 | 替换为 "…[内容已过滤]…" + GM 旁白引导回到安全叙事 |

### 6.2 极限情况

| 极限 | 阈值 | 行为 |
|------|------|------|
| 单次会话消息 > 500 条 | 即时记忆压缩，最早的消息仅保留摘要 | session context 降至最近 50 条 |
| 连续输入频率 > 10 条/秒 | 输入防抖 300ms | 合并连续输入为一条 |
| 单条 AI 响应 > 5000 字符 | 截断并提示"回应过长，已截断" | 添加"[继续…]"建议动作 |
| 决策树节点 > 100 | 仅最近 50 个节点在决策树中活跃 | 旧节点折叠为摘要 |
| 同时多个对话 tab | 检测到多 tab → 提示"已在另一个标签页中打开" | 第二个 tab 进入只读模式 |

### 6.3 Token 预算管理

```
预算分配策略 (基于 8K 上下文窗口):

固定消耗:
  System Prompt:       ~500 tokens
  World Context:       ~300 tokens
  Memory Context:      ~800 tokens
  ───────────────────────────
  固定合计:            ~1600 tokens

可变消耗:
  Session Context:     ~1500 tokens (正常) / ~500 tokens (压缩)
  Current Input:       ~100 tokens (平均)
  Response Budget:     ~2000 tokens (AI 响应)
  ───────────────────────────
  总计:                ~5200 tokens (正常) / ~4200 tokens (压缩)

8K 窗口利用率: 65% (正常) / 52.5% (压缩)
安全余量: ~2800-3800 tokens — 足够应对突发长篇叙事
```

---

## 7. 测试要点

### 7.1 单元测试场景

| 测试 ID | 测试场景 | 前置条件 | 预期结果 |
|---------|---------|---------|---------|
| DLG-UT-01 | 自由文本输入 | 叙事状态=exploration | 发送文本，AI 返回 [NARRATIVE] + [ACTIONS] + [STATE] |
| DLG-UT-02 | 关键抉择触发 | 叙事状态=climax | AI 返回 [DECISION]，前端显示抉择面板 |
| DLG-UT-03 | 建议动作执行 | 有可用建议动作 | 点击建议 → 等同于发送该文本 |
| DLG-UT-04 | 流式输出 | stream=true | 500ms 内收到首个 token，逐词渲染 |
| DLG-UT-05 | 模型切换 | 当前模型 GPT-4o | 切换到 Claude 3.5 → 下次请求使用新模型 |
| DLG-UT-06 | AI 说"不" | 玩家输入违反世界规则 | AI 拒绝并给出世界内解释 |
| DLG-UT-07 | 假选择检测 | AI 返回两个选项 | 两个选项的 STATE 相同 → 触发 FakeChoiceWarning |
| DLG-UT-08 | Prompt 组装完整性 | 正常对话流程 | 每层 prompt 正确注入对应上下文 |

### 7.2 集成测试场景

| 测试 ID | 测试场景 | 涉及系统 | 预期结果 |
|---------|---------|---------|---------|
| DLG-INT-01 | 对话 → 记忆 → 下次对话引用 | 对话 + 记忆引擎 | 下一条 AI 回应引用刚才建立的事实 |
| DLG-INT-02 | 地图触发 → 自动对话 | 地图 + 对话 | 移动到事件图块后 AI GM 自动叙述 |
| DLG-INT-03 | 会话恢复 → 记忆摘要注入 | 存档 + 对话 + 记忆 | 新会话首条 AI 回应引用上次会话事件 |
| DLG-INT-04 | 抉择 → 世界状态更新 → 记忆持久化 | 对话 + 记忆 + 状态管理 | 抉择后果反映在 HUD 和后续对话中 |

### 7.3 边缘测试场景

| 测试 ID | 测试场景 | 预期行为 |
|---------|---------|---------|
| DLG-EDGE-01 | 空输入发送 | 触发 AI GM 主动叙述（"你环顾四周…"） |
| DLG-EDGE-02 | 极长输入 (>1000 字符) | 截断提示 + 正常处理 |
| DLG-EDGE-03 | 连续快速发送 10 条 | 防抖合并 + 逐条处理 |
| DLG-EDGE-04 | 网络中断后恢复 | 流式中断 → fallback 非流式 → 成功 |
| DLG-EDGE-05 | API 返回非预期格式 | 全文视为 narrative，记录日志 |
| DLG-EDGE-06 | Token 超限 (会话 > 6000 tokens) | 自动压缩 session context |

---

## 8. 设计理论基础

### 8.1 为什么选择"混合输入"模式

**理论依据：选择架构 (Choice Architecture) + 自我决定论 (SDT)**

| 纯自由文本 | 纯预设选项 | 混合模式 (本方案) |
|-----------|-----------|-----------------|
| 选择瘫痪风险高 | 自由度低，"被引导感" | 日常自由 + 关键收敛 |
| 难以追踪分支 | 易于追踪 | 关键分支可追踪 |
| AI 需要更多约束 | AI 自由度受限 | AI 在约束框架内自由发挥 |
| 玩家自主感 (Autonomy) ↑ | 自主感 ↓ | 自主感 + 胜任感 (Competence) 兼顾 |

混合模式在 SDT 三需求间取得平衡：日常交互满足**自主性** (Autonomy)，关键抉择预设选项满足**胜任感** (Competence，不被过多选项淹没)，AI GM 的主动引导满足**关联感** (Relatedness)。

### 8.2 AI GM "说'不'"的设计哲学

借鉴 TTRPG 的 GM 权力模型：
- GM 的"不"不是限制玩家，而是**维护世界的可信度**
- 如果玩家可以随时为所欲为，世界规则就失去意义 → 叙事张力崩塌
- "不"之后必须跟一个"但是"——提供替代路径，保持玩家前进感

示例：
- 玩家："我要飞过这个峡谷。"
- AI GM："你张开双臂，但重力不会因意愿而改变。不过——你注意到峡谷边缘有一条磨损的绳索，似乎是之前的冒险者留下的。"

### 8.3 竞品参考

| 竞品 | 借鉴点 | 差异点 |
|------|--------|--------|
| **AIDungeon** | 自由文本 + "Do/Say/Story" 三模式 | 我们的 AI 更有 GM 身份感，主动引导而非被动生成 |
| **NovelAI** | 丰富的 prompt 工程和 lore book | 我们不做"AI 辅助写作工具"，而是"AI 主持游戏" |
| **Disco Elysium** | 对话中的技能检定介入；思维阁 | 借鉴对话系统作为"内心声音"的多样化呈现 |
| **Divinity: Original Sin 2** | 对话 UI 布局；选项的后果预览 | 我们不预览后果（保持叙事惊喜），但追踪后果 |
| **Character.AI** | 角色扮演 AI 的对话流畅度 | 我们的 AI 保持 GM 身份，不会"打破第四面墙" |

### 8.4 设计决策记录

| 决策 ID | 决策 | 理由 | 日期 |
|---------|------|------|------|
| DLG-001 | 自由文本 + 关键抉择预设混合 | SDT 理论支撑，防止选择瘫痪同时保持自由度 | 2025-07-29 |
| DLG-002 | 系统 prompt 含行为规则而非仅角色定义 | AI 需要明确的"GM 行为模型"，不能仅靠"你是 GM"提示 | 2025-07-29 |
| DLG-003 | 假选择检测为 warning 非 error | 打断 AI 流式输出进行验证成本过高；warning 机制允许自我修正 | 2025-07-29 |
| DLG-004 | 流式输出 + 打字机效果默认关闭 | 打字机效果可增强沉浸但拖慢阅读速度；提供开关 | 2025-07-29 |
| DLG-005 | [DECISION] 标记而非纯文本分析 | 结构化标记比 NLP 分析更可靠，降低解析错误率 | 2025-07-29 |
| DLG-006 | 支持至少 3 个模型切换 | 不同模型有不同的叙事风格偏好，给玩家选择权 | 2025-07-29 |

### 8.5 理论红线检查

| 红线 | 状态 |
|------|------|
| 绝不退化为"无限 AI 聊天机器人" | ✅ System prompt 强制 GM 身份 + 世界规则约束 |
| 假选择杜绝（支柱 IV） | ✅ 假选择检测机制 + prompt 强调 |
| AI 主动引导（支柱 I） | ✅ 节奏控制 + 主动事件推进策略 |
| 反馈延迟 < 3 秒 | ✅ 流式输出 + 500ms 首 token 目标 |

---

> **下一步**: 本文档与记忆引擎 GDD 和地图系统 GDD 进行交叉评审，确保接口对齐。
