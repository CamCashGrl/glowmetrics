import { describe, it, expect } from 'vitest'
import { csvCell, buildCsvRow, buildCsv } from './csv'

describe('csvCell — formula injection protection', () => {
  it('escapes a text value beginning with =', () => {
    expect(csvCell('=HYPERLINK("http://evil.example")', 'text')).toBe(
      `"'=HYPERLINK(""http://evil.example"")"`
    )
  })

  it('escapes text values beginning with +, -, and @', () => {
    expect(csvCell('+1+1', 'text')).toBe("'+1+1")
    expect(csvCell('-drop everything', 'text')).toBe("'-drop everything")
    expect(csvCell('@SUM(A1:A9)', 'text')).toBe("'@SUM(A1:A9)")
  })

  it('does NOT escape a legitimate negative number marked as kind: number', () => {
    expect(csvCell(-25.0, 'number')).toBe('-25')
    expect(csvCell('-25.00', 'number')).toBe('-25')
  })

  it('does not alter ordinary text that does not start with a dangerous character', () => {
    expect(csvCell('regular note', 'text')).toBe('regular note')
  })

  it('quotes values containing commas or newlines regardless of kind', () => {
    expect(csvCell('hello, world', 'text')).toBe('"hello, world"')
    expect(csvCell('line1\nline2', 'text')).toBe('"line1\nline2"')
  })

  it('renders null/undefined/empty as an empty cell (blank, not zero)', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
    expect(csvCell('')).toBe('')
    expect(csvCell(null, 'number')).toBe('')
  })

  it('passes through a positive numeric amount untouched', () => {
    expect(csvCell(52.5, 'number')).toBe('52.5')
  })
})

describe('buildCsvRow', () => {
  it('builds a row from mixed plain and typed cells', () => {
    const row = ['2026-01-05', { value: 'Chaturbate', kind: 'text' }, { value: -25.0, kind: 'number' }]
    expect(buildCsvRow(row)).toBe('2026-01-05,Chaturbate,-25')
  })
})

describe('buildCsv', () => {
  it('produces a UTF-8 BOM-prefixed, CRLF-joined CSV', () => {
    const csv = buildCsv(['Date', 'Amount'], [['2026-01-01', { value: 10, kind: 'number' }]])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('Date,Amount\r\n')
    expect(csv).toContain('2026-01-01,10\r\n')
  })
})
