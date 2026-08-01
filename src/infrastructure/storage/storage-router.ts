import type { IStorageAdapter } from './IStorageAdapter';
import { IndexedDBAdapter } from './indexeddb-adapter';
import { LocalStorageAdapter } from './localstorage-adapter';
import { MemoryFallbackAdapter } from './memory-fallback';

/**
 * 存储路由 — 三级降级：IndexedDB → localStorage → Memory
 *
 * 用法：
 * ```ts
 * const storage = await StorageRouter.getAdapter();
 * await storage.set('key', value);
 * ```
 *
 * 降级日志通过 console.warn 输出，帮助开发者排查存储环境问题。
 */

export type StorageBackend = 'indexeddb' | 'localstorage' | 'memory';

export class StorageRouter {
  private static adapter: IStorageAdapter | null = null;
  private static backend: StorageBackend | null = null;

  /**
   * 获取当前最佳存储适配器（自动降级）。
   * 结果缓存——同一页面生命周期内不会重新检测。
   */
  static async getAdapter(): Promise<IStorageAdapter> {
    if (this.adapter) {
      return this.adapter;
    }

    // 1. 尝试 IndexedDB
    const indexedDB = new IndexedDBAdapter();
    if (await indexedDB.isAvailable()) {
      this.adapter = indexedDB;
      this.backend = 'indexeddb';
      return this.adapter;
    }

    // 2. 降级到 localStorage
    console.warn('[StorageRouter] IndexedDB 不可用，降级到 localStorage');
    const localStorage = new LocalStorageAdapter();
    if (await localStorage.isAvailable()) {
      this.adapter = localStorage;
      this.backend = 'localstorage';
      return this.adapter;
    }

    // 3. 内存模式（隐私浏览/极端情况）
    console.warn(
      '[StorageRouter] 持久化存储不可用，使用内存模式。数据将在页面刷新后丢失。'
    );
    const memory = new MemoryFallbackAdapter();
    this.adapter = memory;
    this.backend = 'memory';
    return this.adapter;
  }

  /** 获取当前使用的后端名称 */
  static getBackend(): StorageBackend | null {
    return this.backend;
  }

  /** 重置适配器（测试用） */
  static reset(): void {
    this.adapter = null;
    this.backend = null;
  }
}
