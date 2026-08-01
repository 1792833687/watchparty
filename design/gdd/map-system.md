# GDD: 地图系统 (Map System)

> **子系统编号**: SYS-MAP-001  
> **作者**: 文策渊 (Vince Coyer)  
> **状态**: Draft  
> **版本**: 0.1.0  
> **依赖**: 美术圣经 §7（2.5D 地图视觉规范）、记忆引擎 (SYS-MEM-001)  
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

地图系统是 AI Narrator Game 的**空间交互层**。它将玩家从纯文本界面中解放出来，提供触觉化的 2.5D 等距地图作为"桌面上的沙盘"。地图不只是视觉装饰——每个图块都是潜在的叙事触发器，空间关系编码叙事关系。

**一句话定义**：地图系统是"世界的棋盘"——玩家在上面移动棋子（自己），AI GM 在上面布置剧情。

### 1.2 与概念支柱的映射

| 支柱 | 地图系统如何支撑 |
|------|-----------------|
| **支柱 I: AI 即 GM** | 地图是 GM 布置遭遇、偶遇、隐藏线索的空间画布；AI 根据玩家位置注入空间上下文 |
| **支柱 II: 地图即叙事** | ★★★ 核心支柱——每个图块承载至少一个叙事/机制/资源功能；空间关系讲述故事 |
| **支柱 III: 记忆即世界** | 地图状态变化（烧毁的村庄、移动的 NPC）通过记忆引擎持久化 |
| **支柱 IV: 选择有重量** | 移动也是一种选择——走哪条路、探哪个洞，会引发不同的连锁事件 |

### 1.3 三层空间架构

```
┌─────────────────────────────────────────────┐
│ Region (区域)                                │
│ ┌─────────────────────────────────────────┐ │
│ │ Tile (图块)               Tile           │ │
│ │ ┌───────────┐       ┌───────────┐       │ │
│ │ │ Entity    │       │           │       │ │
│ │ │ ┌───────┐ │       │           │       │ │
│ │ │ │ NPC   │ │       │           │       │ │
│ │ │ └───────┘ │       │           │       │ │
│ │ └───────────┘       └───────────┘       │ │
│ │                                          │ │
│ │  Tile          Tile          Tile        │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘

Region:  大地图分区（森林区域、城镇区域等），包含一组 Tile
Tile:    最小空间单元（128×64px 等距菱形），有坐标、地形、状态
Entity:  图块上的可交互对象（NPC、怪物、物品、建筑）
```

### 1.4 子系统依赖图

```
                    ┌──────────────┐
                    │  对话系统     │
                    │  触发区域事件  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │  地图系统  │ │ 记忆引擎  │ │ 状态管理  │
        │  (Map)    │─│ (查询)   │ │ (HUD)    │
        └──────────┘ └──────────┘ └──────────┘
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
  渲染层   战争迷雾   移动逻辑
  (CSS)   (Canvas)   (A*寻路)
```

---

## 2. 机制设计

### 2.1 图块移动机制

#### 2.1.1 移动规则

```
移动规则:
1. 玩家一次点击可移动到视野内的任意图块
2. 可达性判定:
   - 相邻图块（8 方向）: 默认可达（除非被阻挡）
   - 阻挡物: 墙壁、锁住的门、深水（无船）、悬崖
   - 远程移动（>1 格）: 使用 A* 寻路算法计算最短路径
3. 移动速度: 默认 300ms/格（CSS transition）
4. 移动触发:
   - 进入图块: 触发 onTileEnter 事件
   - 离开图块: 触发 onTileLeave 事件
   - 到达目的地: 触发 onArrival 事件
   - 经过路径: 不触发事件（仅目的地图块触发）
5. 移动中可打断: 点击新位置 → 中断当前移动 → 重新寻路
```

#### 2.1.2 移动流程图

