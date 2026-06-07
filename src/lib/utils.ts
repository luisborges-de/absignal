export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    notation: Math.abs(value) >= 1_000_000_000 ? 'compact' : 'standard',
  }).format(value)
}

export function formatPercent(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A'
  return `${(value * 100).toFixed(digits)}%`
}

export function formatRatio(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A'
  return `${value.toFixed(digits)}x`
}

export function daysUntil(date: string) {
  const target = new Date(date).getTime()
  const now = Date.now()
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24))
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`)
}
