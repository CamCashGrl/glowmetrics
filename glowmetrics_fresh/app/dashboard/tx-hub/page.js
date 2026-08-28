"use client"
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '../../../lib/supabase'
import Sidebar from '../Sidebar'
import { C, card } from './theme'
import { presetToRange, todayIso, daysAgoIso } from './lib/format'
import TxHeader from './components/TxHeader'
import KpiCards from './components/KpiCards'
import TransactionTable from './components/TransactionTable'
import PlatformBreakdown from './components/PlatformBreakdown'
import TopFans from './components/TopFans'
import EmptyState from './components/EmptyState'

// recharts (EarningsChart + EarningsDonut) is the single heaviest dependency
// this page pulls in — code-split both so it's fetched/parsed only once the
// rest of the page (KPIs, table) is already interactive, instead of blocking
// first paint on it. Drawers are split too since most loads never open one.
const chartSkeleton = <div style={{ ...card({ padding: 0 }), height: 320, marginBottom: 20 }} />
const panelSkeleton = <div style={{ ...card({ padding: 0 }), height: 260 }} />
const EarningsChart = dynamic(() => import('./components/EarningsChart'), { loading: () => chartSkeleton })
const EarningsDonut = dynamic(() => import('./components/EarningsDonut'), { loading: () => panelSkeleton })
const EarningsCalendar = dynamic(() => import('./components/EarningsCalendar'), { loading: () => panelSkeleton })
const FilterDrawer = dynamic(() => import('./components/FilterDrawer'), { ssr: false })
const TransactionDrawer = dynamic(() => import('./components/TransactionDrawer'), { ssr: false })

const PAGE_SIZE = 25

