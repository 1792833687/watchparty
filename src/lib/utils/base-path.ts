/**
 * GitHub Pages 子路径支持。
 * 本地/EdgeOne 部署时 NEXT_PUBLIC_BASE_PATH 为空 → 返回原路径；
 * GitHub Pages 构建时 NEXT_PUBLIC_BASE_PATH=/watchparty → 自动加前缀。
 */
export function withBase(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  if (!base) return path;
  return `${base}${path}`;
}
