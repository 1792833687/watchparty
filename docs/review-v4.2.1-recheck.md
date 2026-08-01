# AI Narrator Game v4.2.1 — 复审报告（修复验证）

> 复审人：游戏设计师（系统与数值方向）
> 复审方式：对 `docs/review-fixes.md` 全部 22 条声称逐条回溯代码（combat-engine / territory-system / market-system / ending-system / game-state-schema / origins / CheckDiceOverlay / page.tsx 接线），并实际运行回归测试
> 复审日期：2026-07-31
> 结论先行：**修复方向全部正确，主干断裂全部接上。但完成度不是报告的 100%——存在 1 个单位换算 bug（金币入账缩水 100 倍）、1 个供需 key 不一致（买入价仍然恒价）、1 个宣称夸大（指令队列并非全局）。这三处都在接线层，而新增测试全部只测纯函数层，测不到它们。**

---

## 一、验证结果总览

| 声称 | 代码验证 | 结论 |
|------|---------|------|
| P0-1 属性/武器/暴击/命中入公式 | `resolveCombat` 新增 PlayerCombatStats 参数，公式 = (base + 主属性×2 + 武器) × 倍率 × 暴击 1.5；命中 = 0.75+dex×0.02 上限 0.95；page.tsx:2065 接线完整 | ✅ 实装 |
| P0-2 检定结果回传 AI | `CheckDiceOverlay.onResult` + `checkResultRef` 三处接线（声明 1049 / 注入 1607-1615 / 消费清除） | ✅ 实装 |
| P0-3 主线完成解锁结局 | `hasMainQuestCompleted`（3226）+ 合并块后置 true（1781）+ crown 兜底 | ✅ 实装 |
| P0-4 领地经济闭环 | GAMESTATE `territory.resources` 字段 + 入账（1906-1918）+ collectTax/collectWorkshopOutput/templePrayer + resolveSiege 调用（失败=损失+降级）| ✅ 实装（单位 bug 见下） |
| P0-5 市场/合成/成就 | resetMarketCache 开局调用（1454）+ 买卖接供需 + LOCATION_MODIFIER 三套 key + 12 种合成原料入库 + rewardGold/rewardSkillPoints 落账（2147-2175） | ⚠️ 半生效（key 不一致见下） |
| P0-6 货币双轨 + 出身 | GAMESTATE wallet 字段 + 入账进位（1870-1903）+ factionBias 改真实阵营 id 且应用（1455-1473） | ✅ 实装（单位 bug 见下） |
| P1-1 战斗关键词收窄 + 结果注入 | 关键词表改为强特征词（2036）+ combatResultRef 注入（1616-1622） | ✅ 实装 |
| P1-2 艾拉历史峰值 | `maxCorruptionEverRef`（1052/1979-1980） | ✅ 实装 |
| P1-3 低语独立区块 | 过滤 whisper- 选项独立渲染 + 冷却显示（3065-3114） | ✅ 实装 |
| P1-4 技能点来源 | explore-all +2 / collect-legendary +3，setSkillPointBalance 发放 | ✅ 实装 |
| P1-5 敌对阵营排除 | HOSTILE_FACTIONS 集合 + avgReputation 过滤（57-66） | ✅ 实装 |
| P1-6 D20 公式修正 | modifier = attr-5（58）+ DC 8/12/16/20（508） | ✅ 实装 |
| P1-7 城镇设施动作 | 旅馆推进+恢复 / 神殿-堕落 / 铁匠铺开合成 / 商店开市场（1151-1188） | ✅ 实装 |
| P2-4 紧急存档 | beforeunload + pagehide 双注册，槽 5（2904-2905） | ✅ 实装 |
| P2-5 存档校验 | 结构校验 + safeParseGameState 深度校验（2768-2793） | ✅ 实装 |
| P2-6 全局指令队列 | pendingActionRef（2423-2472） | ⚠️ 非全局（见下） |
| P2-8 称号横幅 | AchievementPanel 称号提取展示（85-102） | ✅ 实装 |
| 回归测试 | tests/unit/systems/review-fixes.test.ts 14 用例，实际运行全绿 | ✅ 但覆盖有盲区 |

**结论：报告宣称的修复全部存在，无一造假。** 但"修复存在"与"修复正确"是两回事——以下是复审抓到的问题。

---

## 二、复审发现的问题（按严重度）

### R1 🔴 金币入账单位 bug —— 成就与税收入账缩水 100 倍

**位置**：`page.tsx:2156`（成就）与 `page.tsx:2548`（税收）

**证据**：`CURRENCY.gold.rateToCopper = 100`（tokens.ts:103，1 金币 = 100 铜币），`walletToCopper` 返回铜币值。但两处入账都是：

```ts
const tc = walletToCopper(prev) + totalGold;   // totalGold 语义是"金币"，被当作铜币加
```

成就奖励 `rewardGold: 500`（语义：500 金币），实际入账 `+500 铜币 = 5 金币`。玩家看到弹窗"金币 +500"，钱包只涨 5。税收同理（民居 3 级"+150 金币"只入账 1.5 金币）。

