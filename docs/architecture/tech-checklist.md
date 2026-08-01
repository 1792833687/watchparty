# 技术控制清单 (Technical Control Manifest)

> **版本**: 1.0.0
> **作者**: 程基岩 (Cheng Jiyan)
> **日期**: 2025-07-29
> **用途**: 程序员可立即执行的一页规则 + 完整技术检查清单

---

## 快速参考：程序员一页规则

```
1. Layer 方向: lib/ → infrastructure/ → systems/ → stores/ → components/ → app/
2. 组件不直接调 systems/（必须通过 Store）
3. 每个 Store 维护自己的状态切片，通过 selector 防止全局重渲染
4. API Key 仅在 localStorage + 浏览器内存，永不硬编码
5. CSP: script-src 'self'（禁止 inline script 和 unsafe-eval）
6. Token 估算用 字符数/4（中文字符 ×1.8），预算表见 ADR-003
7. 等距坐标: screenX = (col - row) * 64, screenY = (col + row) * 32
8. 地图视口内 DOM 节点 < 200（虚拟化）
9. Canvas 层 pointer-events: none（事件透传到 DOM 图块）
10. 存储不可用时自动降级: IndexedDB → localStorage → Memory
```

---

## 1. 依赖清单

### 1.1 核心依赖 (Production)

| Package | 版本建议 | 用途 | 大小 (gzip) | 必要性 |
|---------|---------|------|------------|--------|
| `next` | ^15.0 | 框架 (App Router) | ~80KB | Must |
| `react` | ^19.0 | UI 组件 | ~5KB | Must |
| `react-dom` | ^19.0 | DOM 渲染 | ~40KB | Must |
| `zustand` | ^5.0 | 状态管理 | ~1KB | Must |
| `react-markdown` | ^9.0 | AI 叙述文本 Markdown 渲染 | ~20KB | Must |
| `@tanstack/react-virtual` | ^3.0 | 对话历史虚拟滚动 | ~5KB | Should |
| `uuid` | ^10.0 | UUID v4 生成 (实体/事件/关系 ID) | ~3KB | Must |
| `idb` | ^8.0 | IndexedDB Promise 封装 | ~2KB | Must |
| `immer` | ^10.0 | 不可变状态更新（Zustand 集成） | ~6KB | Should |

### 1.2 开发依赖 (Dev)

| Package | 版本建议 | 用途 | 必要性 |
|---------|---------|------|--------|
| `typescript` | ^5.6 | 类型检查 | Must |
| `@types/react` | ^19.0 | React 类型 | Must |
| `eslint` | ^9.0 | 代码规范 | Must |
| `eslint-config-next` | ^15.0 | Next.js 规则 | Must |
| `prettier` | ^3.3 | 代码格式化 | Should |
| `vitest` | ^2.0 | 单元/集成测试 | Must |
| `@testing-library/react` | ^16.0 | React 组件测试 | Must |
| `@playwright/test` | ^1.45 | E2E 测试 | Should |
| `tailwindcss` | ^3.4 | Utility-first CSS | Must |
| `postcss` | ^8.4 | CSS 处理 | Must (Tailwind 依赖) |
| `autoprefixer` | ^10.4 | CSS 浏览器前缀 | Must |

### 1.3 明确不引入的依赖

| Package | 理由 |
|---------|------|
| `pixi.js` / `phaser` | Bundle +450KB，过度工程（见 ADR-002） |
| `redux` / `@reduxjs/toolkit` | Bundle +11KB，Zustand 足够（见 overview §2.2） |
| `tiktoken` | WASM ~1MB，字符数/4 估算法足够（见 ADR-003） |
| `three.js` | 3D 渲染不需要（概念 W02） |
| `d3.js` | 关系图谱用 React Flow（Should Have），MVP 不需要 |
| `i18next` / `react-intl` | 多语言是 Could Have（概念 C07） |
| `mongoose` / `prisma` | 无服务器，无数据库 |
| `express` / `fastify` | 无后端（ADR-001） |

### 1.4 总 Bundle 预算

