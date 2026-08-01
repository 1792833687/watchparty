/**
 * v5.1.0 技术美术优化 — AI 场景插图组件（SVG 分层插画版）
 * 基于 scene-art.ts 的场景艺术配置，程序化生成分层场景：
 *   天空渐变 → 光晕 → 远层剪影 → 近层剪影 → 粒子（CSS 动画）→ 雾带
 * 纯 SVG 程序化美术，零图片资产、零外部请求，静态导出天然兼容。
 * 粒子动画走 CSS keyframes（fx-*），可被全局 prefers-reduced-motion 统一灭活。
 * @module components/game/SceneImage
 */
'use client';

import React, { useId, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  PARTICLE_COLORS,
  SCENE_ART,
  detectSceneKeyword,
  generateParticles,
  pillarPath,
  pinePath,
  ridgePath,
  spikePath,
  stalactitePath,
  towersPath,
} from './scene-art';
import type { ParticleKind, SceneKey } from './scene-art';

interface SceneImageProps {
  /** 场景关键词（原始文本即可，内部自动检测） */
  scene?: string;
  /** 是否显示 */
  visible?: boolean;
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 位置（inline/banner/panel） */
  placement?: 'inline' | 'banner';
}

/** 粒子种类 → CSS 动画类（fx-* 定义于 globals.css） */
const PARTICLE_CLASS: Record<ParticleKind, string> = {
  snow: 'fx-drift-snow',
  ember: 'fx-drift-ember',
  firefly: 'fx-drift-firefly',
  star: 'fx-star-twinkle',
  fog: 'fx-drift-fog',
  dust: 'fx-drift-dust',
};

const VIEWBOX = { w: 400, h: 120 };

export function SceneImage({
  scene = '',
  visible = true,
  size = 'sm',
  placement = 'inline',
}: SceneImageProps): React.ReactElement | null {
  const [loaded, setLoaded] = useState(false);
  // 渐变 id 防多实例冲突（useId 在 SSR/客户端保持一致）
  const rawUid = useId();
  const uid = rawUid.replace(/[^a-zA-Z0-9]/g, '');

  if (!visible) return null;

  const art = SCENE_ART[detectSceneKeyword(scene)] ?? SCENE_ART.default;
  const hMap = { sm: 80, md: 140, lg: 200 };
  const height = hMap[size];

  // 触发入场动画（fx-scene-in）
  if (!loaded) {
    setTimeout(() => setLoaded(true), 50);
  }

  const skyGrad = `${uid}-sky`;
  const glowGrad = `${uid}-glow`;
  const fogGrad = `${uid}-fog`;

  return (
    <div
      className={loaded ? 'scene-canvas fx-scene-in' : 'scene-canvas'}
      style={{
        borderRadius: 8,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px solid ${art.accent}25`,
        margin: placement === 'banner' ? '0 0 0.75rem 0' : '0.25rem 0',
        overflow: 'hidden',
        opacity: loaded ? 1 : 0,
        position: 'relative',
        background: art.sky[art.sky.length - 1],
      }}
    >
      <svg
        viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
        preserveAspectRatio="xMidYMax slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
        aria-label={`场景插画：${art.label}`}
        role="img"
      >
        <defs>
          <linearGradient id={skyGrad} x1="0" y1="0" x2="0" y2="1">
            {art.sky.map((c, i) => (
              <stop key={i} offset={`${(i / (art.sky.length - 1)) * 100}%`} stopColor={c} />
            ))}
          </linearGradient>
          {art.glow && (
            <radialGradient id={glowGrad}>
              <stop offset="0%" stopColor={art.glow.color} stopOpacity={art.glow.opacity ?? 0.5} />
              <stop offset="100%" stopColor={art.glow.color} stopOpacity="0" />
            </radialGradient>
          )}
          <linearGradient id={fogGrad} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={art.fog} stopOpacity="0.85" />
            <stop offset="100%" stopColor={art.fog} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 1. 天空 */}
        <rect x="0" y="0" width={VIEWBOX.w} height={VIEWBOX.h} fill={`url(#${skyGrad})`} />
        {/* 2. 光晕 */}
        {art.glow && (
          <circle cx={art.glow.cx} cy={art.glow.cy} r={art.glow.r} fill={`url(#${glowGrad})`} />
        )}
        {/* 3. 远层山脊剪影 */}
        {art.ridges?.map((r, i) => (
          <path key={i} d={ridgePath(r.peaks, r.baseY)} fill={r.color} opacity={r.opacity ?? 1} />
        ))}
        {/* 4. 近层剪影：树 / 塔 / 柱 / 刺 / 钟乳石 */}
        {art.trees?.map((t, i) => (
          <path key={`t${i}`} d={pinePath(t.x, t.size, VIEWBOX.h)} fill={t.color} />
        ))}
        {art.towers && art.towers.length > 0 && (
          <path
            d={towersPath(art.towers.map((t) => ({ x: t.x, w: t.w, h: t.h })), VIEWBOX.h)}
            fill={art.towers[0]!.color}
          />
        )}
        {art.pillars?.map((p, i) => (
          <path key={`p${i}`} d={pillarPath(p.x, p.w, p.h, VIEWBOX.h)} fill={p.color} />
        ))}
        {art.spikes?.map((s, i) => (
          <path key={`s${i}`} d={spikePath(s.x, s.h, VIEWBOX.h)} fill={s.color} />
        ))}
        {art.stalactites?.map((s, i) => (
          <path key={`st${i}`} d={stalactitePath(s.x, s.h)} fill={s.color} />
        ))}
        {/* 5. 粒子（CSS 动画，seed 固定保证 SSR/客户端一致） */}
        {art.particles.map((spec, gi) => (
          <g key={gi} opacity={spec.opacity}>
            {generateParticles(spec, gi * 131 + art.key.length * 7).map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={spec.kind === 'fog' || spec.kind === 'dust' ? p.r * 3 : p.r}
                fill={PARTICLE_COLORS[spec.kind]}
                className={`fx-particle ${PARTICLE_CLASS[spec.kind]}`}
                style={
                  {
                    '--delay': `${p.delay}s`,
                    '--dur': `${p.duration}s`,
                  } as CSSProperties
                }
              />
            ))}
          </g>
        ))}
        {/* 6. 底部雾带 */}
        <rect x="0" y={VIEWBOX.h * 0.65} width={VIEWBOX.w} height={VIEWBOX.h * 0.35} fill={`url(#${fogGrad})`} />
      </svg>

      {size !== 'sm' && (
        <span
          style={{
            position: 'absolute', bottom: 6, right: 10,
            fontSize: '0.5625rem', color: art.accent, opacity: 0.55,
            fontFamily: "'Cinzel','Georgia',serif",
            letterSpacing: '0.08em',
          }}
        >
          {art.label}
        </span>
      )}
    </div>
  );
}

export default SceneImage;

/** 类型重导出：供调用方在需要时引用场景 key */
export type { SceneKey };
