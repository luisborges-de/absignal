'use client'

import { useUIStore } from '@/store/uiStore'

export function DemoModeBanner() {
  const isDemoMode = useUIStore((state) => state.isDemoMode)
  const setDemoMode = useUIStore((state) => state.setDemoMode)

  if (!isDemoMode) return null

  return (
    <div className="border-b border-nv-warning bg-nv-warning/10 text-nv-warning">
      <div className="mx-auto flex max-w-content items-center justify-between gap-4 px-6 py-3 text-body-sm">
        <p className="font-bold">Demo Mode - Centersquare Issuer LLC, Series 2025-2 synthetic scenario</p>
        <button
          type="button"
          onClick={() => setDemoMode(false)}
          className="min-h-11 rounded-sm text-btn-sm font-bold text-nv-warning"
        >
          Clear Demo
        </button>
      </div>
    </div>
  )
}
