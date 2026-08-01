/**
 * UUID v4 生成器
 *
 * 优先使用 crypto.randomUUID()（浏览器原生），
 * 降级到 uuid 库或手动生成（确定性 fallback）。
 */

let _useLibUUID = false;
let _uuidFn: (() => string) | null = null;

/**
 * 初始化 UUID 生成策略。
 * 在应用启动时调一次即可。
 */
export function initUUIDGenerator(): void {
  // 优先使用浏览器原生 crypto.randomUUID()
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    _uuidFn = () => crypto.randomUUID();
    return;
  }

  // 降级到 uuid 库（动态导入，仅当需要时）
  try {
    // 静态 import（bundler 会 tree-shake）
    _useLibUUID = true;
    _uuidFn = null; // 由 generateUUID fallback 处理
  } catch {
    // 最后降级：手动生成
    _uuidFn = null;
  }
}

/**
 * 生成 UUID v4
 *
 * @returns 标准 UUID v4 字符串，如 "550e8400-e29b-41d4-a716-446655440000"
 */
export function generateUUID(): string {
  // 优先使用缓存的原生实现
  if (_uuidFn) {
    return _uuidFn();
  }

  // 浏览器原生 crypto
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  // uuid 库（通过动态导入，避免无依赖时崩溃）
  if (_useLibUUID) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { v4 } = require('uuid') as { v4: () => string };
    return v4();
  }

  // 手动 fallback（非加密级随机，仅用于降级场景）
  return manualUUIDv4();
}

/**
 * 手动生成 UUID v4（非加密安全，仅兜底）
 */
function manualUUIDv4(): string {
  const hex = '0123456789abcdef';
  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  let result = '';
  for (const ch of template) {
    if (ch === 'x') {
      result += hex[Math.floor(Math.random() * 16)]!;
    } else if (ch === 'y') {
      // y: 8, 9, a, b
      const idx = (Math.floor(Math.random() * 4) + 8) % 16;
      result += hex[idx]!;
    } else {
      result += ch;
    }
  }
  return result;
}
