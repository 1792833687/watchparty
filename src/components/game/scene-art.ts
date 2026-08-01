/**
 * v5.1.0 技术美术优化 — SVG 分层场景艺术库
 * 纯数据 + 纯函数模块（无 React/DOM 依赖），可被单元测试直接 import。
 *
 * 渲染约定：viewBox 统一 `0 0 400 120`，各层按 z 序：
 *   天空渐变 → 光晕 → 远层剪影（山脊） → 近层剪影（树/塔/柱/刺） → 粒子 → 雾带
 * 粒子位置用固定种子伪随机（SSR 与客户端 hydration 一致，不闪烁）。
 * @module components/game/scene-art
 */

export type SceneKey =
  | 'forest' | 'cave' | 'snow' | 'fire' | 'castle' | 'shadow'
  | 'mountain' | 'plains' | 'ruin' | 'default';

export type ParticleKind = 'snow' | 'ember' | 'firefly' | 'fog' | 'star' | 'dust';

export interface GlowSpec { cx: number; cy: number; r: number; color: string; opacity?: number }
export interface RidgeSpec { peaks: number[]; baseY: number; color: string; opacity?: number }
export interface TreeSpec { x: number; size: number; color: string }
export interface TowerSpec { x: number; w: number; h: number; color: string }
export interface PillarSpec { x: number; w: number; h: number; color: string }
export interface SpikeSpec { x: number; h: number; color: string }

export interface ParticleSpec { kind: ParticleKind; count: number; opacity: number }

export interface SceneArt {
  key: SceneKey;
  label: string;
  /** 天空渐变 stops（顶 → 底，3 段为佳） */
  sky: string[];
  /** 光晕（月 / 落日 / 火光 / 暗能量） */
  glow?: GlowSpec;
  /** 远层山脊剪影 */
  ridges?: RidgeSpec[];
  /** 近层松树阵 */
  trees?: TreeSpec[];
  /** 近层塔楼剪影 */
  towers?: TowerSpec[];
  /** 近层断柱 / 石笋 */
  pillars?: PillarSpec[];
  /** 尖刺（碳化树 / 石笋 / 草丛，从底向上） */
  spikes?: SpikeSpec[];
  /** 钟乳石（从顶垂下） */
  stalactites?: SpikeSpec[];
  /** 粒子 */
  particles: ParticleSpec[];
  /** 底部雾带颜色 */
  fog: string;
  /** 强调色（边框 / 标签） */
  accent: string;
}

/* ═══════════════ 剪影 path 生成器（viewBox 400×120） ═══════════════ */

const W = 400;
const H = 120;

/** 山脊：peaks 为各采样点高度，均匀分布 0..400，闭合到 baseY 底部 */
export function ridgePath(peaks: number[], baseY: number): string {
  const n = peaks.length;
  const xs = n === 1 ? [W / 2] : peaks.map((_, i) => (i / (n - 1)) * W);
  let d = `M 0 ${baseY}`;
  xs.forEach((x, i) => {
    d += ` L ${x.toFixed(1)} ${(baseY - (peaks[i] ?? 0)).toFixed(1)}`;
  });
  d += ` L ${W} ${baseY} Z`;
  return d;
}

/** 松树剪影：双三角树冠 + 树干，基点底部 */
export function pinePath(x: number, size: number, baseY: number): string {
  const top = baseY - size;
  const w = size * 0.58;
  return [
    `M ${x.toFixed(1)} ${top.toFixed(1)} L ${(x + w / 2).toFixed(1)} ${(top + size * 0.6).toFixed(1)} L ${(x - w / 2).toFixed(1)} ${(top + size * 0.6).toFixed(1)} Z`,
    `M ${(x - w * 0.3).toFixed(1)} ${(top + size * 0.52).toFixed(1)} L ${(x + w * 0.3).toFixed(1)} ${(top + size * 0.52).toFixed(1)} L ${(x + w * 0.64).toFixed(1)} ${(top + size * 0.82).toFixed(1)} L ${(x - w * 0.64).toFixed(1)} ${(top + size * 0.82).toFixed(1)} Z`,
    `M ${(x - w * 0.09).toFixed(1)} ${(top + size * 0.8).toFixed(1)} L ${(x + w * 0.09).toFixed(1)} ${(top + size * 0.8).toFixed(1)} L ${(x + w * 0.06).toFixed(1)} ${baseY} L ${(x - w * 0.06).toFixed(1)} ${baseY} Z`,
  ].join(' ');
}

