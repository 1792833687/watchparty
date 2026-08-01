# ADR-002: 地图渲染方案

> **状态**: Proposed
> **日期**: 2025-07-29
> **作者**: 程基岩 (Cheng Jiyan)
> **决策者**: 游承峰 (You Chengfeng) — 主理人

---

## 上下文 (Context)

AI Narrator Game 的核心视觉差异化是 **2.5D 等距地图**——"会呼吸的桌游棋盘"。地图需要满足以下约束（来源：美术圣经 §7 + 地图 GDD §5.2 + 概念支柱 II）：

### 硬性需求

1. **2:1 等距菱形图块**：128×64px 图块，clip-path 菱形裁剪
2. **五图层系统**：地形(0) → 装饰(1) → 实体(2) → 粒子(3) → UI 叠加(4)
3. **三层战争迷雾**：未探索 (brightness 0.25) / 已探索不可见 (brightness 0.6) / 当前视野 (完整)
4. **缩放系统**：0.5x–2x，>1.5x 显示图块标签
5. **路径线**：已走(solid) / 可到达(dashed golden) / 未知(dotted)
6. **主题变体**：森林/洞穴/城镇/水域 四套色板
7. **性能目标**：图块交互 60fps，粒子 30fps，迷雾更新 <10ms

### 渲染方案选项

#### 方案 A: 纯 CSS Transform（等距变形 + DOM 图块）

```
每个图块 = 一个 <div> 元素
等距: transform: rotateX(60deg) rotateZ(45deg)
菱形: clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)
战争迷雾: CSS filter: brightness()
粒子: CSS animation @keyframes
路径: SVG <line> 叠加
缩放: CSS transform: scale()
```

#### 方案 B: Canvas 2D（全 JS 绘制）

```
单个 <canvas> 元素
等距: 手动计算 isometric → screen 坐标
菱形: canvas clip path
战争迷雾: globalAlpha + fillRect
粒子: requestAnimationFrame + canvas draw
路径: canvas lineTo
缩放: ctx.scale()
```

#### 方案 C: WebGL（PixiJS / Three.js）

```
WebGL 渲染器
等距: 正交投影矩阵
菱形: 精灵图 + matrix transform
战争迷雾: shader (mask texture)
粒子: GPU 粒子系统
路径: Graphics.lineTo
缩放: stage.scale
```

#### 方案 D: CSS + Canvas 混合（分层渲染）

```
Layer 0-2 (地形/装饰/实体): CSS DOM（交互友好，CSS transition 动画）
Layer 3 (粒子): Canvas 2D overlay（高性能粒子，30fps）
Layer 4 (UI 叠加): CSS/SVG（DOM 事件，无障碍）
Layer 5 (战争迷雾): Canvas 2D overlay（实时更新，羽化边缘）
```

#### 方案 E: 预渲染精灵图（纯图片方案）

```
每个图块状态 = 一张预渲染 PNG 精灵图
所有组合: 地形×主题×迷雾状态 = 大量精灵图变体
动态部分: 路径线用 SVG 叠加
```

---

## 评估维度

### 1. 性能（帧率 + 内存）

| 指标 | CSS (A) | Canvas (B) | WebGL (C) | 混合 (D) | 精灵图 (E) |
|------|---------|-----------|-----------|---------|-----------|
| 图块渲染 60fps | ✅ CSS 硬件加速 | ⚠️ JS 绑定绘制 | ✅ GPU 原生 | ✅ CSS 硬件加速 | ✅ 贴图 |
| 大量图块 (1000+) | ⚠️ DOM 节点开销 | ✅ 像素级批处理 | ✅ 最优 | ⚠️ DOM 节点 + Canvas | ✅ 无不透明 |
| 粒子性能 | ❌ CSS animation 开销大 | ✅ 60fps 粒子 | ✅ 最优 (GPU) | ✅ 30fps Canvas | N/A (静态) |
| 战争迷雾更新 | ⚠️ filter 重绘 | ✅ <10ms fillRect | ✅ shader | ✅ <10ms | ❌ 需多套精灵图 |
| 内存占用 | 中 (DOM 节点 + CSSOM) | 低 (像素缓冲) | 低 (纹理) | 中 | 中 (图片解码) |
| 缩放性能 | ✅ CSS transform (GPU) | ⚠️ ctx.scale 重绘 | ✅ 矩阵变换 | ✅ CSS transform | ⚠️ 需多分辨率 |

