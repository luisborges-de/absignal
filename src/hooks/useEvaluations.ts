'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { getEvaluations } from '@/lib/supabase/queries/evaluations'

export const evaluationKeys = {
  all: (dealId: string) => ['evaluations', dealId] as const,
}

let evaluationChannelCounter = 0

export function createEvaluationChannelTopic(dealId: string) {
  evaluationChannelCounter += 1
  return `evaluations:${dealId}:${evaluationChannelCounter}`
}

export function useEvaluations(dealId: string, ruleIds: string[] = []) {
  const queryClient = useQueryClient()
  const ruleIdKey = [...ruleIds].sort().join(',')

  useEffect(() => {
    if (!dealId || !ruleIdKey || !isSupabaseConfigured()) return

    const supabase = createClient()
    const channel = supabase
      .channel(createEvaluationChannelTopic(dealId))
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trigger_evaluations',
          filter: `rule_id=in.(${ruleIdKey})`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: evaluationKeys.all(dealId) })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [dealId, queryClient, ruleIdKey])

  return useQuery({
    queryKey: evaluationKeys.all(dealId),
    queryFn: () => getEvaluations(dealId),
    enabled: Boolean(dealId),
  })
}
