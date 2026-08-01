import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // 暗色主题色标 — 映射自 CSS 变量 (美术圣经 §3.1)
        'bg-deep': 'var(--bg-deep)',
        'bg-table': 'var(--bg-table)',
        'bg-panel': 'var(--bg-panel)',
        'bg-panel-raised': 'var(--bg-panel-raised)',
        'bg-input': 'var(--bg-input)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'text-narrative': 'var(--text-narrative)',
        'accent-gold': 'var(--accent-gold)',
        'accent-gold-dim': 'var(--accent-gold-dim)',
        'accent-magic': 'var(--accent-magic)',
        'accent-magic-glow': 'var(--accent-magic-glow)',
        'accent-danger': 'var(--accent-danger)',
        'accent-success': 'var(--accent-success)',
        'accent-info': 'var(--accent-info)',
        'border-subtle': 'var(--border-subtle)',
        'border-active': 'var(--border-active)',
        'shadow-panel': 'var(--shadow-panel)',
        'overlay-fog': 'var(--overlay-fog)',
        'overlay-modal': 'var(--overlay-modal)',
      },
      fontFamily: {
        narrative: ['"Crimson Text"', '"Noto Serif SC"', '"Source Han Serif SC"', 'Georgia', 'serif'],
        ui: ['"Inter"', '"Noto Sans SC"', '"Source Han Sans SC"', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', '"Noto Sans Mono SC"', 'monospace'],
        display: ['"Cinzel"', '"Noto Serif SC"', 'serif'],
      },
      fontSize: {
        display: ['2.5rem', { lineHeight: '1.2', fontWeight: '700' }],
        h1: ['1.75rem', { lineHeight: '1.3', fontWeight: '600' }],
        h2: ['1.375rem', { lineHeight: '1.35', fontWeight: '600' }],
        h3: ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        narrative: ['1.0625rem', { lineHeight: '1.75', fontWeight: '400' }],
        small: ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
        caption: ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
        stat: ['1.125rem', { lineHeight: '1.2', fontWeight: '600' }],
      },
      borderRadius: {
        panel: '12px',
        modal: '16px',
        tile: '8px',
      },
      spacing: {
        'topbar': '56px',
        'map-panel': '360px',
        'status-panel': '300px',
        'panel-gap': '12px',
        'panel-padding': '20px',
      },
      maxWidth: {
        narrative: '680px',
      },
      boxShadow: {
        panel: '0 4px 24px var(--shadow-panel)',
        modal: '0 8px 48px var(--shadow-panel)',
      },
      transitionTimingFunction: {
        'ui': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