/** 塔楼剪影：矩形主体 + 顶部城齿，底部闭合 */
export function towersPath(towers: { x: number; w: number; h: number }[], baseY: number): string {
  let d = '';
  for (const t of towers) {
    const top = baseY - t.h;
    d += `M ${t.x} ${baseY} L ${t.x} ${top}`;
    d += ` L ${t.x + t.w * 0.18} ${top} L ${t.x + t.w * 0.18} ${top - 4}`;
    d += ` L ${t.x + t.w * 0.42} ${top - 4} L ${t.x + t.w * 0.42} ${top}`;
    d += ` L ${t.x + t.w * 0.68} ${top} L ${t.x + t.w * 0.68} ${top - 4}`;
    d += ` L ${t.x + t.w * 0.86} ${top - 4} L ${t.x + t.w * 0.86} ${top}`;
    d += ` L ${t.x + t.w} ${top} L ${t.x + t.w} ${baseY}`;
  }
  return `${d} L ${W} ${baseY} L 0 ${baseY} Z`;
}

/** 断柱 / 石笋：底部矩形 + 顶缘不规则破损 */
export function pillarPath(x: number, w: number, h: number, baseY: number): string {
  const top = baseY - h;
  return [
    `M ${x} ${baseY} L ${x} ${top}`,
    `L ${x + w * 0.35} ${top} L ${x + w * 0.45} ${top - 5}`,
    `L ${x + w * 0.6} ${top - 2} L ${x + w * 0.8} ${top + 4}`,
    `L ${x + w} ${top + 2} L ${x + w} ${baseY} Z`,
  ].join(' ');
}

/** 尖刺（碳化树 / 草丛 / 石笋）：等腰三角，基部底部 */
export function spikePath(x: number, h: number, baseY: number): string {
  return `M ${(x - 4).toFixed(1)} ${baseY} L ${x} ${(baseY - h).toFixed(1)} L ${(x + 4).toFixed(1)} ${baseY} Z`;
}

/** 钟乳石：等腰三角，尖朝下，挂于顶部 */
export function stalactitePath(x: number, h: number): string {
  return `M ${(x - 4).toFixed(1)} 0 L ${x} ${h.toFixed(1)} L ${(x + 4).toFixed(1)} 0 Z`;
}

/* ═══════════════ 确定性粒子（SSR 安全） ═══════════════ */

/** mulberry32 固定种子伪随机 — 保证 SSR 与客户端渲染完全一致 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ParticleDot { x: number; y: number; r: number; delay: number; duration: number }

/** 按固定种子生成粒子坐标（确定性，不闪烁） */
export function generateParticles(spec: ParticleSpec, seed: number): ParticleDot[] {
  const rand = seededRandom(seed);
  const dots: ParticleDot[] = [];
  for (let i = 0; i < spec.count; i++) {
    dots.push({
      x: rand() * W,
      y: rand() * H,
      r: 0.5 + rand() * 1.6,
      delay: rand() * 6,
      duration: 4 + rand() * 8,
    });
  }
  return dots;
}

/** 粒子种类 → 填充色（fog/dust 走大半径低透明度） */
export const PARTICLE_COLORS: Record<ParticleKind, string> = {
  snow: '#C8D6E8',
  ember: '#E07030',
  firefly: '#9ACD7A',
  fog: '#7A6A9A',
  star: '#D8D8E8',
  dust: '#8A7A6A',
};

/* ═══════════════ 10 场景艺术配置 ═══════════════ */

