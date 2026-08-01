/**
 * SaveSerializer — 存档序列化/反序列化引擎
 *
 * @description
 * 负责将 SaveData 序列化为 JSON 字符串、从 JSON 反序列化、
 * 版本检查、数据迁移、压缩/解压、校验和计算。
 *
 * 压缩策略：
 * - 优先使用 CompressionStream API (gzip, 现代浏览器原生支持)
 * - 不支持时静默降级为无压缩
 *
 * 校验和：
 * - SHA-256 via crypto.subtle.digest
 * - 不支持时使用简单 CRC32 兜底
 *
 * @see Epic 6 Story 6.2
 */

import type {
  SaveData,
  SaveVersion,
  SerializeOptions,
  DeserializeResult,
} from './types';
import {
  CURRENT_SAVE_VERSION,
  compareSaveVersion,
  saveVersionToString,
  parseSaveVersion,
  MAX_SAVE_SIZE_BYTES,
} from './types';

// ============================================================
// SaveSerializer
// ============================================================

export class SaveSerializer {
  // ===========================================================================
  // 序列化
  // ===========================================================================

  /**
   * 将 SaveData 序列化为 JSON 字符串。
   *
   * @param data - 完整的存档数据
   * @param opts - 序列化选项
   * @returns JSON 字符串
   */
  async serialize(data: SaveData, opts: SerializeOptions = {}): Promise<string> {
    const {
      compress = true,
      pretty = false,
      includeChecksum = true,
    } = opts;

    // 1. 计算校验和（在序列化前计算，确保完整性）
    let checksum = '';
    if (includeChecksum) {
      const dataWithoutChecksum = { ...data, checksum: '' };
      checksum = await computeChecksum(dataWithoutChecksum);
    }

    const dataWithChecksum: SaveData = {
      ...data,
      checksum,
    };

    // 2. JSON 序列化
    const json = JSON.stringify(dataWithChecksum, null, pretty ? 2 : 0);

    // 3. 可选压缩
    if (compress) {
      const compressed = await compressString(json);
      if (compressed) {
        // 在压缩数据前加标记前缀以便反序列化时识别
        return 'GZ:' + compressed;
      }
    }

    return json;
  }

  // ===========================================================================
  // 反序列化
  // ===========================================================================

