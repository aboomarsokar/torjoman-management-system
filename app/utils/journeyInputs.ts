/**
 * مدخلات رحلة الطالب من دالّتَي القراءة الخاصّتين بالطالب (`my_exam_cycle_results` و`my_approved_pages`)
 * — فهو لا يمرّ من تضمينات `exam_list_item` و`report` (سياساتها لا يجتازها الطالب).
 */
import type { Database } from '~/types/database.types'
import type { CycleResultInput } from '~/utils/journey'

type MyCycleResultRow = Database['public']['Functions']['my_exam_cycle_results']['Returns'][number]

/**
 * صفوف `my_exam_cycle_results()` (كلُّ المحاولات) ← مدخلات `buildJourney` (الدورة، النجاح، الدرجة).
 * الاختيارُ لكلّ دورةٍ في `buildJourney`: الاجتيازُ لا يُلغيه رسوبٌ لاحق.
 */
export function toCycleResults(rows: MyCycleResultRow[] | null | undefined): CycleResultInput[] {
  return (rows ?? []).map(r => ({ exam_cycle_id: r.exam_cycle_id ?? null, passed: r.passed, total_score: r.total_score }))
}

/** ناتج `my_approved_pages()` (bigint قد يصل نصّاً أو فارغاً) ← عددٌ صحيح غير سالب. */
export function toApprovedPages(value: number | string | null | undefined): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}
