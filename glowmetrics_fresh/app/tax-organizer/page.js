'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import Sidebar from '../dashboard/Sidebar'
import { C, glassCard } from './theme'
import FiltersBar from './FiltersBar'
import SummaryCards from './SummaryCards'
import MonthlyBreakdown from './MonthlyBreakdown'
import PlatformBreakdown from './PlatformBreakdown'
import RecordsTable from './RecordsTable'
import DataQualityPanel from './DataQualityPanel'

const CURRENT_YEAR = new Date().getFullYear()

function buildParams({ mode, year, customStart, customEnd, selectedPlatforms, tz, extra = {} }) {
  const params = new URLSearchParams()
  if (mode === 'custom' && customStart && customEnd) {
    params.set('startDate', customStart)
    params.set('endDate', customEnd)
  } else {
    params.set('year', String(year))
  }
  if (selectedPlatforms.length > 0) params.set('platforms', selectedPlatforms.join(','))
  if (tz) params.set('tz', tz)
  Object.entries(extra).forEach(([k, v]) => params.set(k, String(v)))
  return params
}

async function authedFetch(path, token) {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Request failed')
  }
  return res.json()
}

async function downloadExport(path, token, fallbackName) {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Export failed.' }))
    throw new Error(body.error || 'Export failed.')
  }
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="([^"]+)"/)
  const filename = match ? match[1] : fallbackName
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function TaxOrganizerPage() {
  const router = useRouter()
  const [authStatus, setAuthStatus] = useState('connecting')
  const [user, setUser] = useState(null)
  const [isPro, setIsPro] = useState(false)
  const [tz] = useState(() => (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'))

  const [mode, setMode] = useState('year')
  const [year, setYear] = useState(String(CURRENT_YEAR))
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState([])
  const [search, setSearch] = useState('')

  const [allPlatforms, setAllPlatforms] = useState([])
  const [availableYears, setAvailableYears] = useState([CURRENT_YEAR])
  const [hasAnyData, setHasAnyData] = useState(true)

  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState(null)

  const [recordsData, setRecordsData] = useState(null)
  const [recordsLoading, setRecordsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')

  const [csvExporting, setCsvExporting] = useState(false)
  const [pdfExporting, setPdfExporting] = useState(false)
  const [exportError, setExportError] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authedUser } }) => {
      if (!authedUser) { router.replace('/login'); return }
      setUser(authedUser)
      supabase.from('profiles').select('plan').eq('id', authedUser.id).maybeSingle()
        .then(({ data }) => setIsPro(data?.plan === 'pro' || data?.plan === 'unlimited'))
      setAuthStatus('authenticated')
    })
  }, [router])

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }, [])

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      const token = await getToken()
      if (!token) { router.replace('/login'); return }

      // Unfiltered call discovers the full platform list + available years
      // for this period, independent of the current platform selection —
      // otherwise deselecting a platform would make it disappear from the
      // toggle list entirely.
      const baseParams = buildParams({ mode, year, customStart, customEnd, selectedPlatforms: [], tz })
      const base = await authedFetch(`/api/tax-organizer/summary?${baseParams}`, token)
      setAllPlatforms(base.platforms.map(p => p.platform))
      setAvailableYears(base.availableYears.length ? base.availableYears : [CURRENT_YEAR])
      setHasAnyData(base.hasAnyData)

      if (selectedPlatforms.length === 0) {
        setSummary(base)
      } else {
        const filteredParams = buildParams({ mode, year, customStart, customEnd, selectedPlatforms, tz })
        const filtered = await authedFetch(`/api/tax-organizer/summary?${filteredParams}`, token)
        setSummary(filtered)
      }
    } catch (err) {
      setSummaryError(err.message)
    } finally {
      setSummaryLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, year, customStart, customEnd, selectedPlatforms, tz, getToken, router])

  const loadRecords = useCallback(async () => {
    setRecordsLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const params = buildParams({
        mode, year, customStart, customEnd, selectedPlatforms, tz,
        extra: { page, pageSize: 50, sortBy, sortDir, search },
      })
      const data = await authedFetch(`/api/tax-organizer/records?${params}`, token)
      setRecordsData(data)
    } catch {
      setRecordsData(null)
    } finally {
      setRecordsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, year, customStart, customEnd, selectedPlatforms, tz, page, sortBy, sortDir, search, getToken])

  useEffect(() => { if (authStatus === 'authenticated') loadSummary() }, [authStatus, loadSummary])
  useEffect(() => { if (authStatus === 'authenticated') loadRecords() }, [authStatus, loadRecords])
  useEffect(() => { setPage(1) }, [mode, year, customStart, customEnd, selectedPlatforms, search, sortBy, sortDir])

  const handleTogglePlatform = (platform) => {
    setSelectedPlatforms(prev => prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform])
  }

  const handleSort = (key) => {
    const field = key === 'date' ? 'date' : key
    if (sortBy === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(field); setSortDir('desc') }
  }

  const handleReset = () => {
    setMode('year'); setYear(String(CURRENT_YEAR)); setCustomStart(''); setCustomEnd('')
    setSelectedPlatforms([]); setSearch('')
  }

  const exportParams = useMemo(
    () => buildParams({ mode, year, customStart, customEnd, selectedPlatforms, tz }),
    [mode, year, customStart, customEnd, selectedPlatforms, tz]
  )

  const handleExportCsv = async () => {
    setCsvExporting(true); setExportError(null)
    try {
      const token = await getToken()
      if (!token) { router.replace('/login'); return }
      await downloadExport(`/api/tax-organizer/export-csv?${exportParams}`, token, 'camcashgrl-earnings.csv')
    } catch (err) {
      setExportError(err.message)
    } finally {
      setCsvExporting(false)
    }
  }

  const handleExportPdf = async () => {
    setPdfExporting(true); setExportError(null)
    try {
      const token = await getToken()
      if (!token) { router.replace('/login'); return }
      await downloadExport(`/api/tax-organizer/export-pdf?${exportParams}`, token, 'camcashgrl-earnings-summary.pdf')
    } catch (err) {
      setExportError(`PDF generation failed: ${err.message} Your CSV export is still available.`)
    } finally {
      setPdfExporting(false)
    }
  }

  if (authStatus === 'connecting') {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.muted, fontSize: 14 }}>Loading…</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Sidebar
        activeTab="tax-organizer"
        onTabChange={() => {}}
        user={user}
        onSignOut={async () => { await supabase.auth.signOut(); router.replace('/login') }}
        isPro={isPro}
      />
      <div className="dash-main" style={{ marginLeft: 240, width: 'calc(100% - 240px)', minWidth: 0, padding: '32px 20px 80px', boxSizing: 'border-box', overflowX: 'hidden' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* ── HEADER ── */}
        <div style={{ marginBottom: 8 }}>
          <a href="/dashboard" style={{ fontSize: 12, color: C.muted, textDecoration: 'none' }}>← Back to dashboard</a>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: C.white, letterSpacing: -0.6, margin: '4px 0 6px' }}>
          Creator Tax Organizer
        </h1>
        <p style={{ fontSize: 14, color: C.muted, margin: '0 0 16px', maxWidth: 640 }}>
          Review, organize, and export your creator earnings for your own records or tax professional.
        </p>

        <div style={{ ...glassCard, padding: '14px 18px', marginBottom: 24, borderColor: 'rgba(245,158,11,0.3)' }}>
          <p style={{ fontSize: 12.5, color: C.text, margin: 0, lineHeight: 1.5 }}>
            CamCashGrl provides organizational tools and general educational information. It does not prepare or file
            tax returns and does not provide legal, accounting, or personalized tax advice.
          </p>
        </div>

        {summaryError && (
          <div style={{ ...glassCard, padding: 16, marginBottom: 20, borderColor: 'rgba(248,113,113,0.4)' }}>
            <div style={{ fontSize: 13, color: C.red }}>Could not load your earnings summary: {summaryError}</div>
          </div>
        )}

        <FiltersBar
          mode={mode} onModeChange={setMode}
          year={year} onYearChange={setYear} availableYears={availableYears}
          customStart={customStart} customEnd={customEnd}
          onCustomStartChange={setCustomStart} onCustomEndChange={setCustomEnd}
          allPlatforms={allPlatforms} selectedPlatforms={selectedPlatforms} onTogglePlatform={handleTogglePlatform}
          search={search} onSearchChange={setSearch}
          onReset={handleReset}
        />

        {!summaryLoading && summary && summary.totals.recordCount === 0 ? (
          <div style={{ ...glassCard, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 15, color: C.white, fontWeight: 700, marginBottom: 8 }}>
              No earnings data was found for this period.
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>
              {hasAnyData
                ? 'Try a different tax year, custom date range, or platform filter.'
                : 'Import your tip history to start organizing your earnings.'}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {!hasAnyData && <Button as="a" href="/onboarding">Import earnings</Button>}
              <Button as="a" href="/dashboard" variant="secondary">Go to dashboard</Button>
            </div>
          </div>
        ) : summaryLoading ? (
          <div style={{ ...glassCard, padding: 32, textAlign: 'center', color: C.muted, fontSize: 13 }}>
            Loading your earnings summary…
          </div>
        ) : (
          <>
            <SummaryCards totals={summary?.totals} dataAvailability={summary?.dataAvailability} />

            {summary?.requestedTimezoneWasInvalid && (
              <div style={{ ...glassCard, padding: '10px 16px', marginBottom: 20, borderColor: 'rgba(245,158,11,0.3)' }}>
                <span style={{ fontSize: 12, color: C.gold }}>
                  Your browser's timezone couldn't be recognized, so results use UTC instead.
                </span>
              </div>
            )}

            <div style={{ ...glassCard, padding: 20, marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, color: C.muted }}>
                Timezone used: <strong style={{ color: C.text }}>{summary?.timezone}</strong>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Button onClick={handleExportCsv} disabled={csvExporting} variant="secondary">
                  {csvExporting ? 'Exporting…' : 'Export Detailed CSV'}
                </Button>
                <Button onClick={handleExportPdf} disabled={pdfExporting}>
                  {pdfExporting ? 'Generating…' : 'Download Earnings Summary PDF'}
                </Button>
              </div>
            </div>

            {exportError && (
              <div style={{ ...glassCard, padding: 14, marginBottom: 20, borderColor: 'rgba(248,113,113,0.4)' }}>
                <div style={{ fontSize: 12.5, color: C.red }}>{exportError}</div>
              </div>
            )}

            <MonthlyBreakdown monthly={summary?.monthly} />
            <PlatformBreakdown platforms={summary?.platforms} />
            <DataQualityPanel issues={summary?.dataQuality?.issues} />
            <RecordsTable
              records={recordsData?.records}
              pagination={recordsData?.pagination}
              sortBy={sortBy} sortDir={sortDir} onSort={handleSort}
              page={page} onPageChange={setPage}
              loading={recordsLoading}
            />
          </>
        )}
      </div>
      </div>
    </div>
  )
}
