'use client'

import { AlertTriangle } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function DealsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageShell showDemoBanner>
      <section className="py-section">
        <Card className="mx-auto max-w-2xl">
          <AlertTriangle className="mb-5 h-7 w-7 text-nv-warning" aria-hidden="true" />
          <p className="text-caption-md font-bold uppercase text-nv-mute">Data unavailable</p>
          <h1 className="mt-2 text-heading-xl font-bold">Unable to load surveillance data</h1>
          <p className="mt-4 text-body-md text-nv-body">
            {error.message || 'A Supabase-dependent section failed to load.'}
          </p>
          <Button className="mt-6" variant="outline" onClick={reset}>
            Retry
          </Button>
        </Card>
      </section>
    </PageShell>
  )
}
