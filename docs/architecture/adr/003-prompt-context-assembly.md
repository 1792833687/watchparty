# ADR-003: Prompt 上下文组装策略

> **状态**: Proposed
> **日期**: 2025-07-29
> **作者**: 程基岩 (Cheng Jiyan)
> **决策者**: 游承峰 (You Chengfeng) — 主理人

---

## 上下文 (Context)

AI Narrator Game 的每次 LLM 调用前，需要将四层上下文（System/World/Memory/Session）组装为一个完整的 Prompt。组装策略直接影响三个关键指标：

1. **延迟**：对话首 Token 目标 < 500ms
2. **成本**：每次调用消耗 token（按量计费）
3. **叙事质量**：上下文的相关性和完整性

### 四层架构回顾（对话 GDD §2.3）

```
Layer 0: System Prompt  — ~500 tokens (固定，仅角色/世界规则变化时更新)
Layer 1: World Context   — ~300 tokens (区域/时间/NPC 上下文)
Layer 2: Memory Context  — ~800 tokens (记忆引擎检索结果)
Layer 3: Session Context — ~1500 tokens (最近 N 条对话历史)
Layer 4: Current Input   — ~100 tokens (玩家输入)
```

### 核心问题

**Prompt 应该在什么时候组装？**

有两个基本策略：

#### 策略 A: 请求时组装 (Just-In-Time Assembly)

```
每次 LLM 调用前:
  1. PromptAssembler.assemble()
  2. 调用 MemoryEngine.retrieveForContext()
  3. 拼接 System + World + Memory + Session + Input
  4. 发送到 OpenRouter
```

#### 策略 B: 预组装 + 增量更新 (Pre-Assembled with Incremental Updates)

```
System/World 变化时:
  → 更新预组装缓存

Memory 引擎变更时:
  → 更新 Memory 上下文块

每次 LLM 调用前:
  1. 获取最新 Session Context（滑动窗口）
  2. 拼接: 缓存块 + Session Context + Input
  3. 发送到 OpenRouter
```

#### 策略 C: 分层缓存 + 差异检测 (Layered Cache with Diff Detection)

```
维护四层各自的最新版本号

每次 LLM 调用前:
  1. 检查每层的版本号
  2. 仅重新计算发生变化的层
  3. 拼接所有层
  4. 发送到 OpenRouter
```

---

## 评估维度

### 1. 延迟分析

| 步骤 | 策略 A (JIT) | 策略 B (预组装) | 策略 C (分层缓存) |
|------|------------|---------------|-----------------|
| MemoryEngine.retrieve | ~50-100ms | 0ms (已缓存) | 0ms (若未变化) |
| World Context 构建 | ~5ms | 0ms (已缓存) | 0ms (若未变化) |
| Session Context 滑动窗口 | ~1ms | ~1ms | ~1ms |
| 字符串拼接 | ~1ms | ~1ms | ~1ms |
| **组装总延迟** | **~60-110ms** | **~2ms** | **~2-60ms** |
| + LLM 首 Token | ~200-400ms | ~200-400ms | ~200-400ms |
| **总首 Token 延迟** | **~260-510ms** | **~202-402ms** | **~202-460ms** |

**结论**：三种策略在首 Token 延迟上的差异很小（~100ms），因为 LLM 推理时间 (~200-400ms) 占主导。组装延迟不是瓶颈。

### 2. 缓存失效频率

| 上下文层 | 变化触发条件 | 变化频率 | 适合缓存? |
|---------|------------|---------|----------|
| Layer 0: System | 切换模型、更换游戏设定 | 极低（每次会话 0-1 次） | ✅ 高度适合 |
| Layer 1: World | 玩家移动区域、时间推进、NPC 出现/消失 | 中（每 3-10 次互动） | ✅ 适合 |
| Layer 2: Memory | 每次对话后 ingest 新事件 → 图谱更新 | 高（每次互动后可能变化） | ⚠️ 需要谨慎 |
| Layer 3: Session | 每次对话追加新消息 | 极高（每次互动后必须变化） | ❌ 不适合缓存 |
| Layer 4: Input | 每次玩家输入 | 每次调用都不同 | ❌ 不可缓存 |

**关键洞察**：Layer 3 (Session Context) 是滑动窗口，每次调用必然变化。Layer 2 (Memory Context) 虽高频变化，但大部分记忆检索结果在连续对话中相似（相关性得分仅微调）。

### 3. 实现复杂度

| 维度 | 策略 A (JIT) | 策略 B (预组装) | 策略 C (分层缓存) |
|------|------------|---------------|-----------------|
| 代码量 | ~200 行 | ~400 行 | ~600 行 |
| 状态管理 | 简单（无缓存状态） | 中（缓存失效逻辑） | 高（版本追踪 + 差异检测） |
| 调试难度 | 低（每次重新计算） | 中（缓存可能包含过期数据） | 高（多层缓存一致性） |
| 内存占用 | 低 | 中（缓存块） | 中-高（多层缓存 + 版本元数据） |
| 竞态风险 | 低 | 中（ingest vs 缓存更新） | 高（多层并发更新） |

