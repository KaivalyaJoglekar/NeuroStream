import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Core Neutrals
        bg: '#030305',
        panel: '#0A0A0E',
        elevated: '#0A0A0E',
        card: '#101117',
        border: '#22232E',
        stroke: '#22232E',
        divider: '#1A1B24',

        // Text
        textPrimary: '#FFFFFF',
        textForeground: '#E2E2E6',
        textMuted: '#8F90A6',

        // Brand Axis (Iris)
        brand: '#635BFF',
        'brand-light': '#7B74FF',
        'brand-dark': '#4A42DD',
        'brand-glow': '#332D8A',
        'brand-wash': '#16153B',
        'brand-border': '#3D369E',

        // Semantics
        danger: '#E11D48',
        warning: '#F5A524',
        success: '#10B981',

        // System fallbacks
        background: '#030305',
        foreground: '#FFFFFF',
        primary: '#635BFF',
        'primary-foreground': '#030305',
        secondary: '#101117',
        'muted-foreground': '#8F90A6',
      },
      boxShadow: {
        panel: '0 24px 64px rgba(0, 0, 0, 0.6)',
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
        glow: '0 0 40px rgba(99, 91, 255, 0.12)',
        neon: '0 0 15px rgba(99, 91, 255, 0.2), 0 0 40px rgba(99, 91, 255, 0.1)',
      },
      backgroundImage: {
        ambient: 'none',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-brand': 'linear-gradient(to bottom right, #7B74FF, #4A42DD)',
      },
      fontFamily: {
        display: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        fantomen: ['var(--font-fantomen)', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tighter: '-0.03em',
        tight: '-0.02em',
        normal: '0em',
        wide: '0.02em',
        widest: '0.1em',
      },
    },
  },
  plugins: [],
};

export default config;
