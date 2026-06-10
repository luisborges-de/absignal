import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { mapDeal } from './mappers'
import { addLocalDeal, getLocalDeal, getLocalDeals } from '@/lib/demo/localStore'
import { isDemoModeEnabled } from '@/lib/demo/demoMode'
import type { Deal, DealMarket } from '@/lib/types/deal'

export async function getDeals() {
  const demoMode = isDemoModeEnabled()

  if (!isSupabaseConfigured()) {
    const deals = getLocalDeals()
    return demoMode ? deals : deals.filter((deal) => !deal.isDemo)
  }

  const supabase = createClient()
  let query = supabase.from('deals').select('*').order('created_at', { ascending: false })
  // Seeded sample deals are hidden unless demo mode is explicitly enabled.
  if (!demoMode) query = query.eq('is_demo', false)
  const { data, error } = await query

  if (error) throw error
  return data.map(mapDeal)
}

export async function getDeal(id: string) {
  if (!isSupabaseConfigured()) {
    const deal = getLocalDeal(id)
    if (!deal) throw new Error('Deal not found')
    return deal
  }

  const supabase = createClient()
  const { data, error } = await supabase.from('deals').select('*').eq('id', id).single()

  if (error) throw error
  return mapDeal(data)
}

export interface CreateDealInput {
  name: string
  issuer: string
  market: DealMarket
  closingDate: string
  arDate: string
  totalIssuance: number
  assetCount: number
  collateralDescription: string
}

export async function createDeal(input: CreateDealInput): Promise<Deal> {
  if (!isSupabaseConfigured()) {
    const timestamp = new Date().toISOString()
    return addLocalDeal({
      id: globalThis.crypto.randomUUID(),
      userId: null,
      name: input.name,
      issuer: input.issuer,
      market: input.market,
      closingDate: input.closingDate,
      arDate: input.arDate,
      totalIssuance: input.totalIssuance,
      assetCount: input.assetCount,
      collateralDescription: input.collateralDescription,
      ratingAgency: '',
      rating: '',
      ltv: 0,
      isDemo: false,
      status: 'ACTIVE',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('deals')
    .insert({
      user_id: user?.id ?? null,
      name: input.name,
      issuer: input.issuer,
      market: input.market,
      closing_date: input.closingDate,
      ar_date: input.arDate,
      total_issuance: input.totalIssuance,
      asset_count: input.assetCount,
      collateral_description: input.collateralDescription,
      status: 'ACTIVE',
    })
    .select('*')
    .single()

  if (error) throw error
  return mapDeal(data)
}
