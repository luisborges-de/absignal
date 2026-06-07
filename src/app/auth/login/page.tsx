import { Suspense } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { Card } from '@/components/ui/Card'
import { BRAND_NAME, DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/brand'
import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <PageShell constrained={false}>
      <section className="bg-nv-dark px-6 py-section text-nv-on-dark">
        <div className="mx-auto grid max-w-content gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-caption-md font-bold uppercase text-nv-green">Secure Access</p>
            <h1 className="mt-3 text-display-lg font-bold">Sign in to {BRAND_NAME}</h1>
            <p className="mt-5 text-heading-lg text-white/70">
              Demo credentials: {DEMO_EMAIL} / {DEMO_PASSWORD}
            </p>
          </div>
          <Suspense fallback={<Card dark className="min-h-[260px] animate-pulse" />}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </PageShell>
  )
}