```
玩家点击图块
    │
    ▼
┌──────────────┐
│ 验证可达性    │────── 不可达 → 无响应（或震动反馈）
└──────┬───────┘
       │ 可达
       ▼
┌──────────────┐
│ A* 寻路       │────── 无路径 → 显示"无法到达"提示
└──────┬───────┘
       │ 找到路径
       ▼
┌──────────────┐
│ 显示路径预览  │  ← dashed 线 + 脚印图标, 300ms 绘制
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 执行移动动画  │  ← 逐格移动，300ms/格
└──────┬───────┘
       │ 每进入一格
       ▼
┌──────────────┐
│ 触发区域事件  │  ← 如有遭遇/发现，通知对话系统
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 到达目的地    │  ← 更新玩家位置 + 揭示战争迷雾 + 推送记忆事件
└──────────────┘
```

### 2.2 战争迷雾系统（三层）

```
Layer 1: 未探索 (Unexplored)
  - 完全遮挡，显示 overlay-fog (#0D0D12CC)
  - 图块内容不可见
  - filter: brightness(0.25) saturate(0.1)
  
Layer 2: 已探索·不可见 (Explored, Not Visible)
  - 玩家曾到过但当前不在视野内
  - 半透明灰阶化
  - filter: brightness(0.6) saturate(0.4)
  - NPC/实体不可见（仅地形可见）
  - 不触发事件
  
Layer 3: 当前视野 (Visible)
  - 完整渲染
  - 可交互
  - 视野范围: 以玩家为中心，半径 N 格（默认 6 格）
  - 视野边界用柔和羽化过渡到 Layer 2
```

**迷雾揭示规则**：
- 移动时逐步揭示：每进入一个新图块，其周围的 Layer 1 → Layer 2
- 视野计算：Bresenham 视线算法（考虑阻挡物）
- 阻挡物（墙壁、密林）后方图块保持未探索

**迷雾实现方式**：
- CSS `mask-image` (径向渐变 + 图块位置计算) 或 Canvas 叠加层
- 已探索图块状态序列化到存档中

### 2.3 区域加载策略

```
当前区域 (Active Region):
  - 玩家所在的 Region 完整加载（所有 Tile + Entity）
  
邻近区域 (Neighbor Regions):
  - 仅加载地形数据（Tile 地形类型 + 坐标）
  - Entity 不加载
  - 玩家移动到区域边缘 → 触发区域切换

区域切换流程:
1. 玩家到达区域边界图块（区域出口/入口）
2. 显示过渡动画 (淡出 200ms)
3. 卸载当前区域 Entity
4. 加载新区域完整数据
5. 计算新区域的战争迷雾（基于存档）
6. 玩家出现在新区域入口图块
7. 显示过渡动画 (淡入 200ms)
8. 触发新区域进入事件 → 通知对话系统
```

### 2.4 事件触发系统

```typescript
type TileEventTrigger = 
  | 'on_enter'          // 首次进入图块
  | 'on_every_enter'    // 每次进入图块
  | 'on_examine'        // 玩家检视图块
  | 'on_proximity'      // 玩家靠近（进入 N 格范围）
  | 'on_time'           // 特定时间触发
  | 'on_condition';     // 条件触发（如持有特定物品）

interface TileEvent {
  id: string;
  trigger: TileEventTrigger;
  condition?: EventCondition;       // 可选附加条件
  action: EventAction;
  repeatable: boolean;
  hasFired: boolean;                // 是否已触发过
  cooldown?: number;                // 冷却时间 (ms), 用于 on_every_enter
}
```

**事件 → 对话系统桥接**：
- 图块事件触发 → 调用 `dialogueSystem.sendMessage()` 并传入图块上下文
- AI GM 收到空输入 + 图块上下文 → 主动叙述该图块的叙事内容

### 2.5 地图主题变体

| 主题 | 地形色板 | 特色图块 | 环境粒子 | 美术圣经 §7.5 |
|------|---------|---------|---------|-------------|
| **森林** | `#3A5A2E` / `#5C8A42` | 古树、灌木丛、蘑菇圈 | 飘落树叶、斑驳光点 | ✓ |
| **洞穴** | `#2A2420` / `#4A3A30` | 钟乳石、水晶矿脉、暗河 | 荧光孢子、滴水粒子 | ✓ |
| **城镇** | `#8B7D6B` / `#C4B5A0` | 建筑、市场摊位、路灯 | 炊烟、灯火闪烁 | ✓ |
| **水域** | `#2E4A6B` / `#4A7A9B` | 浅滩、礁石、沉船 | 波纹、泡沫、倒影 | ✓ |

### 2.6 缩放系统