### 2. 实现复杂度

| 维度 | CSS | Canvas | WebGL | 混合 | 精灵图 |
|------|-----|--------|-------|------|--------|
| 等距坐标转换 | 中 (CSS 3D transform) | 低 (手算) | 中 (矩阵) | 低 | 低 |
| 鼠标交互（点击/悬停） | ✅ DOM 事件原生 | ❌ 需手动 hit-test | �� 需手动 hit-test | ✅ DOM 事件 | ✅ DOM + image map |
| hover 效果 | ✅ CSS :hover 零代码 | ❌ 手动实现 | ❌ 手动实现 | ✅ CSS :hover | ❌ 需多套精灵图 |
| 图块选中态光晕 | ✅ box-shadow + transition | ⚠️ 手动绘制 | ⚠️ 手动绘制 | ✅ box-shadow | ❌ 需多套精灵图 |
| 路径线 | ✅ SVG <line> 叠加 | ⚠️ 手动 lineTo | ⚠️ 手动 lineTo | ✅ SVG 叠加 | ✅ SVG 叠加 |
| 标签显示 (>1.5x) | ✅ CSS + HTML | ⚠️ fillText | ⚠️ fillText | ✅ CSS + HTML | ⚠️ fillText |
| 战争迷雾羽化 | ⚠️ mask-image 复杂 | ✅ radialGradient | ✅ shader | ✅ radialGradient | ❌ 不支持 |
| 主题切换 | ✅ CSS 变量 | ⚠️ 重绘所有 | ⚠️ 重新绑定纹理 | ✅ CSS 变量 | ❌ 需多套精灵图 |
| 无障碍 (ARIA) | ✅ DOM 属性 | ❌ 需手动映射 | ❌ 需手动映射 | ✅ DOM 属性 | ✅ DOM 属性 |
| 代码量估算 | ~500 行 | ~800 行 | ~1500 行 | ~700 行 | ~600 行 + 资产管线 |

### 3. 与美术圣经的对齐

| 美术需求 (§7) | CSS | Canvas | WebGL | 混合 | 精灵图 |
|--------------|-----|--------|-------|------|--------|
| 图块 128×64px 菱形 | ✅ clip-path | ✅ 手绘 | ✅ 矩阵 | ✅ clip-path | ✅ 预渲染 |
| 选中态金色光晕 | ✅ box-shadow | ⚠️ | ⚠️ | ✅ box-shadow | ❌ |
| 可到达态脉冲动画 | ✅ @keyframes | ⚠️ | ⚠️ | ✅ @keyframes | ❌ |
| 移动路径预览 300ms | ✅ CSS transition | ⚠️ | ⚠️ | ✅ CSS transition | ⚠️ |
| 环境粒子 (飘落树叶等) | ❌ 性能差 | ✅ | ✅ | ✅ Canvas 30fps | ❌ |
| 减少动效支持 | ✅ media query | ⚠️ | ⚠️ | ✅ media query | ✅ 换静态精灵图 |
| 暗/亮主题切换 | ✅ CSS 变量 | ⚠️ 重绘 | ⚠️ | ✅ CSS 变量 | ❌ |

### 4. 可访问性

| 需求 (美术 §9) | CSS | Canvas | WebGL | 混合 |
|---------------|-----|--------|-------|------|
| 屏幕阅读器 (aria-label) | ✅ | ❌ | ❌ | ✅ (DOM 层) |
| 键盘导航 (方向键选图块) | ✅ | ⚠️ 需自建 | ⚠️ 需自建 | ✅ |
| 焦点指示器 | ✅ | ❌ | ❌ | ✅ |
| 高对比度模式 | ✅ | ⚠️ 重绘 | ⚠️ | ✅ |

### 5. 依赖与 Bundle 大小

