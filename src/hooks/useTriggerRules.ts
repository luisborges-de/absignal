'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getTriggerRules,
  updateTriggerRuleStatus,
  upsertExtractedRules,
} from '@/lib/supabase/queries/triggers'

export const triggerKeys = {
  all: (dealId: string) => ['trigger-rules', dealId] as const,
}

export function useTriggerRules(dealId: string) {
  return useQuery({
    queryKey: triggerKeys.all(dealId),
    queryFn: () => getTriggerRules(dealId),
    enabled: Boolean(dealId),
  })
}

export function useUpdateTriggerRuleStatus(dealId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateTriggerRuleStatus,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: triggerKeys.all(dealId) }),
  })
}

export function useUpsertExtractedRules(dealId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: upsertExtractedRules,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: triggerKeys.all(dealId) }),
  })
}