| 类别 | 预算 (gzip) | 实际 (est.) | 余额 |
|------|------------|------------|------|
| 框架 (next+react+react-dom) | ~130KB | ~125KB | +5KB |
| 状态管理 (zustand) | ~5KB | ~1KB | +4KB |
| 工具库 (uuid+idb+immer) | ~15KB | ~11KB | +4KB |
| UI 辅助 (react-markdown+virtual) | ~30KB | ~25KB | +5KB |
| Tailwind CSS (清除后) | ~15KB | ~10KB | +5KB |
| 应用代码 (gzip) | ~200KB | TBD | — |
| 精灵图 + 字体 + 图标 | ~105KB | TBD | — |
| **总计** | **~500KB** | **~172KB + 应用代码** | **~328KB 给应用代码** |

---

## 2. 浏览器兼容性目标

### 2.1 支持矩阵

| 浏览器 | 最低版本 | 理由 |
|--------|---------|------|
| Chrome | 100+ (2022.3) | `clip-path` 稳定, CSS `has()`, `Container Queries` |
| Firefox | 100+ (2022.5) | 同上 |
| Edge | 100+ (2022.4) | 基于 Chromium |
| Safari | 16+ (2022.9) | `clip-path` 良好支持, `backdrop-filter` |
| Opera | 85+ | 基于 Chromium |

### 2.2 必需的 Web API

| API | 用途 | 兼容性 |
|-----|------|--------|
| `fetch` + `ReadableStream` | OpenRouter SSE 流式 | 所有目标浏览器 ✅ |
| `AbortController` | 取消 LLM 请求 | 所有目标浏览器 ✅ |
| `IndexedDB` | 长期记忆 + 存档 | 所有目标浏览器 ✅ |
| `localStorage` | 短期记忆 + 用户偏好 | 所有目标浏览器 ✅ |
| `CSS clip-path` | 菱形图块 | 所有目标浏览器 ✅ |
| `CSS backdrop-filter` | 毛玻璃面板 | Safari 需 `-webkit-` 前缀 |
| `CSS Custom Properties` | 主题切换 | 所有目标浏览器 ✅ |
| `Canvas 2D` | 粒子/迷雾层 | 所有目标浏览器 ✅ |
| `IntersectionObserver` | 图块虚拟化 | 所有目标浏览器 ✅ |
| `ResizeObserver` | 响应式布局 | 所有目标浏览器 ✅ |
| `navigator.storage.estimate()` | 配额监控 | Chrome/Edge/Firefox/Opera ✅, Safari 16+ ⚠️ |
| `prefers-reduced-motion` | 动效减少 | 所有目标浏览器 ✅ |
| `prefers-color-scheme` | 自动暗色模式 | 所有目标浏览器 ✅ |

### 2.3 特性检测与 Polyfill 策略

```typescript
// lib/utils/feature-detection.ts

export function detectFeatures(): FeatureReport {
  return {
    indexedDB: 'indexedDB' in window,
    localStorage: isLocalStorageAvailable(),
    readablestream: 'ReadableStream' in window,
    backdropFilter: CSS.supports('backdrop-filter', 'blur(1px)'),
    storageEstimate: 'storage' in navigator && 'estimate' in navigator.storage,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}

// 降级策略:
// IndexedDB 不可用 → localStorage
// localStorage 不可用 → 内存模式
// backdrop-filter 不支持 → 纯色背景（增加不透明度补偿）
```

---

## 3. 安全审计点

### 3.1 API Key 处理

| 检查项 | 状态 | 实现 |
|--------|------|------|
| Key 不硬编码在源码中 | ✅ | 用户输入 → localStorage |
| Key 不在客户端 JS bundle 中 | ✅ | 运行时动态读取 |
| Key 不发送到第三方服务器 | ✅ | 浏览器直连 OpenRouter（ADR-001） |
| Key 不记录到日志 | ✅ | Console/Persist 中间件过滤 `apiKey` 字段 |
| Key 不在 URL 中传递 | ✅ | 仅通过 fetch Authorization header |
| Key 输入框 type="password" | 待实现 | 设置页面 |
| Key 验证（格式检查） | 待实现 | `sk-or-` 或 `org-` 前缀检查 |
| Key 可清除（退出时） | 待实现 | 设置页面 "忘记 Key" 按钮 |

