/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './*.{ts,tsx}', './components/**/*.{ts,tsx}', './context/**/*.{ts,tsx}', './services/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}', './stores/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        /* Private Cinema Palette — Zinc-based, no blue undertones */
        background: '#09090B',   /* Void Black — deepest canvas */
        surface: '#111113',      /* Deep Surface — primary surface */
        'surface-mid': '#18181B',   /* Mid Surface — card cores, inputs */
        'surface-elevated': '#1C1C1F', /* Elevated Surface — hover, panels */
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
      },
      animation: {
        'fade-in': 'fadeIn 500ms cubic-bezier(0.32, 0.72, 0, 1)',
        'fade-in-up': 'fadeInUp 500ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-in-right': 'slideInRight 300ms cubic-bezier(0.32, 0.72, 0, 1)',
        'stagger-in': 'staggerIn 400ms cubic-bezier(0.32, 0.72, 0, 1) both',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        staggerIn: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.32, 0.72, 0, 1)',
        'spring-bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};
