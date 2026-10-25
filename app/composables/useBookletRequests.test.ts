import { describe, expect, it } from 'vitest'
import { requestError } from './useBookletRequests'

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
