import { buildCappedAnalyticsDatasets } from '../freeAnalyticsGate'

const rows = [
  { platform: 'Chaturbate', date_time: '2026-06-01T12:00:00Z', usd: 100, username: 'old_cb', tokens: 2000 },
  { platform: 'Chaturbate', date_time: '2026-10-01T12:00:00Z', usd: 10, username: 'new_cb', tokens: 200 },
  { platform: 'BongaCams', date_time: '2026-06-01T12:00:00Z', usd: 50, username: 'old_bc', tokens: 2000 },
  { platform: 'BongaCams', date_time: '2026-10-01T12:00:00Z', usd: 5, username: 'new_bc', tokens: 200 },
  { platform: 'MyFreeCams', date_time: '2026-09-25T12:00:00Z', usd: 8, username: 'new_mfc', tokens: 160 },
]

describe('Free/trial two-dataset analytics gate', () => {
  test('comparison keeps each platform recent slice and excludes old history', () => {
    const { comparisonTips } = buildCappedAnalyticsDatasets(rows, {
      selectedAnalyticsPlatform: 'Chaturbate',
    })

    expect(comparisonTips.map((row) => row.username).sort()).toEqual([
      'new_bc',
      'new_cb',
      'new_mfc',
    ])
  })

  test('detailed analytics include only the selected platform recent slice', () => {
    const { detailedAnalysisTips } = buildCappedAnalyticsDatasets(rows, {
      selectedAnalyticsPlatform: 'Chaturbate',
    })

    expect(detailedAnalysisTips.map((row) => row.username)).toEqual(['new_cb'])
  })

  test('selected platform never receives full history', () => {
    const { comparisonTips, detailedAnalysisTips } = buildCappedAnalyticsDatasets(rows, {
      selectedAnalyticsPlatform: 'Chaturbate',
    })

    expect(comparisonTips.some((row) => row.username === 'old_cb')).toBe(false)
    expect(detailedAnalysisTips.some((row) => row.username === 'old_cb')).toBe(false)
  })

  test('other platforms still contribute their own recent data to Platform Comparison', () => {
    const { comparisonTips } = buildCappedAnalyticsDatasets(rows, {
      selectedAnalyticsPlatform: 'Chaturbate',
    })

    expect(comparisonTips.some((row) => row.username === 'new_bc')).toBe(true)
    expect(comparisonTips.some((row) => row.username === 'new_mfc')).toBe(true)
  })

  test('no selected platform safely yields an empty detailed dataset', () => {
    const { comparisonTips, detailedAnalysisTips } = buildCappedAnalyticsDatasets(rows)

    expect(comparisonTips).toHaveLength(3)
    expect(detailedAnalysisTips).toEqual([])
  })
})
