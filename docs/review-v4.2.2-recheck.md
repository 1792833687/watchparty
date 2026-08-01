# AI Narrator Game v4.2.2 — 复审报告（第三轮）

> 复审人：游戏设计师（系统与数值方向）
> 复审对象：`docs/review-fixes.md` 附录 A（R1-R6 修复声称）
> 复审方式：逐条回溯代码 + 实际运行回归测试（recheck-fixes 12 例 + review-fixes 14 例 + 全量 343）
> 复审日期：2026-07-31
> 结论先行：**R1-R6 全部实装，无一造假；26 条回归测试全绿，全量 343 全绿与声称一致。本轮修复质量是三次评审里最高的一次——接线层问题全部闭环，测试体系也升级到能抓到接线层 bug 的水平。但复审仍挖到一个新的状态恢复缺口（R7）和两个观察项。**

---

## 一、R1-R6 验证结果（逐条）

| 声称 | 代码证据 | 结论 |
|------|---------|------|
| R1 金币单位 ×100 | 成就 `totalGold * CURRENCY.gold.rateToCopper`（page.tsx:2207）、税收 `tax * CURRENCY.gold.rateToCopper`（2536） | ✅ 实装 |
| R2 供需 key 统一 | `calculateBuyPrice` 第 4 参 itemId（market-system.ts:71/77），key 统一 itemId + 缺省回退；4 处调用全传（page.tsx:2615/2652、MarketPanel:50/62）；MarketPanel useMemo 依赖 wallet（54/71） | ✅ 实装 |
| R3 全局指令队列 | `action-queue.ts` 纯函数 enqueueAction/dequeueAction；`dispatchAction` 公共入口（page.tsx:1098，定义在全部 handler 之前）；5 类入口收敛：关系链 1156 / 城镇 1245 / 传送 2457 / 领地 2486·2516·2590·2602 / 低语+选项 3072 | ✅ 实装 |
| R4 围城计数 + 死表达式 | `siegesSurvived + (siege.survived ? 1 : 0)`（2571）；死表达式移除，`gold: prev.resources.gold ?? 0`（1953），协议注释明确"领地金币统一走 wallet" | ✅ 实装 |
| R5 主属性按职业 | attrMods 正修正排序取首（2097-2110），无职业时按属性值降级判定 strength/dexterity/intelligence | ✅ 实装 |
| R6 检定立即入对话流 | onResult 时立即追加系统消息（3141-3152）+ 保留 ref 注入双保险 | ✅ 实装 |

**测试验证**：`tests/unit/systems/recheck-fixes.test.ts` 12 用例实际运行全绿，且 R1/R2/R3 每组都带"修复前公式确实缩水/恒价/直发"的回归证明——这是正确的测试设计，证明测试真的能抓住原始 bug。全量 343 用例（22 文件）实际运行全绿，与报告声称一致。

---

## 二、本轮新发现

### R7 🟡 艾拉事件状态（maxCorruptionEverRef）不随新档/读档重置 —— 换档/读档后艾拉线可能永久错过

**证据**：
- `maxCorruptionEverRef` 初始 0（page.tsx:1052），只在 handleSend 内更新（2016）
- **新游戏（handleCharacterConfirm）只重置 `combatComboRef`（1524），不重置 `maxCorruptionEverRef`**
- **读档（handleLoadSlot 与 ?slot=N 恢复）均不恢复该值**（grep 无 saveData.maxCorruption 相关）

**两个失效场景**：
1. **换档**：A 档把堕落刷到 60（maxEver=60）→ 回首页开 B 档 → B 档 maxEver 仍是 60 → B 档玩家堕落到 [20,40] 区间也不触发艾拉，真结局 + 艾拉线永久锁死，玩家毫无感知。
2. **读档**：堕落峰值 35 时（艾拉未触发，因 dayCount<3 或未到检查点）存档退出 → 读档后 maxEver=0、当前堕落 35 但 `maxEver ∈ [20,40]` 检查用的是 0 → 不触发。或者峰值已过 40 后读档，maxEver=0 永远追不上当前值。

**修复（两行）**：
- `handleCharacterConfirm` 内加 `maxCorruptionEverRef.current = 0;`
- 读档两处（handleLoadSlot + ?slot=N effect）加 `maxCorruptionEverRef.current = Math.max(maxCorruptionEverRef.current, saveData.currentCorruption ?? 0);`

这个缺口恰好暴露了"峰值类状态"的通病：**凡是跨会话有意义的 ref 状态，必须随存档持久化或随新档重置**。建议把 maxCorruptionEver 提升为 gameState 字段（随存档自然走），而不是 ref。

---

## 三、观察项（非阻断）

### O1 检定结果对 AI 的续写仍依赖"玩家下一次发起对话"

R6 让玩家**看到**了检定结果（立即入对话流），但 AI 看到结果的方式仍是 `checkResultRef` 在**下一次 handleSend** 时注入。若玩家掷骰后不再输入（或只做面板操作），AI 永远不会续写检定后果——"检定失败，代价随之而来"会成为一句没有后续的空话。

**建议**：检定结果回传后，若对话空闲则自动触发一次 AI 请求（"请根据刚才的检定结果描述后果"），或把结果追加为 assistant 消息的下一条 user 消息强制续写。这样"掷骰 → 后果"在同一轮内闭环。

### O2 圣骑士等混合职业的主属性取首有偏差

R5 按 attrMods 排序取首：圣骑士 attrMods = `{strength:2, constitution:3, charisma:1}` → 主属性取 **constitution**（体质），伤害按体质加成。战士/刺客/法师没问题，但坦克型职业（圣骑/德鲁伊 `{wisdom:3,constitution:2,dexterity:1}` → wisdom）的伤害主属性会取到生存属性。建议：伤害主属性限定在 strength/dexterity/intelligence 三选一内取权重最高者（治疗/坦克职业的 wisdom/constitution 不参与伤害）。

---

## 四、测试体系评价

本轮测试升级是实打实的：
- ✅ 接线层逻辑提取为可测纯函数（action-queue）——这是正确的工程姿势，呼应了上一轮"接线层 bug 测不到"的批评
- ✅ 每组测试带"修复前会挂"的回归证明——证明测试有杀伤力
- ⚠️ 一个隐患：R1 测试是"镜像公式"——测试里复制的换算公式与 page.tsx 相同，若实装公式未来改动而测试没同步，测试会测一个与实装无关的公式。建议提取 `goldToCopper(gold: number)` 工具函数供 page.tsx 与测试共用，消除镜像风险。

## 五、总体评价

| 维度 | 评价 |
|------|------|
| R1-R6 修复 | ✅ 全部实装，无一条敷衍，接线层问题闭环 |
| 测试体系 | ✅ 升级到位（纯函数提取 + 回归证明），镜像公式是唯一瑕疵 |
| 诚实度 | ✅ 未闭环项（mechanics/技能效果/结局 UI）如实标注 |
| 新发现 | 🟡 R7 艾拉状态持久化缺口（换档/读档后失效）——小改动，影响真结局线 |

**给作者的话**：三轮下来，这游戏从"数据+文案+UI 的空壳"走到了"数值轨道真正通电"。R1-R6 的修法（×100 换算、key 统一、公共 dispatchAction、纯函数提取）都展示了正确的系统思维。R7 是"峰值状态持久化"这一类问题的典型案例——它提醒你：**凡是跨会话有意义的 ref 状态，要么进存档，要么随新档重置，没有第三种选择**。修完 R7，这轮复审我挑不出必须立刻改的东西了。
