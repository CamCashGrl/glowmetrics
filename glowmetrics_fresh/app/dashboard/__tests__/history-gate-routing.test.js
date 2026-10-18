import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import PlatformsIntelligence from '../PlatformsIntelligence'
import fs from 'fs'
import path from 'path'
import { parse } from '@babel/parser'
import { buildCappedAnalyticsDatasets } from '../../../lib/freeAnalyticsGate'
import { accessibleDataset, aggregateRows as runEngine } from '../../../lib/analytics'
import { canonicalPlatform } from '../../../lib/constants'
import { hasPaidProAccess, resolvePlatformRoles as resolvePlanPlatformRoles } from '../../../lib/planLimits'

// Execute actual dashboard routing expressions with the real existing helpers,
// including async closures whose initial render may predate profile loading.
const source = fs.readFileSync(path.join(__dirname, '../page.js'), 'utf8')
const declarations = []
function visit(node) {
  if (!node || typeof node !== 'object') return
  if (node.type === 'VariableDeclarator') declarations.push(node)
  Object.values(node).forEach(value => {
    if (Array.isArray(value)) value.forEach(visit)
    else if (value && typeof value === 'object') visit(value)
  })
}
visit(parse(source, { sourceType: 'module', plugins: ['jsx'] }))
const helpers = { buildCappedAnalyticsDatasets, accessibleDataset, canonicalPlatform, hasPaidProAccess, resolvePlanPlatformRoles, runEngine }
function expression(node, scope) {
  const bindings = { ...helpers, ...scope }
  return new Function(...Object.keys(bindings), `return (${source.slice(node.start, node.end)})`)(...Object.values(bindings))
}
function value(name, scope) {
  return expression(declarations.find(node => node.id.name === name).init, scope)
}
const dataset = declarations.find(node => node.id.type === 'ObjectPattern' && node.id.properties.some(p => p.key.name === 'comparisonTips'))
const rows = [
  { id: 1, platform: 'Chaturbate', date_time: '2026-06-01T12:00:00Z', username: 'old_cb', usd: 1000, tokens: 20000 },
  { id: 2, platform: 'Chaturbate', date_time: '2026-10-01T12:00:00Z', username: 'recent_cb', usd: 10, tokens: 200 },
  { id: 3, platform: 'BongaCams', date_time: '2026-05-01T12:00:00Z', username: 'old_bc', usd: 2000, tokens: 80000 },
  { id: 4, platform: 'BongaCams', date_time: '2026-08-01T12:00:00Z', username: 'recent_bc', usd: 20, tokens: 800 },
]
function dashboardScope(plan, subscription_status, primary_pro_platform = 'chaturbate') {
  const scope = { tips: rows, profile: { plan, subscription_status, primary_pro_platform }, React: { useMemo: fn => fn() } }
  scope.isPaidPro = value('isPaidPro', scope)
  scope.selectedAnalyticsPlatform = value('selectedAnalyticsPlatform', scope)
  Object.assign(scope, expression(dataset.init, scope))
  return scope
}

