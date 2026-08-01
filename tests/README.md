# 测试规范 — AI Narrator Game

> **版本**: 1.0.0
> **作者**: 程基岩 (Cheng Jiyan) — 游戏技术与引擎工程师
> **日期**: 2025-07-30
> **参考**: `docs/architecture/tech-checklist.md` §4.4-4.5

---

## 目录

1. [测试策略概述](#1-测试策略概述)
2. [目录结构](#2-目录结构)
3. [如何运行](#3-如何运行)
4. [命名约定](#4-命名约定)
5. [编写测试](#5-编写测试)
6. [覆盖率目标](#6-覆盖率目标)
7. [Mock 策略](#7-mock-策略)
8. [首个冲刺最小测试集](#8-首个冲刺最小测试集)
9. [CI 集成](#9-ci-集成)

---

## 1. 测试策略概述

| 级别 | 工具 | 覆盖目标 | 运行时机 |
|------|------|---------|---------|
| **单元测试** | Vitest | 核心系统 80%+, 组件 50%+, lib 90%+ | 每次 commit |
| **集成测试** | Vitest | 系统间接口 100% 覆盖 | 每次 PR |
| **组件测试** | @testing-library/react | 关键交互组件 | 每次 PR |
| **E2E** | Playwright | 完整游戏流程 | 每次 Release |
| **性能测试** | Lighthouse CI | 首屏 <500KB, FCP <1.5s | 每次 PR |
| **无障碍测试** | axe-core | WCAG 2.1 AA | 每次 PR |

### 测试金字塔

```
           ╱──────╲
          ╱  E2E   ╲         ← 3-5 个关键流程
         ╱ Playwright╲
        ╱──────────────╲
       ╱   集成测试      ╲      ← 系统间接口
      ╱   memory↔dialogue ╲
     ╱──────────────────────╲
    ╱      组件测试           ╲   ← 关键交互组件
   ╱   @testing-library/react  ╲
  ╱──────────────────────────────╲
 ╱          单元测试                ╲ ← 核心系统 80%+
╱        Vitest (主力)               ╲
──────────────────────────────────────
```

---

## 2. 目录结构

```
tests/
├── README.md                          # 本文件
├── setup.ts                           # 全局配置 + mock + 测试夹具
├── unit/
│   ├── systems/
│   │   ├── memory/
│   │   │   ├── MemoryEngine.test.ts        # MEM-UT-01 ~ MEM-UT-08
│   │   │   ├── EntityExtractor.test.ts
│   │   │   ├── GraphBuilder.test.ts
│   │   │   ├── ContextRetriever.test.ts
│   │   │   └── Compressor.test.ts
│   │   ├── dialogue/
│   │   │   ├── DialogueSystem.test.ts      # DLG-UT-01 ~ DLG-UT-08
│   │   │   ├── PromptAssembler.test.ts
│   │   │   ├── ResponseParser.test.ts
│   │   │   └── FakeChoiceDetector.test.ts
│   │   └── map/
│   │       ├── MapSystem.test.ts           # MAP-UT-01 ~ MAP-UT-08
│   │       ├── Pathfinder.test.ts
│   │       ├── FogManager.test.ts
│   │       └── CoordinateUtils.test.ts
│   ├── infrastructure/
│   │   ├── openrouter/
│   │   │   └── client.test.ts
│   │   ├── storage/
│   │   │   ├── storage-router.test.ts
│   │   │   ├── localStorage-adapter.test.ts
│   │   │   └── indexeddb-adapter.test.ts
│   │   └── save/
│   │       ├── SaveManager.test.ts
│   │       └── SaveSerializer.test.ts
│   ├── stores/
│   │   ├── world-store.test.ts
│   │   ├── dialogue-store.test.ts
│   │   ├── map-store.test.ts
│   │   └── ui-store.test.ts
│   └── lib/
│       ├── utils/
│       │   ├── id.test.ts
│       │   ├── tokenizer.test.ts
│       │   └── debounce.test.ts
│       └── constants/
│           └── limits.test.ts
├── integration/
│   ├── memory-dialogue.test.ts             # MEM-INT-01, DLG-INT-01
│   ├── map-dialogue.test.ts                # MAP-INT-01, DLG-INT-02
│   ├── dialogue-state-flow.test.ts         # DLG-INT-03, DLG-INT-04
│   └── save-load-cycle.test.ts             # 完整存档循环
└── e2e/
    ├── game-creation.spec.ts               # 角色创建 → 开始游戏
    ├── exploration-loop.spec.ts            # 地图点击 → 对话 → 状态更新
    └── session-persistence.spec.ts         # 存档 → 刷新 → 读档 → 记忆恢复
```

---

## 3. 如何运行

### 前提条件

```bash
npm install        # 安装依赖（含 vitest, @testing-library/react, playwright）
```

### 命令速查

| 命令 | 说明 |
|------|------|
| `npm run test:unit` | 运行全部单元测试 |
| `npm run test:unit -- --watch` | 监视模式 |
| `npm run test:unit -- --coverage` | 运行 + 生成覆盖率报告 |
| `npm run test:unit -- path/to/file.test.ts` | 运行单个测试文件 |
| `npm run test:unit -- -t "test name pattern"` | 运行匹配的测试 |
| `npm run test:integration` | 运行集成测试 |
| `npm run test:e2e` | 运行 E2E 测试（需先 `npx playwright install`） |
| `npm run test:all` | 运行全部测试 |

### package.json scripts 配置（建议）

```json
{
  "scripts": {
    "test:unit": "vitest run --config vitest.config.ts",
    "test:unit:watch": "vitest --config vitest.config.ts",
    "test:unit:coverage": "vitest run --config vitest.config.ts --coverage",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:e2e": "playwright test",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e"
  }
}
```

### vitest.config.ts 配置

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { coverageThresholds } from './tests/setup';
import path from 'path';

export default defineConfig({
  test: {
    // Setup file (global mocks)
    setupFiles: ['./tests/setup.ts'],

    // Environment
    environment: 'jsdom',

    // Include patterns
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],

    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/types.ts',          // 纯类型文件不需要测试
        'src/**/index.ts',          // barrel exports
        'src/app/**',                // Next.js app router（E2E 测试覆盖）
      ],
      thresholds: coverageThresholds,
    },

    // Globals (可选，避免每个文件 import describe/it/expect)
    globals: true,
  },

  // 路径别名（与 tsconfig.json 对齐）
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
```

---

## 4. 命名约定

### 4.1 测试文件

```
<被测模块>.test.ts         # 单元测试（与源文件同目录或镜像）
<场景描述>.spec.ts          # E2E 测试
```

| 类型 | 示例 |
|------|------|
| 单元测试 | `MemoryEngine.test.ts` |
| 集成测试 | `memory-dialogue.test.ts` |
| E2E | `game-creation.spec.ts` |

### 4.2 测试用例

```typescript
// 推荐格式: "should <行为> when <条件>"
describe('MemoryEngine', () => {
  describe('ingest()', () => {
    it('should extract entities when ingesting a dialogue event', () => { ... });
    it('should update relationship strength when ingesting a related event', () => { ... });
    it('should NOT allow concurrent ingest and retrieve calls', () => { ... });
    it('should throw when ingesting an event with missing required fields', () => { ... });
  });

  describe('retrieveForContext()', () => {
    it('should return related entities when querying by location', () => { ... });
    it('should stay within token budget when maxTokens is specified', () => { ... });
    it('should return empty context when no matching memories exist', () => { ... });
  });
});
```

### 4.3 GDD 测试 ID 映射

每个测试用例注释其覆盖的 GDD 测试 ID：

```typescript
/**
 * @covers MEM-UT-01
 * @spec memory-engine.md §7.1
 */
it('should extract entities when ingesting a dialogue event', () => { ... });
```

---

## 5. 编写测试

### 5.1 单元测试模板

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryEngine } from '@/systems/memory/MemoryEngine';
import { createTestMemoryGraph, createTestEvent } from '@/tests/setup';

describe('MemoryEngine', () => {
  let engine: MemoryEngine;

  beforeEach(async () => {
    engine = new MemoryEngine();
    await engine.init({
      maxImmediateEvents: 200,
      shortTermSessionLimit: 5,
      compressionThreshold: 200,
      enableLongTerm: false,
    });
  });

  /**
   * @covers MEM-UT-01
   */
  it('should extract entities when ingesting a dialogue event', async () => {
    // Given
    const event = createTestEvent({
      detail: '玩家在古老橡树处与守卫队长交谈。',
    });

    // When
    await engine.ingest(event);

    // Then
    const entities = engine.searchEntities('守卫队长');
    expect(entities).toHaveLength(1);
    expect(entities[0]?.type).toBe('character');
  });
});
```

### 5.2 集成测试模板

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryEngine } from '@/systems/memory/MemoryEngine';
import { DialogueSystem } from '@/systems/dialogue/DialogueSystem';
import { mockFetch } from '@/tests/setup';

describe('Memory ↔ Dialogue Integration', () => {
  let memory: MemoryEngine;
  let dialogue: DialogueSystem;

  beforeEach(async () => {
    memory = new MemoryEngine();
    await memory.init({ maxImmediateEvents: 200, shortTermSessionLimit: 5, compressionThreshold: 200, enableLongTerm: false });

    dialogue = new DialogueSystem(memory);
    await dialogue.init({
      model: 'anthropic/claude-3.5-sonnet',
      temperature: 0.8,
      maxTokens: 2000,
      streamTimeout: 30000,
      systemPromptTemplate: 'default',
      enableTypingEffect: false,
    });
  });

  /**
   * @covers MEM-INT-01, DLG-INT-01
   */
  it('should inject previous dialogue context into next LLM prompt', async () => {
    // Given: mock LLM responds with a narrative that mentions a character
    mockFetch.mockResponseOnce({
      ok: true,
      status: 200,
      text: async () => '[NARRATIVE]\n你遇到了守卫队长。\n\n[ACTIONS]\n- 与他交谈\n\n[STATE]\n关系: 守卫队长 +10',
    });

    await dialogue.sendMessage({ type: 'free_text', text: '我来到城门。' });

    // When: send another message
    mockFetch.mockResponseOnce({
      ok: true,
      status: 200,
      text: async () => '[NARRATIVE]\n守卫队长向你点头致意。\n\n[ACTIONS]\n- 询问城门情况\n\n[STATE]\n无变化',
    });

    await dialogue.sendMessage({ type: 'free_text', text: '我想和守卫队长说话。' });

    // Then: the LLM should have been called with memory context
    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const requestBody = JSON.parse(lastCall[1].body);
    // Verify memory context is present in the prompt
    expect(requestBody.messages.some((m: { content: string }) => m.content.includes('守卫队长'))).toBe(true);
  });
});
```

### 5.3 E2E 测试模板

```typescript
// tests/e2e/game-creation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Game Creation Flow', () => {
  test('should create a new game from the landing page', async ({ page }) => {
    // Navigate to landing
    await page.goto('/');

    // Click "开始新游戏"
    await page.click('text=开始新游戏');

    // Fill in character creation
    await page.fill('[data-testid="player-name"]', 'TestHero');
    await page.fill('[data-testid="player-description"]', 'A brave adventurer.');
    await page.selectOption('[data-testid="player-class"]', 'warrior');

    // Submit
    await page.click('text=开始冒险');

    // Verify game page loads
    await expect(page).toHaveURL(/\/game\//);
    await expect(page.locator('[data-testid="dialogue-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="map-panel"]')).toBeVisible();
  });
});
```

### 5.4 data-testid 约定

组件必须添加 `data-testid` 属性用于 E2E/组件测试定位：

```tsx
// ✅ 推荐
<button data-testid="send-message-btn">发送</button>
<input data-testid="player-input" placeholder="输入你想做什么…" />

// ❌ 不推荐 — 依赖 CSS 类名或文本内容（容易被重构破坏）
<button className="btn-send">发送</button>
```

**命名规范**: `<component>-<element>` kebab-case。
示例: `map-panel`, `dialogue-input`, `decision-option-1`, `save-slot-0`

---

## 6. 覆盖率目标

| 路径 | 语句 | 分支 | 函数 | 行 |
|------|------|------|------|-----|
| `src/systems/memory/` | **80%** | 75% | **80%** | **80%** |
| `src/systems/dialogue/` | 70% | 65% | 70% | 70% |
| `src/systems/map/` | 70% | 65% | 70% | 70% |
| `src/infrastructure/` | 70% | 65% | 70% | 70% |
| `src/components/` | **50%** | 40% | **50%** | **50%** |
| `src/lib/` | **90%** | 85% | **90%** | **90%** |
| `src/stores/` | 60% | 50% | 60% | 60% |
| **全局** | **70%** | 65% | **70%** | **70%** |

> 覆盖率阈值在 `tests/setup.ts` → `coverageThresholds` 中定义，CI 构建时作为硬门禁。

### 覆盖率豁免

以下模式不需要测试覆盖（已在 `vitest.config.ts` exclude 中配置）：
- `src/**/types.ts` — 纯类型定义
- `src/**/index.ts` — barrel re-exports
- `src/app/**` — Next.js 页面（E2E 覆盖）

---

## 7. Mock 策略

### 7.1 Mock 分级

| 层级 | Mock 范围 | 示例 |
|------|----------|------|
| **不 Mock** | 纯函数、工具函数（lib/） | `tokenizer.ts`, `CoordinateUtils.ts` |
| **局部 Mock** | 外部 I/O 依赖 | `mockFetch`（OpenRouter API） |
| **全局 Mock** | 浏览器 API（在 setup.ts） | `localStorage`, `IndexedDB`, `crypto` |
| **不测试 Mock** | Mock 本身不需要测试 | `mockLocalStorage` 是测试基础设施 |

### 7.2 常用 Mock 速查

```typescript
import { mockFetch, mockLocalStorage, mockIndexedDB, setMockStorageEstimate } from '@/tests/setup';

// Mock fetch (OpenRouter)
mockFetch.mockResponseOnce({
  ok: true,
  text: async () => '[NARRATIVE]\nHello!\n\n[ACTIONS]\n- Wave\n\n[STATE]\nNone',
});
mockFetch.mockRejectOnce(new Error('Network error'));

// Simulate quota exceeded
mockLocalStorage._setQuota(100); // 100 bytes
expect(() => mockLocalStorage.setItem('big', 'x'.repeat(200))).toThrow('QuotaExceededError');

// Simulate IndexedDB unavailable
mockIndexedDB.setUnavailable(true);

// Simulate storage quota nearly full
setMockStorageEstimate({ usage: 85 * 1024 * 1024, quota: 100 * 1024 * 1024 }); // 85%
```

---

## 8. 首个冲刺最小测试集

以下是 Sprint 0 + Sprint 1 必须通过的**最小测试集**。这些测试在 CI 中作为 `test:minimal` 门禁。

### Epic 1: 项目脚手架

| 文件 | 测试用例 | 优先级 |
|------|---------|--------|
| `tests/unit/lib/utils/tokenizer.test.ts` | `estimateTokens` 中英文混合正确 | P0 |
| `tests/unit/lib/utils/id.test.ts` | `generateUUID()` 格式正确 + 唯一性 | P0 |
| `tests/unit/lib/utils/debounce.test.ts` | debounce 延迟执行 | P1 |
| `tests/unit/infrastructure/storage/storage-router.test.ts` | 三级降级路径正确 | P0 |
| `tests/unit/stores/world-store.test.ts` | Store 初始化 + `reset()` | P1 |

### Epic 2: 记忆引擎

| 文件 | 测试用例 | 覆盖 GDD ID |
|------|---------|------------|
| `tests/unit/systems/memory/EntityExtractor.test.ts` | 中文实体提取（人名/地名） + 去重 + 置信度 | MEM-UT-01, MEM-UT-02 |
| `tests/unit/systems/memory/MemoryEngine.test.ts` | `ingest()` 基本流程 + `retrieveForContext()` 返回上下文 | MEM-UT-01, MEM-UT-07 |
| `tests/unit/systems/memory/GraphBuilder.test.ts` | 关系强度更新 + 实体去重 | MEM-UT-03 |
| `tests/unit/systems/memory/Compressor.test.ts` | 压缩触发（201 条 → ≤ 80 条） + 短期记忆生成 | MEM-UT-04, MEM-UT-05 |
| `tests/unit/systems/memory/ContextRetriever.test.ts` | token 预算控制 + 相关性匹配 | MEM-UT-07, MEM-UT-08 |

### Epic 4: 地图系统

| 文件 | 测试用例 | 覆盖 GDD ID |
|------|---------|------------|
| `tests/unit/systems/map/CoordinateUtils.test.ts` | iso↔screen 互转 + 等距邻居正确 | MAP-UT-01 |
| `tests/unit/systems/map/Pathfinder.test.ts` | 直线路径 + 绕过障碍 + 无路径 null | MAP-UT-02 |
| `tests/unit/systems/map/FogManager.test.ts` | 首次揭示 + 已探索恢复 + 阻挡物后方不可见 | MAP-UT-03, MAP-UT-04 |

### Epic 3: 对话系统

| 文件 | 测试用例 | 覆盖 GDD ID |
|------|---------|------------|
| `tests/unit/systems/dialogue/ResponseParser.test.ts` | 解析完整四块 + 仅 NARRATIVE + 异常格式降级 | DLG-UT-07 |
| `tests/unit/systems/dialogue/PromptAssembler.test.ts` | 四层正确组装 + 缓存命中 | DLG-UT-08 |
| `tests/unit/systems/dialogue/FakeChoiceDetector.test.ts` | 真选择通过 + 假选择 warning | DLG-UT-07 |

### 集成测试

| 文件 | 测试用例 | 覆盖 GDD ID |
|------|---------|------------|
| `tests/integration/memory-dialogue.test.ts` | ingest → retrieve → context in prompt | MEM-INT-01, DLG-INT-01 |

### 总计

- **单元测试文件**: ~14 个
- **测试用例数**: ~40-50 个
- **集成测试文件**: 1 个
- **目标覆盖率**: lib/ > 90%, memory/ > 80%

---

## 9. CI 集成

### GitHub Actions 配置（建议）

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test:unit -- --coverage
      - name: Check coverage thresholds
        run: |
          npx vitest run --coverage --coverage.thresholds.autoUpdate=false

  integration:
    runs-on: ubuntu-latest
    needs: unit
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:integration

  e2e:
    runs-on: ubuntu-latest
    needs: integration
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

### Pre-commit Hook（husky + lint-staged 建议）

```json
// .lintstagedrc.json
{
  "*.{ts,tsx}": ["eslint --fix", "vitest related --run"],
  "*.{ts,tsx,css,md}": ["prettier --write"]
}
```

---

## 附录 A: 测试反模式

| 反模式 | 问题 | 正确做法 |
|--------|------|---------|
| 测试实现细节 | `expect(engine['_internalCounter']).toBe(5)` | 测试公开 API 行为 |
| 过度 Mock | Mock 了整个 MemoryEngine 去测试 DialogueSystem | 集成测试用真实实例 |
| 串行测试 | `it('test1', async () => { await sleep(1000); ... })` | 使用 fake timers (`vi.useFakeTimers()`) |
| 测试私有方法 | `expect(engine['privateMethod']()).toBe(...)` | 重构为可测试的公开接口 |
| 快照滥用 | 大 JSON 快照无意义 | 仅对 UI 输出用快照，且控制大小 |
| 无清理 | 测试间状态泄漏 | `beforeEach` 中重置 mocks |

## 附录 B: 资源链接

- [Vitest 文档](https://vitest.dev/)
- [Testing Library 文档](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright 文档](https://playwright.dev/)
- [Vitest Coverage 配置](https://vitest.dev/config/#coverage)
- [jsdom 环境](https://github.com/jsdom/jsdom)

---

> **下一步**: Sprint 0 开始时，先创建上述最小测试集文件，确保 CI 骨架可运行。
