// v5.1.0 移动端布局自查脚本 — 390x844 视口（iPhone 尺寸）
// 注入假 API key + 跳过创建流程进入主界面，截图关键区域
import pkg from 'file:///C:/Users/17928/AppData/Roaming/npm/node_modules/playwright/index.js';
const { chromium } = pkg;

const BASE = 'http://localhost:3000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

// 注入假 key（前端校验 sk- 前缀；DeepSeek 调用会失败但 UI 布局照常渲染）
await page.addInitScript(() => {
  localStorage.setItem('deepseek-api-key', 'sk-test-mobile-layout-check');
});

// 打开游戏主界面（无角色时显示创建页，但顶栏/布局框架可见）
await page.goto(`${BASE}/game/new`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(4000);

await page.screenshot({ path: '/tmp/m1-game-init.png' });

// 首页
await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/m2-home.png' });

await browser.close();
console.log('done');
