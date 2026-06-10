'use client'

/**
 * Demo mode controls whether the seeded sample deals (is_demo = true) are shown.
 * Off by default: the app surfaces only real / user-created deals. Turning it on
 * reveals the built-in demo corpus for presentations. Persisted in localStorage
 * so the choice survives reloads.
 */
const DEMO_MODE_KEY = 'absignal:demo-mode'

export function isDemoModeEnabled(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false
  return window.localStorage.getItem(DEMO_MODE_KEY) === 'true'
}

export function setDemoModeEnabled(enabled: boolean) {
  if (typeof window === 'undefined' || !window.localStorage) return
  if (enabled) window.localStorage.setItem(DEMO_MODE_KEY, 'true')
  else window.localStorage.removeItem(DEMO_MODE_KEY)
}
