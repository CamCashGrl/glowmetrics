import { defineConfig } from 'vitest/config'

// Minimal config, scoped to this feature's tests only — does not replace
// or interfere with .github/workflows/build-check.yml (lint + build),
// which does not run tests today.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.js', 'app/api/tax-organizer/**/*.test.js'],
  },
})
