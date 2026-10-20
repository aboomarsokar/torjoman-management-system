import { describe, expect, it } from 'vitest'
import { normalizeMyContact } from './useMyContact'

const empty = { phone: '', guardian_email: '', residence: '', nearest_mosque: '' }

describe('بيانات التواصل التي يعدّلها الطالب', () => {
  it('يطبّع الجوّال: أرقامٌ عربية ومسافاتٌ وشُرَط ← أرقامٌ لاتينية متّصلة', () => {
    const r = normalizeMyContact({ ...empty, phone: ' ٠٥٩٩-١٢٣ ٤٥٦ ' })
    expect(r).toEqual({ ok: true, value: { ...empty, phone: '0599123456' } })
  })

  it('يقبل + في أوّل الرقم الدوليّ', () => {
    const r = normalizeMyContact({ ...empty, phone: '+970 599 123456' })
    expect(r.ok && r.value.phone).toBe('+970599123456')
  })

  it('يرفض جوّالاً فيه حروف أو أقصر من سبعة أرقام', () => {
    expect(normalizeMyContact({ ...empty, phone: '059abc' }).ok).toBe(false)
    expect(normalizeMyContact({ ...empty, phone: '123456' }).ok).toBe(false)
  })

  it('يصغّر البريد ويقصّه، ويرفض ما ليس بريداً', () => {
    const r = normalizeMyContact({ ...empty, guardian_email: ' Wali@Mail.COM ' })
    expect(r.ok && r.value.guardian_email).toBe('wali@mail.com')
    expect(normalizeMyContact({ ...empty, guardian_email: 'not-an-email' }).ok).toBe(false)
  })

  it('يقصّ النصّين ويرفض ما زاد على 120 حرفاً', () => {
    const r = normalizeMyContact({ ...empty, residence: '  غزة — الرمال  ', nearest_mosque: ' العمري ' })
    expect(r.ok && [r.value.residence, r.value.nearest_mosque]).toEqual(['غزة — الرمال', 'العمري'])
    expect(normalizeMyContact({ ...empty, residence: 'أ'.repeat(121) }).ok).toBe(false)
  })

  it('الحقولُ الفارغة كلّها مقبولة — المسحُ مقصود', () => {
    expect(normalizeMyContact(empty)).toEqual({ ok: true, value: empty })
  })
})