```
缩放级别:
  0.5x  — 最小缩放（图块 64×32px），适合浏览大地图
  1.0x  — 默认缩放（图块 128×64px）
  1.5x  — 细节缩放（图块 192×96px），开始显示图块标签
  2.0x  — 最大缩放（图块 256×128px），显示全部细节

缩放行为:
  - 鼠标滚轮: 以鼠标位置为中心缩放
  - +/- 按钮: 以画布中心缩放（200ms ease-out 过渡）
  - 缩放 > 1.5x: 显示图块标签（地名、类型）
  - 缩放 < 0.75x: 隐藏实体层（仅显示地形+装饰）

缩放与迷雾:
  - 战争迷雾随缩放等比调整
  - 缩放 < 0.75x 时，未探索区域显示为统一的暗色块（不显示图块细节）
```

---

## 3. 数据结构

### 3.1 核心 TypeScript 接口

```typescript
// ============================================================
// 区域 (Region)
// ============================================================

interface Region {
  id: string;                       // UUID
  name: string;
  description: string;              // AI GM 在玩家进入时的描述锚点
  theme: MapTheme;
  bounds: RegionBounds;             // 区域的世界坐标范围
  tiles: Map<string, Tile>;         // key = "col,row"
  entities: Map<string, MapEntity>;
  entryPoints: RegionEntryPoint[];  // 与其他区域的连接
  ambientNarrative: string;         // 区域氛围描述（注入 prompt）
}

interface RegionBounds {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

interface RegionEntryPoint {
  id: string;
  tileCoord: TileCoord;
  targetRegionId: string;
  targetTileCoord: TileCoord;
  direction: CompassDirection;
  isLocked: boolean;                // 需要条件满足才可通过
  unlockCondition?: EventCondition;
}

type MapTheme = 'forest' | 'cave' | 'town' | 'water';

type CompassDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

// ============================================================
// 图块 (Tile)
// ============================================================

interface TileCoord {
  col: number;                      // 等距列坐标
  row: number;                      // 等距行坐标
}

interface Tile {
  coord: TileCoord;
  terrain: TerrainType;
  elevation: number;                // 高程 (0 = 基准面)
  
  // 视觉
  themeOverrides?: Partial<TileThemeColors>;
  decorationId?: string;            // 装饰层精灵图 ID
  
  // 游戏逻辑
  isWalkable: boolean;
  isExplorable: boolean;            // 是否可探索（阻挡物后方）
  moveCost: number;                 // 经过此格的时间代价（默认 1.0）
  
  // 叙事
  name: string;                     // 玩家可见的名称（如 "古老橡树"）
  description: string;              // AI GM 叙述参考
  labels?: string[];                // 缩放 > 1.5x 时显示的标签
  
  // 事件
  events: TileEvent[];
  
  // 状态
  fogState: FogState;
  isDiscovered: boolean;            // 玩家是否曾见过此格
  
  // 实体
  entityIds: string[];              // 此格上的实体 ID 列表
}

type TerrainType = 
  | 'grass' | 'dirt' | 'stone' | 'sand'
  | 'water_shallow' | 'water_deep'
  | 'road' | 'bridge'
  | 'wall' | 'door_locked' | 'door_open'
  | 'cliff' | 'pit'
  | 'building_floor';

type FogState = 'unexplored' | 'explored' | 'visible';

interface TileThemeColors {
  base: string;                     // 地形基底色
  highlight: string;                // 高光色
  shadow: string;                   // 阴影色
}

// ============================================================
// 地图实体 (Map Entity)
// ============================================================

interface MapEntity {
  id: string;                       // 与记忆引擎的 entity ID 对应
  name: string;
  type: MapEntityType;
  coord: TileCoord;                 // 当前所在图块坐标
  
  // 视觉
  spriteId: string;                 // 精灵图资产 ID
  spriteSize: SpriteSize;
  animationState: EntityAnimationState;
  
  // 行为
  isMovable: boolean;               // NPC 是否会移动
  movementPattern?: MovementPattern;
  isInteractable: boolean;
  interactionRadius: number;        // 多少格内可交互
  
  // 状态
  isActive: boolean;                // 是否在当前地图上
  currentHp?: number;
  disposition: 'friendly' | 'neutral' | 'hostile' | 'fleeing';
  
  // 叙事
  dialogueTrigger?: string;         // 点击时的对话触发文本
  examineText?: string;             // 检视文本
}

type MapEntityType = 'player' | 'npc' | 'monster' | 'item' | 'building' | 'trigger';

interface SpriteSize {
  width: number;                    // 默认 64
  height: number;                   // 默认 64
}

type EntityAnimationState = 'idle' | 'walking' | 'interacting' | 'combat' | 'disabled';

type MovementPattern = 
  | 'stationary'                    // 不移动
  | 'patrol'                        // 按路径巡逻
  | 'wander'                        // 随机游荡
  | 'follow_player';                // 跟随玩家

// ============================================================
// 地图状态 (序列化)
// ============================================================

interface MapState {
  playerCoord: TileCoord;
  currentRegionId: string;
  tileStates: Record<string, {       // key = "regionId:col,row"
    fogState: FogState;
    isDiscovered: boolean;
  }>;
  entityStates: Record<string, {     // key = entityId
    coord: TileCoord;
    isActive: boolean;
    currentHp?: number;
    disposition: 'friendly' | 'neutral' | 'hostile' | 'fleeing';
  }>;
  regionStates: Record<string, {     // key = regionId
    isUnlocked: boolean;
    visitCount: number;
    firstVisitedAt?: number;
  }>;
}
```

