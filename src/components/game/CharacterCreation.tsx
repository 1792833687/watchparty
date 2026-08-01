'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { PlayerClass } from '@/systems/settings/types';
import type { Profession } from '@/systems/content';
import type { Origin } from '@/systems/content';
import type { Wallet } from '@/theme/tokens';
import { FONT } from '@/theme/tokens';

/** v3.0.0: 出身详细信息 */
export interface OriginChoice {
  id: string;
  name: string;
  desc?: string;
  attrSummary?: string;
  expertise?: string[];
  consequences?: string[];
  startingGear?: string[];
  startingGold?: number;
  /** v4.0.0: 起始钱包 */
  startingWallet?: Wallet;
}

/** v3.0.0: 过往详细信息 */
export interface BackgroundChoice {
  id: string;
  name: string;
  desc?: string;
  hiddenTrait?: string;
  consequences?: string[];
  storyHook?: string;
  factionBias?: string;
  corruptionMod?: number;
}

/** v3.0.0: 属性详细说明 */
export interface AttrDetail {
  label: string;
  abbr?: string;
  desc: string;
  formula?: string;
  effects?: string[];
  lowValueWarning?: string;
}

export interface CharacterCreationProps {
  availableClasses?: PlayerClass[];
  attributeNames?: string[];
  totalPoints?: number;
  attrLabels?: Record<string, string>;
  attrDescs?: Record<string, string>;
  attrDetails?: Record<string, AttrDetail>;
  origins?: OriginChoice[];
  backgrounds?: BackgroundChoice[];
  /** v4.0.0: 职业列表（与出身拆分） */
  professions?: Profession[];
  /** v4.0.0: 出身列表（与职业拆分） */
  originDefs?: Origin[];
  onConfirm: (data: CharacterData) => void;
}

export interface CharacterData {
  name: string;
  classId: string;
  className: string;
  attributes: Record<string, number>;
  bonusAttr?: string;
  isRandom?: boolean;
  originId?: string;
  originName?: string;
  backgroundId?: string;
  backgroundName?: string;
  startingGold?: number;
  /** v4.0.0: 多层钱包 */
  startingWallet?: Wallet;
  /** v4.0.0: 所选职业 ID */
  professionId?: string;
  professionName?: string;
  /** v4.1.0: 起始堕落值（受出身/过往修正，world-setting 五） */
  corruption?: number;
  /** v4.1.0: 阵营声望（world-setting 10.2） */
  factionReputations?: Record<string, number>;
}

const LABELS: Record<string, string> = {
  strength: '力量', agility: '敏捷', dexterity: '敏捷',
  intelligence: '智力', constitution: '体质', wisdom: '感知', charisma: '魅力',
};
const DESCS: Record<string, string> = {
  strength: '近战伤害、负重与威慑',
  agility: '闪避、先攻与潜行',
  dexterity: '远程伤害、闪避与潜行',
  intelligence: '奥术强度、古代语与法力上限',
  constitution: '生命上限、抗性与抵抗堕落',
  wisdom: '神圣强度、察觉与抵抗诱惑',
  charisma: '同伴好感、外交与议价',
};

const MAX_ATTR = 10;
/**
 * v4.1.0: 初始总点数（成本制）评估为 28。
 * 成本制下核心属性 1 点/非核心 2 点；28 可保证：
 *  - 开局职业核心属性 3+mods 全保留（战士 6/4/5=15 成本）
 *  - 非核心 3/3/3（18 成本）会被裁剪至 1~2，剩余 5~7 点自由分配
 * 原 24 点（数值制）在成本制下过紧，易出现剩余为负；原 fallback 15 点过少。
 */
const DEFAULT_POINTS = 28;

const DEFAULT_CLASSES: PlayerClass[] = [
  {
    id: 'custom',
    name: '自定义',
    description: '六维均衡，全部点数自由分配。',
    baseAttributes: { strength: 3, dexterity: 3, constitution: 3, intelligence: 3, wisdom: 3, charisma: 3 },
  },
];

const C = {
  gold: '#C9A94E',
  goldDim: 'rgba(201,169,78,0.2)',
  text: '#E8E0D5',
  textDim: '#A09888',
  dim: '#A09888',
  panel: '#2A2522',
  deep: '#1E1B18',
  purple: '#7B6FDF',
  danger: '#E53E3E',
  ok: '#5A9E6F',
  blue: '#5B7B9A',
  rust: '#A0522D',
  border: 'rgba(201,169,78,0.15)',
} as const;

function getRandomClass(classes: PlayerClass[]): PlayerClass {
  const seed = Date.now() % 10000;
  const idx = (seed * 7 + 3) % classes.length;
  return classes[idx]!;
}

function getRandomBonusAttr(attrNames: string[]): string {
  const seed = Date.now() % 10000;
  const idx = (seed * 13 + 7) % attrNames.length;
  return attrNames[idx]!;
}

/** 后果清单渲染 */
function ConsequenceList({
  items,
  accent,
}: {
  items: string[];
  accent: string;
}): React.ReactElement {
  return (
    <ul style={{ margin: '0.5rem 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      {items.map((c, i) => (
        <li key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8125rem', lineHeight: 1.55, color: C.text }}>
          <span style={{ color: accent, flexShrink: 0, marginTop: 1 }}>◆</span>
          <span>{c}</span>
        </li>
      ))}
    </ul>
  );
}

