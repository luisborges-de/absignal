import { PageShell } from '@/components/layout/PageShell'
import { Card } from '@/components/ui/Card'

export default function NewDealPage() {
  return (
    <PageShell showDemoBanner>
      <section className="py-section">
        <Card>
          <p className="text-caption-md font-bold uppercase text-nv-mute">New Deal</p>
          <h1 className="mt-2 text-display-lg font-bold">Deal intake</h1>
          <p className="mt-4 text-body-md text-nv-body">
            Deal creation is available through the Supabase-backed query layer and can be extended with the same form vocabulary as performance snapshots.
          </p>
        </Card>
      </section>
    </PageShell>
  )
}