| 方案 | 额外依赖 | 新增 Bundle |
|------|---------|------------|
| CSS | 无 | 0 KB |
| Canvas | 无 | 0 KB (浏览器原生) |
| WebGL (PixiJS) | pixi.js ~450KB gzip | +450KB |
| WebGL (Three.js) | three.js ~140KB gzip (min) | +140KB |
| 混合 (CSS+Canvas) | 无 | 0 KB |
| 精灵图 | 资产管线 (构建脚本) | 0 KB (代码) + 精灵图资产 |

**关键点**：PixiJS ~450KB 几乎等于整个首屏预算 (500KB)，引入它将淘汰所有其他资产。

---

## 决定 (Decision)

**选择方案 D（CSS + Canvas 混合渲染）**。

### 分层职责

```
┌──────────────────────────────────────────────┐
│ Layer 5: 战争迷雾 (Canvas 2D)                 │
│   - 实时更新的径向渐变羽化遮罩                 │
│   - globalCompositeOperation: 'source-over'   │
│   - 更新 < 10ms，30fps（玩家移动时）          │
├──────────────────────────────────────────────┤
│ Layer 4: UI 叠加层 (CSS + SVG)               │
│   - 路径线 (SVG <line>)                       │
│   - 选中框 (CSS box-shadow)                   │
│   - 图块标签 (CSS text, >1.5x)               │
│   - 缩放控件                                  │
├──────────────────────────────────────────────┤
│ Layer 3: 粒子层 (Canvas 2D)                   │
│   - 环境粒子（飘落树叶、荧光孢子、炊烟等）     │
│   - 30fps requestAnimationFrame               │
│   - 可暂停（地图不可见时停止）                 │
├──────────────────────────────────────────────┤
│ Layer 2: 实体层 (CSS DOM)                     │
│   - NPC、怪物、物品图标                        │
│   - 浮动/呼吸动画 (@keyframes)                │
│   - 点击交互 (onClick → dialogue/action)      │
│   - 缩放 < 0.75x 时 display:none              │
├──────────────────────────────────────────────┤
│ Layer 1: 装饰层 (CSS DOM)                     │
│   - 树木、岩石、建筑轮廓                       │
│   - box-shadow 阴影                            │
│   - 静态或微动画 (CSS)                         │
├──────────────────────────────────────────────┤
│ Layer 0: 地形层 (CSS DOM)                     │
│   - 草地/石地/水面/沙地 基础色板               │
│   - CSS 变量控制主题切换                       │
│   - clip-path: polygon(50% 0%,...) 菱形裁剪   │
└──────────────────────────────────────────────┘
```

### 等距渲染的 CSS 实现

```css
/* 使用 2D 坐标计算 + clip-path，而非 3D transform */
/* 原因: 3D transform 在部分浏览器上有字体/边框渲染问题 */

.tile {
  width: var(--tile-width, 128px);
  height: var(--tile-height, 64px);
  position: absolute;
  
  /* 等距坐标 → 屏幕坐标 (2D 投影，无需 3D transform) */
  /* left = (col - row) * (width / 2) + offsetX */
  /* top  = (col + row) * (height / 2) + offsetY */
  
  /* 菱形裁剪 */
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  
  /* 交互 */
  cursor: pointer;
  transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
  
  /* 性能：创建独立合成层 */
  will-change: transform, box-shadow;
}

.tile:hover {
  transform: scale(1.05);
  z-index: 10;
}
```

### 为什么不用 3D CSS transform

尽管 `rotateX(60deg) rotateZ(45deg)` 可以实现等距效果，但存在以下问题：

1. **文字渲染**：3D transform 导致文字模糊或反锯齿异常（跨浏览器不一致）
2. **边框问题**：1px 边框在 3D 变换中可能出现亚像素渲染问题
3. **交互坐标**：`getBoundingClientRect()` 返回 3D 变换后的投影矩形，需要逆变换计算点击位置
4. **子元素堆叠**：`transform-style: preserve-3d` 的子元素 z-index 行为复杂

2D 坐标投影（`left = (col-row)*w/2`, `top = (col+row)*h/2`）+ `clip-path` 完全避免了上述问题，实现简单且可预测。

### 为什么不用 PixiJS/Phaser

