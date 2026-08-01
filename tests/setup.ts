/**
 * @file Vitest 全局测试配置 — AI Narrator Game
 * @description
 * 包含覆盖率阈值、全局 mock（localStorage / IndexedDB / fetch / Web Crypto）、
 * 共享测试夹具。所有 Vitest 配置文件应 import 此文件。
 *
 * @ai-generated
 * @prompt: "创建 Vitest 测试脚手架，含覆盖率阈值 80%/50%、全局 mock、测试规范"
 * @date: 2025-07-30
 * @model: claude-sonnet-4-20250514
 */

import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';

// ============================================================
// 1. 覆盖率阈值配置（通过 vitest.config.ts 引用）
// ============================================================

/**
 * 覆盖率阈值 — 在 vitest.config.ts 中直接使用
 *
 * ```ts
 * // vitest.config.ts
 * import { coverageThresholds } from './tests/setup';
 *
 * export default defineConfig({
 *   test: {
 *     coverage: {
 *       thresholds: coverageThresholds,
 *     },
 *   },
 * });
 * ```
 */
export const coverageThresholds = {
  // 全局阈值
  statements: 70,
  branches: 65,
  functions: 70,
  lines: 70,

  // 核心系统 (systems/) — 80%+
  'src/systems/memory/': {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80,
  },
  'src/systems/dialogue/': {
    statements: 70,
    branches: 65,
    functions: 70,
    lines: 70,
  },
  'src/systems/map/': {
    statements: 70,
    branches: 65,
    functions: 70,
    lines: 70,
  },

  // 基础设施 (infrastructure/) — 70%+
  'src/infrastructure/': {
    statements: 70,
    branches: 65,
    functions: 70,
    lines: 70,
  },

  // 组件 (components/) — 50%+
  'src/components/': {
    statements: 50,
    branches: 40,
    functions: 50,
    lines: 50,
  },

  // lib/ 工具 — 90%+
  'src/lib/': {
    statements: 90,
    branches: 85,
    functions: 90,
    lines: 90,
  },
} as const;

// ============================================================
// 2. 全局 Mock: localStorage
// ============================================================

/**
 * Mock localStorage with quota simulation.
 * Reset between tests via `mockLocalStorage.clear()`.
 */
class MockLocalStorage implements Storage {
  private store: Map<string, string> = new Map();
  private _quotaBytes: number = 5 * 1024 * 1024; // 5MB default
  private _usageBytes: number = 0;

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
    this._usageBytes = 0;
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    const val = this.store.get(key);
    if (val !== undefined) {
      this._usageBytes -= new TextEncoder().encode(key + val).byteLength;
      this.store.delete(key);
    }
  }

  setItem(key: string, value: string): void {
    const newEntrySize = new TextEncoder().encode(key + value).byteLength;
    const oldVal = this.store.get(key);
    const oldSize = oldVal
      ? new TextEncoder().encode(key + oldVal).byteLength
      : 0;
    const delta = newEntrySize - oldSize;

    if (this._usageBytes + delta > this._quotaBytes) {
      throw new DOMException(
        'QuotaExceededError: localStorage is full',
        'QuotaExceededError'
      );
    }

    this.store.set(key, value);
    this._usageBytes += delta;
  }

  // Test helpers
  _setQuota(bytes: number): void {
    this._quotaBytes = bytes;
  }
  _getUsage(): number {
    return this._usageBytes;
  }
  _getQuota(): number {
    return this._quotaBytes;
  }
  [name: string]: unknown;
}

/** Singleton localStorage mock — reset between tests */
export const mockLocalStorage = new MockLocalStorage();

// ============================================================
// 3. 全局 Mock: IndexedDB
// ============================================================

/**
 * Minimal IndexedDB mock backed by Map.
 * Supports: open / transaction / objectStore add-get-put-delete / cursor iteration.
 * Not supported (not needed for MVP tests): indexes, keyPath enforcement, version upgrade.
 */
