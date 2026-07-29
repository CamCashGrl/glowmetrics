import { NextResponse } from 'next/server'
import { authenticateRequest, fetchEarningsRows } from '../../../../lib/taxOrganizer/serverData'
import { buildEarningsSummary } from '../../../../lib/taxOrganizer/earningsSummary'
import { buildEarningsSummaryPdf } from '../../../../lib/taxOrganizer/pdf'

// pdfkit needs Node's stream/fs APIs for its bundled standard fonts — this
// route cannot run on the Edge runtime.
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

function rangeLabelFor(startDate, endDate) {
  const isFullCalendarYear = startDate?.endsWith('-01-01') && endDate?.endsWith('-12-31') && startDate.slice(0, 4) === endDate.slice(0, 4)
  if (isFullCalendarYear) return startDate.slice(0, 4)
  return `${startDate} – ${endDate}`
}

function filenameFor(startDate, endDate) {
  const isFullCalendarYear = startDate?.endsWith('-01-01') && endDate?.endsWith('-12-31') && startDate.slice(0, 4) === endDate.slice(0, 4)
  if (isFullCalendarYear) return `camcashgrl-earnings-summary-${startDate.slice(0, 4)}.pdf`
  return `camcashgrl-earnings-summary-${startDate}-to-${endDate}.pdf`
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
        { error: 'This date range has too many records to summarize into a PDF at once. Try narrowing the date range, or use the CSV export instead.' },
        { status: 413 }
      )
    }

    const summary = buildEarningsSummary({ tipsRows, paidSessionRows, requestedTimezone, startDate, endDate, platforms })

    const pdfBuffer = await buildEarningsSummaryPdf(summary, {
      rangeLabel: rangeLabelFor(startDate, endDate),
      generatedAtISO: new Date().toISOString(),
    })

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filenameFor(startDate, endDate)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[TAX-ORGANIZER] export-pdf error:', err.message)
    // The CSV export path is fully independent of PDF generation — a PDF
    // failure here does not affect /api/tax-organizer/export-csv at all.
    return NextResponse.json({ error: 'Could not generate the PDF summary. Your CSV export is still available.' }, { status: 500 })
  }
}
