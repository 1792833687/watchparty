# AI Narrator Game v5.0.0 — 需求修复报告

> 需求来源：甲方指定 5 项（roadmap-v5.0.0.md 之外的即时修复/功能）
> 修复日期：2026-08-01
> 验证：357 个单元测试全绿（+7 新用例）、TypeScript 零错误、构建通过

---

## 需求 1：面板关闭按钮与设置按钮位置重叠 ✅ 已修复

**问题**：设置齿轮按钮 `fixed top:16px right:16px zIndex:1000`，面板关闭按钮 `absolute top:14px right:14px zIndex:102`——两者都固定在右上角且齿轮 zIndex 更高，**齿轮浮在面板之上盖住关闭按钮，无法点击关闭**。

**修复**（双保险）：
1. `QuickSettingsPanel.tsx`：齿轮 zIndex 1000 → **90**（低于面板遮罩 100/关闭按钮 102），面板打开时齿轮落在遮罩下不可遮挡关闭按钮
2. `QuickSettingsPanel` 新增 `hidden` prop：面板打开时齿轮**完全隐藏**（display:none），关闭面板后恢复
3. `page.tsx` 传 `hidden={activePanel !== null}`

**验证**：✅ 面板打开 → 齿轮消失 → 关闭按钮独占可点；面板关闭 → 齿轮恢复。

---

## 需求 2：旁白与对话文本视觉区分 ✅ 已修复

**问题**：assistant 消息用 `MessageBubbleLayout` 整体渲染，内容层没有区分——AI 台词与旁白混在一起。

**修复**：
1. `GameLayout.tsx`：assistant 消息内容改用 **NarrativeRenderer** 渲染（此前组件存在但未接入）
2. `NarrativeRenderer.tsx`：
   - 引号类型扩充：`「」『』""“”''‘’` 全部识别
   - **对话块视觉强化**：金色左边框 + 金色背景块 + 米金色斜体正文 + 说话人标签（💬 名字）
   - 旁白保持默认浅色正文——一眼可辨
3. **修复隐藏 bug**：说话人前有前置旁白时（"你推开门。罗兰说：「小心！」"），前置旁白被说话人提取吞掉 → 重构：说话人取最后一个句子分隔符后的片段（≤8 字），前置旁白归位；说话人后仅剩标点不输出

**验证**：✅ 新增 4 个解析测试 + 原 9 个渲染器测试回归全绿。

---

## 需求 3：对话选项未正确弹出 ✅ 已修复

**问题**（根因）：`parseDialogueOptions` 用 `/\[[\s\S]*\]/` **贪婪匹配** JSON 数组——AI 回复同时带 OPTIONS 与 GAMESTATE 时（GAMESTATE 内 items/quests/news 含 `]`），匹配会吞到 GAMESTATE 的最后一个 `]` → JSON.parse 失败 → 选项静默丢失。

**修复**：
1. 解析前**先剥离 GAMESTATE 块**（`stripGameStateBlock`），再定位 OPTIONS
2. 数组匹配改**非贪婪** `/\[[\s\S]*?\]/`（只取第一个闭合数组）
3. **残留清理**：本轮 AI 回复无新选项时清空上一轮普通选项（保留低语待点击），避免旧选项长期占据界面

**验证**：✅ 新增 3 个解析测试（OPTIONS+GAMESTATE 共存解析、贪婪匹配回归证明、无 OPTIONS 不误伤）。

---

## 需求 4：开局对话选项 ✅ 已实现

**功能**：角色确认进入游戏（`handleCharacterConfirm` 置 phase='playing'）时，立即注入 4 个开局对话选项：
- 🏰 我想先了解要塞的近况与我作为领主的职责
- 🍺 去酒馆打听城里的传闻与消息
- 🎒 清点我的装备与随身物品
- 🛡️ 前往城门巡视防御工事

点击走 `dispatchAction` 发送给 AI 主持人；AI 回复后被新选项替换或清空。玩家开局即通过选择参与互动，提升代入感。

**验证**：✅ 代码接线完整（选项注入 → dispatchAction → 自动替换）。

---

## 需求 5：技能树面板显示职业基础技能 ✅ 已实现

**问题**：技能树面板只显示学派技能树，职业特色基础技能（PROFESSIONS.starterSkills，v4.2.0 起闲置）无处可见——玩家看不到自己职业该学什么。

**修复**：
1. `SkillsPanel` 新增 `classStarterSkills` prop：
   - 顶部「⚔️ 本职业基础技能」横幅：列出职业基础技能名 + 已习得 ✓ / 可学习 状态 + 引导文案
   - 技能树中匹配的技能条目加 **「职业」金色徽章**（含迷雾状态条目），一眼定位
2. `PanelContainer` / `page.tsx` 打通 props 链：`classStarterSkills` 从 PROFESSIONS 按当前职业 `starterSkills` 计算（`useMemo`）
3. 沿用既有技能点/学习机制（tier 1 可点亮；高阶受前置限制），不改变"开局不预解锁"的设计——**信息可见**是本需求的核心

**验证**：✅ 类型检查通过；战士/圣骑/刺客/游侠等职业 starterSkills 数据已存在（12 职业），面板按职业显示。

---

## 验证汇总

| 验证项 | 结果 |
|--------|------|
| TypeScript | ✅ 零错误 |
| 单元测试全量 | ✅ 23 文件 / 357 用例全绿 |
| 新增测试 | ✅ `tests/unit/systems/v5-fixes.test.ts`（7 用例：选项解析 3 + 旁白分段 4） |
| 构建 | ✅ next build 通过 |
| 版本 | ✅ package.json / 文件头 → 5.0.0 |

## 未纳入（roadmap 后续里程碑）

本批为甲方指定的 5 项即时需求。roadmap-v5.0.0.md 的 M1-M5（HP/死亡豁免、纪元结构、职业机制机制化、地下城、新区域等）按规划分阶段实施，不在本批范围。
