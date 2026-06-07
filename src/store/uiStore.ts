'use client'

import { create } from 'zustand'

interface UIState {
  selectedSnapshotId: string | null
  isDemoMode: boolean
  isExtracting: boolean
  setSelectedSnapshot: (id: string | null) => void
  setDemoMode: (value: boolean) => void
  setExtracting: (value: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  selectedSnapshotId: null,
  isDemoMode: true,
  isExtracting: false,
  setSelectedSnapshot: (selectedSnapshotId) => set({ selectedSnapshotId }),
  setDemoMode: (isDemoMode) => set({ isDemoMode }),
  setExtracting: (isExtracting) => set({ isExtracting }),
}))
