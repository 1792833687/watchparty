/**
 * Game Setting Type Definitions — AI Narrator Game
 *
 * Corresponds to Epic 7 Story 7.1 and concept M07 (game setting loading).
 * Extends the base GameSetting from WorldStore with full world configuration.
 *
 * @module systems/settings/types
 */

// ============================================================
// World Meta
// ============================================================

/** World metadata defining the core thematic and tonal parameters */
export interface WorldMeta {
  name: string;
  genre: string;
  tone: string;
  description: string;
  /** Optional: thematic tags for AI context injection */
  tags?: string[];
  /** Optional: world-specific language/style hints */
  languageHints?: string;
}

// ============================================================
// Player Options
// ============================================================

/** A playable character class/template definition */
export interface PlayerClass {
  id: string;
  name: string;
  description: string;
  /** Starting attributes for this class */
  baseAttributes: Record<string, number>;
  /** Optional: starting equipment descriptions */
  startingEquipment?: string[];
}

/** Player configuration options from the game setting */
export interface PlayerOptions {
  /** Available character classes */
  availableClasses: PlayerClass[];
  /** Player attribute names (e.g. HP, MP, Strength, etc.) */
  attributeNames: string[];
  /** Custom starting prompt for character creation */
  characterCreationPrompt?: string;
  /** Total points for attribute allocation (default 15) */
  totalAttributePoints?: number;
}

// ============================================================
// World Rules
// ============================================================

/** A world rule that constrains or guides AI GM behavior */
export interface WorldRule {
  id: string;
  name: string;
  description: string;
  /** Priority: higher = more important for AI to follow */
  priority: number;
  /** Optional: category for grouping */
  category?: 'combat' | 'magic' | 'social' | 'economy' | 'lore' | 'other';
}

/** Starting location configuration */
export interface StartingLocation {
  regionId: string;
  description: string;
  /** Initial narrative hook presented to the player */
  openingNarrative: string;
}

// ============================================================
// NPC & Region Definitions (for world builder)
// ============================================================

/** NPC definition within a game setting */
export interface SettingNPC {
  id: string;
  name: string;
  role: string;
  description: string;
  location?: string;
  /** Optional: faction/personality hints for AI */
  personality?: string;
}

/** Region definition within a game setting */
export interface SettingRegion {
  id: string;
  name: string;
  description: string;
  theme: string;
  /** Optional: NPCs that start in this region */
  npcIds?: string[];
}

// ============================================================
// World Profile (v0.9.0 — Universal World Building)
// ============================================================

/** A faction/force within the world */
export interface WorldFaction {
  id: string;
  name: string;
  description: string;
  /** Default attitude toward the player */
  attitude: 'hostile' | 'neutral' | 'friendly';
  /** Power level 1-10 */
  power: number;
  /** Territory description */
  territory: string;
}

/** Complete world-building profile */
export interface WorldProfile {
  // ── Core metadata ──
  name: string;
  genre: string;
  tone: string;
  /** One-line summary */
  tagline: string;

  // ── Era & environment ──
  era: string; // 古代/中世纪/近代/现代/近未来/远未来/架空
  geography: string; // 草原/海洋/沙漠/森林/城市/混合/其他
  climate: string; // 温带/热带/寒带/干旱/多变

  // ── Social structure ──
  /** Tech level 1-10 (1=primitive, 10=god-tier) */
  techLevel: number;
  /** Magic level 0-10 (0=no magic, 10=magic-dominated) */
  magicLevel: number;
  governance: string; // 部落/封建/帝国/共和/无政府/神权/其他

  // ── Races & factions ──
  races: string[];
  factions: WorldFaction[];

  // ── History & current state ──
  keyEvents: string[];
  /** Current major conflict */
  currentConflict: string;
  /** Hidden secrets/truths */
  secrets: string[];

  // ── Narrative style ──
  narrationStyle: 'descriptive' | 'minimal' | 'cinematic';
  /** Danger level 1-10 */
  dangerLevel: number;
  /** Mystery level 1-10 */
  mysteryLevel: number;
}

// ============================================================
// Theme-Adaptive Types (v1.1.0)
// ============================================================

/** A character class definition for a specific world theme */
export interface ClassInfo {
  id: string;
  name: string;
  desc: string;
  icon?: string;
}

/** An attribute definition for a specific world theme */
export interface AttributeInfo {
  id: string;
  label: string;
  desc: string;
  /** v3.0.0: 英文缩写，如 STR / DEX */
  abbr?: string;
  /** v3.0.0: 该属性对游戏体验的具体影响清单 */
  effects?: string[];
  /** v3.0.0: 数值调整值的换算说明 */
  formula?: string;
  /** v3.0.0: 低值时的负面表现，帮助玩家理解取舍 */
  lowValueWarning?: string;
}

