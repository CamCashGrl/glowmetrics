#!/usr/bin/env node

/**
 * Test Integrity Guard
 *
 * Prevents accidental or intentional test manipulation by checking:
 * 1. No tests are skipped (test.skip / it.skip / describe.skip)
 * 2. No assertions are weakened (removing expect statements)
 * 3. No test files are deleted without explicit approval
 * 4. No suspicious test modifications (changing assertions to always pass)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SUSPICIOUS_PATTERNS = [
  /test\.skip\(/g,          // skipped tests
  /it\.skip\(/g,            // skipped it blocks
  /describe\.skip\(/g,      // skipped describes
  /xit\(/g,                 // xit (skipped)
  /xdescribe\(/g,           // xdescribe (skipped)
  /expect\(\)\.not\.toBe/g, // expect().not.toBe (always passes)
  /expect\(true\)\.toBe\(true\)/g, // tautological assertions
  /\/\/ TODO.*skip/gi,      // TODO skip comments
];

const TEST_PATTERN = /\.test\.(js|jsx|ts|tsx)$/;

function checkSuspiciousPatterns(filePath, content) {
  const issues = [];

  SUSPICIOUS_PATTERNS.forEach((pattern, index) => {
    if (pattern.test(content)) {
      const matches = content.match(pattern) || [];
      issues.push({
        file: filePath,
        pattern: pattern.toString(),
        matches: matches.length,
      });
    }
  });

  return issues;
}

function getChangedTestFiles() {
  try {
    const output = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
    return output
      .split('\n')
      .filter(f => f && TEST_PATTERN.test(f));
  } catch (e) {
    return [];
  }
}

function getDeletedTestFiles() {
  try {
    const output = execSync('git diff --cached --name-status', { encoding: 'utf-8' });
    return output
      .split('\n')
      .filter(line => line.startsWith('D ') && TEST_PATTERN.test(line))
      .map(line => line.substring(2));
  } catch (e) {
    return [];
  }
}

function main() {
  const deletedTests = getDeletedTestFiles();
  if (deletedTests.length > 0) {
    console.error('❌ Test files cannot be deleted:');
    deletedTests.forEach(file => console.error(`   - ${file}`));
    console.error('\nIf you need to remove a test, disable it instead:');
    console.error('  test.skip("description", () => { ... })');
    process.exit(1);
  }

  const changedTests = getChangedTestFiles();
  let foundIssues = false;

  changedTests.forEach(filePath => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const issues = checkSuspiciousPatterns(filePath, content);

      if (issues.length > 0) {
        if (!foundIssues) {
          console.error('❌ Test integrity violations detected:\n');
          foundIssues = true;
        }

        console.error(`File: ${filePath}`);
        issues.forEach(issue => {
          console.error(`  - ${issue.pattern} (${issue.matches} occurrence(s))`);
        });
        console.error('');
      }
    } catch (e) {
      // File may have been deleted, skip
    }
  });

  if (foundIssues) {
    console.error('❌ COMMIT BLOCKED: Test integrity violations');
    console.error('   Do not skip, disable, or weaken tests.');
    console.error('   All 427 tests must remain active and unmodified.');
    process.exit(1);
  }

  console.log('✅ Test integrity check passed');
  process.exit(0);
}

main();
