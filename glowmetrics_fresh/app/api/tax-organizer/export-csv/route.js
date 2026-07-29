import { NextResponse } from 'next/server'
import { authenticateRequest, fetchEarningsRows } from '../../../../lib/taxOrganizer/serverData'
import { buildEarningsSummary } from '../../../../lib/taxOrganizer/earningsSummary'
import { buildCsv } from '../../../../lib/taxOrganizer/csv'

export const runtime = 'nodejs'

const HEADERS = [
  'Date', 'Original timestamp', 'User timezone', 'Platform', 'Income type',
  'Tokens', 'USD amount', 'Gross amount', 'Platform fee', 'Processing fee',
  'Refund or adjustment', 'Confirmed payout', 'Token conversion rate',
  'Conversion method', 'Source type', 'Upload ID', 'Session ID', 'Record ID',
  'Notes', 'Warning status',
]

function resolveRange(searchParams) {
  const year = searchParams.get('year')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  if (startDate && endDate) return { startDate, endDate }
  if (year && /^\d{4}$/.test(year)) return { startDate: `${year}-01-01`, endDate: `${year}-12-31` }
  const currentYear = new Date().getUTCFullYear()
  return { startDate: `${currentYear}-01-01`, endDate: `${currentYear}-12-31` }
}

function filenameFor(startDate, endDate) {
  const isFullCalendarYear = startDate?.endsWith('-01-01') && endDate?.endsWith('-12-31') && startDate.slice(0, 4) === endDate.slice(0, 4)
  if (isFullCalendarYear) return `camcashgrl-earnings-${startDate.slice(0, 4)}.csv`
  return `camcashgrl-earnings-${startDate}-to-${endDate}.csv`
}

function sourceLabel(source) {
  return source === 'tips' ? 'Tips & imported earnings' : 'Paid/private session'
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

  try {
    const { tipsRows, paidSessionRows, tooLarge } = await fetchEarningsRows(supabase, user.id, { startDate, endDate })

    if (tooLarge) {
      return NextResponse.json(
        { error: 'This date range has too many records to export at once. Try narrowing the date range or platform filters.' },
        { status: 413 }
      )
    }

    const summary = buildEarningsSummary({ tipsRows, paidSessionRows, requestedTimezone, startDate, endDate, platforms })

    const rows = summary.records.map(r => [
      { value: r.localDate, kind: 'text' },
      { value: r.dateTimeRaw, kind: 'text' },
      { value: summary.timezone, kind: 'text' },
      { value: r.platformDisplay, kind: 'text' },
      { value: r.incomeType, kind: 'text' },
      { value: r.tokens, kind: 'number' },
      { value: r.usd, kind: 'number' },
      { value: r.usd, kind: 'number' }, // Gross amount — identical to USD amount; no fee data exists to net against
      { value: null }, // Platform fee — not available from any current source
      { value: null }, // Processing fee — not available
      { value: null }, // Refund or adjustment — not available
      { value: null }, // Confirmed payout — not available
      { value: r.impliedRate != null ? Math.round(r.impliedRate * 10000) / 10000 : null, kind: 'number' },
      { value: r.conversionMethod, kind: 'text' },
      { value: sourceLabel(r.source), kind: 'text' },
      { value: r.uploadId, kind: 'text' },
      { value: r.sessionId, kind: 'text' },
      { value: r.rawId, kind: 'text' },
      { value: r.note, kind: 'text' },
      { value: r.warnings.join('; '), kind: 'text' },
    ])

    const csv = buildCsv(HEADERS, rows)
    const filename = filenameFor(startDate, endDate)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[TAX-ORGANIZER] export-csv error:', err.message)
    return NextResponse.json({ error: 'Could not generate your CSV export. Please try again.' }, { status: 500 })
  }
}