export default function TxHubPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [isPro, setIsPro] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  const [dateState, setDateState] = useState({ preset: '30d', from: daysAgoIso(29), to: todayIso() })
  const [platform, setPlatform] = useState('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [types, setTypes] = useState([])
  const [amountRange, setAmountRange] = useState(null)
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedTx, setSelectedTx] = useState(null)

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { router.replace('/login'); return }
      setUser(u)
      supabase.from('profiles').select('plan, plan_expires_at').eq('id', u.id).maybeSingle().then(({ data: profile }) => {
        const proPlans = ['pro', 'unlimited']
        const expired = profile?.plan_expires_at && new Date(profile.plan_expires_at) <= new Date()
        setIsPro(!!profile && proPlans.includes(profile.plan) && !expired)
        setAuthChecked(true)
      })
    })
  }, [router])

  useEffect(() => { setPage(1) }, [dateState.from, dateState.to, platform, debouncedSearch, types, amountRange])

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        from: dateState.from,
        to: dateState.to,
        platform,
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sortBy, sortDir,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (types.length) params.set('types', types.join(','))
      if (amountRange?.min != null) params.set('amountMin', String(amountRange.min))
      if (amountRange?.max != null) params.set('amountMax', String(amountRange.max))

      const res = await fetch(`/api/tx-hub?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load TX Hub data.')
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e.message || 'Something went wrong loading your transactions.')
    } finally {
      setLoading(false)
    }
  }, [user, dateState.from, dateState.to, platform, page, sortBy, sortDir, debouncedSearch, types, amountRange])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSort = (col) => {
    const key = col === 'amount' ? 'amount' : col
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(key); setSortDir('desc') }
  }

  const goUpgrade = () => router.push('/pricing')

  const exportCsv = async () => {
    if (!data?.isPro) { goUpgrade(); return }
    const params = new URLSearchParams({
      from: dateState.from, to: dateState.to, platform,
      sortBy, sortDir,
    })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (types.length) params.set('types', types.join(','))
    if (amountRange?.min != null) params.set('amountMin', String(amountRange.min))
    if (amountRange?.max != null) params.set('amountMax', String(amountRange.max))
    const res = await fetch(`/api/tx-hub/export?${params.toString()}`)
    if (!res.ok) { goUpgrade(); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `camcash-transactions_${dateState.from}_${dateState.to}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const handleTabChange = (id) => {
    if (typeof window !== 'undefined') localStorage.setItem('camcash_tab', id)
    router.push('/dashboard')
  }

  const activeFilterCount = types.length + (amountRange ? 1 : 0)

  const isEmpty = authChecked && !loading && !error && data && data.transactions.totalUnfiltered === 0 && !debouncedSearch && !types.length && !amountRange && platform === 'all'

  if (!authChecked) {
    return <div style={{ minHeight: '100vh', background: C.bg }} />
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, position: 'relative' }}>
      <style>{`@media (max-width: 768px) { .tx-hub-main { margin-left: 0 !important; width: 100% !important; padding: 20px 16px 60px !important; } }`}</style>

      <Sidebar
        activeTab={null}
        onTabChange={handleTabChange}
        user={user}
        onSignOut={async () => { await supabase.auth.signOut(); router.replace('/login') }}
        isPro={isPro}
      />

      <main className="tx-hub-main" style={{ marginLeft: 240, width: 'calc(100% - 240px)', minWidth: 0, boxSizing: 'border-box', padding: '28px 28px 60px', maxWidth: 1400 }}>
        <TxHeader
          dateState={dateState}
          onDateChange={setDateState}
          platforms={data?.availablePlatforms || []}
          platform={platform}
          onPlatformChange={setPlatform}
          search={search}
          onSearchChange={(v) => { if (!data?.isPro && v) { goUpgrade(); return } setSearch(v) }}
          onExport={exportCsv}
          canExport={!!data?.isPro}
          onOpenFilters={() => data?.isPro ? setFiltersOpen(true) : goUpgrade()}
          activeFilterCount={activeFilterCount}
        />

        {error && (
          <div style={{ padding: 16, borderRadius: 12, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5', marginBottom: 20, fontSize: 13 }}>
            {error} <button onClick={fetchData} style={{ marginLeft: 8, textDecoration: 'underline', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>Retry</button>
          </div>
        )}

        {isEmpty ? (
          <EmptyState onUpload={() => handleTabChange('upload')} />
        ) : (
          <>
            <KpiCards kpis={data?.kpis} isPro={data?.isPro} loading={loading && !data} />

            <EarningsChart data={data?.chart?.series} granularity={data?.chart?.granularity || 'daily'} loading={loading && !data} />

            <TransactionTable
              rows={data?.transactions?.rows || []}
              total={data?.transactions?.total || 0}
              page={data?.transactions?.page || 1}
              pageSize={data?.transactions?.pageSize || PAGE_SIZE}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
              onPageChange={setPage}
              onSelect={setSelectedTx}
              loading={loading && !data}
              locked={!data?.isPro && (data?.transactions?.totalUnfiltered || 0) > PAGE_SIZE}
              lockedMessage="Upgrade to Creator Pro to see your complete transaction history across all dates and platforms."
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 20 }}>
              <PlatformBreakdown
                data={data?.platformBreakdown}
                locked={!data?.capabilities?.platformBreakdown}
                onUpgrade={goUpgrade}
                onSelectPlatform={setPlatform}
                loading={loading && !data}
              />
              <TopFans
                data={data?.topFans}
                locked={!data?.capabilities?.topFans}
                onUpgrade={goUpgrade}
                loading={loading && !data}
              />
              <EarningsDonut
                data={data?.earningsBreakdown}
                locked={!data?.capabilities?.earningsBreakdown}
                onUpgrade={goUpgrade}
                loading={loading && !data}
              />
              <EarningsCalendar
                data={data?.calendar}
                locked={!data?.capabilities?.calendar}
                onUpgrade={goUpgrade}
                onSelectDate={(d) => setDateState({ preset: 'custom', from: d, to: d })}
                loading={loading && !data}
              />
            </div>
          </>
        )}
      </main>

      <FilterDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        types={types}
        onTypesChange={setTypes}
        amountRange={amountRange}
        onAmountRangeChange={setAmountRange}
        availableTypes={null}
      />

      <TransactionDrawer tx={selectedTx} onClose={() => setSelectedTx(null)} />
    </div>
  )
}
