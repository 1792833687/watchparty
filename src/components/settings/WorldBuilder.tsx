/**
 * WorldBuilder Component — AI Narrator Game v0.9.0
 *
 * Universal world-building UI with 6 accordion sections.
 * Converts a WorldProfile into a complete GameSetting for use in the game.
 *
 * @module components/settings/WorldBuilder
 */

'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import type { GameSetting, WorldProfile, WorldFaction, PlayerClass } from '@/systems/settings/types';

// ============================================================
// Types
// ============================================================

interface WorldBuilderProps {
  initialProfile?: Partial<WorldProfile>;
  onSave: (setting: GameSetting) => void;
  onClose: () => void;
}

type SectionId = 'basic' | 'environment' | 'society' | 'factions' | 'history' | 'narrative';

// ============================================================
// Default profile
// ============================================================

function defaultProfile(): WorldProfile {
  return {
    name: '',
    genre: '',
    tone: '',
    tagline: '',
    era: '中世纪',
    geography: '混合',
    climate: '温带',
    techLevel: 5,
    magicLevel: 5,
    governance: '封建',
    races: ['人类'],
    factions: [],
    keyEvents: [],
    currentConflict: '',
    secrets: [],
    narrationStyle: 'descriptive',
    dangerLevel: 5,
    mysteryLevel: 5,
  };
}

// ============================================================
// Class generation based on techLevel + magicLevel
// ============================================================

function generateClasses(techLevel: number, magicLevel: number): PlayerClass[] {
  const classes: PlayerClass[] = [];
  const bp = { attributeNames: ['strength', 'agility', 'intelligence', 'constitution', 'charisma'], totalAttributePoints: 15 };

  // Always have a fighter type
  const fighterType = techLevel >= 7 ? '士兵' : '战士';
  classes.push({
    id: 'warrior',
    name: fighterType,
    description: techLevel >= 7 ? '现代战斗训练' : '近战专精',
    baseAttributes: { strength: 5, agility: 3, intelligence: 2, constitution: 5, charisma: 2 },
  });

  // Magic classes if magicLevel > 0
  if (magicLevel > 0) {
    const mageName = magicLevel >= 7 ? '大法师' : '法师';
    classes.push({
      id: 'mage',
      name: mageName,
      description: magicLevel >= 7 ? '掌控强大魔力' : '秘法之力',
      baseAttributes: { strength: 2, agility: 3, intelligence: 5, constitution: 2, charisma: 3 },
    });
    if (magicLevel >= 4) {
      classes.push({
        id: 'cleric',
        name: '祭司',
        description: '神圣治愈',
        baseAttributes: { strength: 3, agility: 2, intelligence: 4, constitution: 3, charisma: 4 },
      });
    }
  }

  // Tech classes
  if (techLevel >= 5) {
    classes.push({
      id: 'rogue',
      name: techLevel >= 7 ? '特工' : '盗贼',
      description: techLevel >= 7 ? '潜入与情报' : '暗影作战',
      baseAttributes: { strength: 2, agility: 5, intelligence: 4, constitution: 2, charisma: 2 },
    });
  }
  if (techLevel >= 6) {
    classes.push({
      id: 'engineer',
      name: '工程师',
      description: '修复与建造',
      baseAttributes: { strength: 3, agility: 3, intelligence: 5, constitution: 3, charisma: 2 },
    });
  }

  // Ranged class
  const rangedName = techLevel >= 6 ? '狙击手' : '游侠';
  classes.push({
    id: 'ranger',
    name: rangedName,
    description: techLevel >= 6 ? '远程精确打击' : '弓箭与自然',
    baseAttributes: { strength: 3, agility: 5, intelligence: 3, constitution: 3, charisma: 3 },
  });

  return classes.slice(0, 6);
}

// ============================================================
// Opening narrative generation
// ============================================================

