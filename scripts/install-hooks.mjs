#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const hooksDir = path.join(rootDir, '.git/hooks')

console.log('🔧 Installing Git Hooks...\n')

// Pre-commit hook content
const preCommitHook = `#!/bin/bash

# CamCash Pre-Commit Hook
# Prevents commits if tests fail or coverage is below threshold

echo "🧪 Running pre-commit test check..."

cd "$(git rev-parse --show-toplevel)"

# Colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

# Run tests
cd glowmetrics_fresh
npm run test:ci > /tmp/pre-commit-test.log 2>&1
TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -ne 0 ]; then
  echo -e "\${RED}❌ COMMIT BLOCKED: Tests failed\${NC}"
  echo ""
  echo "Last 50 lines of test output:"
  tail -50 /tmp/pre-commit-test.log
  echo ""
  echo -e "\${YELLOW}To bypass (not recommended):\${NC}"
  echo "  git commit --no-verify"
  echo ""
  echo -e "\${YELLOW}To fix:\${NC}"
  echo "  npm run test:ci"
  echo "  npm run test:debug  (for interactive debugging)"
  echo ""
  exit 1
fi

# Check coverage threshold
if [ -f "test-results/coverage/coverage-summary.json" ]; then
  COVERAGE=$(grep -o '"lines": [0-9.]*' < test-results/coverage/coverage-summary.json | head -1 | grep -o '[0-9.]*')

  if (( $(echo "$COVERAGE < 60" | bc -l) )); then
    echo -e "\${RED}❌ COMMIT BLOCKED: Coverage below 60% (current: \${COVERAGE}%)\${NC}"
    echo ""
    echo "View coverage details:"
    echo "  open coverage/index.html"
    echo ""
    exit 1
  fi

  echo -e "\${GREEN}✅ Tests passed (Coverage: \${COVERAGE}%)\${NC}"
else
  echo -e "\${GREEN}✅ Tests passed\${NC}"
fi

echo ""
exit 0
`

try {
  // Ensure hooks directory exists
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true })
  }

  // Write pre-commit hook
  const preCommitPath = path.join(hooksDir, 'pre-commit')
  fs.writeFileSync(preCommitPath, preCommitHook)
  fs.chmodSync(preCommitPath, 0o755)
  console.log('✅ Installed pre-commit hook')
  console.log(`   Location: ${preCommitPath}`)

  console.log('\n✨ Git hooks installed successfully!\n')
  console.log('📋 Next steps:')
  console.log('   1. Set up Slack webhook (see SLACK_SETUP.md)')
  console.log('   2. Try committing: git commit -m "test"')
  console.log('   3. Tests will run automatically\n')
} catch (err) {
  console.error('❌ Error installing hooks:', err.message)
  process.exit(1)
}
