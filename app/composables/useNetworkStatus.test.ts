import { describe, expect, it } from 'vitest'
import { OFFLINE_PATHS } from '~/constants/navigation'

describe('useNetworkStatus — الشاشاتُ المتاحة بلا اتصال', () => {
  it('الحضورُ وحده', () => {
    expect(OFFLINE_PATHS).toEqual(['/t/home', '/t', '/t/quran'])
  })
})
