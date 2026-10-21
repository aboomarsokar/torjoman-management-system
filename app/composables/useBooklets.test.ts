import { describe, expect, it } from 'vitest'
import { deliveryError, type DeliveryDraft } from './useBooklets'

const ok: DeliveryDraft = { halaqaId: 'h1', booklet: 1, copies: '12', deliveredOn: '2026-10-21', note: '' }
const today = '2026-10-21'

describe('التحقّق من تسليم الملازم', () => {
  it('السليم', () => {
    expect(deliveryError(ok, today)).toBeNull()
  })

  it('الحلقةُ والملزمة', () => {
    expect(deliveryError({ ...ok, halaqaId: undefined }, today)).toBe('اختر الحلقة.')
    expect(deliveryError({ ...ok, booklet: undefined }, today)).toBe('اختر الملزمة.')
    expect(deliveryError({ ...ok, booklet: 16 }, today)).toBe('اختر الملزمة.')
  })

  it('عددُ النسخ', () => {
    expect(deliveryError({ ...ok, copies: '0' }, today)).toMatch('أكبر من صفر')
    expect(deliveryError({ ...ok, copies: '2.5' }, today)).toMatch('أكبر من صفر')
    expect(deliveryError({ ...ok, copies: '' }, today)).toMatch('أكبر من صفر')
    expect(deliveryError({ ...ok, copies: '1001' }, today)).toBe('عدد النسخ لا يتجاوز 1000.')
  })

  it('التاريخُ والملاحظة', () => {
    expect(deliveryError({ ...ok, deliveredOn: '' }, today)).toBe('اختر تاريخ التسليم.')
    expect(deliveryError({ ...ok, deliveredOn: '2026-10-22' }, today)).toBe('تاريخ التسليم لا يكون في المستقبل.')
    expect(deliveryError({ ...ok, note: 'x'.repeat(301) }, today)).toMatch('300')
  })
})
