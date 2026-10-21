/**
 * ملخّصُ يوم الحلقة: الحضورُ هو الأصل والغياباتُ استثناءاتٌ تُطرح منه.
 */
import { describe, expect, it } from 'vitest'
import { absenceDiff, summarizeDay } from './useAttendanceDay'

const students = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}` }))

describe('summarizeDay', () => {
  it('بلا غياباتٍ: الجميع حاضر', () => {
    expect(summarizeDay(students(25), {})).toEqual({ present: 25, excused: 0, unexcused: 0 })
  })

  it('يطرح الغيابَ بنوعيه من الحضور', () => {
    const absences = { s1: 'excused', s2: 'unexcused', s3: 'unexcused' } as const
    expect(summarizeDay(students(25), absences)).toEqual({ present: 22, excused: 1, unexcused: 2 })
  })

  it('لا يعدّ غيابَ مَن ليس في القائمة (طالبٌ خرج من الحلقة بعد تسجيل غيابه)', () => {
    expect(summarizeDay(students(3), { s1: 'excused', gone: 'unexcused' })).toEqual({ present: 2, excused: 1, unexcused: 0 })
  })

  it('قائمةٌ فارغة: أصفار', () => {
    expect(summarizeDay([], { s1: 'excused' })).toEqual({ present: 0, excused: 0, unexcused: 0 })
  })
})

describe('absenceDiff — ما يكتبه «حفظ الحضور»', () => {
  it('مَن صار حاضراً يُحذف غيابُه، ومَن غاب أو تبدّل نوعُه يُكتب، والثابتُ لا يُمسّ', () => {
    const saved = { s1: 'excused', s2: 'unexcused', s3: 'excused' } as const
    const draft = { s2: 'unexcused', s3: 'unexcused', s4: 'excused' } as const
    expect(absenceDiff(saved, draft, ['s1', 's2', 's3', 's4', 's5'])).toEqual({
      remove: ['s1'],
      upsert: [{ student_id: 's3', kind: 'unexcused' }, { student_id: 's4', kind: 'excused' }]
    })
  })

  it('طالبٌ خارج القائمة لا يُمسّ', () => {
    expect(absenceDiff({ gone: 'excused' }, {}, ['s1'])).toEqual({ remove: [], upsert: [] })
  })
})
