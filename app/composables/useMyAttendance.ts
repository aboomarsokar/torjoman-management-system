import type { Database } from '~/types/database.types'
import { monthRange } from '~/utils/quran/monthHistory'
import { countAttendance } from '~/utils/quran/attendanceCount'
import type { AttendanceCount } from '~/utils/quran/attendanceCount'
import { gazaToday, periodLabel } from '~/utils/reportWindow'

/**
 * حضورُ الطالب نفسِه في الشهر الجاري (بتوقيت غزة): أيامُ حلقته من `attendance_days` وغياباتُه
 * من `attendance_absences` — كلاهما مقروءٌ له بالسياسات. «حضر a من b» حيث b أيامُ الحلقة المنعقدة
 * منذ التحاقه. جلبٌ غير حاجز على العميل؛ `null` ما دام لم يصل أو تعذّر.
 */
export interface MyAttendance extends AttendanceCount {
  /** تسميةُ الشهر بالأرقام `MM-YYYY`. */
  label: string
}

/** أيامُ الحلقة وغياباتُ الطالب ← الملخّص؛ نقيٌّ ومختبَر. */
export function summarizeMyMonth(
  year: number,
  month: number,
  days: string[],
  absentDays: string[],
  enrollmentDate: string | null
): MyAttendance {
  return { label: periodLabel(year, month), ...countAttendance(days, new Set(absentDays), enrollmentDate) }
}

export function useMyAttendance(source: () => { studentId: string, halaqaId: string | null, enrollmentDate: string | null } | null) {
  const supabase = useSupabaseClient<Database>()
  const { data, pending } = useLazyAsyncData<MyAttendance | null>('my-attendance-month', async () => {
    const s = source()
    if (!s?.halaqaId) return null
    const [y, m] = gazaToday().split('-').map(Number) as [number, number]
    const range = monthRange(y, m)
    const [daysRes, absRes] = await Promise.all([
      supabase.from('attendance_days').select('day').eq('halaqa_id', s.halaqaId).gte('day', range.from).lte('day', range.to),
      supabase.from('attendance_absences').select('day').eq('student_id', s.studentId).gte('day', range.from).lte('day', range.to)
    ])
    const failure = daysRes.error ?? absRes.error
    if (failure) {
      console.error('[me] فشل جلب حضوري:', failure.message)
      return null
    }
    return summarizeMyMonth(y, m, (daysRes.data ?? []).map(d => d.day), (absRes.data ?? []).map(a => a.day), s.enrollmentDate)
  }, { server: false, default: () => null, watch: [() => source()?.studentId, () => source()?.halaqaId] })
  return { attendance: data, pending }
}
