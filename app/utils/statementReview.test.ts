import { describe, expect, it } from 'vitest'
import { bulkReviewText, reviewableIds, statementLeft } from './statementReview'

describe('reviewableIds', () => {
  it('المحدَّدُ المُرسَلُ وحده', () => {
    const rows = [{ id: 'a', status: 'submitted' }, { id: 'b', status: 'draft' }, { id: 'c', status: 'reviewed' }, { id: 'd', status: 'submitted' }]
    expect(reviewableIds(rows, ['a', 'b', 'c'])).toEqual(['a'])
  })
})

describe('bulkReviewText', () => {
  it('يجمع الفائضَ ولا يطرح التجاوز', () => {
    expect(bulkReviewText([{ received: 150, carried: 0, spent: 110 }, { received: 150, carried: 0, spent: 175 }]))
      .toBe('تأكيدُ الاطّلاع على كشفين؟ يُرحَّل منها 40 شيكل إلى الشهر التالي.')
  })
  it('بلا فائض', () => {
    expect(bulkReviewText([{ received: 150, carried: 0, spent: 150 }])).toBe('تأكيدُ الاطّلاع على كشفٍ واحد؟ لا فائضَ فيها يُرحَّل.')
  })
  it('المتبقّي', () => {
    expect(statementLeft({ received: 150, carried: 40, spent: 40 })).toBe(150)
  })
})