1. **Bundle 大小**：PixiJS ~450KB gzip ≈ 首屏预算的 90%，淘汰了所有其他资产
2. **过度工程**：我们不需要 WebGL 的 10,000 粒子批处理——典型的等距地图视口内约 30-80 个图块，DOM 完全胜任
3. **无障碍退化**：WebGL Canvas 对屏幕阅读器不可见，需要手动实现完整的 ARIA 映射层
4. **React 集成**：DOM 方案天然与 React 组件树集成（state → props → render），Canvas/WebGL 需要手动同步状态
5. **调试困难**：Canvas/WebGL 无法使用 React DevTools 和浏览器元素检查器

### 混合方案的关键设计决策

1. **视口裁剪**：仅渲染视口内的图块 DOM 节点（`IntersectionObserver` + 虚拟化），确保 DOM 节点数 < 200
2. **Canvas 覆盖层**：粒子 Canvas 和迷雾 Canvas 叠加在地图层上方，`pointer-events: none` 透传鼠标事件
3. **缩放用 CSS transform**：`transform: scale(N)` 在地图容器上，利用 GPU 合成，避免逐图块重绘
4. **性能降级路径**：低端设备检测 → 减少粒子 → 隐藏装饰层 → 纯色块模式
5. **Canvas 帧率控制**：粒子层 `setTimeout` 控制 30fps，迷雾仅在玩家移动时重绘

---

## 后果 (Consequences)

### 正面后果

✅ **零额外依赖**：不引入游戏引擎（PixiJS/Phaser），保持 bundle 精简
✅ **React 天然集成**：图块是 React 组件，状态变更自动反映到 DOM
✅ **无障碍优先**：DOM 图块天然支持屏幕阅读器和键盘导航
✅ **CSS 动画免费**：hover、选中态、移动过渡等由浏览器 GPU 合成，无需 JS
✅ **主题切换零成本**：CSS 变量切换，毫秒级
✅ **调试友好**：React DevTools + Chrome DevTools 完全可用
✅ **低端设备降级**：明确的性能降级路径

### 负面后果

⚠️ **DOM 节点限制**：视口内图块数必须控制在 200 以内
  - **缓解**: 虚拟化（仅渲染视口内图块）；缩放 < 0.75x 时隐藏实体层；10000 图块的区域只有约 50-150 个在视口内

⚠️ **粒子系统性能**：Canvas 30fps 在极端低端设备上可能仍需降低
  - **缓解**: `navigator.hardwareConcurrency` 检测 → 自动降低粒子密度

⚠️ **等距坐标计算**：开发团队需要理解 2D → isometric 投影数学
  - **缓解**: `CoordinateUtils` 工具模块提供 `screenToIso()` / `isoToScreen()` 等函数

⚠️ **Canvas 文字渲染 vs DOM 文字**：Canvas 中的图块标签在缩放时需要重绘
  - **缓解**: 图块标签使用 CSS DOM 层（Layer 4），不用 Canvas 文字

### 与备选方案的对比

| 方案 | 采纳? | 理由 |
|------|-------|------|
| A: 纯 CSS | 部分采纳 | 地形/装饰/实体层使用 CSS DOM；粒子和迷雾 CSS 性能不足，不采纳 |
| B: 纯 Canvas | 不采纳 | 交互和无障碍退化严重，React 集成复杂 |
| C: WebGL | 不采纳 | Bundle 过大（+450KB），过���工程，无障碍退化 |
| D: 混合 | **采纳** | 各取所长——CSS 负责交互和无障碍，Canvas 负责性能和特效 |
| E: 精灵图 | 不采纳 | 无法支持动态主题切换和战争迷雾羽化，资产管线复杂 |

---

## 参考资料

- 美术圣经 §7 (2.5D 地图视觉规范) — 图块尺寸/图层/主题色板/迷雾/缩放
- 地图 GDD §5.2 (等距渲染实现 CSS 代码) — CSS clip-path + transform 方案
- 地图 GDD §6.3 (性能预算) — 帧率目标 60fps/30fps，内存 <50MB
- 地图 GDD §8.2 (为什么 2.5D 等距) — 桌游隐喻、空间叙事学理论
- "CSS Triggers" — https://csstriggers.com/ (哪些 CSS 属性触发 layout/paint/composite)
- PixiJS Bundle Size — https://bundlephobia.com/package/pixi.js
