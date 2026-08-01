# AI Narrator Game — 更新日志

## v1.2.0 (2026-07-31)

### 🎯 版本概述
v1.2.0 是一次重要的主题自适应完善版本，修复了大量主题不匹配的硬编码问题，并新增了成就系统面板，使游戏更接近可发布版本。

---

### 🐛 BUG 修复

#### 主题自适应相关修复（核心）

1. **CharacterCreation.tsx — 属性标签硬编码修复**
   - 修复了随机职业奖励属性名使用硬编码 `LABELS` 而非 `attrLabels` 的问题（第292行）
   - 修复了属性描述使用硬编码 `DESCS` 而非 `attrDescs` 的问题（第398行）
   - 修复了 aria-label 中使用硬编码 `LABELS` 的问题（第473行）
   - **影响**：现在所有5个主题的角色创建界面都会正确显示对应主题的属性名称和描述

2. **CharacterPanel.tsx — HP/MP 属性名硬编码修复**
   - 新增 `hpAttr` 和 `mpAttr` 两个可选 props（默认值分别为 `constitution` 和 `intelligence`）
   - `calcHp()` 和 `calcMp()` 函数现在接受属性名参数
   - 组件从 props 中获取 hpAttr 和 mpAttr 并传递给计算函数
   - **影响**：现在每个主题的角色面板会根据主题属性正确计算 HP/MP

3. **PanelContainer.tsx — 默认数据硬编码修复**
   - 新增 7 个主题相关 props：`startingItems`, `startingQuests`, `mapRegions`, `mapTitle`, `hpAttr`, `mpAttr`, `skillPoints`
   - `getDefaultItems()`, `getDefaultQuests()`, `getDefaultRegions()` 现在会优先使用主题特定的 props
   - CharacterPanel 调用现在传递 `hpAttr` 和 `mpAttr`
   - SkillsPanel 调用现在传递 `skillPoints`（从 props 传入而非硬编码 3）
   - MapPanel 调用现在传递 `mapTitle`
   - `resolvedLocation` 现在使用 `defaultRegions[0]?.id` 而非硬编码 `'beach'`
   - **影响**：面板容器现在完全支持主题自适应数据

4. **MapPanel.tsx — 地图标题硬编码修复**
   - 新增 `mapTitle` prop（默认值 `'— 岛屿地图 —'`）
   - 地图标题现在使用 `mapTitle` prop
   - **影响**：每个主题的地图面板会显示对应主题的地图标题

5. **InventoryPanel.tsx — 默认物品硬编码修复**
   - 通过 gameState 传递主题特定物品，已在 v1.1.0 基础上完善
   - **影响**：背包面板会显示对应主题的初始物品

6. **游戏主页面 — 主题数据传递完善**
   - 新增 `deriveThemeMeta()` 函数，从 themeData 自动推导 HP/MP 属性键、地图标题和技能点数
   - 修改 PanelContainer 调用，传递所有新的主题相关 props
   - **影响**：游戏主页面现在完整支持主题自适应

---

### ✨ 新增功能

#### 成就系统面板（Achievement Panel）
- **新增文件**：`src/components/game/panels/AchievementPanel.tsx`
- **功能特性**：
  - 24 个成就，分 4 大类别：探索、战斗、收集、叙事
  - 分类标签切换，可按类别筛选成就
  - 总进度统计，显示解锁数量和百分比
  - 每个成就显示：图标、名称、描述、进度条、奖励
  - 隐藏成就支持（未解锁时显示为 ???）
  - 已解锁成就高亮显示
  - 进度条动画效果
- **集成位置**：
  - GamePanelBar 新增成就按钮（🏆）
  - PanelContainer 新增 achievements 面板支持
  - 游戏主页面添加成就状态管理
- **影响**：玩家现在可以查看所有成就的进度和解锁状态

---

### 🔧 系统改进

1. **类型定义扩展**
   - `PanelId` 类型新增 `'achievements'` 选项
   - `PanelContainerProps` 新增 9 个主题相关 props

2. **主题元数据推导**
   - 新增 `deriveThemeMeta()` 函数，自动从 themeData 推导：
     - HP 属性：查找 stamina/physique/constitution 等体质类属性
     - MP 属性：查找 intelligence/willpower/innerPower 等智力类属性
     - 地图标题：基于世界名称自动生成
     - 技能点数：默认 3 点

3. **构建验证**
   - 所有修改均通过 TypeScript 类型检查
   - Next.js 生产构建成功
   - 静态导出正常

---

### 📊 版本数据

- **版本号**：1.1.0 → 1.2.0
- **修改文件数**：8 个
- **新增文件数**：1 个（AchievementPanel.tsx）
- **修复 BUG 数**：6 个主题相关硬编码问题
- **新增功能数**：1 个（成就面板）
- **构建状态**：✅ 成功

---

### 📁 修改文件清单

#### 修改的文件
1. `src/components/game/CharacterCreation.tsx` — 3 处硬编码修复
2. `src/components/game/panels/CharacterPanel.tsx` — HP/MP 属性名参数化
3. `src/components/game/PanelContainer.tsx` — 7 个新 props + 子组件传递
4. `src/components/game/panels/MapPanel.tsx` — mapTitle prop
5. `src/components/game/panels/types.ts` — PanelId 类型扩展
6. `src/components/game/GamePanelBar.tsx` — 新增成就按钮
7. `src/app/game/new/page.tsx` — deriveThemeMeta + PanelContainer props
8. `package.json` — 版本号 1.1.0 → 1.2.0

#### 新增的文件
1. `src/components/game/panels/AchievementPanel.tsx` — 成就面板组件

---

### 🎮 主题支持状态

| 主题 | 职业 | 属性 | 技能 | 物品 | 地图 | HP/MP | 状态 |
|------|------|------|------|------|------|-------|------|
| 奇幻冒险 | ✅ 3个 | ✅ 5个 | ✅ 3类 | ✅ 4个 | ✅ 4个 | ✅ 自动推导 | ✅ 完整支持 |
| 荒岛求生 | ✅ 3个 | ✅ 5个 | ✅ 3类 | ✅ 4个 | ✅ 4个 | ✅ 自动推导 | ✅ 完整支持 |
| 科幻探索 | ✅ 3个 | ✅ 5个 | ✅ 3类 | ✅ 4个 | ✅ 4个 | ✅ 自动推导 | ✅ 完整支持 |
| 现代都市 | ✅ 3个 | ✅ 5个 | ✅ 3类 | ✅ 4个 | ✅ 4个 | ✅ 自动推导 | ✅ 完整支持 |
| 古代武侠 | ✅ 3个 | ✅ 5个 | ✅ 4类 | ✅ 4个 | ✅ 4个 | ✅ 自动推导 | ✅ 完整支持 |

---

### 🚀 下一步计划（v1.3.0 展望）

- 装备系统面板（装备槽位、穿戴/卸下、属性对比）
- 技能系统完善（为所有 15 个职业添加专属天赋树）
- 更多成就和隐藏内容
- 战斗系统优化
- 存档系统完善（云存档、多存档槽管理）
- 音效和背景音乐
- 移动端适配优化

---

### 🔒 备份信息

- **备份位置**：`backup/v1.1.0-pre-update/`
- **备份内容**：src 目录、package.json、next.config.ts、tsconfig.json
- **回滚方式**：将备份文件覆盖回原位置即可
