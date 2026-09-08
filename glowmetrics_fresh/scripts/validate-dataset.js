#!/usr/bin/env node

/**
 * Dataset Validation Script
 *
 * Validates canonical analytics implementation against actual Chaturbate dataset.
 * Run with: node scripts/validate-dataset.js /path/to/chaturbate-csv-alltime.csv
 *
 * Verifies:
 * - Total distinct fans (platform:username composite keys)
 * - Total canonical sessions (60-minute gaps)
 * - Whale count ($50+ lifetime)
 * - Regular count (11+ sessions + 6-month active)
 * - Tier distribution and changes
 * - Resurfacing candidate counts and metrics
 * - Data integrity checks
 */

import fs from 'fs'
import readline from 'readline'
import { detectSessions } from '../lib/analytics/sessions.js'
import { identifyWhales, detectResurfacing } from '../lib/analytics.js'

const args = process.argv.slice(2)
const csvPath = args[0]

if (!csvPath) {
  console.error('Usage: node scripts/validate-dataset.js <csv-file-path>')
  process.exit(1)
}

if (!fs.existsSync(csvPath)) {
  console.error(`File not found: ${csvPath}`)
  process.exit(1)
}

console.log('🔍 Dataset Validation Starting...\n')
console.log(`CSV Path: ${csvPath}`)
console.log(`File Size: ${(fs.statSync(csvPath).size / 1024 / 1024).toFixed(2)} MB\n`)

// Parse CSV and organize by platform:username
const fanTips = new Map() // fanKey -> { platform, username, tips: [] }
let lineCount = 0
let validLines = 0
let errorCount = 0

const rl = readline.createInterface({
  input: fs.createReadStream(csvPath),
  crlfDelay: Infinity
})

console.log('📊 Reading CSV...')

rl.on('line', (line) => {
  lineCount++

  // Skip header
  if (lineCount === 1) return

  try {
    // Expected CSV format: platform,username,dateRaw,usd,tokens
    const [platform, username, dateRaw, usd, tokens] = line.split(',')

    if (!platform || !username || !dateRaw) {
      errorCount++
      return
    }

    const fanKey = `${platform}:${username}`.toLowerCase()

    if (!fanTips.has(fanKey)) {
      fanTips.set(fanKey, {
        platform: platform.toLowerCase(),
        username: username.toLowerCase(),
        tips: []
      })
    }

    fanTips.get(fanKey).tips.push({
      platform: platform.toLowerCase(),
      username: username.toLowerCase(),
      dateRaw,
      usd: parseFloat(usd) || 0,
      tokens: parseInt(tokens) || 0
    })

    validLines++

    if (validLines % 10000 === 0) {
      console.log(`  ✓ ${validLines.toLocaleString()} tips read...`)
    }
  } catch (e) {
    errorCount++
  }
})