### 3.2 存储布局

```
IndexedDB: "map-system"
├── ObjectStore: "worldData"
│   └── key: worldId → { regions: Region[], entities: MapEntity[] }
└── ObjectStore: "mapStates"
    └── key: saveSlotId → MapState

localStorage: "map-system-meta"
├── key: "currentWorldId" → string
└── key: "zoomLevel" → number
```

---

## 4. API 契约

### 4.1 地图系统内部 API

```typescript
interface IMapSystem {
  // --- 生命周期 ---
  init(config: MapConfig): Promise<void>;
  
  /** 加载世界数据（区域+图块+实体） */
  loadWorld(worldId: string): Promise<void>;
  
  /** 加载地图状态（从存档） */
  loadState(state: MapState): Promise<void>;
  
  /** 导出当前地图状态（用于存档） */
  exportState(): MapState;

  // --- 玩家移动 ---
  /** 请求移动到目标图块 */
  moveTo(coord: TileCoord): Promise<MoveResult>;
  
  /** 中断当前移动 */
  cancelMovement(): void;
  
  /** 获取玩家当前位置 */
  getPlayerCoord(): TileCoord;
  
  /** 获取当前区域 */
  getCurrentRegion(): Region;

  // --- 图块查询 ---
  /** 获取指定坐标的图块 */
  getTile(coord: TileCoord): Tile | undefined;
  
  /** 获取指定区域的所有图块 */
  getRegionTiles(regionId: string): Tile[];
  
  /** 获取指定图块的邻近可到达图块 */
  getReachableTiles(from: TileCoord, range: number): TileCoord[];
  
  /** 计算两点之间的最短路径 */
  findPath(from: TileCoord, to: TileCoord): TileCoord[] | null;

  // --- 区域 ---
  /** 切换到指定区域 */
  switchRegion(regionId: string, entryCoord: TileCoord): Promise<void>;
  
  /** 获取已解锁的区域列表 */
  getUnlockedRegions(): Region[];

  // --- 实体 ---
  /** 获取指定图块上的实体 */
  getEntitiesAt(coord: TileCoord): MapEntity[];
  
  /** 获取邻近实体 */
  getNearbyEntities(coord: TileCoord, radius: number): MapEntity[];
  
  /** 移动实体到新坐标 */
  moveEntity(entityId: string, to: TileCoord): void;

  // --- 战争迷雾 ---
  /** 在指定坐标揭示迷雾 */
  revealFog(coord: TileCoord, radius: number): void;
  
  /** 获取图块的迷雾状态 */
  getFogState(coord: TileCoord): FogState;

  // --- 事件 ---
  /** 注册图块事件监听 */
  onTileEvent(handler: (event: TileEvent, tile: Tile) => void): void;
  
  /** 移除事件监听 */
  offTileEvent(handler: (event: TileEvent, tile: Tile) => void): void;

  // --- 视图 ---
  /** 设置缩放级别 */
  setZoom(level: number): void;
  
  /** 将地图画布居中到指定坐标 */
  centerOn(coord: TileCoord): void;
  
  /** 获取当前缩放级别 */
  getZoom(): number;
}

interface MapConfig {
  defaultZoom: number;              // 默认 1.0
  minZoom: number;                  // 默认 0.5
  maxZoom: number;                  // 默认 2.0
  labelZoomThreshold: number;       // 默认 1.5
  entityHideZoomThreshold: number;  // 默认 0.75
  moveSpeedMs: number;              // 默认 300
  defaultViewRadius: number;        // 默认 6
  tileWidth: number;                // 默认 128
  tileHeight: number;               // 默认 64
}

interface MoveResult {
  success: boolean;
  path: TileCoord[];
  tilesEntered: TileCoord[];
  eventsTriggered: TileEvent[];
  destinationReached: boolean;      // false = 中途被打断
}
```

