import { describe, expect, it } from 'vitest'
import { hasArabic, rawErrorText } from './errorText'

describe('hasArabic', () => {
  it('يميّز النصّ العربي من الإنجليزي', () => {
    expect(hasArabic('الرقم أو كلمة المرور غير صحيحة.')).toBe(true)
    expect(hasArabic('Invalid login credentials')).toBe(false)
    expect(hasArabic('')).toBe(false)
  })
})

describe('rawErrorText', () => {
  it('يفضّل statusMessage القادم من الخادم على الرسالة المركّبة', () => {
    const fetchError = Object.assign(new Error('[POST] "/api/auth/staff-login": 401 الرقم أو كلمة المرور غير صحيحة.'), {
      statusMessage: 'الرقم أو كلمة المرور غير صحيحة.'
    })
    expect(rawErrorText(fetchError)).toBe('الرقم أو كلمة المرور غير صحيحة.')
  })

  it('يقرأ data.statusMessage عند غياب statusMessage', () => {
    expect(rawErrorText({ data: { statusMessage: 'رسالة' }, message: 'x' })).toBe('رسالة')
  })

  it('يرجع message للخطأ العادي والنصّ للسلسلة', () => {
    expect(rawErrorText(new Error('account_disabled'))).toBe('account_disabled')
    expect(rawErrorText('نصّ')).toBe('نصّ')
  })

  it('يرجع نصّاً فارغاً لما لا يُعرف', () => {
    expect(rawErrorText(null)).toBe('')
    expect(rawErrorText(42)).toBe('')
    expect(rawErrorText({})).toBe('')
  })
})
