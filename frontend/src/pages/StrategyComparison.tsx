import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { api } from '@/api/client'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { TermTooltip } from '@/components/ui/TermTooltip'
import { formatPercent, CHART_COLORS } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Link } from 'react-router-dom'
import { useSmartTimeAxis } from '@/hooks/useSmartTimeAxis'
import { OrderedLegend } from '@/components/charts/OrderedLegend'
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

const STRATEGY_GROUPS: { title: string; ids: string[] }[] = [
  { title: 'Benchmarks',                         ids: ['sp500_benchmark', 'dow_benchmark', 'nasdaq_benchmark'] },
  { title: 'Top Market Cap – Annually',           ids: ['top5_market_cap', 'top10_market_cap', 'top20_market_cap'] },
  { title: 'Top Market Cap – Quarterly',           ids: ['top5_quarterly', 'top10_quarterly', 'top20_quarterly'] },
  { title: 'Top Market Cap – Continuous (Monthly)', ids: ['top5_monthly', 'top10_monthly', 'top20_monthly'] },
  { title: 'Momentum',                            ids: ['momentum'] },
  { title: 'Other',                               ids: ['buy_and_hold_faang'] },
]

const ORDERED_IDS = STRATEGY_GROUPS.flatMap((g) => g.ids)
const FIRST_YEAR = 2017
const LAST_YEAR = (new Date()).getFullYear() // current calendar year

export default function StrategyComparison() {
  usePageTitle('Strategy Comparison')
  const [selectedStrategies, setSelectedStrategies] = useState<Set<string>>(new Set())
  const [startYear, setStartYear] = useState(FIRST_YEAR)
  const [endYear, setEndYear] = useState(LAST_YEAR)
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null)
  const [hoveredAnnualSeries, setHoveredAnnualSeries] = useState<string | null>(null)

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

    const lookups = orderedResults.map((s) => {
      const map = new Map<string, number>()
      s.dates.forEach((d, i) => map.set(d, (s.cumulative_returns[i] - 1) * 100))
      return { name: s.name, map }
    })

    const allDates = new Set<string>()
    orderedResults.forEach((s) => s.dates.forEach((d) => allDates.add(d)))
    const sorted = Array.from(allDates).sort()

    const last: Record<string, number | undefined> = {}
    return sorted.map((d) => {
      const point: Record<string, any> = { date: d }
      for (const { name, map } of lookups) {
        const val = map.get(d)
        if (val !== undefined) last[name] = val
        if (last[name] !== undefined) point[name] = last[name]
      }
      return point
    })
  }, [orderedResults])
  const { ticks: cumulativeXAxisTicks, tickFormatter: cumulativeTickFormatter } =
    useSmartTimeAxis(cumulativeData, { dateKey: 'date' })

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
        <p className="text-text-secondary mt-1">
          Compare investment strategies against benchmarks ·{' '}
          <Link to="/strategies/momentum" className="text-accent hover:underline">
            Explore Momentum strategy in depth →
          </Link>
        </p>
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
              {Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <span>to</span>
            <select
              value={endYear}
              onChange={(e) => setEndYear(Number(e.target.value))}
              className="bg-surface-elevated border border-border rounded-lg px-2 py-1 text-xs text-text-primary"
            >
              {Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i).map((y) => (
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
                <XAxis
                  dataKey="date"
                  stroke="#55556a"
                  ticks={cumulativeXAxisTicks.length ? cumulativeXAxisTicks : undefined}
                  tickFormatter={cumulativeTickFormatter}
                  minTickGap={30}
                  interval="preserveStartEnd"
                />
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
                {orderedResults
                  .slice()
                  .sort((a, b) => {
                    if (!hoveredSeries) return 0
                    if (a.name === hoveredSeries) return 1
                    if (b.name === hoveredSeries) return -1
                    return 0
                  })
                  .map((s) => {
                    const idx = orderedResults.findIndex((x) => x.name === s.name)
                    const color = CHART_COLORS[idx % CHART_COLORS.length]
                    const active = !hoveredSeries || hoveredSeries === s.name
                    return (
                      <Line
                        key={s.name}
                        type="monotone"
                        dataKey={s.name}
                        stroke={color}
                        strokeWidth={hoveredSeries === s.name ? 3 : 2}
                        opacity={active ? 1 : 0.18}
                        dot={false}
                        isAnimationActive={false}
                      />
                    )
                  })}
              </LineChart>
            </ResponsiveContainer>
            <div onMouseLeave={() => setHoveredSeries(null)}>
              <OrderedLegend
                items={orderedResults.map((s, i) => ({
                  name: s.name, color: CHART_COLORS[i % CHART_COLORS.length], type: 'line',
                }))}
                activeName={hoveredSeries}
                onHover={setHoveredSeries}
              />
            </div>
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
                    opacity={!hoveredAnnualSeries || hoveredAnnualSeries === s.name ? 1 : 0.18}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <div onMouseLeave={() => setHoveredAnnualSeries(null)}>
              <OrderedLegend
                items={orderedResults.map((s, i) => ({
                  name: s.name, color: CHART_COLORS[i % CHART_COLORS.length], type: 'rect',
                }))}
                activeName={hoveredAnnualSeries}
                onHover={setHoveredAnnualSeries}
              />
            </div>
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