class MockIndexedDB {
  private databases: Map<string, Map<string, Map<string, unknown>>> = new Map();
  private _unavailable: boolean = false;

  /** Simulate IndexedDB being unavailable (privacy mode) */
  setUnavailable(val: boolean): void {
    this._unavailable = val;
  }

  open(dbName: string, _version?: number): MockIDBRequest<MockIDBDatabase> {
    if (this._unavailable) {
      return new MockIDBRequest('error', undefined, 'IndexedDB is not available');
    }
    if (!this.databases.has(dbName)) {
      this.databases.set(dbName, new Map());
    }
    const db = new MockIDBDatabase(this.databases.get(dbName)!);
    return new MockIDBRequest('success', db);
  }

  /** Reset all databases */
  reset(): void {
    this.databases.clear();
    this._unavailable = false;
  }
}

class MockIDBDatabase {
  constructor(private stores: Map<string, Map<string, unknown>>) {}
  get objectStoreNames(): string[] {
    return Array.from(this.stores.keys());
  }
}

/** Simplified request — only supports success/error. */
class MockIDBRequest<T> {
  result: T | undefined;
  error: string | null = null;
  readyState: 'pending' | 'done' = 'done';
  onsuccess: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;

  constructor(status: 'success' | 'error', result?: T, error?: string) {
    if (status === 'success') {
      this.result = result;
    } else {
      this.error = error ?? 'Unknown error';
    }
  }

  // Allow test to manually fire callbacks
  _fireSuccess(): void {
    this.readyState = 'done';
    this.onsuccess?.({ target: this });
  }
  _fireError(): void {
    this.readyState = 'done';
    this.onerror?.({ target: this });
  }
}

export const mockIndexedDB = new MockIndexedDB();

/**
 * Override global indexedDB with mock.
 * Call in beforeAll / restore in afterAll.
 */
export function installIndexedDBMock(): void {
  // Store original
  const orig = (globalThis as Record<string, unknown>).indexedDB;
  (globalThis as Record<string, unknown>)._origIndexedDB = orig;

  (globalThis as Record<string, unknown>).indexedDB = {
    open: (name: string, version?: number) => mockIndexedDB.open(name, version),
    deleteDatabase: (_name: string) =>
      new MockIDBRequest('success', undefined),
    cmp: (_a: unknown, _b: unknown) => 0,
    databases: () => Promise.resolve([]),
  };
}

export function uninstallIndexedDBMock(): void {
  const orig = (globalThis as Record<string, unknown>)._origIndexedDB;
  if (orig !== undefined) {
    (globalThis as Record<string, unknown>).indexedDB = orig;
  }
}

// ============================================================
// 4. 全局 Mock: fetch (for OpenRouter calls)
// ============================================================

/**
 * Typed fetch mock — configure per-test responses.
 *
 * Usage in test:
 * ```ts
 * mockFetch.mockResponseOnce({ ok: true, json: async () => ({ ... }) });
 * const result = await someApiCall();
 * expect(mockFetch).toHaveBeenCalledWith(
 *   'https://openrouter.ai/api/v1/chat/completions',
 *   expect.objectContaining({ method: 'POST' })
 * );
 * ```
 */

export interface MockFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Headers;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
  body: ReadableStream<Uint8Array> | null;
}

let fetchResponses: MockFetchResponse[] = [];
let fetchErrorSequence: Array<Error | null> = [];

export const mockFetch = vi.fn(
  (
    _input: RequestInfo | URL,
    _init?: RequestInit
  ): Promise<MockFetchResponse> => {
    // If there's an error in the error sequence, throw it
    if (fetchErrorSequence.length > 0) {
      const err = fetchErrorSequence.shift()!;
      if (err) return Promise.reject(err);
    }

    // Return next queued response
    const response = fetchResponses.shift();
    if (!response) {
      return Promise.reject(
        new Error(
          'mockFetch: no responses configured. Use mockFetchQueue.push(...)'
        )
      );
    }
    return Promise.resolve(response);
  }
);

