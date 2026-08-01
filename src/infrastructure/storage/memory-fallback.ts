import type { IStorageAdapter } from './IStorageAdapter';

/**
 * 纯内存存储适配器（兜底降级模式）
 *
 * 当 IndexedDB 和 localStorage 均不可用时使用。
 * 数据仅存在于当前页面生命周期——刷新即丢失。
 * 用于隐私浏览模式或浏览器存储完全禁用的情况。
 */

export class MemoryFallbackAdapter implements IStorageAdapter {
  readonly name = 'memory';

  private store: Map<string, unknown> = new Map();

  isAvailable(): Promise<boolean> {
    // 内存模式总是可用
    return Promise.resolve(true);
  }

  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async getUsageBytes(): Promise<number> {
    let total = 0;
    for (const [key, value] of this.store.entries()) {
      total += new TextEncoder().encode(key + JSON.stringify(value)).byteLength;
    }
    return total;
  }
}
