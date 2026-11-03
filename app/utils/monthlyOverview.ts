/**
 * جدولُ «التقرير الشهري» العامّ لكلّ الحلقات (طلب المستخدم 2026-11-02): سطرٌ لكلّ حلقة — الحضور، ودرجاتُ الإنجاز وإنجازُ
 * المعلم (أعلى 12)، واختباراتُ الشهر، واختبارُ القراءة، والزيارات، وحالُ الرصد. الإنجازُ من `halaqat_achievement` (المصدرُ
 * الواحد)، والباقي بطلباتٍ مجمّعة بنطاق القارئ (RLS). الحضورُ نسبةُ أيام الطلاب الحاضرين من أيام الحلقة × طلابها.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import { achievementPct, type AchievementRow } from '~/utils/halaqatAchievement'
import { fetchMonthVisits, type HalaqaVisits } from '~/utils/monthVisits'
import { monthRange } from '~/utils/quran/monthHistory'
import { matchesSearch } from '~/utils/search'

export interface OverviewRow extends AchievementRow {
  attendancePct: number | null
  teacherPct: number | null
  exams: { total: number, passed: number }
  reading: { total: number, passed: number }
  visits: HalaqaVisits | undefined
}

type Tally = { total: number, passed: number }
const tally = (map: Map<string, Tally>, hid: string | null | undefined, passed: boolean | null) => {
  if (!hid) return
  const t = map.get(hid) ?? { total: 0, passed: 0 }
  t.total++
  if (passed) t.passed++
  map.set(hid, t)
}

/** نسبةُ الحضور: 1 − الغيابات ÷ (أيام الحلقة × طلابها)؛ null بلا أيامٍ أو طلاب. */
export function attendancePct(days: number, students: number, absences: number): number | null {
  const slots = days * students
  return slots > 0 ? Math.max(0, Math.round(100 * (1 - absences / slots))) : null
}

/** يجمع سطورَ الحلقات لشهرٍ — يرمي أوّلَ خطأ. */
export async function fetchMonthlyOverview(supabase: SupabaseClient<Database>, y: number, m: number): Promise<OverviewRow[]> {
  const range = monthRange(y, m)
  const [ach, days, absences, exams, reading, visits] = await Promise.all([
    supabase.rpc('halaqat_achievement', { p_year: y, p_month: m }),
    supabase.from('attendance_days').select('halaqa_id').gte('day', range.from).lte('day', range.to),
    supabase.from('attendance_absences').select('halaqa_id').gte('day', range.from).lte('day', range.to),
    supabase.from('exam_results').select('passed, student:students!exam_results_student_id_fkey(halaqa_id)')
      .gte('exam_date', range.from).lte('exam_date', range.to),
    supabase.from('reading_attempts').select('passed, student:students!reading_attempts_student_id_fkey(halaqa_id)')
      .not('submitted_at', 'is', null)
      .gte('submitted_at', `${range.from}T00:00:00+02:00`).lte('submitted_at', `${range.to}T23:59:59+02:00`),
    fetchMonthVisits(supabase, y, m)
  ])
  const failure = ach.error ?? days.error ?? absences.error ?? exams.error ?? reading.error
  if (failure) throw failure

  const count = (rows: { halaqa_id: string }[] | null) => {
    const out = new Map<string, number>()
    for (const r of rows ?? []) out.set(r.halaqa_id, (out.get(r.halaqa_id) ?? 0) + 1)
    return out
  }
  const dayCount = count(days.data)
  const absCount = count(absences.data)
  const examBy = new Map<string, Tally>()
  for (const e of (exams.data ?? []) as { passed: boolean | null, student: { halaqa_id: string | null } | null }[]) tally(examBy, e.student?.halaqa_id, e.passed)
  const readingBy = new Map<string, Tally>()
  for (const r of (reading.data ?? []) as { passed: boolean | null, student: { halaqa_id: string | null } | null }[]) tally(readingBy, r.student?.halaqa_id, r.passed)

  return ((ach.data ?? []) as AchievementRow[]).map(r => ({
    ...r,
    attendancePct: attendancePct(dayCount.get(r.halaqa_id) ?? 0, r.students, absCount.get(r.halaqa_id) ?? 0),
    teacherPct: achievementPct(r),
    exams: examBy.get(r.halaqa_id) ?? { total: 0, passed: 0 },
    reading: readingBy.get(r.halaqa_id) ?? { total: 0, passed: 0 },
    visits: visits.get(r.halaqa_id)
  }))
}

/** «الكل» في فلترَي الحالة والجنس. */
export const OVERVIEW_ALL = 'all'

export interface OverviewFilter {
  /** اسمُ المعلم أو الحلقة (بحثٌ متسامح). */
  query: string
  /** حالةُ التقرير (`none` لم يبدأ) أو «الكل». */
  status: string
  /** `male` / `female` أو «الكل». */
  gender: string
}

/** سطورُ الجدول العامّ بعد البحث والفلترين (طلب المستخدم 2026-11-03). */
export function filterOverview(rows: OverviewRow[], f: OverviewFilter): OverviewRow[] {
  return rows.filter(r => (f.status === OVERVIEW_ALL || (r.report_status ?? 'none') === f.status)
    && (f.gender === OVERVIEW_ALL || r.gender === f.gender)
    && matchesSearch(f.query, r.teacher_name, r.halaqa_name))
}

/** أعمدةُ الترتيب في الجدول العامّ. */
export type OverviewSortKey = 'name' | 'students' | 'attendance' | 'teacher' | 'visits'

/** يرتّب السطور بعمودٍ واتجاه؛ ما لا قيمةَ له (null) في الآخر دائماً، والتعادلُ بالاسم. */
export function sortOverview(rows: OverviewRow[], key: OverviewSortKey, dir: 'asc' | 'desc'): OverviewRow[] {
  const value = (r: OverviewRow): number | string | null => {
    switch (key) {
      case 'students': return r.students
      case 'attendance': return r.attendancePct
      case 'teacher': return r.teacherPct
      case 'visits': return r.visits?.done.length ?? 0
      default: return r.halaqa_name
    }
  }
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const va = value(a)
    const vb = value(b)
    if (va === null || vb === null) return va === vb ? a.halaqa_name.localeCompare(b.halaqa_name, 'ar') : va === null ? 1 : -1
    const c = typeof va === 'string' ? va.localeCompare(String(vb), 'ar') : va - (vb as number)
    return c * sign || a.halaqa_name.localeCompare(b.halaqa_name, 'ar')
  })
}

/** خلاصةُ ما ظهر: الحلقات والطلاب، ومتوسّطا الحضور وإنجاز المعلم (لما له قيمة)، وحالاتُ التقارير. */
export function overviewSummary(rows: OverviewRow[]) {
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null)
    return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null
  }
  const status = (k: string) => rows.filter(r => (r.report_status ?? 'none') === k).length
  return {
    halqat: rows.length,
    students: rows.reduce((s, r) => s + r.students, 0),
    attendance: avg(rows.map(r => r.attendancePct)),
    teacher: avg(rows.map(r => r.teacherPct)),
    approved: status('approved'),
    submitted: status('submitted'),
    pending: status('draft') + status('none')
  }
}