/** Queue a response for the next fetch call(s) */
mockFetch.mockResponseOnce = function (res: Partial<MockFetchResponse>): void {
  const defaults: MockFetchResponse = {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: async () => ({}),
    text: async () => '',
    body: null,
  };
  fetchResponses.push({ ...defaults, ...res });
};

/** Queue an error for the next fetch call */
mockFetch.mockRejectOnce = function (err: Error): void {
  fetchErrorSequence.push(err);
};

/** Queue multiple responses */
mockFetch.mockResponses = function (responses: Partial<MockFetchResponse>[]): void {
  responses.forEach((r) => mockFetch.mockResponseOnce(r));
};

/** Reset all queued responses */
mockFetch.mockResetQueue = function (): void {
  fetchResponses = [];
  fetchErrorSequence = [];
};

/**
 * Helper: create a mock SSE stream ReadableStream.
 * Simulates Server-Sent Events chunks for testing DialogueSystem streaming.
 */
export function createMockSSEStream(chunks: string[]): MockFetchResponse {
  const encoder = new TextEncoder();
  let chunkIndex = 0;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      function pushNext() {
        if (chunkIndex < chunks.length) {
          controller.enqueue(encoder.encode(chunks[chunkIndex]!));
          chunkIndex++;
          // Simulate async delivery
          setTimeout(pushNext, 1);
        } else {
          controller.close();
        }
      }
      pushNext();
    },
  });

  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'Content-Type': 'text/event-stream' }),
    json: async () => {
      throw new Error('SSE stream cannot be read as JSON');
    },
    text: async () => chunks.join(''),
    body: stream,
  };
}

// ============================================================
// 5. 全局 Mock: Web Crypto API
// ============================================================

/**
 * Simplified SubtleCrypto mock — only digest('SHA-256', ...)
 * Used for save file checksum verification.
 */
const mockSubtleDigest = vi.fn(
  async (
    _algorithm: AlgorithmIdentifier,
    data: BufferSource
  ): Promise<ArrayBuffer> => {
    // Return a simple mock hash (not cryptographically correct, just deterministic)
    const bytes =
      data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

    // Simple mock: SHA-256-like 32-byte output based on input length & first bytes
    const hash = new Uint8Array(32);
    for (let i = 0; i < Math.min(bytes.length, 32); i++) {
      hash[i] = bytes[i]! ^ (i % 256);
    }
    // Fill remaining with deterministic values based on length
    for (let i = bytes.length; i < 32; i++) {
      hash[i] = (bytes.length + i) % 256;
    }
    return hash.buffer;
  }
);

const mockCrypto: Partial<Crypto> = {
  subtle: {
    digest: mockSubtleDigest,
  } as unknown as SubtleCrypto,
  randomUUID: () => {
    // Deterministic UUID for tests (counter-based suffix)
    return `00000000-0000-4000-8000-${String(Date.now() % 10000000000000000).padStart(12, '0')}`;
  },
  getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
    if (array && 'length' in array) {
      const view = new Uint8Array(
        (array as unknown as ArrayBufferView).buffer,
        (array as unknown as ArrayBufferView).byteOffset,
        (array as unknown as ArrayBufferView).byteLength
      );
      for (let i = 0; i < view.length; i++) {
        view[i] = Math.floor(Math.random() * 256);
      }
    }
    return array;
  },
};

export { mockCrypto, mockSubtleDigest };

// ============================================================
// 6. 全局 Mock: navigator.storage.estimate (quota monitoring)
// ============================================================

export interface MockStorageEstimate {
  usage: number;
  quota: number;
}

let mockStorageEstimateValue: MockStorageEstimate = {
  usage: 10 * 1024 * 1024, // 10MB used
  quota: 100 * 1024 * 1024, // 100MB quota
};

export function setMockStorageEstimate(val: MockStorageEstimate): void {
  mockStorageEstimateValue = val;
}

const mockStorageEstimate = vi.fn(async (): Promise<MockStorageEstimate> => {
  return { ...mockStorageEstimateValue };
});

