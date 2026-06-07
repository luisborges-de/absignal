import Link from 'next/link'
import { BRAND_NAME } from '@/lib/brand'

const groups = [
  ['Platform', 'AI Extraction', 'Trigger Engine', 'Realtime Surveillance'],
  ['Credit', 'ABS Deals', 'Waterfall State', 'Surveillance Export'],
  ['Data Center', 'Occupancy', 'Power Utilization', 'Tenant Metrics'],
  ['Company', 'Hackathon Demo', 'Security', 'Contact'],
]

export function Footer() {
  return (
    <footer className="bg-nv-dark text-nv-on-dark">
      <div className="mx-auto grid max-w-content gap-8 px-6 py-section sm:grid-cols-2 lg:grid-cols-4">
        {groups.map(([title, ...links]) => (
          <div key={title} className="border-l border-nv-hairline-strong pl-4">
            <h2 className="mb-4 text-body-strong font-bold">{title}</h2>
            <ul className="space-y-3 text-body-sm text-white/70">
              {links.map((link) => (
                <li key={link}>
                  <Link href="/" className="hover:text-nv-green">
                    {link}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-content items-center justify-between border-t border-nv-hairline-strong px-6 py-5 text-utility-xs uppercase text-nv-mute">
        <span>{BRAND_NAME}</span>
        <span>Data center ABS surveillance demo</span>
      </div>
    </footer>
  )
}
