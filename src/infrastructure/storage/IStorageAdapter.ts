/**
 * 统一存储适配器接口
 * 所有存储后端（IndexedDB / localStorage / Memory）必须实现此接口
 */

export interface IStorageAdapter {
  /** 后端名称（用于日志） */
  readonly name: string;

  /** 检查此后端是否可用 */
  isAvailable(): Promise<boolean>;

  /** 读取键 */
  get<T>(key: string): Promise<T | null>;

  /** 写入键 */
  set<T>(key: string, value: T): Promise<void>;

  /** 删除键 */
  remove(key: string): Promise<void>;

  /** 检查键是否存在 */
  has(key: string): Promise<boolean>;

  /** 列出所有键 */
  keys(): Promise<string[]>;

  /** 清空所有数据 */
  clear(): Promise<void>;

  /** 获取当前存储使用量（bytes），不支持返回 -1 */
  getUsageBytes(): Promise<number>;
}
