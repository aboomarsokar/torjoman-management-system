import { describe, expect, it } from 'vitest'
import { stockDraftError, type StockDraft } from './useBookletStock'

const base: StockDraft = { booklet: 1, action: 'supply', copies: '100', alertAt: '20', note: '' }

describe('stockDraftError', () => {
  it('التوريدُ أكبر من صفر', () => {
    expect(stockDraftError(base)).toBeNull()
    expect(stockDraftError({ ...base, copies: '0' })).toBe('عدد النسخ الواردة رقمٌ صحيحٌ أكبر من صفر.')
  })
  it('الجردُ يقبل الصفر ويطلب حدّاً صحيحاً', () => {
    expect(stockDraftError({ ...base, action: 'count', copies: '0' })).toBeNull()
    expect(stockDraftError({ ...base, action: 'count', copies: '-1' })).toBe('العدد الفعليّ رقمٌ صحيحٌ (صفرٌ أو أكثر).')
    expect(stockDraftError({ ...base, action: 'count', alertAt: 'x' })).toBe('حدّ التنبيه رقمٌ صحيحٌ (صفرٌ أو أكثر).')
  })
  it('الملاحظةُ محدودة', () => {
    expect(stockDraftError({ ...base, note: 'ن'.repeat(301) })).toBe('الملاحظة لا تتجاوز 300 حرف.')
  })
})
