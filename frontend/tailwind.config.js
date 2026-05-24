/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/pages/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Deep "obsidian-blue" surface palette. Slight cool tint so it never
        // reads as plain charcoal grey like a stock Tailwind theme.
        ink: {
          950: '#03061a',
          900: '#070b22',
          850: '#0a1030',
          800: '#0d1538',
          700: '#16224a',
          600: '#1f2f5e',
          500: '#2c4181',
        },
        // USDC cobalt-blue brand accent (kept) with a brighter electric
        // companion for hover/CTA glow.
        accent: {
          50: '#eaf3fc',
          100: '#d4e7f9',
          200: '#a9cff3',
          300: '#7eb7ed',
          400: '#4a98ee',
          500: '#2775ca',
          600: '#1f5da2',
          700: '#174479',
          800: '#102d51',
        },
        // Actual casino-chip gold. Used for "house/bankroll" highlights so the
        // page has warmth alongside the blue.
        gold: {
          300: '#fde68a',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        // USDC's secondary brand green. Used for win / payout states.
        mint: {
          300: '#7cf2c8',
          400: '#46e3b1',
          500: '#22c994',
          600: '#15a378',
          700: '#0f7a5b',
        },
        // Used for burn / loss messaging.
        ember: {
          400: '#fb923c',
          500: '#ef4444',
          600: '#b91c1c',
        },
      },
      fontFamily: {
        display: [
          'var(--font-display)',
          '"Bricolage Grotesque"',
          'system-ui',
          'sans-serif',
        ],
        body: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
        mono: [
          'var(--font-mono)',
          '"JetBrains Mono"',
          'ui-monospace',
          'monospace',
        ],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      boxShadow: {
        glow: '0 0 60px -12px rgba(39, 117, 202, 0.55)',
        'glow-strong':
          '0 0 80px -10px rgba(74, 152, 238, 0.7), inset 0 0 0 1px rgba(74, 152, 238, 0.25)',
        gold: '0 0 50px -12px rgba(245, 158, 11, 0.55)',
        mint: '0 0 50px -12px rgba(34, 201, 148, 0.55)',
        // Subtle inset highlight that gives cards a layered glass feel.
        sheen: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.06)',
      },
      backgroundImage: {
        'felt-gradient':
          'radial-gradient(ellipse at top, rgba(39, 117, 202, 0.32), transparent 55%), radial-gradient(ellipse at bottom, rgba(34, 201, 148, 0.10), transparent 60%)',
        'grid-faint':
          "linear-gradient(rgba(74, 152, 238, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(74, 152, 238, 0.06) 1px, transparent 1px)",
        'noise-soft':
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>\")",
      },
      backgroundSize: {
        'grid-32': '32px 32px',
      },
    },
  },
  plugins: [],
};
