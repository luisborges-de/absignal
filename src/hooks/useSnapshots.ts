'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSnapshots, createSnapshot } from '@/lib/supabase/queries/snapshots'

export const snapshotKeys = {
  all: (dealId: string) => ['snapshots', dealId] as const,
}

export function useSnapshots(dealId: string) {
  return useQuery({
    queryKey: snapshotKeys.all(dealId),
    queryFn: () => getSnapshots(dealId),
    enabled: Boolean(dealId),
  })
}

export function useCreateSnapshot(dealId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createSnapshot,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: snapshotKeys.all(dealId) }),
  })
}
