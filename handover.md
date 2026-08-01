# AI Narrator Game — 项目交接文档

## 项目概述

AI GM 驱动的文字冒险游戏。用户选择预设世界 → 创建角色 → AI Game Master 主持沉浸式叙事。纯前端静态部署。

- **项目路径**: `C:\Users\17928\WorkBuddy\游戏开发`
- **当前版本**: v4.1.0
- **框架**: Next.js 15.5（App Router，static export）
- **状态管理**: useState + Zustand（useWorldStore）
- **LLM**: DeepSeek API（deepseek-chat）
- **Node**: 22.22.2
- **部署**: EdgeOne Makers（`mcp__edgeone-pages__deploy_folder`，项目 `ai-narrator-game`）

---

## v4.1.0 系统总览（当前）

单一世界「凛冬要塞 / Frosthold」。核心数据源：`src/systems/settings/settings-loader.ts` 的 `FROSTHOLD_PRESET`。

| 模块 | 位置 | 说明 |
|------|------|------|
| 角色创建 | `CharacterCreation.tsx` | 12 职业 + 6 出身 + 4 过往；成本制属性分配（核心 1 点/非核心 2 点，总预算 28） |
| 技能树 | `SkillsPanel.tsx` | 9 学派 + 迷雾状态；职业开局预解锁 starterSkills，技能点 = 3 + 难度 |
| 职业系统 | `systems/content/professions.ts` | 12 职业：attrMods / mechanics（3 个/职业）/ growth / starterSkills |
| 背包 | `InventoryPanel.tsx` | 使用/装备（主手·护甲·饰品槽）/详情（lore·stats·sources）/丢弃 |
| 领地经营 | `systems/territory/` + `TerritoryPanel.tsx` | 6 设施×3 级 + 战略桌 + 围城战 |
| 多结局 | `systems/endings/ending-system.ts` + `EndingOverlay.tsx` | 8 结局（含隐藏真结局「虚空守望者」）+《致领主书》 |
| 世界书 | `systems/worldbook/` + `WorldBookPanel.tsx` | 权威设定源，可编辑，注入 AI prompt 约束主线 |
| NPC 引擎 | `systems/npc/npc-engine.ts` | 6 NPC（含艾拉）自主行为推演 |
| 堕落值 | page.tsx + 面板 | 六阶段 + 暗影低语 + 游离之魂事件 |
| 旁白/对话 | `NarrativeRenderer.tsx` | AI 输出「」引号 → 对话块（金色+说话人），prompt 有对话标记协议 |
| 存档 | localStorage | `ai-narrator-save-slot-N` / `ai-narrator-slot-meta-N`；标题页「继续游戏」走 `?slot=N` |

---

## 构建与部署

```powershell
cd "C:\Users\17928\WorkBuddy\游戏开发"
# 类型检查（应零错误）
npx tsc --noEmit
# 单元测试（17 文件 / 295 用例，应全绿）
npx vitest run
# 构建（产物在 out/）
npx next build
# 部署：经 EdgeOne Makers 连接器 deploy_folder（builtFolderPath=out, projectType=static, projectName=ai-narrator-game）
```

---

## known keys

| localStorage Key | 用途 |
|------|------|
| `deepseek-api-key` | DeepSeek API Key（AES-GCM 加密；旧键 `ai-narrator-openrouter-api-key` 兼容迁移） |
| `ai-narrator-selected-preset` | 预设 ID |
| `ai-narrator-imported-setting` | 自定义 JSON 设定 |
| `custom-api-config` | 自定义 API 配置 |
| `ai-narrator-save-slot-N` / `ai-narrator-slot-meta-N` | 存档位（N=0~5） |
| `ai-narrator-worldbook` | 世界书条目（可编辑设定） |
| `ai-narrator-save-slots` | ⚠️ 旧键，已废弃（不再写入） |

---

## 已知问题

- `src/components/settings/` 下旧版组件（SettingsPanel/SetupPanel/TextImportModal）含 openrouter/client 导入链问题，已废弃；当前用 `/settings/page.tsx` 极简版
- `next/font/google` — 静态导出可能无网络加载失败（有 fallback）
- Next.js `headers/rewrites` 在 `output: 'export'` 下无效（CSP 需在托管平台配置）
*（内容由AI生成，仅供参考）*