function generateOpeningNarrative(profile: WorldProfile): string {
  const eraTemplates: Record<string, string[]> = {
    '古代': [
      '晨曦穿透薄雾，古老的城墙在光线中显出斑驳的轮廓。你站在驿道岔口，马蹄印还新鲜——前方是未知的命运。',
    ],
    '中世纪': [
      '酒馆火炉噼啪作响，麦酒味弥漫在空气中。你坐在角落，指尖摩挲着悬赏令粗糙的羊皮纸。门外的冷风吹动了烛火，你的冒险开始了。',
    ],
    '近代': [
      '蒸汽机的轰鸣声从工厂区传来，煤烟遮蔽了半边天空。你站在街道拐角，手中的电报还带着墨香——这个世界正在巨变。',
    ],
    '现代': [
      '霓虹灯在雨夜中闪烁，窗外车流形成一条光河。你看着手机屏幕上的消息，咖啡已经凉了——有些事必须去面对。',
    ],
    '近未来': [
      '全息广告牌在头顶闪烁，无人机从楼顶掠过。你戴上增强现实眼镜，数据流在视野边缘脉动——系统已为你规划好路线。',
    ],
    '远未来': [
      '应急红光在走廊里脉动。你是紧急系统唤醒的第47号人员。走廊空无一人。终端显示：船上只有12个人还活着。',
    ],
    '架空': [
      '世界树的光芒在夜空中流转，你从冥想中醒来。身上的伤疤在隐隐作痛——上一次战斗的记忆还未消散。',
    ],
  };

  const geoHints: Record<string, string> = {
    '草原': '远处风吹草低，成群的生物在平原上移动。',
    '海洋': '海浪拍打礁石，咸腥的海风扑面而来。',
    '沙漠': '烈日当空，黄沙一望无际。',
    '森林': '斑驳的光影穿过树冠，四周是古老的参天巨木。',
    '城市': '街道在夜色中延伸，灯光勾勒出城市的轮廓。',
    '混合': '多样的地形在你面前展开——森林、平原与山川交错。',
    '太空': '舷窗外是无尽的星海，舱内的空气循环器发出低沉的嗡鸣。',
    '其他': '',
  };

  const conflictHints: string[] = profile.currentConflict
    ? [`${profile.currentConflict}的阴影笼罩在这片土地上。`]
    : [];

  let narrative = eraTemplates[profile.era]?.[0]
    ?? '你睁开双眼，意识到自己身处一个陌生的世界。未知的冒险正在等待。';

  if (geoHints[profile.geography]) {
    narrative += ' ' + geoHints[profile.geography];
  }
  if (conflictHints.length > 0) {
    narrative += ' ' + conflictHints[0];
  }

  return narrative;
}

// ============================================================
// buildGameSetting — WorldProfile → GameSetting
// ============================================================

export function buildGameSetting(profile: WorldProfile): GameSetting {
  const id = `custom-${Date.now()}`;
  const classes = generateClasses(profile.techLevel, profile.magicLevel);
  const narrative = generateOpeningNarrative(profile);
  const dangerDesc = profile.dangerLevel >= 8 ? '致命危险' : profile.dangerLevel >= 5 ? '中等风险' : '较为安全';

  return {
    id,
    name: profile.name || '自定义世界',
    version: '1.0.0',
    worldBuilderVersion: '1.0.0',
    worldMeta: {
      name: profile.name || '未命名世界',
      genre: profile.genre || '自定义',
      tone: profile.tone || '未知',
      description: `${profile.tagline} ${profile.era}时代，${profile.geography}地貌，${dangerDesc}。${profile.currentConflict ? `主要冲突：${profile.currentConflict}。` : ''}`,
      tags: [profile.era, profile.geography, profile.governance, profile.narrationStyle],
      languageHints: profile.narrationStyle === 'cinematic' ? '使用电影化的视觉描述' : profile.narrationStyle === 'minimal' ? '简洁直接' : undefined,
    },
    playerOptions: {
      availableClasses: classes,
      attributeNames: ['strength', 'agility', 'intelligence', 'constitution', 'charisma'],
      totalAttributePoints: 15,
    },
    startingLocation: {
      regionId: 'start',
      description: `起始区域——${profile.geography}地貌`,
      openingNarrative: narrative,
    },
    worldRules: profile.races.length > 1
      ? [{ id: 'multi-race', name: '多种族共存', description: `本世界存在${profile.races.join('、')}等多个种族。`, priority: 3, category: 'lore' }]
      : [],
    worldProfile: profile,
    createdAt: new Date().toISOString(),
    createdBy: 'import',
  };
}

// ============================================================
// Section config
// ============================================================

interface SectionConfig {
  id: SectionId;
  label: string;
  icon: string;
}

const SECTIONS: SectionConfig[] = [
  { id: 'basic', label: '基本信息', icon: '📝' },
  { id: 'environment', label: '环境设定', icon: '🌍' },
  { id: 'society', label: '社会结构', icon: '🏛️' },
  { id: 'factions', label: '种族势力', icon: '👥' },
  { id: 'history', label: '历史事件', icon: '📜' },
  { id: 'narrative', label: '叙事风格', icon: '✍️' },
];

