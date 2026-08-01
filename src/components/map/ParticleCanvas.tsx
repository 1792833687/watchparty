/**
 * @file ParticleCanvas — Canvas 2D 粒子叠加层 — Epic 4.7
 * @description
 * 覆盖在地图图块层上方的 30fps Canvas 2D 粒子系统。
 * pointer-events: none 透传鼠标事件。
 *
 * 四种主题粒子配置:
 *   forest — 飘落树叶 + 斑驳光点
 *   cave   — 荧光孢子 + 滴水粒子
 *   town   — 炊烟 + 灯火闪烁
 *   water  — 波纹 + 泡沫
 *
 * 性能降级: navigator.hardwareConcurrency ≤ 4 → 粒子数量减半
 *
 * @see design/gdd/map-system.md §2.5
 * @see docs/architecture/adr/002-map-rendering.md
 */

import React, { useRef, useEffect, useCallback } from 'react';
import type { MapTheme } from '@/systems/map/types';
import { THEME_PALETTES } from '@/systems/map/types';

// ============================================================
// 类型
// ============================================================

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
}

interface ParticleConfig {
  count: number;
  colors: string[];
  minSize: number;
  maxSize: number;
  minLife: number;
  maxLife: number;
  /** 水平速度范围 */
  velocityX: [number, number];
  /** 垂直速度范围 */
  velocityY: [number, number];
  /** 发射区域相对 canvas 的比例 */
  spawnMargin: number;
}

export interface ParticleCanvasProps {
  /** 画布宽度 */
  width: number;
  /** 画布高度 */
  height: number;
  /** 地图主题 */
  theme?: MapTheme;
  /** 是否暂停（地图不可见时） */
  paused?: boolean;
  /** 粒子密度系数 (0-1, 默认 1.0) */
  density?: number;
}

// ============================================================
// 主题粒子配置
// ============================================================

function getParticleConfig(theme: MapTheme, density: number): ParticleConfig {
  const base: Record<MapTheme, ParticleConfig> = {
    forest: {
      count: 40,
      colors: ['#A8D870', '#E8D48B', '#C8E880', '#FFFFFF'],
      minSize: 1.5,
      maxSize: 4,
      minLife: 2000,
      maxLife: 6000,
      velocityX: [-0.3, 0.3],
      velocityY: [0.2, 0.8],
      spawnMargin: 0.1,
    },
    cave: {
      count: 25,
      colors: ['#7B6FDF', '#4ECDC4', '#A39BF0', '#FFFFFF'],
      minSize: 1,
      maxSize: 3,
      minLife: 3000,
      maxLife: 8000,
      velocityX: [-0.2, 0.2],
      velocityY: [-0.4, -0.1],
      spawnMargin: 0.15,
    },
    town: {
      count: 20,
      colors: ['#F0D080', '#E8A040', '#FFFFFF', '#F5C060'],
      minSize: 2,
      maxSize: 6,
      minLife: 1500,
      maxLife: 4000,
      velocityX: [-0.15, 0.15],
      velocityY: [-1.0, -0.3],
      spawnMargin: 0.2,
    },
    water: {
      count: 35,
      colors: ['#8BC4EA', '#C8E8F8', '#FFFFFF', '#5B8CBE'],
      minSize: 1,
      maxSize: 3,
      minLife: 1000,
      maxLife: 3000,
      velocityX: [-0.1, 0.1],
      velocityY: [-0.1, 0.1],
      spawnMargin: 0.05,
    },
  };

  const config = base[theme];
  return {
    ...config,
    count: Math.max(5, Math.round(config.count * density)),
  };
}

// ============================================================
// 组件
// ============================================================

export const ParticleCanvas: React.FC<ParticleCanvasProps> = ({
  width,
  height,
  theme = 'forest',
  paused = false,
  density: densityOverride,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const fpsInterval = 1000 / 30; // 30fps

  // 性能降级检测
  const effectiveDensity = useCallback((): number => {
    if (densityOverride !== undefined) return densityOverride;
    const cores = navigator.hardwareConcurrency ?? 4;
    if (cores <= 2) return 0.25;
    if (cores <= 4) return 0.5;
    return 1.0;
  }, [densityOverride]);

  // 初始化/重置粒子
  const initParticles = useCallback(() => {
    const density = effectiveDensity();
    const config = getParticleConfig(theme, density);
    const particles: Particle[] = [];

    for (let i = 0; i < config.count; i++) {
      particles.push(createParticle(width, height, config));
    }

    particlesRef.current = particles;
  }, [width, height, theme, effectiveDensity]);

  // 更新 & 绘制循环
  const animate = useCallback(
    (timestamp: number) => {
      if (paused) {
        frameRef.current = requestAnimationFrame(animate);
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 帧率控制
      const elapsed = timestamp - lastTimeRef.current;
      if (elapsed < fpsInterval) {
        frameRef.current = requestAnimationFrame(animate);
        return;
      }
      lastTimeRef.current = timestamp - (elapsed % fpsInterval);

      // 清空画布
      ctx.clearRect(0, 0, width, height);

      // 更新 & 绘制粒子
      const density = effectiveDensity();
      const config = getParticleConfig(theme, density);
      const particles = particlesRef.current;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;

        // 更新位置
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 16.67; // ~60fps delta

        // 生命周期结束 → 重置
        if (p.life <= 0) {
          const newP = createParticle(width, height, config);
          particles[i] = newP;
          continue;
        }

        // 绘制
        const lifeRatio = p.life / p.maxLife;
        const alpha = lifeRatio < 0.2 
          ? p.alpha * (lifeRatio / 0.2)  // 淡出
          : lifeRatio > 0.8
            ? p.alpha * ((1 - lifeRatio) / 0.2)  // 淡入
            : p.alpha;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // 微光光晕
        if (p.size > 2) {
          ctx.globalAlpha = alpha * 0.3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      frameRef.current = requestAnimationFrame(animate);
    },
    [width, height, theme, paused, effectiveDensity, fpsInterval]
  );

  // Canvas 尺寸变化 → 重新初始化
  useEffect(() => {
    initParticles();
  }, [initParticles]);

  // 动画循环
  useEffect(() => {
    lastTimeRef.current = performance.now();
    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [animate]);

  // 暂停/恢复
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (paused) {
      canvas.style.opacity = '0';
    } else {
      canvas.style.opacity = '1';
    }
  }, [paused]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 12,
        transition: 'opacity 0.3s ease',
      }}
      aria-hidden="true"
    />
  );
};

// ============================================================
// 粒子工厂
// ============================================================

function createParticle(
  width: number,
  height: number,
  config: ParticleConfig
): Particle {
  const margin = config.spawnMargin;
  const mx = width * margin;
  const my = height * margin;

  return {
    x: mx + Math.random() * (width - 2 * mx),
    y: my + Math.random() * (height - 2 * my),
    vx: config.velocityX[0] + Math.random() * (config.velocityX[1] - config.velocityX[0]),
    vy: config.velocityY[0] + Math.random() * (config.velocityY[1] - config.velocityY[0]),
    life: Math.random() * config.maxLife,
    maxLife: config.minLife + Math.random() * (config.maxLife - config.minLife),
    size: config.minSize + Math.random() * (config.maxSize - config.minSize),
    color: config.colors[Math.floor(Math.random() * config.colors.length)]!,
    alpha: 0.3 + Math.random() * 0.5,
  };
}
