/**
 * v5.1.0 技术美术优化 — CSS 变量生成器
 * 以 tokens.ts 为唯一事实源，自动生成 CSS 变量注入 :root，
 * 保证 CSS 层（globals.css 新代码 / .panel-card / fx- 动画）与 TS 常量永远同步。
 * 用法：<style dangerouslySetInnerHTML={{ __html: `:root{${toCssVars()}}` }} />
 * @module theme/css-vars
 */
import { C, FONT, RADIUS, SHADOW } from './tokens';

/** camelCase / PascalCase → kebab-case（bgDeep → bg-deep，goldLight → gold-light） */
function toKebab(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** 递归展平嵌套对象为 CSS 变量表（string 原样，number 视为 px） */
function flatten(
  obj: Record<string, unknown>,
  prefix: string,
  out: Record<string, string>,
): void {
  for (const [k, v] of Object.entries(obj)) {
    const name = `${prefix}-${toKebab(k)}`;
    if (typeof v === 'string') out[name] = v;
    else if (typeof v === 'number') out[name] = `${v}px`;
    else if (v && typeof v === 'object') flatten(v as Record<string, unknown>, name, out);
  }
}

/**
 * 生成 `--var-name: value;` 串，供 :root 注入。
 * 命名空间：--c-*（色彩）/ --shadow-* / --radius-* / --font-*（字体尺寸）
 */
export function toCssVars(): string {
  const vars: Record<string, string> = {};
  flatten(C, 'c', vars);
  flatten(SHADOW, 'shadow', vars);
  flatten(RADIUS, 'radius', vars);
  flatten(FONT, 'font', vars);
  return Object.entries(vars)
    .map(([k, v]) => `--${k}: ${v};`)
    .join('\n');
}

export default toCssVars;
