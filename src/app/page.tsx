/**
 * Landing Page — AI Narrator Game
 *
 * v4.2.0 重设计标题界面：
 * - 视觉层次：徽章 → 主标题（金渐变）→ 副标题 → 描述 → 特色卡片 → 操作区 → 版本脚注
 * - 背景氛围：多重视觉层（光晕 / 雪山轮廓 / 星火粒子 / 网格）
 * - 交互：按钮 hover 发光位移、卡片 hover 上浮、微动效
 *
 * Static Site Generation (SSG). SEO-friendly dark-themed landing page.
 */

import type { Metadata } from 'next';
import { LandingActions } from '@/components/landing/LandingActions';

export const metadata: Metadata = {
  title: 'AI Narrator Game — AI GM 驱动的文字冒险',
  description:
    'AI Narrator Game 将桌游主持人的灵魂注入 AI。探索手绘风格的地图，与 AI Game Master 自由对话，每一次选择都在世界中留下不可逆的痕迹。',
  openGraph: {
    title: 'AI Narrator Game',
    description: 'AI GM 驱动的文字冒险游戏 — 你的故事，由 AI 讲述',
    type: 'website',
  },
};

/** Force static generation */
export const dynamic = 'force-static';

const FEATURES = [
  {
    icon: '🏰',
    title: '凛冬要塞',
    desc: '六大区域渐进解锁，领地经营与围城战',
    accent: 'text-accent-gold',
  },
  {
    icon: '🎭',
    title: 'AI 主持人',
    desc: '主动引导叙事，D20 检定、暗影低语、多结局',
    accent: 'text-accent-magic',
  },
  {
    icon: '📖',
    title: '世界书',
    desc: '权威设定可编辑，AI 叙事永不偏离主线',
    accent: 'text-accent-success',
  },
] as const;

export default function LandingPage(): React.ReactElement {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg-deep">
      {/* ── 背景氛围层 ── */}
      <div className="pointer-events-none absolute inset-0">
        {/* 中央光晕 */}
        <div
          className="absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25"
          style={{
            background:
              'radial-gradient(circle, var(--accent-gold-dim) 0%, rgba(201,169,78,0.05) 40%, transparent 72%)',
          }}
        />
        {/* 底部冷光（凛冬基调） */}
        <div
          className="absolute left-1/2 bottom-[-280px] h-[560px] w-[900px] -translate-x-1/2 rounded-full opacity-15"
          style={{
            background:
              'radial-gradient(ellipse, var(--accent-magic-dim) 0%, transparent 65%)',
          }}
        />
        {/* 雪山轮廓（SVG 剪影，非图片资源） */}
        <svg
          className="absolute inset-x-0 bottom-0 h-[36vh] w-full opacity-[0.16]"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M0,240 L140,120 L260,200 L380,80 L520,210 L640,140 L780,220 L900,90 L1060,200 L1180,130 L1320,220 L1440,140 L1440,320 L0,320 Z"
            fill="none"
            stroke="var(--accent-gold)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M0,280 L180,190 L320,260 L460,170 L600,250 L760,180 L920,260 L1080,200 L1240,270 L1440,210 L1440,320 L0,320 Z"
            fill="none"
            stroke="var(--accent-magic)"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
        {/* 星火粒子（纯 CSS 动画） */}
        <div className="absolute inset-0">
          {[
            { l: '12%', t: '22%', d: '0s' },
            { l: '22%', t: '68%', d: '1.2s' },
            { l: '38%', t: '14%', d: '2.4s' },
            { l: '55%', t: '72%', d: '0.6s' },
            { l: '68%', t: '20%', d: '1.8s' },
            { l: '82%', t: '62%', d: '3s' },
            { l: '90%', t: '30%', d: '2.1s' },
            { l: '48%', t: '36%', d: '3.6s' },
          ].map((dot, i) => (
            <span
              key={i}
              className="absolute h-[3px] w-[3px] rounded-full"
              style={{
                left: dot.l,
                top: dot.t,
                background: 'var(--accent-gold)',
                boxShadow: '0 0 8px var(--accent-gold-dim)',
                opacity: 0.5,
                animation: `landing-spark 4s ease-in-out infinite`,
                animationDelay: dot.d,
              }}
            />
          ))}
        </div>
        {/* 网格 */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(var(--border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      {/* ── 内容层 ── */}
      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-7 px-6 py-14 text-center">
        {/* 徽章 */}
        <div
          className="inline-flex items-center gap-2 rounded-full border border-accent-gold/30 bg-accent-gold/5 px-4 py-1.5 text-xs tracking-widest text-accent-gold"
          style={{ animation: 'landing-fade-up 0.6s ease both' }}
        >
          ✦ 暗影纪元 · 史诗吟游 · AI 主持 ✦
        </div>

        {/* 主标题 */}
        <div className="space-y-3" style={{ animation: 'landing-fade-up 0.7s 0.1s ease both' }}>
          <h1
            className="font-display text-4xl font-bold tracking-wider text-transparent sm:text-6xl lg:text-7xl"
            style={{
              backgroundImage:
                'linear-gradient(180deg, #F5E3B3 0%, var(--accent-gold) 45%, #8B6914 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 4px 24px rgba(201,169,78,0.25))',
            }}
          >
            凛冬要塞
          </h1>
          <div className="flex items-center justify-center gap-3 text-sm tracking-[0.35em] text-text-muted sm:text-base">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-accent-gold/50" />
            FROSTHOLD
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-accent-gold/50" />
          </div>
          <p className="text-base text-secondary sm:text-lg">AI 叙事文字冒险 · 你的故事由 AI 讲述</p>
        </div>

        {/* 描述 */}
        <p
          className="max-w-xl text-sm leading-relaxed text-text-primary/75 sm:text-base"
          style={{ animation: 'landing-fade-up 0.7s 0.2s ease both' }}
        >
          将桌游主持人的灵魂注入 AI。探索地图、经营领地、结盟对抗暗影——
          每一次选择都在世界中留下不可逆的痕迹，直到七个结局之一降临。
        </p>

        {/* 特色卡片 */}
        <div
          className="mt-2 grid w-full gap-4 sm:grid-cols-3 sm:gap-5"
          style={{ animation: 'landing-fade-up 0.7s 0.3s ease both' }}
        >
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-border-subtle bg-bg-panel/60 px-5 py-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent-gold/40 hover:bg-bg-panel hover:shadow-lg hover:shadow-black/40"
            >
              <div className="mb-2 text-3xl transition-transform duration-300 group-hover:scale-110">
                {feature.icon}
              </div>
              <h3 className={`mb-1 font-semibold text-text-primary ${feature.accent}`}>
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-secondary">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* 操作区 */}
        <div style={{ animation: 'landing-fade-up 0.7s 0.4s ease both' }}>
          <LandingActions />
        </div>
      </div>

      {/* 脚注 */}
      <footer className="absolute bottom-5 z-10 flex items-center gap-3 text-xs text-text-muted">
        <span>凛冬要塞 Frosthold</span>
        <span className="text-accent-gold/40">·</span>
        <span>v4.2.0</span>
        <span className="text-accent-gold/40">·</span>
        <span>纯前端 · DeepSeek</span>
      </footer>

      {/* 动效 keyframes */}
      <style>{`
        @keyframes landing-spark {
          0%, 100% { opacity: 0.15; transform: translateY(0); }
          50% { opacity: 0.65; transform: translateY(-6px); }
        }
        @keyframes landing-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
