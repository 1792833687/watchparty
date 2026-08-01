# AI Narrator Game v4.2.3 — 评审意见修复报告

> 修复对象：`docs/review-v4.1.0.md`（P0×6 / P1×8 / P2×8）+ `docs/review-v4.2.1-recheck.md`（R1-R6）+ `docs/review-v4.2.2-recheck.md`（第三轮 R7/O1/O2）
> 修复日期：2026-07-31
> 结论：**三轮评审问题全部修复。第三轮：R7 峰值状态持久化缺口 + O1/O2 观察项 + 测试镜像消除**
> 验证：350 个单元测试全绿（v4.2.1 14 + v4.2.2 12 + v4.2.3 7）、TypeScript 零错误、构建通过

---

## 附录 C：v4.2.3 第三轮复审（recheck）修复记录

> 复审结论："R1-R6 全部实装，无一条敷衍；但挖到 R7 状态持久化缺口 + 2 观察项 + 1 测试隐患。"

### R7 🟡 艾拉事件状态（maxCorruptionEverRef）不随新档/读档重置 ✅ 已修复
**原始描述**：maxCorruptionEverRef 初始 0，只在 handleSend 内更新；新游戏只重置 combatComboRef 不重置峰值；读档两处均不恢复 → 换档后 B 档 maxEver 残留 A 档 60，或读档后 maxEver=0 永远追不上当前堕落值 → 艾拉线 + 真结局永久锁死。
**修复**（三处）：
1. `handleCharacterConfirm` 新档重置：`maxCorruptionEverRef.current = 0`
2. `handleSaveSlot` 存档持久化：saveData 新增 `maxCorruptionEver`
3. `handleLoadSlot` + `?slot=N` 恢复（两处，replace_all）：`maxCorruptionEverRef.current = Math.max(current, saveData.maxCorruptionEver ?? saveData.currentCorruption ?? 0)`（旧存档以当前堕落兜底）
4. beforeunload 紧急存档同样持久化该字段
**验证**：✅ 接线层测试 3 例（读档恢复/旧档兜底/新档重置）。

### O1 🟢 检定结果对 AI 的续写仍依赖"玩家下一次对话" ✅ 已修复
**原始描述**：R6 让玩家看到了结果，但 AI 仍等下一次 handleSend 才收到 → 玩家掷骰后不再输入则"代价随之而来"成为空话。
**修复**：CheckDiceOverlay onResult 后启动 3.2s 定时器（等骰子动画结束），对话空闲时自动 `dispatchAction('（系统通知：请根据检定结果续写后果…）')` 触发 AI 续写；**玩家手动输入时取消定时器**（输入框 onChange 清除），避免插队。

### O2 🟢 圣骑士等混合职业主属性取到生存属性 ✅ 已修复
**原始描述**：圣骑士 attrMods `{strength:2,constitution:3,charisma:1}` 排序取首 → constitution（体质）；德鲁伊 `{wisdom:3,...}` → wisdom（感知）。伤害主属性取到生存属性。
**修复**：attrMods 过滤时限定 `DAMAGE_ATTRS = ['strength','dexterity','intelligence']` 三选一内取权重最高；无职业时属性值降级判定不变。
**验证**：✅ 测试 2 例（圣骑士→力量、德鲁伊→敏捷）。

### 测试镜像消除 ✅ 已修复
**原始描述**：R1 测试复制 page.tsx 的换算公式——若实装公式改动而测试未同步，测试测的是无关公式。
**修复**：提取 `goldToCopper(gold)` 到 `src/theme/tokens.ts`（1 金币 = 100 铜币），page.tsx 两处入账与测试**共用同一函数**。
**验证**：✅ 测试 2 例（换算闭环、语义 1→100）。

---

## 附录 B：接线层测试体系（回应复审"测试测不到接线层"）

> 复审结论："修复方向全部正确，主干断裂全部接上。但存在 3 处接线层 bug（测试测不到）+ 2 观察项 + 1 体验项。" 本轮全部修复。

### R1 🔴 金币入账单位 bug（成就/税收缩水 100 倍）✅ 已修复
**原始描述**：`walletToCopper(prev) + totalGold` 中 totalGold 语义为「金币」，但 walletToCopper 返回铜币值（1 金币 = 100 铜币）→ 成就 +500 金币实际只入账 5 金币，税收同理。
**修复**：两处入账（成就 `page.tsx:2156`、税收 `page.tsx:2548`）改为 `totalGold * CURRENCY.gold.rateToCopper`（×100 转铜币）。
**验证**：✅ 接线层测试 4 例（含"修复前公式确实缩水"的回归证明）。

