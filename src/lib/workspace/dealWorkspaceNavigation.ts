export interface DealWorkspaceItem {
  href: string
  desktopLabel: string
  mobileLabel: string
  active: boolean
}

const sections = [
  { segment: '', desktopLabel: 'Overview', mobileLabel: 'Overview' },
  { segment: 'extraction', desktopLabel: 'Covenant Review', mobileLabel: 'Rules' },
  { segment: 'performance', desktopLabel: 'Performance', mobileLabel: 'Data' },
  { segment: 'waterfall', desktopLabel: 'Waterfall', mobileLabel: 'Waterfall' },
] as const

export function getDealWorkspaceItems(dealId: string, pathname: string): DealWorkspaceItem[] {
  return sections.map(({ segment, desktopLabel, mobileLabel }) => {
    const href = segment ? `/deals/${dealId}/${segment}` : `/deals/${dealId}`

    return {
      href,
      desktopLabel,
      mobileLabel,
      active: pathname === href,
    }
  })
}
