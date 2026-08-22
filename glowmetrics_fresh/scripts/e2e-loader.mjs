// Registers a resolver so the REAL production modules (which use extensionless
// relative imports, e.g. lib/analytics.js -> './constants') load under plain
// Node ESM. Test-harness plumbing only; nothing here affects the app.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
register('./e2e-resolver.mjs', pathToFileURL(import.meta.filename))
