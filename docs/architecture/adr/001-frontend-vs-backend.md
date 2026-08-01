# ADR-001: 纯前端 vs 后端分离架构

> **状态**: Proposed
> **日期**: 2025-07-29
> **作者**: 程基岩 (Cheng Jiyan)
> **决策者**: 游承峰 (You Chengfeng) — 主理人

---

## 上下文 (Context)

AI Narrator Game 的核心交互依赖 LLM API（通过 OpenRouter 接入 GPT-4o、Claude 3.5 Sonnet、Gemini 1.5 Pro）。所有 LLM 调用需要 API Key。系统需要在以下约束下做出架构选择：

1. **安全约束**：API Key 不能暴露给第三方服务器，不能硬编码在客户端代码中
2. **性能约束**：对话首 token < 500ms（流式 SSE），冷启动快速
3. **成本约束**：MVP 不部署后端服务器（概念 D008），零运维成本
4. **部署约束**：最终需支持 Electron/Tauri 打包为桌面 EXE
5. **用户体验**：网络中断时优雅降级，离线可阅读已生成内容

### 架构选项

#### 选项 A: 纯前端（浏览器直连 OpenRouter）

```
Browser ──── HTTPS/SSE ────▶ OpenRouter API
  ▲                              │
  │                              ▼
  │                         GPT-4o / Claude / Gemini
  │
  └── localStorage (API Key)
```

#### 选项 B: 轻量后端代理（FastAPI / Cloudflare Workers）

```
Browser ──── HTTPS/SSE ────▶ FastAPI (Vercel/Cloudflare)
                                  │
                                  ▼
                            OpenRouter API
                                  │
                                  ▼
                            GPT-4o / Claude / Gemini

API Key 仅存在于服务端环境变量
```

#### 选项 C: 混合模式（纯前端为主 + 可选代理）

```
默认路径（纯前端）:
  Browser ────▶ OpenRouter

可选路径（用户自建代理）:
  Browser ────▶ 用户自己的代理服务器 ────▶ OpenRouter
  （供高级用户使用，非 MVP）
```

---

## 评估维度

### 1. API Key 安全性

| 维度 | 纯前端 (A) | 后端代理 (B) | 混合 (C) |
|------|-----------|-------------|---------|
| Key 存储位置 | 浏览器 localStorage | 服务器环境变量 | 浏览器（默认） |
| Key 传输路径 | 浏览器 → OpenRouter | 浏览器 → 代理 → OpenRouter | 浏览器 → OpenRouter |
| 攻击面 | XSS 窃取 (需 CSP 防护) | 服务端入侵 | 同 A |
| 用户控制权 | 用户完全控制自己的 Key | 服务器持有所有用户的 Key | 用户控制 |
| 合规风险 | 低（用户自己的 Key） | 中（服务器可能被视为"转售"API） | 低 |

**关键洞察**：方案 B 将 Key 安全从"客户端 XSS 防护"转移到"服务端安全"，但引入了新的合规风险——如果服务器被入侵，所有用户的 Key 都会泄露（Single Point of Failure）。且 OpenRouter 的 Terms of Service 对"代理转售"有限制，需要法律评估。

方案 A 的安全模型是"每个用户为自己的 Key 负责"——这与密码管理器的安全模型一致（1Password、Bitwarden 均在客户端存储主密钥）。

### 2. 流式 SSE 代理

| 维度 | 纯前端 | 后端代理 |
|------|--------|---------|
| SSE 实现 | 浏览器原生 `EventSource` / `fetch` + `ReadableStream` | 服务端需中继 SSE（增加一跳延迟） |
| 首 Token 延迟 | 直连延迟 (~200-500ms) | 直连 + 代理跳转 (~300-800ms) |
| 连接可靠性 | 仅依赖 OpenRouter SLA | 额外依赖代理服务器 SLA |
| 取消/中断 | `AbortController` 原生支持 | 需实现代理层取消传播 |
| 实现复杂度 | 低（~100 行 fetch wrapper） | 中-高（SSE 中继、错误传播、超时管理） |

### 3. 冷启动与运维成本

| 维度 | 纯前端 | 后端代理 |
|------|--------|---------|
| 首次加载 | ~500KB 静态资源 + OpenRouter 延迟 | + 代理冷启动（Serverless 冷启动 ~200-500ms） |
| 月费 | $0（无服务器） | Vercel Hobby $0（但有带宽/执行限制）|
| 运维 | 零运维 | 需要监控、日志、告警 |
| 扩展性 | 天然无限（客户端计算） | 受 Serverless 并发限制 |
| 离线能力 | 可离线阅读已有内容 | 代理不可达 = 完全不可用 |

### 4. Electron 打包兼容性

| 维度 | 纯前端 | 后端代理 |
|------|--------|---------|
| 打包 | `next export` 静态文件 → Electron 渲染进程 | 需要打包服务器运行时（复杂） |
| API Key 存储 | electron-store (加密) 替代 localStorage | 无需变更 |
| 离线模式 | 天然支持（本地文件） | 需要本地代理进程 |

方案 A 的 Electron 迁移路径最简：静态导出 → 渲染进程加载 → `electron-store` 加密 Key。

### 5. 安全威胁模型分析

#### 方案 A 的威胁与对策