### 4.2 与对话系统的接口

```typescript
// 地图系统 → 对话系统: 图块事件触发
// 玩家进入有叙事事件的图块时
mapSystem.onTileEvent(async (event, tile) => {
  if (event.trigger === 'on_enter' || event.trigger === 'on_every_enter') {
    await dialogueSystem.sendMessage({
      type: 'free_text',
      text: '',  // 空文本 → AI GM 主动叙述
      metadata: {
        clickedTileId: tile.coord.col + ',' + tile.coord.row,
        clickedEntityId: tile.entityIds[0]
      }
    });
  }
});

// 对话系统 → 地图系统: 状态更新
// AI 回应中可能触发位置变化
if (stateDelta.locationChange) {
  const targetCoord = parseCoord(stateDelta.locationChange);
  await mapSystem.moveTo(targetCoord);
}
```

### 4.3 与记忆引擎的接口

```typescript
// 地图系统 → 记忆引擎: 探索事件
await memoryEngine.ingest({
  id: crypto.randomUUID(),
  sessionId: currentSessionId,
  type: 'discovery',
  timestamp: Date.now(),
  importance: tile.isKeyLocation ? 3 : 1,
  summary: `发现 ${tile.name}`,
  detail: `玩家首次到达 ${tile.name}: ${tile.description}`,
  entitiesExtracted: [region.entityIds...],
  relationsUpdated: [],
  tags: [],
  precedingEventId: lastEventId
});

// 地图系统 → 记忆引擎: 查询区域历史
const relatedEntities = memoryEngine.searchEntities(region.name, 20);
// 获取该区域相关的 NPC、事件、物品
```

---

## 5. UI 绑定

### 5.1 与美术圣经的映射

| 地图功能 | 美术圣经引用 | 实现方式 |
|---------|-------------|---------|
| 等距菱形图块 | §7.1 2:1 投影 | CSS `transform: rotate(45deg) scale(1, 0.5)` 或 SVG polygon |
| 五图层系统 | §7.2 图层 | z-index 阶梯：地形(0) < 装饰(1) < 实体(2) < 粒子(3) < UI叠加(4) |
| 图块尺寸 | §7.2 128×64px | CSS 变量 `--tile-width: 128px; --tile-height: 64px` |
| 图块间距 | §7.2 4px | `margin: 2px` |
| 选中态光晕 | §6.4 选中态 | `box-shadow: 0 0 20px var(--accent-gold)` |
| 可到达态脉冲 | §6.4 可到达态 | `@keyframes pulse { 0%,100% { opacity:0.6 } 50% { opacity:1 } }` |
| 未探索态 | §6.4 + §7.4 | `filter: brightness(0.25)` + `overlay-fog` |
| 路径线 | §7.3 | SVG line: solid(已走)/dashed(可到达 2px accent-gold)/dotted(未知 1px text-muted) |
| 战争迷雾 | §7.4 | Canvas 叠加层，CSS mask-image 羽化边界 |
| 缩放控件 | §7.6 | 角落 +/- 按钮 + 鼠标滚轮 |
| 地图主题 | §7.5 | 森林/洞穴/城镇/水域四套色板 + 装饰 |
| 布局位置 | §5.1 左侧面板 360px | `--map-width: 360px`，响应式断点适配 |