  /**
   * 从 JSON 字符串反序列化为 SaveData。
   *
   * 流程：
   * 1. 检测压缩标记并解压
   * 2. JSON 解析
   * 3. 版本兼容性检查
   * 4. 数据迁移（如需要）
   * 5. 校验和验证
   *
   * @param raw - JSON 字符串（可能带 GZ: 压缩前缀）
   * @returns DeserializeResult
   */
  async deserialize(raw: string): Promise<DeserializeResult> {
    try {
      // 1. 解压（如有压缩标记）
      let json: string;
      if (raw.startsWith('GZ:')) {
        const compressed = raw.slice(3);
        const decompressed = await decompressString(compressed);
        if (decompressed === null) {
          return {
            success: false,
            data: null,
            error: '存档解压失败：压缩数据损坏。',
            migrated: false,
          };
        }
        json = decompressed;
      } else {
        json = raw;
      }

      // 2. JSON 解析
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(json);
      } catch {
        return {
          success: false,
          data: null,
          error: '存档 JSON 解析失败：格式无效。',
          migrated: false,
        };
      }

      // 3. 版本检查
      const rawVersion = parsed['version'];
      if (!rawVersion || typeof rawVersion !== 'object') {
        return {
          success: false,
          data: null,
          error: '存档缺少版本信息：无法验证兼容性。',
          migrated: false,
        };
      }

      const fileVersion: SaveVersion = {
        major: Number((rawVersion as Record<string, unknown>)['major'] ?? 0),
        minor: Number((rawVersion as Record<string, unknown>)['minor'] ?? 0),
        patch: Number((rawVersion as Record<string, unknown>)['patch'] ?? 0),
      };

      // 4. 版本兼容性
      let migrated = false;
      let fromVersion: SaveVersion | undefined;
      let toVersion: SaveVersion | undefined;
      let data = parsed;

      const cmp = compareSaveVersion(fileVersion, CURRENT_SAVE_VERSION);
      if (cmp > 0) {
        // 存档版本比当前引擎版本更新 → 不兼容
        return {
          success: false,
          data: null,
          error: `存档版本 (${saveVersionToString(fileVersion)}) 比当前引擎版本 (${saveVersionToString(CURRENT_SAVE_VERSION)}) 更新，请升级应用。`,
          migrated: false,
        };
      }
      if (cmp < 0) {
        // 存档版本较旧 → 尝试迁移
        fromVersion = { ...fileVersion };
        const migrateResult = this.migrate(data, fileVersion, CURRENT_SAVE_VERSION);
        if (!migrateResult.success) {
          return {
            success: false,
            data: null,
            error: `存档版本迁移失败 (${saveVersionToString(fileVersion)} → ${saveVersionToString(CURRENT_SAVE_VERSION)}): ${migrateResult.error}`,
            migrated: false,
          };
        }
        data = migrateResult.data;
        migrated = true;
        toVersion = { ...CURRENT_SAVE_VERSION };
      }

      // 5. 构造 SaveData
      const saveData = data as unknown as SaveData;

      // 6. 校验和验证
      const storedChecksum = saveData.checksum;
      if (storedChecksum && storedChecksum.length > 0) {
        const { checksum: _, ...dataForVerify } = saveData;
        const computedChecksum = await computeChecksum(dataForVerify as SaveData);
        if (computedChecksum !== storedChecksum) {
          console.warn(
            '[SaveSerializer] Checksum mismatch — 存档可能已被修改。'
          );
          // 不阻止加载，但记录警告
        }
      }

      return {
        success: true,
        data: saveData,
        error: '',
        migrated,
        fromVersion,
        toVersion,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: `存档反序列化异常: ${err instanceof Error ? err.message : '未知错误'}`,
        migrated: false,
      };
    }
  }

  // ===========================================================================
  // 数据迁移
  // ===========================================================================

  /**
   * 版本间数据迁移。
   *
   * 当前（v1.1.0）为初始版本，暂无迁移路径。
   * 未来版本在此添加 case。
   *
   * @param data - 原始解析数据
   * @param from - 源版本
   * @param to - 目标版本
   * @returns 迁移后的数据
   */
  private migrate(
    data: Record<string, unknown>,
    from: SaveVersion,
    to: SaveVersion
  ): { success: boolean; data: Record<string, unknown>; error?: string } {
    let current = { ...data };
    const fromKey = saveVersionToString(from);
    const toKey = saveVersionToString(to);

    // v1.0.0 是初始版本，暂无迁移路径。
    // 未来迁移示例：
    //
    // if (fromKey === '1.0.0' && compareSaveVersion(to, { major: 1, minor: 1, patch: 0 }) >= 0) {
    //   // migrate: 1.0.0 → 1.1.0
    //   current = migrate_1_0_0_to_1_1_0(current);
    // }

    // 无可用迁移路径
    if (fromKey !== toKey) {
      return {
        success: false,
        data: current,
        error: `无可用迁移路径: ${fromKey} → ${toKey}`,
      };
    }

    return { success: true, data: current };
  }

  // ===========================================================================
  // 存档大小估算
  // ===========================================================================

  /**
   * 估算 SaveData 序列化后的字节大小。
   *
   * @param data - 存档数据
   * @returns 估算字节数
   */
  estimateSize(data: SaveData): number {
    const json = JSON.stringify(data);
    return new TextEncoder().encode(json).byteLength;
  }

  /**
   * 检查存档数据是否超过推荐大小。
   *
   * @param data - 存档数据
   * @returns 大小警告信息，null 表示正常
   */
  checkSizeWarning(data: SaveData): string | null {
    const size = this.estimateSize(data);
    if (size > MAX_SAVE_SIZE_BYTES) {
      const sizeMB = (size / (1024 * 1024)).toFixed(1);
      return `存档大小约 ${sizeMB} MB，可能影响存档/读档速度。建议清理部分对话历史。`;
    }
    return null;
  }
}

// ============================================================
// 压缩/解压辅助
// ============================================================

