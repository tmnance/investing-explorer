import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppLayout from '@/components/layout/AppLayout'
import Dashboard from '@/pages/Dashboard'
import MarketCapExplorer from '@/pages/MarketCapExplorer'
import StockList from '@/pages/StockList'
import StockDetail from '@/pages/StockDetail'
import StrategyComparison from '@/pages/StrategyComparison'
import MomentumExplorer from '@/pages/MomentumExplorer'
import BenchmarkComparison from '@/pages/BenchmarkComparison'
import PortfolioSimulator from '@/pages/PortfolioSimulator'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/market-cap" element={<MarketCapExplorer />} />
            <Route path="/stocks" element={<StockList />} />
            <Route path="/stocks/:ticker" element={<StockDetail />} />
            <Route path="/strategies" element={<StrategyComparison />} />
            <Route path="/strategies/momentum" element={<MomentumExplorer />} />
            <Route path="/benchmarks" element={<BenchmarkComparison />} />
            <Route path="/simulator" element={<PortfolioSimulator />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
