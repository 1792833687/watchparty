/**
 * Settings Loader Unit Tests — Epic 7 Story 7.6
 *
 * Tests for JSON/YAML loading, validation, and built-in presets.
 */

import { describe, expect, it } from 'vitest';
import {
  loadFromJSON,
  loadFromYAML,
  validate,
  getBuiltInPreset,
  listBuiltInPresets,
  FROSTHOLD_PRESET,
} from '@/systems/settings/settings-loader';

// ============================================================
// Test fixture: minimal valid setting JSON
// ============================================================

const MINIMAL_VALID_JSON = JSON.stringify({
  id: 'test-world',
  name: 'Test World',
  version: '1.0.0',
  worldMeta: {
    name: 'Test Realm',
    genre: 'fantasy',
    tone: 'adventure',
    description: 'A test world for testing.',
  },
});

// ============================================================
// loadFromJSON
// ============================================================

describe('loadFromJSON', () => {
  it('should parse a minimal valid JSON setting', () => {
    const setting = loadFromJSON(MINIMAL_VALID_JSON);
    expect(setting.id).toBe('test-world');
    expect(setting.name).toBe('Test World');
    expect(setting.version).toBe('1.0.0');
    expect(setting.worldMeta.name).toBe('Test Realm');
    expect(setting.worldMeta.genre).toBe('fantasy');
    expect(setting.worldMeta.tone).toBe('adventure');
    expect(setting.worldMeta.description).toBe('A test world for testing.');
  });

  it('should parse a full setting with optional fields', () => {
    const json = JSON.stringify({
      id: 'full-world',
      name: 'Full World',
      version: '2.0.0',
      worldMeta: {
        name: 'Full Realm',
        genre: 'scifi',
        tone: 'dark',
        description: 'A complete world.',
        tags: ['space', 'aliens'],
        languageHints: 'Use technical language.',
      },
      playerOptions: {
        availableClasses: [
          {
            id: 'pilot',
            name: 'Pilot',
            description: 'A skilled pilot.',
            baseAttributes: { hp: 80, mp: 40 },
            startingEquipment: ['laser pistol'],
          },
        ],
        attributeNames: ['hp', 'mp', 'tech'],
        characterCreationPrompt: 'Who are you?',
      },
      startingLocation: {
        regionId: 'space-station',
        description: 'A space station.',
        openingNarrative: 'You wake up on a space station...',
      },
      worldRules: [
        {
          id: 'wr-gravity',
          name: 'Artificial Gravity',
          description: 'All stations have gravity.',
          priority: 10,
          category: 'lore',
        },
      ],
      npcs: [
        {
          id: 'npc-bot',
          name: 'Bot-7',
          role: 'Maintenance Bot',
          description: 'A helpful robot.',
        },
      ],
      regions: [
        {
          id: 'space-station',
          name: 'Orbital Station Alpha',
          description: 'Main hub.',
          theme: 'station',
        },
      ],
      initialHook: 'Find the missing crew.',
    });

    const setting = loadFromJSON(json);
    expect(setting.playerOptions?.availableClasses).toHaveLength(1);
    expect(setting.playerOptions?.availableClasses[0]?.id).toBe('pilot');
    expect(setting.startingLocation?.regionId).toBe('space-station');
    expect(setting.worldRules).toHaveLength(1);
    expect(setting.npcs).toHaveLength(1);
    expect(setting.regions).toHaveLength(1);
    expect(setting.initialHook).toBe('Find the missing crew.');
  });

  it('should throw on malformed JSON', () => {
    expect(() => loadFromJSON('not json {')).toThrow('JSON 解析失败');
  });

  it('should throw on non-object JSON', () => {
    expect(() => loadFromJSON('"just a string"')).toThrow('不是有效的游戏设定对象');
  });

  it('should throw on array JSON', () => {
    expect(() => loadFromJSON('[1, 2, 3]')).toThrow('不是有效的游戏设定对象');
  });

  it('should fill defaults for missing worldMeta fields', () => {
    const json = JSON.stringify({
      id: 'minimal',
      name: 'Minimal',
      version: '1.0.0',
      worldMeta: {},
    });
    const setting = loadFromJSON(json);
    expect(setting.worldMeta.name).toBe('Unknown World');
    expect(setting.worldMeta.genre).toBe('fantasy');
    expect(setting.worldMeta.tone).toBe('neutral');
    expect(setting.worldMeta.description).toBe('');
  });
});

// ============================================================
// loadFromYAML
// ============================================================

describe('loadFromYAML', () => {
  it('should parse a minimal valid YAML setting', () => {
    const yaml = `
id: test-yaml-world
name: YAML World
version: 1.0.0
worldMeta:
  name: YAML Realm
  genre: horror
  tone: mysterious
  description: A yaml test world.
`;
    const setting = loadFromYAML(yaml);
    expect(setting.id).toBe('test-yaml-world');
    expect(setting.name).toBe('YAML World');
    expect(setting.worldMeta.name).toBe('YAML Realm');
    expect(setting.worldMeta.genre).toBe('horror');
  });

  it('should parse YAML with boolean and number values', () => {
    const yaml = `
id: bool-test
name: Bool Test
version: 1.0.0
worldMeta:
  name: Test
  genre: fantasy
  tone: epic
  description: Testing booleans.
worldRules:
  - id: wr-lore
    name: Test Rule
    description: A rule
    priority: 5
    category: lore
`;
    const setting = loadFromYAML(yaml);
    expect(setting.worldRules?.[0]?.priority).toBe(5);
    expect(setting.worldRules?.[0]?.category).toBe('lore');
  });

  it('should handle YAML comments', () => {
    const yaml = `
# This is a comment
id: comment-test
name: Comment Test
version: 1.0.0
worldMeta:
  name: Comment World
  genre: fantasy
  tone: neutral
  description: With comments. # inline comment
`;
    const setting = loadFromYAML(yaml);
    expect(setting.id).toBe('comment-test');
    expect(setting.worldMeta.description).toContain('With comments');
  });

  it('should throw on empty YAML', () => {
    expect(() => loadFromYAML('')).toThrow();
  });
});

