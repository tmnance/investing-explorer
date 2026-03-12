import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api } from '@/api/client'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { CHART_COLORS } from '@/lib/utils'
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

export default function BenchmarkComparison() {
  const benchmarks = useQuery({
    queryKey: ['benchmarks'],
    queryFn: () => api.getBenchmarks(),
  })

  const normalizedData = useMemo(() => {
    if (!benchmarks.data?.length) return []
    const ref = benchmarks.data[0]
    return ref.dates.map((date, i) => {
      const point: Record<string, any> = { date }
      benchmarks.data!.forEach((b) => {
        point[b.index_name] = ((b.normalized_values[i] - 1) * 100)
      })
      return point
    })
  }, [benchmarks.data])

  const correlationMatrix = useMemo(() => {
    if (!benchmarks.data || benchmarks.data.length < 2) return null

    const returns = benchmarks.data.map((b) => {
      const r: number[] = []
      for (let i = 1; i < b.normalized_values.length; i++) {
        r.push((b.normalized_values[i] - b.normalized_values[i - 1]) / b.normalized_values[i - 1])
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
  }, [benchmarks.data])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Benchmark Comparison</h1>
        <p className="text-text-secondary mt-1">Compare major market indices side by side</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Normalized Performance (% Change from Start)</CardTitle>
        </CardHeader>
        {normalizedData.length > 0 ? (
          <ResponsiveContainer width="100%" height={450}>
            <LineChart data={normalizedData} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis dataKey="date" stroke="#55556a" tickFormatter={(d) => d.slice(0, 7)} minTickGap={80} />
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
              {benchmarks.data?.map((b, i) => (
                <Line
                  key={b.index_symbol}
                  type="monotone"
                  dataKey={b.index_name}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[450px] flex items-center justify-center text-text-muted">
            {benchmarks.isLoading ? 'Loading benchmark data...' : 'No benchmark data available. Run the index gathering script.'}
          </div>
        )}
      </Card>

      {correlationMatrix && benchmarks.data && (
        <Card>
          <CardHeader>
            <CardTitle>Correlation Matrix</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-text-muted font-medium"></th>
                  {benchmarks.data.map((b) => (
                    <th key={b.index_symbol} className="text-center py-3 px-4 text-text-muted font-medium">
                      {b.index_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {benchmarks.data.map((b, i) => (
                  <tr key={b.index_symbol} className="border-b border-border-subtle">
                    <td className="py-3 px-4 text-text-secondary font-medium">{b.index_name}</td>
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
