/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
        },
        brand: {
          pink: 'hsl(var(--brand-pink))',
          purple: 'hsl(var(--brand-purple))',
          amber: 'hsl(var(--brand-amber))',
          teal: 'hsl(var(--brand-teal))',
        },
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      backgroundImage: {
        'gradient-brand':
          'linear-gradient(135deg, hsl(var(--brand-pink)), hsl(var(--brand-purple)), hsl(var(--brand-amber)))',
        'gradient-brand-soft':
          'linear-gradient(135deg, hsl(var(--brand-pink) / 0.18), hsl(var(--brand-purple) / 0.22), hsl(var(--brand-amber) / 0.16))',
      },
      boxShadow: {
        'soft':
          '0 1px 2px hsl(244 50% 10% / 0.06), 0 8px 30px -12px hsl(var(--brand-purple) / 0.18), 0 18px 60px -30px hsl(var(--brand-pink) / 0.22)',
        'soft-lg':
          '0 1px 2px hsl(244 50% 10% / 0.06), 0 16px 48px -16px hsl(var(--brand-purple) / 0.22), 0 30px 90px -40px hsl(var(--brand-pink) / 0.28)',
        'glow':
          '0 0 0 1px hsl(var(--brand-pink) / 0.25), 0 8px 30px -8px hsl(var(--brand-pink) / 0.35)',
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'gradient-x': 'gradient-x 8s ease infinite',
        'fade-up': 'fade-up 0.35s ease-out both',
      },
    },
  },
  plugins: [],
};