### R2 🟡 供需 key 不一致（买入价恒价）✅ 已修复
**原始描述**：写入 `updateSupplyDemand(itemId, ...)` 用 itemId 作 key，但买入价读取 `${basePrice}-${rarity}` → 买入价供需因子恒 1.0，动态定价只在卖出侧生效。
**修复**：`calculateBuyPrice` 新增第 4 参 `itemId`，供需 key 统一为 itemId（缺省回退旧 key 兼容）；page.tsx / MarketPanel 共 4 处调用全部传入；MarketPanel 的 useMemo 依赖加入 wallet（买卖后价格实时重算）。
**验证**：✅ 接线层测试 5 例（含"旧 key 恒价"的回归证明）。

### R3 🟡 指令队列宣称"全局"实装只覆盖领地系 ✅ 已修复
**原始描述**：pendingActionRef 只接入 sendActionToAI（领地 3 入口），handleTravel / handleEnterFacility / handleChainInteract / 低语选项仍直发，loading 中点击静默丢失（4/5 入口未修复）。
**修复**：
1. 队列核心提取为纯函数 `enqueueAction`/`dequeueAction`（`src/systems/utils/action-queue.ts`）
2. 新增公共入口 `dispatchAction`（定义提前到所有 handler 之前），5 类入口全部收敛：领地升级/战略/休整、地图传送、城镇设施、关系链交互、对话选项（含低语）
3. 删除原 sendActionToAI 全部残留
**验证**：✅ 接线层测试 5 例（入队/立即发/FIFO 串行/回归证明）。

### R4 🟡 围城失败仍计入 siegesSurvived + 领地入账死表达式 ✅ 已修复
**原始描述**：① 失败分支 `siegesSurvived + 1`——"没挺过却计数"，污染结局统计；② `gold: (prev.resources.gold ?? 0) + (res.crystal ? 0 : 0)` 死表达式恒 0。
**修复**：① 改为 `siegesSurvived: prev.siegesSurvived + (siege.survived ? 1 : 0)`（成功才计数）；② 移除死表达式，GAMESTATE 协议说明明确"领地金币不使用，金钱奖励统一走 wallet 字段"。

### R5 🟢 主属性选择粗糙 ✅ 已修复
**原始描述**：`strength ?? intelligence` 硬编码——敏捷/感知职业（游侠/刺客/武僧/德鲁伊）伤害主属性错误落到 strength。
**修复**：按职业 `attrMods` 权重最高属性取主属性（正修正排序取首）；无职业信息时按属性值降级判定 strength/dexterity/intelligence。

### R6 🟢 检定结果注入滞后 ✅ 已修复
**原始描述**：checkResultRef 下一轮对话才注入，玩家掷骰后先做面板操作则 AI 续写脱离上下文。
**修复**：CheckDiceOverlay onResult 时**立即追加系统消息到对话流**（`🎲 力量检定（D20 15 + 5 = 20，DC 16）→ ✅ 成功`），同时保留 ref 注入下轮 prompt 双保险。

---

## 附录 B：接线层测试体系（回应复审"测试测不到接线层"）

新增 `tests/unit/systems/recheck-fixes.test.ts`（12 用例），把接线逻辑提取为可测纯函数：
- R1：金币→铜币换算公式（铜币进位保持）
- R2：`resetMarketCache + updateSupplyDemand + calculateBuyPrice(itemId)` 全链路价格递增
- R3：`enqueueAction`/`dequeueAction` 纯函数（loading 入队、FIFO、空闲立即发）

---

## 一、v4.2.1 修复总览（上轮，经复审确认实装）



### P0-1 属性/职业/装备/技能与战斗脱钩 ✅ 已修复

**原始描述**：`resolveCombat(baseDamage, elements, enemyType, region, combo, hit)` 参数里没有力量/职业/装备/技能；战斗伤害 = `15+rand(20)` 与玩家成长无关；12 职业 mechanics 零消费；装备 stats 只显示不进公式。

