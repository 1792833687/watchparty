# AI Narrator Game

纯前端 AI GM 驱动的文字冒险游戏（凛冬要塞 / Frosthold）。

## 部署（GitHub Pages）

推送代码到 `main` 分支后，GitHub Actions 自动构建并部署：
- 构建命令注入 `NEXT_PUBLIC_BASE_PATH=/watchparty`（子路径部署必需）
- 访问地址：`https://1792833687.github.io/watchparty/`

本地开发与 EdgeOne 部署不设置该变量，保持根路径行为不变。

## 开发

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # 静态导出到 out/
npm test           # vitest 单元测试
```
