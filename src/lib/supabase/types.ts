export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Tables<T> = {
  Row: T & Record<string, unknown>
  Insert: Partial<T> & Record<string, unknown>
  Update: Partial<T> & Record<string, unknown>
  Relationships: []
}

type AnyTable = Tables<Record<string, unknown>>

export interface Database {
  public: {
    Tables: {
      deals: Tables<{
        id: string
        user_id: string | null
        name: string
        issuer: string
        closing_date: string
        ar_date: string
        total_issuance: number
        asset_count: number
        collateral_description: string | null
        rating_agency: string | null
        rating: string | null
        ltv: number | null
        is_demo: boolean | null
        status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT'
        created_at: string | null
        updated_at: string | null
      }>
      trigger_rules: Tables<{
        id: string
        deal_id: string
        family:
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
        name: string
        description: string | null
        metric_key: string
        operator: 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ' | 'BINARY'
        threshold: number | null
        threshold_unit: string | null
        lookback_periods: number
        consequence:
          | 'CASH_TRAP'
          | 'EARLY_AMORTISATION'
          | 'ENHANCED_RESERVE'
          | 'MANDATORY_DELEVERAGING'
          | 'TURBO_AMORTISATION'
          | 'RATE_STEP_UP'
          | 'MANAGER_REMOVAL'
          | 'ISSUANCE_BLOCKED'
        section_reference: string | null
        source_text: string | null
        extraction_status: 'PENDING' | 'EXTRACTED' | 'APPROVED' | 'REJECTED'
        extraction_confidence: number | null
        watch_buffer: number | null
        active: boolean | null
        created_at: string | null
        updated_at: string | null
      }>
      performance_snapshots: Tables<{
        id: string
        deal_id: string
        period_date: string
        occupancy_rate: number | null
        leased_capacity_mw: number | null
        total_capacity_mw: number | null
        contracted_revenue: number | null
        gross_revenue: number | null
        operating_expenses: number | null
        net_cash_flow: number | null
        scheduled_debt_service: number | null
        senior_debt_service: number | null
        dscr: number | null
        senior_dscr: number | null
        ltv: number | null
        pue_ratio: number | null
        power_cost_per_kwh: number | null
        top_tenant_revenue_pct: number | null
        tenant_count: number | null
        weighted_avg_remaining_lease_term: number | null
        outstanding_balance: number | null
        appraised_value: number | null
        senior_interest_reserve_balance: number | null
        expense_reserve_balance: number | null
        required_reserve_balance: number | null
        source: 'MANUAL' | 'CSV_IMPORT' | 'DEMO' | null
        notes: string | null
        created_at: string | null
      }>
      trigger_evaluations: Tables<{
        id: string
        rule_id: string
        snapshot_id: string
        status: 'SAFE' | 'WATCH' | 'BREACH' | 'N/A'
        current_value: number | null
        threshold: number | null
        distance_to_breach_pct: number | null
        lookback_values: Json | null
        evaluated_at: string | null
      }>
    } & Record<string, AnyTable>
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