### 5.2 等距渲染实现

```css
/* 等距地图容器 */
.map-container {
  width: var(--map-width);
  height: 100%;
  overflow: hidden;
  position: relative;
  background: var(--bg-table);
}

/* 等距变换 */
.map-isometric {
  transform: rotateX(60deg) rotateZ(45deg);
  transform-style: preserve-3d;
}

/* 图块 */
.tile {
  width: 128px;
  height: 64px;
  position: absolute;
  /* 等距坐标 → 屏幕坐标 */
  /* screenX = (col - row) * (tileWidth / 2) */
  /* screenY = (col + row) * (tileHeight / 2) */
  
  /* 菱形裁剪 */
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  cursor: pointer;
  transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
}

.tile:hover {
  transform: scale(1.05);
  z-index: 10;
}

.tile--selected {
  box-shadow: 0 0 20px var(--accent-gold);
  border: 1px solid var(--accent-gold);
}

.tile--reachable {
  box-shadow: 0 0 10px var(--accent-magic-glow);
  animation: tile-pulse 2s ease-in-out infinite;
}

.tile--unexplored {
  filter: brightness(0.25) saturate(0.1);
}

.tile--explored {
  filter: brightness(0.6) saturate(0.4);
}

.tile--visible {
  filter: none;
}

@keyframes tile-pulse {
  0%, 100% { box-shadow: 0 0 10px var(--accent-magic-glow); }
  50% { box-shadow: 0 0 20px var(--accent-magic-glow); }
}
```

### 5.3 关键屏幕：地图面板

```
┌────────────────────────────────┐
│  🗺️ 黑暗森林          [+] [-] │  ← 区域名 + 缩放控件
├────────────────────────────────┤
│                                │
│    ╱╲    ╱╲    ╱╲    ╱╲      │
│   ╱░░╲  ╱  ╲  ╱  ╲  ╱░░╲     │  ← ░░ = 未探索
│   ╲░░╱  ╲  ╱  ╲  ╱  ╲░░╱     │
│    ╲╱    ╲╱    ╲╱    ╲╱      │
│                                │
│    ╱╲    ╱╲    ╱╲    ╱╲      │
│   ╱  ╲  ╱🏰╲  ╱  ╲  ╱  ╲     │  ← 🏰 = 建筑
│   ╲  ╱  ╲  ╱  ╲  ╱  ╲  ╱     │
│    ╲╱    ╲╱    ╲╱    ╲╱      │
│                                │
│    ╱╲    ╱╲    ╱╲    ╱╲      │
│   ╱  ╲  ╱  ╲  ╱🧙╲  ╱  ╲     │  ← 🧙 = NPC
│   ╲  ╱  ╲  ╱  ╲  ╱  ╲  ╱     │     ★ = 玩家当前位置
│    ╲╱    ╲╱    ╲╱    ╲╱      │     --- = 路径线
│                                │
│   ●────●────● ═ ═ ● · · ●    │  ← 图例: 已走/可达/未知
│                                │
└────────────────────────────────┘
```

---

## 6. 边界条件

### 6.1 错误处理

| 场景 | 处理策略 | 降级方案 |
|------|---------|---------|
| 图块数据缺失 | 渲染为"虚空"图块（黑色 + ❓图标），标记为不可行走 | 记录错误日志，跳过该图块 |
| 寻路无解（角色被包围） | 返回 null，UI 显示"无路可走"提示 | 如果玩家被卡住，AI GM 提供传送/帮助 |
| 世界数据加载失败 | 显示"地图数据损坏"提示 + 重建选项 | 从游戏设定文件重新生成基础地图 |
| 等距渲染性能不足 (<30fps) | 降低粒子层帧率、减少可视范围、隐藏装饰层 | 降级为纯色方块 + 标签模式 |
| 区域切换时 IndexedDB 读写失败 | 重试 3 次，失败后保持在当前区域 | 显示"区域切换失败"提示 |
| 坐标越界 | 边界检查 + clamp | 不渲染越界图块 |

### 6.2 极限情况

