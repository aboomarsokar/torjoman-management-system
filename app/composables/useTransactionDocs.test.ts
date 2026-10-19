/**
 * مستنداتُ الحركات: الأنواعُ والحجمُ المقبولان، وشكلُ المسار الذي تقبله سياسةُ المستودع.
 */
import { describe, expect, it } from 'vitest'
import { financeDocError, financeDocPath, formatDocSize } from './useTransactionDocs'

const MB = 1024 * 1024

describe('financeDocError', () => {
  it('صورةٌ أو PDF في الحدّ تُقبل', () => {
    expect(financeDocError({ type: 'image/jpeg', size: 2 * MB })).toBeNull()
    expect(financeDocError({ type: 'application/pdf', size: 10 * MB })).toBeNull()
  })
  it('نوعٌ آخر يُرفض', () => {
    expect(financeDocError({ type: 'application/msword', size: 1000 })).toBeTruthy()
    expect(financeDocError({ type: 'image/heic', size: 1000 })).toBeTruthy()
  })
  it('أكبر من 10 م.ب أو فارغ يُرفض', () => {
    expect(financeDocError({ type: 'image/png', size: 10 * MB + 1 })).toBe('الملفّ أكبر من 10 م.ب.')
    expect(financeDocError({ type: 'image/png', size: 0 })).toBe('الملفّ فارغ.')
  })
})

describe('financeDocPath', () => {
  it('بالشكل الذي تفحصه السياسة', () => {
    const tx = '42e52cd3-9f99-4038-8979-d9754adfdff6'
    const id = '0b9c0d5e-1111-4222-8333-444455556666'
    const path = financeDocPath(tx, id, 'image/jpeg')
    expect(path).toBe(`transactions/${tx}/${id}.jpg`)
    expect(path).toMatch(/^transactions\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/)
  })
})

describe('formatDocSize', () => {
  it('ك.ب تحت الميغا، وم.ب فوقها', () => {
    expect(formatDocSize(850 * 1024)).toBe('850 ك.ب')
    expect(formatDocSize(2.4 * MB)).toBe('2.4 م.ب')
    expect(formatDocSize(10)).toBe('1 ك.ب')
  })
})
