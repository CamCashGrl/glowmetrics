// ============================================================
// TAX ORGANIZER — SAFE CSV ENCODING
// Single place that builds CSV output for the earnings export.
// Formula-injection protection: a text cell whose value begins with
// =, +, -, or @ is prefixed with a leading apostrophe, which every
// spreadsheet application (Excel, Google Sheets, LibreOffice) treats as
// "force this to plain text" rather than evaluating it as a formula.
//
// Numeric cells (amounts, tokens, rates) are never touched by that rule —
// callers must explicitly mark a cell `kind: 'number'` so a legitimate
// negative amount (e.g. a future refund/adjustment of -25.00) is never
// altered. Supabase returns `numeric` columns as strings to avoid float
// precision loss, so this can't rely on JS `typeof` — the caller states
// intent explicitly via `kind`.
// ============================================================

const DANGEROUS_PREFIXES = ['=', '+', '-', '@']

function escapeFormulaPrefix(str) {
  if (typeof str !== 'string' || str.length === 0) return str
  if (DANGEROUS_PREFIXES.includes(str[0])) return `'${str}`
  return str
}

function quoteCsvCell(str) {
  if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

// value: the raw cell value. kind: 'text' (default, formula-escaped) or
// 'number' (never escaped — preserves legitimate negative numbers).
export function csvCell(value, kind = 'text') {
  if (value === null || value === undefined || value === '') return ''

  if (kind === 'number') {
    const num = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(num)) return ''
    return String(num)
  }

  const escaped = escapeFormulaPrefix(String(value))
  return quoteCsvCell(escaped)
}

// row: array of { value, kind? } cell descriptors, or plain strings/numbers
// (treated as text by default — pass { value, kind: 'number' } explicitly
// for anything numeric).
export function buildCsvRow(row) {
  return row
    .map(cell => {
      if (cell && typeof cell === 'object' && 'value' in cell) {
        return csvCell(cell.value, cell.kind)
      }
      return csvCell(cell)
    })
    .join(',')
}

// headers: array of plain header strings.
// rows: array of row arrays (see buildCsvRow).
// Returns a UTF-8 string with a leading BOM (Excel needs this to detect
// UTF-8 rather than guessing a legacy codepage) and CRLF line endings
// (the format both Excel and Google Sheets expect for CSV).
export function buildCsv(headers, rows) {
  const lines = [headers.map(h => csvCell(h)).join(',')]
  for (const row of rows) lines.push(buildCsvRow(row))
  return '﻿' + lines.join('\r\n') + '\r\n'
}
