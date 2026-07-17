/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Syne', 'Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        canvas: 'var(--mc-canvas)',
        surface: {
          DEFAULT: 'var(--mc-surface)',
          low: 'var(--mc-surface-low)',
          raised: 'var(--mc-surface-raised)',
          high: 'var(--mc-surface-high)',
          highest: 'var(--mc-surface-highest)',
        },
        content: {
          DEFAULT: 'var(--mc-text)',
          muted: 'var(--mc-text-muted)',
          subtle: 'var(--mc-text-subtle)',
        },
        cyber: {
          DEFAULT: 'rgb(var(--mc-primary-rgb) / <alpha-value>)',
          hover: 'rgb(var(--mc-primary-hover-rgb) / <alpha-value>)',
          soft: 'rgb(var(--mc-primary-soft-rgb) / <alpha-value>)',
          foreground: 'var(--mc-on-primary)',
          success: 'rgb(var(--mc-success-rgb) / <alpha-value>)',
          warning: 'rgb(var(--mc-warning-rgb) / <alpha-value>)',
          error: 'rgb(var(--mc-error-rgb) / <alpha-value>)',
          info: 'rgb(var(--mc-info-rgb) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'var(--mc-border)',
          strong: 'var(--mc-border-strong)',
          control: 'var(--mc-control-border)',
        },
      },
      borderRadius: {
        cyber: 'var(--mc-radius)',
        'cyber-lg': 'var(--mc-radius-lg)',
      },
      maxWidth: {
        content: '1440px',
      },
    },
  },
  plugins: [],
};
