import type { WaterfallStateType } from '@/lib/types/deal'
import type { WaterfallLayer, WaterfallSummary } from '@/lib/types/waterfall'

const BASE_LAYERS: Omit<WaterfallLayer, 'blocked'>[] = [
  { id: 'class-a-senior', label: 'Class A Senior', amount: 560_000_000 },
  { id: 'class-a-2', label: 'Class A-2', amount: 220_000_000 },
  { id: 'class-b', label: 'Class B', amount: 110_000_000 },
  { id: 'expense-reserve', label: 'Expense Reserve', amount: 6_000_000 },
  { id: 'residual', label: 'Residual', amount: 44_000_000 },
]

export function buildWaterfallSummary(state: WaterfallStateType, dscr: number): WaterfallSummary {
  const blockedIds =
    state === 'CASH_TRAP' || state === 'EARLY_AMORTISATION'
      ? new Set(['class-b', 'residual'])
      : new Set<string>()

  return {
    state,
    dscr,
    layers: BASE_LAYERS.map((layer) => ({
      ...layer,
      blocked: blockedIds.has(layer.id),
    })),
  }
}
