/**
 * The Standard monthly price shown to users must match STANDARD_MONTHLY_USD
 * everywhere — a stale price on one page misleads customers at checkout.
 */
import fs from 'fs'
import path from 'path'
import { STANDARD_MONTHLY_USD } from '../../lib/constants'

const ROOT = path.join(__dirname, '..', '..')
const PAGES = [
  'app/pricing/PricingClient.js',
  'app/pricing/page.js',
  'app/landing/LandingClient.js',
  'app/onboarding/page.js',
  'app/blog/camcash-vs-camdash-vs-cb-cam-insights/page.js',
]
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

describe('Standard monthly price copy', () => {
  test('constant is $9.99', () => {
    expect(STANDARD_MONTHLY_USD).toBe(9.99)
  })

  test.each(PAGES)('%s shows the current price and not the old one', (p) => {
    const src = read(p)
    expect(src).not.toContain('$19.99')
    expect(src).toContain(`$${STANDARD_MONTHLY_USD}`)
  })
})
