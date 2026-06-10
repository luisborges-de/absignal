import type { ReactNode } from 'react'
import { DemoModeBanner } from './DemoModeBanner'
import { Footer } from './Footer'
import { PrimaryNav } from './PrimaryNav'

interface PageShellProps {
  children: ReactNode
  constrained?: boolean
  showDemoBanner?: boolean
  showFooter?: boolean
}

export function PageShell({
  children,
  constrained = true,
  showDemoBanner = false,
  showFooter = true,
}: PageShellProps) {
  return (
    <>
      <PrimaryNav />
      {showDemoBanner && <DemoModeBanner />}
      <main className={constrained ? 'mx-auto max-w-content px-6' : undefined}>{children}</main>
      {showFooter && <Footer />}
    </>
  )
}
