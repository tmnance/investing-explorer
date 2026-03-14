import { cn } from '@/lib/utils'
import { Card } from './Card'
import { TermTooltip } from './TermTooltip'

interface MetricCardProps {
  label: string
  value: string
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  /** If set, the label is wrapped in a tooltip with this glossary term's definition */
  term?: string
}

export function MetricCard({ label, value, change, changeType = 'neutral', term }: MetricCardProps) {
  return (
    <Card>
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">
        {term ? <TermTooltip term={term}>{label}</TermTooltip> : label}
      </p>
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
