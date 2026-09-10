import { parseCSV } from './lib/analytics.js'
import fs from 'fs'

const csv = fs.readFileSync('/root/.claude/uploads/ac296e13-4b21-5b67-a3b8-96427034f869/362e5c29-chaturbate_2026_csv.csv', 'utf-8')
const parsed = parseCSV(csv)

console.log(`\nPARSER OUTPUT:\n${'='.repeat(70)}`)
console.log(`Total rows parsed: ${parsed.length}`)
console.log(`First 5 rows:`)
parsed.slice(0, 5).forEach((r, i) => {
  console.log(`[${i}] user=${r.username} tokens=${r.tokens} usd=${r.usd}`)
})

console.log(`\nLast 5 rows:`)
parsed.slice(-5).forEach((r, i) => {
  console.log(`[${parsed.length-5+i}] user=${r.username} tokens=${r.tokens} usd=${r.usd}`)
})

let totalUsd = 0, totalTokens = 0, uniqueFans = new Set()
parsed.forEach(r => {
  totalUsd += r.usd
  totalTokens += r.tokens
  uniqueFans.add(r.username)
})

console.log(`\nTOTALS:`)
console.log(`Rows: ${parsed.length}`)
console.log(`Unique fans: ${uniqueFans.size}`)
console.log(`Total tokens: ${totalTokens}`)
console.log(`Total USD: $${totalUsd.toFixed(2)}`)

console.log(`\nEXPECTED vs ACTUAL:`)
console.log(`Expected: 117 tips, 23 fans, 1772 tokens, $88.60`)
console.log(`Parser gave: ${parsed.length} tips, ${uniqueFans.size} fans, ${totalTokens} tokens, $${totalUsd.toFixed(2)}`)
