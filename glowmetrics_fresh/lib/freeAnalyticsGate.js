import { applyFreeAnalysisWindow } from './analytics'
import { canonicalPlatform } from './constants'
import { FREE_ANALYSIS_WINDOW_DAYS } from './planLimits'

// Canonical Free/trial analytics gate.
//
// Free and trial share the same data-access rules:
// 1) every platform is independently limited to its rolling 31-day slice;
// 2) Platform Comparison may use those recent slices across all platforms;
// 3) detailed analytics may use only the creator-selected analytics platform.
//
// IMPORTANT: selectedAnalyticsPlatform is never passed as an unlimited-history
// exception. Older rows remain stored but are not returned by either dataset.
export function buildCappedAnalyticsDatasets(
  tips = [],
  {
    selectedAnalyticsPlatform = null,
    windowDays = FREE_ANALYSIS_WINDOW_DAYS,
  } = {},
) {
  const comparisonTips = applyFreeAnalysisWindow(tips, { windowDays })
  const selected = selectedAnalyticsPlatform
    ? canonicalPlatform(selectedAnalyticsPlatform)
    : null

  const detailedAnalysisTips = selected
    ? comparisonTips.filter((row) => canonicalPlatform(row.platform) === selected)
    : []

  return {
    comparisonTips,
    detailedAnalysisTips,
  }
}
