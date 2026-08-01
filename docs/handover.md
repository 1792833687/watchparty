---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: b9b1429a9bfb109779f3dca1b6d368d4_a03f27da8ca811f189c1525400f8a581
    ReservedCode1: 633f2a/WRsS258DOqNX01pIpohNR3soq3K1p/BUJ6aZLVrurWAfama0vMH85XUz1pIl40p3Y1gH4t2/Na7OWrvCk8jgAp0T/2WTe5pTqRLe1XK2LBPdUkc5yDM0Nuf2BuKxa+c6mROtzdQXtsXAFwRYEtS3hWbOSRGa7WJb0WvA/10zTox9FnJyqZrg=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: b9b1429a9bfb109779f3dca1b6d368d4_a03f27da8ca811f189c1525400f8a581
    ReservedCode2: 633f2a/WRsS258DOqNX01pIpohNR3soq3K1p/BUJ6aZLVrurWAfama0vMH85XUz1pIl40p3Y1gH4t2/Na7OWrvCk8jgAp0T/2WTe5pTqRLe1XK2LBPdUkc5yDM0Nuf2BuKxa+c6mROtzdQXtsXAFwRYEtS3hWbOSRGa7WJb0WvA/10zTox9FnJyqZrg=
---

# AI Narrator Game v2.0.0 — 重构交接文档

**重构日期**：2026-07-31  
**重构目标**：将 5 个预设精简为单一「凛冬要塞：暗影纪元」预设，严格基于 `11.docx` / `world-setting.md` 设定。

## 改动文件清单

| # | 文件 | 操作 | 说明 |
|---|------|------|------|
| 1 | `backup/v2.0.0-backup/` (11 文件) | 备份 | 重构前 11 个源文件的完整备份 |
| 2 | `src/systems/settings/types.ts` | 修改 | 新增 OriginInfo/BackgroundInfo/CompanionInfo/MagicSchoolInfo/ItemRarity/MapRegionV2/FactionInfo 接口；GameSettingTemplateId → 'frosthold' |
| 3 | `src/systems/settings/settings-loader.ts` | 重写 | 5 个旧预设 → 单一 FROSTHOLD_PRESET（含完整 6 属性/出身/过往/同伴/7 学派/6 区域/配色/禁用词） |
| 4 | `src/app/game/new/page.tsx` | 修改 | BUILD_PRESET → 单一 frosthold（6 属性/6 职业/themeData）；getDefaultGameState 初始物品→钢制长剑/皮甲/领主徽章/治疗药剂/羊皮纸地图；区域→6 个凛冬要塞区域；任务→守夜人之誓；CharacterCreation 透传 origins/backgrounds；PanelContainer 透传 origin/background/factions；版本号 v2.0.0 |
| 5 | `src/components/game/CharacterCreation.tsx` | 重写 | 属性 5→6 项（STR/DEX/CON/INT/WIS/CHA）；新增出身选择步骤（6 项下拉）；新增过往选择步骤（4 项下拉）；接收 origins/backgrounds props |
| 6 | `src/components/game/panels/types.ts` | 修改 | GameItem 新增 rarity/damageType/magicSchool 字段；GameRegion 新增 dangerLevel/regionDesc 字段 |
| 7 | `src/components/game/panels/InventoryPanel.tsx` | 修改 | 新增 RARITY_COLORS / RARITY_LABELS；右键菜单显示稀有度标识 |
| 8 | `src/components/game/panels/MapPanel.tsx` | 修改 | mapTitle 默认→阴影山脉；新增危险等级图例；未解锁提示文本适配凛冬要塞主题 |
| 9 | `src/components/game/panels/QuestPanel.tsx` | 修改 | 标题→使命；空状态文本→命运之线 |
| 10 | `src/components/game/panels/CharacterPanel.tsx` | 修改 | 新增 origin/background/factions props 及显示 |
| 11 | `src/components/game/PanelContainer.tsx` | 修改 | 新增 origin/background/factions props 并透传给 CharacterPanel |
| 12 | `package.json` | 修改 | version: 1.2.0 → 2.0.0 |

## 系统架构概览

```
凛冬要塞：暗影纪元 (frosthold)
│
├── 英雄系统
│   ├── 6 种出身：刚铎骑士 / 北方游侠 / 瑞文戴尔学者 / 孤山铁匠后裔 / 洛汗骠骑 / 自定义
│   ├── 4 种过往：赎罪 / 流放 / 继承 / 使命
│   └── 六维属性：STR / DEX / CON / INT / WIS / CHA (1-20)
│
├── 同伴系统（5 名初始同伴）
│   ├── 索林·铜锤（矮人战士）、艾露恩·星语（精灵游侠）
│   ├── 罗兰爵士（人类圣武士）、莉亚·风行者（半精灵法师）
│   └── 格里姆·暗炉（矮人牧师）
│
├── 法术系统（7 大学派）
│   └── 防护/咒法/预言/塑能/幻术/死灵/变化
│
├── 堕落值系统 (0-100)
│   ├── 6 阶段：纯净→微染→侵蚀→暗影→堕落→深渊
│   └── 暗影低语选项（堕落值≥41 解锁）
│
├── 领地经营
│   ├── 6 大设施 × 3 级：主堡/城墙/兵营/民居/神殿/工坊
│   └── 战略桌（主堡 2 级解锁）
│
├── 探索系统
│   └── 6 区域：凛冬谷(安全)/暮色森林(警戒)/阴影山脉(危险)/荒芜平原(危险)/黑曜石荒原(致命)/龙脊冰峰(致命)
│
├── 阵营外交（6 大阵营）
│   └── 刚铎/洛汗/孤山矮人/林地精灵/瑞文戴尔/北方游侠
│
├── 物品稀有度（5 级）
│   └── 普通/精良/稀有/史诗/传说
│
└── 多结局（7 个结局含隐藏真结局「虚空守望者」）
```

## 保留功能

- 自定义设定（`_imported`）完整处理逻辑
- 聊天 + SSE 流式 API 调用
- 存档/读档（Zustand + secure-storage AES-GCM）
- 对话导出
- GameLayout 三栏布局
- PanelContainer 面板路由
- 纯内联 style（无 Tailwind）
- 未导入 openrouter/client

## UI 配色（凛冬要塞主题）

| 色值 | 用途 |
|------|------|
| `#5B7B9A` | 主色·冰霜蓝（标题/边框） |
| `#A0522D` | 辅色·铁锈棕（按钮/强调） |
| `#D4A574` | 古铜金（文字高亮/主按钮） |
| `#1A1D24` | 背景·深灰黑 |
| `#252830` | 面板底色 |
| `#D3D9DF` | 主文字·浅灰白 |

## 构建状态

`npm run build` → ✓ Compiled successfully

## 后续待办（不在本次范围）

- 堕落值 UI 可视化（CharacterPanel 中的进度条）
- 暗影低语选项的对话插入逻辑
- 战略桌系统完整实现
- 忠诚度审判事件触发逻辑
- 死灵系法术自动增加堕落值的逻辑
- 代价性成功选择分支实现
- 6 区域 SVG 地图重绘（当前保留菱形地图布局）
- 种族/出身对初始属性加成的实际生效
- 通关书信/编年史系统
*（内容由AI生成，仅供参考）*
