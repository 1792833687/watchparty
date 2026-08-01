/**
 * 存档系统 (Save System) — 公共导出
 *
 * @see Epic 6
 */

// 类型
export type {
  SaveVersion,
  SaveSlotMeta,
  SaveData,
  PlayerSaveState,
  DialogueSaveState,
  UISaveState,
  SerializeOptions,
  DeserializeResult,
  SaveOperationResult,
  LoadOperationResult,
  StorageQuotaInfo,
} from './types';

export {
  CURRENT_SAVE_VERSION,
  saveVersionToString,
  parseSaveVersion,
  compareSaveVersion,
  MAX_SAVE_SLOTS,
  LOCALSTORAGE_QUOTA_BYTES,
  STORAGE_WARNING_THRESHOLD,
  STORAGE_CRITICAL_THRESHOLD,
  MAX_SAVE_SIZE_BYTES,
  AUTO_SAVE_INTERVAL_MS,
  SAVE_SLOT_KEY_PREFIX,
  SAVE_META_KEY_PREFIX,
  getSlotKey,
  getMetaKey,
} from './types';

// 核心类
export { SaveSerializer, saveSerializer, computeChecksum } from './save-serializer';
export { SaveManager, saveManager } from './save-manager';
export type { StoreAccessors, WorldStateGetter, DialogueStateGetter, UIStateGetter, MapStateGetter } from './save-manager';
