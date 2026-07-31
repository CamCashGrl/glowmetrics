/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        // Live Mode / dark-neon design tokens — see components/live/* and
        // app/live/page.js, which reference these same hex values inline
        // (the codebase renders with inline styles, not Tailwind classes;
        // these tokens exist so the palette has one documented source).
        'cc-bg': '#030812',
        'cc-bg-secondary': '#070B17',
        'cc-panel': '#0A0D1B',
        'cc-card': '#12121F',
        'cc-surface': '#1A1D2E',
        'cc-border': '#24283A',
        'cc-border-strong': '#34384D',
        'cc-text': '#F7F7FB',
        'cc-text-secondary': '#A1A7BA',
        'cc-text-muted': '#70788E',
        'cc-magenta': '#E82AB8',
        'cc-magenta-dark': '#B91C8F',
        'cc-purple': '#8B5CF6',
        'cc-cyan': '#19CFF4',
        'cc-teal': '#10D8B0',
        'cc-green': '#19D39A',
        'cc-orange': '#FF9B22',
        'cc-yellow': '#FFC62E',
        'cc-red': '#FF4D5E',
      },
      borderRadius: {
        'cc-sm': '10px',
        'cc-md': '12px',
        'cc-lg': '14px',
      },
    },
  },
  plugins: [],
}
