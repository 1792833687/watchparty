import type { Metadata } from 'next';
import './globals.css';
import { toCssVars } from '@/theme/css-vars';
// v5.1.0 技术美术：本地打包字体（@fontsource，构建期内联进 out/，运行时零外网请求）
// Cinzel 标题衬线（700/400）+ Crimson Text 叙事正文（400/400-italic）；中文自动回退系统字体
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/crimson-text/400.css';
import '@fontsource/crimson-text/400-italic.css';

// Font fallback — system fonts only, no Google Fonts dependency
// GameLayout.tsx uses: 'Cinzel','Georgia' for display, 'Noto Sans SC','Inter' for UI

export const metadata: Metadata = {
  title: 'AI Narrator Game',
  description: 'AI GM 驱动的 2.5D 文字冒险游戏 — 你的故事，由 AI 讲述',
  // FIX: SEC-2 — CSP meta 标签，限制外部资源仅允许 DeepSeek API / OpenRouter API
  other: {
    'Content-Security-Policy':
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob: https:; " +
      "font-src 'self' data: https://fonts.gstatic.com; " +
      "connect-src 'self' https://api.deepseek.com https://openrouter.ai; " +
      "media-src 'self'; " +
      "frame-src 'none'; " +
      "object-src 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self';",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {/* v5.1.0 技术美术：tokens.ts 单一事实源 → 注入 CSS 变量，与 globals.css 双轨同步 */}
        <style dangerouslySetInnerHTML={{ __html: `:root{${toCssVars()}}` }} />
        {children}
      </body>
    </html>
  );
}