| 极限 | 阈值 | 行为 |
|------|------|------|
| 单区域图块 > 10000 | 分块渲染（仅渲染视口内图块） | 虚拟滚动/懒加载，视口外图块不挂载 DOM |
| 同屏实体 > 200 | 合并渲染（精灵批处理），远处实体用色点替代 | 距玩家 > 10 格的实体简化为图标 |
| 路径长度 > 500 格 | A* 分步计算（前 100 格实时，剩余异步） | 超过 300ms 的计算显示"计算中…" |
| 缩放频繁切换 | 防抖 100ms | 合并连续缩放操作 |
| 地图状态序列化 > 5MB | 仅保存已探索图块的状态（未探索图块不存储） | 配合存档压缩 |

### 6.3 性能预算

| 指标 | 目标 | 测量方式 |
|------|------|---------|
| 初始渲染时间 | < 500ms | 从 loadWorld 到可交互 |
| 移动帧率 | 60fps | requestAnimationFrame |
| 缩放响应 | < 16ms (一帧内) | CSS transform 耗时 |
| 迷雾更新 | < 10ms | Canvas 绘制耗时 |
| 区域切换 | < 300ms（含动画 200ms） | 切换函数执行时间 |
| 内存占用 | < 50MB (含所有区域数据) | Chrome DevTools heap snapshot |

---

## 7. 测试要点

### 7.1 单元测试场景

| 测试 ID | 测试场景 | 前置条件 | 预期结果 |
|---------|---------|---------|---------|
| MAP-UT-01 | 等距坐标 → 屏幕坐标转换 | 图块 (3, 5) | 屏幕坐标计算正确 |
| MAP-UT-02 | A* 寻路 | 起点 (0,0), 终点 (5,5), 中间有障碍 | 返回绕过障碍的最短路径 |
| MAP-UT-03 | 战争迷雾揭示 | 玩家在 (3,3), 视野半径 6 | 以玩家为中心的 6 格半径内 fogState='visible' |
| MAP-UT-04 | 迷雾状态序列化与恢复 | MapState 含部分已探索图块 | 恢复后迷雾状态一致 |
| MAP-UT-05 | 图块事件触发 | 进入含 on_enter 事件的图块 | 事件触发，回调执行 |
| MAP-UT-06 | 不可达图块点击 | 点击墙后面的图块 | A* 返回 null，无移动 |
| MAP-UT-07 | 区域切换 | 玩家到达出口图块 | 新区域加载，玩家出现在入口 |
| MAP-UT-08 | 缩放级别边界 | 设置 zoom=3.0 | clamp 到 2.0 |

### 7.2 集成测试场景

| 测试 ID | 测试场景 | 涉及系统 | 预期结果 |
|---------|---------|---------|---------|
| MAP-INT-01 | 地图 → 对话：事件触发 | 地图 + 对话 | 进入事件图块 → AI GM 自动叙述 |
| MAP-INT-02 | 地图 → 记忆：探索记录 | 地图 + 记忆 | 首次进入区域 → 记忆引擎记录 discovery 事件 |
| MAP-INT-03 | 对话 → 地图：状态更新 | 对话 + 地图 | AI 回应触发传送 → 地图更新玩家位置 |
| MAP-INT-04 | 存档 → 地图：状态恢复 | 存档 + 地图 | 读档后玩家位置、迷雾、实体位置正确 |

### 7.3 边缘测试场景

| 测试 ID | 测试场景 | 预期行为 |
|---------|---------|---------|
| MAP-EDGE-01 | 空地图（0 图块） | 显示"地图数据为空"，不崩溃 |
| MAP-EDGE-02 | 全部图块不可行走 | 玩家在唯一可行走图块上，其余不可达 |
| MAP-EDGE-03 | 移动中点击新目标 | 中断当前移动，重新寻路到新目标 |
| MAP-EDGE-04 | 移动中触发区域切换 | 完成当前格移动后再切换区域 |
| MAP-EDGE-05 | 极端缩放 (0.1x / 10x) | clamp 到 min/max 范围内 |
| MAP-EDGE-06 | 等距坐标 (100000, 100000) | 正常渲染（屏幕坐标可能溢出，需检查） |

---

## 8. 设计理论基础

### 8.1 为什么选择 2.5D 等距

**理论依据：空间叙事学 (Spatial Narratology) + 认知地图理论**

