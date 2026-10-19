/**
 * توثيقُ بنود كشف الحوافز: تاريخٌ داخل شهر الكشف لا يتجاوز اليوم، وبيانٌ واضح، ومبلغٌ موجب.
 */
import { describe, expect, it } from 'vitest'
import { isBlankItem, statementDateBounds, validateStatementItem } from './useIncentiveStatement'

const item = (over: Partial<{ description: string, amount: number | string, item_date: string }> = {}) =>
  ({ description: 'جوائز الحفظ', category: 'جوائز', amount: 50, item_date: '2026-10-12', ...over })

describe('statementDateBounds', () => {
  it('شهرٌ مضى: من أوّله إلى آخره', () => {
    expect(statementDateBounds(2026, 9, '2026-10-19')).toEqual({ min: '2026-09-01', max: '2026-09-30' })
  })
  it('الشهر الجاري: حتى اليوم لا آخر الشهر', () => {
    expect(statementDateBounds(2026, 10, '2026-10-19')).toEqual({ min: '2026-10-01', max: '2026-10-19' })
  })
  it('فبراير الكبيسة', () => {
    expect(statementDateBounds(2028, 2, '2028-05-01').max).toBe('2028-02-29')
  })
})

describe('validateStatementItem', () => {
  const bounds = statementDateBounds(2026, 10, '2026-10-19')

  it('بندٌ كامل صالح', () => {
    expect(validateStatementItem(item(), bounds)).toEqual({})
  })
  it('بيانٌ من حرفٍ واحد لا يوثّق', () => {
    expect(validateStatementItem(item({ description: ' م ' }), bounds).description).toBeTruthy()
  })
  it('مبلغٌ صفرٌ أو سالب يُرفض', () => {
    expect(validateStatementItem(item({ amount: 0 }), bounds).amount).toBeTruthy()
    expect(validateStatementItem(item({ amount: -5 }), bounds).amount).toBeTruthy()
  })
  it('تاريخٌ فارغ، أو خارج الشهر، أو في المستقبل يُرفض', () => {
    expect(validateStatementItem(item({ item_date: '' }), bounds).item_date).toBeTruthy()
    expect(validateStatementItem(item({ item_date: '2026-09-30' }), bounds).item_date).toBeTruthy()
    expect(validateStatementItem(item({ item_date: '2026-10-20' }), bounds).item_date).toBeTruthy()
  })
  it('شهرٌ لم يبدأ: رسالةٌ تقول ذلك', () => {
    const future = statementDateBounds(2026, 11, '2026-10-19')
    expect(validateStatementItem(item({ item_date: '2026-11-02' }), future).item_date).toBe('الشهر لم يبدأ بعد.')
  })
})

describe('isBlankItem', () => {
  it('سطرٌ فارغ يُهمَل', () => {
    expect(isBlankItem(item({ description: '  ', amount: '' }))).toBe(true)
  })
  it('سطرٌ فيه مبلغٌ بلا بيان ليس فارغاً — يُطالَب ببيانه', () => {
    expect(isBlankItem(item({ description: '', amount: 20 }))).toBe(false)
  })
})
