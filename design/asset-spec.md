# 视觉资产规格清单 (Asset Specification)

> **项目**: AI 主持人文字冒险游戏 (AI Narrator Text Adventure)
> **版本**: v1.0 — Phase 4 资产规格
> **作者**: 林绘澄 (Lin Wayson) — 美术总监
> **日期**: 2025-07-29
> **依赖**: `design/art-bible.md` · `design/gdd/map-system.md` · `docs/architecture/overview.md` · `design/accessibility-requirements.md`
> **状态**: 待审批

---

## 目录

1. [总览与性能预算](#1-总览与性能预算)
2. [地图图块资产](#2-地图图块资产)
3. [UI 图标资产](#3-ui-图标资产)
4. [AI 主持人视觉资产](#4-ai-主持人视觉资产)
5. [UI 组件样式参数](#5-ui-组件样式参数)
6. [装饰粒子资产](#6-装饰粒子资产)
7. [角色/NPC 占位资产](#7-角色npc-占位资产)
8. [字体资产](#8-字体资产)
9. [资产优先级矩阵](#9-资产优先级矩阵)
10. [总预算核算](#10-总预算核算)

---

## 1. 总览与性能预算

### 1.1 性能预算约束

引用 `docs/architecture/overview.md` §13：

| 指标 | 目标 | 测量方式 |
|------|------|---------|
| **首屏总大小 (gzip)** | **< 500KB** | Lighthouse / webpack-bundle-analyzer |
| **地图精灵图** | < 200KB | 单张 sprite sheet |
| **字体子集** | < 100KB / 个 | 子集化 + woff2 |
| **JavaScript 主包** | < 150KB gzip | 代码分割 |

### 1.2 资产阶段分层

| 阶段 | 标签 | 含义 |
|------|------|------|
| **MVP Must Have** | `P0` | 首发必须交付，不可削减 |
| **Should Have** | `P1` | 目标版本，Phase 2 交付 |
| **Could Have** | `P2` | 愿景版本，Phase 3+ |

### 1.3 生成策略标记

| 标记 | 含义 | 说明 |
|------|------|------|
| `🤖 AI` | AI 生成初稿 → 人工筛选/微调 | 适合精灵图、头像变体 |
| `✏️ 手绘` | 设计师手动绘制 | 适合核心视觉锚点 |
| `💻 CSS` | 纯 CSS/SVG 代码实现 | 零额外位图，UI 组件优先 |
| `🎨 SVG` | 参数化 SVG | 适合图标，无损缩放 |
| `🤖+🎨` | AI 初稿 → SVG 参数化 | 头像/图标最优路径 |

### 1.4 资产命名规范

遵循 `design/art-bible.md` 附录 A：

```
[类别]_[子类别]_[名称]_[变体].[扩展名]

类别: ui_ / map_ / char_ / item_ / fx_ / env_ / icon_ / ai_
```

### 1.5 文件格式决策

| 格式 | 适用场景 | 典型大小 |
|------|---------|---------|
| **SVG** | UI 图标、AI 头像、简单几何角色 | 1–8KB (gzip ~1–3KB) |
| **WebP** | 地图图块精灵图、装饰层 | 有损: 高压缩比；无损: 中等 |
| **PNG** | 需要精确 alpha 的小元素（降级） | 备选方案 |
| **CSS** | 按钮/面板/模态/工具提示/粒子 | 0KB 额外资产，仅代码 |
| **woff2** | 字体子集 | 30–90KB / 字体 |

---

## 2. 地图图块资产

### 2.1 图块规格总表

| 参数 | 值 |
|------|-----|
| 菱形尺寸 (外接矩形) | 128×64 px |
| 等距比例 | 2:1 (w:h) |
| 图块间距 | 4px (实际 margin 2px) |
| 输出格式 | **WebP 精灵图** (1 张合并 sprite sheet) |
| 精灵图排列 | 4 主题 × 6 地形 = 24 帧，排列为 8 列 × 3 行 |
| 单帧尺寸 | 128×64 px |
| 精灵图总尺寸 | 1024×192 px |
| 预估大小 | **~120–160KB** (WebP 有损 q75–85) |
| 色深 | 8-bit indexed (每主题 ≤ 32 色) |

### 2.2 四主题 × 六地形图块矩阵

#### 🌲 森林主题 (Forest)

| ID | 地形类型 | 基底色 | 高光色 | 阴影色 | 装饰元素 |
|----|---------|--------|--------|--------|---------|
| `map_terrain_forest_grass` | 草地 | `#3A5A2E` | `#5C8A42` | `#2D4822` | 草叶纹理、小野花点 |
| `map_terrain_forest_dirt` | 泥土路 | `#6B5A3E` | `#8B7A5E` | `#4A3A2E` | 车辙纹、小碎石 |
| `map_terrain_forest_stone` | 岩石地 | `#5A5A55` | `#7A7A72` | `#3A3A35` | 裂缝纹、苔藓斑 |
| `map_terrain_forest_water` | 浅溪 | `#3A5A6E` | `#5A8A9E` | `#2A3A4E` | 波纹线、岸边卵石 |
| `map_terrain_forest_thicket` | 密林 | `#2A4A1E` | `#4A6A3E` | `#1A2A0E` | 灌木剪影、荆棘纹 |
| `map_terrain_forest_clearing` | 林间空地 | `#4A6A3E` | `#6A8A5E` | `#3A5A2E` | 蘑菇圈、斑驳光点 |

#### 🕳️ 洞穴主题 (Cave)

| ID | 地形类型 | 基底色 | 高光色 | 阴影色 | 装饰元素 |
|----|---------|--------|--------|--------|---------|
| `map_terrain_cave_floor` | 洞底 | `#2A2420` | `#4A3A30` | `#1A1410` | 石纹、碎骨片 |
| `map_terrain_cave_stone` | 石板 | `#3A3028` | `#5A4A38` | `#2A2018` | 裂纹、化石纹 |
| `map_terrain_cave_crystal` | 水晶矿脉 | `#2A2838` | `#5A50A0` | `#1A1830` | 发光水晶簇剪影 |
| `map_terrain_cave_water` | 暗河 | `#1A2A38` | `#3A4A58` | `#0A1A28` | 荧光波纹、暗流线 |
| `map_terrain_cave_stalagmite` | 钟乳石区 | `#2A2220` | `#4A3A30` | `#1A1210` | 钟乳石剪影、滴水标记 |
| `map_terrain_cave_bridge` | 石桥 | `#3A3028` | `#5A4A38` | `#2A1A10` | 桥墩纹、深渊暗示 |

#### 🏘️ 城镇主题 (Town)

| ID | 地形类型 | 基底色 | 高光色 | 阴影色 | 装饰元素 |
|----|---------|--------|--------|--------|---------|
| `map_terrain_town_cobble` | 鹅卵石路 | `#7B6D5E` | `#A09080` | `#5A4D3E` | 石块纹、缝隙草 |
| `map_terrain_town_plaza` | 广场 | `#8B7D6B` | `#B0A090` | `#6A5D4B` | 铺地图案、喷泉暗示 |
| `map_terrain_town_floor` | 室内地板 | `#6B5D4E` | `#8B7D6E` | `#4B3D2E` | 木纹/砖纹 |
| `map_terrain_town_market` | 市场 | `#8B7A5E` | `#AB9A7E` | `#6A5A3E` | 摊位顶棚剪影 |
| `map_terrain_town_garden` | 花园 | `#5A6E3E` | `#7A8E5E` | `#3A4E2E` | 花丛、灌木球 |
| `map_terrain_town_wall` | 城墙边 | `#6A5D50` | `#8A7D70` | `#4A3D30` | 城墙线、瞭望塔暗示 |

#### 🌊 水域主题 (Water)

| ID | 地形类型 | 基底色 | 高光色 | 阴影色 | 装饰元素 |
|----|---------|--------|--------|--------|---------|
| `map_terrain_water_shallow` | 浅滩 | `#3A6A7B` | `#5A9AAB` | `#2A4A5B` | 沙纹、贝壳点 |
| `map_terrain_water_deep` | 深海 | `#1A3A5B` | `#2A5A8B` | `#0A2A4B` | 暗流线、气泡点 |
| `map_terrain_water_reef` | 礁石 | `#4A5A5A` | `#6A8A8A` | `#2A3A3A` | 珊瑚剪影、海藻 |
| `map_terrain_water_sand` | 沙滩 | `#8B8A6E` | `#ABAA8E` | `#6B6A4E` | 沙纹、贝壳 |
| `map_terrain_water_wreck` | 沉船区 | `#4A3A2E` | `#6A5A4E` | `#2A1A0E` | 船板碎片、绳索 |
| `map_terrain_water_islet` | 小岛 | `#5A7A4E` | `#7A9A6E` | `#3A5A2E` | 棕榈剪影、沙滩边 |

### 2.3 装饰层精灵（叠加于地形之上）

| ID | 所属主题 | 精灵尺寸 | 内容 | 格式 | P | 策略 | 预估 |
|----|---------|---------|------|------|---|------|------|
| `map_deco_forest_trees` | 森林 | 128×96 px | 树木剪影集 (橡树/松树/柳树) | WebP | P0 | 🤖 AI | 并入 sprite |
| `map_deco_forest_mushrooms` | 森林 | 64×64 px | 蘑菇圈/毒蘑菇 | WebP | P1 | 🤖 AI | 并入 sprite |
| `map_deco_cave_stalactites` | 洞穴 | 128×64 px | 顶部钟乳石 | WebP | P0 | 🤖 AI | 并入 sprite |
| `map_deco_cave_glow_crystals` | 洞穴 | 64×64 px | 荧光水晶簇 | WebP | P1 | 🤖 AI | 并入 sprite |
| `map_deco_town_buildings` | 城镇 | 128×96 px | 建筑屋顶剪影集 | WebP | P0 | 🤖 AI | 并入 sprite |
| `map_deco_town_lamps` | 城镇 | 48×48 px | 路灯/火把 | WebP | P1 | 🤖 AI | 并入 sprite |
| `map_deco_water_waves` | 水域 | 128×32 px | 浪花泡沫边 | WebP | P1 | 🤖 AI | 并入 sprite |
| `map_deco_water_shipwreck` | 水域 | 128×96 px | 沉船残骸 | WebP | P1 | 🤖 AI | 并入 sprite |

> **注**: P0 装饰（基础版）为每主题 1 种核心装饰；P1 扩展至 2-3 种。

### 2.4 图块状态叠加层（CSS 实现，零额外资产）

| 状态 | 实现方式 | 视觉参数 |
|------|---------|---------|
| 选中态 (selected) | CSS `box-shadow` + `border` | `0 0 20px var(--accent-gold)`, `1px solid var(--accent-gold)` |
| 可到达态 (reachable) | CSS `box-shadow` + `@keyframes pulse` | `0 0 10px var(--accent-magic-glow)`, 2s 脉冲周期 |
| 未探索态 (unexplored) | CSS `filter` + 叠加层 | `brightness(0.25) saturate(0.1)` + `overlay-fog` |
| 已探索态 (explored) | CSS `filter` | `brightness(0.6) saturate(0.4)` |
| hover 态 | CSS `transform: scale(1.05)` | 150ms ease-out |

### 2.5 路径线（SVG，运行时绘制）

| ID | 类型 | 样式 | 实现 |
|----|------|------|------|
| `ui_path_traveled` | 已走过 | `solid, 2px, var(--border-subtle)` | SVG `<line>` |
| `ui_path_reachable` | 可到达 | `dashed, 2px, var(--accent-gold)`, 呼吸动画 | SVG `<line>` + CSS animation |
| `ui_path_unknown` | 未探索方向 | `dotted, 1px, var(--text-muted)` | SVG `<line>` |

---

## 3. UI 图标资产

### 3.1 图标规格总表

| 参数 | 值 |
|------|-----|
| 基础画布 | 24×24 px (viewBox) |
| 触控目标 (平板) | ≥ 44×44 CSS px（通过 padding 实现） |
| 格式 | **SVG** (stroke-based, fill="currentColor") |
| 线宽 | 1.5px (regular), 2px (bold) |
| 圆角 | `stroke-linecap="round" stroke-linejoin="round"` |
| 配色 | 继承 `currentColor`，默认 `--text-secondary` |
| 色板 | 单色 + accent 高亮变体（`:hover` 切换至 `--accent-gold`） |
| 预估单图标 | ~0.5–2KB SVG (gzip ~0.3–1KB) |

### 3.2 P0 (MVP Must Have) 图标 — 15 个

| # | ID | 名称 | 用途 | 描述 | 策略 |
|---|-----|------|------|------|------|
| 1 | `icon_ui_settings` | 设置 ⚙ | 顶栏 → 设置页 | 齿轮图标，6 齿 | 🎨 SVG |
| 2 | `icon_ui_inventory` | 背包 📦 | 顶栏 → 背包面板 | 背包/箱子轮廓 | 🎨 SVG |
| 3 | `icon_ui_map` | 地图 🗺 | 移动端 Tab → 地图 | 折叠地图轮廓 | 🎨 SVG |
| 4 | `icon_ui_dialogue` | 对话 💬 | 移动端 Tab → 对话 | 对话气泡 | 🎨 SVG |
| 5 | `icon_ui_status` | 状态 📋 | 移动端 Tab → 状态 | 列表/剪贴板 | 🎨 SVG |
| 6 | `icon_ui_save` | 存档 💾 | 顶栏 → 存档 | 软盘/下载箭头 | 🎨 SVG |
| 7 | `icon_ui_zoom_in` | 放大 + | 地图缩放控件 | 加号 + 放大镜 | 🎨 SVG |
| 8 | `icon_ui_zoom_out` | 缩小 − | 地图缩放控件 | 减号 + 放大镜 | 🎨 SVG |
| 9 | `icon_ui_close` | 关闭 ✕ | 模态/面板关闭 | X 标记 | 🎨 SVG |
| 10 | `icon_ui_arrow_left` | 左箭头 ← | 返回/导航 | 左向箭头 | 🎨 SVG |
| 11 | `icon_ui_arrow_right` | 右箭头 → | 前进/导航 | 右向箭头 | 🎨 SVG |
| 12 | `icon_ui_expand` | 展开 ⤢ | 面板最大化 | 对角线箭头 | 🎨 SVG |
| 13 | `icon_ui_collapse` | 折叠 ⤡ | 面板最小化 | 对角线箭头（反向） | 🎨 SVG |
| 14 | `icon_ui_info` | 信息 ⓘ | 工具提示触发 | 圆圈 i | 🎨 SVG |
| 15 | `icon_ui_warning` | 警告 ⚠ | 错误/危险提示 | 三角感叹号 | 🎨 SVG |

### 3.3 P1 (Should Have) 图标 — 12 个

| # | ID | 名称 | 用途 | 策略 |
|---|-----|------|------|------|
| 16 | `icon_stat_hp` | 生命值 ❤ | 状态栏 HP 标签 | 🎨 SVG |
| 17 | `icon_stat_mp` | 魔力值 💎 | 状态栏 MP 标签 | 🎨 SVG |
| 18 | `icon_stat_defense` | 防御 🛡 | 状态栏属性 | 🎨 SVG |
| 19 | `icon_stat_attack` | 攻击 ⚔ | 状态栏属性 | 🎨 SVG |
| 20 | `icon_action_examine` | 检视 🔍 | 建议动作卡片 | 🎨 SVG |
| 21 | `icon_action_talk` | 交谈 💭 | 建议动作卡片 | 🎨 SVG |
| 22 | `icon_action_move` | 移动 👣 | 建议动作图标 | 🎨 SVG |
| 23 | `icon_action_rest` | 休息 🏕 | 建议动作图标 | 🎨 SVG |
| 24 | `icon_map_undiscovered` | 未知 ❓ | 未探索图块标记 | 🎨 SVG |
| 25 | `icon_map_landmark` | 地标 📍 | 地图 POI 标记 | 🎨 SVG |
| 26 | `icon_dialogue_decision` | 抉择 ⚡ | 关键抉择标识 | 🎨 SVG |
| 27 | `icon_ui_undo` | 撤销 ↩ | 回退操作 | 🎨 SVG |

### 3.4 P2 (Could Have) 图标 — 8 个

| # | ID | 名称 | 用途 | 策略 |
|---|-----|------|------|------|
| 28 | `icon_item_potion` | 药水 🧪 | 物品图标 | 🤖 AI → 🎨 SVG |
| 29 | `icon_item_weapon` | 武器 ⚔ | 物品图标 | 🤖 AI → 🎨 SVG |
| 30 | `icon_item_armor` | 护甲 🛡 | 物品图标 | 🤖 AI → 🎨 SVG |
| 31 | `icon_item_key` | 钥匙 🔑 | 物品图标 | 🎨 SVG |
| 32 | `icon_item_scroll` | 卷轴 📜 | 物品图标 | 🎨 SVG |
| 33 | `icon_ui_light_mode` | 亮色模式 ☀ | 主题切换 | 🎨 SVG |
| 34 | `icon_ui_dark_mode` | 暗色模式 🌙 | 主题切换 | 🎨 SVG |
| 35 | `icon_ui_accessibility` | 可访问性 ♿ | 可访问性菜单 | 🎨 SVG |

### 3.5 图标大小估算

| 阶段 | 数量 | 单图标 (SVG) | gzip 合计 |
|------|------|-------------|----------|
| P0 | 15 | ~1.5KB | ~5KB |
| P1 | 12 | ~1.5KB | ~4KB |
| P2 | 8 | ~1.5KB | ~3KB |
| **P0+P1** | **27** | — | **~9KB** |

---

## 4. AI 主持人视觉资产

### 4.1 AI 头像规格总表

| 参数 | 值 |
|------|-----|
| 默认尺寸 (Level 2 头像模式) | 48×48 px |
| 大尺寸 (Level 3 全息模式) | 72×72 px |
| 格式 | **SVG** (参数化，支持动画) |
| 基础形状 | 几何化狐狸侧面剪影 (水晶狐狸) |
| 材质 | 半透明水晶/玻璃质感 + 内部微光流动 |
| 色彩 | 蓝紫渐变 (`#7B6FDF` → `#A39BF0`) |
| 预估单头像 | ~5–10KB SVG (gzip ~2–4KB) |

### 4.2 P0: 智者型 DM — 默认头像

| ID | 变体 | 描述 | 策略 |
|----|------|------|------|
| `ai_avatar_sage_default` | 默认态 | 水晶狐狸剪影，深蓝金渐变，缓慢呼吸光效 4s | 🤖+🎨 |
| `ai_avatar_sage_speaking` | 说话态 | 头像边缘柔和脉动 2s 周期，微光增强 | 🤖+🎨 |
| `ai_avatar_sage_thinking` | 思考态 | 内部光点旋转加速，外圈虚线旋转 | 🤖+🎨 |
| `ai_avatar_sage_idle` | 空闲态 | 静态，实心圆点指示器 `accent-magic` | 🤖+🎨 |

> 四个变体共用同一 SVG 基础形状，通过 CSS animation / SMIL 动画驱动状态切换。

### 4.3 P1: 四种 DM 个性皮肤

| ID | DM 个性 | 主色调 | 头像形态 | 粒子风格 | 策略 |
|----|---------|--------|---------|---------|------|
| `ai_avatar_trickster_default` | 顽皮型 | `#C97BBF`→`#E0A0D0` | 狐狸/笑脸 | 跳动光点 | 🤖+🎨 |
| `ai_avatar_dark_default` | 黑暗型 | `#8B3A3A`→`#C85554` | 渡鸦/面具 | 上升灰烬 | 🤖+🎨 |
| `ai_avatar_epic_default` | 史诗型 | `#C9A94E`→`#F0D060` | 狮子/皇冠 | 金色光柱 | 🤖+🎨 |
| `ai_avatar_custom_default` | 自定义 | 用户可选 | 组合元素 | 可选 | 🤖+🎨 |

> 每种 DM 皮肤含 4 个状态变体 (default/speaking/thinking/idle)，共 16 个 SVG。

### 4.4 AI 状态指示器

| ID | 类型 | 形状 | 动画 |
|----|------|------|------|
| `ai_indicator_idle` | 空闲 | ○ 实心圆 | 无 |
| `ai_indicator_thinking` | 思考中 | ◌ 旋转虚线圆 | 旋转 |
| `ai_indicator_speaking` | 说话中 | ◎ 脉动扩散圆 | 脉动 2s |
| `ai_indicator_warning` | 警告 | ⬤ 快速脉冲圆 | 快速脉冲 0.5s |

> 全部通过 **CSS animation** 实现，零额外资产。颜色通过 `var(--accent-magic)` 等 CSS 变量控制。

### 4.5 AI 视觉资产大小估算

| 类别 | 数量 | 单文件 | gzip 合计 |
|------|------|--------|----------|
| P0 智者型头像 (4 态) | 4 | ~6KB SVG | ~6KB |
| P1 DM 皮肤 (4×4=16 态) | 16 | ~6KB SVG | ~24KB |
| AI 状态指示器 | 4 | CSS 实现 | 0KB |
| **P0 合计** | — | — | **~6KB** |

---

## 5. UI 组件样式参数

> 本节定义 UI 组件的视觉参数——不是 CSS 代码，是**设计规范**，供前端实现时映射为 CSS 自定义属性。

### 5.1 面板 (Panel)

| 参数 | 值 | CSS 变量映射 |
|------|-----|-------------|
| 背景色 | `#1E1B18` | `--bg-panel` |
| 背景效果 | `backdrop-filter: blur(12px)` | — |
| 边框 | `1px solid #2E2924` | `--border-subtle` |
| 圆角 | 12px | `--panel-radius` |
| 内边距 | 20px | `--panel-padding` |
| 投影 | `0 4px 24px rgba(0,0,0,0.38)` | `--shadow-panel` |

### 5.2 按钮 (Button)

#### Primary Button

| 参数 | 值 |
|------|-----|
| 背景 | `var(--accent-gold)` `#C9A94E` |
| 文字色 | `var(--bg-deep)` `#0D0D12` |
| 圆角 | 8px |
| hover | `filter: brightness(1.1)` |
| active | `filter: brightness(0.95)` |
| focus-visible | `outline: 2px solid var(--accent-gold)`, `outline-offset: 2px` |
| transition | `filter 150ms ease-out` |

#### 尺寸规格

| 尺寸 | 高度 | 水平内边距 | 字号 | 最小触控区 |
|------|------|-----------|------|-----------|
| Small | **36px** (从32px提升以符合触控L2) | 16px | 0.875rem | 36×44px |
| Medium | **44px** (从40px提升以符合触控L2) | 24px | 1rem | 44×44px |
| Large | 48px | 32px | 1.125rem | 48×44px |

#### Secondary Button

| 参数 | 值 |
|------|-----|
| 背景 | transparent |
| 边框 | `1px solid var(--accent-gold)` |
| 文字色 | `var(--accent-gold)` |
| hover 背景 | `var(--accent-gold)` at 10% opacity |

#### Ghost Button (对话选项)

| 参数 | 值 |
|------|-----|
| 背景 | transparent |
| 文字色 | `var(--text-primary)` |
| hover 文字色 | `var(--accent-gold)` |
| hover 位移 | `translateX(4px)` |
| active 文字色 | `var(--accent-gold-dim)` |
| 前缀标记 | `▶` (建议动作卡片) |

### 5.3 模态 (Modal)

| 参数 | 值 |
|------|-----|
| 背景 | `var(--bg-panel-raised)` `#25211E` |
| 边框 | `2px solid var(--border-active)` |
| 圆角 | 16px |
| 投影 | `0 8px 48px var(--shadow-panel)` |
| 遮罩背景 | `var(--overlay-modal)` + `backdrop-filter: blur(4px)` |
| 动画入 | `opacity 0→1` + `transform: scale(0.95→1)`, 200ms ease-out |
| 最大高度 | `min(90vh, 800px)` + 内部滚动 |
| 最小宽度 | 320px |
| 标题栏高度 | 56px |
| 按钮栏内边距 | 16px |

### 5.4 工具提示 (Tooltip)

| 参数 | 值 |
|------|-----|
| 背景 | `var(--bg-panel-raised)` at 95% opacity |
| 边框 | `1px solid var(--border-subtle)` |
| 圆角 | 8px |
| 出现延迟 | 400ms hover |
| 动画 | `fadeIn` 150ms ease-out |
| 最大宽度 | 240px |
| 箭头尺寸 | 6px CSS 三角 (border trick) |
| 内边距 | 8px 12px |
| 字号 | `var(--text-small)` 0.875rem |

### 5.5 输入框 (Input)

| 参数 | 值 |
|------|-----|
| 背景 | `var(--bg-input)` `#2A2522` |
| 文字色 | `var(--text-primary)` |
| 占位符色 | `var(--text-muted)` `#6B6258` |
| 边框 | `1px solid var(--border-subtle)` |
| 圆角 | 8px |
| 内边距 | 10px 16px |
| focus 边框 | `var(--accent-gold)` |
| focus 投影 | `0 0 0 3px var(--accent-gold)` at 20% opacity |
| 字号 | 1rem (16px) — 防止 iOS 缩放 |

### 5.6 滚动条

| 参数 | 值 |
|------|-----|
| 宽度 | `thin` (Firefox) / 6px (Webkit) |
| 滑轨色 | transparent |
| 滑块色 | `var(--border-subtle)` |
| 滑块 hover 色 | `var(--text-muted)` |
| 对话区域宽度 | 4px |

### 5.7 顶栏 (TopBar)

| 参数 | 值 |
|------|-----|
| 高度 | 56px |
| 背景 | `var(--bg-panel)` + `backdrop-filter: blur(12px)` |
| 底部边框 | `1px solid var(--border-subtle)` |
| Logo 字号 | 1.25rem, font-display |
| 图标间距 | 12px |

### 5.8 对话气泡 (Message Bubble)

| 参数 | 值 |
|------|-----|
| AI 气泡背景 | `var(--bg-panel-raised)` |
| AI 气泡左边框 | `3px solid var(--accent-magic)` |
| 玩家气泡背景 | `var(--bg-input)` |
| 玩家气泡对齐 | 右对齐 |
| 圆角 | 12px (AI), 12px (Player) |
| 内边距 | 12px 16px |
| AI 泡泡最大宽度 | 85% |
| 玩家泡泡最大宽度 | 75% |

### 5.9 建议动作卡片 (Suggestion Card)

| 参数 | 值 |
|------|-----|
| 背景 | `var(--bg-panel)` |
| 边框 | `1px solid var(--border-subtle)` |
| hover 边框 | `var(--accent-gold)` |
| hover 背景 | `var(--accent-gold)` at 5% opacity |
| 圆角 | 8px |
| 内边距 | 10px 16px |
| 最小触控高 | 44px |
| 卡片间距 | 8px |
| 交错入场 | stagger 50ms (reduced-motion: 同时) |

### 5.10 CSS 组件大小估算

> 以上组件全部通过 CSS 实现，**零额外位图资产**。CSS 代码归于 `globals.css` + `themes/dark.css`，合计约 **15–25KB gzip**，计入 JS/CSS bundle 预算（不占用资产预算）。

---

## 6. 装饰粒子资产

### 6.1 粒子系统规格总表

| 参数 | 值 |
|------|-----|
| 实现方式 | **Canvas 2D** (性能优先) 或 **CSS animation**（简单粒子） |
| 粒子数量 (Perf 模式) | ≤ 30 个同时活跃 |
| 目标帧率 | 30fps (粒子层), 60fps (CSS 粒子) |
| 位图粒子 | **0KB** — 全部程序化生成 |
| 降级路径 | `prefers-reduced-motion` → 静态光晕 |

### 6.2 三类环境粒子

#### ✨ 魔法粒子 (Magic) — AI 主持人在场

| 参数 | 值 |
|------|-----|
| ID | `fx_particle_magic` |
| 颜色 | `#7B6FDF` → `#A39BF0` (蓝紫渐变) |
| 形状 | 圆形 2-4px + 六角星 6px |
| 运动模式 | 椭圆轨道环绕头像 / 布朗运动（环境） |
| 透明度 | 0.3 → 1.0 (呼吸) |
| 生命周期 | 2–4s，循环产出 |
| 实现 | Canvas 2D |
| P | P0 |
| 策略 | 💻 代码 |

#### 🔍 探索粒子 (Exploration) — 地图可交互提示

| 参数 | 值 |
|------|-----|
| ID | `fx_particle_explore` |
| 颜色 | `#C9A94E` (黄金微光) |
| 形状 | 小光点 2-3px + 偶尔的星形 4px |
| 运动模式 | 从图块中心向上升起 + 微漂移 |
| 透明度 | 0.4 → 0.0 (上升消散) |
| 生命周期 | 1.5s |
| 触发 | 可到达图块 hover / 新发现位置 |
| 实现 | CSS animation (少量粒子) / Canvas (密集) |
| P | P0 |
| 策略 | 💻 代码 |

#### ⚠️ 危险粒子 (Danger) — 战斗/陷阱预警

| 参数 | 值 |
|------|-----|
| ID | `fx_particle_danger` |
| 颜色 | `#C85554` (暗红) |
| 形状 | 不规则碎片 3-6px |
| 运动模式 | 从中心爆散 + 重力下落 |
| 透明度 | 0.8 → 0.0 |
| 生命周期 | 1–2s |
| 触发 | 陷阱触发 / 战斗开始 / HP 骤降 |
| 实现 | Canvas 2D |
| P | P1 |
| 策略 | 💻 代码 |

### 6.3 粒子预算

| 资产 | 位图大小 | 运行时开销 |
|------|---------|-----------|
| 魔法粒子系统 | 0KB | Canvas 30fps ≤ 30粒子 |
| 探索粒子系统 | 0KB | CSS animation |
| 危险粒子系统 | 0KB | Canvas 30fps ≤ 20粒子 |
| **合计** | **0KB** | — |

---

## 7. 角色/NPC 占位资产

### 7.1 规格总表

| 参数 | 值 |
|------|-----|
| 格式 | **SVG** (几何形状) |
| 风格 | 极简几何 — 圆形头部 + 梯形/三角形身体 |
| 色彩 | 主题色板约束（森林=绿系，城镇=暖棕等） |
| 尺寸 (地图实体层) | 64×64 px (菱形内) |
| 尺寸 (对话头像) | 40×40 px (圆形裁切) |
| 动画 | idle 微浮动 (CSS)、walking 弹跳 (CSS) |

### 7.2 玩家角色占位

| ID | 描述 | 形状 | 颜色 |
|----|------|------|------|
| `char_player_placeholder` | 玩家角色 | 圆形头 + 倒三角身 + 小圆底座 | `#C9A94E` (金色标识) |

### 7.3 NPC 占位（按阵营）

| ID | 阵营 | 形状变体 | 颜色 |
|----|------|---------|------|
| `char_npc_friendly_placeholder` | 友好 | 圆形头 + 椭圆身 | `#5A9E6F` |
| `char_npc_neutral_placeholder` | 中立 | 圆形头 + 矩形身 | `#5B8CBE` |
| `char_npc_hostile_placeholder` | 敌对 | 三角头 + 倒三角身 | `#C85554` |

### 7.4 实体占位（地图物品/建筑）

| ID | 类型 | 形状 | 尺寸 | 颜色 |
|----|------|------|------|------|
| `char_entity_item_placeholder` | 可拾取物品 | 菱形 | 32×32 px | `#C9A94E` |
| `char_entity_building_placeholder` | 建筑/地标 | 矩形+三角顶 | 64×64 px | `#8B7D6B` |
| `char_entity_monster_placeholder` | 怪物 | 大圆+小三角耳 | 64×64 px | `#C85554` |

### 7.5 CSS 动画状态

| 状态 | 动画 | 参数 |
|------|------|------|
| idle | 微浮动 | `translateY` ±2px, 2.5s ease-in-out infinite |
| walking | 弹跳 | `translateY` ±4px, 300ms steps(2) |
| interacting | 缩放脉冲 | `scale(1→1.1→1)`, 400ms |
| combat | 快速震动 | `translateX` ±3px, 100ms |

### 7.6 角色资产大小估算

| 类别 | 数量 | 单文件 | gzip 合计 |
|------|------|--------|----------|
| 玩家占位 | 1 | ~1KB SVG | ~0.3KB |
| NPC 占位 | 3 | ~1KB SVG | ~1KB |
| 实体占位 | 3 | ~1KB SVG | ~1KB |
| **P0 合计** | **7** | — | **~2.5KB** |

---

## 8. 字体资产

### 8.1 字体子集规格

| 字体 | 用途 | 子集范围 | 格式 | P | 预估大小 |
|------|------|---------|------|---|---------|
| Crimson Text | AI 叙述/标题 | Latin-1 + 标点 | woff2 | P0 | ~40KB |
| Inter | UI 正文 | Latin-1 + 标点 | woff2 | P0 | ~35KB |
| JetBrains Mono | 数值/等宽 | Latin-1 + 数字+符号 | woff2 | P1 | ~30KB |
| Noto Sans SC | 中文 UI | 常用2500字 | woff2 | P1 | ~80KB |
| Noto Serif SC | 中文叙述 | 常用2500字 | woff2 | P1 | ~90KB |

### 8.2 字体加载策略

| 策略 | 说明 |
|------|------|
| `font-display: swap` | 所有字体——防止 FOIT |
| 预加载 | `<link rel="preload">` 用于 Crimson Text + Inter |
| 延迟加载 | JetBrains Mono、中文字体在需要时加载 |
| 后备栈 | `serif` / `sans-serif` / `monospace` + 系统字体 |

### 8.3 字体预算

| 阶段 | 字体 | gzip 合计 |
|------|------|----------|
| P0 (首屏) | Crimson Text + Inter | ~75KB |
| P1 (延迟) | JetBrains + 中文字体 | ~200KB |
| **P0 首屏** | — | **~75KB** |

---

## 9. 资产优先级矩阵

### 9.1 P0 (MVP Must Have) — 28 项

| # | 类别 | ID | 大小 |
|---|------|-----|------|
| 1 | 地图图块 | `map_terrain_*` 精灵图 (24帧) | ~150KB WebP |
| 2 | 地图装饰 | `map_deco_forest_trees` | 并入 sprite |
| 3 | 地图装饰 | `map_deco_cave_stalactites` | 并入 sprite |
| 4 | 地图装饰 | `map_deco_town_buildings` | 并入 sprite |
| 5–19 | UI 图标 | 15 个 icon (见 §3.2) | ~5KB SVG |
| 20–23 | AI 头像 | `ai_avatar_sage_*` 4 态 | ~6KB SVG |
| 24 | 粒子 | `fx_particle_magic` | 0KB (代码) |
| 25 | 粒子 | `fx_particle_explore` | 0KB (代码) |
| 26 | 角色 | `char_player_placeholder` | ~0.3KB SVG |
| 27 | NPC | 3 阵营 NPC 占位 | ~1KB SVG |
| 28 | 实体 | 3 实体占位 | ~1KB SVG |
| — | 字体 | Crimson Text + Inter | ~75KB woff2 |
| — | CSS | 全部 UI 组件样式 | ~20KB (入 CSS bundle) |

### 9.2 P1 (Should Have) — 21 项

| # | 类别 | 描述 |
|---|------|------|
| 1–10 | UI 图标 | 12 个扩展图�� (见 §3.3) |
| 11–14 | AI 头像 | 4 种 DM 皮肤 (各 4 态 = 16 SVG) |
| 15 | 粒子 | `fx_particle_danger` |
| 16–21 | 地图装饰 | 6 个扩展装饰精灵 (见 §2.3) |
| — | 字体 | JetBrains + 中文字体 |

### 9.3 P2 (Could Have) — 13 项

| # | 类别 | 描述 |
|---|------|------|
| 1–8 | UI 图标 | 8 个愿景图标 (见 §3.4) |
| 9 | 粒子 | 天气粒子 (雨/雪/雾) |
| 10 | 角色 | NPC 半身像占位（对话面板） |
| 11 | 角色 | 怪物变体占位 ×5 |
| 12 | 地图 | 第5种主题 (沙漠/雪原) |
| 13 | 特效 | 区域切换过渡动画序列帧 |

---

## 10. 总预算核算

### 10.1 P0 首屏资产大小

| 资产类别 | P0 数量 | 格式 | 原始 | gzip 估算 |
|---------|---------|------|------|----------|
| 地图精灵图 (地形+装饰) | 1 张 sprite sheet | WebP | ~200KB | **~150KB** |
| UI 图标 | 15 | SVG | ~30KB | **~5KB** |
| AI 头像 (智者型 4态) | 4 | SVG | ~24KB | **~6KB** |
| 角色/NPC/实体占位 | 7 | SVG | ~7KB | **~2.5KB** |
| 粒子系统 | 2 套 | CSS/Canvas | 0KB | **0KB** |
| UI 组件样式 | 全部 | CSS | ~35KB | **~20KB** (入 CSS) |
| 字体 (Crimson+Inter) | 2 | woff2 | ~120KB | **~75KB** |
| **资产小计** | — | — | — | **~163.5KB** |

### 10.2 首屏总预算

| 组成 | gzip 估算 | 预算 | 占比 |
|------|----------|------|------|
| JavaScript (系统+React) | ~120KB | <150KB | 80% |
| CSS (含 UI 组件样式) | ~20KB | — | — |
| 字体 (Crimson+Inter) | ~75KB | <200KB (两次) | 38% |
| 视觉资产 (精灵+图标+头像+占位) | ~163.5KB | <200KB | 82% |
| **总计** | **~378.5KB** | **<500KB** | **76%** |

> ✅ **预算安全**。距 500KB 上限有 ~120KB 余量，为 JS 体积波动和 P1 资产预留空间。

### 10.3 P1 附加大小

| 资产 | gzip 估算 |
|------|----------|
| 扩展图标 12 个 | ~4KB |
| DM 皮肤 4×4 态 | ~24KB |
| 地图装饰扩展 | 并入 sprite (~+30KB) |
| 中文字体 (延迟加载) | ~170KB |
| JetBrains (延迟加载) | ~30KB |
| **P1 首屏增量** | **~58KB** |
| **P0+P1 首屏** | **~436.5KB** (87% 预算) |

> ⚠️ P1 首屏 ~436KB，仍安全但余量收窄至 ~63KB。需在实现阶段实测，必要时优化 sprite 压缩率。

---

## 附录 A: AI 生成提示词模板

### A.1 地图图块生成 Prompt

```
A 2:1 isometric diamond-shaped game tile, [terrain_name] terrain.
Color palette: base [base_color], highlight [highlight_color], shadow [shadow_color].
Style: stylized miniature tabletop terrain, warm lighting, subtle texture,
soft edges, top-down faux-isometric, no perspective distortion.
Resolution: 128x64 pixels, pixel-perfect edges on the diamond clip path.
Background: transparent.
--ar 2:1 --style digital-art --no realistic, 3D, photo
```

### A.2 AI 头像生成 Prompt

```
Geometric minimal crystal fox side-profile silhouette.
Material: translucent glass/crystal with inner glowing light flow.
Color: gradient blue-purple (#7B6FDF to #A39BF0).
Dark background, soft glow aura around edges.
Style: minimalist game avatar, clean lines, vector-art aesthetic.
--style vector-art --no realistic, detailed, furry
```

### A.3 UI 图标生成策略

UI 图标**不推荐 AI 生成**——手工 SVG 更精确、更小、更容易保持风格统一。如必须使用 AI 生成初稿：

```
Minimalist UI icon, [icon_description]. 
Stroke-based, 1.5px line weight, rounded caps and joins.
Single color, transparent background, 24x24 viewBox.
Style: Feather Icons aesthetic, clean, pixel-crisp.
```

---

## 附录 B: 资产管线流程

```
1. AI 生成精灵图/头像初稿
   │
2. 人工筛选 → 色板映射 (限制到 art-bible 定义色板)
   │
3. SVG 参数化 / 合并 sprite sheet
   │
4. 压缩 (SVGO → SVGs / Sharp → WebP sprite)
   │
5. 命名规范检查 → 归入 public/ 目录
   │
6. 性能审计 (Lighthouse + 手动大小检查)
   │
7. 可访问性审计 (对比度、色盲模拟)
```

---

## 附录 C: 平台与渲染管线约束

| 约束 | 来源 | 对本资产规格的影响 |
|------|------|-------------------|
| CSS + Canvas 混合渲染 | `architecture/overview.md` §9 | 图块用 CSS transform 等距变形，粒子用 Canvas 2D |
| 无 WebGL 依赖 | `architecture/overview.md` §1.3 原则 4 | 不使用 3D 模型或复杂着色器 |
| CSS filter + backdrop-blur | `art-bible.md` 附录 B | 战争迷雾、面板模糊通过 CSS 实现 |
| 桌面端优先 | `concept.md` W06 | 资产以 ≥1280px 视口为基准设计 |
| 触摸目标 ≥44px (L2) | `accessibility-requirements.md` §2.7 | 按钮高度调整、图标 padding 扩展 |
| `prefers-reduced-motion` | `accessibility-requirements.md` §2.6 | 所有动画有静态降级方案 |

---

> **下一步**: 主理人审批后，进入资产制作阶段。优先交付 P0 地图精灵图 + UI 图标 + AI 头像。所有 CSS 组件样式与前端实现同步进行。
>
> **待决策**: (1) ✅ 水晶狐狸确认 (2) ✅ 按4主题拆分为4张sprite (3) ✅ MVP不加载中文字体，P1延期