export const SCENE_ART: Record<SceneKey, SceneArt> = {
  forest: {
    key: 'forest', label: '密林',
    sky: ['#07170E', '#0E2417', '#1B3323'],
    glow: { cx: 320, cy: 22, r: 26, color: '#4A7C3F', opacity: 0.32 },
    ridges: [{ peaks: [18, 30, 14, 26, 10], baseY: 86, color: '#15301F' }],
    trees: [
      { x: 34, size: 26, color: '#0B2313' }, { x: 82, size: 18, color: '#0E2A17' },
      { x: 128, size: 30, color: '#0B2313' }, { x: 196, size: 22, color: '#102E1A' },
      { x: 246, size: 28, color: '#0B2313' }, { x: 308, size: 20, color: '#0E2A17' },
      { x: 360, size: 26, color: '#0B2313' },
    ],
    particles: [{ kind: 'firefly', count: 8, opacity: 0.75 }],
    fog: '#07170E', accent: '#4A7C3F',
  },
  cave: {
    key: 'cave', label: '洞穴',
    sky: ['#050506', '#0E0C0A', '#171310'],
    glow: { cx: 200, cy: 62, r: 30, color: '#5E4E3E', opacity: 0.3 },
    stalactites: [
      { x: 30, h: 22, color: '#0A0808' }, { x: 96, h: 34, color: '#0D0A0A' },
      { x: 150, h: 18, color: '#0A0808' }, { x: 224, h: 38, color: '#0D0A0A' },
      { x: 288, h: 24, color: '#0A0808' }, { x: 356, h: 30, color: '#0D0A0A' },
    ],
    spikes: [
      { x: 60, h: 16, color: '#0B0908' }, { x: 170, h: 24, color: '#0E0B0A' },
      { x: 260, h: 14, color: '#0B0908' }, { x: 330, h: 20, color: '#0E0B0A' },
    ],
    particles: [{ kind: 'dust', count: 12, opacity: 0.4 }],
    fog: '#050506', accent: '#5E4E3E',
  },
  snow: {
    key: 'snow', label: '雪原',
    sky: ['#0A1526', '#14243A', '#21344C'],
    glow: { cx: 88, cy: 26, r: 20, color: '#8AACE0', opacity: 0.55 },
    ridges: [
      { peaks: [20, 32, 26, 40, 22, 34, 16], baseY: 94, color: '#1B2C42' },
      { peaks: [10, 18, 12, 22], baseY: 72, color: '#243A54', opacity: 0.6 },
    ],
    trees: [
      { x: 60, size: 24, color: '#16283E' }, { x: 150, size: 30, color: '#182C46' },
      { x: 250, size: 20, color: '#16283E' }, { x: 342, size: 26, color: '#182C46' },
    ],
    particles: [{ kind: 'snow', count: 16, opacity: 0.9 }],
    fog: '#0A1526', accent: '#8AACE0',
  },
  fire: {
    key: 'fire', label: '熔火',
    sky: ['#1A0803', '#2B1105', '#3D1A08'],
    glow: { cx: 200, cy: 66, r: 42, color: '#E07030', opacity: 0.55 },
    ridges: [{ peaks: [12, 8, 16, 6, 10], baseY: 92, color: '#200B03' }],
    spikes: [
      { x: 30, h: 26, color: '#180803' }, { x: 96, h: 34, color: '#1E0B04' },
      { x: 168, h: 22, color: '#180803' }, { x: 236, h: 30, color: '#1E0B04' },
      { x: 306, h: 24, color: '#180803' }, { x: 372, h: 30, color: '#1E0B04' },
    ],
    particles: [{ kind: 'ember', count: 14, opacity: 0.9 }],
    fog: '#1A0803', accent: '#E07030',
  },
  castle: {
    key: 'castle', label: '城堡',
    sky: ['#08081C', '#10102E', '#181838'],
    glow: { cx: 312, cy: 28, r: 16, color: '#E0CC85', opacity: 0.5 },
    towers: [
      { x: 34, w: 84, h: 50, color: '#12122C' },
      { x: 118, w: 118, h: 38, color: '#151532' },
      { x: 236, w: 66, h: 54, color: '#12122C' },
      { x: 302, w: 98, h: 34, color: '#151532' },
    ],
    particles: [{ kind: 'star', count: 14, opacity: 0.85 }],
    fog: '#08081C', accent: '#C9A94E',
  },
  shadow: {
    key: 'shadow', label: '暗影',
    sky: ['#090314', '#120628', '#1A0A32'],
    glow: { cx: 200, cy: 48, r: 34, color: '#7A3A8A', opacity: 0.35 },
    ridges: [{ peaks: [16, 26, 12, 30, 18, 24, 10], baseY: 92, color: '#160830' }],
    pillars: [
      { x: 56, w: 18, h: 40, color: '#100525' }, { x: 140, w: 26, h: 30, color: '#14072C' },
      { x: 252, w: 20, h: 44, color: '#100525' }, { x: 336, w: 24, h: 26, color: '#14072C' },
    ],
    particles: [{ kind: 'fog', count: 7, opacity: 0.5 }],
    fog: '#090314', accent: '#7A3A8A',
  },
  mountain: {
    key: 'mountain', label: '山脉',
    sky: ['#0C1322', '#182238', '#26304C'],
    glow: { cx: 200, cy: 40, r: 36, color: '#8A8AAE', opacity: 0.35 },
    ridges: [
      { peaks: [34, 46, 38, 52, 30, 20], baseY: 100, color: '#1A2440' },
      { peaks: [12, 20, 10, 16], baseY: 78, color: '#24304C', opacity: 0.55 },
    ],
    particles: [{ kind: 'star', count: 8, opacity: 0.7 }],
    fog: '#0C1322', accent: '#6A6A8A',
  },
  plains: {
    key: 'plains', label: '平原',
    sky: ['#241A08', '#33270E', '#3D3016'],
    glow: { cx: 324, cy: 16, r: 22, color: '#C8A44E', opacity: 0.5 },
    ridges: [{ peaks: [8, 12, 6, 14, 8], baseY: 90, color: '#2A200A' }],
    spikes: [
      { x: 40, h: 9, color: '#241C08' }, { x: 76, h: 6, color: '#2A200A' },
      { x: 118, h: 10, color: '#241C08' }, { x: 176, h: 7, color: '#2A200A' },
      { x: 224, h: 10, color: '#241C08' }, { x: 282, h: 6, color: '#2A200A' },
      { x: 336, h: 9, color: '#241C08' }, { x: 372, h: 6, color: '#2A200A' },
    ],
    particles: [{ kind: 'fog', count: 5, opacity: 0.35 }],
    fog: '#241A08', accent: '#8A8A5E',
  },
  ruin: {
    key: 'ruin', label: '废墟',
    sky: ['#1C0906', '#2B1008', '#341A0E'],
    glow: { cx: 158, cy: 62, r: 30, color: '#AA6A4A', opacity: 0.4 },
    ridges: [{ peaks: [10, 16, 8, 14, 6], baseY: 88, color: '#1F0B06' }],
    pillars: [
      { x: 64, w: 20, h: 46, color: '#1C0A06' }, { x: 118, w: 14, h: 30, color: '#220D08' },
      { x: 246, w: 22, h: 40, color: '#1C0A06' }, { x: 304, w: 16, h: 52, color: '#220D08' },
    ],
    particles: [{ kind: 'ember', count: 9, opacity: 0.7 }],
    fog: '#1C0906', accent: '#AA6A4A',
  },
  default: {
    key: 'default', label: '凛冬要塞',
    sky: ['#0B0B16', '#13131F', '#1A1A2A'],
    glow: { cx: 330, cy: 68, r: 38, color: '#C9A94E', opacity: 0.25 },
    ridges: [{ peaks: [10, 16, 8, 20, 12], baseY: 96, color: '#161624' }],
    particles: [{ kind: 'star', count: 12, opacity: 0.8 }],
    fog: '#0B0B16', accent: '#C9A94E',
  },
};

