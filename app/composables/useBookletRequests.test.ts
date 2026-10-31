import { describe, expect, it } from 'vitest'
import { readyResult, readyToast, requestError } from './useBookletRequests'

describe('requestError — نموذجُ طلب الملازم', () => {
  const ok = { booklet: 3, copies: '10', note: '' }
  it('السليمُ بلا خطأ', () => {
    expect(requestError(ok)).toBeNull()
  })
  it('الملزمةُ والنسخُ والملاحظة', () => {
    expect(requestError({ ...ok, booklet: undefined })).toBe('اختر الملزمة.')
    expect(requestError({ ...ok, booklet: 16 })).toBe('اختر الملزمة.')
    expect(requestError({ ...ok, copies: '0' })).toMatch(/أكبر من صفر/)
    expect(requestError({ ...ok, copies: '2.5' })).toMatch(/صحيحاً/)
    expect(requestError({ ...ok, copies: '1001' })).toMatch(/لا يتجاوز/)
    expect(requestError({ ...ok, note: 'x'.repeat(301) })).toMatch(/الملاحظة/)
  })
})

describe('إبلاغ بالاستلام — الردّ والتنبيه', () => {
  it('يُنمَّط الردّ', () => {
    expect(readyResult({ tracked: true, available: 12, alert_at: 20 })).toEqual({ tracked: true, available: 12, alertAt: 20 })
    expect(readyResult(null)).toEqual({ tracked: false, available: null, alertAt: null })
  })
  it('غيرُ المجرودة والحدُّ والكافي', () => {
    expect(readyToast({ tracked: false, available: null, alertAt: null }).title).toMatch(/غيرُ مجرودة/)
    expect(readyToast({ tracked: true, available: 20, alertAt: 20 })).toMatchObject({ color: 'warning' })
    expect(readyToast({ tracked: true, available: 50, alertAt: 20 })).toEqual({ title: 'أُبلغ المعلّم وحُجزت النسخ.', color: 'success' })
  })
})
