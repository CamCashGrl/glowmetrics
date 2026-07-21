// ============================================================
// CREATOR TAX ORGANIZER — PDF SUMMARY GENERATION (pdfkit, Node runtime only)
// ============================================================
// Renders the SAME `summary` object produced by buildEarningsSummary() —
// no numbers are recomputed here. This guarantees the PDF's totals can
// never disagree with the on-screen totals or the CSV export.
//
// Deliberately excluded from this report: any per-record data (usernames,
// individual tip amounts) — only platform- and month-level aggregates are
// rendered, so no fan/tipper usernames ever appear in the PDF.
// ============================================================

import PDFDocument from 'pdfkit'

export const REQUIRED_DISCLAIMER =
  'This report is an organizational summary generated from information imported or entered by the user. ' +
  'CamCashGrl has not verified its completeness or accuracy. It is not a tax return, tax preparation service, ' +
  'legal advice, accounting advice, or a guarantee that any expense or amount will receive a particular tax treatment.'

export const REPORT_TITLE = 'Creator Earnings Summary'

const BRAND = {
  text: '#1a1a2e',
  muted: '#64748b',
  accent: '#0f766e', // dark cyan-teal — reads reliably in black & white printing too
}

function ensureSpace(doc, neededHeight) {
  if (doc.y + neededHeight > doc.page.height - doc.page.margins.bottom) doc.addPage()
}

function distributeColumnWidths(doc, count) {
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
  return Array(count).fill(usableWidth / count)
}

function drawTable(doc, headers, rows) {
  const startX = doc.page.margins.left
  const colWidths = distributeColumnWidths(doc, headers.length)
  let y = doc.y

  doc.fontSize(9).font('Helvetica-Bold').fillColor(BRAND.text)
  let x = startX
  headers.forEach((h, i) => { doc.text(h, x, y, { width: colWidths[i] }); x += colWidths[i] })
  y += 14
  doc.moveTo(startX, y).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y).strokeColor('#cbd5e1').stroke()
  y += 4

  doc.font('Helvetica').fontSize(9).fillColor(BRAND.text)
  rows.forEach(row => {
    if (y > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage()
      y = doc.page.margins.top
    }
    x = startX
    row.forEach((cell, i) => { doc.text(String(cell), x, y, { width: colWidths[i] }); x += colWidths[i] })
    y += 14
  })
  doc.y = y + 4
}

