import { describe, expect, it } from 'vitest'
import { dedupeRecipients, normalizeLocalPhone, smsSegments, toInternational } from './sms'

describe('normalizeLocalPhone', () => {
  it('يوحّد الصيغ إلى 05XXXXXXXX', () => {
    expect(normalizeLocalPhone('0599 123 456')).toBe('0599123456')
    expect(normalizeLocalPhone('+970599123456')).toBe('0599123456')
    expect(normalizeLocalPhone('00972569123456')).toBe('0569123456')
    expect(normalizeLocalPhone('599123456')).toBe('0599123456')
    expect(normalizeLocalPhone('٠٥٩٩١٢٣٤٥٦')).toBe('0599123456')
  })
  it('يرفض غيرَ الجوال', () => {
    expect(normalizeLocalPhone('082123456')).toBeNull()
    expect(normalizeLocalPhone('05991234')).toBeNull()
    expect(normalizeLocalPhone('')).toBeNull()
  })
})

describe('toInternational', () => {
  it('970 بلا +', () => expect(toInternational('0599123456')).toBe('970599123456'))
})

describe('smsSegments', () => {
  it('العربيةُ 70 ثم 67', () => {
    expect(smsSegments('س'.repeat(70))).toMatchObject({ segments: 1, unicode: true, perSegment: 70 })
    expect(smsSegments('س'.repeat(71))).toMatchObject({ segments: 2, perSegment: 67 })
    expect(smsSegments('س'.repeat(135))).toMatchObject({ segments: 3 })
  })
  it('اللاتينيةُ 160 ثم 153، والفارغُ صفر', () => {
    expect(smsSegments('a'.repeat(160))).toMatchObject({ segments: 1, unicode: false })
    expect(smsSegments('a'.repeat(161))).toMatchObject({ segments: 2, perSegment: 153 })
    expect(smsSegments('').segments).toBe(0)
  })
})

describe('dedupeRecipients', () => {
  it('يُسقط المكرَّر وغيرَ الصالح', () => {
    const r = dedupeRecipients([
      { name: 'أ', phone: '0599123456' }, { name: 'ب', phone: '+970599123456' }, { name: 'ج', phone: '123' }
    ])
    expect(r.valid).toEqual([{ phone: '0599123456', name: 'أ' }])
    expect(r.invalid).toBe(1)
  })
})
