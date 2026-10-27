import { describe, expect, it } from 'vitest'
import type { Absences } from './attendanceOutbox'
import { filterStudents, studentMonthAttendance, type MirrorStudentRow } from './studentsMirror'

const s = (id: string, full_name: string, status: MirrorStudentRow['status'], national_id: string | null = null) =>
  ({ id, full_name, status, national_id }) as MirrorStudentRow

describe('filterStudents', () => {
  const rows = [s('1', 'أحمد علي', 'active', '400123456'), s('2', 'إبراهيم', 'withdrawn'), s('3', 'بلال', 'active')]
  it('بالحالة', () => {
    expect(filterStudents(rows, 'active', '').map(r => r.id)).toEqual(['1', '3'])
    expect(filterStudents(rows, 'all', '').length).toBe(3)
  })
  it('بالاسم متسامحاً بأشكال الألف، وبالهوية', () => {
    expect(filterStudents(rows, 'all', 'ابراهيم').map(r => r.id)).toEqual(['2'])
    expect(filterStudents(rows, 'all', '4001').map(r => r.id)).toEqual(['1'])
  })
})

describe('studentMonthAttendance', () => {
  const days = {
    '2026-10-01': { held: true, absences: { a: 'unexcused' as const } },
    '2026-10-02': { held: true, absences: {} },
    '2026-10-03': { held: false, absences: {} },
    '2026-09-30': { held: true, absences: { a: 'excused' as const } }
  }
  it('أيامُ الشهر المنعقدة وغيابُه فيها', () => {
    expect(studentMonthAttendance({ studentId: 'a', enrollmentDate: null, month: '2026-10', days, queued: [] })).toEqual({ held: 2, absent: 1 })
  })
  it('منذ التحاقه وحده', () => {
    expect(studentMonthAttendance({ studentId: 'a', enrollmentDate: '2026-10-02', month: '2026-10', days, queued: [] })).toEqual({ held: 1, absent: 0 })
  })
  it('ما ينتظر الرفعَ يغلب يومَه ويُضاف', () => {
    const queued: { day: string, absences: Absences }[] = [{ day: '2026-10-02', absences: { a: 'excused' } }, { day: '2026-10-05', absences: {} }]
    expect(studentMonthAttendance({ studentId: 'a', enrollmentDate: null, month: '2026-10', days, queued })).toEqual({ held: 3, absent: 2 })
  })
})