**修复方案**：
1. `combat-engine.ts` 新增 `PlayerCombatStats` 参数接口：`attackAttr`（主属性）、`weaponAttack`（武器攻击力）、`critChance`（暴击）、`dexterity`（命中）
2. 伤害公式改为：`total = (base + 主属性×2 + 武器攻击力) × 元素倍率 × 环境 × 连击 × 暴击(1.5)`
3. 命中率挂敏捷：`hit = 0.75 + 敏捷×0.02`（上限 95%，替换原固定 90%）
4. 暴击由武器 stats.crit 提供（×1.5），叙事中明示属性/装备加值来源
5. 基础伤害从 `15+rand(20)` 调低为 `8+rand(12)`，防止数值膨胀（属性/装备已加入公式）

**关键代码对比**：
```ts
// 修复前
resolveCombat(baseDamage, detectedElements, enemyType, region, currentCombo, hit)
// 修复后
const playerStats: PlayerCombatStats = {
  attackAttr: mainAttr, weaponAttack, critChance: crit, dexterity: dex, className, skills: learnedSkillNames,
};
resolveCombat(baseDamage, detectedElements, enemyType, region, currentCombo, hit, playerStats)
```

**验证状态**：✅ 新增 5 个回归测试（属性+5 伤害+10、武器+10 伤害+10、叠加、未命中归零、基础伤害）；全绿。

---

### P0-2 D20 检定是"假检定"——结果零后果 ✅ 已修复

**原始描述**：`CheckDiceOverlay` 掷骰判定后 onClose 结束，结果不写回任何状态、不告诉 AI；prompt 指示 AI 不自判结果，但前端裁完就扔。

**修复方案**：
1. `CheckDiceOverlay` 新增 `onResult` 回调：判定一出（`roll + modifier` 计算成功/失败）立即回传父组件
2. page.tsx 用 `checkResultRef` 缓存结果，注入**下一轮 AI prompt**（`【D20 检定结果（前端已裁决，你须据此续写后果）】…请立即描述该结果对应的叙事后果`）
3. 消费后清除 ref，避免重复注入

**验证状态**：✅ 代码路径已通（ref 声明、注入点、消费点三处接线完整）。

---

### P0-3 七结局中五个永久锁死（mainQuestCompleted 永不置真） ✅ 已修复

**原始描述**：grep 全仓 `setMainQuestCompleted` 仅在初始化和读档出现，无任何游戏逻辑置 true；6/8 结局 require 该条件 → 数学上不可达，玩家只能玩到"堕落致死"。

**修复方案**（评审人认定的"性价比最高的一行修复"）：
1. 新增 `hasMainQuestCompleted(quests)`：检测主线任务（`type==='main'`）被标记 completed/progress≥100
2. 在 GAMESTATE 合并块**之后**检测（避免被 setGameState 覆盖），置 `mainQuestCompleted = true` 并播报
3. 顺��（P1-5 兜底）：主线完成自动 `endingFlags.crown = max(crown, 1)`，不依赖 AI 自觉追踪

**验证状态**：✅ 新增 2 个回归测试（mainQuestCompleted=true 时人类纪元可达 / false 时不可达）。

---

### P0-4 领地经营经济闭环断裂——资源只有 sink 没有 source ✅ 已修复

**原始描述**：GAMESTATE 无 territory 字段（AI 无法发放资源）；crystal 无获取途径（5 设施 3 级数学上不可达）；民居税收/工坊产出/神殿祈祷无结算代码；围城失败也"挺过"（resolveSiege 写好了没调用）。

**修复方案**：
1. **协议开口**：GAMESTATE 新增 `territory.resources` 增量字段（AI 叙事奖励：战斗缴获/任务奖励），前端自动入账 + 播报
2. **补 source**：`collectTax()`（民居 1/2/3 级 → +20/60/150 金币）、`collectWorkshopOutput()`（工坊 1/2/3 级 → +5/12/30 铁），每次休整（handleTerritoryRest）自动结算
3. **crystal 只走 AI 协议发放**（探索/任务掉落，前端无法刷）
4. **调用 resolveSiege**：失败 = 大量资源损失（金/粮/木/铁）+ 随机设施降级 1 级（主堡除外）+ 防御重算；攻势曲线从 `60+rand(60)` 调为 `40+rand(80)` 缓解与防御上限 180 的错配

**验证状态**：✅ 新增 6 个回归测试（税收三档、工坊产出三档、祈祷减堕落三档、围城失败惩罚、围城胜利无损）。

---

### P0-5 市场系统是摆设——"动态定价"引擎零接入 ✅ 已修复

