// Scans for temporal-dead-zone bugs: a const/let referenced before its
// declaration on the SAME synchronous execution path. References inside a
// nested function body are skipped -- those run later, so they're legal.
const fs = require('fs')
const path = require('path')
const parser = require('@babel/parser')
let traverse = require('@babel/traverse')
traverse = traverse.default || traverse

const FN_TYPES = new Set([
  'FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression',
  'ObjectMethod', 'ClassMethod', 'ClassPrivateMethod',
])

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(js|jsx|mjs)$/.test(e.name)) out.push(p)
  }
  return out
}

// The function/program node that owns this path's execution context.
function owningFn(p) {
  let cur = p
  while (cur) {
    if (FN_TYPES.has(cur.node.type) || cur.node.type === 'Program') return cur.node
    cur = cur.parentPath
  }
  return null
}

const findings = []
const roots = process.argv.slice(2)

for (const root of roots) {
  if (!fs.existsSync(root)) continue
  for (const file of walk(root)) {
    let ast
    const src = fs.readFileSync(file, 'utf8')
    try {
      ast = parser.parse(src, {
        sourceType: 'unambiguous',
        plugins: ['jsx', 'typescript', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport'],
        errorRecovery: true,
      })
    } catch (e) { continue }

    traverse(ast, {
      Scope({ scope }) {
        for (const name of Object.keys(scope.bindings)) {
          const binding = scope.bindings[name]
          if (binding.kind !== 'const' && binding.kind !== 'let') continue
          const declStart = binding.path.node.start
          if (declStart == null) continue
          const declOwner = owningFn(binding.path)

          for (const ref of binding.referencePaths) {
            if (ref.node.start == null || ref.node.start >= declStart) continue
            // Skip the declaration's own identifier (export const X = ... counts
            // the exported binding as a reference at the same location).
            if (ref.node.loc && binding.path.node.loc &&
                ref.node.loc.start.line >= binding.path.node.loc.start.line) continue
            // Only a real TDZ error if the reference executes in the same
            // function body as the declaration (not deferred into a closure).
            if (owningFn(ref) !== declOwner) continue
            findings.push({
              file,
              name,
              useLine: ref.node.loc ? ref.node.loc.start.line : '?',
              declLine: binding.path.node.loc ? binding.path.node.loc.start.line : '?',
            })
          }
        }
      },
    })
  }
}

const seen = new Set()
const uniq = findings.filter(f => {
  const k = `${f.file}:${f.name}:${f.useLine}`
  if (seen.has(k)) return false
  seen.add(k)
  return true
})

if (!uniq.length) {
  console.log('CLEAN - no temporal-dead-zone violations found')
} else {
  console.log(`FOUND ${uniq.length} TDZ violation(s):\n`)
  for (const f of uniq) {
    console.log(`  ${f.file}`)
    console.log(`    '${f.name}' used at line ${f.useLine}, declared at line ${f.declLine}\n`)
  }
}
