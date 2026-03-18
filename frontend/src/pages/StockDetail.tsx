import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { MetricCard } from '@/components/ui/MetricCard'
import { TermTooltip } from '@/components/ui/TermTooltip'
import { formatMarketCap, formatPercent, CHART_COLORS } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { useState, useMemo } from 'react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useSmartTimeAxis } from '@/hooks/useSmartTimeAxis'

const RANGES = ['1Y', '3Y', '5Y', 'All'] as const

const BENCHMARK_OPTIONS = [
  { symbol: '^GSPC', label: 'S&P 500' },
  { symbol: '^DJI', label: 'Dow Jones' },
  { symbol: '^IXIC', label: 'Nasdaq' },
] as const

export default function StockDetail() {
  const { ticker } = useParams<{ ticker: string }>()
  const [range, setRange] = useState<typeof RANGES[number]>('All')
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<Set<string>>(new Set())

  const showBenchmarks = selectedBenchmarks.size > 0

  const toggleBenchmark = (symbol: string) => {
    setSelectedBenchmarks((prev) => {
      const next = new Set(prev)
      if (next.has(symbol)) next.delete(symbol)
      else next.add(symbol)
      return next
    })
  }

  const company = useQuery({
    queryKey: ['company', ticker],
    queryFn: () => api.getCompany(ticker!),
    enabled: !!ticker,
  })

  const companyName = company.data?.name
  const title =
    companyName && ticker
      ? `${companyName} (${ticker})`
      : ticker
      ? `Stock: ${ticker}`
      : 'Stock Detail'
  usePageTitle(title)

  const prices = useQuery({
    queryKey: ['prices', ticker],
    queryFn: () => api.getPriceHistory(ticker!),
    enabled: !!ticker,
  })

  const rankings = useQuery({
    queryKey: ['rankings', { ticker }],
    queryFn: () => api.getMarketCapRankings({ ticker }),
    enabled: !!ticker,
  })

  const benchmarks = useQuery({
    queryKey: ['benchmarks', { range }],
    queryFn: () => {
      const params: { start_date?: string; end_date?: string } = {}
      if (range !== 'All') {
        const today = new Date()
        const start = new Date()
        start.setFullYear(today.getFullYear() - parseInt(range))
        params.start_date = start.toISOString().slice(0, 10)
        params.end_date = today.toISOString().slice(0, 10)
      }
      return api.getBenchmarks(params)
    },
    enabled: showBenchmarks,
  })

  const filteredPrices = useMemo(() => {
    if (!prices.data) return []
    if (range === 'All') return prices.data
    const years = parseInt(range)
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - years)
    return prices.data.filter((p) => new Date(p.date) >= cutoff)
  }, [prices.data, range])

  const priceChartData = useMemo(() => {
    if (!filteredPrices.length) return []
    const basePrice = filteredPrices[0].adj_close

    // Forward-fill sampled benchmark data and re-normalize to visible range
    const benchmarkLines: { symbol: string; filled: Map<string, number> }[] = []
    if (showBenchmarks && benchmarks.data) {
      for (const b of benchmarks.data) {
        if (!selectedBenchmarks.has(b.index_symbol)) continue

        const dateMap = new Map<string, number>()
        b.dates.forEach((d, i) => dateMap.set(d, b.normalized_values[i]))

        const filled = new Map<string, number>()
        let lastRaw: number | null = null
        let baseVal: number | null = null
        for (const p of filteredPrices) {
          const raw = dateMap.get(p.date)
          if (raw !== undefined) lastRaw = raw
          if (lastRaw !== null) {
            if (baseVal === null) baseVal = lastRaw
            filled.set(p.date, ((lastRaw / baseVal) - 1) * 100)
          }
        }
        benchmarkLines.push({ symbol: b.index_symbol, filled })
      }
    }

    return filteredPrices.map((p) => {
      const point: Record<string, any> = {
        date: p.date,
        price: p.adj_close,
        normalized: ((p.adj_close - basePrice) / basePrice) * 100,
      }
      for (const bl of benchmarkLines) {
        const val = bl.filled.get(p.date)
        if (val !== undefined) point[bl.symbol] = val
      }
      return point
    })
  }, [filteredPrices, showBenchmarks, selectedBenchmarks, benchmarks.data])
  const { ticks: xTicks, tickFormatter } = useSmartTimeAxis(priceChartData, { dateKey: 'date' })

  const metrics = useMemo(() => {
    if (!prices.data || prices.data.length < 2) return null
    const sorted = [...prices.data].sort((a, b) => a.date.localeCompare(b.date))
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    const totalReturn = (last.adj_close - first.adj_close) / first.adj_close
    const years = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (365.25 * 86400000)
    const cagr = Math.pow(1 + totalReturn, 1 / years) - 1

    let maxDrawdown = 0
    let peak = -Infinity
    for (const p of sorted) {
      if (p.adj_close > peak) peak = p.adj_close
      const dd = (p.adj_close - peak) / peak
      if (dd < maxDrawdown) maxDrawdown = dd
    }

    return { totalReturn, cagr, maxDrawdown, years }
  }, [prices.data])

  const rankHistory = useMemo(() => {
    if (!rankings.data?.results) return []
    return [...rankings.data.results].sort((a, b) => a.year - b.year)
  }, [rankings.data])

  if (!ticker) return null

  return (
    <div className="space-y-6">
      <div>
        <Link to="/stocks" className="inline-flex items-center gap-1 text-text-muted hover:text-accent text-sm no-underline transition-colors mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to stocks
        </Link>
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold text-text-primary">{ticker}</h1>
          {company.data && (
            <span className="text-text-secondary">{company.data.name}</span>
          )}
        </div>
        {company.data?.sector && (
          <p className="text-sm text-text-muted mt-1">{company.data.sector} &middot; {company.data.industry}</p>
        )}
      </div>

      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Total Return"
            term="Total Return"
            value={formatPercent(metrics.totalReturn)}
            changeType={metrics.totalReturn >= 0 ? 'positive' : 'negative'}
          />
          <MetricCard
            label="CAGR"
            term="CAGR"
            value={formatPercent(metrics.cagr)}
            changeType={metrics.cagr >= 0 ? 'positive' : 'negative'}
          />
          <MetricCard
            label="Max Drawdown"
            term="Max Drawdown"
            value={formatPercent(metrics.maxDrawdown)}
            changeType="negative"
          />
          <MetricCard
            label="Period"
            value={`${metrics.years.toFixed(1)} years`}
          />
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Price History</CardTitle>
          <div className="flex gap-2 items-center">
            <div className="flex gap-3">
              {BENCHMARK_OPTIONS.map((b) => (
                <label key={b.symbol} className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedBenchmarks.has(b.symbol)}
                    onChange={() => toggleBenchmark(b.symbol)}
                    className="rounded"
                  />
                  {b.label}
                </label>
              ))}
            </div>
            <div className="flex gap-1 ml-4">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 rounded text-xs transition-colors ${
                    range === r
                      ? 'bg-accent text-white'
                      : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        {priceChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={priceChartData} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis
                dataKey="date"
                stroke="#55556a"
                ticks={xTicks.length ? xTicks : undefined}
                tickFormatter={tickFormatter}
                minTickGap={30}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#55556a"
                tickFormatter={showBenchmarks
                  ? (v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`
                  : (v) => `$${v.toFixed(0)}`
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a25',
                  border: '1px solid #2a2a3a',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#e4e4ef' }}
                formatter={(value: number, name: string) =>
                  showBenchmarks
                    ? [`${value >= 0 ? '+' : ''}${value.toFixed(1)}%`, name]
                    : [`$${value.toFixed(2)}`, name]
                }
              />
              <Line
                type="monotone"
                dataKey={showBenchmarks ? 'normalized' : 'price'}
                stroke={CHART_COLORS[0]}
                strokeWidth={2}
                dot={false}
                name={ticker}
              />
              {BENCHMARK_OPTIONS.filter((b) => selectedBenchmarks.has(b.symbol)).map((b, i) => (
                <Line
                  key={b.symbol}
                  type="monotone"
                  dataKey={b.symbol}
                  stroke={CHART_COLORS[i + 2]}
                  strokeWidth={1.5}
                  dot={false}
                  name={b.label}
                  strokeDasharray="5 5"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-text-muted">
            {prices.isLoading ? 'Loading price data...' : 'No price data available. Run the price gathering script.'}
          </div>
        )}
      </Card>

      {rankHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle><TermTooltip term="Market Cap">Market Cap</TermTooltip> <TermTooltip term="Rank">Rank</TermTooltip> History</CardTitle>
          </CardHeader>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={rankHistory} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis dataKey="year" stroke="#55556a" />
              <YAxis reversed domain={[1, 20]} stroke="#55556a" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a25',
                  border: '1px solid #2a2a3a',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [`#${value}`, 'Rank']}
              />
              <Line type="monotone" dataKey="rank" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-text-muted font-medium">Year</th>
                  <th className="text-left py-2 px-3 text-text-muted font-medium"><TermTooltip term="Rank">Rank</TermTooltip></th>
                  <th className="text-right py-2 px-3 text-text-muted font-medium"><TermTooltip term="Market Cap">Market Cap</TermTooltip></th>
                </tr>
              </thead>
              <tbody>
                {[...rankHistory].reverse().map((r) => (
                  <tr key={r.year} className="border-b border-border-subtle">
                    <td className="py-2 px-3 text-text-secondary">{r.year}</td>
                    <td className="py-2 px-3 text-text-primary">#{r.rank}</td>
                    <td className="py-2 px-3 text-right text-text-primary">{formatMarketCap(r.market_cap)}</td>
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