| 威胁 | 风险等级 | 对策 |
|------|---------|------|
| XSS 窃取 localStorage API Key | **高** | **严格 CSP**（禁止 inline script, 禁止 unsafe-eval）；`Content-Security-Policy: script-src 'self'` |
| 依赖库供应链攻击窃取 Key | **中** | `npm audit` + lockfile + 最小依赖原则 |
| 浏览器扩展读取 localStorage | **低-中** | 用户教育 + 未来 `electron-store` 加密 |
| 中间人攻击 (HTTP) | **低** | 强制 HTTPS；OpenRouter 仅接受 HTTPS |
| 开发者工具查看内存 | **低** | 物理访问 = 已沦陷 |

#### 方案 B 的威胁与对策

| 威胁 | 风险等级 | 对策 |
|------|---------|------|
| 服务端入侵（所有用户 Key 泄露） | **极高** | 独立密钥管理服务、密钥加密存储、审计日志 |
| 代理日志泄露 Key | **高** | 日志脱敏、不记录 Authorization header |
| SSRF 攻击 | **中** | 白名单目标域（仅 OpenRouter） |
| DDoS 代理费用暴涨 | **中** | Rate limiting、用户级配额 |

### 6. OpenRouter 官方建议

OpenRouter 官方文档明确支持**两种使用模式**：
1. **客户端直连**：适用于浏览器应用，建议配合 CSP
2. **服务端代理**：适用于需要隐藏 Key 或统一计费的场景

OpenRouter 不要求服务端代理，且其 CORS 配置允许浏览器直连（`Access-Control-Allow-Origin: *`）。

---

## 决定 (Decision)

**选择方案 C（混合模式）**，MVP 阶段实现纯前端路径（方案 A），架构预留代理接口。

具体决议：

1. **MVP 默认使用纯前端直连 OpenRouter**
2. **API Key 存储在 localStorage**，配合严格的 CSP 防护
3. **架构层预留 `IPlatformAdapter` 接口**（见 `overview.md` §11.1），允许未来注入：
   - 可选后端代理 URL（用户自建）
   - Electron 加密存储（`electron-store`）
4. **在设置页面添加"自定义代理 URL"选项**（Should Have），供高级用户配置自己的代理服务器
5. **不实现后端代理**——零服务器成本、零运维成本、用户持有自己的 Key

### 架构预留接口

```typescript
// infrastructure/openrouter/client.ts

interface OpenRouterConfig {
  apiKey: string;
  baseUrl: string;              // 默认 'https://openrouter.ai/api/v1'
  customProxyUrl?: string;      // 可选：用户自建代理 URL
  // 当 customProxyUrl 存在时，请求发到代理而非 OpenRouter 直连
}
```

---

## 后果 (Consequences)

### 正面后果

✅ **零运维成本**：无服务器，无数据库，无监控告警
✅ **零冷启动**：静态文件 + 浏览器直连 API，首 Load 即完整功能
✅ **用户隐私**：API Key 完全由用户控制，不被任何第三方服务器持有
✅ **Electron 迁移无摩擦**：静态导出 → 渲染进程，无后端迁移负担
✅ **合规简单**：不涉及 API 转售或许可证问题
✅ **离线友好**：网络中断时，已有内容完全可读（存档在本地）

### 负面后果

⚠️ **XSS 风险**：API Key 存储在 localStorage，XSS 漏洞可导致 Key 泄露
  - **缓解**: 严格的 CSP + 最小依赖 + 定期安全审计（见 tech-checklist.md）

⚠️ **API 用量不可监控**：无法从服务端追踪用户 API 消耗
  - **缓解**: 客户端遥测（可选，用户同意后开启）+ 用户自行在 OpenRouter Dashboard 查看

⚠️ **无请求缓存/去重**：多个 tab 同时打开可能产生重复请求
  - **缓解**: Tab 锁机制（检测多 tab → 提示），见对话 GDD §6.2

⚠️ **模型切换无服务端 fallback**：如果用户选择的模型不可用，需要客户端切换
  - **缓解**: 模型可用性检查 + 自动 fallback 到默认模型（客户端逻辑）

### 中性后果

➡️ **每个用户需要自己的 OpenRouter API Key**：这是设计选择，而非缺陷。AI Narrator Game 定位为"高级用户的深度叙事工具"，而非"大众消费品"。目标用户群（CRPG 爱好者、TTRPG 玩家）对 API Key 管理有基本认知。

➡️ **无法实现服务端统一计费/订阅模式**：未来如需"自带 Key"和"平台提供 Key"两种模式共存，可通过方案 C 的 `customProxyUrl` 扩展实现，无需架构变更。

---

## 备选方案分析摘要

| 方案 | 安全 | 性能 | 成本 | 复杂度 | Electron | 决策 |
|------|------|------|------|--------|----------|------|
| A: 纯前端 | ⚠️ (CSP 依赖) | ✅ 最优 | ✅ $0 | ✅ 最低 | ✅ 最简 | **MVP 采用** |
| B: 后端代理 | ✅ (若安全加固) | ⚠️ (+一跳) | ❌ 运维成本 | ❌ 高 | ❌ 需打包 | 不采用 |
| C: 混合 | ✅ (默认 A + 可选 B) | ✅ | ✅ $0 | ⚠️ 适配器层 | ✅ | **架构采用** |

---

## 参考资料

- OpenRouter API Documentation: https://openrouter.ai/docs
- OpenRouter CORS Policy: supports browser direct calls
- Next.js CSP Configuration: https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
- OWASP localStorage Security: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- 概念文档 D004 (OpenRouter 作为 LLM 网关), D008 (MVP Web 应用 + 后续 EXE)
- 对话系统 GDD §4.4 (OpenRouter 接入), §6.1 (API Key 无效处理)
