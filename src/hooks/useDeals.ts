'use client'

import { useQuery } from '@tanstack/react-query'
import { getDeal, getDeals } from '@/lib/supabase/queries/deals'

export const dealKeys = {
  all: ['deals'] as const,
  single: (id: string) => ['deals', id] as const,
}

export function useDeals() {
  return useQuery({ queryKey: dealKeys.all, queryFn: getDeals })
}

export function useDeal(id: string) {
  return useQuery({ queryKey: dealKeys.single(id), queryFn: () => getDeal(id), enabled: Boolean(id) })
}
