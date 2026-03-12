import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api, type StrategyResult } from '@/api/client'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatPercent, CHART_COLORS } from '@/lib/utils'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
} from 'recharts'

export default function StrategyComparison() {
  const [selectedStrategies, setSelectedStrategies] = useState<Set<string>>(new Set())

  const available = useQuery({
    queryKey: ['availableStrategies'],
    queryFn: () => api.getAvailableStrategies(),
  })

  const comparison = useQuery({
    queryKey: ['strategyComparison', Array.from(selectedStrategies).sort()],
    queryFn: () => api.getStrategyComparison(Array.from(selectedStrategies)),
    enabled: selectedStrategies.size > 0,
  })

  const toggleStrategy = (id: string) => {
    setSelectedStrategies((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const cumulativeData = (() => {
    if (!comparison.data?.length) return []
    const ref = comparison.data[0]
    return ref.dates.map((date, i) => {
      const point: Record<string, any> = { date }
      comparison.data!.forEach((s) => {
        point[s.name] = ((s.cumulative_returns[i] - 1) * 100)
      })
      return point
    })
  })()

  const annualReturnData = (() => {
    if (!comparison.data?.length) return []
    const allYears = new Set<string>()
    comparison.data.forEach((s) => Object.keys(s.annual_returns).forEach((y) => allYears.add(y)))
    return Array.from(allYears).sort().map((year) => {
      const point: Record<string, any> = { year }
      comparison.data!.forEach((s) => {
        point[s.name] = s.annual_returns[year] ? (s.annual_returns[year] * 100) : 0
      })
      return point
    })
  })()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Strategy Comparison</h1>
        <p className="text-text-secondary mt-1">Compare investment strategies against benchmarks</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Strategies</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          {available.isLoading ? (
            <p className="text-text-muted text-sm">Loading strategies...</p>
          ) : available.data?.length ? (
            available.data.map((s) => (
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
            ))
          ) : (
            <p className="text-text-muted text-sm">
              No strategies available. Ensure price data has been imported and the analytics engine is configured.
            </p>
          )}
        </div>
      </Card>

      {comparison.data && comparison.data.length > 0 && (
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
                  formatter={(v: number) => [`${v.toFixed(2)}%`]}
                />
                <Legend />
                {comparison.data.map((s, i) => (
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
                  formatter={(v: number) => [`${v.toFixed(2)}%`]}
                />
                <Legend />
                {comparison.data.map((s, i) => (
                  <Bar
                    key={s.name}
                    dataKey={s.name}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
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
                    <th className="text-right py-3 px-4 text-text-muted font-medium">Total Return</th>
                    <th className="text-right py-3 px-4 text-text-muted font-medium">CAGR</th>
                    <th className="text-right py-3 px-4 text-text-muted font-medium">Volatility</th>
                    <th className="text-right py-3 px-4 text-text-muted font-medium">Sharpe</th>
                    <th className="text-right py-3 px-4 text-text-muted font-medium">Sortino</th>
                    <th className="text-right py-3 px-4 text-text-muted font-medium">Max DD</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.data.map((s) => (
                    <tr key={s.name} className="border-b border-border-subtle">
                      <td className="py-3 px-4 text-text-primary font-medium">{s.name}</td>
                      <td className="py-3 px-4 text-right text-text-primary">{formatPercent(s.metrics.total_return)}</td>
                      <td className="py-3 px-4 text-right text-text-primary">{formatPercent(s.metrics.cagr)}</td>
                      <td className="py-3 px-4 text-right text-text-secondary">{formatPercent(s.metrics.volatility)}</td>
                      <td className="py-3 px-4 text-right text-text-primary">{s.metrics.sharpe_ratio.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-text-primary">{s.metrics.sortino_ratio.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-red">{formatPercent(s.metrics.max_drawdown)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
