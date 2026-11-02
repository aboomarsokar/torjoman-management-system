/**
 * «التقرير الشهري» للحلقة (طلب المستخدم 2026-11-02): ما يُضاف إلى صفوف الإنجاز القرآني — اختباراتُ الشهر وترشيحاتُه،
 * واختبارُ القراءة، والزيارات، وسجلُّ الجودة — وخلاصاتٌ نقيّةٌ مختبَرة للحضور والاختبارات. القراءةُ بصلاحيات القارئ (RLS).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import type { StudentMonthRow } from '~/utils/quran/month'
import { monthRange } from '~/utils/quran/monthHistory'
import { fetchMonthVisits, type HalaqaVisits } from '~/utils/monthVisits'

/** طالبٌ يُعدّ «الأكثر غياباً» إن غاب بلا عذرٍ هذا العددَ من الأيام فأكثر. */
export const FREQUENT_ABSENCE_DAYS = 3

export interface ExamItem { studentId: string, label: string, passed: boolean | null, score: number | null, day: string }
export interface ReadingItem { studentId: string, unit: string, passed: boolean | null, percent: number | null }
export interface QualityRow { final: number | null, quality: number | null, achievement: number | null, locked_at: string | null }

export interface MonthlyExtras {
  exams: ExamItem[]
  nominated: number
  reading: ReadingItem[]
  visits: HalaqaVisits | undefined
  quality: QualityRow | null
}

type ExamRow = { student_id: string, passed: boolean | null, total_score: number | null, exam_date: string, item: { cycle: { surahs_label: string, parts_from: number, parts_to: number } | null } | null }
type ReadingRow = { student_id: string, passed: boolean | null, percent: number | null, unit: { title: string } | null }

/** يقرأ إضافاتِ التقرير لحلقةٍ وشهر — يرمي أوّلَ خطأ. */
export async function fetchMonthlyExtras(supabase: SupabaseClient<Database>, hid: string, y: number, m: number, studentIds: string[]): Promise<MonthlyExtras> {
  const range = monthRange(y, m)
  const ids = studentIds.length ? studentIds : ['00000000-0000-0000-0000-000000000000']
  const [exams, lists, reading, visits, quality] = await Promise.all([
    supabase.from('exam_results')
      .select('student_id, passed, total_score, exam_date, item:exam_list_items!exam_results_exam_list_item_id_fkey(cycle:exam_cycles!exam_list_items_exam_cycle_id_fkey(surahs_label, parts_from, parts_to))')
      .in('student_id', ids).gte('exam_date', range.from).lte('exam_date', range.to).order('exam_date'),
    supabase.from('exam_lists').select('id, items:exam_list_items!exam_list_items_exam_list_id_fkey(id)')
      .eq('halaqa_id', hid).eq('is_legacy', false).gte('week_date', range.from).lte('week_date', range.to),
    supabase.from('reading_attempts')
      .select('student_id, passed, percent, unit:reading_units!reading_attempts_unit_id_fkey(title)')
      .in('student_id', ids).not('submitted_at', 'is', null)
      .gte('submitted_at', `${range.from}T00:00:00+02:00`).lte('submitted_at', `${range.to}T23:59:59+02:00`),
    fetchMonthVisits(supabase, y, m, hid),
    supabase.from('teacher_quality_months').select('final, quality, achievement, locked_at')
      .eq('halaqa_id', hid).eq('year', y).eq('month', m).maybeSingle()
  ])
  const failure = exams.error ?? lists.error ?? reading.error ?? quality.error
  if (failure) throw failure
  return {
    exams: ((exams.data ?? []) as ExamRow[]).map(r => ({
      studentId: r.student_id,
      label: r.item?.cycle ? `${r.item.cycle.parts_to - r.item.cycle.parts_from + 1} أجزاء · ${r.item.cycle.surahs_label}` : 'اختبار',
      passed: r.passed,
      score: r.total_score === null ? null : Number(r.total_score),
      day: r.exam_date
    })),
    nominated: (lists.data ?? []).reduce((s, l) => s + ((l as { items: unknown[] | null }).items?.length ?? 0), 0),
    reading: ((reading.data ?? []) as ReadingRow[]).map(r => ({ studentId: r.student_id, unit: r.unit?.title ?? '—', passed: r.passed, percent: r.percent === null ? null : Number(r.percent) })),
    visits: visits.get(hid),
    quality: quality.data ?? null
  }
}

/** خلاصةُ حضور الحلقة: نسبةُ الحضور الكلّية، والأكثرُ غياباً بلا عذر (الأشدُّ أولاً). */
export function attendanceSummary(rows: Pick<StudentMonthRow, 'studentId' | 'name' | 'daysHeld' | 'daysAttended' | 'daysExcused'>[]) {
  const held = rows.reduce((s, r) => s + r.daysHeld, 0)
  const attended = rows.reduce((s, r) => s + r.daysAttended, 0)
  const frequent = rows
    .map(r => ({ id: r.studentId, name: r.name, unexcused: r.daysHeld - r.daysAttended - (r.daysExcused ?? 0), excused: r.daysExcused ?? 0, held: r.daysHeld }))
    .filter(r => r.unexcused >= FREQUENT_ABSENCE_DAYS)
    .sort((a, b) => b.unexcused - a.unexcused || a.name.localeCompare(b.name, 'ar'))
  return { pct: held ? Math.round((100 * attended) / held) : null, frequent }
}

/** نتائجُ اختبارات الشهر: ناجحٌ ويعيد وبلا حكم. */
export function examSummary(items: ExamItem[]) {
  return {
    total: items.length,
    passed: items.filter(i => i.passed === true).length,
    failed: items.filter(i => i.passed === false).length
  }
}
