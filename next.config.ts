import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  compress: true,
  productionBrowserSourceMaps: false,
  images: { unoptimized: true },

  // GitHub Pages 部署在子路径（如 /watchparty/）时由构建环境注入；
  // 本地 dev / EdgeOne 部署不设置该变量，保持根路径行为不变。
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,

  // 注意：`output: 'export'`（纯静态导出）不支持 headers/rewrites/redirects。
  // CSP 等安全头需在托管平台（EdgeOne Pages / CDN）配置，此处移除避免死代码与构建警告。

  webpack(config) {
    config.resolve.fallback = {
      fs: false,
      path: false,
      crypto: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
