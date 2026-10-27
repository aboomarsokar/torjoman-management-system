import { describe, expect, it } from 'vitest'
import { OFFLINE_PATHS } from '~/constants/navigation'

describe('useNetworkStatus — الشاشاتُ المتاحة بلا اتصال', () => {
  it('الحضورُ وحده', () => {
    expect(OFFLINE_PATHS).toContain('/t/home')
    expect(OFFLINE_PATHS).toContain('/visits')
    expect(OFFLINE_PATHS).not.toContain('/my-booklets')
  })
})
