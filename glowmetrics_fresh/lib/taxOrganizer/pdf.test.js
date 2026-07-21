import { describe, it, expect } from 'vitest'
import { buildEarningsSummaryPdf, REQUIRED_DISCLAIMER, REPORT_TITLE } from './pdf'
import { buildEarningsSummary } from './earningsSummary'

function tip(overrides = {}) {
  return {
    id: 1, date_time: '2026-06-15T18:00:00Z', platform: 'Chaturbate', username: 'secretFanName',
    tip_type: 'Tip', tokens: 100, usd: '5.00', upload_id: null, tip_ref: null, session_id: null, tip_note: '',
    ...overrides,
  }
}

// pdfkit renders text-showing operators (Tj/TJ) as hex strings (<...>),
// not literal (...) strings — even uncompressed, the raw buffer doesn't
// contain readable text directly. TJ also splits a single word into
// multiple hex runs at kerning-adjustment points, so runs must be
// concatenated WITHOUT a separator within one BT/ET text object (one
// doc.text() call) to reconstruct words correctly — only different text
// objects (separate lines) get a space between them.
function extractPdfText(buf) {
  const raw = buf.toString('latin1')
  const blocks = raw.match(/BT[\s\S]*?ET/g) || []
  const text = blocks
    .map(block => {
      const hexRuns = block.match(/<([0-9a-fA-F]+)>/g) || []
      return hexRuns.map(h => Buffer.from(h.slice(1, -1), 'hex').toString('latin1')).join('')
    })
    .join(' ')
  // pdfkit's automatic line-wrapping can split one sentence across several
  // BT/ET blocks (extra join-spaces above) — collapse runs of whitespace so
  // assertions can match a phrase regardless of where pdfkit wrapped it.
  return text.replace(/\s+/g, ' ')
}

async function generatePdfText(summary) {
  const buf = await buildEarningsSummaryPdf(summary, {
    rangeLabel: '2026',
    generatedAtISO: '2026-07-21T00:00:00Z',
    compress: false, // readable stream content for assertions
  })
  return extractPdfText(buf)
}

describe('buildEarningsSummaryPdf', () => {
  it('produces a valid PDF buffer', async () => {
    const summary = buildEarningsSummary({ tipsRows: [tip()], paidSessionRows: [], requestedTimezone: 'UTC' })
    const buf = await buildEarningsSummaryPdf(summary, { rangeLabel: '2026', generatedAtISO: '2026-07-21T00:00:00Z' })
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('uses the required report title, never labeling it a tax return/filing/IRS document', async () => {
    const summary = buildEarningsSummary({ tipsRows: [tip()], paidSessionRows: [], requestedTimezone: 'UTC' })
    const text = await generatePdfText(summary)
    expect(REPORT_TITLE).toBe('Creator Earnings Summary')
    expect(text).toContain('Creator Earnings Summary')
  })

  it('includes the exact required disclaimer text', async () => {
    const summary = buildEarningsSummary({ tipsRows: [tip()], paidSessionRows: [], requestedTimezone: 'UTC' })
    const text = await generatePdfText(summary)
    // pdfkit wraps long lines across multiple text-showing operators, so
    // check for stable substrings rather than the exact joined sentence.
    expect(text).toContain('organizational summary')
    expect(text).toContain('not a tax return')
    expect(REQUIRED_DISCLAIMER).toContain('It is not a tax return, tax preparation service, legal advice, accounting advice')
  })

  it('never contains a fan/tipper username, even though the underlying summary has one', async () => {
    const summary = buildEarningsSummary({ tipsRows: [tip({ username: 'secretFanName' })], paidSessionRows: [], requestedTimezone: 'UTC' })
    const text = await generatePdfText(summary)
    expect(text).not.toContain('secretFanName')
  })

  it('PDF totals match the summary object’s on-screen totals exactly (same source, no recomputation)', async () => {
    const summary = buildEarningsSummary({
      tipsRows: [tip({ id: 1, usd: '12.34' }), tip({ id: 2, usd: '7.66' })],
      paidSessionRows: [{ id: 1, date_time: '2026-06-16T12:00:00Z', platform: 'BongaCams', username: 'x', session_type: 'Private Chat', tokens: 40, usd: '3.00', upload_id: null, session_ref: null }],
      requestedTimezone: 'UTC',
    })
    expect(summary.totals.totalGrossUSD).toBe(23) // 12.34 + 7.66 + 3.00
    const text = await generatePdfText(summary)
    expect(text).toContain('$23.00')
    expect(text).toContain('$20.00') // tips subtotal
    expect(text).toContain('$3.00') // paid session subtotal
  })

  it('shows the paid-session disclosure note only when paid session data is present', async () => {
    const withPaid = buildEarningsSummary({
      tipsRows: [tip()],
      paidSessionRows: [{ id: 1, date_time: '2026-06-16T12:00:00Z', platform: 'BongaCams', username: 'x', session_type: 'Private Chat', tokens: 40, usd: '3.00', upload_id: null, session_ref: null }],
      requestedTimezone: 'UTC',
    })
    const withoutPaid = buildEarningsSummary({ tipsRows: [tip()], paidSessionRows: [], requestedTimezone: 'UTC' })

    const textWithPaid = await generatePdfText(withPaid)
    const textWithoutPaid = await generatePdfText(withoutPaid)

    expect(textWithPaid).toContain('may not currently appear in your Command Center total')
    expect(textWithoutPaid).not.toContain('may not currently appear in your Command Center total')
  })

  it('states each data-availability category is not recorded rather than showing $0', async () => {
    const summary = buildEarningsSummary({ tipsRows: [tip()], paidSessionRows: [], requestedTimezone: 'UTC' })
    const text = await generatePdfText(summary)
    expect(text).toContain('Platform fees are not currently recorded')
    expect(text).toContain('Confirmed payouts are not currently recorded')
  })

  it('renders a graceful empty state for a period with no records', async () => {
    const summary = buildEarningsSummary({ tipsRows: [], paidSessionRows: [], requestedTimezone: 'UTC' })
    const text = await generatePdfText(summary)
    expect(text).toContain('No earnings recorded for this period')
  })
})
