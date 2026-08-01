/**
 * @file 坐标系统单元测试 — MAP-UT-01
 * @description 测试等距投影转换、距离计算、邻域、边界检查等核心函数。
 */

import { describe, expect, it } from 'vitest';
import {
  isoToScreen,
  screenToIso,
  distance,
  euclideanDistance,
  isAdjacent,
  coordsEqual,
  coordsToKey,
  keyToCoords,
  getNeighbors,
  getCardinalNeighbors,
  isInBounds,
  getCoordsInRange,
  getRingCoords,
  lineCoords,
  pathBounds,
} from '@/systems/map/coordinates';
import type { TileCoord } from '@/systems/map/types';

// ============================================================
// MAP-UT-01: 等距投影转换
// ============================================================

describe('CoordinateUtils — 等距投影转换', () => {
  describe('isoToScreen', () => {
    it('原点 (0,0) 应映射到 (0,0)', () => {
      const result = isoToScreen({ col: 0, row: 0 });
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('(1,0) 应映射到 (64, 32)', () => {
      const result = isoToScreen({ col: 1, row: 0 });
      expect(result.x).toBe(64);
      expect(result.y).toBe(32);
    });

    it('(0,1) 应映射到 (-64, 32)', () => {
      const result = isoToScreen({ col: 0, row: 1 });
      expect(result.x).toBe(-64);
      expect(result.y).toBe(32);
    });

    it('(3,5) 应使用公式正确计算', () => {
      const result = isoToScreen({ col: 3, row: 5 });
      expect(result.x).toBe((3 - 5) * 64); // -128
      expect(result.y).toBe((3 + 5) * 32); // 256
    });

    it('应支持自定义图块尺寸', () => {
      const result = isoToScreen({ col: 2, row: 1 }, 200, 100);
      expect(result.x).toBe((2 - 1) * 100); // 100
      expect(result.y).toBe((2 + 1) * 50);  // 150
    });

    it('对称性：正负坐标应正确', () => {
      const a = isoToScreen({ col: 5, row: -3 });
      const b = isoToScreen({ col: -3, row: 5 });
      // (5 - (-3)) * 64 = 8*64 = 512, (-3 - 5) * 64 = -8*64 = -512
      expect(a.x).toBe(512);
      expect(b.x).toBe(-512);
      // y should be same for both since col+row = 2
      expect(a.y).toBe(64);
      expect(b.y).toBe(64);
    });
  });

  describe('screenToIso', () => {
    it('(0,0) 屏幕坐标应映射回原点', () => {
      const result = screenToIso(0, 0);
      expect(result.col).toBe(0);
      expect(result.row).toBe(0);
    });

    it('应正确逆向投影', () => {
      const original: TileCoord = { col: 3, row: 5 };
      const screen = isoToScreen(original);
      const back = screenToIso(screen.x, screen.y);
      expect(back.col).toBe(original.col);
      expect(back.row).toBe(original.row);
    });

    it('屏幕坐标 (0, 256) 应对应 (4, 4)', () => {
      // (0/64 + 256/32)/2 = (0+8)/2 = 4
      // (256/32 - 0/64)/2 = (8-0)/2 = 4
      const result = screenToIso(0, 256);
      expect(result.col).toBe(4);
      expect(result.row).toBe(4);
    });

    it('应 floor 到整数坐标', () => {
      const result = screenToIso(50, 50);
      expect(Number.isInteger(result.col)).toBe(true);
      expect(Number.isInteger(result.row)).toBe(true);
    });
  });

  describe('双向转换一致性', () => {
    it('正坐标 ↔ 屏幕 ↔ 坐标', () => {
      for (let col = 0; col < 10; col++) {
        for (let row = 0; row < 10; row++) {
          const orig: TileCoord = { col, row };
          const screen = isoToScreen(orig);
          const back = screenToIso(screen.x, screen.y);
          expect(back.col).toBe(orig.col);
          expect(back.row).toBe(orig.row);
        }
      }
    });

    it('负坐标 ↔ 屏幕 ↔ 坐标', () => {
      for (let col = -5; col <= 5; col++) {
        for (let row = -5; row <= 5; row++) {
          const orig: TileCoord = { col, row };
          const screen = isoToScreen(orig);
          const back = screenToIso(screen.x, screen.y);
          expect(back.col).toBe(orig.col);
          expect(back.row).toBe(orig.row);
        }
      }
    });
  });
});

// ============================================================
// 距离计算
// ============================================================

describe('CoordinateUtils — 距离计算', () => {
  describe('distance (切比雪夫)', () => {
    it('相同坐标距离为 0', () => {
      expect(distance({ col: 1, row: 1 }, { col: 1, row: 1 })).toBe(0);
    });

    it('相邻坐标距离为 1', () => {
      expect(distance({ col: 0, row: 0 }, { col: 1, row: 0 })).toBe(1);
      expect(distance({ col: 0, row: 0 }, { col: 0, row: 1 })).toBe(1);
      expect(distance({ col: 0, row: 0 }, { col: 1, row: 1 })).toBe(1);
    });

    it('对角线距离应使用 max(|Δcol|, |Δrow|)', () => {
      expect(distance({ col: 0, row: 0 }, { col: 5, row: 3 })).toBe(5);
      expect(distance({ col: 0, row: 0 }, { col: 3, row: 5 })).toBe(5);
    });

    it('负方向距离应正确', () => {
      expect(distance({ col: 5, row: 5 }, { col: 0, row: 0 })).toBe(5);
    });
  });

  describe('euclideanDistance', () => {
    it('应计算欧几里得距离', () => {
      const d = euclideanDistance({ col: 0, row: 0 }, { col: 3, row: 4 });
      expect(d).toBeCloseTo(5, 5);
    });
  });

  describe('isAdjacent', () => {
    it('相邻的 8 方向应返回 true', () => {
      expect(isAdjacent({ col: 0, row: 0 }, { col: 1, row: 0 })).toBe(true);
      expect(isAdjacent({ col: 0, row: 0 }, { col: 1, row: 1 })).toBe(true);
      expect(isAdjacent({ col: 0, row: 0 }, { col: -1, row: -1 })).toBe(true);
    });

    it('相同坐标应返回 false', () => {
      expect(isAdjacent({ col: 1, row: 1 }, { col: 1, row: 1 })).toBe(false);
    });

    it('不相邻坐标应返回 false', () => {
      expect(isAdjacent({ col: 0, row: 0 }, { col: 2, row: 0 })).toBe(false);
      expect(isAdjacent({ col: 0, row: 0 }, { col: 5, row: 5 })).toBe(false);
    });
  });
});

// ============================================================
// 坐标工具
// ============================================================

describe('CoordinateUtils — 坐标工具', () => {
  describe('coordsEqual', () => {
    it('相同坐标应返回 true', () => {
      expect(coordsEqual({ col: 1, row: 2 }, { col: 1, row: 2 })).toBe(true);
    });

    it('不同坐标应返回 false', () => {
      expect(coordsEqual({ col: 1, row: 2 }, { col: 2, row: 1 })).toBe(false);
    });
  });

  describe('coordsToKey / keyToCoords', () => {
    it('应正确序列化', () => {
      expect(coordsToKey({ col: 3, row: 5 })).toBe('3,5');
      expect(coordsToKey({ col: -1, row: 0 })).toBe('-1,0');
    });

    it('应正确反序列化', () => {
      expect(keyToCoords('3,5')).toEqual({ col: 3, row: 5 });
      expect(keyToCoords('-1,0')).toEqual({ col: -1, row: 0 });
    });

    it('应保持往返一致性', () => {
      const orig: TileCoord = { col: 42, row: -17 };
      expect(keyToCoords(coordsToKey(orig))).toEqual(orig);
    });
  });
});

// ============================================================
// 邻域
// ============================================================

describe('CoordinateUtils — 邻域', () => {
  describe('getNeighbors (8方向)', () => {
    it('应返回 8 个邻居', () => {
      const neighbors = getNeighbors({ col: 0, row: 0 });
      expect(neighbors.length).toBe(8);
    });

    it('应包含所有 8 个方向', () => {
      const neighbors = getNeighbors({ col: 5, row: 5 });
      const keys = new Set(neighbors.map(coordsToKey));
      expect(keys.has('4,4')).toBe(true); // NW
      expect(keys.has('4,5')).toBe(true); // W
      expect(keys.has('4,6')).toBe(true); // SW
      expect(keys.has('5,4')).toBe(true); // N
      expect(keys.has('5,6')).toBe(true); // S
      expect(keys.has('6,4')).toBe(true); // NE
      expect(keys.has('6,5')).toBe(true); // E
      expect(keys.has('6,6')).toBe(true); // SE
    });
  });

  describe('getCardinalNeighbors (4方向)', () => {
    it('应返回 4 个正交邻居', () => {
      const neighbors = getCardinalNeighbors({ col: 5, row: 5 });
      expect(neighbors.length).toBe(4);
      const keys = new Set(neighbors.map(coordsToKey));
      expect(keys.has('4,5')).toBe(true);
      expect(keys.has('6,5')).toBe(true);
      expect(keys.has('5,4')).toBe(true);
      expect(keys.has('5,6')).toBe(true);
    });
  });
});

// ============================================================
// 边界与范围
// ============================================================

describe('CoordinateUtils — 边界与范围', () => {
  describe('isInBounds', () => {
    const bounds = { minCol: 0, maxCol: 9, minRow: 0, maxRow: 9 };

    it('范围内坐标应返回 true', () => {
      expect(isInBounds({ col: 0, row: 0 }, bounds)).toBe(true);
      expect(isInBounds({ col: 9, row: 9 }, bounds)).toBe(true);
      expect(isInBounds({ col: 5, row: 5 }, bounds)).toBe(true);
    });

    it('范围外坐标应返回 false', () => {
      expect(isInBounds({ col: -1, row: 5 }, bounds)).toBe(false);
      expect(isInBounds({ col: 10, row: 5 }, bounds)).toBe(false);
      expect(isInBounds({ col: 5, row: -1 }, bounds)).toBe(false);
    });
  });

  describe('getCoordsInRange', () => {
    it('range=1 应返回 9 个坐标（含中心）', () => {
      const coords = getCoordsInRange({ col: 0, row: 0 }, 1);
      expect(coords.length).toBe(9);
    });

    it('range=2 应返回 25 个坐标', () => {
      const coords = getCoordsInRange({ col: 0, row: 0 }, 2);
      expect(coords.length).toBe(25);
    });

    it('所有坐标应在指定范围内', () => {
      const center: TileCoord = { col: 10, row: 10 };
      const coords = getCoordsInRange(center, 3);
      for (const c of coords) {
        expect(distance(center, c)).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('getRingCoords', () => {
    it('range=0 应只返回中心点', () => {
      const ring = getRingCoords({ col: 5, row: 5 }, 0);
      expect(ring).toEqual([{ col: 5, row: 5 }]);
    });

    it('range=1 应返回 8 个边界坐标', () => {
      const ring = getRingCoords({ col: 0, row: 0 }, 1);
      expect(ring.length).toBe(8);
      for (const c of ring) {
        expect(distance({ col: 0, row: 0 }, c)).toBe(1);
      }
    });

    it('range<0 应返回空数组', () => {
      expect(getRingCoords({ col: 0, row: 0 }, -1)).toEqual([]);
    });
  });
});

// ============================================================
// Bresenham 直线
// ============================================================

describe('CoordinateUtils — lineCoords (Bresenham)', () => {
  it('应包含起点和终点', () => {
    const line = lineCoords({ col: 0, row: 0 }, { col: 5, row: 5 });
    expect(coordsEqual(line[0]!, { col: 0, row: 0 })).toBe(true);
    expect(coordsEqual(line[line.length - 1]!, { col: 5, row: 5 })).toBe(true);
  });

  it('水平直线应步进正确', () => {
    const line = lineCoords({ col: 0, row: 0 }, { col: 5, row: 0 });
    expect(line.length).toBe(6);
    for (let i = 0; i < 6; i++) {
      expect(line[i]!.col).toBe(i);
      expect(line[i]!.row).toBe(0);
    }
  });

  it('垂直直线应步进正确', () => {
    const line = lineCoords({ col: 0, row: 0 }, { col: 0, row: 5 });
    expect(line.length).toBe(6);
    for (let i = 0; i < 6; i++) {
      expect(line[i]!.col).toBe(0);
      expect(line[i]!.row).toBe(i);
    }
  });

  it('对角线应包含对角路径', () => {
    const line = lineCoords({ col: 0, row: 0 }, { col: 3, row: 3 });
    // Bresenham 在等格对角线应该生成 4 个点
    expect(line.length).toBe(4);
  });
});

// ============================================================
// pathBounds
// ============================================================

describe('CoordinateUtils — pathBounds', () => {
  it('空路径应返回零值边界', () => {
    const bounds = pathBounds([]);
    expect(bounds).toEqual({ minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 });
  });

  it('应正确计算路径包围盒', () => {
    const path: TileCoord[] = [
      { col: 1, row: 5 },
      { col: 10, row: 2 },
      { col: 3, row: 8 },
    ];
    const bounds = pathBounds(path);
    expect(bounds.minCol).toBe(1);
    expect(bounds.maxCol).toBe(10);
    expect(bounds.minRow).toBe(2);
    expect(bounds.maxRow).toBe(8);
  });
});
