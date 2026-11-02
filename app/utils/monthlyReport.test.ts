import { describe, expect, it } from 'vitest'
import { attendanceSummary, examSummary } from './monthlyReport'

const r = (id: string, held: number, attended: number, excused = 0) => ({ studentId: id, name: id, daysHeld: held, daysAttended: attended, daysExcused: excused })

describe('attendanceSummary', () => {
  it('نسبةُ الحضور الكلّية والأكثرُ غياباً بلا عذر (3 أيام فأكثر) الأشدُّ أولاً', () => {
    const s = attendanceSummary([r('أ', 20, 18), r('ب', 20, 12, 2), r('ج', 20, 10, 8), r('د', 20, 15)])
    expect(s.pct).toBe(69)
    expect(s.frequent.map(f => [f.id, f.unexcused])).toEqual([['ب', 6], ['د', 5]])
  })
  it('بلا أيام ← null', () => {
    expect(attendanceSummary([r('أ', 0, 0)]).pct).toBeNull()
  })
})

describe('examSummary', () => {
  it('ناجحٌ ويعيد', () => {
    expect(examSummary([
      { studentId: 'a', label: '', passed: true, score: 90, day: '' },
      { studentId: 'b', label: '', passed: false, score: 60, day: '' },
      { studentId: 'c', label: '', passed: null, score: null, day: '' }
    ])).toEqual({ total: 3, passed: 1, failed: 1 })
  })
})
