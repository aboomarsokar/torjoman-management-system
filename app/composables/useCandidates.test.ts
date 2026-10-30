import { describe, expect, it } from 'vitest'
import { evaluationError } from './useCandidates'

describe('تقييم المرشح', () => {
  it('يقبل عشر درجات صحيحة', () => {
    expect(evaluationError([5, 4, 3, 2, 1, 0, 5, 5, 5, 5], '')).toBeNull()
  })
  it('يرفض النقص والقيم الخارجة', () => {
    expect(evaluationError([5, 4, 3, null, 1, 0, 5, 5, 5, 5], '')).toBe('قيّم البنود كلّها.')
    expect(evaluationError([5, 4, 3], '')).toBe('قيّم البنود كلّها.')
    expect(evaluationError([6, 4, 3, 2, 1, 0, 5, 5, 5, 5], '')).toBe('كلُّ بندٍ من 0 إلى 5.')
    expect(evaluationError(Array(10).fill(3), 'x'.repeat(1001))).toBe('الملاحظة لا تتجاوز 1000 حرف.')
  })
})
