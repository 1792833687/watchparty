/**
 * 记忆引擎 (Memory Engine) — 公共导出
 */

// 类型
export type {
  EntityType,
  RelationType,
  EventType,
  EventTag,
  ImportanceLevel,
  CompressionMode,
  CompressedResult,
  MemoryEntity,
  Relation,
  ExtractedEntity,
  EventLogEntry,
  GraphMetadata,
  MemoryGraph,
  WorldStateDigest,
  KeyEventDigest,
  RelationDelta,
  UnresolvedHook,
  SessionMemory,
  MemoryRetrievalRequest,
  MemoryRetrievalResponse,
  MemoryEntitySnapshot,
  MemoryEngineConfig,
  IMemoryEngine,
} from './types';

export {
  ENTITY_TYPES,
  RELATION_TYPES,
  EVENT_TYPES,
  EVENT_TAGS,
  DEFAULT_MEMORY_ENGINE_CONFIG,
  serializeMap,
  deserializeMap,
  serializeGraph,
  deserializeGraph,
} from './types';

// 核心类
export { MemoryEngine } from './memory-engine';
export { RingBuffer } from './ring-buffer';
export { EntityExtractor } from './entity-extractor';
export { Compressor } from './compressor';
export { ContextRetriever } from './context-retriever';
export { StorageSync } from './storage-sync';