### 4. 记忆引擎集成

**关键约束**（记忆引擎 GDD §2.7, §6.3）：
- `ingest()` 和 `retrieve()` 不能并发执行（Promise 队列串行化）
- 上下文检索超时 500ms → 降级

策略 B 和 C 的缓存机制可能引入一个微妙问题：如果在 `ingest()` 后但缓存更新前调用 `retrieve()`，返回的上下文会缺少最新的记忆。这对叙事质量有影响——AI GM 可能不记得玩家刚才说的话。

### 5. 假选择检测的影响

对话系统 GDD §2.5 要求每次 `[DECISION]` 块后检测假选择。假选择检测需要对比各选项的 `[STATE]` 块——这不依赖 prompt 组装策略，不受影响。

---

## 决定 (Decision)

**选择策略 B（预组装 + 增量更新）**，适配记忆引擎的触发机制。

### 具体设计

```typescript
// systems/dialogue/PromptAssembler.ts

class PromptAssembler {
  // 缓存块
  private systemBlock: string = '';
  private worldBlock: string = '';
  private memoryBlock: string = '';
  
  // 版本标记
  private systemVersion: number = 0;
  private worldVersion: number = 0;
  private memoryVersion: number = 0;
  
  /**
   * 构建完整的 Prompt
   * 仅重新计算发生变化的层
   */
  async assemble(
    sessionMessages: DialogueMessage[],
    playerInput: string,
    context: AssemblyContext
  ): Promise<LLMMessage[]> {
    
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
    
    // Layer 2: Memory — 在 ingest 批次完成后异步预计算
    // retrieve 由 MemoryEngine 内部处理，PromptAssembler 使用最新结果
    // 如果 memoryBlock 版本落后于 MemoryEngine，同步等待 retrieve
    if (context.memoryVersion !== this.memoryVersion) {
      const memResult = await this.memoryEngine.retrieveForContext(context.memoryRequest);
      this.memoryBlock = memResult.contextBlock;
      this.memoryVersion = context.memoryVersion;
    }
    
    // Layer 3: Session — 每次调用必须重建（滑动窗口）
    const sessionBlock = this.buildSessionContext(sessionMessages, context.maxSessionTokens);
    
    // Layer 4: Input — 直接使用
    const inputBlock = this.buildInputBlock(playerInput, context.currentPageState);
    
    // 组装为 OpenRouter 消息格式
    return [
      { role: 'system', content: this.systemBlock },
      { role: 'system', content: this.worldBlock },        // OpenRouter 支持多条 system
      { role: 'system', content: this.memoryBlock },
      { role: 'user', content: sessionBlock + '\n\n' + inputBlock }
    ];
  }
  
  /**
   * 在记忆引擎 ingest 后调用，预计算 Memory Block
   * 在对话流中异步执行（不阻塞 UI）
   */
  async precomputeMemoryBlock(request: MemoryRetrievalRequest): Promise<void> {
    const result = await this.memoryEngine.retrieveForContext(request);
    this.memoryBlock = result.contextBlock;
    this.memoryVersion++;
  }
  
  /**
   * 强制失效所有缓存（切换游戏设定时使用）
   */
  invalidateAll(): void {
    this.systemVersion = 0;
    this.worldVersion = 0;
    this.memoryVersion = 0;
  }
}
```

### 触发时机

```
对话循环中的 PromptAssembler 行为:

1. 玩家发送输入
2. [同步]   组装 System + World (缓存命中 → ~1ms)
3. [可能同步] 如果 Memory 缓存过期 → retrieve (50-100ms)
             如果 Memory 缓存有效 → 使用缓存 (~0ms) ★
4. [同步]   组装 Session + Input (~1ms)
5. [异步]   发送到 LLM
6. ...LLM 流式返回...
7. [异步]   ingest 到 MemoryEngine
8. [异步]   预计算新的 Memory Block (precomputeMemoryBlock) ← 为下次调用准备
```

**关键优化**：步骤 8 在 LLM 响应解析完成后**异步执行**，不阻塞下一次用户输入。这意味着：
- 连续对话时，下一次调用的 Memory Context 已在步骤 8 中预计算完毕
- 仅当用户在预计算完成前就发送下一条消息时（快速连续输入），才会在步骤 3 中同步等待 MemoryEngine

### 为什么不用策略 C

策略 C（分层缓存 + 差异检测）提供了更精细的控制，但引入的复杂度（版本追踪、多层一致性检查、调试难度）在 MVP 阶段不合理：

1. **收益递减**：策略 B 已经将组装延迟从 ~100ms 降到 ~2ms，策略 C 无法进一步优化（瓶颈在 LLM 推理）
2. **竞态风险**：多层版本号在异步流中容易产生不一致——`ingest` 在 MemoryEngine 中执行时，World Context 可能也发生了变化
3. **调试噩梦**：出现"AI 不记得某件事"的 bug 时，需要排查多层缓存的版本号，而非一目了然的单层缓存

