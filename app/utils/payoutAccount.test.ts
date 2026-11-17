import { describe, expect, it } from 'vitest'
import { holderIdFromWorker, isSameHolderName, normalizePayoutInput, payoutAccountError, type PayoutAccountInput } from './payoutAccount'

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
  it('جوال باي وحده (قرار 2026-11-17)', () => {
    expect(payoutAccountError({ ...ok, type: null })).toBe('يلزم حسابُ جوال باي.')
    expect(payoutAccountError({ ...ok, type: 'palpay' })).toBe('يلزم حسابُ جوال باي.')
    expect(payoutAccountError({ ...ok, type: 'bank_palestine' })).toBe('يلزم حسابُ جوال باي.')
  })
  it('المحفظةُ رقمُ جوّالٍ من 10 أرقام يبدأ بـ05', () => {
    expect(payoutAccountError({ ...ok, number: '12345' })).toContain('رقمُ المحفظة')
    expect(payoutAccountError({ ...ok, number: '0491234567' })).toContain('رقمُ المحفظة')
    expect(payoutAccountError({ ...ok, number: '05912345678' })).toContain('رقمُ المحفظة')
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

describe('isSameHolderName / holderIdFromWorker', () => {
  const worker = { name: 'هبة منير أحمد أبو عواد', nationalId: '123456789' }
  it('الاسمُ نفسُه بلا فرقٍ في الهمزات والمسافات', () => {
    expect(isSameHolderName('هبة منيراحمدابوعواد', worker.name)).toBe(true)
    expect(isSameHolderName('ايمان عبد الكريم', 'إيمان عبد الكريم')).toBe(true)
  })
  it('المختصَرُ واللاتينيُّ والفارغُ ليست هو', () => {
    expect(isSameHolderName('هبة أبو عواد', worker.name)).toBe(false)
    expect(isSameHolderName('Heba Abu Awad', worker.name)).toBe(false)
    expect(isSameHolderName('  ', '')).toBe(false)
  })
  it('تُملأ هويةُ العامل للاسم نفسه وحده، وبهويةٍ صالحة', () => {
    expect(holderIdFromWorker('هبة منير أحمد أبو عواد', worker)).toBe('123456789')
    expect(holderIdFromWorker('فرح البنا', worker)).toBeNull()
    expect(holderIdFromWorker(worker.name, { ...worker, nationalId: null })).toBeNull()
    expect(holderIdFromWorker(worker.name, { ...worker, nationalId: '1234' })).toBeNull()
  })
})
