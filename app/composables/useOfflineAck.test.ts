import { describe, expect, it, vi } from 'vitest'

// تعريفُ الصناديق يحتاج Nuxt — والمختبَرُ هنا رسالةُ المعلّم وحدها؛ ومنطقُ الإقرار النقيّ في utils/ackOutbox.test.ts
vi.mock('~/utils/offlineQueues', () => ({ ACK_QUEUE: 'acks' }))
const { ACK_SAVED_MESSAGE } = await import('./useOfflineAck')

describe('useOfflineAck', () => {
  it('يقول للمعلّم أين حُفظ إقرارُه ومتى يُرفع', () => {
    expect(ACK_SAVED_MESSAGE).toContain('على جهازك')
    expect(ACK_SAVED_MESSAGE).toContain('يعود الاتصال')
  })
})