// summary: the object returned by buildEarningsSummary().
// rangeLabel: human-readable period label, e.g. "2026" or "Jan 1, 2026 – Jun 30, 2026".
// generatedAtISO: ISO timestamp for "Date generated."
export function buildEarningsSummaryPdf(summary, { rangeLabel, generatedAtISO, compress = true }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50, compress })
    const chunks = []
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // ── HEADER / BRANDING ──────────────────────────────────────────────
    doc.fontSize(10).fillColor(BRAND.accent).font('Helvetica-Bold').text('CamCashGrl')
    doc.moveDown(0.3)
    doc.fontSize(20).fillColor(BRAND.text).font('Helvetica-Bold').text(REPORT_TITLE)
    doc.moveDown(0.4)
    doc.fontSize(10).fillColor(BRAND.muted).font('Helvetica')
    doc.text(`Period: ${rangeLabel}`)
    doc.text(`Generated: ${new Date(generatedAtISO).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`)
    doc.text(`Timezone used: ${summary.timezone}`)
    doc.moveDown(1)

    // ── EARNINGS SUMMARY ────────────────────────────────────────────────
    doc.fontSize(13).fillColor(BRAND.text).font('Helvetica-Bold').text('Earnings Summary')
    doc.moveDown(0.3)
    doc.fontSize(10).font('Helvetica').fillColor(BRAND.text)
    doc.text(`Tips and imported earnings: $${summary.totals.tipsAndImportedUSD.toFixed(2)}`)
    doc.text(`Paid/private session earnings: $${summary.totals.paidSessionUSD.toFixed(2)}`)
    doc.font('Helvetica-Bold').text(`Total recorded gross earnings: $${summary.totals.totalGrossUSD.toFixed(2)}`)
    doc.font('Helvetica')
    if (summary.totals.hasPaidSessionData) {
      doc.moveDown(0.15)
      doc.fontSize(8).fillColor(BRAND.muted).text(
        'Your Tax Organizer includes recorded paid/private session earnings that may not currently appear in your Command Center total.'
      )
    }
    doc.moveDown(0.4)
    doc.fontSize(10).fillColor(BRAND.text)
    doc.text(`Records included: ${summary.totals.recordCount}`)
    doc.text(`Platforms included: ${summary.totals.platformCount}`)
    doc.text(`Earliest record: ${summary.totals.earliestDate || 'No records in this period'}`)
    doc.text(`Latest record: ${summary.totals.latestDate || 'No records in this period'}`)
    doc.moveDown(0.8)

    // ── DATA AVAILABILITY ───────────────────────────────────────────────
    ensureSpace(doc, 100)
    doc.fontSize(12).font('Helvetica-Bold').fillColor(BRAND.text).text('Data Availability')
    doc.fontSize(9).font('Helvetica').fillColor(BRAND.muted)
    doc.text('Platform fees are not currently recorded.')
    doc.text('Processing fees are not currently recorded.')
    doc.text('Refunds and chargebacks are not currently recorded.')
    doc.text('Confirmed payouts are not currently recorded.')
    doc.moveDown(0.8)

    // ── EARNINGS BY PLATFORM ────────────────────────────────────────────
    ensureSpace(doc, 140)
    doc.fontSize(13).font('Helvetica-Bold').fillColor(BRAND.text).text('Earnings by Platform')
    doc.moveDown(0.3)
    if (summary.platforms.length === 0) {
      doc.fontSize(9).font('Helvetica').fillColor(BRAND.muted).text('No earnings recorded for this period.')
      doc.moveDown(0.5)
    } else {
      drawTable(
        doc,
        ['Platform', 'Tips/Imported', 'Paid Sessions', 'Total', '% of Period', 'Records'],
        summary.platforms.map(p => [
          p.platform, `$${p.tipsUSD.toFixed(2)}`, `$${p.paidSessionUSD.toFixed(2)}`,
          `$${p.totalUSD.toFixed(2)}`, `${p.pctOfPeriod}%`, p.recordCount,
        ])
      )
      doc.moveDown(0.6)
    }

    // ── EARNINGS BY MONTH ────────────────────────────────────────────────
    ensureSpace(doc, 140)
    doc.fontSize(13).font('Helvetica-Bold').fillColor(BRAND.text).text('Earnings by Month')
    doc.moveDown(0.3)
    if (summary.monthly.length === 0) {
      doc.fontSize(9).font('Helvetica').fillColor(BRAND.muted).text('No earnings recorded for this period.')
      doc.moveDown(0.5)
    } else {
      drawTable(
        doc,
        ['Month', 'Tips/Imported', 'Paid Sessions', 'Total', 'Records'],
        summary.monthly.map(m => [m.month, `$${m.tipsUSD.toFixed(2)}`, `$${m.paidSessionUSD.toFixed(2)}`, `$${m.totalUSD.toFixed(2)}`, m.recordCount])
      )
      doc.moveDown(0.6)
    }

    // ── TOKEN CONVERSION METHODS USED ───────────────────────────────────
    ensureSpace(doc, 100)
    doc.fontSize(12).font('Helvetica-Bold').fillColor(BRAND.text).text('Token Conversion Methods Used')
    doc.fontSize(9).font('Helvetica').fillColor(BRAND.muted)
    const methods = [...new Set(summary.records.map(r => r.conversionMethod))]
    if (methods.length === 0) {
      doc.text('No records in this period.')
    } else {
      methods.slice(0, 10).forEach(m => doc.text(`• ${m}`))
    }
    doc.moveDown(0.8)

    // ── DATA QUALITY NOTES ───────────────────────────────────────────────
    ensureSpace(doc, 100)
    doc.fontSize(12).font('Helvetica-Bold').fillColor(BRAND.text).text('Data Quality Notes')
    doc.fontSize(9).font('Helvetica').fillColor(BRAND.muted)
    if (summary.dataQuality.issues.length === 0) {
      doc.text('No data-quality issues were detected for this period.')
    } else {
      summary.dataQuality.issues.slice(0, 15).forEach(issue => {
        ensureSpace(doc, 30)
        doc.text(`• ${issue.message}`)
      })
    }
    doc.moveDown(1)

    // ── DISCLAIMER ───────────────────────────────────────────────────────
    ensureSpace(doc, 100)
    doc.fontSize(8).font('Helvetica').fillColor(BRAND.muted).text(REQUIRED_DISCLAIMER)

    doc.end()
  })
}
