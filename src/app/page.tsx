import Link from 'next/link'
import { Activity, FileSearch, GitBranch, RadioTower } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageShell } from '@/components/layout/PageShell'
import { DEMO_DEAL_ID } from '@/lib/demo/seedDemo'
import { BRAND_NAME } from '@/lib/brand'

const features = [
  {
    title: 'AI Rule Extraction',
    Icon: FileSearch,
    body: 'Deal documents become structured trigger rules with source citations.',
  },
  {
    title: 'Trigger Engine',
    Icon: Activity,
    body: 'Deterministic tests evaluate DSCR, LTV, occupancy, tenant, and reserve covenants.',
  },
  {
    title: 'Waterfall Visualization',
    Icon: GitBranch,
    body: 'Cash-trap and amortisation states translate into blocked cash-flow layers.',
  },
  {
    title: 'Surveillance Export',
    Icon: RadioTower,
    body: 'Credit-committee summaries export client-side without a page refresh.',
  },
]

export default function HomePage() {
  return (
    <PageShell constrained={false}>
      <section className="hero-grid bg-nv-dark text-nv-on-dark">
        <div className="mx-auto grid min-h-[620px] max-w-content items-center gap-10 px-6 py-20 lg:grid-cols-[0.92fr_1.08fr]">
          <div>
            <p className="mb-5 text-caption-md font-bold uppercase text-nv-green">{BRAND_NAME}</p>
            <h1 className="max-w-3xl text-[40px] font-bold leading-tight text-nv-on-dark md:text-display-xl">
              Data Center ABS Surveillance. Signals Before Credit Deteriorates.
            </h1>
            <p className="mt-6 max-w-2xl text-heading-lg text-white/75">
              Monitor deal triggers, waterfall state, and collateral performance in one credit workflow.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/auth/login?redirect=/deals/${DEMO_DEAL_ID}`}
                className="inline-flex h-11 items-center rounded-sm bg-nv-green px-6 py-2.5 text-btn-md font-bold text-black hover:bg-nv-green-dark"
              >
                Load Demo Deal
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex h-11 items-center rounded-sm border border-nv-on-dark px-6 py-2.5 text-btn-md font-bold text-nv-on-dark"
              >
                How It Works
              </Link>
            </div>
          </div>
          <div className="hidden h-[420px] border border-nv-hairline-strong bg-black/40 p-6 lg:block">
            <div className="grid h-full grid-cols-6 grid-rows-6 gap-2">
              {Array.from({ length: 36 }).map((_, index) => (
                <div
                  key={index}
                  className="relative overflow-hidden border border-nv-hairline-strong bg-nv-elevated"
                >
                  <span className="absolute inset-x-3 top-3 h-px bg-white/25" />
                  <span className="absolute inset-x-3 top-1/2 h-px bg-white/20" />
                  <span className="absolute bottom-3 left-3 h-px w-[58%] bg-white/30" />
                  <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-nv-green shadow-[0_0_12px_rgba(118,185,0,0.8)]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-content px-6 py-section">
        <div className="mb-8">
          <p className="text-caption-md font-bold uppercase text-nv-mute">Credit Workflow</p>
          <h2 className="mt-2 text-display-lg font-bold">Deal-aware surveillance stack</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {features.map(({ title, Icon, body }) => (
            <Card key={title} className="min-h-[250px]">
              <Icon className="mb-6 h-7 w-7 text-nv-green" aria-hidden="true" />
              <h3 className="text-heading-md font-bold">{title}</h3>
              <p className="mt-4 text-body-md text-nv-body">{body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-nv-dark text-nv-on-dark">
        <div className="mx-auto grid max-w-content gap-6 px-6 py-section md:grid-cols-3">
          {[
            ['$15B', 'ABS in 2025'],
            ['10', 'Trigger families'],
            ['Real-time', 'DSCR surveillance'],
          ].map(([value, label]) => (
            <div key={label} className="border-l border-nv-hairline-strong pl-6">
              <p className="text-display-lg font-bold text-nv-green">{value}</p>
              <p className="mt-2 text-body-md text-white/75">{label}</p>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  )
}
