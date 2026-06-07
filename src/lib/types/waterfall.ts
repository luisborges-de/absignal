import type { WaterfallStateType } from './deal'

export interface WaterfallLayer {
  id: string
  label: string
  amount: number
  blocked: boolean
}

export interface WaterfallSummary {
  state: WaterfallStateType
  dscr: number
  layers: WaterfallLayer[]
}
