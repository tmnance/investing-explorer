import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { MetricCard } from '@/components/ui/MetricCard'
import { TermTooltip } from '@/components/ui/TermTooltip'
import { formatMarketCap } from '@/lib/utils'
import {
  Treemap,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { CHART_COLORS } from '@/lib/utils'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ArrowDownRight, TrendingUp, RefreshCw } from 'lucide-react'

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

const CURRENT_YEAR = String(new Date().getFullYear())

export default function Dashboard() {
  const rankings = useQuery({
    queryKey: ['rankings', { year: CURRENT_YEAR }],
    queryFn: () => api.getMarketCapRankings({ year: CURRENT_YEAR }),
  })

  const movers = useQuery({
    queryKey: ['topMovers'],
    queryFn: () => api.getTopMovers(),
  })

  const benchmarkLatest = useQuery({
    queryKey: ['benchmarkLatest'],
    queryFn: () => api.getBenchmarkLatest(),
  })

  const syncStatus = useQuery({
    queryKey: ['syncStatus'],
    queryFn: () => api.getSyncStatus(),
  })

  const queryClient = useQueryClient()
  const syncMutation = useMutation({
    mutationFn: () => api.syncData(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['benchmarkLatest'] })
      queryClient.invalidateQueries({ queryKey: ['syncStatus'] })
      queryClient.invalidateQueries({ queryKey: ['prices'] })
      queryClient.invalidateQueries({ queryKey: ['benchmarks'] })
    },
  })

  const treemapData = rankings.data?.results?.map((r) => ({
    name: r.ticker,
    value: r.market_cap,
    company: r.company_name,
  })) ?? []

  const benchmarks = (benchmarkLatest.data ?? []).filter(
    (b) => ['^GSPC', '^DJI', '^IXIC'].includes(b.index_symbol)
  )
  const orderedBenchmarks = ['^GSPC', '^DJI', '^IXIC']
    .map((sym) => benchmarks.find((b) => b.index_symbol === sym))
    .filter((b): b is NonNullable<typeof b> => b != null)

  const formatCloseDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const latestDate = syncStatus.data?.indices_latest ?? syncStatus.data?.prices_latest

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-text-secondary mt-1">
            Market overview and key metrics
            {latestDate && (
              <span className="ml-2 text-text-muted">· Data through {formatCloseDate(latestDate)}</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-surface border border-border text-text-secondary hover:bg-surface-elevated hover:text-text-primary disabled:opacity-50 transition-colors"
          title="Fetch latest price and index data from the day after our last records"
        >
          <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          {syncMutation.isPending ? 'Syncing...' : 'Sync latest data'}
        </button>
      </div>
      {syncMutation.isSuccess && (
        <div className="text-sm text-green">
          Synced {syncMutation.data?.price_records ?? 0} price records, {syncMutation.data?.index_records ?? 0} index records.
          {syncMutation.data?.errors?.length ? ` (${syncMutation.data.errors.length} errors)` : ''}
        </div>
      )}
      {syncMutation.isError && (
        <div className="text-sm text-red">{String(syncMutation.error)}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {orderedBenchmarks.length > 0 ? (
          orderedBenchmarks.map((b) => (
            <MetricCard
              key={b.index_symbol}
              label={b.index_name}
              value={b.close.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              change={`Latest close (${formatCloseDate(b.date)})`}
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
            <CardTitle>Top 20 by <TermTooltip term="Market Cap">Market Cap</TermTooltip> ({CURRENT_YEAR})</CardTitle>
          </CardHeader>
          {treemapData.length > 0 ? (
            <ResponsiveContainer width="100%" height={380}>
              <Treemap
                data={treemapData}
                dataKey="value"
                aspectRatio={4 / 3}
                isAnimationActive={false}
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
                <p className="text-xs text-text-muted mb-2 uppercase tracking-wider">Gained <TermTooltip term="Rank">Rank</TermTooltip></p>
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
                <p className="text-xs text-text-muted mb-2 uppercase tracking-wider">Lost <TermTooltip term="Rank">Rank</TermTooltip></p>
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