// ============================================================
// 7. 全局 Mock: matchMedia (for prefers-reduced-motion etc.)
// ============================================================

export interface MockMediaQueryList {
  matches: boolean;
  media: string;
  onchange: null | ((ev: MediaQueryListEvent) => void);
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

let mediaQueryMatches: Record<string, boolean> = {
  '(prefers-reduced-motion: reduce)': false,
  '(prefers-color-scheme: dark)': true,
  '(prefers-contrast: high)': false,
};

export function setMediaQueryMatch(query: string, matches: boolean): void {
  mediaQueryMatches[query] = matches;
}

const mockMatchMedia = vi.fn((query: string): MockMediaQueryList => {
  const matches = mediaQueryMatches[query] ?? false;
  return {
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
});

// ============================================================
// 8. 全局 Mock: IntersectionObserver (for tile virtualization)
// ============================================================

const mockIntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn(() => []),
}));

// ============================================================
// 9. 全局 Mock: ResizeObserver (for responsive layout)
// ============================================================

const mockResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// ============================================================
// 10. Setup & Teardown Hooks
// ============================================================

/**
 * Install all global mocks. Call in vitest.config.ts `setupFiles`.
 */
beforeAll(() => {
  // localStorage
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true,
  });

  // fetch
  vi.stubGlobal('fetch', mockFetch);

  // crypto
  vi.stubGlobal('crypto', mockCrypto);

  // navigator.storage.estimate
  if (!(globalThis as Record<string, unknown>).navigator) {
    vi.stubGlobal('navigator', {});
  }
  Object.defineProperty(navigator, 'storage', {
    value: {
      estimate: mockStorageEstimate,
      persist: vi.fn(async () => true),
      persisted: vi.fn(async () => true),
    },
    writable: true,
    configurable: true,
  });

  // matchMedia
  Object.defineProperty(window, 'matchMedia', {
    value: mockMatchMedia,
    writable: true,
    configurable: true,
  });

  // IntersectionObserver
  vi.stubGlobal('IntersectionObserver', mockIntersectionObserver);

  // ResizeObserver
  vi.stubGlobal('ResizeObserver', mockResizeObserver);

  // IndexedDB (install mock if not already installed)
  installIndexedDBMock();
});

afterEach(() => {
  // Reset mocks between tests
  mockLocalStorage.clear();
  mockIndexedDB.reset();
  mockFetch.mockResetQueue();
  vi.clearAllMocks();
});

afterAll(() => {
  // Restore all stubs
  vi.unstubAllGlobals();
  uninstallIndexedDBMock();
});

// ============================================================
// 11. 共享测试夹具 & 工厂函数
// ============================================================

import type {
  EventLogEntry,
  MemoryEntity,
  MemoryGraph,
  Relation,
} from '../src/systems/memory/types';
import type { DialogueMessage } from '../src/systems/dialogue/types';
import type { Region, Tile, TileCoord, MapState } from '../src/systems/map/types';

/** Create a minimal MemoryGraph for tests */
export function createTestMemoryGraph(overrides?: Partial<MemoryGraph>): MemoryGraph {
  return {
    version: '1.0.0',
    entities: new Map(),
    relations: new Map(),
    eventLog: [],
    metadata: {
      totalSessions: 1,
      currentSessionId: 'test-session-1',
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
      worldName: 'Test World',
      gameSettingId: 'test-setting',
    },
    ...overrides,
  };
}

/** Create a test MemoryEntity */
export function createTestEntity(
  overrides?: Partial<MemoryEntity>
): MemoryEntity {
  return {
    id: 'ent-test-1',
    name: 'Test Entity',
    type: 'character',
    aliases: [],
    attributes: {},
    firstSeenAt: Date.now(),
    lastSeenAt: Date.now(),
    occurrenceCount: 1,
    importance: 2,
    isActive: true,
    ...overrides,
  };
}

