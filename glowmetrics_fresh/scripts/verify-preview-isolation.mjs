// Verifies the Live Mode Preview (lib/livePreview/**, app/live/preview/**)
// never references any real backend call — no Supabase client, no fetch,
// no useLiveSessionEngine, no /api/live/* route. This repo has no test
// framework configured (see scripts/verify-estimated-hourly-rate.mjs for
// the same note), so this runs as a plain Node static-source scan instead
// of a unit test.
//
// Run: node scripts/verify-preview-isolation.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['lib/livePreview', 'app/live/preview'];

// Substrings that would indicate a real backend call leaking into the
// preview. Deliberately broad (not just import statements) since a call
// could be written as `window.fetch(...)` or dynamically constructed.
const FORBIDDEN_PATTERNS = [
  /from\s+['"].*supabase['"]/,
  /from\s+['"].*useLiveSessionEngine['"]/,
  /\bsupabase\s*\./,
  /\bfetch\s*\(/,
  /\/api\/live\//,
];

function collectFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) collectFiles(full, out);
    else if (/\.(js|jsx)$/.test(entry)) out.push(full);
  }
  return out;
}

let files = [];
for (const root of ROOTS) {
  try {
    files = files.concat(collectFiles(root));
  } catch (err) {
    console.error(`Could not read ${root}: ${err.message}`);
    process.exit(1);
  }
}

if (files.length === 0) {
  console.error('No preview files found — expected at least scenarios.js and usePreviewEngine.js.');
  process.exit(1);
}

// Strip `//`-style comment lines before scanning — this file's own header
// comments legitimately describe (in prose) the exact strings being
// forbidden, which would otherwise false-positive against itself.
function stripLineComments(src) {
  return src
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

let failed = false;
for (const file of files) {
  const code = stripLineComments(readFileSync(file, 'utf8'));
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(code)) {
      console.error(`FAIL: ${file} matches forbidden pattern ${pattern} — the preview must never call a real backend function.`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log(`OK: ${files.length} preview file(s) checked — no real Supabase/fetch/session-engine/API references found.`);
}
