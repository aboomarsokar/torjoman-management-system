import { describe, expect, it, vi } from 'vitest'

// تعريفُ الصناديق يحتاج Nuxt — والمختبَرُ هنا رسالةُ المعلّم؛ ورفعُ المسوّدة في utils/incentiveOutbox.test.ts
vi.mock('~/utils/offlineQueues', () => ({ INCENTIVE_QUEUE: 'incentives' }))
const { INCENTIVE_SAVED_ON_DEVICE } = await import('./useIncentiveOffline')

describe('useIncentiveOffline', () => {
  it('يقول للمعلّم أين حُفظ كشفُه ومتى يُرفع', () => {
    expect(INCENTIVE_SAVED_ON_DEVICE).toContain('على جهازك')
    expect(INCENTIVE_SAVED_ON_DEVICE).toContain('يعود الاتصال')
  })
})
