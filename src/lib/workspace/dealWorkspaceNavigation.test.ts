import { describe, expect, it } from 'vitest'
import { getDealWorkspaceItems } from './dealWorkspaceNavigation'

describe('dealWorkspaceNavigation', () => {
  it('builds the selected-deal workflow items with desktop and mobile labels', () => {
    const items = getDealWorkspaceItems('deal-123', '/deals/deal-123/performance')

    expect(items).toEqual([
      {
        href: '/deals/deal-123',
        desktopLabel: 'Overview',
        mobileLabel: 'Overview',
        active: false,
      },
      {
        href: '/deals/deal-123/extraction',
        desktopLabel: 'Covenant Review',
        mobileLabel: 'Rules',
        active: false,
      },
      {
        href: '/deals/deal-123/performance',
        desktopLabel: 'Performance',
        mobileLabel: 'Data',
        active: true,
      },
      {
        href: '/deals/deal-123/waterfall',
        desktopLabel: 'Waterfall',
        mobileLabel: 'Waterfall',
        active: false,
      },
    ])
  })
})
