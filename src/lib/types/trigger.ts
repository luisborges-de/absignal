export type TriggerFamily =
  | 'DSCR_CASH_TRAP'
  | 'DSCR_EARLY_AMORTISATION'
  | 'LTV_SWEEP'
  | 'OCCUPANCY_RESERVE'
  | 'TENANT_CONCENTRATION'
  | 'WART_RESERVE'
  | 'SERVICER_TERMINATION'
  | 'ADDITIONAL_ISSUANCE'
  | 'ARD_MATURITY'
  | 'EXPENSE_RESERVE'

export type TriggerOperator = 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ' | 'BINARY'

export type TriggerConsequence =
  | 'CASH_TRAP'
  | 'EARLY_AMORTISATION'
  | 'ENHANCED_RESERVE'
  | 'MANDATORY_DELEVERAGING'
  | 'TURBO_AMORTISATION'
  | 'RATE_STEP_UP'
  | 'MANAGER_REMOVAL'
  | 'ISSUANCE_BLOCKED'

export type TriggerStatus = 'SAFE' | 'WATCH' | 'BREACH' | 'N/A'
export type ExtractionStatus = 'PENDING' | 'EXTRACTED' | 'APPROVED' | 'REJECTED'

export interface TriggerRule {
  id: string
  dealId: string
  family: TriggerFamily
  name: string
  description: string
  metricKey: string
  operator: TriggerOperator
  threshold: number | null
  thresholdUnit: string
  lookbackPeriods: number
  consequence: TriggerConsequence
  sectionReference: string
  sourceText: string
  extractionStatus: ExtractionStatus
  extractionConfidence: number
  watchBuffer: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface TriggerEvaluation {
  id: string
  ruleId: string
  snapshotId: string
  family: TriggerFamily
  consequence: TriggerConsequence
  status: TriggerStatus
  currentValue: number | null
  threshold: number | null
  distanceToBreachPct: number | null
  lookbackValues: number[]
  evaluatedAt: string
}

export interface ExtractedRuleCandidate
  extends Omit<
    TriggerRule,
    'id' | 'dealId' | 'extractionStatus' | 'active' | 'createdAt' | 'updatedAt'
  > {}
