export type WaterfallStateType = 'NORMAL' | 'CASH_TRAP' | 'EARLY_AMORTISATION' | 'POST_ARD'

export interface Deal {
  id: string
  userId: string | null
  name: string
  issuer: string
  closingDate: string
  arDate: string
  totalIssuance: number
  assetCount: number
  collateralDescription: string
  ratingAgency: string
  rating: string
  ltv: number
  isDemo: boolean
  status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT'
  createdAt: string
  updatedAt: string
}
