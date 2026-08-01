/**
 * Token 估算工具
 *
 * 采用「字符数/4 法」——ADR-003 批准的精简估算策略。
 * 中文字符按 ×1.8 权重处理（中文每个字符通常对应 1.5~2 tokens）。
 *
 * 精确 tokenizer（如 tiktoken WASM ~1MB）明确不引入（tech-checklist §1.3）。
 */

/** 中文字符 Unicode 范围 */
const CJK_RANGES: readonly [number, number][] = [
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0x3400, 0x4dbf], // CJK Unified Ideographs Extension A
  [0x20000, 0x2a6df], // CJK Unified Ideographs Extension B
  [0x2a700, 0x2b73f], // CJK Unified Ideographs Extension C
  [0x2b740, 0x2b81f], // CJK Unified Ideographs Extension D
  [0x2b820, 0x2ceaf], // CJK Unified Ideographs Extension E
  [0xf900, 0xfaff], // CJK Compatibility Ideographs
  [0x2f800, 0x2fa1f], // CJK Compatibility Ideographs Supplement
];

/** 日文假名范围 */
const KANA_RANGES: readonly [number, number][] = [
  [0x3040, 0x309f], // Hiragana
  [0x30a0, 0x30ff], // Katakana
];

/** 韩文范围 */
const HANGUL_RANGE: readonly [number, number] = [0xac00, 0xd7af];

/**
 * 判断字符是否为 CJK 字符
 */
function isCJK(codePoint: number): boolean {
  for (const [start, end] of CJK_RANGES) {
    if (codePoint >= start && codePoint <= end) {
      return true;
    }
  }
  for (const [start, end] of KANA_RANGES) {
    if (codePoint >= start && codePoint <= end) {
      return true;
    }
  }
  if (codePoint >= HANGUL_RANGE[0] && codePoint <= HANGUL_RANGE[1]) {
    return true;
  }
  return false;
}

/**
 * 估算文本的 token 数量
 *
 * 算法：
 * - CJK 字符（中文/日文/韩文）：每个字符 × 1.8
 * - 其他字符（英文/数字/标点）：每 4 个字符算 1 token
 *
 * @param text - 待估算的文本
 * @returns 估算 token 数（整数）
 *
 * @example
 * ```ts
 * estimateTokens('Hello, World!')          // → ~4
 * estimateTokens('你好世界')               // → ~8
 * estimateTokens('Hello 你好')             // → ~6
 * ```
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  let cjkCount = 0;
  let otherCount = 0;

  for (let i = 0; i < text.length; i++) {
    const codePoint = text.codePointAt(i);
    if (codePoint === undefined) {
      continue;
    }

    // 跳过代理对的低代理部分
    if (codePoint > 0xffff) {
      i++; // 跳过高代理对的下一个单元
    }

    if (isCJK(codePoint)) {
      cjkCount++;
    } else if (codePoint > 0x1f && codePoint !== 0x7f) {
      // 排除控制字符和 DEL
      otherCount++;
    }
  }

  const cjkTokens = cjkCount * 1.8;
  const otherTokens = otherCount / 4;
  return Math.ceil(cjkTokens + otherTokens);
}

/**
 * 估算消息数组的总 token 数
 */
export function estimateMessagesTokens(
  messages: Array<{ content: string }>
): number {
  return messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
}