### 3.2 XSS 防护

| 检查项 | 状态 | 实现 |
|--------|------|------|
| CSP Header | 待实现 | `Content-Security-Policy: script-src 'self'; object-src 'none'; base-uri 'self'` |
| React 默认 XSS 防护 | ✅ | JSX 自动转义 `{}` |
| AI 回应的 Markdown 安全渲染 | 待实现 | `react-markdown` + `rehype-sanitize` (或在渲染前 sanitize) |
| 用户输入不做 HTML 解析 | ✅ | 纯文本输入框 |
| `dangerouslySetInnerHTML` 禁用 | ✅ | ESLint rule: `react/no-danger` |
| URL 白名单（OpenRouter 域名） | 待实现 | Fetch 拦截器检查目标域 |
| innerHTML / document.write 禁用 | ✅ | ESLint rule: `no-unsanitized/property` |

### 3.3 CSP 配置

```typescript
// next.config.ts 或 middleware.ts

const cspHeader = `
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';    /* Tailwind 需要 unsafe-inline */
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self' https://openrouter.ai https://api.openrouter.ai;
  media-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
`.replace(/\s+/g, ' ').trim();
```

### 3.4 敏感数据保护

| 检查项 | 状态 | 实现 |
|--------|------|------|
| localStorage 中不存储明文密码 | ✅ | 无密码系统 |
| IndexedDB 存档文件校验 (checksum) | 待实现 | SHA-256 checksum |
| 存档版本号校验 | 待实现 | 不兼容版本的存档拒绝加载 |
| Electron 中 API Key 加密存储 | 后续 | electron-store + safeStorage |
| 生产构建不包含 source map | 待实现 | next.config.ts: `productionBrowserSourceMaps: false` |

### 3.5 内容安全

| 检查项 | 状态 | 实现 |
|--------|------|------|
| AI 输出过滤（极端暴力/色情） | 待实现 | 前端过滤 + System Prompt 引导 |
| 用户输入长度限制 | 待实现 | textarea maxLength=1000 |
| 游戏设定文件格式验证 | 待实现 | JSON Schema 验证 |
| 导入文件大小限制 | 待实现 | 10MB 上限 |

---

## 4. 构建与部署方案

