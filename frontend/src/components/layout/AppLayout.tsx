import { Link, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  BarChart3,
  TrendingUp,
  GitCompare,
  LineChart,
  Briefcase,
} from 'lucide-react'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/market-cap', label: 'Market Cap', icon: BarChart3 },
  { path: '/stocks', label: 'Stocks', icon: TrendingUp },
  { path: '/strategies', label: 'Strategies', icon: GitCompare },
  { path: '/benchmarks', label: 'Benchmarks', icon: LineChart },
  { path: '/simulator', label: 'Simulator', icon: Briefcase },
]

export default function AppLayout() {
  const location = useLocation()

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-56 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="p-5 border-b border-border">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <TrendingUp className="w-6 h-6 text-accent" />
            <span className="text-lg font-semibold text-text-primary">
              MarketScope
            </span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active =
              path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(path)
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm no-underline transition-colors',
                  active
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            )
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="p-6 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