export function CharacterCreation({
  availableClasses: rawAvailableClasses,
  attributeNames: rawAttributeNames,
  totalPoints = DEFAULT_POINTS,
  attrLabels: customLabels,
  attrDescs: customDescs,
  attrDetails,
  origins,
  backgrounds,
  professions,
  originDefs,
  onConfirm,
}: CharacterCreationProps): React.ReactElement {
  const attrLabels = useMemo(() => ({ ...LABELS, ...(customLabels ?? {}) }), [customLabels]);
  const attrDescs = useMemo(() => ({ ...DESCS, ...(customDescs ?? {}) }), [customDescs]);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [charName, setCharName] = useState('');
  const [attributes, setAttributes] = useState<Record<string, number>>({});
  const [expandedAttr, setExpandedAttr] = useState<string | null>(null);

  const [randomFlipped, setRandomFlipped] = useState(false);
  const [randomClass, setRandomClass] = useState<PlayerClass | null>(null);
  const [randomBonus, setRandomBonus] = useState('');
  const [isRandomSelected, setIsRandomSelected] = useState(false);

  const [backgroundId, setBackgroundId] = useState('');

  /** v4.0.0: 职业选择（独立于出身） */
  const [professionId, setProfessionId] = useState('');
  const selectedProfession = useMemo(() => professions?.find(p => p.id === professionId), [professions, professionId]);

  const availableClasses: PlayerClass[] = useMemo(() => {
    if (rawAvailableClasses && rawAvailableClasses.length > 0) return rawAvailableClasses;
    return DEFAULT_CLASSES;
  }, [rawAvailableClasses]);

  const attributeNames: string[] = useMemo(() => {
    if (rawAttributeNames && rawAttributeNames.length > 0) return rawAttributeNames;
    return ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  }, [rawAttributeNames]);

  const coreAttrs = useMemo(
    () => attributeNames.filter((a) => a !== 'hp' && a !== 'mp'),
    [attributeNames]
  );

  const selectedClass = useMemo(
    () => availableClasses.find((c) => c.id === selectedClassId),
    [availableClasses, selectedClassId]
  );

  /** v3.0.0: 出身与职业合一 —— 选中的职业即出身 */
  const selectedOrigin = useMemo(
    () => origins?.find((o) => o.id === selectedClassId),
    [origins, selectedClassId]
  );

  const selectedBackground = useMemo(
    () => backgrounds?.find((b) => b.id === backgroundId),
    [backgrounds, backgroundId]
  );

  // ── v4.1.0: 属性点分配与职业机制挂钩（职业核心属性 vs 非核心属性）──
  // 核心属性 = 职业 attrMods 中带正修正的属性（如战士的力量/体质/敏捷）
  // 规则：核心属性上限 10、加点成本 1；非核心属性上限 7、加点成本 2（体现职业专业化）
  const CORE_ATTR_MAX = MAX_ATTR;      // 10
  const NON_CORE_ATTR_MAX = 7;
  const CORE_COST = 1;
  const NON_CORE_COST = 2;
  const coreAttrsOfProfession = useMemo(() => {
    if (!selectedProfession?.attrMods) return new Set<string>();
    return new Set(Object.entries(selectedProfession.attrMods)
      .filter(([, v]) => (v ?? 0) > 0)
      .map(([k]) => k));
  }, [selectedProfession]);
  /** 属性是否为职业核心属性 */
  const isCoreAttr = useCallback(
    (attr: string): boolean => coreAttrsOfProfession.has(attr),
    [coreAttrsOfProfession]
  );
  /** 加点成本：核心 1 点 / 非核心 2 点 */
  const getAttrCost = useCallback(
    (attr: string): number => (isCoreAttr(attr) ? CORE_COST : NON_CORE_COST),
    [isCoreAttr]
  );
  /** 属性上限：核心 10 / 非核心 7 */
  const getAttrMax = useCallback(
    (attr: string): number => (isCoreAttr(attr) ? CORE_ATTR_MAX : NON_CORE_ATTR_MAX),
    [isCoreAttr]
  );

  /** v4.1.0: 成本制剩余点数 */
  const remainingCost = useMemo(
    () => totalPoints - coreAttrs.reduce((s, a) => s + (attributes[a] ?? 0) * getAttrCost(a), 0),
    [totalPoints, coreAttrs, attributes, getAttrCost]
  );

  useEffect(() => {
    if (coreAttrs.length > 0 && Object.keys(attributes).length === 0) {
      const d: Record<string, number> = {};
      coreAttrs.forEach((a) => { d[a] = 3; });
      setAttributes(d);
    }
  }, [coreAttrs, attributes]);

  /**
   * v4.1.0: 选择职业时自动按职业特点分配属性点数
   * 基于职业 attrMods 在 base=3 之上叠加，总分配 = totalPoints
   */
  useEffect(() => {
    if (!selectedProfession || !selectedProfession.attrMods) return;
    const mods = selectedProfession.attrMods;
    // 每个属性基础值 = 3 + 职业修正
    const base: Record<string, number> = {};
    coreAttrs.forEach((a) => {
      base[a] = 3 + ((mods as Record<string, number>)[a] ?? 0);
    });
    setAttributes(applyBaseAttributes(base, undefined));
  }, [professionId]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * v3.0.0 关键修复：套用职业基础属性时进行预算裁剪。
   * 若某职业的基础属性总和超过总点数预算，按比例回落，
   * 从根本上杜绝「剩余点数为负仍可开始游戏」。
   * v4.1.0: 裁剪改为按「成本」判断（核心 1 点/非核心 2 点），
   * 优先削减非核心属性（成本高），保护职业核心属性。
   */
  const applyBaseAttributes = useCallback(
    (base: Record<string, number>, bonusAttr?: string): Record<string, number> => {
      const init: Record<string, number> = {};
      coreAttrs.forEach((a) => {
        const v = base[a] ?? 3;
        init[a] = a === bonusAttr ? Math.min(getAttrMax(a), v + 2) : Math.min(getAttrMax(a), v);
      });
      // 成本制预算：总占用 = Σ(属性值 × 成本)
      const costOf = (a: string): number => (init[a] ?? 0) * getAttrCost(a);
      let cost = coreAttrs.reduce((s, a) => s + costOf(a), 0);
      let guard = 0;
      // 只要总成本超预算就逐点回落：非核心（成本 2）优先削，核心（成本 1）后削
      while (cost > totalPoints && guard < 500) {
        const sorted = coreAttrs
          .filter((a) => (init[a] ?? 0) > 1)
          .sort((x, y) => {
            const coreX = isCoreAttr(x) ? 1 : 0;
            const coreY = isCoreAttr(y) ? 1 : 0;
            if (coreX !== coreY) return coreX - coreY; // 非核心排前
            return (init[y] ?? 0) - (init[x] ?? 0);   // 同权重下从高值削
          });
        const top = sorted[0];
        if (!top) break;
        init[top] = (init[top] ?? 1) - 1;
        cost -= getAttrCost(top);
        guard += 1;
      }
      return init;
    },
    [coreAttrs, totalPoints, isCoreAttr, getAttrCost, getAttrMax]
  );

  const handleSelectClass = useCallback((id: string) => {
    if (id === '_random') {
      setIsRandomSelected(true);
      setRandomFlipped(false);
      const picked = getRandomClass(availableClasses);
      const bonusAttrName = getRandomBonusAttr(coreAttrs);

      setTimeout(() => {
        setRandomClass(picked);
        setRandomBonus(bonusAttrName);
        setRandomFlipped(true);
        setSelectedClassId(picked.id);
        setAttributes(applyBaseAttributes(picked.baseAttributes, bonusAttrName));
      }, 400);
      return;
    }

    setIsRandomSelected(false);
    setRandomFlipped(false);
    setRandomClass(null);
    setRandomBonus('');
    setSelectedClassId(id);

    const cls = availableClasses.find((c) => c.id === id);
    if (cls) setAttributes(applyBaseAttributes(cls.baseAttributes));
  }, [availableClasses, coreAttrs, applyBaseAttributes]);

  /**
   * v4.1.0: 加点成本制 — 核心属性 +1 消耗 1 点，非核心 +1 消耗 2 点；
   * 减点按相同成本返还。硬性拦截超预算与超上限。
   */
  const handleAttrChange = useCallback((attr: string, delta: number) => {
    setAttributes((prev) => {
      const cur = prev[attr] ?? 0;
      const max = getAttrMax(attr);
      const next = Math.max(1, Math.min(max, cur + delta));
      const actualDelta = next - cur;
      if (actualDelta === 0) return prev;
      // 成本：加点时按成本扣，减点时按成本返还
      const cost = Math.abs(actualDelta) * getAttrCost(attr) * (actualDelta > 0 ? 1 : -1);
      // 预算按成本计算：硬性拦截超预算
      const currentCostUsed = Object.entries(prev).reduce(
        (s, [k, v]) => s + v * getAttrCost(k), 0
      );
      const newCostUsed = currentCostUsed + cost;
      if (newCostUsed > totalPoints) return prev;
      return { ...prev, [attr]: next };
    });
  }, [totalPoints, getAttrCost, getAttrMax]);

  const handleReset = useCallback(() => {
    if (selectedClass) {
      setAttributes(applyBaseAttributes(selectedClass.baseAttributes, isRandomSelected ? randomBonus : undefined));
    } else {
      const d: Record<string, number> = {};
      coreAttrs.forEach((a) => { d[a] = 3; });
      setAttributes(d);
    }
  }, [selectedClass, applyBaseAttributes, isRandomSelected, randomBonus, coreAttrs]);

  /** v4.0.0: 创建校验 — 职业/出身/过往/负数点数 全部拦截 */
  const validation = useMemo(() => {
    // v4.1.0: 成本制剩余点数 = 总预算 - 所有属性按成本折算的占用
    const costUsed = coreAttrs.reduce((s, a) => s + (attributes[a] ?? 0) * getAttrCost(a), 0);
    if (costUsed > totalPoints) {
      return { ok: false, msg: `属性点已超支 ${costUsed - totalPoints} 点，请先减少分配` };
    }
    // v4.0.0: 优先检查新职业系统，否则退回旧出身系统
    if (professions && professions.length > 0) {
      if (!professionId) return { ok: false, msg: '请先选择你的职业' };
    } else {
      if (!selectedClassId) return { ok: false, msg: '请先选择你的出身' };
    }
    if (backgrounds && backgrounds.length > 0 && !backgroundId) {
      return { ok: false, msg: '请先选择你的过往' };
    }
    const hasInvalid = coreAttrs.some((a) => (attributes[a] ?? 0) < 1);
    if (hasInvalid) {
      return { ok: false, msg: '每项属性至少需要 1 点' };
    }
    return { ok: true, msg: '' };
  }, [coreAttrs, attributes, getAttrCost, selectedClassId, professionId, professions, backgroundId, backgrounds]);

  const handleConfirm = useCallback(() => {
    // 双保险：即便按钮被绕过也不会带着负点数进入游戏
    if (!validation.ok) return;

    const origin = originDefs?.find((o) => o.id === selectedClassId) ?? origins?.find((o) => o.id === selectedClassId);
    const bg = backgrounds?.find((b) => b.id === backgroundId);
    // v4.1.0: 起始堕落值 = 过往 corruptionMod（赎罪+5 / 继承-5），下限 0
    const startingCorruption = Math.max(0, bg?.corruptionMod ?? 0);
    onConfirm({
      name: charName.trim() || '无名领主',
      classId: selectedProfession?.id ?? selectedClass?.id ?? '',
      className: selectedProfession?.name ?? selectedClass?.name ?? '守夜人',
      attributes,
      bonusAttr: isRandomSelected ? randomBonus : undefined,
      isRandom: isRandomSelected,
      originId: selectedClassId,
      originName: origin?.name ?? selectedClass?.name,
      backgroundId,
      backgroundName: bg?.name,
      startingGold: (origin as OriginChoice | undefined)?.startingGold ?? 80,
      startingWallet: (origin as OriginChoice | undefined)?.startingWallet,
      professionId: selectedProfession?.id,
      professionName: selectedProfession?.name,
      corruption: startingCorruption,
    });
  }, [validation, charName, selectedClass, selectedProfession, selectedClassId, attributes, isRandomSelected, randomBonus, backgroundId, origins, backgrounds, originDefs, onConfirm]);

  const sectionTitle = (n: string, t: string, sub?: string): React.ReactElement => (
    <div style={{ marginBottom: '0.75rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: C.text, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{
          width: 22, height: 22, borderRadius: '50%', background: C.goldDim, color: C.gold,
          fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>{n}</span>
        {t}
      </h3>
      {sub && <p style={{ margin: '0.25rem 0 0 1.875rem', fontSize: '0.75rem', color: C.dim }}>{sub}</p>}
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem' }}>
      <h2 style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 700, color: C.gold }}>🏰 凛冬要塞 · 铸就你的领主</h2>
      <p style={{ textAlign: 'center', color: C.dim, fontSize: '0.875rem', margin: '0.25rem 0 1.75rem' }}>
        出身决定你从哪里来，过往决定你为何而来，属性决定你能走多远
      </p>

      {/* v4.0.0: 0. 职业选择（与出身拆分，独立步骤） */}
      {professions && professions.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          {sectionTitle('1', '选择职业', '职业决定你的战斗方式、专属技能与属性倾向')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.75rem' }}>
            {professions.map((p) => {
              const active = professionId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProfessionId(p.id)}
                  style={{
                    padding: '0.75rem', borderRadius: 10,
                    border: active ? `2px solid ${C.gold}` : `1px solid ${C.goldDim}`,
                    background: active ? 'rgba(201,169,78,0.12)' : C.panel,
                    color: C.text, textAlign: 'left', cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: active ? '0 0 12px rgba(201,169,78,0.2)' : '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: active ? C.gold : C.text }}>
                    {p.emoji} {p.name}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: C.blue, marginTop: '0.25rem', fontWeight: 600 }}>
                    {p.roleLabel} · 难度: {'★'.repeat(p.difficulty)}{'☆'.repeat(5 - p.difficulty)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: C.dim, marginTop: '0.25rem', lineHeight: 1.4 }}>
                    {p.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 职业详情展开 */}
          {selectedProfession && (
            <div style={{ padding: '1rem', borderRadius: 10, marginTop: '0.75rem', background: 'rgba(201,169,78,0.05)', border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: C.gold }}>⚔️ 专精技能</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.5rem' }}>
                {selectedProfession.skills.map(sk => (
                  <div key={sk.name} style={{ fontSize: FONT.sm, color: C.textDim }}>
                    <span style={{ color: sk.signature ? C.gold : C.text, fontWeight: 600 }}>{sk.name}</span>
                    {sk.signature && <span style={{ fontSize: FONT.xs, color: C.gold, marginLeft: '0.375rem' }}>[专属]</span>}
                    {' — '}{sk.desc}
                  </div>
                ))}
              </div>
              {/* v4.1.0: 职业独特机制 */}
              {selectedProfession.mechanics && selectedProfession.mechanics.length > 0 && (
                <>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: C.purple, marginTop: '0.75rem' }}>✨ 独特机制</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.5rem' }}>
                    {selectedProfession.mechanics.map(m => (
                      <div key={m.name} style={{ fontSize: FONT.sm, color: C.textDim }}>
                        <span style={{ color: C.purple, fontWeight: 600 }}>{m.name}</span>
                        {' — '}{m.desc}
                      </div>
                    ))}
                  </div>
                </>
              )}
              {/* v4.1.0: 成长曲线 */}
              {selectedProfession.growth && (
                <>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: C.ok, marginTop: '0.75rem' }}>📈 成长曲线</div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: FONT.sm, color: C.textDim }}>
                      ❤️ 每级生命 <b style={{ color: C.text }}>+{selectedProfession.growth.hpPerLevel}</b>
                    </span>
                    <span style={{ fontSize: FONT.sm, color: C.textDim }}>
                      💎 每级法力 <b style={{ color: C.text }}>+{selectedProfession.growth.mpPerLevel}</b>
                    </span>
                    {selectedProfession.growth.attrWeights && (
                      <span style={{ fontSize: FONT.sm, color: C.textDim }}>
                        🎯 成长倾向{' '}
                        {Object.entries(selectedProfession.growth.attrWeights)
                          .map(([k, w]) => `${LABELS[k] ?? k}×${w}`).join(' · ')}
                      </span>
                    )}
                  </div>
                </>
              )}
              <div style={{ fontSize: FONT.sm, color: C.textDim, marginTop: '0.5rem' }}>玩法风格：{selectedProfession.playstyle}</div>
            </div>
          )}
        </div>
      )}

      {/* ---------- 1. 出身（即职业） ---------- */}
      {(!professions || professions.length === 0) && (
      <div style={{ marginBottom: '1.5rem' }}>
        {sectionTitle('1', '出身与职业', '你的出身同时决定了你的战斗方式、初始盟友与专属剧情线')}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
          {availableClasses.map((cls) => {
            const o = origins?.find((x) => x.id === cls.id);
            const active = selectedClassId === cls.id && !isRandomSelected;
            return (
              <button
                key={cls.id}
                type="button"
                onClick={() => handleSelectClass(cls.id)}
                style={{
                  padding: '0.875rem',
                  borderRadius: 10,
                  border: active ? `2px solid ${C.gold}` : `1px solid ${C.goldDim}`,
                  background: active ? 'rgba(201,169,78,0.12)' : C.panel,
                  color: C.text,
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: active ? '0 0 12px rgba(201,169,78,0.2)' : '0 2px 8px rgba(0,0,0,0.3)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: active ? C.gold : C.text }}>{cls.name}</div>
                {o?.attrSummary && (
                  <div style={{ fontSize: '0.6875rem', color: C.blue, marginTop: '0.25rem', fontWeight: 600 }}>
                    {o.attrSummary}
                  </div>
                )}
                <div style={{ fontSize: '0.75rem', color: C.dim, marginTop: '0.25rem', lineHeight: 1.5 }}>
                  {o?.desc ?? cls.description}
                </div>
                {o?.expertise && o.expertise.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    {o.expertise.map((e) => (
                      <span key={e} style={{
                        fontSize: '0.625rem', padding: '0.0625rem 0.375rem', borderRadius: 4,
                        background: 'rgba(91,123,154,0.15)', color: C.blue,
                      }}>{e}</span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}

          {/* 命运抉择 */}
          <button
            type="button"
            onClick={() => handleSelectClass('_random')}
            style={{
              padding: '0.875rem',
              borderRadius: 10,
              border: isRandomSelected ? `2px solid ${C.purple}` : '2px solid rgba(123,111,223,0.4)',
              background: isRandomSelected ? 'rgba(123,111,223,0.12)' : 'rgba(123,111,223,0.04)',
              color: C.text,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: isRandomSelected ? '0 0 16px rgba(123,111,223,0.25)' : '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>🎲</div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: C.purple }}>命运抉择</div>
            <div style={{ fontSize: '0.75rem', color: '#8A80A8', marginTop: '0.25rem' }}>
              由命运指定出身，并获得一项额外眷顾
            </div>
          </button>
        </div>
      </div>
      )}

      {/* v4.0.0: 出身选择（独立步骤，仅当职业已选择时显示） */}
      {professions && professions.length > 0 && originDefs && originDefs.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          {sectionTitle('2', '选择出身', '出身决定你的初始物品、起始货币与剧情羁绊')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {originDefs.map((o) => {
              const active = selectedClassId === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelectedClassId(o.id)}
                  style={{
                    padding: '0.875rem', borderRadius: 10,
                    border: active ? `2px solid ${C.gold}` : `1px solid ${C.goldDim}`,
                    background: active ? 'rgba(201,169,78,0.12)' : C.panel,
                    color: C.text, textAlign: 'left', cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: active ? '0 0 12px rgba(201,169,78,0.2)' : '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: active ? C.gold : C.text }}>
                    {o.emoji} {o.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: C.dim, marginTop: '0.25rem', lineHeight: 1.4 }}>
                    {o.desc}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: C.gold, marginTop: '0.375rem', fontWeight: 600 }}>
                    {Object.entries(o.attrMods).map(([k, v]) => `${LABELS[k] ?? k} ${v > 0 ? '+' : ''}${v}`).join(' · ')}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 出身后果详情 */}
          {(() => {
            const activeOrigin = originDefs.find(o => o.id === selectedClassId);
            if (!activeOrigin) return null;
            return (
              <div style={{ padding: '1rem', borderRadius: 10, marginTop: '0.75rem', background: 'rgba(91,123,154,0.07)', border: `1px solid rgba(91,123,154,0.3)` }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: C.blue }}>
                  📜 选择「{activeOrigin.name}」意味着
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.5rem' }}>
                  {activeOrigin.consequences.map((c, i) => (
                    <div key={i} style={{ fontSize: FONT.sm, color: C.textDim }}>• {c}</div>
                  ))}
                </div>
                <div style={{ fontSize: FONT.sm, color: C.gold, marginTop: '0.5rem' }}>
                  💎 隐藏特质：{activeOrigin.hiddenTrait}
                </div>
                <div style={{ fontSize: FONT.sm, color: C.textDim, marginTop: '0.25rem', fontStyle: 'italic' }}>
                  📖 剧情钩子：{activeOrigin.storyHook}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: FONT.xs, color: C.gold }}>
                    💰 {
                      activeOrigin.startingWallet.gold > 0 ? `${activeOrigin.startingWallet.gold}🪙` : ''
                    }{activeOrigin.startingWallet.silver > 0 ? ` ${activeOrigin.startingWallet.silver}S` : ''}{' '}
                  </span>
                  {activeOrigin.startingItems.length > 0 && (
                    <span style={{ fontSize: FONT.xs, color: C.textDim }}>
                      🎒 {activeOrigin.startingItems.join(' · ')}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 命运揭示 */}
      {isRandomSelected && (
        <div style={{
          padding: '0.875rem', borderRadius: 10,
          background: 'rgba(123,111,223,0.08)', border: '1px solid rgba(123,111,223,0.25)',
          marginBottom: '1.25rem', transition: 'all 0.4s ease',
          transform: randomFlipped ? 'rotateY(0deg)' : 'rotateY(90deg)',
          opacity: randomFlipped ? 1 : 0.5,
        }}>
          {randomFlipped && randomClass ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎉</div>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: C.purple }}>
                命运选择了：{randomClass.name}
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#8A80A8', marginTop: '0.25rem' }}>
                {randomClass.description}
              </div>
              <div style={{
                marginTop: '0.5rem', padding: '0.375rem 0.75rem', borderRadius: 6,
                background: 'rgba(123,111,223,0.15)', color: C.gold,
                fontSize: '0.8125rem', fontWeight: 600, display: 'inline-block',
              }}>
                ⭐ 命运眷顾：{attrLabels[randomBonus] ?? randomBonus} +2
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem', color: '#8A80A8', fontSize: '0.9375rem' }}>
              🎲 命运正在为你选择…
            </div>
          )}
        </div>
      )}

      {/* 出身后果详情 */}
      {selectedOrigin && (
        <div style={{
          padding: '1rem', borderRadius: 10, marginBottom: '1.5rem',
          background: 'rgba(91,123,154,0.07)', border: `1px solid rgba(91,123,154,0.3)`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: C.blue }}>
              📜 选择「{selectedOrigin.name}」意味着
            </div>
            {typeof selectedOrigin.startingGold === 'number' && (
              <span style={{
                fontSize: '0.75rem', fontWeight: 700, color: C.gold,
                background: 'rgba(201,169,78,0.12)', padding: '0.125rem 0.5rem', borderRadius: 10,
              }}>
                🪙 起始金币 {selectedOrigin.startingGold}
              </span>
            )}
          </div>
          {selectedOrigin.consequences && selectedOrigin.consequences.length > 0 && (
            <ConsequenceList items={selectedOrigin.consequences} accent={C.blue} />
          )}
          {selectedOrigin.startingGear && selectedOrigin.startingGear.length > 0 && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.625rem', borderTop: '1px solid rgba(91,123,154,0.18)' }}>
              <span style={{ fontSize: '0.75rem', color: C.dim }}>起始装备：</span>
              <span style={{ fontSize: '0.75rem', color: C.text }}>{selectedOrigin.startingGear.join(' · ')}</span>
            </div>
          )}
        </div>
      )}

      {/* ---------- 2. 过往 ---------- */}
      {backgrounds && backgrounds.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          {sectionTitle('2', '你的过往', '过往决定了你的起始堕落值、隐藏特质与专属隐藏结局')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
            {backgrounds.map((b) => {
              const active = backgroundId === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBackgroundId(b.id)}
                  style={{
                    padding: '0.875rem', borderRadius: 10,
                    border: active ? `2px solid ${C.rust}` : `1px solid rgba(160,82,45,0.25)`,
                    background: active ? 'rgba(160,82,45,0.12)' : C.panel,
                    color: C.text, textAlign: 'left', cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: active ? '0 0 12px rgba(160,82,45,0.2)' : '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: active ? C.rust : C.text }}>{b.name}</div>
                  <div style={{ fontSize: '0.75rem', color: C.dim, marginTop: '0.25rem', lineHeight: 1.5, fontStyle: 'italic' }}>
                    「{b.desc}」
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 过往后果详情 */}
      {selectedBackground && (
        <div style={{
          padding: '1rem', borderRadius: 10, marginBottom: '1.5rem',
          background: 'rgba(160,82,45,0.07)', border: '1px solid rgba(160,82,45,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: C.rust }}>
              🕯️ 选择「{selectedBackground.name}」意味着
            </div>
            {typeof selectedBackground.corruptionMod === 'number' && selectedBackground.corruptionMod !== 0 && (
              <span style={{
                fontSize: '0.75rem', fontWeight: 700,
                color: selectedBackground.corruptionMod > 0 ? C.danger : C.ok,
                background: selectedBackground.corruptionMod > 0 ? 'rgba(229,62,62,0.12)' : 'rgba(90,158,111,0.12)',
                padding: '0.125rem 0.5rem', borderRadius: 10,
              }}>
                堕落值 {selectedBackground.corruptionMod > 0 ? '+' : ''}{selectedBackground.corruptionMod}
              </span>
            )}
          </div>
          {selectedBackground.consequences && selectedBackground.consequences.length > 0 && (
            <ConsequenceList items={selectedBackground.consequences} accent={C.rust} />
          )}
          {selectedBackground.hiddenTrait && (
            <div style={{
              marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: 6,
              background: 'rgba(201,169,78,0.08)', border: '1px dashed rgba(201,169,78,0.3)',
              fontSize: '0.75rem', color: C.gold, fontStyle: 'italic',
            }}>
              ✦ 隐藏特质：{selectedBackground.hiddenTrait}
            </div>
          )}
          {selectedBackground.storyHook && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: C.dim, lineHeight: 1.55 }}>
              剧情钩子：{selectedBackground.storyHook}
            </div>
          )}
        </div>
      )}

      {/* ---------- 3. 姓名 ---------- */}
      <div style={{ marginBottom: '1.5rem' }}>
        {sectionTitle('3', '领主之名', '老学士梅林正在羊皮纸上等着记下它')}
        <input
          value={charName}
          onChange={(e) => setCharName(e.target.value)}
          placeholder="为你的领主取一个名字…"
          maxLength={20}
          style={{
            width: '100%', padding: '0.625rem 1rem', borderRadius: 8,
            border: `1px solid ${C.goldDim}`, background: C.panel, color: C.text,
            fontSize: '0.9375rem', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* ---------- 4. 属性分配 ---------- */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            {sectionTitle('4', '属性分配', '点击属性名可展开该属性对游戏的完整影响说明')}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleReset}
              style={{
                padding: '0.25rem 0.625rem', borderRadius: 6, fontSize: '0.75rem',
                border: `1px solid ${C.goldDim}`, background: 'transparent', color: C.dim, cursor: 'pointer',
              }}
            >
              ↺ 重置
            </button>
            <div style={{
              padding: '0.25rem 0.75rem', borderRadius: 20,
              background: remainingCost < 0 ? 'rgba(229,62,62,0.15)' : remainingCost === 0 ? 'rgba(201,169,78,0.15)' : 'rgba(76,175,80,0.15)',
              color: remainingCost < 0 ? C.danger : remainingCost === 0 ? C.gold : C.ok,
              fontSize: '0.8125rem', fontWeight: 700, whiteSpace: 'nowrap',
            }}>
              剩余点数：{remainingCost} / {totalPoints}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {coreAttrs.map((attr) => {
            const v = attributes[attr] ?? 0;
            const isBonus = isRandomSelected && attr === randomBonus;
            const detail = attrDetails?.[attr];
            const isOpen = expandedAttr === attr;
            const core = isCoreAttr(attr);
            const attrMax = getAttrMax(attr);
            const cost = getAttrCost(attr);
            const canInc = remainingCost >= cost && v < attrMax;
            const canDec = v > 1;
            return (
              <div
                key={attr}
                style={{
                  borderRadius: 8, background: C.panel,
                  border: isBonus ? '1px solid rgba(123,111,223,0.3)' : `1px solid rgba(201,169,78,0.1)`,
                  overflow: 'hidden',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setExpandedAttr(isOpen ? null : attr)}
                    style={{
                      minWidth: 108, textAlign: 'left', background: 'transparent',
                      border: 'none', cursor: 'pointer', padding: 0,
                    }}
                    aria-expanded={isOpen}
                  >
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: isBonus ? C.purple : C.text, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      {attrLabels[attr] ?? attr}
                      {detail?.abbr && (
                        <span style={{ fontSize: '0.625rem', color: C.dim, fontWeight: 400 }}>{detail.abbr}</span>
                      )}
                      {/* v4.1.0: 职业核心属性徽章 */}
                      {core && (
                        <span style={{
                          fontSize: '0.5625rem', color: C.gold, fontWeight: 700,
                          border: `1px solid ${C.gold}66`, borderRadius: 4, padding: '0 4px',
                        }}>
                          职业核心
                        </span>
                      )}
                      {!core && selectedProfession && (
                        <span style={{
                          fontSize: '0.5625rem', color: C.dim, fontWeight: 400,
                          border: '1px solid rgba(160,152,136,0.3)', borderRadius: 4, padding: '0 4px',
                        }}>
                          上限 {NON_CORE_ATTR_MAX}
                        </span>
                      )}
                      {isBonus && <span style={{ fontSize: '0.625rem', color: C.gold }}>⭐+2</span>}
                      <span style={{ fontSize: '0.625rem', color: C.dim, marginLeft: '0.125rem' }}>
                        {cost}点/级
                      </span>
                      <span style={{ fontSize: '0.625rem', color: C.gold, marginLeft: 'auto', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▶</span>
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: C.dim, lineHeight: 1.4 }}>{attrDescs[attr] ?? ''}</div>
                  </button>

                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleAttrChange(attr, -1)}
                      disabled={!canDec}
                      style={{
                        width: 32, height: 32, borderRadius: '50%',
                        border: !canDec ? '1px solid rgba(201,169,78,0.1)' : `2px solid ${C.purple}`,
                        background: !canDec ? C.deep : C.purple,
                        color: !canDec ? '#5A5248' : '#fff',
                        fontSize: '1.2rem', fontWeight: 700,
                        cursor: !canDec ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        lineHeight: 1, userSelect: 'none', flexShrink: 0,
                      }}
                      aria-label={`减少${attrLabels[attr] ?? attr}`}
                    >
                      −
                    </button>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: C.deep, overflow: 'hidden', minWidth: 40 }}>
                      <div style={{
                        width: `${(v / attrMax) * 100}%`, height: '100%', borderRadius: 4,
                        background: isBonus ? C.purple : v >= 7 ? C.gold : v >= 4 ? C.purple : '#6B6258',
                        transition: 'width 0.2s ease',
                      }} />
                    </div>
                    <span style={{
                      minWidth: 24, textAlign: 'center', fontWeight: 700, fontSize: '1rem',
                      color: isBonus ? C.purple : C.text,
                    }}>
                      {v}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAttrChange(attr, 1)}
                      disabled={!canInc}
                      style={{
                        width: 32, height: 32, borderRadius: '50%',
                        border: !canInc ? '1px solid rgba(201,169,78,0.1)' : `2px solid ${C.gold}`,
                        background: !canInc ? C.deep : C.gold,
                        color: !canInc ? '#5A5248' : '#0A0A0F',
                        fontSize: '1.2rem', fontWeight: 700,
                        cursor: !canInc ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        lineHeight: 1, userSelect: 'none', flexShrink: 0,
                      }}
                      aria-label={`增加${attrLabels[attr] ?? attr}`}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 属性详细说明 */}
                {isOpen && detail && (
                  <div style={{
                    padding: '0.75rem 0.875rem', background: 'rgba(0,0,0,0.25)',
                    borderTop: '1px solid rgba(201,169,78,0.12)',
                  }}>
                    <div style={{ fontSize: '0.8125rem', color: C.text, lineHeight: 1.6, marginBottom: '0.5rem' }}>
                      {detail.desc}
                    </div>
                    {detail.effects && detail.effects.length > 0 && (
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.3125rem' }}>
                        {detail.effects.map((e, i) => (
                          <li key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', color: C.dim, lineHeight: 1.5 }}>
                            <span style={{ color: C.gold, flexShrink: 0 }}>▪</span>
                            <span>{e}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {detail.formula && (
                      <div style={{
                        marginTop: '0.5rem', padding: '0.375rem 0.5rem', borderRadius: 4,
                        background: 'rgba(91,123,154,0.1)', fontSize: '0.6875rem',
                        color: C.blue, fontFamily: 'ui-monospace, monospace',
                      }}>
                        {detail.formula}
                      </div>
                    )}
                    {detail.lowValueWarning && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.6875rem', color: '#D98080', lineHeight: 1.5 }}>
                        ⚠ {detail.lowValueWarning}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- 确认 ---------- */}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={!validation.ok}
        style={{
          width: '100%', padding: '0.875rem', borderRadius: 8, border: 'none',
          background: validation.ok ? C.gold : '#3A3630',
          color: validation.ok ? '#0A0A0F' : '#6B6258',
          fontWeight: 700, fontSize: '1.0625rem',
          cursor: validation.ok ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s ease',
        }}
      >
        {isRandomSelected ? '🎲 接受命运，接过火炬' : '⚔️ 确认创建，接过火炬'}
      </button>

      {!validation.ok && (
        <p style={{
          textAlign: 'center', fontSize: '0.8125rem', marginTop: '0.5rem',
          color: remainingCost < 0 ? C.danger : C.dim,
          fontWeight: remainingCost < 0 ? 700 : 400,
        }}>
          {remainingCost < 0 ? '⛔ ' : ''}{validation.msg}
        </p>
      )}
      {validation.ok && remainingCost > 0 && (
        <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: C.dim, marginTop: '0.5rem' }}>
          仍有 {remainingCost} 点未分配，确认后将被浪费
        </p>
      )}
    </div>
  );
}
