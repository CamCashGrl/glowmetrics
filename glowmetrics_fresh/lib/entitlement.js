// Shared plan-aware redaction — the single implementation of the entitlement
// contract (entitlement-contract.md) every server-side insight category
// should call, instead of hand-coding its own branch the way
// get_user_insights (PR #407) currently does inline.
//
// Contract:
//   Free  (unlocked: false) -> { unlocked: false, preview: { category, summary, count } }
//   Pro   (unlocked: true)  -> { unlocked: true,  data: <full payload> }
//
// The Free response never contains the Pro `data` key (not even null) — the
// key is omitted entirely so the client can't infer schema from a nulled-out
// field. Callers must compute the full result once and pass it in; this
// function only decides what leaves the response, it never recomputes.

/**
 * @param {boolean} isPro
 * @param {string} category - one of entitlement-contract.md's categories
 * @param {string} summary - honest, non-manipulative Free-tier description
 * @param {number} count - Free-tier count hint (e.g. "3 opportunities")
 * @param {*} data - the full Pro-tier payload
 * @returns {{unlocked:false, preview:{category,summary,count}} | {unlocked:true, data:*}}
 */
export function redact({ isPro, category, summary, count, data }) {
  if (!isPro) {
    return { unlocked: false, preview: { category, summary, count } }
  }
  return { unlocked: true, data }
}
