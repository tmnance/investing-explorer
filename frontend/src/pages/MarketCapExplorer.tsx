import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { api, type MarketCapRanking } from '@/api/client'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { TermTooltip } from '@/components/ui/TermTooltip'
import { formatMarketCap, CHART_COLORS } from '@/lib/utils'
import { Link } from 'react-router-dom'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

export default function MarketCapExplorer() {
  usePageTitle('Market Cap Explorer')
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart')

  const years = useQuery({
    queryKey: ['rankingYears'],
    queryFn: () => api.getRankingYears(),
  })

  const allRankings = useQuery({
    queryKey: ['allRankings'],
    queryFn: async () => {
      const res = await api.getMarketCapRankings()
      return res.results
    },
  })

  const uniqueTickers = useMemo(() => {
    if (!allRankings.data) return []
    const tickers = new Set(allRankings.data.map((r) => r.ticker))
    return Array.from(tickers).sort()
  }, [allRankings.data])

  /** Top 20 tickers by year; used for "Top 20 for this year" filter action */
  const top20ByYear = useMemo(() => {
    if (!allRankings.data || !years.data) return {} as Record<number, string[]>
    const byYear: Record<number, string[]> = {}
    for (const year of years.data) {
      const yearRankings = allRankings.data
        .filter((r) => r.year === year)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 20)
      byYear[year] = yearRankings.map((r) => r.ticker)
    }
    return byYear
  }, [allRankings.data, years.data])

  const selectTop20ForYear = (year: number) => {
    const tickers = top20ByYear[year]
    if (tickers) setSelectedCompanies(new Set(tickers))
  }

  /** Year whose top 20 is currently selected (if any) */
  const selectedYearFilter = useMemo(() => {
    if (selectedCompanies.size === 0) return null
    for (const [year, tickers] of Object.entries(top20ByYear)) {
      const set = new Set(tickers)
      if (set.size === selectedCompanies.size && tickers.every((t) => selectedCompanies.has(t)))
        return Number(year)
    }
    return null
  }, [selectedCompanies, top20ByYear])

  const bumpChartData = useMemo(() => {
    if (!allRankings.data || !years.data) return []
    const yearList = [...years.data].sort()
    return yearList.map((year) => {
      const yearRankings = allRankings.data!.filter((r) => r.year === year)
      const point: Record<string, any> = { year }
      yearRankings.forEach((r) => {
        point[r.ticker] = r.rank
      })
      return point
    })
  }, [allRankings.data, years.data])

  const displayTickers = useMemo(() => {
    if (selectedCompanies.size > 0) return Array.from(selectedCompanies)
    const alwaysPresent = new Map<string, number>()
    if (!allRankings.data || !years.data) return []
    allRankings.data.forEach((r) => {
      alwaysPresent.set(r.ticker, (alwaysPresent.get(r.ticker) ?? 0) + 1)
    })
    return Array.from(alwaysPresent.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([t]) => t)
  }, [allRankings.data, years.data, selectedCompanies])

  const toggleCompany = (ticker: string) => {
    setSelectedCompanies((prev) => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
  }

  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const tableData = useMemo(() => {
    if (!allRankings.data) return []
    const yr = selectedYear ?? (years.data?.[0] ?? 2025)
    return allRankings.data.filter((r) => r.year === yr).sort((a, b) => a.rank - b.rank)
  }, [allRankings.data, selectedYear, years.data])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Market Cap Explorer</h1>
        <p className="text-text-secondary mt-1">Track how the top 20 companies have shifted over time</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('chart')}
          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
            viewMode === 'chart'
              ? 'bg-accent text-white'
              : 'bg-surface border border-border text-text-secondary hover:text-text-primary'
          }`}
        >
          Bump Chart
        </button>
        <button
          onClick={() => setViewMode('table')}
          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
            viewMode === 'table'
              ? 'bg-accent text-white'
              : 'bg-surface border border-border text-text-secondary hover:text-text-primary'
          }`}
        >
          Table View
        </button>
      </div>

      {viewMode === 'chart' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>
                  Rank Trajectory
                  {years.data && years.data.length >= 2 && (
                    <span> ({Math.min(...years.data)}–{Math.max(...years.data)})</span>
                  )}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-text-muted mr-1">Top 20 in:</span>
                  {(years.data ?? []).sort().map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => selectTop20ForYear(y)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        selectedYearFilter === y
                          ? 'bg-accent text-white'
                          : 'bg-surface-elevated border border-border text-text-secondary hover:text-text-primary hover:border-text-muted'
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                  {selectedCompanies.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCompanies(new Set())}
                      className="px-2.5 py-1 rounded text-xs text-text-muted hover:text-accent border border-transparent hover:border-border transition-colors"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
              </div>
              {selectedYearFilter != null && (
                <p className="text-xs text-text-secondary mt-2">
                  Showing top 20 companies for {selectedYearFilter}. Chart displays their rank over time.
                </p>
              )}
            </CardHeader>
            {bumpChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={500}>
                <LineChart data={bumpChartData} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                  <XAxis dataKey="year" stroke="#55556a" />
                  <YAxis reversed domain={[1, 20]} stroke="#55556a" tickCount={20}
                    label={{ value: 'Rank', angle: -90, position: 'insideLeft', fill: '#55556a' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a25',
                      border: '1px solid #2a2a3a',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#e4e4ef' }}
                    itemStyle={{ color: '#8888a0' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const sorted = [...payload].sort((a, b) => (a.value as number) - (b.value as number))
                      return (
                        <div className="bg-surface-elevated border border-border rounded-lg px-3 py-2 shadow-lg">
                          <p className="text-text-primary font-medium mb-2">{label}</p>
                          <div className="space-y-1">
                            {sorted.map((entry) => (
                              <p key={entry.dataKey} className="text-sm text-text-secondary">
                                #{entry.value} {entry.name}
                              </p>
                            ))}
                          </div>
                        </div>
                      )
                    }}
                  />
                  {displayTickers.map((ticker, i) => (
                    <Line
                      key={ticker}
                      type="monotone"
                      dataKey={ticker}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls={false}
                      name={ticker}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[500px] flex items-center justify-center text-text-muted">
                {allRankings.isLoading ? 'Loading...' : 'No data available'}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Filter Companies</CardTitle>
            </CardHeader>
            <div className="space-y-1 max-h-[460px] overflow-y-auto">
              {uniqueTickers.map((ticker) => (
                <button
                  key={ticker}
                  onClick={() => toggleCompany(ticker)}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                    selectedCompanies.has(ticker)
                      ? 'bg-accent/20 text-accent'
                      : selectedCompanies.size > 0
                        ? 'text-text-muted hover:text-text-secondary'
                        : displayTickers.includes(ticker)
                          ? 'text-text-primary'
                          : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {ticker}
                </button>
              ))}
              {selectedCompanies.size > 0 && (
                <button
                  onClick={() => setSelectedCompanies(new Set())}
                  className="w-full text-left px-3 py-1.5 rounded text-sm text-text-muted hover:text-accent transition-colors mt-2 border-t border-border pt-3"
                >
                  Clear filter
                </button>
              )}
            </div>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Rankings</CardTitle>
            <select
              value={selectedYear ?? years.data?.[0] ?? 2025}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-surface-elevated border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary"
            >
              {(years.data ?? []).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-text-muted font-medium"><TermTooltip term="Rank">Rank</TermTooltip></th>
                  <th className="text-left py-3 px-4 text-text-muted font-medium">Company</th>
                  <th className="text-left py-3 px-4 text-text-muted font-medium">Ticker</th>
                  <th className="text-right py-3 px-4 text-text-muted font-medium"><TermTooltip term="Market Cap">Market Cap</TermTooltip></th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((r) => (
                  <tr key={r.id} className="border-b border-border-subtle hover:bg-surface-elevated transition-colors">
                    <td className="py-3 px-4 text-text-secondary">#{r.rank}</td>
                    <td className="py-3 px-4">
                      <Link to={`/stocks/${r.ticker}`} className="text-text-primary hover:text-accent no-underline transition-colors">
                        {r.company_name}
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-mono text-accent">{r.ticker}</td>
                    <td className="py-3 px-4 text-right text-text-primary">{formatMarketCap(r.market_cap)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
