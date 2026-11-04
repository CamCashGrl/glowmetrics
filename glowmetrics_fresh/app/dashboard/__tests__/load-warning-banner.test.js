import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import LoadWarningBanner from '../LoadWarningBanner'
import fs from 'fs'
import path from 'path'

const partial = [{ table: 'tips', stale: false, reason: 'page_failed' }]
const stale = [{ table: 'paid_sessions', stale: true, reason: 'page_failed' }]

test('renders nothing when the history is complete', () => {
  const { container } = render(<LoadWarningBanner issues={[]} onRetry={() => {}} />)
  expect(container.firstChild).toBeNull()
})

test('partial load: a clear alert that totals may be understated, with a Retry action', () => {
  const onRetry = jest.fn()
  render(<LoadWarningBanner issues={partial} onRetry={onRetry} />)
  const b = screen.getByTestId('load-warning-banner')
  expect(b.getAttribute('role')).toBe('alert')
  expect(b.getAttribute('data-kind')).toBe('partial')
  expect(screen.getByTestId('load-warning-message').textContent).toMatch(/Data may be incomplete.*Some of your tips couldn't be loaded.*understated or missing/)
  fireEvent.click(screen.getByTestId('load-warning-retry'))
  expect(onRetry).toHaveBeenCalledTimes(1)
})

test('failed private-session load names private sessions; a stale refresh says the data is the last complete update', () => {
  const { unmount } = render(<LoadWarningBanner issues={[{ table: 'paid_sessions', stale: false }]} onRetry={() => {}} />)
  expect(screen.getByTestId('load-warning-message').textContent).toMatch(/private sessions couldn't be loaded/)
  unmount()
  render(<LoadWarningBanner issues={stale} onRetry={() => {}} />)
  expect(screen.getByTestId('load-warning-banner').getAttribute('data-kind')).toBe('stale')
  expect(screen.getByTestId('load-warning-message').textContent).toMatch(/last complete update/)
})

test('a partial issue wins over a stale one; both tables are named', () => {
  render(<LoadWarningBanner issues={[...partial, ...stale]} onRetry={() => {}} />)
  expect(screen.getByTestId('load-warning-banner').getAttribute('data-kind')).toBe('partial')
})

test('Retry is disabled while retrying; the banner has no dismiss control', () => {
  render(<LoadWarningBanner issues={partial} onRetry={() => {}} retrying />)
  expect(screen.getByTestId('load-warning-retry').disabled).toBe(true)
  expect(screen.getByTestId('load-warning-retry').textContent).toBe('Retrying…')
  expect(screen.getAllByRole('button')).toHaveLength(1)
})

// page.js is too large to render in a unit test; this guards the wiring itself.
describe('dashboard page wiring (static guard)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'page.js'), 'utf8')
  const loadData = src.slice(src.indexOf('const loadData = async'), src.indexOf('const stopImportMessageRotation'))
  test('Sessions receives the real load status', () => {
    expect(src).toMatch(/<SessionsOverview[\s\S]{0,900}tipsLoadComplete=\{dataComplete\}/)
    expect(src).toMatch(/<LoadWarningBanner issues=\{loadIssues\} onRetry=/)
  })
  test('loadData no longer swallows page errors or replaces data on failure', () => {
    expect(loadData).toContain('loadUserHistory(')
    expect(loadData).not.toMatch(/if \(error\) break/)
    expect(loadData).not.toMatch(/\.from\("tips"\)\.select\("\*"\)/)
    expect(loadData).not.toMatch(/\.from\("paid_sessions"\)\.select\("\*"\)/)
    expect(loadData).toMatch(/catch \(err\)/)
    expect(loadData).toMatch(/engineError/)
  })
  test('only complete tip loads are cached', () => {
    expect(loadData).toMatch(/if \(history\.tips\.complete\) sessionStorage\.setItem\(`camcash_tips_\$\{uid\}`/)
  })
})
