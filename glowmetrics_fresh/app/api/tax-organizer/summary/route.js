import { NextResponse } from 'next/server'
import { authenticateRequest, fetchEarningsRows, getAvailableYearRange } from '../../../../lib/taxOrganizer/serverData'
import { buildEarningsSummary } from '../../../../lib/taxOrganizer/earningsSummary'

export const runtime = 'nodejs'

function resolveRange(searchParams) {
  const year = searchParams.get('year')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  if (startDate && endDate) return { startDate, endDate }
  if (year && /^\d{4}$/.test(year)) return { startDate: `${year}-01-01`, endDate: `${year}-12-31` }
  const currentYear = new Date().getUTCFullYear()
  return { startDate: `${currentYear}-01-01`, endDate: `${currentYear}-12-31` }
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
    const [{ tipsRows, paidSessionRows, tooLarge }, yearRange] = await Promise.all([
      fetchEarningsRows(supabase, user.id, { startDate, endDate }),
      getAvailableYearRange(supabase, user.id),
    ])

    const summary = buildEarningsSummary({
      tipsRows,
      paidSessionRows,
      requestedTimezone,
      startDate,
      endDate,
      platforms,
    })

    // Records can be large — the summary endpoint returns everything EXCEPT
    // the full record list (that's what /api/tax-organizer/records is for,
    // paginated). Screen/CSV/PDF must still agree exactly on totals, which
    // is guaranteed because they all call buildEarningsSummary the same way.
    const { records, ...summaryWithoutRecords } = summary

    return NextResponse.json({
      ...summaryWithoutRecords,
      availableYears: yearRange.years,
      hasAnyData: yearRange.hasData,
      dataTruncated: tooLarge,
    })
  } catch (err) {
    console.error('[TAX-ORGANIZER] summary error:', err.message)
    return NextResponse.json({ error: 'Could not load your earnings summary. Please try again.' }, { status: 500 })
  }
}