### 为什么不用策略 A

策略 A 更简单，但每次 LLM 调用都执行 `retrieveForContext()`（50-100ms）会增加不必要的延迟。虽然延迟增加量不大，但在快速连续对话时（玩家快速点击建议动作），累积延迟可感知。

更重要的是，MemoryEngine 的 `retrieveForContext()` 在数据量大时（1000+ 事件）可能需要接近 100ms——这是在每次对话轮次上增加的成本，而策略 B 将其分摊到 LLM 响应处理阶段（用户正在阅读 AI 回应时）。

---

## Token 估算策略

### 估算法选择

| 方法 | 准确性 | 速度 | 依赖 | 适用性 |
|------|--------|------|------|--------|
| **字符数 / 4** (经验法则) | ±30% | < 0.1ms | 无 | ✅ MVP 首选 |
| **tiktoken (OpenAI 官方)** | ±5% | ~5ms | tiktoken WASM (~1MB) | ❌ 增加 bundle |
| **gpt-tokenizer (社区)** | ±10% | ~1ms | gpt-tokenizer (~50KB) | ⚠️ 可考虑 |

**决定**：MVP 使用 **字符数 / 4** 估算法。理由：
1. 零依赖、零 bundle 增加
2. ±30% 的误差在 ~3200 token 预算下仅 ±960 token，安全余量 2800 token 足以吸收
3. 实际 token 计数在 LLM 响应中返回（`usage.promptTokens`），可用于校准估算器

```typescript
// lib/utils/tokenizer.ts

/**
 * 简单 token 估算（字符数 / 4）
 * 用于 prompt 组装时的预算控制
 */
export function estimateTokens(text: string): number {
  // 中文字符 ≈ 1.5-2 tokens，英文字符 ≈ 0.25 tokens
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 1.8 + otherChars / 4);
}

/**
 * 基于实际 LLM 响应校准估算器
 * 在每次 LLM 调用后调用
 */
export function calibrateEstimate(
  estimatedTokens: number,
  actualTokens: number,
  text: string
): void {
  // 维护移动平均校准因子
  // 后续版本实现
}
```

### Token 预算动态调整

```typescript
// 当会话历史过长时的自动压缩策略
function adjustSessionWindow(
  messages: DialogueMessage[],
  targetTokens: number
): DialogueMessage[] {
  let totalTokens = 0;
  const window: DialogueMessage[] = [];
  
  // 从最新消息开始，反向收集直到 token 预算用尽
  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(messages[i].content);
    if (totalTokens + msgTokens > targetTokens) {
      // 如果预算不足且 window 中消息太少，截断最旧的一条
      if (window.length < 5) {
        window.unshift({
          ...messages[i],
          content: messages[i].content.slice(0, Math.floor(targetTokens / 5 * 4)) + '…'
        });
      }
      break;
    }
    totalTokens += msgTokens;
    window.unshift(messages[i]);
  }
  
  return window;
}
```

---

## 后果 (Consequences)

### 正面后果

✅ **低延迟组装**：缓存命中时 ~2ms，未命中时 ~60ms
✅ **Memory 预计算**：LLM 响应处理期间异步预计算，下次调用零等待
✅ **清晰的缓存失效规则**：每层独立版本号，失效条件明确
✅ **简洁实现**：~400 行代码，可理解可调试
✅ **Token 预算可控**：估算误差被安全余量吸收

### 负面后果

⚠️ **缓存一致性的竞态窗口**：如果用户在 Memory 预计算完成前快速连发输入
  - **缓解**：同步 fallback——如果 `memoryVersion` 不一致，同步等待 `retrieveForContext()`（~50ms）。仅在用户连续快速点击建议动作时出现，概率低。

⚠️ **缓存可能包含过时的 World Context**：玩家移动后 World Context 更新，但如果更新失败，LLM 会收到旧的位置信息
  - **缓解**：`worldVersion` 由对话系统的 `StateDelta.locationChange` 事件驱动更新，与地图系统的玩家位置保持严格同步

⚠️ **预计算的 Memory Block 可能基于不完整的 AI 回应**：如果在 LLM 流式输出**完全结束前**就触发 `precomputeMemoryBlock()`
  - **缓解**：仅在 `onComplete` 回调中触发预计算，确保使用完整的 AI 回应

### 中性后果

➡️ **缓存失效规则需要明确文档化**：未来维护者需要理解每层的失效条件

---

## 参考资料

- 对话系统 GDD §2.3 (Prompt 分层架构), §2.4 (System Prompt 模板), §6.3 (Token 预算管理)
- 记忆引擎 GDD §2.7 (上下文窗口注入策略), §4.1 (retrieveForContext API), §6.2 (检索超时降级)
- 记忆引擎 GDD §6.3 (ingest/retrieve 并发控制)
- OpenAI Tokenizer: https://platform.openai.com/tokenizer
- OpenRouter Token Usage: `response.usage.prompt_tokens`
