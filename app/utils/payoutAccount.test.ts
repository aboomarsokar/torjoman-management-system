import { describe, expect, it } from 'vitest'
import { isWallet, normalizePayoutInput, payoutAccountError, type PayoutAccountInput } from './payoutAccount'

const ok: PayoutAccountInput = { type: 'jawwalpay', number: '0591234567', holder: 'محمود أحمد', holderId: '123456789' }

describe('normalizePayoutInput', () => {
  it('الأرقامُ العربية لاتينيةٌ بلا مسافاتٍ ولا شُرَط، والاسمُ بمسافةٍ واحدة', () => {
    expect(normalizePayoutInput({ type: 'palpay', number: '٠٥٩ ١٢٣-٤٥٦٧', holder: '  محمود   أحمد ', holderId: '١٢٣ ٤٥٦ ٧٨٩' }))
      .toEqual({ type: 'palpay', number: '0591234567', holder: 'محمود أحمد', holderId: '123456789' })
  })
  it('الحسابُ البنكيُّ بأحرفٍ كبيرة', () => {
    expect(normalizePayoutInput({ ...ok, type: 'bank_palestine', number: 'ps92 palS' }).number).toBe('PS92PALS')
  })
})

describe('payoutAccountError', () => {
  it('السليمُ يمرّ، ولو بأرقامٍ عربية', () => {
    expect(payoutAccountError(ok)).toBeNull()
    expect(payoutAccountError({ ...ok, number: '٠٥٦٩٨٧٦٥٤٣', holderId: '٩٨٧٦٥٤٣٢١' })).toBeNull()
  })
  it('بلا نوع', () => {
    expect(payoutAccountError({ ...ok, type: null })).toBe('اختر نوعَ الحساب.')
  })
  it('المحفظةُ رقمُ جوّالٍ من 10 أرقام يبدأ بـ05', () => {
    expect(payoutAccountError({ ...ok, number: '12345' })).toContain('رقمُ المحفظة')
    expect(payoutAccountError({ ...ok, type: 'palpay', number: '0491234567' })).toContain('رقمُ المحفظة')
    expect(payoutAccountError({ ...ok, number: '05912345678' })).toContain('رقمُ المحفظة')
  })
  it('البنكُ يقبل أحرفاً وأرقاماً من 4 إلى 34', () => {
    expect(payoutAccountError({ ...ok, type: 'bank_palestine', number: 'PS92PALS000000000400123456702' })).toBeNull()
    expect(payoutAccountError({ ...ok, type: 'bank_palestine', number: '12' })).toBe('رقمُ الحساب البنكيّ غير صحيح.')
  })
  it('اسمُ صاحب الحساب كاملاً', () => {
    expect(payoutAccountError({ ...ok, holder: ' م ' })).toBe('اكتب اسمَ صاحب الحساب كاملاً.')
    expect(payoutAccountError({ ...ok, holder: 'ا'.repeat(81) })).toBe('اكتب اسمَ صاحب الحساب كاملاً.')
  })
  it('هويةُ صاحب الحساب تسعةُ أرقام', () => {
    expect(payoutAccountError({ ...ok, holderId: '12345678' })).toBe('رقمُ هوية صاحب الحساب تسعةُ أرقام.')
    expect(payoutAccountError({ ...ok, holderId: '' })).toBe('رقمُ هوية صاحب الحساب تسعةُ أرقام.')
  })
})

describe('isWallet', () => {
  it('جوال باي وبال باي وحدهما', () => {
    expect(['jawwalpay', 'palpay', 'bank_palestine', null].map(t => isWallet(t as never))).toEqual([true, true, false, false])
  })
})
