import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { api } from '@/api/client'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { MetricCard } from '@/components/ui/MetricCard'
import { TermTooltip } from '@/components/ui/TermTooltip'
import { formatPercent, CHART_COLORS } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Plus, Trash2, Play } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'

interface Allocation {
  ticker: string
  weight: number
}

const BENCHMARKS = [
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^DJI', name: 'Dow Jones' },
  { symbol: '^IXIC', name: 'Nasdaq' },
] as const

interface BenchmarkResult {
  name: string
  values: number[]
  metrics: {
    total_return: number
    cagr: number
    volatility: number
    sharpe_ratio: number
    sortino_ratio: number
    max_drawdown: number
  }
}

interface SimulationResult {
  dates: string[]
  portfolio_values: number[]
  benchmarks: BenchmarkResult[]
  metrics: {
    total_return: number
    cagr: number
    volatility: number
    sharpe_ratio: number
    sortino_ratio: number
    max_drawdown: number
  }
}

export default function PortfolioSimulator() {
  usePageTitle('Portfolio Simulator')
  const [allocations, setAllocations] = useState<Allocation[]>([
    { ticker: 'AAPL', weight: 25 },
    { ticker: 'MSFT', weight: 25 },
    { ticker: 'NVDA', weight: 25 },
    { ticker: 'GOOGL', weight: 25 },
  ])
  const [startYear, setStartYear] = useState(2016)
  const [endYear, setEndYear] = useState(2025)
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<Set<string>>(new Set(['^GSPC']))

  const toggleBenchmark = (symbol: string) => {
    setSelectedBenchmarks((prev) => {
      const next = new Set(prev)
      if (next.has(symbol)) {
        next.delete(symbol)
        if (next.size === 0) next.add('^GSPC')
      } else next.add(symbol)
      return next
    })
  }
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const companies = useQuery({
    queryKey: ['companies'],
    queryFn: () => api.getCompanies(),
  })

  const tickers = useMemo(() =>
    (companies.data?.results ?? []).map((c) => c.ticker),
    [companies.data]
  )

  const totalWeight = allocations.reduce((sum, a) => sum + a.weight, 0)

  const addAllocation = () => {
    const unused = tickers.find((t) => !allocations.some((a) => a.ticker === t))
    if (unused) {
      setAllocations([...allocations, { ticker: unused, weight: 0 }])
    }
  }

  const removeAllocation = (index: number) => {
    setAllocations(allocations.filter((_, i) => i !== index))
  }

  const updateAllocation = (index: number, field: 'ticker' | 'weight', value: string | number) => {
    setAllocations(allocations.map((a, i) =>
      i === index ? { ...a, [field]: field === 'weight' ? Number(value) : value } : a
    ))
  }

  const equalizeWeights = () => {
    const w = Math.round(100 / allocations.length * 100) / 100
    setAllocations(allocations.map((a) => ({ ...a, weight: w })))
  }

  const runSimulation = async () => {
    if (totalWeight === 0 || allocations.length === 0) return
    setIsRunning(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        allocations: JSON.stringify(
          allocations.map((a) => ({ ticker: a.ticker, weight: a.weight / 100 }))
        ),
        start_year: String(startYear),
        end_year: String(endYear),
        benchmarks: Array.from(selectedBenchmarks).join(','),
      })
      const res = await fetch(`/api/simulator/?${params}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Simulation failed')
      }
      setResult(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsRunning(false)
    }
  }

  const chartData = useMemo(() => {
    if (!result) return []
    return result.dates.map((date, i) => {
      const point: Record<string, number | string> = {
        date,
        Portfolio: (result.portfolio_values[i] - 1) * 100,
      }
      result.benchmarks.forEach((b) => {
        point[b.name] = (b.values[i] - 1) * 100
      })
      return point
    })
  }, [result])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Portfolio Simulator</h1>
        <p className="text-text-secondary mt-1">
          Build a custom portfolio and backtest against one or more benchmarks (S&P 500, Dow Jones, Nasdaq)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Allocations</CardTitle>
            <div className="flex gap-2">
              <button
                onClick={equalizeWeights}
                className="px-3 py-1.5 rounded-lg text-xs bg-surface-elevated border border-border text-text-secondary hover:text-text-primary transition-colors"
              >
                Equalize
              </button>
              <button
                onClick={addAllocation}
                className="px-3 py-1.5 rounded-lg text-xs bg-accent text-white flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
          </CardHeader>

          <div className="space-y-2">
            {allocations.map((a, i) => (
              <div key={i} className="flex items-center gap-3">
                <select
                  value={a.ticker}
                  onChange={(e) => updateAllocation(i, 'ticker', e.target.value)}
                  className="flex-1 bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
                >
                  {tickers.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={a.weight}
                    onChange={(e) => updateAllocation(i, 'weight', e.target.value)}
                    className="w-20 bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary text-right"
                  />
                  <span className="text-xs text-text-muted">%</span>
                </div>
                <button
                  onClick={() => removeAllocation(i)}
                  className="p-2 text-text-muted hover:text-red transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className={`text-sm ${Math.abs(totalWeight - 100) < 0.01 ? 'text-green' : 'text-amber'}`}>
              Total: {totalWeight.toFixed(1)}%
              {Math.abs(totalWeight - 100) > 0.01 && ' (should be 100%)'}
            </span>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parameters</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Start Year</label>
              <select
                value={startYear}
                onChange={(e) => setStartYear(Number(e.target.value))}
                className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
              >
                {Array.from({ length: 10 }, (_, i) => 2016 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">End Year</label>
              <select
                value={endYear}
                onChange={(e) => setEndYear(Number(e.target.value))}
                className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
              >
                {Array.from({ length: 10 }, (_, i) => 2016 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-2 block">Benchmarks</label>
              <div className="flex flex-wrap gap-3">
                {BENCHMARKS.map((b) => (
                  <label key={b.symbol} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedBenchmarks.has(b.symbol)}
                      onChange={() => toggleBenchmark(b.symbol)}
                      className="rounded"
                    />
                    <span className="text-sm text-text-primary">{b.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <button
              onClick={runSimulation}
              disabled={isRunning || allocations.length === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {isRunning ? 'Running...' : 'Run Backtest'}
            </button>
            {error && (
              <p className="text-sm text-red">{error}</p>
            )}
          </div>
        </Card>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Portfolio Return"
              term="Total Return"
              value={formatPercent(result.metrics.total_return)}
              changeType={result.metrics.total_return >= 0 ? 'positive' : 'negative'}
            />
            <MetricCard
              label="Portfolio CAGR"
              term="CAGR"
              value={formatPercent(result.metrics.cagr)}
              changeType={result.metrics.cagr >= 0 ? 'positive' : 'negative'}
            />
            {result.benchmarks.map((b) => (
              <MetricCard
                key={b.name}
                label={`${b.name} Return`}
                term="Total Return"
                value={formatPercent(b.metrics.total_return)}
                changeType={b.metrics.total_return >= 0 ? 'positive' : 'negative'}
              />
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Portfolio vs Benchmarks (% Return)</CardTitle>
            </CardHeader>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                <XAxis dataKey="date" stroke="#55556a" tickFormatter={(d) => d.slice(0, 4)} minTickGap={60} />
                <YAxis stroke="#55556a" tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a25',
                    border: '1px solid #2a2a3a',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#e4e4ef' }}
                  formatter={(v) => [typeof v === 'number' ? `${v.toFixed(2)}%` : String(v)]}
                />
                <Legend />
                <Line type="monotone" dataKey="Portfolio" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
                {result.benchmarks.map((b, i) => (
                  <Line key={b.name} type="monotone" dataKey={b.name} stroke={CHART_COLORS[(i + 1) % CHART_COLORS.length]} strokeWidth={2} dot={false} strokeDasharray="5 5" />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Risk & Return Comparison</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-text-muted font-medium">Metric</th>
                    <th className="text-right py-3 px-4 text-text-muted font-medium">Portfolio</th>
                    {result.benchmarks.map((b) => (
                      <th key={b.name} className="text-right py-3 px-4 text-text-muted font-medium">{b.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Total Return', term: 'Total Return' as const, key: 'total_return' as const },
                    { label: 'CAGR', term: 'CAGR' as const, key: 'cagr' as const },
                    { label: 'Volatility', term: 'Volatility' as const, key: 'volatility' as const },
                    { label: 'Sharpe Ratio', term: 'Sharpe Ratio' as const, key: 'sharpe_ratio' as const },
                    { label: 'Sortino Ratio', term: 'Sortino Ratio' as const, key: 'sortino_ratio' as const },
                    { label: 'Max Drawdown', term: 'Max Drawdown' as const, key: 'max_drawdown' as const },
                  ].map(({ label, term, key }) => (
                    <tr key={key} className="border-b border-border-subtle">
                      <td className="py-3 px-4 text-text-secondary">
                        <TermTooltip term={term}>{label}</TermTooltip>
                      </td>
                      <td className="py-3 px-4 text-right text-text-primary font-mono">
                        {key === 'sharpe_ratio' || key === 'sortino_ratio'
                          ? result.metrics[key].toFixed(2)
                          : formatPercent(result.metrics[key])}
                      </td>
                      {result.benchmarks.map((b) => (
                        <td key={b.name} className="py-3 px-4 text-right text-text-secondary font-mono">
                          {key === 'sharpe_ratio' || key === 'sortino_ratio'
                            ? b.metrics[key].toFixed(2)
                            : formatPercent(b.metrics[key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
