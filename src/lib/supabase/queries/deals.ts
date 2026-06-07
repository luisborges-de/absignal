import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { mapDeal } from './mappers'
import { getLocalDeal, getLocalDeals } from '@/lib/demo/localStore'

export async function getDeals() {
  if (!isSupabaseConfigured()) return getLocalDeals()

  const supabase = createClient()
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .order('created_at', { ascending: false })

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
