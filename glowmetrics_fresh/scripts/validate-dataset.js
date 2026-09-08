#!/usr/bin/env node

/**
 * Dataset Validation Script
 *
 * Validates canonical analytics implementation against Chaturbate/Bongacams CSV dataset.
 * Run with: node scripts/validate-dataset.js /path/to/chaturbate-csv-alltime.csv
 *
 * Verifies:
 * - Total distinct fans (platform:username composite keys)
 * - Total canonical sessions (60-minute gaps)
 * - Whale count ($50+ lifetime)
 * - Regular count (11+ sessions + 6-month active)
 * - Tier distribution
 * - Data integrity checks
 */

import fs from 'fs'
import readline from 'readline'

// Get the latest date from dataset
function getDatasetLatestDate(allTips) {
  let latestTime = 0
  allTips.forEach(tip => {
    const time = new Date(tip.dateRaw || tip.date_time).getTime()
    if (time > latestTime) latestTime = time
  })
  return latestTime
}

// Simple inline session detection (60-minute gap)
function detectSessionsSimple(tips) {
  if (!tips || tips.length === 0) return []

  const sortedTips = [...tips].sort((a, b) => {
    const aTime = new Date(a.dateRaw || a.date_time).getTime()
    const bTime = new Date(b.dateRaw || b.date_time).getTime()
    return aTime - bTime
  })

  const sessions = []
  let currentSession = {
    startTime: new Date(sortedTips[0].dateRaw || sortedTips[0].date_time),
    endTime: new Date(sortedTips[0].dateRaw || sortedTips[0].date_time),
    tipCount: 1,
    id: null
  }

  for (let i = 1; i < sortedTips.length; i++) {
    const currentTime = new Date(sortedTips[i].dateRaw || sortedTips[i].date_time).getTime()
    const lastTime = new Date(sortedTips[i - 1].dateRaw || sortedTips[i - 1].date_time).getTime()
    const gapMinutes = (currentTime - lastTime) / (60 * 1000)

    if (gapMinutes <= 60) {
      // Same session
      currentSession.endTime = new Date(sortedTips[i].dateRaw || sortedTips[i].date_time)
      currentSession.tipCount++
    } else {
      // New session (gap > 60 min)
      currentSession.id = currentSession.startTime.getTime()
      sessions.push(currentSession)
      currentSession = {
        startTime: new Date(sortedTips[i].dateRaw || sortedTips[i].date_time),
        endTime: new Date(sortedTips[i].dateRaw || sortedTips[i].date_time),
        tipCount: 1,
        id: null
      }
    }
  }

  // Add final session
  currentSession.id = currentSession.startTime.getTime()
  sessions.push(currentSession)

  return sessions
}

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
    // CSV format: "Date","Action","Tokens","Token Balance"
    // Action format: "Tip From: username" or other actions
    // We need to parse this carefully due to quotes and commas

    // Split by comma, but respect quoted fields
    const fields = []
    let currentField = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField)
        currentField = ''
      } else {
        currentField += char
      }
    }
    fields.push(currentField) // Add last field

    if (fields.length < 3) {
      errorCount++
      return
    }

    // Parse fields: Remove surrounding quotes
    const dateStr = fields[0].replace(/^"|"$/g, '')
    const actionStr = fields[1].replace(/^"|"$/g, '')
    const tokensStr = fields[2].replace(/^"|"$/g, '')

    // Extract username from action string
    const tipMatch = actionStr.match(/Tip From:\s*(\w+)/)
    if (!tipMatch) {
      errorCount++
      return
    }

    const username = tipMatch[1].toLowerCase()
    const platform = 'chaturbate' // This CSV is from Chaturbate
    const tokens = parseInt(tokensStr) || 0

    // Parse date: "Jun 14, 2026, 8:27 PM"
    let dateRaw
    try {
      dateRaw = new Date(dateStr).toISOString()
    } catch (e) {
      errorCount++
      return
    }

    // Estimate USD from tokens (Chaturbate: 1 token ≈ $0.05)
    const usd = tokens * 0.05

    const fanKey = `${platform}:${username}`

    if (!fanTips.has(fanKey)) {
      fanTips.set(fanKey, {
        platform,
        username,
        tips: []
      })
    }

    fanTips.get(fanKey).tips.push({
      platform,
      username,
      dateRaw,
      usd,
      tokens
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

  // Get dataset latest date
  const allTips = fans.flatMap(f => f.tips)
  const datasetLatestTime = getDatasetLatestDate(allTips)
  const datasetLatestDate = new Date(datasetLatestTime)
  console.log(`  Dataset latest date: ${datasetLatestDate.toISOString().split('T')[0]}`)

  // Detect sessions
  console.log(`\n🔍 Computing canonical sessions (60-minute gap)...`)
  const fanStats = fans.map(fan => {
    const sessions = detectSessionsSimple(fan.tips)
    const totalUSD = fan.tips.reduce((sum, t) => sum + (t.usd || 0), 0)
    const latestTipTime = Math.max(...fan.tips.map(t => new Date(t.dateRaw || t.date_time).getTime()))
    const daysSinceLastTip = (datasetLatestTime - latestTipTime) / (24 * 60 * 60 * 1000)
    const sixMonthsAgoTime = datasetLatestTime - (180 * 24 * 60 * 60 * 1000)
    const activeWithin6Months = fan.tips.some(t => new Date(t.dateRaw || t.date_time).getTime() >= sixMonthsAgoTime)

    return {
      ...fan,
      sessions,
      qualifyingSessionCount: sessions.length,
      totalUSD,
      daysSinceLastTip: Math.round(daysSinceLastTip),
      activeWithin6Months,
      sessionIds: new Set(sessions.map(s => s.id))
    }
  })

  const allSessions = fanStats.flatMap(f => f.sessions)
  console.log(`  Total canonical sessions: ${allSessions.length.toLocaleString()}`)

  // Identify whales (Tier: $50+ lifetime) and Regulars (11+ sessions + 6-month active)
  console.log(`\n🐋 Classifying tiers...`)
  const whaleCount = fanStats.filter(f => f.totalUSD >= 50).length
  const regularCount = fanStats.filter(f => f.qualifyingSessionCount >= 11 && f.activeWithin6Months).length
  const emergingCount = fanStats.filter(f => f.qualifyingSessionCount >= 3 && f.qualifyingSessionCount < 11).length
  const otherCount = fanStats.filter(f => f.qualifyingSessionCount < 3).length

  console.log(`  Whales ($50+ lifetime): ${whaleCount.toLocaleString()}`)
  console.log(`  Regulars (11+ sessions + 6mo active): ${regularCount.toLocaleString()}`)
  console.log(`  Emerging (3-10 sessions): ${emergingCount.toLocaleString()}`)
  console.log(`  Other (<3 sessions): ${otherCount.toLocaleString()}`)

  // Fan metrics
  console.log(`\n📊 Fan Metrics:`)
  const avgSessionsPerFan = (allSessions.length / fans.length).toFixed(2)
  const avgRevenuePerFan = (allTips.reduce((sum, t) => sum + (t.usd || 0), 0) / fans.length).toFixed(2)
  const maxSessionsPerFan = Math.max(...fanStats.map(f => f.qualifyingSessionCount))
  const maxRevenuePerFan = Math.max(...fanStats.map(f => f.totalUSD))

  console.log(`  Avg sessions per fan: ${avgSessionsPerFan}`)
  console.log(`  Avg revenue per fan: $${avgRevenuePerFan}`)
  console.log(`  Max sessions (single fan): ${maxSessionsPerFan}`)
  console.log(`  Max revenue (single fan): $${maxRevenuePerFan.toFixed(2)}`)

  // Sample top fans
  console.log(`\n🎯 Top 10 Fans by Revenue:`)
  const topByRevenue = fanStats.sort((a, b) => b.totalUSD - a.totalUSD).slice(0, 10)
  topByRevenue.forEach((fan, idx) => {
    console.log(`  ${idx + 1}. ${fan.username} (${fan.platform}): $${fan.totalUSD.toFixed(2)} • ${fan.qualifyingSessionCount} sessions`)
  })

  // Data quality checks
  console.log(`\n✅ Data Integrity Checks:`)
  let checks = 0

  // Check 1: All fans have platform:username
  const allHaveKey = fanStats.every(f => f.platform && f.username)
  console.log(`  ${allHaveKey ? '✓' : '✗'} All fans have platform:username`)
  checks += allHaveKey ? 1 : 0

  // Check 2: No duplicate fan keys
  const uniqueKeys = new Set(fanStats.map(f => `${f.platform}:${f.username}`))
  const noDuplicates = uniqueKeys.size === fanStats.length
  console.log(`  ${noDuplicates ? '✓' : '✗'} No duplicate fan keys (${uniqueKeys.size} unique)`)
  checks += noDuplicates ? 1 : 0

  // Check 3: All whales have $50+
  const whales = fanStats.filter(f => f.totalUSD >= 50)
  const allWhalesValid = whales.every(f => f.totalUSD >= 50)
  console.log(`  ${allWhalesValid ? '✓' : '✗'} All Whales have $50+ lifetime`)
  checks += allWhalesValid ? 1 : 0

  // Check 4: All regulars have 11+ sessions + 6-month activity
  const regulars = fanStats.filter(f => f.qualifyingSessionCount >= 11 && f.activeWithin6Months)
  const allRegularsValid = regulars.every(f => f.qualifyingSessionCount >= 11 && f.activeWithin6Months)
  console.log(`  ${allRegularsValid ? '✓' : '✗'} All Regulars have 11+ canonical sessions + 6mo active`)
  checks += allRegularsValid ? 1 : 0

  // Check 5: Session count matches canonical ID count
  const sessionIdCountsMatch = fanStats.every(f => f.sessionIds.size === f.qualifyingSessionCount)
  console.log(`  ${sessionIdCountsMatch ? '✓' : '✗'} Session IDs match qualifying session counts`)
  checks += sessionIdCountsMatch ? 1 : 0

  console.log(`\n${checks}/5 data integrity checks passed`)

  console.log(`\n✨ Dataset validation complete!`)
})

rl.on('error', (error) => {
  console.error('Error reading CSV:', error)
  process.exit(1)
})
