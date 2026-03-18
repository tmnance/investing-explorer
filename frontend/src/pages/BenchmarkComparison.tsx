import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { api } from '@/api/client'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { CHART_COLORS } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'
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
} from 'recharts'

const BENCHMARK_STRATEGIES = ['sp500_benchmark', 'dow_benchmark', 'nasdaq_benchmark'] as const

export default function BenchmarkComparison() {
  usePageTitle('Benchmark Comparison')
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null)
  const comparison = useQuery({
    queryKey: ['benchmarkComparison', BENCHMARK_STRATEGIES],
    queryFn: () => api.getStrategyComparison(BENCHMARK_STRATEGIES, 2016, 2025),
  })

  const normalizedData = useMemo(() => {
    const data = comparison.data
    if (!data?.length) return []

    const ref = data[0]
    const n = Math.min(...data.map((d) => d.dates.length))
    return ref.dates.slice(0, n).map((date, i) => {
      const point: Record<string, string | number> = { date }
      data.forEach((s) => {
        const label = s.name.replace(' Benchmark', '')
        point[label] = ((s.cumulative_returns[i] - 1) * 100)
      })
      return point
    })
  }, [comparison.data])

  const correlationMatrix = useMemo(() => {
    const data = comparison.data
    if (!data || data.length < 2) return null

    const returns = data.map((s) => {
      const r: number[] = []
      for (let i = 1; i < s.cumulative_returns.length; i++) {
        r.push((s.cumulative_returns[i] / s.cumulative_returns[i - 1]) - 1)
      }
      return r
    })

    const n = returns.length
    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0))

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1
          continue
        }
        const a = returns[i]
        const b = returns[j]
        const len = Math.min(a.length, b.length)
        if (len === 0) continue
        const meanA = a.slice(0, len).reduce((s, v) => s + v, 0) / len
        const meanB = b.slice(0, len).reduce((s, v) => s + v, 0) / len
        let cov = 0, varA = 0, varB = 0
        for (let k = 0; k < len; k++) {
          const da = a[k] - meanA
          const db = b[k] - meanB
          cov += da * db
          varA += da * da
          varB += db * db
        }
        matrix[i][j] = varA && varB ? cov / Math.sqrt(varA * varB) : 0
      }
    }

    return matrix
  }, [comparison.data])

  const labels = useMemo(
    () => (comparison.data ?? []).map((s) => s.name.replace(' Benchmark', '')),
    [comparison.data]
  )
  const { ticks: xTicks, tickFormatter } = useSmartTimeAxis(normalizedData, { dateKey: 'date' })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Benchmark Comparison</h1>
        <p className="text-text-secondary mt-1">Compare S&P 500, Dow Jones, and Nasdaq side by side</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Normalized Performance (% Change from Start)</CardTitle>
        </CardHeader>
        {normalizedData.length > 0 ? (
          <div>
            <ResponsiveContainer width="100%" height={450}>
              <LineChart data={normalizedData} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                <XAxis
                  dataKey="date"
                  stroke="#55556a"
                  ticks={xTicks.length ? xTicks : undefined}
                  tickFormatter={tickFormatter}
                  minTickGap={30}
                  interval="preserveStartEnd"
                />
                <YAxis stroke="#55556a" tickFormatter={(v) => `${Number(v).toFixed(0)}%`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a25',
                    border: '1px solid #2a2a3a',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#e4e4ef' }}
                  formatter={(v) => [typeof v === 'number' ? `${v.toFixed(2)}%` : String(v)]}
                />
                {labels
                  .slice()
                  .sort((a, b) => {
                    if (!hoveredSeries) return 0
                    if (a === hoveredSeries) return 1
                    if (b === hoveredSeries) return -1
                    return 0
                  })
                  .map((label, i) => {
                    const idx = labels.findIndex((l) => l === label)
                    const color = CHART_COLORS[idx % CHART_COLORS.length]
                    const active = !hoveredSeries || hoveredSeries === label
                    return (
                      <Line
                        key={label}
                        type="monotone"
                        dataKey={label}
                        stroke={color}
                        strokeWidth={hoveredSeries === label ? 3 : 2}
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
                items={labels.map((label, i) => ({
                  name: label,
                  color: CHART_COLORS[i % CHART_COLORS.length],
                  type: 'line' as const,
                }))}
                activeName={hoveredSeries}
                onHover={setHoveredSeries}
              />
            </div>
          </div>
        ) : (
          <div className="h-[450px] flex items-center justify-center text-text-muted">
            {comparison.isLoading ? 'Loading benchmark data...' : 'No benchmark data available. Run the price/index gathering scripts.'}
          </div>
        )}
      </Card>

      {correlationMatrix && labels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Correlation Matrix</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-text-muted font-medium"></th>
                  {labels.map((label) => (
                    <th key={label} className="text-center py-3 px-4 text-text-muted font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {labels.map((label, i) => (
                  <tr key={label} className="border-b border-border-subtle">
                    <td className="py-3 px-4 text-text-secondary font-medium">{label}</td>
                    {correlationMatrix[i].map((corr, j) => {
                      const intensity = Math.abs(corr)
                      const bg =
                        corr > 0.8
                          ? `rgba(34, 197, 94, ${intensity * 0.3})`
                          : corr > 0.5
                            ? `rgba(245, 158, 11, ${intensity * 0.3})`
                            : `rgba(239, 68, 68, ${intensity * 0.3})`
                      return (
                        <td
                          key={j}
                          className="py-3 px-4 text-center text-text-primary font-mono text-xs"
                          style={{ backgroundColor: i === j ? 'transparent' : bg }}
                        >
                          {corr.toFixed(3)}
                        </td>
                      )
                    })}
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
