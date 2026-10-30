/**
 * ملخّصُ يوم الحلقة: الحضورُ هو الأصل والغياباتُ استثناءاتٌ تُطرح منه.
 */
import { describe, expect, it } from 'vitest'
import { absenceDiff, parseOffDayRow, saveWouldRemoveReport, summarizeDay } from './useAttendanceDay'

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

describe('parseOffDayRow — بلاغُ اليوم من القاعدة', () => {
  const row = {
    id: 'o1',
    reason: 'teacher_sick',
    note: 'حرارة',
    status: 'pending',
    review_note: null,
    reported_at: '2026-10-29T06:00:00Z',
    reporter: { full_name: 'أحمد' }
  }

  it('يحوّل الصفَّ ويحمل اسم المبلِّغ ووقتَ البلاغ', () => {
    expect(parseOffDayRow(row)).toEqual({
      id: 'o1', reason: 'teacher_sick', note: 'حرارة', status: 'pending', reviewNote: null,
      reporterName: 'أحمد', reportedAt: '2026-10-29T06:00:00Z'
    })
  })

  it('مبلِّغٌ غير مقروء ← اسمٌ فارغ لا سقوط', () => {
    expect(parseOffDayRow({ ...row, reporter: null })?.reporterName).toBeNull()
  })

  it('لا صفَّ ← لا بلاغ', () => {
    expect(parseOffDayRow(null)).toBeNull()
    expect(parseOffDayRow(undefined)).toBeNull()
  })

  it('حالةٌ أو سببٌ لا يعرفه التطبيق ← لا يُعرض نصفُ بلاغ', () => {
    expect(parseOffDayRow({ ...row, status: 'cancelled' })).toBeNull()
    expect(parseOffDayRow({ ...row, reason: 'holiday' })).toBeNull()
  })

  it('يحفظ سببَ الرفض للعرض', () => {
    expect(parseOffDayRow({ ...row, status: 'rejected', review_note: 'الحلقة انعقدت' })?.reviewNote).toBe('الحلقة انعقدت')
  })
})

describe('saveWouldRemoveReport — تنبيهُ ما قبل «حفظ الحضور»', () => {
  it('المعلّقُ والمرفوضُ يُمحيان، والمعتمَدُ وغيابُ البلاغ لا', () => {
    expect(saveWouldRemoveReport({ status: 'pending' })).toBe(true)
    expect(saveWouldRemoveReport({ status: 'rejected' })).toBe(true)
    expect(saveWouldRemoveReport({ status: 'approved' })).toBe(false)
    expect(saveWouldRemoveReport(null)).toBe(false)
  })
})
