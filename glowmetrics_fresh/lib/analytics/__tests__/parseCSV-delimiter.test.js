import { parseCSV } from '../../analytics'

// Regression guard: detectDelimiter used to return the NAMES 'comma'/'tab',
// while parseCSV passes its return value straight to parseCSVLine as the split
// token. Splitting on the literal word "comma" collapsed every line into a
// single column, so isValidTip rejected all of them and a well-formed CSV
// parsed to ZERO rows. Only ambiguous files worked, because the null branch
// fell back to a real ','.

describe('parseCSV delimiter handling', () => {
  test('comma-delimited CSV with USD_Amount and empty Tokens parses every row', () => {
    const csv = [
      'Date,Platform,Username,Tokens,USD_Amount,Session_ID',
      '2026-02-23,Bongacams,Daddy7733,,0.02,BC-2026-02-23',
      '2026-02-13,Bongacams,RideMyFace1995,,0.02,BC-2026-02-13',
      '2026-01-05,Bongacams,Daddy7733,,7.16,BC-2026-01-05',
    ].join('\n')

    const rows = parseCSV(csv)

    expect(rows).toHaveLength(3)
    expect(rows[0].username).toBe('daddy7733')
    expect(rows[0].usd).toBeCloseTo(0.02, 2)
    expect(rows.reduce((s, r) => s + r.usd, 0)).toBeCloseTo(7.2, 2)
  })

  test('tab-delimited export parses every row', () => {
    const csv = [
      'Date\tPlatform\tUsername\tTokens\tUSD_Amount',
      '2026-02-23\tBongacams\tDaddy7733\t\t0.02',
      '2026-01-05\tBongacams\tNyc89\t\t7.16',
    ].join('\n')

    const rows = parseCSV(csv)

    expect(rows).toHaveLength(2)
    expect(rows[1].usd).toBeCloseTo(7.16, 2)
  })

  test('blank and username-less rows are dropped, valid rows are kept', () => {
    const csv = [
      'Date,Platform,Username,Tokens,USD_Amount,Session_ID',
      '2026-02-23,Bongacams,Daddy7733,,0.02,BC-2026-02-23',
      ',Bongacams,,,,',
      ',Bongacams,,,,',
    ].join('\n')

    const rows = parseCSV(csv)

    expect(rows).toHaveLength(1)
    expect(rows[0].username).toBe('daddy7733')
  })

  test('a row missing only its date is still counted for revenue', () => {
    const csv = [
      'Date,Platform,Username,Tokens,USD_Amount,Session_ID',
      ',Bongacams,acidodidi,,0.05,BC-2025-01-04',
    ].join('\n')

    const rows = parseCSV(csv)

    expect(rows).toHaveLength(1)
    expect(rows[0].usd).toBeCloseTo(0.05, 2)
  })
})
