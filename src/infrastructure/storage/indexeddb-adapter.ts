import type { IStorageAdapter } from './IStorageAdapter';
import { openDB, type IDBPDatabase } from 'idb';

/**
 * IndexedDB 存储适配器
 *
 * 使用 idb 库封装 IndexedDB，提供：
 * - 异步读写
 * - 自动创建数据库和对象存储
 * - 错误降级标记
 */

const DB_NAME = 'ai-narrator-game';
const STORE_NAME = 'key-value-store';
const DB_VERSION = 1;

export class IndexedDBAdapter implements IStorageAdapter {
  readonly name = 'indexeddb';

  private dbPromise: Promise<IDBPDatabase> | null = null;
  private _unavailable = false;

  private getDB(): Promise<IDBPDatabase> {
    if (this._unavailable) {
      return Promise.reject(new Error('[IndexedDBAdapter] Storage unavailable'));
    }

    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        },
      }).catch((err) => {
        console.warn('[IndexedDBAdapter] Failed to open database:', err);
        this._unavailable = true;
        this.dbPromise = null;
        throw err;
      });
    }

    return this.dbPromise;
  }

  async isAvailable(): Promise<boolean> {
    if (this._unavailable) {
      return false;
    }
    if (!('indexedDB' in globalThis)) {
      return false;
    }
    try {
      const db = await this.getDB();
      await db.count(STORE_NAME);
      return true;
    } catch {
      this._unavailable = true;
      return false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const db = await this.getDB();
      const result = await db.get(STORE_NAME, key);
      return (result as T) ?? null;
    } catch (err) {
      // FIX: ERR-3 — 区分 key 不存在和数据库错误
      if (err instanceof DOMException || (err as Error)?.name === 'NotFoundError') {
        console.warn(`[IndexedDBAdapter] Key "${key}" not found.`);
      } else {
        console.error(`[IndexedDBAdapter] Failed to read key "${key}":`, err);
      }
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const db = await this.getDB();
      await db.put(STORE_NAME, value, key);
    } catch (err) {
      console.error(`[IndexedDBAdapter] Failed to write key "${key}":`, err);
      throw err;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      await db.delete(STORE_NAME, key);
    } catch (err) {
      console.warn(`[IndexedDBAdapter] Failed to remove key "${key}":`, err);
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const db = await this.getDB();
      const value = await db.get(STORE_NAME, key);
      return value !== undefined;
    } catch {
      return false;
    }
  }

  async keys(): Promise<string[]> {
    try {
      const db = await this.getDB();
      const keys = await db.getAllKeys(STORE_NAME);
      return keys.map((k) => String(k));
    } catch {
      return [];
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.getDB();
      await db.clear(STORE_NAME);
    } catch (err) {
      console.warn('[IndexedDBAdapter] Failed to clear store:', err);
    }
  }

  async getUsageBytes(): Promise<number> {
    try {
      // IndexedDB 不直接暴露单条记录大小，估算法
      const db = await this.getDB();
      const allKeys = await db.getAllKeys(STORE_NAME);
      let total = 0;
      for (const key of allKeys) {
        const value = await db.get(STORE_NAME, key);
        if (value !== undefined) {
          total += new TextEncoder().encode(
            String(key) + JSON.stringify(value)
          ).byteLength;
        }
      }
      return total;
    } catch {
      return -1;
    }
  }
}