**原始描述**：`updateSupplyDemand`/`resetMarketCache` 零调用；LOCATION_MODIFIER key 与实际 region id 不匹配（恒 1.0）；合成配方原料在 ITEMS_LIBRARY 零命中；成就奖励纯文案不落账。

**修复方案**：
1. **供需接入**：`handleMarketBuy` 调 `updateSupplyDemand(id, -1, 1)`（买走→需求升供给降→涨价）、`handleMarketSell` 调 `updateSupplyDemand(id, 1, -1)`；开局 `resetMarketCache()`
2. **供需因子生效**：`calculateBuyPrice` 中 supplyDemandMul 从恒 1.0 改为实时计算（0.5~2.0）
3. **LOCATION_MODIFIER key 修正**：加入中文名 + region-0~5 别名（凛冬谷/暮色森林/阴影山脉/荒芜平原/黑曜石荒原/龙脊冰峰），地点修正不再恒 1.0
4. **合成原料入库**：ITEMS_LIBRARY 补 12 种材料（草药/空瓶/硫磺/铁锭/木柄/精钢/皮革/铁钉/肉干/香料酒/清水/魔法水晶），来源含 market/explore，配方全部可触发
5. **成就奖励落账**：Achievement 新增 `rewardGold`（27 处批量注入）与 `rewardSkillPoints` 字段，解锁时 `setWallet` 兑现金币（含进位）、`setGold` 同步、技能点发放，并播报汇总

**验证状态**：✅ 代码接线完整（买卖 handler 已接供需、成就解锁已落账）。

---

### P0-6 货币双轨制——AI 协议与前端钱包脱钩 ✅ 已修复

**原始描述**：前端并存 gold（废弃）与 wallet 两套货币；GAMESTATE 无 wallet/gold 字段（AI 奖励永远无法入账）；DialogueOptions 用废弃 gold 判定；出身体系双轨（content/origins.ts 通用模板 vs FROSTHOLD_PRESET.origins 世界观出身，ID 完全不同，阵营后果永不生效）。

**修复方案**：
1. **GAMESTATE 新增 `wallet` 增量字段**：AI 叙事奖励（gold/silver/copper/shard）→ 前端自动入账 + 进位（10铜=1银，10银=1金）+ 播报
2. **gold state 兼容同步**：入账时同步 `setGold`，避免 DialogueOptions 判定失准
3. **出身体系统一**：`content/origins.ts` 的 `factionBias` 从无效 id（frosthold-garrison/black-obsidian 等）改为凛冬要塞真实阵营（gondor/rohan/lonely-mountain/wood-elves/rivendell/northern-rangers），并在角色确认时**实际应用到 factionReputations**（此前零消费）

**验证状态**：✅ 代码接线完整（wallet 协议透传+入账、origin factionBias 应用）。

---

## P1 — 重要缺陷（内容与体验）

### P1-1 战斗双轨制 ✅ 已修复
**修复**：① 关键词列表收窄为强特征词（`攻击/砍向/劈砍/斩杀/挥剑/出剑/火球/冰霜/雷电/施法/射箭/拉弓/挥拳/突刺/猛击/轰击`），"打听消息/射手在哪"不再误触发；② 战斗结果（伤害/命中）通过 `combatResultRef` 注入下一轮 AI prompt，AI 必须承认前端数值并描述后果。

### P1-2 艾拉事件窗口静默错过 ✅ 已修复
**修复**：新增 `maxCorruptionEverRef` 记录堕落值历史峰值，触发条件从"当前值 ∈ [20,40]"改为"**历史峰值** ∈ [20,40]"。开局选赎罪（+5）再听低语（+3~8）跳过区间的问题根治——艾拉线不再永久锁死。

### P1-3 暗影低语冷却与混排 ✅ 已修复
**修复**：低语选项从普通选项中分离，独立渲染为紫色描边区块「🌑 暗影低语」，并显示冷却轮数（`冷却 N 轮`）；不再与 AI 生成的 OPTIONS 混排。

### P1-4 技能点永久枯竭 ✅ 已修复
**修复**：成就系统新增 `rewardSkillPoints` 字段；`explore-all`（要塞之主）+2 点、`collect-legendary`（神兵天降）+3 点；解锁时 `setSkillPointBalance` 发放。技能树不再"6 点花完 85% 永久不可达"。

