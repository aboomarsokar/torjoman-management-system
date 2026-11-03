import { describe, expect, it } from 'vitest'
import { rowAmounts, rowError, type PayrollRow } from './usePayroll'

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
  it('التعديلُ بلا سبب، والمكافأةُ غيرُ الموجبة', () => {
    expect(rowError(row({ adjustment: '20' }))).toBe('اكتب سبب التعديل لـأحمد.')
    expect(rowError(row({ base: '0' }))).toBe('مكافأة أحمد غير صالحة.')
    expect(rowError(row({ adjustment: '20', note: 'نشاط' }))).toBeNull()
  })
})
