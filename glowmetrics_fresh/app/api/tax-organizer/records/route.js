import { NextResponse } from 'next/server'
import { authenticateRequest, fetchEarningsRows } from '../../../../lib/taxOrganizer/serverData'
import { buildEarningsSummary } from '../../../../lib/taxOrganizer/earningsSummary'

export const runtime = 'nodejs'

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

function resolveRange(searchParams) {
  const year = searchParams.get('year')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  if (startDate && endDate) return { startDate, endDate }
  if (year && /^\d{4}$/.test(year)) return { startDate: `${year}-01-01`, endDate: `${year}-12-31` }
  const currentYear = new Date().getUTCFullYear()
  return { startDate: `${currentYear}-01-01`, endDate: `${currentYear}-12-31` }
}

function applySearch(records, search) {
  if (!search) return records
  const q = search.toLowerCase()
  return records.filter(r =>
    r.username.toLowerCase().includes(q) ||
    r.platformDisplay.toLowerCase().includes(q) ||
    r.incomeType.toLowerCase().includes(q)
  )
}

function applySort(records, sortBy, sortDir) {
  const dir = sortDir === 'asc' ? 1 : -1
  const sorted = [...records]
  sorted.sort((a, b) => {
    let av, bv
    switch (sortBy) {
      case 'usd': av = a.usd; bv = b.usd; break
      case 'tokens': av = a.tokens; bv = b.tokens; break
      case 'platform': av = a.platformDisplay; bv = b.platformDisplay; break
      case 'username': av = a.username; bv = b.username; break
      default: av = a.dateTimeRaw; bv = b.dateTimeRaw
    }
    if (av < bv) return -1 * dir
    if (av > bv) return 1 * dir
    return 0
  })
  return sorted
}

export async function GET(req) {
  const authResult = await authenticateRequest(req)
  if (authResult.errorResponse) return authResult.errorResponse
  const { supabase, user } = authResult

  const { searchParams } = new URL(req.url)
  const { startDate, endDate } = resolveRange(searchParams)
  const requestedTimezone = searchParams.get('tz')
  const platformsParam = searchParams.get('platforms')
  const platforms = platformsParam ? platformsParam.split(',').map(p => p.trim()).filter(Boolean) : null
  const search = (searchParams.get('search') || '').trim()
  const sortBy = searchParams.get('sortBy') || 'date'
  const sortDir = searchParams.get('sortDir') || 'desc'
  const page = Math.max(parseInt(searchParams.get('page'), 10) || 1, 1)
  const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize'), 10) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE)

  try {
    const { tipsRows, paidSessionRows, tooLarge } = await fetchEarningsRows(supabase, user.id, { startDate, endDate })

    const summary = buildEarningsSummary({ tipsRows, paidSessionRows, requestedTimezone, startDate, endDate, platforms })

    let records = applySearch(summary.records, search)
    records = applySort(records, sortBy, sortDir)

    const totalRecords = records.length
    const totalPages = Math.max(Math.ceil(totalRecords / pageSize), 1)
    const clampedPage = Math.min(page, totalPages)
    const start = (clampedPage - 1) * pageSize
    const pageRecords = records.slice(start, start + pageSize)

    return NextResponse.json({
      timezone: summary.timezone,
      records: pageRecords,
      pagination: { page: clampedPage, pageSize, totalRecords, totalPages },
      dataTruncated: tooLarge,
    })
  } catch (err) {
    console.error('[TAX-ORGANIZER] records error:', err.message)
    return NextResponse.json({ error: 'Could not load your earnings records. Please try again.' }, { status: 500 })
  }
}