**为什么测试抓不到**：`collectTax` 纯函数返回 20/60/150（正确），测试只验证了函数返回值，没验证 page.tsx 的入账换算。

**修复**：`walletToCopper(prev) + totalGold * 100`（金币转铜币），或把入账改为直接对 wallet 的 gold 字段加法后再进位。一行改动。同理检查所有 `+ totalGold` 类入账点。

---

### R2 🟡 供需 key 不一致 —— 买入价仍然是死的

**位置**：`market-system.ts:75` vs `page.tsx:2656/2679`

**证据**：
- 写入：`updateSupplyDemand(libItem.id, ...)` → key = **itemId**（如 `hp-potion-small`）
- 买入价读取：`getSupplyDemandFactor(\`${basePrice}-${rarity}\`)` → key = **`15-common`**
- 卖出价读取：`getSupplyDemandFactor(itemId)` → key = **itemId** ✅

买入价读的 key 从未被写入过 → **买入价供需因子恒 1.0，动态定价只在卖出侧生效**。报告声称"买入 → 后续价格上浮"，实际买入价纹丝不动，玩家无感知。

**修复**：统一 key。建议全部用 itemId（`calculateBuyPrice` 增加 itemId 参数或内部用 basePrice-rarity 写入）。

---

### R3 🟡 P2-6 指令队列宣称"全局"，实装只覆盖领地系

**位置**：`page.tsx:2425 sendActionToAI`

**证据**：`pendingActionRef` 只接入 `sendActionToAI`（领地升级/战略/休整 3 个入口）。**handleTravel（地图传送）、handleEnterFacility（城镇）、handleChainInteract（关系链）、低语选项仍走 setTimeout+click 直发**——loading 中点击这些入口，指令依旧静默丢失。原始问题在 4/5 的入口上没有修复。

**修复**：把这 4 个入口的"填充 input + click"统一收敛到 `sendActionToAI`（或一个公共 `dispatchAction(text)`），一行队列覆盖全局。

---

### R4 🟡 围城失败仍计入 siegesSurvived + territory 入账死表达式

**位置**：`page.tsx:2582` / `page.tsx:1916`

- 失败分支 `siegesSurvived: prev.siegesSurvived + 1`——"没挺过却计数"。结局系统用 siegesSurvived 做条件（如真结局），失败也算挺过会污染统计。建议失败不减、也不加，或引入 `siegesLost`。
- `gold: (prev.resources.gold ?? 0) + (res.crystal ? 0 : 0)`——`res.crystal ? 0 : 0` 恒为 0 的死表达式（疑似想写 `res.gold`，但协议 territory.resources 无 gold 字段）。领地金币走 wallet 是对的，但需要在协议文档写清楚"领地 gold 资源 = 无，金币统一走 wallet"，否则 AI 想奖励领地金币会静默丢弃。

---

### R5 🟢 主属性选择粗糙（观察，非阻断）

`page.tsx:2061`：`strength ?? intelligence`——敏捷/感知型职业（游侠/刺客/武僧/德鲁伊）的伤害主属性错误落到 strength。刺客敏捷 6 vs 力量 3：伤害按力量算。建议按职业 attrMods 权重最高的属性取。

### R6 🟢 检定结果注入滞后（观察）

`checkResultRef` 在**下一轮对话**才注入。玩家掷骰后若先做面板操作（合成/传送/休整），AI 续写检定后果会脱离上下文。建议改为"掷骰结果立即作为系统消息追加到对话流 + 注入下一条 AI 消息"，或至少注入前清空。

---

## 三、对测试体系的意见

新增 14 个回归用例方向正确，但**全部只测纯函数层**（resolveCombat/collectTax/resolveSiege/evaluateEnding），没有一例触及 page.tsx 的接线层——R1/R2/R3 三个问题全部发生在接线层，测试全部绿灯。建议补接线层测试：
1. 成就解锁 → 断言 wallet 金币增量 = rewardGold × 100（会抓到 R1）
2. 买入两次同一物品 → 断言第二次价格 > 第一次（会抓到 R2）
3. loading 中调用 handleTravel → 断言指令入队（会抓到 R3）

## 四、总体评价

| 维度 | 评价 |
|------|------|
| 修复方向 | ✅ 每一条都对准了原始断裂的主干，无一条敷衍 |
| 修复深度 | ⚠️ 主干接上了，但接线层的换算/一致性/覆盖面有 3 处未闭环 |
| 诚实度 | ✅ 未完全闭环项如实标注（mechanics/技能效果/结局 UI），值得肯定 |
| 测试 | ⚠️ 测试全绿但测不到接线层，恰好放过本次 3 个问题 |

**给作者的话**：这轮修复的质量明显上升——P0-3 一行救活 6 结局、检定结果回传、领地经济闭环，都是把"AI 自觉"改成了"前端裁决"的正确姿势。剩下的是"最后一公里"问题：单位换算、key 一致、队列覆盖，全是接线层的小事，但正是玩家能感知到的事。修完 R1-R3 后，这游戏的数值轨道就真的通了。
