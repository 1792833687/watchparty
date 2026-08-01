/**
 * Settings System — Barrel exports
 * @module systems/settings
 */

export * from './types';
export {
  loadFromJSON,
  loadFromYAML,
  validate,
  getBuiltInPreset,
  listBuiltInPresets,
  FROSTHOLD_PRESET,
  BUILT_IN_PRESETS,
  GAME_SETTING_TEMPLATES,
} from './settings-loader';
export { generateSetting, buildPromptSuggestion } from './ai-generator';
