import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { api } from '@/api/client'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { TermTooltip } from '@/components/ui/TermTooltip'
import { formatPercent, CHART_COLORS } from '@/lib/utils'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts'

function OrderedLegend({ items }: { items: { name: string; color: string; type: 'line' | 'rect' }[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-text-secondary mt-2">
      {items.map((item) => (
        <span key={item.name} className="flex items-center gap-1.5">
          {item.type === 'line' ? (
            <svg width="14" height="3"><line x1="0" y1="1.5" x2="14" y2="1.5" stroke={item.color} strokeWidth={2} /></svg>
          ) : (
            <svg width="10" height="10"><rect width="10" height="10" rx="2" fill={item.color} /></svg>
          )}
          {item.name}
        </span>
      ))}
    </div>
  )
}

const STRATEGY_GROUPS: { title: string; ids: string[] }[] = [
  { title: 'Benchmarks',                         ids: ['sp500_benchmark', 'dow_benchmark', 'nasdaq_benchmark'] },
  { title: 'Top Market Cap – Annually',           ids: ['top5_market_cap', 'top10_market_cap', 'top20_market_cap'] },
  { title: 'Top Market Cap – Quarterly',           ids: ['top5_quarterly', 'top10_quarterly', 'top20_quarterly'] },
  { title: 'Top Market Cap – Continuous (Monthly)', ids: ['top5_monthly', 'top10_monthly', 'top20_monthly'] },
  { title: 'Momentum',                            ids: ['momentum'] },
  { title: 'Other',                               ids: ['buy_and_hold_faang'] },
]

const ORDERED_IDS = STRATEGY_GROUPS.flatMap((g) => g.ids)

export default function StrategyComparison() {
  const [selectedStrategies, setSelectedStrategies] = useState<Set<string>>(new Set())
  const [startYear, setStartYear] = useState(2016)
  const [endYear, setEndYear] = useState(2025)

  const available = useQuery({
    queryKey: ['availableStrategies'],
    queryFn: () => api.getAvailableStrategies(),
  })

  const comparison = useQuery({
    queryKey: ['strategyComparison', Array.from(selectedStrategies).sort(), startYear, endYear],
    queryFn: () => api.getStrategyComparison(Array.from(selectedStrategies), startYear, endYear),
    enabled: selectedStrategies.size > 0 && startYear <= endYear,
  })

  const toggleStrategy = (id: string) => {
    setSelectedStrategies((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const idToName = useMemo(() => {
    const map = new Map<string, string>()
    available.data?.forEach((s) => map.set(s.id, s.name))
    return map
  }, [available.data])

  const orderedResults = useMemo(() => {
    if (!comparison.data?.length) return []
    const byName = new Map(comparison.data.map((s) => [s.name, s]))
    return ORDERED_IDS
      .map((id) => byName.get(idToName.get(id) ?? ''))
      .filter((s): s is NonNullable<typeof s> => s != null)
  }, [comparison.data, idToName])

  const cumulativeData = useMemo(() => {
    if (!orderedResults.length) return []
    const ref = orderedResults[0]
    return ref.dates.map((date, i) => {
      const point: Record<string, any> = { date }
      for (const s of orderedResults) {
        point[s.name] = (s.cumulative_returns[i] - 1) * 100
      }
      return point
    })
  }, [orderedResults])

  const annualReturnData = useMemo(() => {
    if (!orderedResults.length) return []
    const allYears = new Set<string>()
    orderedResults.forEach((s) => Object.keys(s.annual_returns).forEach((y) => allYears.add(y)))
    return Array.from(allYears).sort().map((year) => {
      const point: Record<string, any> = { year }
      for (const s of orderedResults) {
        point[s.name] = s.annual_returns[year] ? s.annual_returns[year] * 100 : 0
      }
      return point
    })
  }, [orderedResults])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Strategy Comparison</h1>
        <p className="text-text-secondary mt-1">Compare investment strategies against benchmarks</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle>Select Strategies</CardTitle>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="uppercase tracking-wide text-text-muted mr-1">Time window</span>
            <select
              value={startYear}
              onChange={(e) => setStartYear(Number(e.target.value))}
              className="bg-surface-elevated border border-border rounded-lg px-2 py-1 text-xs text-text-primary"
            >
              {Array.from({ length: 2025 - 2016 + 1 }, (_, i) => 2016 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <span>to</span>
            <select
              value={endYear}
              onChange={(e) => setEndYear(Number(e.target.value))}
              className="bg-surface-elevated border border-border rounded-lg px-2 py-1 text-xs text-text-primary"
            >
              {Array.from({ length: 2025 - 2016 + 1 }, (_, i) => 2016 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <div className="space-y-4">
          {available.isLoading ? (
            <p className="text-text-muted text-sm px-4 pb-4">Loading strategies...</p>
          ) : available.data?.length ? (
            STRATEGY_GROUPS.map((group) => {
              const items = group.ids
                .map((id) => available.data!.find((s) => s.id === id))
                .filter((s): s is NonNullable<typeof s> => s != null)
              if (!items.length) return null
              return (
                <div key={group.title}>
                  <p className="text-xs uppercase tracking-wide text-text-muted mb-1 px-4">{group.title}</p>
                  <div className="flex flex-wrap gap-2 px-4 pb-1">
                    {items.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => toggleStrategy(s.id)}
                        className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                          selectedStrategies.has(s.id)
                            ? 'bg-accent text-white'
                            : 'bg-surface-elevated border border-border text-text-secondary hover:text-text-primary'
                        }`}
                        title={s.description}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })
          ) : (
            <p className="text-text-muted text-sm px-4 pb-4">
              No strategies available. Ensure price data has been imported and the analytics engine is configured.
            </p>
          )}
        </div>
      </Card>

      {orderedResults.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Cumulative Returns (%)</CardTitle>
            </CardHeader>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={cumulativeData} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
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
                  formatter={(value) =>
                    typeof value === 'number' ? [`${value.toFixed(2)}%`] : ['']
                  }
                  itemSorter={(item) => {
                    const idx = orderedResults.findIndex((s) => s.name === item.dataKey)
                    return idx === -1 ? 999 : idx
                  }}
                />
                {orderedResults.map((s, i) => (
                  <Line
                    key={s.name}
                    type="monotone"
                    dataKey={s.name}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <OrderedLegend items={orderedResults.map((s, i) => ({
              name: s.name, color: CHART_COLORS[i % CHART_COLORS.length], type: 'line',
            }))} />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Annual Returns (%)</CardTitle>
            </CardHeader>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={annualReturnData} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                <XAxis dataKey="year" stroke="#55556a" />
                <YAxis stroke="#55556a" tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a25',
                    border: '1px solid #2a2a3a',
                    borderRadius: '8px',
                  }}
                  formatter={(value) =>
                    typeof value === 'number' ? [`${value.toFixed(2)}%`] : ['']
                  }
                  itemSorter={(item) => {
                    const idx = orderedResults.findIndex((s) => s.name === item.dataKey)
                    return idx === -1 ? 999 : idx
                  }}
                />
                {orderedResults.map((s, i) => (
                  <Bar
                    key={s.name}
                    dataKey={s.name}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <OrderedLegend items={orderedResults.map((s, i) => ({
              name: s.name, color: CHART_COLORS[i % CHART_COLORS.length], type: 'rect',
            }))} />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Risk & Return Metrics</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-text-muted font-medium">Strategy</th>
                    <th className="text-right py-3 px-4 text-text-muted font-medium">
                      <TermTooltip term="Total Return">Total Return</TermTooltip>
                    </th>
                    <th className="text-right py-3 px-4 text-text-muted font-medium">
                      <TermTooltip term="CAGR">CAGR</TermTooltip>
                    </th>
                    <th className="text-right py-3 px-4 text-text-muted font-medium">
                      <TermTooltip term="Volatility">Volatility</TermTooltip>
                    </th>
                    <th className="text-right py-3 px-4 text-text-muted font-medium">
                      <TermTooltip term="Sharpe Ratio">Sharpe</TermTooltip>
                    </th>
                    <th className="text-right py-3 px-4 text-text-muted font-medium">
                      <TermTooltip term="Sortino Ratio">Sortino</TermTooltip>
                    </th>
                    <th className="text-right py-3 px-4 text-text-muted font-medium">
                      <TermTooltip term="Calmar Ratio">Calmar</TermTooltip>
                    </th>
                    <th className="text-right py-3 px-4 text-text-muted font-medium">
                      <TermTooltip term="Max DD">Max DD</TermTooltip>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orderedResults.map((s) => (
                    <tr key={s.name} className="border-b border-border-subtle">
                      <td className="py-3 px-4 text-text-primary font-medium">{s.name}</td>
                      <td className="py-3 px-4 text-right text-text-primary">{formatPercent(s.metrics.total_return)}</td>
                      <td className="py-3 px-4 text-right text-text-primary">{formatPercent(s.metrics.cagr)}</td>
                      <td className="py-3 px-4 text-right text-text-secondary">{formatPercent(s.metrics.volatility)}</td>
                      <td className="py-3 px-4 text-right text-text-primary">{s.metrics.sharpe_ratio.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-text-primary">{s.metrics.sortino_ratio.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-text-primary">{s.metrics.calmar_ratio.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-red">{formatPercent(s.metrics.max_drawdown)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <TermTooltip term="Tax Impact">Tax Impact</TermTooltip> & Additional Insights
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-text-muted font-medium">Strategy</th>
                    <th className="text-right py-3 px-4 text-text-muted font-medium">
                      <TermTooltip term="CAGR">CAGR</TermTooltip>
                    </th>
                    <th className="text-right py-3 px-4 text-text-muted font-medium">
                      <TermTooltip term="After-Tax CAGR">After-Tax CAGR</TermTooltip>
                    </th>
                    <th className="text-right py-3 px-4 text-text-muted font-medium">
                      <TermTooltip term="Tax Drag">Tax Drag</TermTooltip>
                    </th>
                    <th className="text-right py-3 px-4 text-text-muted font-medium">
                      <TermTooltip term="Turnover">Turnover</TermTooltip>
                    </th>
                    <th className="text-right py-3 px-4 text-text-muted font-medium">
                      <TermTooltip term="Win Rate">Win Rate</TermTooltip>
                    </th>
                    <th className="text-right py-3 px-4 text-text-muted font-medium">
                      <TermTooltip term="Best Year">Best Year</TermTooltip>
                    </th>
                    <th className="text-right py-3 px-4 text-text-muted font-medium">
                      <TermTooltip term="Worst Year">Worst Year</TermTooltip>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orderedResults.map((s) => (
                    <tr key={s.name} className="border-b border-border-subtle">
                      <td className="py-3 px-4 text-text-primary font-medium">{s.name}</td>
                      <td className="py-3 px-4 text-right text-text-primary">{formatPercent(s.metrics.cagr)}</td>
                      <td className="py-3 px-4 text-right text-text-primary">{formatPercent(s.metrics.after_tax_cagr)}</td>
                      <td className="py-3 px-4 text-right text-text-secondary">
                        {s.metrics.tax_drag > 0 ? `-${(s.metrics.tax_drag * 100).toFixed(2)}%` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right text-text-secondary">
                        {s.metrics.turnover > 0 ? `${(s.metrics.turnover * 100).toFixed(0)}%` : 'None'}
                      </td>
                      <td className="py-3 px-4 text-right text-text-primary">
                        {(s.metrics.win_rate * 100).toFixed(0)}%
                      </td>
                      <td className="py-3 px-4 text-right text-green">{formatPercent(s.metrics.best_year)}</td>
                      <td className="py-3 px-4 text-right text-red">{formatPercent(s.metrics.worst_year)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-text-muted px-4 pb-3 pt-1">
              Tax estimates assume U.S. federal rates: 37% short-term (≤1 yr) and 20% long-term capital gains. State taxes not included.
              Turnover reflects the fraction of the portfolio replaced per year through rebalancing.
            </p>
          </Card>
        </>
      )}

      {selectedStrategies.size > 0 && comparison.isLoading && (
        <div className="flex items-center justify-center py-20 text-text-muted">
          Calculating strategy returns...
        </div>
      )}
    </div>
  )
}
