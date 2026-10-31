import { describe, expect, it } from 'vitest'
import { resultSendToasts } from './useCandidateResultSms'

describe('resultSendToasts — رسائلُ ما بعد إرسال النتيجة', () => {
  it('لا شيء حين لا شيء', () => {
    expect(resultSendToasts({ sent: 0, failed: 0, skipped: 0, error: null })).toEqual([])
  })
  it('الواصلُ والمتعذّرُ والمتروك', () => {
    const out = resultSendToasts({ sent: 3, failed: 1, skipped: 2, error: 'الرصيد غير كافٍ' })
    expect(out.map(m => m.color)).toEqual(['success', 'error', 'warning'])
    expect(out[0]!.title).toBe('أُرسلت رسالة النتيجة إلى 3.')
    expect(out[1]!.title).toBe('تعذّر الإرسال إلى 1: الرصيد غير كافٍ')
    expect(out[2]!.title).toMatch(/تُرك 2/)
  })
})