| 维度 | 2D 俯视 | 2.5D 等距 (本方案) | 3D 自由视角 |
|------|--------|-------------------|------------|
| 空间深度感知 | 弱 | 中（有阴影和高程） | 强 |
| 美术成本 | 低 | 中（精灵图/图块） | 高（模型+贴图+光照） |
| 叙事密度 | 中 | **高**（每一格都是舞台） | 中（空间稀释叙事） |
| 桌游隐喻 | 弱 | **强**（完美映射） | 弱 |
| 性能要求 | 低 | 低（CSS/SVG） | 高（WebGL） |
| 开发复杂度 | 低 | 低-中 | 高 |

2.5D 等距是"桌游棋盘"隐喻的最佳实现——它保留空间策略性（Disco Elysium、Into the Breach），同时避免 3D 的美术成本和空间稀释问题。

### 8.2 "地图即叙事"的设计哲学

借鉴 **Jenkins (2004) "Game Design as Narrative Architecture"**：
- 空间关系编码叙事：距离 = 情感距离，不可达区域 = 未解之谜
- 每个图块承担一个功能：每个图块必须有叙事/机制/资源三重功能之一
- 地图不是"背景"，而是"界面"——玩家通过与地图的交互驱动叙事

### 8.3 战争迷雾的信息不对称设计

三层迷雾借鉴 **RTS 战争迷雾** + **TTRPG 的"DM 隐藏信息"**：
- 未探索 = 完全的未知（激发好奇心）
- 已探索不可见 = "我知道那里有什么，但不知道现在发生了什么"（激发回访欲）
- 当前视野 = 完全信息（给予掌控感）

这种递进的信息不对称创造了探索驱动 (Discovery Drive)——玩家想"看看迷雾后面是什么"。

### 8.4 竞品参考

| 竞品 | 借鉴点 | 差异点 |
|------|--------|--------|
| **Disco Elysium** | 等距地图 + 点击移动；每个场景是高密度叙事节点 | 他们的地图是手绘静态场景，我们是模块化图块 |
| **Into the Breach** | 等距网格渲染；简洁的 UI 叠加 | 他们是回合制策略，我们是叙事驱动 |
| **Divinity: Original Sin 2** | 地图探索 + 遭遇触发；区域切换 | 他们是 3D，我们是 2.5D 以降低复杂度 |
| **Fire Emblem (GBA)** | 等距地图精灵图；战争迷雾 | 借鉴迷雾渲染方式 |
| **Octopath Traveler** | HD-2D 光影质感 | 参考光影氛围，但我们使用 CSS 实现 |

### 8.5 设计决策记录

| 决策 ID | 决策 | 理由 | 日期 |
|---------|------|------|------|
| MAP-001 | 三级空间架构 (Region→Tile→Entity) | 清晰的职责分离：Region 管叙事氛围，Tile 管空间逻辑，Entity 管交互 | 2025-07-29 |
| MAP-002 | CSS transform + Canvas 混合渲染 | CSS 处理图块布局和过渡，Canvas 处理粒子和迷雾——各取所长 | 2025-07-29 |
| MAP-003 | 移动仅触发目的地图块事件 | 避免经过路径时的事件轰炸；保持叙事节奏 | 2025-07-29 |
| MAP-004 | 视野半径 6 格（默认） | 与图块尺寸 (128×64px) + 地图面板宽度 (360px) 计算：360/128 ≈ 2.8 格横向，6 格纵向，覆盖地图面板可见范围 | 2025-07-29 |
| MAP-005 | 缩放 > 1.5x 显示标签 | 1.5x 时图块为 192×96px，足够承载文字标签而不过度拥挤 | 2025-07-29 |

### 8.6 理论红线检查

| 红线 | 状态 |
|------|------|
| 杜绝"装饰性地形" | ✅ 每个 Tile 有 events[] 或 narrative description，Region 有 ambientNarrative |
| 空间关系编码叙事 | ✅ 区域入口锁定条件、阻挡物路径选择、NPC 位置编排 |
| 地图随时间演化 | ✅ 存档中持久化 tileStates 和 entityStates，支持"烧毁的村庄"等状态 |

---

> **下一步**: 本文档与记忆引擎 GDD 和对话系统 GDD 进行交叉评审，确保接口对齐。
