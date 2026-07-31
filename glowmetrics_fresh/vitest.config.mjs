import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // This codebase (like the rest of the Next.js app) writes JSX in plain
  // .js files rather than .jsx, relying on Next's own compiler — Vite's
  // esbuild pipeline only auto-detects JSX in .jsx/.tsx. `include` alone
  // isn't enough: Vite's esbuild plugin excludes .js by default regardless
  // of `include`, so that default exclusion has to be cleared explicitly
  // too, or component files under app/ and components/ fail to parse.
  esbuild: {
    loader: 'jsx',
    include: /\.(js|jsx)$/,
    exclude: [],
  },
  test: {
    environment: 'jsdom',
    include: ['__tests__/**/*.test.{js,jsx}'],
    setupFiles: ['./__tests__/setup.js'],
  },
})