### 4.1 构建配置 (next.config.ts)

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 纯前端模式
  output: process.env.EXPORT === '1' ? 'export' : undefined,
  
  // 性能
  compress: true,                        // gzip 压缩
  productionBrowserSourceMaps: false,    // 生产不暴露源码
  
  // 安全 Headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  
  // 图片优化（静态导出时关闭）
  images: {
    unoptimized: process.env.EXPORT === '1',
  },
  
  // Webpack 优化
  webpack(config) {
    // 禁止导入 Node.js 服务端模块
    config.resolve.fallback = {
      fs: false,
      path: false,
      crypto: false,  // 使用 Web Crypto API 替代
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
```

### 4.2 环境变量策略

```
# .env.local (开发用)
NEXT_PUBLIC_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
# 注意: API Key 不通过环境变量传递（用户输入）
```

**原则**：所有 `NEXT_PUBLIC_` 变量会**嵌入客户端 bundle**，绝不用于敏感信息。API Key 仅通过用户的浏览器输入获取。

### 4.3 部署方案

#### 方案 A: Vercel (推荐)

```bash
# 部署命令
vercel --prod

# 优势: 零配置, Next.js 原生支持, 自动 HTTPS, CDN
# 限制: 商业计划带宽有限, 国内访问可能慢
```

#### 方案 B: EdgeOne Pages (国内优化)

```bash
# 部署命令
npm run build
npx edgeone-pages deploy

# 优势: 国内 CDN 加速, 免费额度
```

#### 方案 C: 静态导出 + 任意静态托管

```bash
# 构建
EXPORT=1 npm run build

# 产出: out/ 目录
# 可部署到: GitHub Pages, Netlify, CloudFlare Pages, 任意 Nginx
```

### 4.4 测试策略

| 级别 | 工具 | 覆盖目标 | 运行时机 |
|------|------|---------|---------|
| **单元测试** | Vitest | 记忆引擎 80%+, 对话系统 70%+, 地图系统 70%+ | 每次 commit |
| **集成测试** | Vitest | 记忆↔对话, 地图↔对话, 存档↔所有系统 | 每次 PR |
| **组件测试** | @testing-library/react | 关键交互组件 (DialoguePanel, MapPanel, DecisionModal) | 每次 PR |
| **E2E** | Playwright | 完整游戏流程 (创建→探索→对话→存档→恢复) | 每次 Release |
| **性能测试** | Lighthouse CI | 首屏 <500KB, FCP <1.5s, TTI <3s | 每次 PR |
| **无障碍测试** | axe-core | WCAG 2.1 AA | 每次 PR |

### 4.5 测试文件路径约定

```
tests/
├── unit/
│   ├── systems/
│   │   ├── memory/
│   │   │   ├── MemoryEngine.test.ts        # MEM-UT-01 ~ MEM-UT-08
│   │   │   ├── GraphBuilder.test.ts
│   │   │   └── Compressor.test.ts
│   │   ├── dialogue/
│   │   │   ├── DialogueSystem.test.ts      # DLG-UT-01 ~ DLG-UT-08
│   │   │   ├── PromptAssembler.test.ts
│   │   │   └── ResponseParser.test.ts
│   │   └── map/
│   │       ├── MapSystem.test.ts           # MAP-UT-01 ~ MAP-UT-08
│   │       ├── Pathfinder.test.ts
│   │       └── CoordinateUtils.test.ts
│   └── infrastructure/
│       ├── storage/
│       │   └── storage-router.test.ts
│       └── save/
│           └── SaveSerializer.test.ts
├── integration/
│   ├── memory-dialogue.test.ts             # MEM-INT-01, DLG-INT-01
│   ├── map-dialogue.test.ts                # MAP-INT-01, DLG-INT-02
│   └── save-load-cycle.test.ts
└── e2e/
    ├── game-creation.spec.ts
    ├── exploration-loop.spec.ts
    └── session-persistence.spec.ts
```

---

## 5. 性能监控清单

### 5.1 构建时检查

| 指标 | 工具 | 阈值 | 阻塞构建? |
|------|------|------|----------|
| Bundle 大小 | `@next/bundle-analyzer` | 首屏 JS < 150KB gzip | ⚠️ Warning |
| 重复依赖 | `npm dedupe` / `depcheck` | 0 重复 | ✅ Error |
| Tree-shaking | Webpack stats | 未使用导出 < 5% | ⚠️ Warning |
| 图片/字体大小 | 手动检查 | 精灵图 < 200KB, 字体 < 100KB | ⚠️ Warning |

### 5.2 运行时检查

| 指标 | 测量方式 | 目标 | 动作 |
|------|---------|------|------|
| FCP | `performance.getEntriesByType('paint')` | < 1.5s | 优化关键路径 |
| 对话首 Token | `Date.now()` delta | < 500ms | 检查网络 + prompt 大小 |
| 地图帧率 | `requestAnimationFrame` 计数器 | 60fps (图块) / 30fps (粒子) | 降级渲染 |
| 记忆检索 | `performance.now()` delta | < 100ms | 压缩旧数据 |
| 缩放延迟 | `performance.now()` delta | < 16ms | 无动作 (CSS 硬件加速) |
| 内存 | `performance.memory?.usedJSHeapSize` | < 50MB | 释放缓存 |
| IndexedDB 配额 | `navigator.storage.estimate()` | < 80% | 提示用户清理 |

### 5.3 遥测事件（可选，用户同意后启用）

```typescript
// infrastructure/analytics/telemetry.ts — 事件定义

interface TelemetryEvent {
  'game:session_start': { saveSlotId: string; modelId: string };
  'game:session_end': { durationMs: number; messageCount: number };
  'dialogue:llm_call': { modelId: string; latencyMs: number; promptTokens: number; completionTokens: number };
  'dialogue:token_budget_overflow': { estimatedTokens: number; maxTokens: number };
  'map:region_switch': { from: string; to: string; durationMs: number };
  'map:render_degraded': { reason: string; currentFps: number };
  'memory:compression_triggered': { beforeCount: number; afterCount: number };
  'storage:quota_warning': { usagePercent: number };
  'error:api_unreachable': { modelId: string; errorType: string };
  'error:storage_unavailable': { backend: string };
}
```

---

## 6. 代码规范要点

### 6.1 TypeScript 严格模式

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": false  // React props 兼容
  }
}
```

### 6.2 路径作用域编码标准

| 作用域 | 规则 | 示例 |
|--------|------|------|
| `systems/` (核心系统) | 纯逻辑，零 React 依赖，零热路径分配 | `Map<string, T>` 而非 `Record`，预分配数组 |
| `stores/` (状态管理) | 仅序列化状态 + actions，不含业务逻辑 | Action 委托给 `systems/` |
| `components/` (UI) | 展示组件，不持有游戏状态 | 通过 Store 的 selector 读取 |
| `infrastructure/` (基础设施) | 适配器模式，可替换实现 | `IPlatformAdapter`, `IStorageBackend` |
| `lib/` (工具) | 纯函数，零副作用，100% 可测试 | 输入 → 输出，无 I/O |

### 6.3 命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| 组件 | PascalCase | `MapPanel`, `AIAvatar` |
| 系统类 | PascalCase | `MemoryEngine`, `DialogueSystem` |
| Store | `use[Name]Store` | `useDialogueStore` |
| 接口 | `I[Name]` | `IMemoryEngine`, `IPlatformAdapter` |
| 类型 | PascalCase | `DialogueMessage`, `TileCoord` |
| 事件处理函数 | `handle[Event]` | `handleTileClick`, `handleSendMessage` |
| 常量 | UPPER_SNAKE_CASE | `MAX_SESSION_TOKENS`, `DEFAULT_VIEW_RADIUS` |
| 文件 | kebab-case 或 与主导出同名 | `memory-engine.ts` 或 `MemoryEngine.ts` |

---

## 7. 版本控制工作流

### 7.1 分支策略

```
main            — 生产就绪
  └── develop   — 集成测试
       ├── feat/memory-engine
       ├── feat/dialogue-system
       ├── feat/map-system
       ├── feat/ui-components
       └── fix/*
```

### 7.2 Commit 约定

```
feat: 新功能
fix: 错误修复
docs: 文档
refactor: 重构
test: 测试
perf: 性能优化
chore: 构建/工具

示例:
feat(memory): implement EntityExtractor with rule engine
fix(dialogue): handle SSE connection interrupt gracefully
docs(architecture): add ADR-001 for frontend vs backend decision
```

### 7.3 AI 生成代码的标记

```typescript
// 用于 AI 助手（Claude/CodeBuddy）生成的代码段
/**
 * @ai-generated
 * @prompt: "实现 A* 寻路算法"
 * @date: 2025-07-29
 * @model: claude-3.5-sonnet
 */
```

---

## 附录 A: 待确认项（给主理人）

| # | 确认项 | 建议 | 影响 |
|---|--------|------|------|
| 1 | CSS 方案: Tailwind CSS 还是 CSS Modules？ | ✅ **Tailwind CSS** — 已审批 | 构建配置 |
| 2 | 测试覆盖率目标: 80% 系统代码，多少组件？ | ✅ **系统 80%+ / 关键组件 50%+** — 已审批 | CI 门禁 |
| 3 | E2E 框架: Playwright 还是 Cypress？ | ✅ **Playwright** — 已审批 | 测试策略 |
| 4 | 图标方案: Heroicons / Lucide / 自定义 SVG？ | ✅ **Lucide** — 已审批 | Bundle 大小 |
| 5 | Landing 页 SEO 优先级: SSR/SSG 还是纯 CSR？ | ✅ **SSG 静态生成** — 已审批 | 构建策略 |
| 6 | 遥测/分析: 是否需要？需要用户同意吗？ | ✅ **可选，默认关闭** — 已审批 | 隐私合规 |

---

> **下一步**: 主理人审批技术控制清单，确认上述 6 项待确认项。审批通过后进入 Story 分解阶段。
