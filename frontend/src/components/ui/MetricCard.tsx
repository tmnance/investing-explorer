import { cn } from '@/lib/utils'
import { Card } from './Card'

interface MetricCardProps {
  label: string
  value: string
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
}

export function MetricCard({ label, value, change, changeType = 'neutral' }: MetricCardProps) {
  return (
    <Card>
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-semibold text-text-primary">{value}</p>
      {change && (
        <p
          className={cn(
            'text-sm mt-1 font-medium',
            changeType === 'positive' && 'text-green',
            changeType === 'negative' && 'text-red',
            changeType === 'neutral' && 'text-text-secondary'
          )}
        >
          {change}
        </p>
      )}
    </Card>
  )
}
