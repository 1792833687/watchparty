/**
 * secure-storage.ts
 *
 * 基于 Web Crypto API (AES-GCM) 的安全密钥存储模块。
 * 替代明文 localStorage 存储 API Key。
 *
 * 工作原理：
 * 1. 首次使用生成 AES-GCM 密钥并存储在 IndexedDB（不可提取）
 * 2. 加密时生成随机 IV，与密文拼接后 Base64 编码
 * 3. 密文存入 localStorage，密钥本身不出 localStorage
 *
 * 安全特性：
 * - 密钥不可提取（non-extractable CryptoKey）
 * - 每次加密使用随机 IV
 * - 即使攻击者获取 localStorage 也无法解密
 * - 降级方案：IndexedDB 不可用时使用 sessionStorage（仅当前会话）
 *
 * @see GDD §8 — Security Requirements
 * @module SecureStorage
 */

// ============================================================
// 常量
// ============================================================

const DB_NAME = 'ai-narrator-secure-storage';
const DB_VERSION = 1;
const STORE_NAME = 'keys';
const KEY_ENTRY_ID = 'aes-gcm-key';

/** localStorage key 前缀 */
const LS_PREFIX = 'ai-narrator-sec:';

// ============================================================
// IndexedDB 管理
// ============================================================

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 从 IndexedDB 获取或创建 AES-GCM 密钥。
 * 密钥标记为 non-extractable，无法被 JS 导出。
 */
async function getOrCreateKey(): Promise<CryptoKey | null> {
  try {
    const db = await openDB();

    // 尝试读取已有密钥
    const existingKey = await new Promise<CryptoKey | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY_ENTRY_ID);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (existingKey) {
      db.close();
      return existingKey;
    }

    // 生成新密钥
    const newKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false, // non-extractable
      ['encrypt', 'decrypt']
    );

    // 存入 IndexedDB
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(newKey, KEY_ENTRY_ID);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    db.close();
    return newKey;
  } catch (err) {
    console.warn('[SecureStorage] IndexedDB 不可用，降级至 sessionStorage 模式:', err);
    return null;
  }
}

// ============================================================
// 辅助函数
// ============================================================

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 加密敏感值并存入 localStorage。
 *
 * @param key - localStorage 键名（不加前缀）
 * @param value - 要加密的明文值
 */
export async function secureSet(key: string, value: string): Promise<boolean> {
  try {
    const cryptoKey = await getOrCreateKey();

    // IndexedDB 不可用 → 降级为 sessionStorage
    if (!cryptoKey) {
      sessionStorage.setItem(LS_PREFIX + key, value);
      return true;
    }

    // AES-GCM 加密
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encoder.encode(value)
    );

    // IV + 密文 → Base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    const encoded = arrayBufferToBase64(combined.buffer);

    localStorage.setItem(LS_PREFIX + key, encoded);
    return true;
  } catch (err) {
    console.error('[SecureStorage] 加密失败:', err);
    return false;
  }
}

/**
 * 从 localStorage 读取并解密敏感值。
 *
 * @param key - localStorage 键名（不加前缀）
 * @returns 解密后的明文，失败返回 null
 */
export async function secureGet(key: string): Promise<string | null> {
  try {
    const cryptoKey = await getOrCreateKey();

    // IndexedDB 不可用 → 从 sessionStorage 读取
    if (!cryptoKey) {
      return sessionStorage.getItem(LS_PREFIX + key);
    }

    const encoded = localStorage.getItem(LS_PREFIX + key);
    if (!encoded) return null;

    // Base64 → IV + 密文
    const buffer = base64ToArrayBuffer(encoded);
    const iv = buffer.slice(0, 12);
    const ciphertext = buffer.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      cryptoKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (err) {
    console.error('[SecureStorage] 解密失败:', err);
    return null;
  }
}

/**
 * 删除安全存储中的指定键。
 */
export function secureRemove(key: string): void {
  try {
    localStorage.removeItem(LS_PREFIX + key);
    sessionStorage.removeItem(LS_PREFIX + key);
  } catch {
    // ignore
  }
}

/**
 * 迁移旧明文 Key 到安全存储。
 * 只执行一次：旧 Key 存在且新 Key 不存在时自动加密迁移。
 *
 * @param legacyKey - 旧的 localStorage 键名
 * @param secureKey - 新的安全存储键名（不加前缀）
 * @returns 是否执行了迁移
 */
export async function migrateLegacyKey(
  legacyKey: string,
  secureKey: string
): Promise<boolean> {
  try {
    const existingEncrypted = localStorage.getItem(LS_PREFIX + secureKey);
    if (existingEncrypted) return false; // 已有加密版本

    const legacyValue = localStorage.getItem(legacyKey);
    if (!legacyValue) return false; // 无旧值

    const success = await secureSet(secureKey, legacyValue);
    if (success) {
      // 迁移成功后不删除旧 Key（向后兼容），仅标记
      console.log(`[SecureStorage] 已迁移 "${legacyKey}" → "${secureKey}"`);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
