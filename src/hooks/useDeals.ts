'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createDeal, getDeal, getDeals, type CreateDealInput } from '@/lib/supabase/queries/deals'

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

export function useCreateDeal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateDealInput) => createDeal(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dealKeys.all })
    },
  })
}
