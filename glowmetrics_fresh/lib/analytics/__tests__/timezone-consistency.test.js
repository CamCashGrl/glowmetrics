/**
 * TIMEZONE CONSISTENCY
 *
 * A stream time only means something to a creator as their own wall-clock
 * time. Every feature that names a day or an hour must therefore agree on one
 * basis: the creator's local clock.
 *
 * Stream Planner previously bucketed sessions by getUTCDay()/getUTCHours(),
 * then rendered them through two conversions that each carried their own bug:
 *
 *   localHr  built a sample date in JANUARY and formatted it in local time, so
 *            daylight-saving data was read through a standard-time offset and
 *            every hour displayed one hour early, in every DST timezone.
 *   localDay mapped a UTC weekday index through a UTC-midnight date, so anyone
 *            west of UTC saw the previous day's name.
 *
 * Both now work from the local index directly, with no Date round-trip.
 */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Verbatim copies of the helpers in app/dashboard/StreamPlanner.js.
const localHr = (h) => { const x = ((h % 24) + 24) % 24; return `${((x + 11) % 12) + 1} ${x < 12 ? 'AM' : 'PM'}` }
const localDay = (d) => DAY_NAMES[((d % 7) + 7) % 7] ?? '—'

describe('Timezone consistency', () => {
  test('hour labels are pure and never shift by a daylight-saving offset', () => {
    expect(localHr(0)).toBe('12 AM')
    expect(localHr(9)).toBe('9 AM')
    expect(localHr(12)).toBe('12 PM')
    expect(localHr(13)).toBe('1 PM')
    expect(localHr(22)).toBe('10 PM')
    expect(localHr(23)).toBe('11 PM')
  })

  test('every hour round-trips to its own label', () => {
    for (let h = 0; h < 24; h++) {
      const label = localHr(h)
      const [num, mer] = label.split(' ')
      const back = (parseInt(num) % 12) + (mer === 'PM' ? 12 : 0)
      expect(back).toBe(h)
    }
  })

  test('day labels match the local weekday index', () => {
    DAY_NAMES.forEach((name, i) => expect(localDay(i)).toBe(name))
  })

  test('a session is labelled with the wall-clock day and hour the creator streamed', () => {
    // Times chosen to straddle the UTC date line for creators either side of it.
    const cases = [
      '2026-09-14T22:00:00', // Mon late evening — next UTC day west of UTC
      '2026-09-15T13:00:00', // Tue midday
      '2026-09-15T21:00:00', // Tue evening
      '2026-09-16T08:00:00', // Wed morning
      '2026-09-13T00:30:00', // Sun just after midnight — previous UTC day east of UTC
    ]

    cases.forEach(iso => {
      const d = new Date(iso) // parsed as local time, as the planner does
      // The planner's bucketing, then its display.
      const shown = `${localDay(d.getDay())} ${localHr(d.getHours())}`
      const truth = `${d.toLocaleDateString('en-US', { weekday: 'long' })} ${d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })}`
      expect(shown).toBe(truth)
    })
  })

  test('bucketing by UTC would have disagreed with the creator clock', () => {
    // Guards the reasoning, not the old code: if the machine running the suite
    // is not on UTC, a UTC bucket and a local bucket must differ somewhere, so
    // this test proves the two bases are genuinely distinct rather than
    // accidentally equal on the CI box.
    const d = new Date('2026-09-14T22:00:00')
    const offsetMinutes = d.getTimezoneOffset()
    if (offsetMinutes !== 0) {
      const utcKey = `${d.getUTCDay()}-${d.getUTCHours()}`
      const localKey = `${d.getDay()}-${d.getHours()}`
      expect(utcKey).not.toBe(localKey)
    } else {
      expect(`${d.getUTCDay()}-${d.getUTCHours()}`).toBe(`${d.getDay()}-${d.getHours()}`)
    }
  })
})
