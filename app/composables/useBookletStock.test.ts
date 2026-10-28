import { describe, expect, it } from 'vitest'
import { stockDateError, stockDraftError, type StockDraft } from './useBookletStock'

const base: StockDraft = { booklet: 1, action: 'supply', copies: '100', alertAt: '20', note: '', movedOn: '2026-10-28' }
const TODAY = '2026-10-28'

describe('stockDraftError', () => {
  it('التوريدُ أكبر من صفر', () => {
    expect(stockDraftError(base, TODAY)).toBeNull()
    expect(stockDraftError({ ...base, copies: '0' }, TODAY)).toBe('عدد النسخ الواردة رقمٌ صحيحٌ أكبر من صفر.')
  })
  it('الجردُ يقبل الصفر ويطلب حدّاً صحيحاً', () => {
    expect(stockDraftError({ ...base, action: 'count', copies: '0' }, TODAY)).toBeNull()
    expect(stockDraftError({ ...base, action: 'count', copies: '-1' }, TODAY)).toBe('العدد الفعليّ رقمٌ صحيحٌ (صفرٌ أو أكثر).')
    expect(stockDraftError({ ...base, action: 'count', alertAt: 'x' }, TODAY)).toBe('حدّ التنبيه رقمٌ صحيحٌ (صفرٌ أو أكثر).')
  })
  it('الملاحظةُ محدودة', () => {
    expect(stockDraftError({ ...base, note: 'ن'.repeat(301) }, TODAY)).toBe('الملاحظة لا تتجاوز 300 حرف.')
  })
})

describe('stockDateError', () => {
  it('لا قبل بداية المشروع ولا في المستقبل', () => {
    expect(stockDateError('2026-10-07', TODAY)).toBeNull()
    expect(stockDateError('2026-09-30', TODAY)).toBe('التاريخ لا يكون قبل بداية المشروع (1/10/2026).')
    expect(stockDateError('2026-10-29', TODAY)).toBe('التاريخ لا يكون في المستقبل.')
    expect(stockDateError('', TODAY)).toBe('اختر التاريخ.')
  })
})
