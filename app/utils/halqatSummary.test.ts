import { describe, expect, it } from 'vitest'
import { halqatSummary } from './halqatSummary'

describe('halqatSummary', () => {
  it('العددُ والنشطُ والطلابُ والمتوسّطُ والفئتان', () => {
    expect(halqatSummary([
      { status: 'active', classification: 'a', student_count: [{ count: 6 }] },
      { status: 'active', classification: 'b', student_count: [{ count: 5 }] },
      { status: 'stopped', classification: 'a', student_count: [] }
    ])).toEqual({ halqat: 3, active: 2, students: 11, perHalaqa: 3.7, classA: 2, classB: 1 })
  })

  it('بلا حلقاتٍ لا قسمةَ على صفر', () => {
    expect(halqatSummary([])).toEqual({ halqat: 0, active: 0, students: 0, perHalaqa: 0, classA: 0, classB: 0 })
  })
})
