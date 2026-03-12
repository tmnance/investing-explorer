import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/api/client'
import { Card } from '@/components/ui/Card'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'

export default function StockList() {
  const [search, setSearch] = useState('')

  const companies = useQuery({
    queryKey: ['companies'],
    queryFn: () => api.getCompanies(),
  })

  const filtered = (companies.data?.results ?? []).filter(
    (c) =>
      c.ticker.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Stocks</h1>
        <p className="text-text-secondary mt-1">Browse and explore individual stocks</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          placeholder="Search by ticker or company name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-text-muted font-medium">Ticker</th>
                <th className="text-left py-3 px-4 text-text-muted font-medium">Company</th>
                <th className="text-left py-3 px-4 text-text-muted font-medium">Sector</th>
                <th className="text-left py-3 px-4 text-text-muted font-medium">Industry</th>
              </tr>
            </thead>
            <tbody>
              {companies.isLoading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-text-muted">Loading...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-text-muted">
                    {search ? 'No matching companies' : 'No company data yet. Run the import script.'}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.ticker} className="border-b border-border-subtle hover:bg-surface-elevated transition-colors">
                    <td className="py-3 px-4">
                      <Link
                        to={`/stocks/${c.ticker}`}
                        className="font-mono text-accent hover:text-accent-hover no-underline transition-colors"
                      >
                        {c.ticker}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-text-primary">{c.name}</td>
                    <td className="py-3 px-4 text-text-secondary">{c.sector || '--'}</td>
                    <td className="py-3 px-4 text-text-secondary">{c.industry || '--'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
