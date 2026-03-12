import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { MetricCard } from '@/components/ui/MetricCard'
import { formatMarketCap } from '@/lib/utils'
import {
  Treemap,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { CHART_COLORS } from '@/lib/utils'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react'

function TreemapContent(props: any) {
  const { x, y, width, height, name, value } = props
  if (width < 40 || height < 30) return null
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4}
        fill={CHART_COLORS[props.index % CHART_COLORS.length]}
        fillOpacity={0.85} stroke="#1a1a25" strokeWidth={2} />
      <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle"
        fill="#fff" fontSize={width < 70 ? 10 : 12} fontWeight={600}>
        {name}
      </text>
      {width > 60 && height > 45 && (
        <text x={x + width / 2} y={y + height / 2 + 12} textAnchor="middle"
          fill="rgba(255,255,255,0.7)" fontSize={10}>
          {formatMarketCap(value)}
        </text>
      )}
    </g>
  )
}

export default function Dashboard() {
  const rankings = useQuery({
    queryKey: ['rankings', { year: '2025' }],
    queryFn: () => api.getMarketCapRankings({ year: '2025' }),
  })

  const movers = useQuery({
    queryKey: ['topMovers'],
    queryFn: () => api.getTopMovers(),
  })

  const benchmarkLatest = useQuery({
    queryKey: ['benchmarkLatest'],
    queryFn: () => api.getBenchmarkLatest(),
  })

  const treemapData = rankings.data?.results?.map((r) => ({
    name: r.ticker,
    value: r.market_cap,
    company: r.company_name,
  })) ?? []

  const benchmarks = benchmarkLatest.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary mt-1">Market overview and key metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {benchmarks.length > 0 ? (
          benchmarks.slice(0, 3).map((b) => (
            <MetricCard
              key={b.index_symbol}
              label={b.index_name}
              value={b.close.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              change="Latest close"
              changeType="neutral"
            />
          ))
        ) : (
          <>
            <MetricCard label="S&P 500" value="--" change="No data yet" />
            <MetricCard label="Dow Jones" value="--" change="No data yet" />
            <MetricCard label="Nasdaq" value="--" change="No data yet" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top 20 by Market Cap (2025)</CardTitle>
          </CardHeader>
          {treemapData.length > 0 ? (
            <ResponsiveContainer width="100%" height={380}>
              <Treemap
                data={treemapData}
                dataKey="value"
                aspectRatio={4 / 3}
                content={<TreemapContent />}
              >
                <Tooltip
                  content={({ payload }) => {
                    if (!payload?.[0]) return null
                    const d = payload[0].payload
                    return (
                      <div className="bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm shadow-lg">
                        <p className="font-semibold text-text-primary">{d.company}</p>
                        <p className="text-text-secondary">{d.name} &middot; {formatMarketCap(d.value)}</p>
                      </div>
                    )
                  }}
                />
              </Treemap>
            </ResponsiveContainer>
          ) : (
            <div className="h-[380px] flex items-center justify-center text-text-muted">
              {rankings.isLoading ? 'Loading...' : 'No ranking data available. Run the import script.'}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Biggest Movers (YoY)</CardTitle>
          </CardHeader>
          {movers.data ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-text-muted mb-2 uppercase tracking-wider">Gained Rank</p>
                {movers.data.gainers.slice(0, 4).map((g) => (
                  <Link
                    key={g.ticker}
                    to={`/stocks/${g.ticker}`}
                    className="flex items-center justify-between py-1.5 no-underline group"
                  >
                    <span className="text-sm text-text-primary group-hover:text-accent transition-colors">
                      {g.ticker}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-green">
                      <ArrowUpRight className="w-3 h-3" />
                      #{g.rank}
                    </span>
                  </Link>
                ))}
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs text-text-muted mb-2 uppercase tracking-wider">Lost Rank</p>
                {movers.data.losers.slice(0, 4).map((l) => (
                  <Link
                    key={l.ticker}
                    to={`/stocks/${l.ticker}`}
                    className="flex items-center justify-between py-1.5 no-underline group"
                  >
                    <span className="text-sm text-text-primary group-hover:text-accent transition-colors">
                      {l.ticker}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-red">
                      <ArrowDownRight className="w-3 h-3" />
                      #{l.rank}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-text-muted">
              {movers.isLoading ? 'Loading...' : 'No mover data yet'}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { to: '/market-cap', label: 'Market Cap Explorer', icon: TrendingUp },
          { to: '/strategies', label: 'Strategy Comparison', icon: TrendingUp },
          { to: '/benchmarks', label: 'Benchmark Analysis', icon: TrendingUp },
          { to: '/simulator', label: 'Portfolio Simulator', icon: TrendingUp },
        ].map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary hover:bg-surface-elevated hover:text-accent transition-colors no-underline"
          >
            {label}
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        ))}
      </div>
    </div>
  )
}