rl.on('close', async () => {
  console.log(`\n✓ CSV parsing complete`)
  console.log(`  Total lines: ${lineCount.toLocaleString()}`)
  console.log(`  Valid tips: ${validLines.toLocaleString()}`)
  console.log(`  Errors: ${errorCount}\n`)

  // Convert to array for processing
  const fans = Array.from(fanTips.values())
  console.log(`📈 Dataset Summary:`)
  console.log(`  Distinct fans (platform:username): ${fans.length.toLocaleString()}`)

  // Detect sessions
  console.log(`\n🔍 Computing canonical sessions (60-minute gap)...`)
  let allSessions = []
  fans.forEach(fan => {
    const sessions = detectSessions(fan.tips)
    allSessions = allSessions.concat(sessions)
  })
  console.log(`  Total canonical sessions: ${allSessions.length.toLocaleString()}`)

  // Identify whales
  console.log(`\n🐋 Identifying Whale tier ($50+ lifetime)...`)
  const whales = identifyWhales(
    fans.flatMap(f => f.tips),
    allSessions
  )
  const whaleCount = whales.filter(f => f.tier === 'Whale').length
  console.log(`  Whales identified: ${whaleCount.toLocaleString()}`)

  // Regular count
  const regularCount = whales.filter(f => f.tier === 'Regular').length
  console.log(`\n👥 Regular tier (11+ sessions + 6-month active): ${regularCount.toLocaleString()}`)

  // Resurfacing
  console.log(`\n🔄 Detecting resurfacing fans...`)
  const resurfacing = detectResurfacing(whales)
  console.log(`  Resurfacing candidates: ${resurfacing.length.toLocaleString()}`)

  // Metrics
  if (resurfacing.length > 0) {
    console.log(`\n📊 Resurfacing Metrics:`)

    const whaleSurfacing = resurfacing.filter(r => r.tier === 'Whale')
    const regularSurfacing = resurfacing.filter(r => r.tier === 'Regular')

    console.log(`  Whales resurfacing: ${whaleSurfacing.length}`)
    console.log(`  Regulars resurfacing: ${regularSurfacing.length}`)

    if (whaleSurfacing.length > 0) {
      const avgWhaleGap = whaleSurfacing.reduce((sum, r) => sum + r.dormancyDays, 0) / whaleSurfacing.length
      console.log(`  Average Whale dormancy: ${Math.round(avgWhaleGap)} days`)
    }

    if (regularSurfacing.length > 0) {
      const avgRegularGap = regularSurfacing.reduce((sum, r) => sum + r.dormancyDays, 0) / regularSurfacing.length
      console.log(`  Average Regular dormancy: ${Math.round(avgRegularGap)} days`)
    }

    // Sample evidence quality
    console.log(`\n🎯 Evidence Quality Sample (first 5 resurfacing fans):`)
    resurfacing.slice(0, 5).forEach((fan, idx) => {
      console.log(`\n  ${idx + 1}. ${fan.username} (${fan.platform})`)
      console.log(`     Tier: ${fan.tier}`)
      console.log(`     Dormancy: ${fan.dormancyDays} days`)
      console.log(`     Gap Deviation: ${fan.gapDeviation}x personal average`)
      if (fan.evidenceQuality) {
        console.log(`     Evidence Score: ${fan.evidenceQuality.score}`)
        console.log(`     Confidence: ${fan.evidenceQuality.confidenceLevel}`)
        console.log(`     Tips in history: ${fan.evidenceQuality.observationCount}`)
        console.log(`     Relationship duration: ${fan.evidenceQuality.relationshipDurationDays} days`)
        console.log(`     Interval variability: ${fan.evidenceQuality.intervalVariability}`)
      }
    })
  }

  // Tier distribution
  console.log(`\n📊 Full Tier Distribution:`)
  const tierDistribution = {}
  whales.forEach(f => {
    tierDistribution[f.tier] = (tierDistribution[f.tier] || 0) + 1
  })
  Object.entries(tierDistribution).sort((a, b) => b[1] - a[1]).forEach(([tier, count]) => {
    console.log(`  ${tier}: ${count.toLocaleString()}`)
  })

  // Data quality checks
  console.log(`\n✅ Data Integrity Checks:`)
  let checks = 0

  // Check 1: All fans have platform:username
  const allHaveKey = fans.every(f => f.platform && f.username)
  console.log(`  ${allHaveKey ? '✓' : '✗'} All fans have platform:username`)
  checks += allHaveKey ? 1 : 0

  // Check 2: No duplicate fan keys
  const uniqueKeys = new Set(fans.map(f => `${f.platform}:${f.username}`))
  const noDuplicates = uniqueKeys.size === fans.length
  console.log(`  ${noDuplicates ? '✓' : '✗'} No duplicate fan keys (${uniqueKeys.size} unique)`)
  checks += noDuplicates ? 1 : 0

  // Check 3: All whales have $50+
  const allWhalesValid = whales.filter(f => f.tier === 'Whale').every(f => f.totalUSD >= 50)
  console.log(`  ${allWhalesValid ? '✓' : '✗'} All Whales have $50+ lifetime`)
  checks += allWhalesValid ? 1 : 0

  // Check 4: All regulars have 11+ sessions
  const allRegularsValid = whales.filter(f => f.tier === 'Regular').every(f => f.qualifyingSessionCount >= 11)
  console.log(`  ${allRegularsValid ? '✓' : '✗'} All Regulars have 11+ canonical sessions`)
  checks += allRegularsValid ? 1 : 0

  console.log(`\n${checks}/4 data integrity checks passed`)

  console.log(`\n✨ Dataset validation complete!`)
})

rl.on('error', (error) => {
  console.error('Error reading CSV:', error)
  process.exit(1)
})
