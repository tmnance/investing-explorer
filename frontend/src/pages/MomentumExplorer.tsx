import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { api, type MomentumEvent, type MomentumMatrixCell } from '@/api/client'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { TermTooltip } from '@/components/ui/TermTooltip'
import { formatPercent, CHART_COLORS } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useSmartTimeAxis } from '@/hooks/useSmartTimeAxis'
import { Link } from 'react-router-dom'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'

const YEAR_OPTIONS = Array.from({ length: 2025 - 2017 + 1 }, (_, i) => 2017 + i)
const N_OPTIONS = [3, 5, 7, 10, 15, 20]

function CagrHeatmap({ cells, years }: { cells: MomentumMatrixCell[]; years: number[] }) {
  const lookup = useMemo(() => {
    const map = new Map<string, MomentumMatrixCell>()
    cells.forEach((c) => map.set(`${c.start}-${c.end}`, c))
    return map
  }, [cells])

  const allCagr = cells.map((c) => c.cagr).filter((v) => v !== 0)
  const minCagr = Math.min(...allCagr, 0)
  const maxCagr = Math.max(...allCagr, 0)

  function cellColor(cagr: number) {
    if (cagr > 0) {
      const t = Math.min(cagr / Math.max(maxCagr, 0.01), 1)
      const g = Math.round(80 + t * 140)
      return `rgb(30, ${g}, 60)`
    }
    const t = Math.min(Math.abs(cagr) / Math.max(Math.abs(minCagr), 0.01), 1)
    const r = Math.round(80 + t * 140)
    return `rgb(${r}, 30, 40)`
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="px-1 py-1 text-text-muted font-medium text-left">Start \ End</th>
            {years.map((y) => (
              <th key={y} className="px-1 py-1 text-text-muted font-medium text-center w-14">{y}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((sy) => (
            <tr key={sy}>
              <td className="px-1 py-1 text-text-muted font-medium">{sy}</td>
              {years.map((ey) => {
                if (ey < sy) return <td key={ey} className="px-1 py-1" />
                const cell = lookup.get(`${sy}-${ey}`)
                const cagr = cell?.cagr ?? 0
                return (
                  <td
                    key={ey}
                    className="px-1 py-1 text-center rounded-sm cursor-default"
                    style={{ backgroundColor: cellColor(cagr) }}
                    title={`${sy}–${ey}: CAGR ${(cagr * 100).toFixed(1)}%, Total ${((cell?.total_return ?? 0) * 100).toFixed(1)}%`}
                  >
                    <span className="text-white font-medium">
                      {(cagr * 100).toFixed(1)}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EventTimeline({ events }: { events: MomentumEvent[] }) {
  const [expanded, setExpanded] = useState<number | null>(null)

  return (
    <div className="space-y-2">
      {events.map((ev) => {
        const isOpen = expanded === ev.year
        const retColor = ev.year_return >= 0 ? 'text-green' : 'text-red'
        return (
          <div key={ev.year} className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : ev.year)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm bg-surface hover:bg-surface-elevated transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className="font-semibold text-text-primary">{ev.year}</span>
                <span className="text-text-secondary">
                  {ev.holdings.map((h) => h.ticker).join(', ')}
                </span>
              </div>
              <div className="flex items-center gap-4">
                {ev.buys.length > 0 && (
                  <span className="text-green text-xs">+{ev.buys.join(', ')}</span>
                )}
                {ev.sells.length > 0 && (
                  <span className="text-red text-xs">−{ev.sells.join(', ')}</span>
                )}
                <span className={`font-semibold ${retColor}`}>
                  {formatPercent(ev.year_return)}
                </span>
                <svg
                  className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            {isOpen && (
              <div className="px-4 pb-3 bg-surface-elevated">
                <table className="w-full text-sm mt-2">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 text-text-muted font-medium">Ticker</th>
                      <th className="text-right py-1.5 text-text-muted font-medium">Prev Rank</th>
                      <th className="text-right py-1.5 text-text-muted font-medium">{ev.year} Rank</th>
                      <th className="text-right py-1.5 text-text-muted font-medium">Rank Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ev.holdings.map((h) => (
                      <tr key={h.ticker} className="border-b border-border-subtle">
                        <td className="py-1.5">
                          <Link to={`/stocks/${h.ticker}`} className="text-accent hover:underline font-medium">
                            {h.ticker}
                          </Link>
                          {ev.buys.includes(h.ticker) && (
                            <span className="ml-2 text-xs text-green bg-green/10 px-1.5 py-0.5 rounded">BUY</span>
                          )}
                        </td>
                        <td className="py-1.5 text-right text-text-secondary">#{h.prev_rank}</td>
                        <td className="py-1.5 text-right text-text-secondary">#{h.curr_rank}</td>
                        <td className="py-1.5 text-right text-green font-medium">+{h.rank_change}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {ev.sells.length > 0 && (
                  <div className="mt-2 text-xs text-text-muted">
                    Sold: {ev.sells.map((t) => (
                      <Link key={t} to={`/stocks/${t}`} className="text-red hover:underline mr-2">{t}</Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function MomentumExplorer() {
  usePageTitle('Momentum Explorer')
  const [topN, setTopN] = useState(5)
  const [startYear, setStartYear] = useState(2017)
  const [endYear, setEndYear] = useState(2025)

  const detail = useQuery({
    queryKey: ['momentumDetail', topN, startYear, endYear],
    queryFn: () => api.getMomentumDetail({ top_n: topN, start_year: startYear, end_year: endYear }),
    enabled: startYear <= endYear,
  })

  const matrix = useQuery({
    queryKey: ['momentumMatrix', topN],
    queryFn: () => api.getMomentumMatrix({ top_n: topN }),
  })

  const chartData = useMemo(() => {
    if (!detail.data?.dates.length) return []
    return detail.data.dates.map((d, i) => ({
      date: d,
      value: (detail.data!.cumulative_returns[i] - 1) * 100,
    }))
  }, [detail.data])
  const { ticks: xTicks, tickFormatter: tickFormatter } = useSmartTimeAxis(chartData, { dateKey: 'date' })

  const matrixYears = useMemo(() => {
    if (!matrix.data?.length) return []
    const yrs = new Set<number>()
    matrix.data.forEach((c) => { yrs.add(c.start); yrs.add(c.end) })
    return Array.from(yrs).sort()
  }, [matrix.data])

  const uniqueHoldings = useMemo(() => {
    if (!detail.data?.events.length) return new Set<string>()
    const tickers = new Set<string>()
    detail.data.events.forEach((e) => e.holdings.forEach((h) => tickers.add(h.ticker)))
    return tickers
  }, [detail.data])

  const totalTrades = useMemo(() => {
    if (!detail.data?.events.length) return 0
    return detail.data.events.reduce((sum, e) => sum + e.buys.length + e.sells.length, 0)
  }, [detail.data])

  const avgTurnover = useMemo(() => {
    if (!detail.data?.events.length) return 0
    const totalBuys = detail.data.events.reduce((sum, e) => sum + e.buys.length, 0)
    return totalBuys / detail.data.events.length / topN
  }, [detail.data, topN])

  const m = detail.data?.metrics

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-text-muted mb-1">
          <Link to="/strategies" className="hover:text-text-primary transition-colors">Strategies</Link>
          <span>/</span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Momentum Strategy Explorer</h1>
        <p className="text-text-secondary mt-1">
          Deep-dive into the momentum (rank gainers) strategy with variable parameters
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Parameters</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap items-center gap-4 px-4 pb-4">
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <TermTooltip term="Momentum Top N">Top N</TermTooltip>
            <select
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
              className="bg-surface-elevated border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary"
            >
              {N_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} companies</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            Start
            <select
              value={startYear}
              onChange={(e) => setStartYear(Number(e.target.value))}
              className="bg-surface-elevated border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            End
            <select
              value={endYear}
              onChange={(e) => setEndYear(Number(e.target.value))}
              className="bg-surface-elevated border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {detail.isLoading && (
        <div className="flex items-center justify-center py-16 text-text-muted">Running momentum strategy...</div>
      )}

      {detail.data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <MiniMetric label="Total Return" value={m ? formatPercent(m.total_return) : '—'} />
            <MiniMetric label="CAGR" value={m ? formatPercent(m.cagr) : '—'} />
            <MiniMetric label="After-Tax CAGR" value={m ? formatPercent(m.after_tax_cagr) : '—'} />
            <MiniMetric label="Volatility" value={m ? formatPercent(m.volatility) : '—'} />
            <MiniMetric label="Max Drawdown" value={m ? formatPercent(m.max_drawdown) : '—'} negative />
            <MiniMetric label="Sharpe" value={m ? m.sharpe_ratio.toFixed(2) : '—'} />
            <MiniMetric label="Unique Holdings" value={String(uniqueHoldings.size)} />
            <MiniMetric label="Total Trades" value={String(totalTrades)} />
            <MiniMetric label="Avg Turnover" value={`${(avgTurnover * 100).toFixed(0)}%`} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cumulative Returns</CardTitle>
            </CardHeader>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                <XAxis
                  dataKey="date"
                  stroke="#55556a"
                  ticks={xTicks.length ? xTicks : undefined}
                  tickFormatter={tickFormatter}
                  minTickGap={30}
                  interval="preserveStartEnd"
                />
                <YAxis stroke="#55556a" tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a25', border: '1px solid #2a2a3a', borderRadius: '8px' }}
                  labelStyle={{ color: '#e4e4ef' }}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, 'Return']}
                />
                {detail.data.events.map((ev) => (
                  <ReferenceLine
                    key={ev.year}
                    x={`${ev.year}-01-02`}
                    stroke="#55556a"
                    strokeDasharray="4 4"
                    label={{ value: String(ev.year), position: 'top', fill: '#55556a', fontSize: 10 }}
                  />
                ))}
                <Line type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Annual Rebalance Events</CardTitle>
            </CardHeader>
            <div className="px-4 pb-4">
              <EventTimeline events={detail.data.events} />
            </div>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            <TermTooltip term="CAGR">CAGR</TermTooltip> Matrix — All Start/End Year Permutations
          </CardTitle>
        </CardHeader>
        <div className="px-4 pb-4">
          {matrix.isLoading ? (
            <div className="text-text-muted text-sm py-8 text-center">Computing all permutations...</div>
          ) : matrix.data && matrixYears.length > 0 ? (
            <>
              <CagrHeatmap cells={matrix.data} years={matrixYears} />
              <p className="text-xs text-text-muted mt-3">
                Each cell shows the CAGR (%) for a momentum strategy starting in the row year and ending in the column year.
                Hover for total return. Green = positive, red = negative.
              </p>
            </>
          ) : (
            <div className="text-text-muted text-sm py-8 text-center">No data available</div>
          )}
        </div>
      </Card>
    </div>
  )
}

function MiniMetric({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2.5">
      <div className="text-xs text-text-muted mb-0.5">{label}</div>
      <div className={`text-sm font-semibold ${negative ? 'text-red' : 'text-text-primary'}`}>{value}</div>
    </div>
  )
}
