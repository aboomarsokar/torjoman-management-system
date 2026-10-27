import { afterEach, describe, expect, it } from 'vitest'
import { effectivelyOnline, noteNetworkFailure, noteNetworkSuccess, offlineAuthResponse, shouldShortCircuitAuth } from './reachability'

afterEach(() => noteNetworkSuccess())

describe('effectivelyOnline', () => {
  it('النظامُ «منقطع» يغلب', () => {
    expect(effectivelyOnline(false, 1_000)).toBe(false)
  })

  it('فشلٌ شبكيٌّ قريب يجعله منقطعاً ثلاثين ثانية، ثمّ يعود', () => {
    noteNetworkFailure(1_000)
    expect(effectivelyOnline(true, 20_000)).toBe(false)
    expect(effectivelyOnline(true, 40_000)).toBe(true)
  })

  it('النجاحُ يمحو الفشل', () => {
    noteNetworkFailure(1_000)
    noteNetworkSuccess()
    expect(effectivelyOnline(true, 2_000)).toBe(true)
  })
})

describe('حارسُ نداءات الدخول', () => {
  it('يُقطع نداءُ الدخول وحده وبلا اتصالٍ وحده', () => {
    expect(shouldShortCircuitAuth('https://x.supabase.co/auth/v1/token', false)).toBe(true)
    expect(shouldShortCircuitAuth('https://x.supabase.co/auth/v1/token', true)).toBe(false)
    expect(shouldShortCircuitAuth('https://x.supabase.co/rest/v1/students', false)).toBe(false)
  })

  it('الردُّ 503 برسالةٍ شبكية', async () => {
    const res = offlineAuthResponse()
    expect(res.status).toBe(503)
    expect((await res.json()).msg).toContain('offline')
  })
})