// ============================================================
// Preset options for dropdowns
// ============================================================

const ERA_OPTIONS = ['古代', '中世纪', '近代', '现代', '近未来', '远未来', '架空'];
const GEO_OPTIONS = ['草原', '海洋', '沙漠', '森林', '城市', '混合', '太空', '其他'];
const CLIMATE_OPTIONS = ['温带', '热带', '寒带', '干旱', '多变'];
const GOV_OPTIONS = ['部落', '封建', '帝国', '共和', '无政府', '神权', '其他'];
const RACE_OPTIONS = ['人类', '精灵', '矮人', '兽人', '龙裔', '机器人', '外星人', '亡灵', '半兽人', '侏儒'];
const STYLE_OPTIONS: Array<WorldProfile['narrationStyle']> = ['descriptive', 'minimal', 'cinematic'];
const STYLE_LABELS: Record<string, string> = {
  descriptive: '描述性 — 丰富感官细节',
  minimal: '极简 — 简洁直接',
  cinematic: '电影化 — 视觉震撼',
};

// ============================================================
// Styles
// ============================================================

const S = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    width: '90vw',
    maxWidth: 720,
    maxHeight: '90vh',
    background: '#18161A',
    borderRadius: 12,
    border: '1px solid #2A272C',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 1.25rem',
    borderBottom: '1px solid #2A272C',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '1.0625rem',
    fontWeight: 700,
    color: '#C9A94E',
    margin: 0,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#8B8278',
    cursor: 'pointer',
    fontSize: '1.25rem',
    padding: '0.25rem 0.5rem',
    borderRadius: 4,
  },
  body: {
    flex: 1,
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  // Tabs
  tabRow: {
    display: 'flex',
    gap: 0,
    borderBottom: '1px solid #2A272C',
    overflowX: 'auto' as const,
    flexShrink: 0,
    padding: '0 0.75rem',
  },
  tab: {
    padding: '0.625rem 0.875rem',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#8B8278',
    fontSize: '0.8125rem',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'color 0.15s, border-color 0.15s',
  },
  tabActive: {
    color: '#C9A94E',
    borderBottomColor: '#C9A94E',
  },
  // Panel content
  panel: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '1.25rem',
  },
  // Form fields
  fieldGroup: {
    marginBottom: '0.875rem',
  },
  label: {
    display: 'block',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#A09888',
    marginBottom: '0.375rem',
  },
  input: {
    width: '100%',
    padding: '0.5rem 0.75rem',
    borderRadius: 6,
    border: '1px solid #2A272C',
    background: '#1A181C',
    color: '#E8E0D5',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    padding: '0.5rem 0.75rem',
    borderRadius: 6,
    border: '1px solid #2A272C',
    background: '#1A181C',
    color: '#E8E0D5',
    fontSize: '0.875rem',
    outline: 'none',
    resize: 'vertical' as const,
    minHeight: 64,
    boxSizing: 'border-box' as const,
  },
  select: {
    width: '100%',
    padding: '0.5rem 0.75rem',
    borderRadius: 6,
    border: '1px solid #2A272C',
    background: '#1A181C',
    color: '#E8E0D5',
    fontSize: '0.875rem',
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box' as const,
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  slider: {
    flex: 1,
    accentColor: '#C9A94E',
  },
  sliderValue: {
    minWidth: 24,
    textAlign: 'center' as const,
    color: '#C9A94E',
    fontSize: '0.875rem',
    fontWeight: 600,
  },
  // Faction card
  factionCard: {
    padding: '0.75rem',
    borderRadius: 8,
    background: 'rgba(26,24,28,0.6)',
    border: '1px solid #2A272C',
    marginBottom: '0.625rem',
  },
  factionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
  },
  factionName: {
    fontWeight: 600,
    color: '#E8E0D5',
    fontSize: '0.875rem',
  },
  // Tags (for races, events, secrets)
  tagContainer: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.375rem',
    marginTop: '0.375rem',
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.25rem 0.5rem',
    borderRadius: 4,
    background: 'rgba(201,169,78,0.1)',
    color: '#C9A94E',
    fontSize: '0.75rem',
    border: '1px solid rgba(201,169,78,0.2)',
  },
  tagRemove: {
    background: 'transparent',
    border: 'none',
    color: '#DC5050',
    cursor: 'pointer',
    fontSize: '0.75rem',
    padding: 0,
    lineHeight: 1,
  },
  // Buttons
  btnRow: {
    display: 'flex',
    gap: '0.25rem',
    flexWrap: 'wrap' as const,
  },
  btnSmall: {
    padding: '0.25rem 0.625rem',
    borderRadius: 4,
    border: '1px solid #2A272C',
    background: '#1A181C',
    color: '#8B8278',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  btnSmallActive: {
    borderColor: '#C9A94E',
    color: '#C9A94E',
    background: 'rgba(201,169,78,0.1)',
  },
  // Footer
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.875rem 1.25rem',
    borderTop: '1px solid #2A272C',
    flexShrink: 0,
    gap: '0.5rem',
  },
  footerLeft: {
    display: 'flex',
    gap: '0.5rem',
  },
  footerRight: {
    display: 'flex',
    gap: '0.5rem',
  },
  btn: {
    padding: '0.5rem 1.25rem',
    borderRadius: 8,
    border: 'none',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnSecondary: {
    background: '#2A272C',
    color: '#E8E0D5',
  },
  btnPrimary: {
    background: '#C9A94E',
    color: '#0D0D12',
  },
  btnDanger: {
    background: 'transparent',
    color: '#DC5050',
    border: '1px solid rgba(220,80,80,0.3)',
  },
  // Preview
  previewSection: {
    marginTop: '1rem',
    padding: '0.75rem',
    borderRadius: 8,
    background: 'rgba(123,111,223,0.08)',
    border: '1px solid rgba(123,111,223,0.15)',
  },
  previewTitle: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#A098B8',
    marginBottom: '0.5rem',
    textTransform: 'uppercase' as const,
  },
  previewText: {
    fontSize: '0.8125rem',
    color: '#A098B8',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap' as const,
  },
  // Conflict warning
  conflictBanner: {
    padding: '0.5rem 0.75rem',
    borderRadius: 6,
    background: 'rgba(220,80,80,0.08)',
    border: '1px solid rgba(220,80,80,0.2)',
    color: '#E8A0A0',
    fontSize: '0.75rem',
    marginBottom: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
} as const;