/* ═══════════════ 场景关键词检测（自 v4.1.0 SceneImage 迁出，逻辑不变） ═══════════════ */

export function detectSceneKeyword(text: string = ''): SceneKey {
  const lower = text.toLowerCase();
  if (lower.includes('forest') || lower.includes('密林') || lower.includes('森林') || lower.includes('木')) return 'forest';
  if (lower.includes('cave') || lower.includes('洞') || lower.includes('穴')) return 'cave';
  if (lower.includes('snow') || lower.includes('雪') || lower.includes('冰') || lower.includes('frost')) return 'snow';
  if (lower.includes('fire') || lower.includes('火') || lower.includes('炎') || lower.includes('灼')) return 'fire';
  if (lower.includes('castle') || lower.includes('城堡') || lower.includes('要塞') || lower.includes('fort')) return 'castle';
  if (lower.includes('shadow') || lower.includes('暗') || lower.includes('影') || lower.includes('黑')) return 'shadow';
  if (lower.includes('mountain') || lower.includes('山') || lower.includes('峰') || lower.includes('脊')) return 'mountain';
  if (lower.includes('plain') || lower.includes('平原') || lower.includes('荒')) return 'plains';
  if (lower.includes('ruin') || lower.includes('遗迹') || lower.includes('废墟')) return 'ruin';
  return 'default';
}

/** 文本是否命中具象场景（排除 default 兜底）——用于主叙事流判定是否配图 */
export function sceneMatches(text: string = ''): boolean {
  return detectSceneKeyword(text) !== 'default';
}

export default SCENE_ART;