describe('Dashboard history gate routing', () => {
  test.each([['free', null], ['pro', 'trialing'], ['pro', null], ['pro', 'past_due'], ['pro', 'canceled']])('%s / %s caps detail and independently windows comparison', (plan, status) => {
    const scope = dashboardScope(plan, status)
    expect(scope.isPaidPro).toBe(false)
    expect(scope.comparisonTips.map(r => r.id)).toEqual([2, 4])
    expect(scope.detailedAnalysisTips.map(r => r.id)).toEqual([2])
    expect(rows).toHaveLength(4)
  })
  test.each([['pro', 'active'], ['unlimited', null], ['unlimited', 'trialing']])('%s / %s preserves full-history dataset references', (plan, status) => {
    const scope = dashboardScope(plan, status)
    expect(scope.isPaidPro).toBe(true)
    expect(scope.comparisonTips).toBe(rows)
    expect(scope.detailedAnalysisTips).toBe(rows)
  })
  test('changing or clearing selection never unlocks history', () => {
    expect(dashboardScope('pro', 'trialing', 'bongacams').detailedAnalysisTips.map(r => r.id)).toEqual([4])
    expect(dashboardScope('free', null, null).detailedAnalysisTips).toEqual([])
  })
  const asyncInputs = declarations.filter(node => node.id.name === 'analysisTips' && source.slice(node.init.start, node.init.end).includes('gatingRef.current'))
  test('covers initial/import, realtime, and timer engine routes', () => expect(asyncInputs).toHaveLength(3))
  test.each([false, true])('async loaders read current entitlements (paid = %s)', isPaidPro => {
    const gatingRef = { current: { isPaidPro, selectedAnalyticsPlatform: 'BongaCams' } }
    for (const input of asyncInputs) {
      const scope = { gatingRef, allData: rows, updated: rows, prev: rows }
      expect(expression(input.init, scope).map(r => r.id)).toEqual(isPaidPro ? [1, 2, 3, 4] : [4])
      gatingRef.current.selectedAnalyticsPlatform = 'Chaturbate'
      expect(expression(input.init, scope).map(r => r.id)).toEqual(isPaidPro ? [1, 2, 3, 4] : [2])
      gatingRef.current.selectedAnalyticsPlatform = 'BongaCams'
    }
  })
  test('private earnings/shows exclude old rows and other platforms; paid access preserves all', () => {
    const scope = dashboardScope('pro', 'trialing')
    Object.assign(scope, {
      paidSessions: rows,
      livePrivateIntervals: rows.map(row => ({ ...row, ended_at: row.date_time })),
      recentShows: { shows: [
        ...rows.map(row => ({ ...row, startedAt: row.date_time, platformRevenue: [{ platform: row.platform }] })),
        { id: 5, startedAt: '2026-10-01T12:00:00Z', platformRevenue: [{ platform: 'Chaturbate' }, { platform: 'BongaCams' }] },
      ] },
      derivedCacheRef: { current: {} }, memoOn: (_cache, _key, _deps, fn) => fn(),
    })
    const result = value('accessible', scope)
    for (const key of ['tips', 'paidSessions', 'liveIntervals', 'shows']) expect(result[key].map(r => r.id)).toEqual([2])
    scope.isPaidPro = true
    const paid = value('accessible', scope)
    expect(paid.tips).toBe(rows)
    expect(paid.paidSessions).toBe(rows)
    expect(paid.shows).toBe(scope.recentShows.shows)
  })
})


describe('Platform Comparison and detailed platform views', () => {
  afterEach(cleanup)
  test('Free comparison retains every recent platform; split detail only lists the selection', () => {
    const { comparisonTips, detailedAnalysisTips } = dashboardScope('pro', 'trialing')
    render(<PlatformsIntelligence analytics={runEngine(detailedAnalysisTips)} comparisonAnalytics={runEngine(comparisonTips)} tips={comparisonTips} />)
    expect(screen.getAllByText('BongaCams').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'split' }))
    expect(screen.getByRole('button', { name: 'Chaturbate' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'BongaCams' })).toBeNull()
  })
  test('comparison works before a detailed platform is selected', () => {
    const { comparisonTips, detailedAnalysisTips } = dashboardScope('free', null, null)
    render(<PlatformsIntelligence analytics={runEngine(detailedAnalysisTips)} comparisonAnalytics={runEngine(comparisonTips)} tips={detailedAnalysisTips} comparisonTips={comparisonTips} />)
    expect(screen.getAllByText('BongaCams').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'split' }))
    expect(screen.queryByRole('button', { name: 'BongaCams' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Chaturbate' })).toBeNull()
  })
  test('paid users retain both platforms in the detailed split view', () => {
    render(<PlatformsIntelligence analytics={runEngine(rows)} tips={rows} isPro />)
    fireEvent.click(screen.getByRole('button', { name: 'split' }))
    expect(screen.getByRole('button', { name: 'Chaturbate' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'BongaCams' })).toBeTruthy()
  })
})
