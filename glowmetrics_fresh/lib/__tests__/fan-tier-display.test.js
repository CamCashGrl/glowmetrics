import fs from 'fs'
import path from 'path'

// Regression: the engine gained Occasional and New/Developing tiers, but the
// Top Fans tab only listed Whale/Shark/Regular/Dormant, so those fans were
// hidden from every tier filter and "Regular" read 0. Every tier the engine
// can assign must have a filter and a colour.
const engine = fs.readFileSync(path.join(__dirname, '..', 'analytics.js'), 'utf8')
const page = fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'dashboard', 'page.js'), 'utf8')

const engineTiers = [...new Set([...engine.matchAll(/\btier = '([^']+)'/g)].map(m => m[1]))]

describe('fan tier display coverage', () => {
  it('finds the engine tiers', () => {
    expect(engineTiers).toEqual(expect.arrayContaining(['Regular', 'Whale', 'Shark', 'New/Developing', 'Dormant', 'Occasional']))
  })

  it('lists every engine tier as a Top Fans filter', () => {
    const filters = page.match(/const FAN_TIER_FILTERS = \[([^\]]+)\]/)[1]
    engineTiers.forEach(t => expect(filters).toContain(`"${t}"`))
  })

  it('gives every engine tier a colour', () => {
    const colors = page.match(/const TIER_COLORS = \{([^}]+)\}/)[1]
    engineTiers.forEach(t => expect(colors).toContain(`"${t}"`))
  })

})
