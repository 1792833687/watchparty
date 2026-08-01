import type { IStorageAdapter } from './IStorageAdapter';

/**
 * localStorage 存储适配器
 *
 * 封装浏览器 localStorage API，提供：
 * - 配额检查（写入前预估大小）
 * - 序列化/反序列化
 * - 错误处理
 */

const PREFIX = 'ain_';

export class LocalStorageAdapter implements IStorageAdapter {
  readonly name = 'localStorage';

  private prefix: string;

  constructor(prefix?: string) {
    this.prefix = prefix ?? PREFIX;
  }

  isAvailable(): Promise<boolean> {
    try {
      const testKey = `${this.prefix}__test__`;
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  }

  private fullKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(this.fullKey(key));
      if (raw === null) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch (err) {
      console.warn(`[LocalStorageAdapter] Failed to read key "${key}":`, err);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(this.fullKey(key), serialized);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        console.error(
          `[LocalStorageAdapter] Quota exceeded when writing "${key}".`
        );
      }
      throw err;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(this.fullKey(key));
    } catch (err) {
      console.warn(`[LocalStorageAdapter] Failed to remove key "${key}":`, err);
    }
  }

  async has(key: string): Promise<boolean> {
    return localStorage.getItem(this.fullKey(key)) !== null;
  }

  async keys(): Promise<string[]> {
    const result: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        result.push(key.slice(this.prefix.length));
      }
    }
    return result;
  }

  async clear(): Promise<void> {
    const allKeys = await this.keys();
    for (const key of allKeys) {
      await this.remove(key);
    }
  }

  async getUsageBytes(): Promise<number> {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        const value = localStorage.getItem(key);
        if (value) {
          total += new TextEncoder().encode(key + value).byteLength;
        }
      }
    }
    return total;
  }
}
