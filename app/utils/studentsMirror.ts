/**
 * طلابُ المعلّم بلا إنترنت (البند 14، 2026-10-27): نسخةٌ على الجهاز لطلاب حلقته بصفوفهم كاملة (كلُّ الحالات)،
 * وترشيحُها، وحضورُ الطالب في الشهر من نسخة الحضور وما ينتظر الرفعَ في صندوقه. دوالُّ نقيّةٌ مختبَرة.
 */
import type { Database } from '~/types/database.types'
import type { Absences } from '~/utils/attendanceOutbox'
import { arabicFold } from '~/utils/arabicSearch'

export type MirrorStudentRow = Database['public']['Tables']['students']['Row']
type StudentStatus = Database['public']['Enums']['student_status']

export interface StudentsMirror {
  uid: string
  halaqa: { id: string, name: string, daily_time: string | null } | null
  students: MirrorStudentRow[]
  syncedAt: string
}

export const studentsMirrorKey = (uid: string) => `students|${uid}`

/** الطلابُ بالحالة (أو كلُّها) والاسمِ أو الهوية بمطابقةٍ عربيةٍ متسامحة. */
export function filterStudents(rows: MirrorStudentRow[], status: StudentStatus | 'all', query: string): MirrorStudentRow[] {
  const needle = arabicFold(query.trim())
  return rows.filter(s => (status === 'all' || s.status === status)
    && (!needle || arabicFold(s.full_name).includes(needle) || (s.national_id ?? '').includes(query.trim())))
}

/**
 * حضورُ الطالب في شهرٍ (`YYYY-MM`): أيامُ الحلقة المسجَّلة منذ التحاقه وغيابُه فيها — من نسخة الحضور، وما ينتظر
 * الرفعَ يغلبها في يومه.
 */
export function studentMonthAttendance(input: {
  studentId: string
  enrollmentDate: string | null
  month: string
  days: Record<string, { held: boolean, absences: Absences }>
  queued: { day: string, absences: Absences }[]
}): { held: number, absent: number } {
  const merged = { ...input.days }
  for (const q of input.queued) merged[q.day] = { held: true, absences: q.absences }
  let held = 0
  let absent = 0
  for (const [day, d] of Object.entries(merged)) {
    if (!d.held || !day.startsWith(input.month) || (input.enrollmentDate && day < input.enrollmentDate)) continue
    held++
    if (d.absences[input.studentId]) absent++
  }
  return { held, absent }
}
