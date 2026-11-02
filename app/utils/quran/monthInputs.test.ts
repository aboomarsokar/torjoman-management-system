/** تخفيضُ الاختبار من نتائج الشهر — أكبرُه لكلّ طالب بعدد أجزاء الدورة. */
import { describe, expect, it } from 'vitest'
import { examReliefs } from './monthInputs'

const exam = (student_id: string, from: number, to: number) => ({ student_id, item: { cycle: { parts_from: from, parts_to: to } } })

describe('examReliefs', () => {
  it('3 أجزاء ثلث، 5 ثلثان، 10 كامل — وأكبرُها لمن اختُبر مرّتين', () => {
    expect(examReliefs([exam('a', 28, 30), exam('b', 26, 30), exam('c', 21, 30), exam('a', 26, 30)]))
      .toEqual({ a: 2, b: 2, c: 3 })
  })
  it('دورةٌ مجهولة أو بلا تخفيض لا تُحسب', () => {
    expect(examReliefs([{ student_id: 'a', item: null }, exam('b', 1, 2)])).toEqual({})
  })
})
