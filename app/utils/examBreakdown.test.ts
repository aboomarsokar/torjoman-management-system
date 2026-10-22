import { describe, expect, it } from 'vitest'
import { branchTotals, examBreakdown, type ScoreRow } from './examBreakdown'

const row: ScoreRow = {
  q1_memorization: 10, q1_understanding: 8, q1_reflection: 7,
  q2_memorization: 9, q2_understanding: 6, q2_reflection: 5,
  q3_memorization: 10, q3_understanding: 7, q3_reflection: 6,
  tajweed_score: 8
}

describe('examBreakdown', () => {
  it('كلُّ سؤالٍ بفروعه ومجموعه من 30، والتجويد، والمجموعُ الكلّيّ', () => {
    const b = examBreakdown(row)
    expect(b.questions.map(q => q.sum)).toEqual([25, 20, 23])
    expect(b.questions[0]!.branches.map(x => x.label)).toEqual(['الحفظ', 'الفهم', 'التدبّر'])
    expect(b.tajweed).toBe(8)
    expect(b.total).toBe(76)
  })
})

describe('branchTotals', () => {
  it('مجموعُ كلّ فرعٍ عبر الأسئلة من 30', () => {
    expect(branchTotals(row).map(b => [b.label, b.score, b.max])).toEqual([['الحفظ', 29, 30], ['الفهم', 21, 30], ['التدبّر', 18, 30]])
  })
})
