import { parseCSV } from '../../analytics'

// Regression guard: BongaCams' "Reports → General" earnings page copies its
// header as one cell per line — "Date and Time" / "Member" / "Type" /
// "Tokens Earned" / "Your Payout" — instead of a single delimiter-joined
// header row. parseWithHeaders only maps as many columns as the header row
// contains, so with the header stuck at 1 column every value past column 0
// in every data row (username, type, tokens, payout) was silently dropped
// and the whole paste parsed to ZERO rows — this is the exact dataset a
// user pasted that reproduced the bug.

describe('parseCSV stacked single-cell header handling', () => {
  test('BongaCams stacked-header paste (real reported sample) parses every row', () => {
    const csv = [
      'Date and Time',
      'Member',
      'Type',
      'Tokens Earned',
      'Your Payout',
      '13.09.2026 16:19\tkopeesh\tTips\t16\t$0.378',
      '13.09.2026 16:21\telwedopapichuloo\tTips\t5\t$0.118',
      '13.09.2026 16:22\telwedopapichuloo\tTips\t5\t$0.118',
      '13.09.2026 16:32\tlongstroke7\tTips\t1\t$0.024',
      '13.09.2026 16:32\tlongstroke7\tTips\t1\t$0.024',
      '13.09.2026 16:33\tlongstroke7\tTips\t1\t$0.024',
      '13.09.2026 16:33\tlongstroke7\tTips\t1\t$0.024',
      '13.09.2026 16:33\tlongstroke7\tTips\t1\t$0.024',
      '13.09.2026 16:53\tGegata26\tTips\t1\t$0.024',
      '13.09.2026 16:54\tGegata26\tTips\t1\t$0.024',
      '20.09.2026 03:41\tHorny-Kutas\tTips\t1\t$0.023',
      '20.09.2026 03:42\tHorny-Kutas\tTips\t1\t$0.023',
      '20.09.2026 03:44\tAsss33333\tTips\t1\t$0.023',
      '20.09.2026 04:19\tKania\tTips\t1\t$0.023',
    ].join('\n')

    const rows = parseCSV(csv, 'BongaCams')

    expect(rows).toHaveLength(14)
    expect(rows.every(r => r.platform === 'BongaCams')).toBe(true)
    expect(rows.every(r => r.username.length > 0)).toBe(true)
    expect(rows[0].username).toBe('kopeesh')
    expect(rows[0].tokens).toBe(16)
    expect(rows[0].usd).toBeCloseTo(0.38, 2)
    expect(rows.reduce((s, r) => s + r.tokens, 0)).toBe(37)
  })

  test('stacked-header stitching requires an exact column-count match, so it does not misfire on a genuine single-column paste', () => {
    // Five single-word lines with NO matching multi-column data line after
    // them — must be left alone, not force-joined into a bogus header.
    const csv = ['kopeesh', 'elwedopapichuloo', 'longstroke7', 'Gegata26', 'Kania'].join('\n')

    const rows = parseCSV(csv, 'BongaCams')

    expect(rows).toHaveLength(0)
  })

  test('a single legitimate one-column header line (not stacked) is untouched', () => {
    const csv = [
      'Date,Platform,Username,Tokens,USD_Amount',
      '2026-02-23,Bongacams,Daddy7733,,0.02',
    ].join('\n')

    const rows = parseCSV(csv)

    expect(rows).toHaveLength(1)
    expect(rows[0].username).toBe('daddy7733')
  })
})
