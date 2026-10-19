/**
 * درجة الطالب بعد إلغاء النقاط — أكاديمي 75% وانتظام 25% (قرار 2026-10-19).
 */
import { describe, expect, it } from 'vitest'
import { computeHalqaAchievement, computeStudentGrade, GRADE_WEIGHTS } from './useGrades'

const cfg = { target: 30, attendanceDays: 20 }

describe('computeStudentGrade', () => {
  it('الكامل 100: الهدف محقّق والمراجعة كاملة وبلا غياب', () => {
    expect(computeStudentGrade({ memoPages: 30, reviewPages: 30, absenceUnexcused: 0 }, cfg).total).toBe(100)
  })
  it('الأوزان 75/25 بلا نقاط', () => {
    expect(GRADE_WEIGHTS.academic + GRADE_WEIGHTS.regularity).toBe(1)
    // حفظ 15/30 = 50%، مراجعة 15/15 = 100% ← أكاديمي 75؛ غياب 5 من 20 ← انتظام 75
    const g = computeStudentGrade({ memoPages: 15, reviewPages: 15, absenceUnexcused: 5 }, cfg)
    expect(g.academic).toBe(75) // (0.5 + 1) / 2
    expect(g.regularity).toBe(75) // (20 − 5) / 20
    expect(g.total).toBe(75)
    expect(g).not.toHaveProperty('points')
  })
  it('الحضور الكامل وحده = 25', () => {
    expect(computeStudentGrade({ memoPages: 0, reviewPages: 0, absenceUnexcused: 0 }, cfg).total).toBe(25)
  })
})

describe('computeHalqaAchievement', () => {
  it('متوسط الطلاب × 0.8 + الأنشطة × 0.2', () => {
    expect(computeHalqaAchievement([100, 50], 100)).toBe(80)
  })
})