/** A single skill node */
export interface SkillInfo {
  name: string;
  desc: string;
  cost: number;
  /** v3.0.0: 层级，1 为入门，数值越高越靠后，用于迷雾解锁判定 */
  tier?: number;
  /** v3.0.0: 使用该技能增加的堕落值 */
  corruption?: number;
  /** v3.0.0: 未解锁时展示的迷雾提示文本 */
  fogHint?: string;
  /** v4.1.0: 法术等级（world-setting 4.2：戏法/1环~5环） */
  spellLevel?: 'cantrip' | 1 | 2 | 3 | 4 | 5;
  /** v4.1.0: 施法魔力消耗 */
  mpCost?: number;
  /** v4.1.0: 学派类型：magic=魔法学派 / martial=武技 / divine=圣职神术 */
  category?: 'magic' | 'martial' | 'divine';
}

/** A skill category grouping related skills */
export interface SkillCategory {
  name: string;
  skills: SkillInfo[];
  /** v3.0.0: 学派简介 */
  desc?: string;
  /** v3.0.0: 学派图标 */
  icon?: string;
  /** v3.0.0: 该学派是否会累积堕落值 */
  darkSchool?: boolean;
}

/** A starting item definition */
export interface StartingItem {
  name: string;
  type: string;
  desc: string;
}

/** A map region definition */
export interface MapRegionDef {
  name: string;
  desc: string;
  connections: string[];
}

// ============================================================
// v2.0.0 Extended Types — Frosthold World
// ============================================================

/** Character origin — influences starting attributes and skills. */
export interface OriginInfo {
  id: string;
  name: string;
  desc: string;
  attrMods?: Partial<Record<string, number>>;
  /** v3.0.0: 属性加成的文字摘要，如「力量+2 魅力+1」 */
  attrSummary?: string;
  /** v3.0.0: 擅长技能领域 */
  expertise?: string[];
  /** v3.0.0: 该出身带来的具体游戏后果与影响 */
  consequences?: string[];
  /** v3.0.0: 起始装备 */
  startingGear?: string[];
  /** v3.0.0: 起始金币差异 */
  startingGold?: number;
}

/** Character background story — influences hidden traits and personal storyline. */
export interface BackgroundInfo {
  id: string;
  name: string;
  desc: string;
  hiddenTrait?: string;
  /** v3.0.0: 该过往带来的具体剧情后果与影响 */
  consequences?: string[];
  /** v3.0.0: 专属开场剧情钩子 */
  storyHook?: string;
  /** v3.0.0: 起始阵营态度倾向 */
  factionBias?: string;
  /** v3.0.0: 起始堕落值修正 */
  corruptionMod?: number;
}

/** Companion character in the adventurer party. */
export interface CompanionInfo {
  id: string;
  name: string;
  race: string;
  role: string;
  coreBelief: string;
  conflict: string;
  /** v4.1.0: 外貌速写（revealLevel >= 1 可见） */
  appearance?: string;
  /** v4.1.0: 对话提示（AI 角色扮演参考） */
  dialogueHints?: string[];
}

/** School of magic (7 schools in Frosthold). */
export interface MagicSchoolInfo {
  name: string;
  desc: string;
  spells: string[];
  consumesMP: boolean;
  addsCorruption?: boolean;
}

/** Item rarity tiers. */
export type ItemRarity = 'common' | 'fine' | 'rare' | 'epic' | 'legendary';

/** Map region with danger level for Frosthold. */
export interface MapRegionV2 {
  name: string;
  desc: string;
  dangerLevel: string;    // 'safe' | 'alert' | 'danger' | 'deadly'
  connections: string[];
}

/** Faction / realm standing. */
export interface FactionInfo {
  id: string;
  name: string;
  leader: string;
  stance: string;
  attitudeToShadow: string;
}

/** Damage types for Frosthold combat. */
export type DamageType = 'slashing' | 'piercing' | 'bludgeoning' | 'fire' | 'ice' | 'lightning' | 'holy' | 'shadow';


// ============================================================
// Full Game Setting
// ============================================================

/**
 * Complete GameSetting interface.
 * Extends the base interface from WorldStore with all optional
 * world-builder fields. The `worldMeta` field is required (matching
 * the base interface) and all other fields are optional.
 *
 * v1.1.0: Added theme-adaptive fields (classes, attributes,
 * skillCategories, startingItems, mapRegions, forbiddenTerms).
 */
