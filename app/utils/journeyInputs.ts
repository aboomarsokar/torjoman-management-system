/**
 * مدخلات رحلة الطالب من دالّتَي القراءة الخاصّتين بالطالب (`my_exam_results` و`my_approved_pages`)
 * — فهو لا يمرّ من تضمينات `exam_list_item` و`report` (سياساتها لا يجتازها الطالب).
 */
import type { Database } from '~/types/database.types'
import type { ResultInput } from '~/utils/journey'

type MyExamResultRow = Database['public']['Functions']['my_exam_results']['Returns'][number]

/** صفوف `my_exam_results()` ← مدخلات `buildJourney` (المحطّة، النجاح، الدرجة). */
export function toJourneyResults(rows: MyExamResultRow[] | null | undefined): ResultInput[] {
  return (rows ?? []).map(r => ({ exam_plan_id: r.exam_plan_id ?? null, passed: r.passed, total_score: r.total_score }))
}

/** ناتج `my_approved_pages()` (bigint قد يصل نصّاً أو فارغاً) ← عددٌ صحيح غير سالب. */
export function toApprovedPages(value: number | string | null | undefined): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}
