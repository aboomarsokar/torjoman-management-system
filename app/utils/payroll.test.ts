import { describe, expect, it } from 'vitest'
import { ceilTo5, netSalary, suggestedSalary } from './payroll'

describe('ceilTo5 — يُرفع ولا يُنقص', () => {
  it('أقربُ 5 أعلى', () => {
    expect(ceilTo5(501)).toBe(505)
    expect(ceilTo5(505)).toBe(505)
    expect(ceilTo5(506)).toBe(510)
    expect(ceilTo5(502.2)).toBe(505)
    expect(ceilTo5(600)).toBe(600)
  })
})

describe('suggestedSalary', () => {
  it('المعلم: المكافأة × التقييم ÷ 100 مرفوعاً', () => {
    expect(suggestedSalary('teacher', 600, 85)).toBe(510)
    expect(suggestedSalary('teacher', 600, 85.5)).toBe(515)
    expect(suggestedSalary('teacher', 300, 91.2)).toBe(275)
  })
  it('المعلم بلا تقييمٍ مقفل ← null', () => {
    expect(suggestedSalary('teacher', 600, null)).toBeNull()
  })
  it('المشرفُ والمختبِر: المكافأةُ كاملة', () => {
    expect(suggestedSalary('field_supervisor', 600, null)).toBe(600)
    expect(suggestedSalary('examiner', 550, 40)).toBe(550)
  })
})

describe('netSalary', () => {
  it('المحسوب + التعديل، ولا يقلّ عن صفر', () => {
    expect(netSalary(510, -10)).toBe(500)
    expect(netSalary(510, 0)).toBe(510)
    expect(netSalary(null, 0)).toBeNull()
    expect(netSalary(null, 200)).toBe(200)
    expect(netSalary(100, -300)).toBe(0)
  })
})
