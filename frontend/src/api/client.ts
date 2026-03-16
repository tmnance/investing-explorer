const BASE_URL = '/api'

async function request<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)
  return res.json()
}

async function post<T>(path: string): Promise<T> {
  const res = await fetch(`${window.location.origin}${BASE_URL}${path}`, { method: 'POST' })
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)
  return res.json()
}

export interface Company {
  ticker: string
  name: string
  sector: string
  industry: string
}

export interface MarketCapRanking {
  id: number
  year: number
  rank: number
  ticker: string
  company_name: string
  market_cap: number
}

export interface PriceHistory {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  adj_close: number
}

export interface BenchmarkIndex {
  date: string
  index_symbol: string
  index_name: string
  close: number
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface StrategyResult {
  name: string
  dates: string[]
  cumulative_returns: number[]
  annual_returns: Record<string, number>
  metrics: {
    cagr: number
    volatility: number
    sharpe_ratio: number
    max_drawdown: number
    sortino_ratio: number
    total_return: number
    calmar_ratio: number
    after_tax_cagr: number
    tax_drag: number
    turnover: number
    best_year: number
    worst_year: number
    win_rate: number
  }
}

export interface BenchmarkComparison {
  index_symbol: string
  index_name: string
  dates: string[]
  normalized_values: number[]
}

export const api = {
  getCompanies: () =>
    request<PaginatedResponse<Company>>('/companies/'),

  getCompany: (ticker: string) =>
    request<Company>(`/companies/${ticker}/`),

  getMarketCapRankings: (params?: { year?: string; ticker?: string }) =>
    request<PaginatedResponse<MarketCapRanking>>('/rankings/', params),

  getRankingYears: () =>
    request<number[]>('/rankings/years/'),

  getTopMovers: () =>
    request<{ gainers: MarketCapRanking[]; losers: MarketCapRanking[] }>('/rankings/top_movers/'),

  getPriceHistory: (ticker: string, params?: { start_date?: string; end_date?: string }) =>
    request<PriceHistory[]>(`/prices/${ticker}/`, params),

  getBenchmarks: (params?: { start_date?: string; end_date?: string }) =>
    request<BenchmarkComparison[]>('/benchmarks/', params),

  getBenchmarkLatest: () =>
    request<BenchmarkIndex[]>('/benchmarks/latest/'),

  getStrategyComparison: (strategies: string[], startYear?: number, endYear?: number) => {
    const params: Record<string, string> = { strategies: strategies.join(',') }
    if (startYear) params.start_year = String(startYear)
    if (endYear) params.end_year = String(endYear)
    return request<StrategyResult[]>('/strategies/compare/', params)
  },

  getAvailableStrategies: () =>
    request<{ id: string; name: string; description: string }[]>('/strategies/'),

  getSyncStatus: () =>
    request<{ prices_latest: string | null; indices_latest: string | null }>('/sync/status/'),

  syncData: () =>
    post<{
      price_records: number
      index_records: number
      errors: string[]
      status: { prices_latest: string | null; indices_latest: string | null }
    }>('/sync/'),
}
