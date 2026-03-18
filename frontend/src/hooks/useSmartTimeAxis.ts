import { useMemo } from 'react'

type AnyRecord = Record<string, unknown>

export function useSmartTimeAxis<T extends AnyRecord>(
  data: T[],
  opts?: {
    /** Key containing an ISO date string like "YYYY-MM-DD". */
    dateKey?: keyof T
    /** Switch to month ticks at or under this month span. */
    monthModeMaxMonths?: number
    /** Maximum number of ticks when showing month labels. */
    maxMonthTicks?: number
    /** Maximum number of ticks when showing year labels. */
    maxYearTicks?: number
  }
) {
  const dateKey = (opts?.dateKey ?? ('date' as keyof T))
  const monthModeMaxMonths = opts?.monthModeMaxMonths ?? 24
  const maxMonthTicks = opts?.maxMonthTicks ?? 12
  const maxYearTicks = opts?.maxYearTicks ?? 10

  return useMemo(() => {
    if (!data.length) {
      return {
        ticks: [] as string[],
        tickFormatter: (d: string) => d.slice(0, 4),
      }
    }

    const dates = data
      .map((row) => row[dateKey])
      .filter((v): v is string => typeof v === 'string' && v.length >= 10)
      .map(String)

    if (!dates.length) {
      return {
        ticks: [] as string[],
        tickFormatter: (d: string) => d.slice(0, 4),
      }
    }

    const first = new Date(dates[0])
    const last = new Date(dates[dates.length - 1])
    if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) {
      return {
        ticks: [] as string[],
        tickFormatter: (d: string) => d.slice(0, 4),
      }
    }

    const monthsSpan =
      (last.getFullYear() - first.getFullYear()) * 12 + (last.getMonth() - first.getMonth()) + 1
    const yearsSpan = last.getFullYear() - first.getFullYear() + 1

    // Month-level ticks (never more granular than months).
    if (monthsSpan <= monthModeMaxMonths) {
      const step = Math.max(1, Math.ceil(monthsSpan / maxMonthTicks))
      const ticks: string[] = []

      const cursor = new Date(first.getFullYear(), first.getMonth(), 1)
      while (cursor <= last) {
        const y = cursor.getFullYear()
        const m = String(cursor.getMonth() + 1).padStart(2, '0')
        const prefix = `${y}-${m}-`
        const match = dates.find((d) => d.startsWith(prefix))
        ticks.push(match ?? `${y}-${m}-01`)
        cursor.setMonth(cursor.getMonth() + step)
      }

      return {
        ticks: Array.from(new Set(ticks)),
        tickFormatter: (d: string) => {
          const dt = new Date(d)
          if (Number.isNaN(dt.getTime())) return d.slice(0, 7)
          return dt.toLocaleString('en-US', { month: 'short', year: 'numeric' })
        },
      }
    }

    // Year ticks for long ranges.
    const step = Math.max(1, Math.ceil(yearsSpan / maxYearTicks))
    const ticks: string[] = []
    for (let y = first.getFullYear(); y <= last.getFullYear(); y += step) {
      const match = dates.find((d) => d.startsWith(`${y}-`))
      if (match) ticks.push(match)
    }
    const end = dates[dates.length - 1]
    if (!ticks.includes(end)) ticks.push(end)

    return {
      ticks,
      tickFormatter: (d: string) => String(d).slice(0, 4),
    }
  }, [data, dateKey, maxMonthTicks, maxYearTicks, monthModeMaxMonths])
}