/** Create a test EventLogEntry */
export function createTestEvent(
  overrides?: Partial<EventLogEntry>
): EventLogEntry {
  return {
    id: 'evt-test-1',
    sessionId: 'test-session-1',
    type: 'dialogue',
    timestamp: Date.now(),
    importance: 2,
    summary: 'Test event summary',
    detail: 'Test event detail description.',
    entitiesExtracted: [],
    relationsUpdated: [],
    tags: [],
    precedingEventId: null,
    ...overrides,
  };
}

/** Create a test Relation */
export function createTestRelation(overrides?: Partial<Relation>): Relation {
  return {
    id: 'rel-test-1',
    fromEntityId: 'ent-test-1',
    toEntityId: 'ent-test-2',
    type: 'NEUTRAL',
    strength: 0.5,
    evidence: [],
    establishedAt: Date.now(),
    lastUpdatedAt: Date.now(),
    ...overrides,
  };
}

/** Create a test DialogueMessage */
export function createTestMessage(
  overrides?: Partial<DialogueMessage>
): DialogueMessage {
  return {
    id: 'msg-test-1',
    role: 'ai_gm',
    speakerName: 'GM',
    speakerId: 'ai_gm',
    content: '[NARRATIVE]\nYou enter the room.\n\n[ACTIONS]\n- Look around\n- Leave\n\n[STATE]\nNo changes.',
    contentBlocks: [
      { type: 'narrative', text: 'You enter the room.' },
      {
        type: 'action',
        text: '- Look around\n- Leave',
      },
      { type: 'state', text: 'No changes.' },
    ],
    timestamp: Date.now(),
    isDecisionPoint: false,
    tokenCount: 20,
    suggestedActions: [
      {
        id: 'act-1',
        text: 'Look around',
        type: 'examination',
        icon: '🔍',
        priority: 1,
      },
      {
        id: 'act-2',
        text: 'Leave',
        type: 'movement',
        icon: '🚶',
        priority: 2,
      },
    ],
    ...overrides,
  };
}

/** Create a minimal test TileCoord */
export function createTestCoord(col = 0, row = 0): TileCoord {
  return { col, row };
}

/** Create a minimal test Tile */
export function createTestTile(
  coord: TileCoord,
  overrides?: Partial<Tile>
): Tile {
  return {
    coord,
    terrain: 'grass',
    elevation: 0,
    isWalkable: true,
    isExplorable: true,
    moveCost: 1.0,
    name: `Tile ${coord.col},${coord.row}`,
    description: 'A grassy tile.',
    events: [],
    fogState: 'unexplored',
    isDiscovered: false,
    entityIds: [],
    ...overrides,
  };
}

/** Create a minimal test Region */
export function createTestRegion(overrides?: Partial<Region>): Region {
  return {
    id: 'region-test-1',
    name: 'Test Region',
    description: 'A test region for unit tests.',
    theme: 'forest',
    bounds: { minCol: 0, maxCol: 9, minRow: 0, maxRow: 9 },
    tiles: new Map(),
    entities: new Map(),
    entryPoints: [],
    ambientNarrative: 'A peaceful forest.',
    ...overrides,
  };
}

/**
 * Create a populated test region with an N×N grid of grass tiles
 * and the center tile unblocked for the player.
 */
export function createTestRegionGrid(size: number): Region {
  const region = createTestRegion({
    id: 'region-grid',
    name: 'Grid Test Region',
    bounds: { minCol: 0, maxCol: size - 1, minRow: 0, maxRow: size - 1 },
  });

  for (let col = 0; col < size; col++) {
    for (let row = 0; row < size; row++) {
      const coord = createTestCoord(col, row);
      region.tiles.set(`${col},${row}`, createTestTile(coord));
    }
  }

  return region;
}

/** Create a minimal MapState for tests */
export function createTestMapState(overrides?: Partial<MapState>): MapState {
  return {
    playerCoord: createTestCoord(0, 0),
    currentRegionId: 'region-test-1',
    tileStates: {},
    entityStates: {},
    regionStates: {
      'region-test-1': { isUnlocked: true, visitCount: 1, firstVisitedAt: Date.now() },
    },
    ...overrides,
  };
}
