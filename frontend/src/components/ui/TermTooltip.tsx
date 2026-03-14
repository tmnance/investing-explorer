import { getGlossaryDefinition } from '@/lib/glossary'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface TermTooltipProps {
  term: string
  children?: ReactNode
  className?: string
}

export function TermTooltip({ term, children, className }: TermTooltipProps) {
  const definition = getGlossaryDefinition(term)
  if (!definition) return <>{children ?? term}</>

  return (
    <span
      className={cn('inline cursor-help', className)}
      title={definition}
    >
      {children ?? term}
    </span>
  )
}
