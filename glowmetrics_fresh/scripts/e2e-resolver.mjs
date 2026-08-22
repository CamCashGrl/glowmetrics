import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve as presolve } from 'node:path'
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.(js|mjs|cjs|json)$/.test(specifier) && context.parentURL?.startsWith('file:')) {
    const base = dirname(fileURLToPath(context.parentURL))
    for (const cand of [specifier + '.js', specifier + '/index.js']) {
      const p = presolve(base, cand)
      if (existsSync(p)) return next(pathToFileURL(p).href, context)
    }
  }
  return next(specifier, context)
}
