import { describe, expect, it } from 'vitest'
import { rewardOf, rowAmounts, rowError, type PayrollRow } from './usePayroll'

const row = (o: Partial<PayrollRow> = {}): PayrollRow => ({ profile_id: 'p', name: 'أحمد', role: 'teacher', gender: 'male', base: '', final: 85, adjustment: '', note: '', ...o })

describe('rowAmounts', () => {
  it('الأساسُ الفارغ = الافتراضيّة، والمعلمُ بتقييمه مرفوعاً إلى 5', () => {
    expect(rowAmounts(row(), 600)).toEqual({ base: 600, suggested: 510, net: 510 })
    expect(rowAmounts(row({ base: '300', final: 91.2 }), 600)).toMatchObject({ suggested: 275 })
  })
  it('المشرفُ مكافأتُه كاملة، والتعديلُ يُضاف', () => {
    expect(rowAmounts(row({ role: 'field_supervisor', final: null, adjustment: '-50', note: 'غياب' }), 600)).toEqual({ base: 600, suggested: 600, net: 550 })
  })
  it('معلمٌ بلا تقييمٍ مقفل ← بلا مبلغ', () => {
    expect(rowAmounts(row({ final: null }), 600).net).toBeNull()
  })
})

describe('rowError', () => {
  it('الحقلُ الرقميّ يعيد رقماً — لا ينكسر التحقّق', () => {
    expect(rowError(row({ base: 300, adjustment: 0 }))).toBeNull()
    expect(rowError(row({ base: 300, adjustment: 15 }))).toBe('اكتب سبب التعديل لـأحمد.')
  })
  it('التعديلُ بلا سبب، والمكافأةُ غيرُ الموجبة', () => {
    expect(rowError(row({ adjustment: '20' }))).toBe('اكتب سبب التعديل لـأحمد.')
    expect(rowError(row({ base: '0' }))).toBe('مكافأة أحمد غير صالحة.')
    expect(rowError(row({ adjustment: '20', note: 'نشاط' }))).toBeNull()
  })
})

describe('نظامُ المسارين (من 11/2026)', () => {
  const reward = { track: 1 as const, quota: 12, full: 600, held_days: 20, no_attendance: false, counted: 8, missing: 4, consecutive: false, rate: 30, deduction: 120, base: 480 }
  it('أصلُ المعلم من لقطة المسار لا من الحقل', () => {
    expect(rowAmounts(row({ trackBased: true, reward, base: '900', final: 90 }), 600)).toEqual({ base: 480, suggested: 435, net: 435 })
  })
  it('بلا لقطةٍ مقفلة لا محسوب، ويبقى التعديلُ وحده', () => {
    expect(rowAmounts(row({ trackBased: true, reward: null }), 600).suggested).toBeNull()
    expect(rowAmounts(row({ trackBased: true, reward: null, adjustment: '50', note: 'x' }), 600).net).toBe(50)
  })
  it('لا يُحكم على حقل الأصل بالصلاحية', () => {
    expect(rowError(row({ trackBased: true, base: '0' }))).toBeNull()
  })
  it('rewardOf يقرأ اللقطة أو يعيد null', () => {
    expect(rewardOf({ reward })).toEqual(reward)
    expect(rewardOf({ reward: null })).toBeNull()
    expect(rewardOf(null)).toBeNull()
  })
})