// ============================================================
// Merge helpers (Phase 4)
// ============================================================

/** Field-level merge: imported values override defaults, manual edits override imports */
export function mergeProfiles(existing: WorldProfile, incoming: Partial<WorldProfile>, isManualEdit: boolean): { profile: WorldProfile; conflicts: string[] } {
  const conflicts: string[] = [];
  const result = { ...existing };

  for (const key of Object.keys(incoming) as Array<keyof WorldProfile>) {
    const newVal = incoming[key];
    const oldVal = existing[key];

    // Skip undefined incoming values
    if (newVal === undefined) continue;

    // Detect conflicts
    if (isManualEdit && oldVal !== undefined && JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
      conflicts.push(`"${key}" 被手动修改覆盖`);
    }

    if (Array.isArray(newVal) && Array.isArray(oldVal)) {
      // Merge arrays: deduplicate but keep unique items
      const merged = [...oldVal];
      for (const item of newVal) {
        const itemStr = typeof item === 'string' ? item : JSON.stringify(item);
        const exists = merged.some((m) => (typeof m === 'string' ? m : JSON.stringify(m)) === itemStr);
        if (!exists) merged.push(item);
      }
      (result as Record<string, unknown>)[key] = merged;
    } else {
      (result as Record<string, unknown>)[key] = newVal;
    }
  }

  return { profile: result, conflicts };
}

// ============================================================
// Component
// ============================================================