export interface GameSetting {
  id: string;
  name: string;
  version: string;
  worldMeta: WorldMeta;
  /** Optional: player creation options */
  playerOptions?: PlayerOptions;
  /** Optional: starting location configuration */
  startingLocation?: StartingLocation;
  /** Optional: world rules that constrain AI GM */
  worldRules?: WorldRule[];
  /** Optional: NPC definitions */
  npcs?: SettingNPC[];
  /** Optional: region definitions */
  regions?: SettingRegion[];
  /** Optional: initial narrative hook summary */
  initialHook?: string;
  /** Optional: creation metadata */
  createdAt?: string;
  createdBy?: 'preset' | 'import' | 'ai-generated';
  /** v0.9.0: World-building profile */
  worldProfile?: WorldProfile;
  /** v0.9.0: Builder version for compatibility tracking */
  worldBuilderVersion?: string;
  /** v1.1.0: Theme-adaptive character classes */
  classes?: ClassInfo[];
  /** v1.1.0: Theme-adaptive attributes */
  attributes?: AttributeInfo[];
  /** v1.1.0: Theme-adaptive skill categories */
  skillCategories?: SkillCategory[];
  /** v1.1.0: Theme-adaptive starting items */
  startingItems?: StartingItem[];
  /** v1.1.0: Theme-adaptive map regions */
  mapRegions?: MapRegionDef[];
  /** v1.1.0: Terms forbidden in this world (AI prompt constraint) */
  forbiddenTerms?: string[];
  // ---- v2.0.0 Frosthold fields ----
  /** Character origins (6 options). */
  origins?: OriginInfo[];
  /** Character backgrounds (4 options). */
  backgrounds?: BackgroundInfo[];
  /** Initial companions (up to 5). */
  companions?: CompanionInfo[];
  /** Schools of magic (7 schools). */
  magicSchools?: MagicSchoolInfo[];
  /** Faction standings (6 factions). */
  factions?: FactionInfo[];
  /** Map regions with danger levels (6 regions). */
  mapRegionsV2?: MapRegionV2[];
  /** UI color scheme. */
  colorScheme?: Record<string, string>;

}

// ============================================================
// Preset Templates
// ============================================================

/**
 * Pre-built game setting template identifiers.
 * v3.0.0: merged into a single world — "凛冬要塞" (Frosthold),
 * named directly after the game itself.
 */
export type GameSettingTemplateId = 'frosthold';

/** Template metadata for display */
export interface GameSettingTemplate {
  id: GameSettingTemplateId;
  name: string;
  description: string;
  genre: string;
  tone: string;
  icon: string;
}

// ============================================================
// AI Generation
// ============================================================

/** Configuration for AI-powered game setting generation */
export interface AIGenerationConfig {
  /** User's prompt describing desired world */
  prompt: string;
  /** Temperature for generation (0.0-2.0) */
  temperature: number;
  /** Model to use for generation */
  model: string;
  /** API key for OpenRouter */
  apiKey: string;
  /** Maximum tokens for the generation response */
  maxTokens?: number;
}

/** Result of AI generation attempt */
export interface AIGenerationResult {
  success: boolean;
  setting?: GameSetting;
  rawOutput?: string;
  error?: string;
  validationErrors?: ValidationError[];
}

// ============================================================
// Module Builder Types
// ============================================================

/** A single module option within a category */
export interface ModuleOption {
  id: string;
  name: string;
  description: string;
  icon: string;
}

/** A module category for the builder */
export interface ModuleCategory {
  id: string;
  name: string;
  description: string;
  options: ModuleOption[];
}

/** User's module selections: categoryId → selected optionId */
export type ModuleSelection = Record<string, string>;

/** A compatibility rule between two module options */
export interface CompatibilityRule {
  /** Pair of category IDs that may conflict */
  categories: [string, string];
  /** Pairs of option IDs that conflict */
  conflicts: Array<[string, string]>;
  /** Warning message to show */
  message: string;
}

// ============================================================
// Custom Game (for listing / re-editing)
// ============================================================

/** A custom game record stored in localStorage */
export interface CustomGameRecord {
  id: string;
  name: string;
  createdBy: 'import' | 'module-build';
  createdAt: string;
  updatedAt: string;
  /** The generated game setting */
  setting: GameSetting;
  /** For text import: the original raw text */
  rawText?: string;
  /** For module build: the module selections */
  moduleSelection?: ModuleSelection;
}

// ============================================================
// Validation
// ============================================================

/** A single validation error */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/** Result of validating a game setting */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ============================================================
// Settings Panel State
// ============================================================

/** Steps in the settings configuration flow */
export type SettingsStep = 'source' | 'configure' | 'confirm';

/** Source of game setting */
export type SettingSource = 'preset' | 'import' | 'ai-generate' | null;
