/**
 * مدخلاتُ شهرٍ لحلقة من القاعدة — كلُّ ما يحتاجه `buildStudentRows` عدا مراجعَ المصحف: الطلابُ النشطون، ورأسُ الشهر
 * وسجلّاتُه، وسجلّاتُ الشهر نفسه في حلقاتٍ أخرى، وتاريخُ النهايات، وأيامُ الحلقة وغياباتُها، والمطلوبُ الشهريّ.
 * مستخرَجةٌ من `useQuranMonth` (2026-10-27) كي تقرأها الشاشةُ المتّصلة **ونسخةُ الجهاز للعمل بلا إنترنت** بطريقٍ واحد.
 * المدخلاتُ صفوفٌ خامٌ قابلةٌ للحفظ في IndexedDB؛ والصفوفُ تُبنى منها عند العرض.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import type { QuranRecordRow, ReportHeader } from '~/utils/quran/month'
import { HISTORY_MONTHS, latestEnds, monthRange } from '~/utils/quran/monthHistory'
import type { HistoryRow } from '~/utils/quran/monthHistory'
import type { Position } from '~/utils/quran/position'
import { shiftMonth } from '~/utils/reportWindow'

export const REPORT_COLUMNS = 'id, halaqa_id, report_month, report_year, status, return_note, submitted_at, approved_at, target_pages_snapshot'

export type MonthStudent = { id: string, full_name: string, enrollment_date: string | null, quran_parts: number | null }

export interface MonthInputs {
  halaqaId: string
  year: number
  month: number
  report: ReportHeader | null
  students: MonthStudent[]
  records: QuranRecordRow[]
  elsewhereRecords: QuranRecordRow[]
  previousEnds: Record<string, Position | null>
  approvedEnds: Record<string, Position | null>
  days: string[]
  absences: { student_id: string, day: string }[]
  /** المطلوبُ الشهريّ: لقطةُ الرأس إن وُجد، وإلا إعدادُ المشروع. */
  target: number | null
}

/** يقرأ مدخلاتِ الشهر — يرمي أوّلَ خطأ. */
export async function fetchMonthInputs(supabase: SupabaseClient<Database>, hid: string, y: number, m: number): Promise<MonthInputs> {
  const range = monthRange(y, m)
  const [students, reportRes, daysRes, absencesRes, settings] = await Promise.all([
    supabase.from('students').select('id, full_name, enrollment_date, quran_parts')
      .eq('halaqa_id', hid).eq('status', 'active').order('full_name'),
    supabase.from('monthly_reports').select(REPORT_COLUMNS)
      .eq('halaqa_id', hid).eq('report_year', y).eq('report_month', m).maybeSingle(),
    supabase.from('attendance_days').select('day').eq('halaqa_id', hid).gte('day', range.from).lte('day', range.to).order('day'),
    supabase.from('attendance_absences').select('student_id, day').eq('halaqa_id', hid).gte('day', range.from).lte('day', range.to),
    supabase.from('app_settings').select('target_memorization_pages').limit(1).maybeSingle()
  ])
  const failure = students.error ?? reportRes.error ?? daysRes.error ?? absencesRes.error ?? settings.error
  if (failure) throw failure
  const ids = (students.data ?? []).map(s => s.id)

  // استعلامٌ واحد لكلّ جدول: سجلّاتُ الشهر، وتاريخُ نهايات الطلاب، وسجلّاتُ الشهر نفسه في حلقاتٍ أخرى. التاريخُ محدودٌ
  // بآخر HISTORY_MONTHS شهراً قبل الشهر المعروض على مستوى السنة (`latestEnds` يحسم الأدقّ) ومرتّبٌ بالأحدث
  const lowerYear = shiftMonth(y, m, -HISTORY_MONTHS).year
  const [recordsRes, historyRes, elsewhereRes] = ids.length
    ? await Promise.all([
        reportRes.data
          ? supabase.from('quran_records').select('*').eq('report_id', reportRes.data.id).in('student_id', ids)
          : Promise.resolve({ data: [] as QuranRecordRow[], error: null }),
        supabase.from('quran_records')
          .select('student_id, to_surah, to_ayah, report:monthly_reports!inner(report_year, report_month, status)')
          .in('student_id', ids).not('to_surah', 'is', null)
          .gte('report.report_year', lowerYear)
          .order('report(report_year)', { ascending: false })
          .order('report(report_month)', { ascending: false }),
        // طالبٌ نُقل إلى هذه الحلقة وله رصدٌ لهذا الشهر في تقرير حلقةٍ أخرى (بأيّ حالة: القاعدةُ ترفض رصدَه ثانيةً في أيّها)
        supabase.from('quran_records')
          .select('*, report:monthly_reports!inner(halaqa_id, report_year, report_month)')
          .in('student_id', ids)
          .eq('report.report_year', y).eq('report.report_month', m)
          .neq('report.halaqa_id', hid)
      ])
    : [{ data: [] as QuranRecordRow[], error: null }, { data: [], error: null }, { data: [] as QuranRecordRow[], error: null }]
  const failure2 = recordsRes.error ?? historyRes.error ?? elsewhereRes.error
  if (failure2) throw failure2

  const history = (historyRes.data ?? []) as HistoryRow[]
  return {
    halaqaId: hid,
    year: y,
    month: m,
    report: reportRes.data,
    students: students.data ?? [],
    records: (recordsRes.data ?? []) as QuranRecordRow[],
    elsewhereRecords: (elsewhereRes.data ?? []) as QuranRecordRow[],
    previousEnds: latestEnds(history, { year: y, month: m }, false),
    approvedEnds: latestEnds(history, { year: y, month: m + 1 }, true),
    days: (daysRes.data ?? []).map(d => d.day),
    absences: absencesRes.data ?? [],
    target: reportRes.data?.target_pages_snapshot ?? settings.data?.target_memorization_pages ?? null
  }
}
