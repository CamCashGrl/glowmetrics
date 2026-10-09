/**
 * Numeric dates (06/11/2024) are read in the order the file itself proves,
 * or the order the user chose — never guessed. A day-first export read
 * month-first put 517 tips on swapped dates and past the duplicate check.
 */
import { parseCSV, detectDateOrder } from '../../analytics.js'

const csv = (rows) => ['date_time,username,tokens', ...rows].join('\n')
const local = (r) => {
  const d = new Date(r.date_time)
  return [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()]
}

describe('detectDateOrder', () => {
  test('day-first when some first number is over 12', () => {
    expect(detectDateOrder(csv(['06/11/2024 11:21,a,10', '25/08/2024 04:44,b,5']))).toBe('DMY')
  })
  test('month-first when some second number is over 12', () => {
    expect(detectDateOrder(csv(['06/11/2024 11:21,a,10', '08/25/2024 04:44,b,5']))).toBe('MDY')
  })
  test('ambiguous when every date could be either', () => {
    expect(detectDateOrder(csv(['06/11/2024 11:21,a,10', '07/08/2024 04:44,b,5']))).toBe('ambiguous')
  })
  test('conflict when the file proves both orders', () => {
    expect(detectDateOrder(csv(['13/11/2024 11:21,a,10', '08/25/2024 04:44,b,5']))).toBe('conflict')
  })
  test('dash separators count too', () => {
    expect(detectDateOrder(csv(['25-08-2024 04:44,b,5']))).toBe('DMY')
  })
  test('formats with a defined order are not numeric-ambiguous', () => {
    expect(detectDateOrder(csv(['2024-06-11 11:21,a,1']))).toBeNull()
    expect(detectDateOrder(csv(['11.06.2024 11:21,a,1']))).toBeNull()
    expect(detectDateOrder(csv(['2026-02-12 06:05:59.000000,a,1']))).toBeNull()
  })
})

describe('parseCSV dateOrder', () => {
  const amb = csv(['06/11/2024 11:21,fanA,10', '07/08/2024 04:44,fanB,5'])

  test('DMY reads day first, survives the second normalization pass', () => {
    expect(parseCSV(amb, 'BongaCams', { dateOrder: 'DMY' }).map(local)).toEqual([
      [2024, 11, 6, 11, 21],
      [2024, 8, 7, 4, 44],
    ])
  })

  test('MDY reads month first', () => {
    expect(parseCSV(amb, 'BongaCams', { dateOrder: 'MDY' }).map(local)).toEqual([
      [2024, 6, 11, 11, 21],
      [2024, 7, 8, 4, 44],
    ])
  })

  test('no order keeps the previous reading (local time, month first)', () => {
    expect(parseCSV(amb, 'BongaCams').map(local)).toEqual([
      [2024, 6, 11, 11, 21],
      [2024, 7, 8, 4, 44],
    ])
  })

  test('a date-only value stays local midnight, as before', () => {
    const rows = parseCSV(csv(['25/08/2024,fanA,10']), 'BongaCams', { dateOrder: 'DMY' })
    expect(local(rows[0])).toEqual([2024, 8, 25, 0, 0])
  })

  test('dotted BongaCams dates are unaffected by a date order', () => {
    const t = csv(['11.06.2024 11:21,fanA,10'])
    expect(parseCSV(t, 'BongaCams', { dateOrder: 'MDY' }).map(local)).toEqual(parseCSV(t, 'BongaCams').map(local))
    expect(local(parseCSV(t, 'BongaCams')[0])).toEqual([2024, 6, 11, 11, 21])
  })

  test('the order does not leak into the next parse', () => {
    parseCSV(amb, 'BongaCams', { dateOrder: 'DMY' })
    expect(local(parseCSV(amb, 'BongaCams')[0])).toEqual([2024, 6, 11, 11, 21])
  })
})