### P1-5 结局依赖 AI 追踪 + 无进度可见性 ✅ 已修复
**修复**：① `avgReputation` 排除敌对阵营（dark-legion/black-obsidian 等）——此前把黑暗军团 -40 计入平均导致真结局数学上不可达；② 主线完成自动 `crown+1` 前端兜底（不依赖 AI 自觉输出 endingFlags）。

### P1-6 D20 属性范围与公式错配 ✅ 已修复
**修复**：修正公式从 `floor((attr-10)/2)`（属性 1-10 下恒 ≤0）改为 `attr - 5`（修正 -4~+5，匹配当前范围）；prompt 中 DC 档位同步调低为 8/12/16/20（原 10/15/20/25 在属性 10 时极难必败）。

### P1-7 城镇设施全是"聊天开场白" ✅ 已修复
**修复**：设施进入时触发可执行动作——
- 旅馆：推进 1 天 + 全恢复 + 系统播报
- 神殿：按神殿等级 `templePrayer` 减堕落值（1/2/3 级 → -3/-6/-12）
- 铁匠铺：自动打开合成（背包）面板
- 商店：自动打开市场面板
- 酒馆：纯叙事（接委托/情报由 AI 驱动）

### P1-8 "每章"概念悬空 ✅ 已修复
**修复**：领地设施描述"每章产出/每章祈祷"改为"每次休整"（与 P0-4 的休整结算机制一致）；技能"命运一瞥/驱散堕落"的"每章限一次"改为"每 5 天限一次"（叙事层频次明确）；出身"每章梦境预兆"改为"每隔数日（约 5 天）"。

---

## P2 — 工程质量

| # | 问题 | 状态 | 修复 |
|---|------|------|------|
| P2-1 | 文档严重滞后 | ✅ 已修（上轮） | handover.md 已更新至 v4.2.0 现状 |
| P2-2 | 死代码 resolveStarterSkillNames | ✅ 已修 | 移除 page.tsx 未使用导入 |
| P2-3 | 协议矛盾（prompt 说无技能，职业带 starterSkills） | ✅ 已修 | professions.ts 头部注释统一语义：starterSkills=推荐技能路径，**不再开局授予** |
| P2-4 | 存档格式混乱 + 无紧急存档 | ✅ 已修 | 统一入口已确认（ai-narrator-save-slot-N）；新增 **beforeunload/pagehide 紧急存档**（自动存槽 5） |
| P2-5 | 存档恢复不校验字段 | ✅ 已修 | handleLoadSlot 校验存档结构（缺 characterData/messages 判损坏→提示新开局）；gameState 用 safeParseGameState 深度校验 |
| P2-6 | 面板操作在 loading 中静默丢失 | ✅ 已修 | 新增**全局指令队列** `pendingActionRef`：loading 中点击的指令入队，本轮结束自动串行发送（状态栏提示"指令已排队 N"） |
| P2-7 | 组合条件判定用废弃 gold | ✅ 已修（随 P0-6） | GAMESTATE wallet 入账同步 setGold，DialogueOptions 判定不再失准 |
| P2-8 | 成就"称号"无系统兑现 | ✅ 已修 | AchievementPanel 新增"🏅 你的称号"横幅：从已完成成就 reward 提取称号并展示为名片徽章 |

---

## 验证汇总

| 验证项 | 结果 |
|--------|------|
| TypeScript 类型检查 | ✅ 零错误 |
| 单元测试（全量） | ✅ 126 文件 / 331 用例全绿 |
| 新增回归测试 | ✅ `tests/unit/systems/review-fixes.test.ts`（14 用例：P0-1 战斗公式×5、P1-5 结局敌对排除×2、P0-4 领地经济×5、P0-3 结局解锁×2） |
| 构建 | ✅ next build 通过 |

## 未完全闭环项（如实说明）

- **职业 mechanics 机制化**（评审 P0-1 第 2 条建议 2-3 个高频机制接入）：已让职业名/技能名进入战斗上下文（叙事层），但 mechanics 的数值触发（战士怒气、刺客再动）仍属 [PLACEHOLDER]——诚实标注，不假装全部生效。后续迭代接入。
- **技能效果机制化**（减伤/护盾/回血）：无回合系统前技能效果由 AI 叙事演绎，描述已改为叙事提示风格，不再承诺未实现的数值。
- **结局进度可见性**（结局面板显示各结局达成度）：mainQuestCompleted 与 crown 兜底已落地，达成度百分比 UI 未做（下一步）。
