import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // The project is plain JS (no .jsx extension) with JSX inside .js files,
  // matching Next.js's own babel handling. Vite's built-in esbuild
  // transform plugin excludes .js from JSX handling by default (its
  // default `exclude` is literally /\.js$/), so both `include` and
  // `exclude` need overriding here for JSX-in-.js to parse at all.
  plugins: [react()],
  esbuild: {
    loader: 'jsx',
    include: /\.(js|jsx)$/,
    exclude: [],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    globals: true,
  },
});