export default function WorldBuilder({ initialProfile, onSave, onClose }: WorldBuilderProps): React.ReactElement {
  const [activeSection, setActiveSection] = useState<SectionId>('basic');
  const [profile, setProfile] = useState<WorldProfile>(() => {
    if (initialProfile) {
      const merged = mergeProfiles(defaultProfile(), initialProfile, false);
      return merged.profile;
    }
    return defaultProfile();
  });
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive preview
  const previewSetting = useMemo(() => buildGameSetting(profile), [profile]);

  // ── Field updaters ──
  const update = useCallback(<K extends keyof WorldProfile>(key: K, value: WorldProfile[K]) => {
    setProfile((prev) => {
      const newProfile = { ...prev, [key]: value };
      // Track manual edits for conflict detection
      if (initialProfile) {
        const { conflicts } = mergeProfiles(
          { ...defaultProfile(), ...initialProfile },
          { [key]: value },
          JSON.stringify(value) !== JSON.stringify(initialProfile[key])
        );
        if (conflicts.length > 0) {
          setWarnings((w) => [...new Set([...w, ...conflicts])]);
        }
      }
      return newProfile;
    });
  }, [initialProfile]);

  const updateNumeric = useCallback(<K extends keyof WorldProfile>(key: K, value: string) => {
    const n = parseInt(value, 10);
    if (!isNaN(n)) update(key, n as WorldProfile[K]);
  }, [update]);

  // ── Array helpers ──
  const addToArray = useCallback(<K extends keyof WorldProfile>(key: K, item: string) => {
    if (!item.trim()) return;
    setProfile((prev) => {
      const arr = prev[key] as string[];
      if (arr.includes(item.trim())) return prev;
      return { ...prev, [key]: [...arr, item.trim()] };
    });
  }, []);

  const removeFromArray = useCallback(<K extends keyof WorldProfile>(key: K, index: number) => {
    setProfile((prev) => {
      const arr = [...(prev[key] as string[])];
      arr.splice(index, 1);
      return { ...prev, [key]: arr };
    });
  }, []);

  // ── Faction helpers ──
  const addFaction = useCallback(() => {
    const faction: WorldFaction = {
      id: `faction-${Date.now()}`,
      name: '新势力',
      description: '',
      attitude: 'neutral',
      power: 5,
      territory: '',
    };
    setProfile((prev) => ({ ...prev, factions: [...prev.factions, faction] }));
  }, []);

  const updateFaction = useCallback((index: number, field: keyof WorldFaction, value: string | number) => {
    setProfile((prev) => {
      const factions = prev.factions.map((f, i) => (i === index ? { ...f, [field]: value } : f));
      return { ...prev, factions };
    });
  }, []);

  const removeFaction = useCallback((index: number) => {
    setProfile((prev) => {
      const factions = prev.factions.filter((_, i) => i !== index);
      return { ...prev, factions };
    });
  }, []);

  // ── Import / Export ──
  const handleExportJSON = useCallback(() => {
    const json = JSON.stringify(profile, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `world-profile-${profile.name || 'untitled'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [profile]);

  const handleImportJSON = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = ev.target?.result as string;
        const imported = JSON.parse(json) as Partial<WorldProfile>;
        const { profile: merged, conflicts } = mergeProfiles(profile, imported, false);
        setProfile(merged);
        setWarnings(conflicts);
      } catch {
        setWarnings(['导入失败：JSON 格式无效']);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported
    e.target.value = '';
  }, [profile]);

  // ── Save ──
  const handleSave = useCallback(() => {
    const setting = buildGameSetting(profile);
    onSave(setting);
  }, [profile, onSave]);

  // ── Render section content ──
  const renderSection = (): React.ReactElement => {
    switch (activeSection) {
      case 'basic': return (
        <div style={S.panel}>
          <div style={S.fieldGroup}>
            <label style={S.label}>世界名称</label>
            <input style={S.input} value={profile.name} onChange={(e) => update('name', e.target.value)} placeholder="例如：艾尔德兰大陆" />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>流派/类型</label>
            <input style={S.input} value={profile.genre} onChange={(e) => update('genre', e.target.value)} placeholder="例如：奇幻/冒险" />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>基调</label>
            <input style={S.input} value={profile.tone} onChange={(e) => update('tone', e.target.value)} placeholder="例如：史诗/神秘" />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>一句话概括</label>
            <textarea style={S.textarea} value={profile.tagline} onChange={(e) => update('tagline', e.target.value)} placeholder="用一句话概括这个世界..." />
          </div>
        </div>
      );

      case 'environment': return (
        <div style={S.panel}>
          <div style={S.fieldGroup}>
            <label style={S.label}>时代</label>
            <select style={S.select} value={profile.era} onChange={(e) => update('era', e.target.value)}>
              {ERA_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>地理环境</label>
            <select style={S.select} value={profile.geography} onChange={(e) => update('geography', e.target.value)}>
              {GEO_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>气候</label>
            <div style={S.btnRow}>
              {CLIMATE_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => update('climate', c)}
                  style={{ ...S.btnSmall, ...(profile.climate === c ? S.btnSmallActive : {}) }}
                >{c}</button>
              ))}
            </div>
          </div>
        </div>
      );

      case 'society': return (
        <div style={S.panel}>
          <div style={S.fieldGroup}>
            <label style={S.label}>科技水平 ({profile.techLevel}/10)</label>
            <div style={S.sliderRow}>
              <span style={{ color: '#6B6258', fontSize: '0.75rem' }}>1</span>
              <input type="range" min={1} max={10} value={profile.techLevel} onChange={(e) => updateNumeric('techLevel', e.target.value)} style={S.slider} />
              <span style={{ color: '#6B6258', fontSize: '0.75rem' }}>10</span>
              <span style={S.sliderValue}>{profile.techLevel}</span>
            </div>
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>魔法水平 ({profile.magicLevel}/10)</label>
            <div style={S.sliderRow}>
              <span style={{ color: '#6B6258', fontSize: '0.75rem' }}>0</span>
              <input type="range" min={0} max={10} value={profile.magicLevel} onChange={(e) => updateNumeric('magicLevel', e.target.value)} style={S.slider} />
              <span style={{ color: '#6B6258', fontSize: '0.75rem' }}>10</span>
              <span style={S.sliderValue}>{profile.magicLevel}</span>
            </div>
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>政治体制</label>
            <select style={S.select} value={profile.governance} onChange={(e) => update('governance', e.target.value)}>
              {GOV_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          {/* Tech/magic summary */}
          <div style={S.previewSection}>
            <div style={S.previewTitle}>设定摘要</div>
            <div style={S.previewText}>
              {profile.techLevel >= 9 ? '神级科技文明，星系级旅行与量子计算是常态。' :
               profile.techLevel >= 7 ? '高度发达的科技文明，计算机和自动化普及。' :
               profile.techLevel >= 5 ? '中等科技水平，工业与机械技术为主。' :
               profile.techLevel >= 3 ? '早期科技，冶铁与基础机械出现。' :
               '原始技术，依靠自然与手工。'}
              {' '}
              {profile.magicLevel >= 8 ? '魔法主宰世界，强大的法术改变现实。' :
               profile.magicLevel >= 5 ? '魔法与科技并存，法术是日常生活的一部分。' :
               profile.magicLevel >= 2 ? '少数人掌握低阶魔法。' :
               '魔法不存在或被视为传说。'}
            </div>
          </div>
        </div>
      );

      case 'factions': return (
        <div style={S.panel}>
          {/* Races */}
          <div style={S.fieldGroup}>
            <label style={S.label}>种族</label>
            <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.5rem' }}>
              <select
                style={{ ...S.select, flex: 1 }}
                onChange={(e) => { if (e.target.value) { addToArray('races', e.target.value); e.target.value = ''; } }}
              >
                <option value="">添加种族...</option>
                {RACE_OPTIONS.filter((r) => !profile.races.includes(r)).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div style={S.tagContainer}>
              {profile.races.map((r, i) => (
                <span key={i} style={S.tag}>
                  {r}
                  <button onClick={() => removeFromArray('races', i)} style={S.tagRemove}>×</button>
                </span>
              ))}
            </div>
          </div>

          {/* Factions */}
          <div style={{ ...S.fieldGroup, marginTop: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label style={{ ...S.label, marginBottom: 0 }}>势力/派系</label>
              <button onClick={addFaction} style={{ ...S.btnSmall, borderColor: '#C9A94E', color: '#C9A94E' }}>+ 添加势力</button>
            </div>
            {profile.factions.length === 0 && (
              <div style={{ color: '#6B6258', fontSize: '0.8125rem', padding: '1rem 0', textAlign: 'center' }}>尚未添加势力</div>
            )}
            {profile.factions.map((f, i) => (
              <div key={f.id} style={S.factionCard}>
                <div style={S.factionHeader}>
                  <input
                    style={{ ...S.input, width: '50%' }}
                    value={f.name}
                    onChange={(e) => updateFaction(i, 'name', e.target.value)}
                    placeholder="势力名称"
                  />
                  <button onClick={() => removeFaction(i)} style={{ ...S.btnSmall, color: '#DC5050', borderColor: 'rgba(220,80,80,0.3)' }}>删除</button>
                </div>
                <textarea
                  style={{ ...S.textarea, marginBottom: '0.5rem', minHeight: 48 }}
                  value={f.description}
                  onChange={(e) => updateFaction(i, 'description', e.target.value)}
                  placeholder="势力描述..."
                />
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <label style={{ ...S.label, fontSize: '0.6875rem' }}>态度</label>
                    <select style={S.select} value={f.attitude} onChange={(e) => updateFaction(i, 'attitude', e.target.value)}>
                      <option value="hostile">敌对</option>
                      <option value="neutral">中立</option>
                      <option value="friendly">友善</option>
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <label style={{ ...S.label, fontSize: '0.6875rem' }}>势力强度 ({f.power}/10)</label>
                    <input type="range" min={1} max={10} value={f.power} onChange={(e) => updateFaction(i, 'power', parseInt(e.target.value, 10))} style={{ ...S.slider, width: '100%' }} />
                  </div>
                  <div style={{ flex: 2, minWidth: 120 }}>
                    <label style={{ ...S.label, fontSize: '0.6875rem' }}>领地</label>
                    <input style={S.input} value={f.territory} onChange={(e) => updateFaction(i, 'territory', e.target.value)} placeholder="领地名称" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

      case 'history': return (
        <div style={S.panel}>
          <div style={S.fieldGroup}>
            <label style={S.label}>关键历史事件</label>
            <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.5rem' }}>
              <input
                style={S.input}
                placeholder="输入历史事件..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addToArray('keyEvents', (e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
              <button
                onClick={(e) => {
                  const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                  addToArray('keyEvents', input.value);
                  input.value = '';
                }}
                style={{ ...S.btnSmall, borderColor: '#C9A94E', color: '#C9A94E' }}
              >添加</button>
            </div>
            {profile.keyEvents.length === 0 && (
              <div style={{ color: '#6B6258', fontSize: '0.8125rem', padding: '0.5rem 0' }}>例如：巨龙苏醒、帝国覆灭、科技革命</div>
            )}
            <div style={S.tagContainer}>
              {profile.keyEvents.map((ev, i) => (
                <span key={i} style={{ ...S.tag, flexDirection: 'column', alignItems: 'flex-start', gap: '0.125rem', maxWidth: '100%' }}>
                  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ flex: 1 }}>{ev}</span>
                    <button onClick={() => removeFromArray('keyEvents', i)} style={S.tagRemove}>×</button>
                  </div>
                </span>
              ))}
            </div>
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}>当前主要冲突</label>
            <input style={S.input} value={profile.currentConflict} onChange={(e) => update('currentConflict', e.target.value)} placeholder="例如：人类与精灵的百年战争" />
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}>隐藏的秘密/真相</label>
            <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.5rem' }}>
              <input
                style={S.input}
                placeholder="世界隐藏的秘密..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addToArray('secrets', (e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
              <button
                onClick={(e) => {
                  const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                  addToArray('secrets', input.value);
                  input.value = '';
                }}
                style={{ ...S.btnSmall, borderColor: '#C9A94E', color: '#C9A94E' }}
              >添加</button>
            </div>
            <div style={S.tagContainer}>
              {profile.secrets.map((s, i) => (
                <span key={i} style={{ ...S.tag, flexDirection: 'column', alignItems: 'flex-start', gap: '0.125rem', maxWidth: '100%' }}>
                  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ flex: 1 }}>{s}</span>
                    <button onClick={() => removeFromArray('secrets', i)} style={S.tagRemove}>×</button>
                  </div>
                </span>
              ))}
            </div>
          </div>
        </div>
      );

      case 'narrative': return (
        <div style={S.panel}>
          <div style={S.fieldGroup}>
            <label style={S.label}>叙事风格</label>
            <div style={S.btnRow}>
              {STYLE_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => update('narrationStyle', s)}
                  style={{ ...S.btnSmall, ...(profile.narrationStyle === s ? S.btnSmallActive : {}) }}
                >{STYLE_LABELS[s]}</button>
              ))}
            </div>
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}>危险程度 ({profile.dangerLevel}/10)</label>
            <div style={S.sliderRow}>
              <span style={{ color: '#6B6258', fontSize: '0.75rem' }}>1</span>
              <input type="range" min={1} max={10} value={profile.dangerLevel} onChange={(e) => updateNumeric('dangerLevel', e.target.value)} style={S.slider} />
              <span style={{ color: '#6B6258', fontSize: '0.75rem' }}>10</span>
              <span style={S.sliderValue}>{profile.dangerLevel}</span>
            </div>
            <div style={{ color: '#6B6258', fontSize: '0.6875rem', marginTop: '0.25rem' }}>
              {profile.dangerLevel >= 8 ? '致命危险 — 每一步都可能致命。' :
               profile.dangerLevel >= 5 ? '中等风险 — 危险潜伏在暗处。' :
               '较为安全 — 但警惕是美德。'}
            </div>
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}>神秘感 ({profile.mysteryLevel}/10)</label>
            <div style={S.sliderRow}>
              <span style={{ color: '#6B6258', fontSize: '0.75rem' }}>1</span>
              <input type="range" min={1} max={10} value={profile.mysteryLevel} onChange={(e) => updateNumeric('mysteryLevel', e.target.value)} style={S.slider} />
              <span style={{ color: '#6B6258', fontSize: '0.75rem' }}>10</span>
              <span style={S.sliderValue}>{profile.mysteryLevel}</span>
            </div>
            <div style={{ color: '#6B6258', fontSize: '0.6875rem', marginTop: '0.25rem' }}>
              {profile.mysteryLevel >= 8 ? '深层神秘 — 真相埋藏在层层迷雾之下。' :
               profile.mysteryLevel >= 5 ? '适度神秘 — 世界有其未解之谜。' :
               '直白清晰 — 真相就在眼前。'}
            </div>
          </div>

          {/* Preview of generated narrative */}
          <div style={S.previewSection}>
            <div style={S.previewTitle}>生成的开场叙事预览</div>
            <div style={S.previewText}>{generateOpeningNarrative(profile)}</div>
          </div>
        </div>
      );

      default: return <div style={S.panel} />;
    }
  };

  // ── Render ──
  return (
    <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.modal}>
        {/* Header */}
        <div style={S.header}>
          <h2 style={S.headerTitle}>🧬 自定义世界观</h2>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div style={{ padding: '0 1.25rem', marginTop: '0.5rem' }}>
            {warnings.map((w, i) => (
              <div key={i} style={S.conflictBanner}>⚠ {w}</div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={S.tabRow}>
          {SECTIONS.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              style={{ ...S.tab, ...(activeSection === sec.id ? S.tabActive : {}) }}
            >{sec.icon} {sec.label}</button>
          ))}
        </div>

        {/* Body */}
        <div style={S.body}>
          {renderSection()}
          {/* Preview */}
          {showPreview && (
            <div style={{ padding: '0 1.25rem 1.25rem' }}>
              <div style={S.previewSection}>
                <div style={{ ...S.previewTitle, marginBottom: '0.75rem' }}>
                  📋 完整设定预览
                  <button onClick={() => setShowPreview(false)} style={{ ...S.btnSmall, marginLeft: '0.5rem', fontSize: '0.6875rem' }}>收起</button>
                </div>
                <div style={S.previewText}>
                  <strong>名称：</strong>{previewSetting.worldMeta.name}{'\n'}
                  <strong>流派：</strong>{previewSetting.worldMeta.genre} | {previewSetting.worldMeta.tone}{'\n'}
                  <strong>描述：</strong>{previewSetting.worldMeta.description}{'\n'}
                  <strong>职业：</strong>{previewSetting.playerOptions?.availableClasses.map((c) => c.name).join(', ') ?? '无'}{'\n'}
                  <strong>开场：</strong>{previewSetting.startingLocation?.openingNarrative ?? '无'}{'\n'}
                  <strong>种族：</strong>{profile.races.join(', ') || '无'}{'\n'}
                  <strong>势力：</strong>{profile.factions.map((f) => `${f.name}(${f.attitude})`).join(', ') || '无'}{'\n'}
                  <strong>历史：</strong>{profile.keyEvents.join('; ') || '无'}{'\n'}
                  <strong>秘密：</strong>{profile.secrets.length}个隐藏真相{'\n'}
                  <strong>风格：</strong>{STYLE_LABELS[profile.narrationStyle]}{'\n'}
                  <strong>科技：</strong>{profile.techLevel}/10 | <strong>魔法：</strong>{profile.magicLevel}/10 | <strong>危险：</strong>{profile.dangerLevel}/10 | <strong>神秘：</strong>{profile.mysteryLevel}/10
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <div style={S.footerLeft}>
            <button onClick={handleImportJSON} style={{ ...S.btn, ...S.btnSecondary }}>
              📥 导入 JSON
            </button>
            <button onClick={handleExportJSON} style={{ ...S.btn, ...S.btnSecondary }}>
              📤 导出 JSON
            </button>
            <button onClick={() => setShowPreview(!showPreview)} style={{ ...S.btn, ...S.btnSecondary }}>
              {showPreview ? '👁 隐藏预览' : '👁 预览设定'}
            </button>
          </div>
          <div style={S.footerRight}>
            <button onClick={onClose} style={{ ...S.btn, ...S.btnDanger }}>取消</button>
            <button onClick={handleSave} style={{ ...S.btn, ...S.btnPrimary }} disabled={!profile.name.trim()}>
              生成 GameSetting
            </button>
          </div>
        </div>

        {/* Hidden file input for import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
