/**
 * جلبُ ما تحتاجه شاشتا المشرف الميداني والمختبِر بلا إنترنت (الدفعة الثالثة — 2026-10-29): تناديه الشاشةُ/المكوّنُ
 * **وتسخينُ النُّسخ** بطريقٍ واحد فلا يتشعّب الاستعلام. كلُّ دالّةٍ ترمي خطأها.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import type { ExamCycleRow } from '~/utils/exams/cycles'
import type { DeductionItem } from '~/utils/visitForm'

type Client = SupabaseClient<Database>

/** مفتاحُ بنود الخصم: مفتاحُ الجلب ومفتاحُ نسختها على الجهاز معاً (البنودُ ثابتةٌ للجلسة). */
export const VISIT_ITEMS_KEY = 'visit-deduction-items'

/** بنودُ خصم نموذج الزيارة بترتيبها — الاستعلامُ نفسُه في `ResultModal`. */
export async function fetchDeductionItems(supabase: Client): Promise<DeductionItem[]> {
  const { data, error } = await supabase.from('visit_deduction_items')
    .select('key, criterion, criterion_label, criterion_hint, label, per_time, sort_order').order('sort_order')
  if (error) throw error
  return data ?? []
}

/** مفتاحُ طابور الرصد: مفتاحُ الجلب ومفتاحُ نسخته على الجهاز معاً. */
export const EXAMS_QUEUE_KEY = 'exams-queue'

/** صفُّ الطابور كما يردّه الاستعلام (ينقل إليه `GradeQueue` نوعَه المحلّيّ). */
export type ExamQueueRaw = {
  id: string
  student: { id: string, full_name: string } | null
  exam_cycle: ExamCycleRow | null
  exam_list: { halaqa: { name: string } | null, teacher: { full_name: string } | null } | null
  exam_results: { id: string }[] | null
}

/** سقفُ الطابور المعروض (الأحدثُ أولاً) — دون سقف PostgREST (1000) كي لا يُقصّ بصمت. */
const QUEUE_LIMIT = 500

/**
 * طابورُ الرصد: البنودُ بلا نتيجةٍ بدورتها، الأحدثُ أولاً. المعلّقُ وحده يُصفّى في الخادم (ضمٌّ عكسيّ:
 * البنودُ التي لا نتيجةَ لها). الاستعلامُ نفسُه في `GradeQueue`.
 */
export async function fetchExamQueue(supabase: Client): Promise<ExamQueueRaw[]> {
  const { data, error } = await supabase
    .from('exam_list_items')
    .select('id, student:student_id(id, full_name), exam_cycle:exam_cycle_id(id, stage_number, cycle_number, parts_from, parts_to, surahs_label, sort_order), exam_list:exam_list_id(halaqa:halaqa_id(name), teacher:teacher_id(full_name)), exam_results(id)')
    .not('exam_cycle_id', 'is', null)
    .is('exam_results', null)
    .order('created_at', { ascending: false })
    .limit(QUEUE_LIMIT)
    .returns<ExamQueueRaw[]>()
  if (error) throw error
  return data ?? []
}

/** مفتاحُ درجة النجاح: مفتاحُ الجلب ومفتاحُ نسختها على الجهاز معاً. */
export const EXAMS_PASSMARK_KEY = 'exams-passmark'

/** درجةُ النجاح من الإعدادات؛ null إن غابت (فلا يُفترض لها قيمةٌ — `passVerdict`). */
export async function fetchPassMark(supabase: Client): Promise<number | null> {
  const { data, error } = await supabase.from('app_settings').select('pass_mark').eq('id', 1).maybeSingle()
  if (error) throw error
  return data?.pass_mark ?? null
}
