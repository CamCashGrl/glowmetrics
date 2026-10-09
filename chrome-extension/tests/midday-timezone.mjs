// The dashboard's "Today" is the creator's local calendar day (browser time
// zone). Tests seed "today" activity up to ~1 hour back, so a run near UTC
// midnight would split it across two days. Run the test browser in a fixed
// UTC offset where it is currently about midday, so the last hours are always
// the same local day. Only the test browser changes; the app is untouched.
export function middayTimezone(now = new Date()) {
  let offset = 12 - now.getUTCHours() // hours to add to UTC to reach ~12:00 local
  if (offset > 14) offset -= 24
  if (offset < -12) offset += 24
  // IANA Etc/GMT signs are inverted: Etc/GMT-5 is UTC+5.
  return offset === 0 ? 'Etc/UTC' : offset > 0 ? `Etc/GMT-${offset}` : `Etc/GMT+${-offset}`
}