/**
 * 使用 CompressionStream API 压缩字符串。
 * 不支持时返回 null（静默降级）。
 */
async function compressString(input: string): Promise<string | null> {
  try {
    // 检查 CompressionStream 是否可用
    if (typeof CompressionStream === 'undefined') {
      return null;
    }

    const encoder = new TextEncoder();
    const uint8 = encoder.encode(input);

    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    const reader = cs.readable.getReader();

    // 写入数据
    writer.write(uint8);
    writer.close();

    // 读取压缩结果
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }

    // 合并
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // 转为 base64（分块处理，避免 btoa 栈溢出）
    // FIX: BUG-5 — btoa(String.fromCharCode(...merged)) 在 merged 过大时触发 RangeError
    return uint8ToBase64(merged);
  } catch {
    // 压缩失败，静默降级
    return null;
  }
}

/**
 * 使用 DecompressionStream API 解压字符串。
 * 不支持时返回 null。
 */
async function decompressString(input: string): Promise<string | null> {
  try {
    if (typeof DecompressionStream === 'undefined') {
      return null;
    }

    // base64 解码（分块处理，避免 atob 栈溢出）
    // FIX: BUG-5 — atob 大字符串同样有栈溢出风险
    const uint8 = base64ToUint8(input);

    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();

    writer.write(uint8 as unknown as Uint8Array<ArrayBuffer>);
    writer.close();

    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }

    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    return new TextDecoder().decode(merged);
  } catch {
    return null;
  }
}

// ============================================================
// 校验和
// ============================================================

/**
 * 计算 SaveData 的 SHA-256 校验和（hex 字符串）。
 *
 * 优先使用 crypto.subtle.digest('SHA-256')，
 * 不支持时降级为简单 CRC32。
 */
export async function computeChecksum(data: Omit<SaveData, 'checksum'>): Promise<string> {
  try {
    const json = JSON.stringify(data);
    const encoder = new TextEncoder();
    const uint8 = encoder.encode(json);

    // 尝试 SHA-256
    if (
      typeof crypto !== 'undefined' &&
      typeof crypto.subtle !== 'undefined' &&
      typeof crypto.subtle.digest === 'function'
    ) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', uint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // crypto.subtle 不可用，降级到 CRC32
  }

  // CRC32 降级
  return crc32(JSON.stringify(data));
}

/**
 * 简单 CRC32 实现（降级校验和）。
 */
function crc32(input: string): string {
  let crc = 0xffffffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i);
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xedb88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  return crc.toString(16).padStart(8, '0');
}

// ============================================================
// 导出单例
// ============================================================

/** SaveSerializer 默认单例 */
export const saveSerializer = new SaveSerializer();

// ============================================================
// 分块 base64 编解码（避免长字符串栈溢出）
// FIX: BUG-5 — btoa/atob 的 String.fromCharCode(...arr) 在数组过大时触发 RangeError
// ============================================================

const BASE64_CHUNK_SIZE = 0x8000; // 32768 bytes per chunk

/**
 * Uint8Array → base64 分块编码。
 */
function uint8ToBase64(uint8: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < uint8.length; i += BASE64_CHUNK_SIZE) {
    const chunk = uint8.subarray(i, i + BASE64_CHUNK_SIZE);
    parts.push(btoa(String.fromCharCode(...chunk)));
  }
  return parts.join('');
}

/**
 * base64 → Uint8Array 分块解码。
 */
function base64ToUint8(base64: string): Uint8Array {
  const parts: Uint8Array[] = [];
  for (let i = 0; i < base64.length; i += BASE64_CHUNK_SIZE * 2) {
    const chunk = base64.slice(i, i + BASE64_CHUNK_SIZE * 2);
    const binary = atob(chunk);
    const arr = new Uint8Array(binary.length);
    for (let j = 0; j < binary.length; j++) {
      arr[j] = binary.charCodeAt(j);
    }
    parts.push(arr);
  }
  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const merged = new Uint8Array(totalLen);
  let off = 0;
  for (const p of parts) {
    merged.set(p, off);
    off += p.length;
  }
  return merged;
}