// ============================================================
// validate
// ============================================================

describe('validate', () => {
  it('should return valid for a complete setting', () => {
    const setting = loadFromJSON(MINIMAL_VALID_JSON);
    const result = validate(setting);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject non-object input', () => {
    const result = validate(null);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === '$')).toBe(true);
  });

  it('should report missing required fields', () => {
    const result = validate({});
    expect(result.valid).toBe(false);
    expect(result.errors.filter((e) => e.severity === 'error').length).toBeGreaterThan(0);
  });

  it('should report missing worldMeta fields', () => {
    const result = validate({
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      worldMeta: { name: 'N' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'worldMeta.genre')).toBe(true);
    expect(result.errors.some((e) => e.field === 'worldMeta.tone')).toBe(true);
    expect(result.errors.some((e) => e.field === 'worldMeta.description')).toBe(true);
  });

  it('should warn on non-array npcs', () => {
    const result = validate({
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      worldMeta: {
        name: 'N',
        genre: 'fantasy',
        tone: 'neutral',
        description: 'D',
      },
      npcs: 'not-an-array',
    });
    expect(result.valid).toBe(true); // warning, not error
    expect(result.errors.some((e) => e.severity === 'warning')).toBe(true);
  });

  it('should error on non-array worldRules', () => {
    const result = validate({
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      worldMeta: {
        name: 'N',
        genre: 'fantasy',
        tone: 'neutral',
        description: 'D',
      },
      worldRules: 'not-an-array',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'worldRules')).toBe(true);
  });

  it('should validate type of top-level string fields', () => {
    const result = validate({
      id: 123,
      name: 456,
      version: true,
      worldMeta: {
        name: 'N',
        genre: 'fantasy',
        tone: 'neutral',
        description: 'D',
      },
    });
    expect(result.valid).toBe(false);
  });
});

// ============================================================
// Built-in Presets
// ============================================================

describe('Built-in Presets', () => {
  it('should have at least one preset', () => {
    const presets = listBuiltInPresets();
    expect(presets.length).toBeGreaterThanOrEqual(1);
  });

  // v2.0.0: 单一世界凛冬要塞（Frosthold）— fantasy-adventure 已合并移除
  it('should retrieve frosthold preset', () => {
    const preset = getBuiltInPreset('frosthold');
    expect(preset).not.toBeNull();
    expect(preset!.id).toBe('preset-frosthold');
    expect(preset!.worldMeta.name).toContain('凛冬要塞');
  });

  it('should return null for unknown preset', () => {
    const preset = getBuiltInPreset('non-existent');
    expect(preset).toBeNull();
  });

  it('FROSTHOLD_PRESET should pass validation', () => {
    const result = validate(FROSTHOLD_PRESET);
    expect(result.valid).toBe(true);
  });

  it('FROSTHOLD_PRESET should have required world data', () => {
    const preset = FROSTHOLD_PRESET;
    expect(preset.worldMeta.name).toBeTruthy();
    expect(preset.worldMeta.genre).toBeTruthy();
    expect(preset.worldMeta.description).toBeTruthy();
    expect(preset.playerOptions).toBeDefined();
    expect(preset.playerOptions!.availableClasses.length).toBeGreaterThanOrEqual(3);
    // v4.1.0: 成本制初始点数上限
    expect(preset.playerOptions!.totalAttributePoints).toBeGreaterThanOrEqual(24);
  });

  it('FROSTHOLD_PRESET should have NPCs, companions and regions', () => {
    const preset = FROSTHOLD_PRESET;
    expect(preset.companions?.length).toBeGreaterThanOrEqual(5);
    expect(preset.mapRegionsV2?.length).toBeGreaterThanOrEqual(6);
    expect(preset.factions?.length).toBeGreaterThanOrEqual(4);
    expect(preset.skillCategories?.length).toBeGreaterThanOrEqual(7);
  });

  it('FROSTHOLD_PRESET should have opening narrative', () => {
    expect(FROSTHOLD_PRESET.startingLocation?.openingNarrative).toBeTruthy();
    expect(FROSTHOLD_PRESET.startingLocation?.openingNarrative.length).toBeGreaterThan(50);
  });

  // v4.1.0: 世界书/领地/结局 系统数据校验
  it('FROSTHOLD_PRESET should have 艾拉 companion (v4.1.0)', () => {
    const aila = FROSTHOLD_PRESET.companions?.find((c) => c.id === 'aila');
    expect(aila).toBeDefined();
    expect(aila?.appearance).toBeTruthy();
  });
});
