export function OrderedLegend({
  items,
  activeName,
  onHover,
}: {
  items: { name: string; color: string; type: 'line' | 'rect' }[]
  activeName?: string | null
  onHover?: (name: string | null) => void
}) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-text-secondary mt-2">
      {items.map((item) => (
        <span
          key={item.name}
          className={[
            'flex items-center gap-1.5 select-none',
            activeName && activeName !== item.name ? 'opacity-50' : 'opacity-100',
            onHover ? 'cursor-default' : '',
          ].join(' ')}
          onMouseEnter={onHover ? () => onHover(item.name) : undefined}
          onMouseLeave={onHover ? () => onHover(null) : undefined}
        >
          {item.type === 'line' ? (
            <svg width="14" height="3">
              <line x1="0" y1="1.5" x2="14" y2="1.5" stroke={item.color} strokeWidth={2} />
            </svg>
          ) : (
            <svg width="10" height="10">
              <rect width="10" height="10" rx="2" fill={item.color} />
            </svg>
          )}
          {item.name}
        </span>
      ))}
    </div>
  )
}

