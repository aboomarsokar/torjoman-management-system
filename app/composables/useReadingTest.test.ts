import { describe, expect, it } from 'vitest'
import { formatClock, secondsLeft, toAnswerPayload, unansweredCount } from './useReadingTest'

describe('اختبار القراءة — الحساب', () => {
  it('الثواني الباقية تُقرَّب إلى الأعلى ولا تنزل تحت الصفر', () => {
    const now = Date.parse('2026-10-21T09:00:00Z')
    expect(secondsLeft('2026-10-21T09:20:00Z', now)).toBe(1200)
    expect(secondsLeft('2026-10-21T09:00:00.400Z', now)).toBe(1)
    expect(secondsLeft('2026-10-21T08:59:00Z', now)).toBe(0)
  })

  it('الساعة MM:SS', () => {
    expect(formatClock(1200)).toBe('20:00')
    expect(formatClock(65)).toBe('01:05')
    expect(formatClock(0)).toBe('00:00')
  })

  it('غيرُ المُجاب: الخيار 0 إجابةٌ لا فراغ', () => {
    const qs = [{ id: 1, body: 'أ', options: [] }, { id: 2, body: 'ب', options: [] }, { id: 3, body: 'ج', options: [] }]
    expect(unansweredCount(qs, { 1: 0, 3: 2 })).toBe(1)
  })

  it('الإجابات بشكل الدالّة: مفاتيحُ ونصوص', () => {
    expect(toAnswerPayload({ 12: 0, 40: 3 })).toEqual({ 12: '0', 40: '3' })
  })
})
