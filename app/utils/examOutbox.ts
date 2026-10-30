/**
 * صندوقُ رفع نتيجة الاختبار بلا إنترنت (الدفعة الثالثة — 2026-10-29): المختبِر يرصد النتيجةَ على جهازه،
 * وسطرُ الصندوق = **حمولةُ الإدراج** كما كانت ستُرسَل متّصلةً. دوالُّ نقيّةٌ مختبَرة.
 * **`exam_date` يُثبَّت ساعةَ الحفظ على الجهاز** لا ساعةَ الرفع — رصدٌ قبل منتصف الليل ورفعٌ بعده يبقى يومَ الرصد.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { QueueEntry } from '~/composables/useOfflineQueue'
import type { Database } from '~/types/database.types'

export type ExamPayload = Database['public']['Tables']['exam_results']['Insert']

export interface ExamEntry extends QueueEntry {
  itemId: string
  /** للعرض في قائمة المعلَّق والمرفوض. */
  studentName: string
  title: string
  payload: ExamPayload
}

export function newExamEntry(uid: string, item: { id: string, studentName: string, title: string }, payload: ExamPayload, now: Date = new Date()): ExamEntry {
  return {
    key: `${uid}|${item.id}`,
    uid, itemId: item.id, studentName: item.studentName, title: item.title, payload,
    recordedAt: now.toISOString(), attempts: 0, status: 'pending'
  }
}

/** رفضٌ دائم: للبند نتيجةٌ رصدها غيرُ صاحب السطر. */
export const EXAM_GRADED_BY_OTHER = 'رُصدت نتيجةُ هذا الطالب قبل رفع نتيجتك.'

type Client = SupabaseClient<Database>
type UploadResult = { data: unknown, error: { code?: string, message?: string } | null }

/**
 * رفعُ النتيجة. `23505` (فهرسٌ فريدٌ على البند) له وجهان: **ردٌّ ضائع** — نجح الإدراجُ ولم يصل ردُّه فجاءت
 * الإعادةُ بالتعارض، والراصدُ صاحبُ السطر، فنجاح؛ أو رصَدها غيرُه قبله، فرفضٌ دائم. وإن فشلت قراءةُ الراصد
 * نفسُها فيُعاد خطأُ القراءة (يُصنَّف فيُعاد لاحقاً) — لا يُعدّ نجاحاً؛ وكذا إن عادت بلا سطر (حُذفت النتيجةُ بينهما).
 */
export async function uploadExamResult(supabase: Client, e: ExamEntry): Promise<UploadResult> {
  const { error } = await supabase.from('exam_results').insert(e.payload)
  if (!error) return { data: null, error: null }
  if (error.code !== '23505') return { data: null, error }
  const { data: existing, error: readError } = await supabase.from('exam_results')
    .select('examiner_id').eq('exam_list_item_id', e.itemId).maybeSingle()
  if (readError) return { data: null, error: readError }
  // لا خطأ ولا سطر: حُذفت النتيجةُ بين الإدراج والقراءة — لا رفضَ ولا نجاح، يُعاد الرصدُ (`40001` يُصنَّف إعادة)
  if (!existing) return { data: null, error: { code: '40001', message: 'حُذفت النتيجةُ أثناء الرفع — يُعاد الرصد.' } }
  if (existing.examiner_id === e.uid) return { data: null, error: null }
  return { data: null, error: { code: '23505', message: EXAM_GRADED_BY_OTHER } }
}

/** خاناتُ الدرجة العشر: تسعٌ (3 أسئلة × حفظ وفهم وتدبّر) والتجويد — القيمُ قد تكون أنصافاً. */
const SCORE_KEYS = [
  'q1_memorization', 'q1_understanding', 'q1_reflection',
  'q2_memorization', 'q2_understanding', 'q2_reflection',
  'q3_memorization', 'q3_understanding', 'q3_reflection',
  'tajweed_score'
] as const

/** مجموعُ الخانات العشر. */
export function examTotal(p: ExamPayload): number {
  return SCORE_KEYS.reduce((sum, k) => sum + (p[k] ?? 0), 0)
}

/** حكمُ النتيجة على الجهاز؛ null إن لم تُحفظ درجةُ النجاح (لا قيمةَ افتراضية فيُعرض «اجتاز» كذباً). */
export function passVerdict(total: number, passMark: number | null): 'passed' | 'failed' | null {
  if (passMark === null) return null
  return total >= passMark ? 'passed' : 'failed'
}

/** الطابورُ بلا البنود المرصودة على الجهاز (معلَّقةً أو مرفوضة) — لئلا يُرصد بندٌ مرّتين. */
export function withoutPending<T extends { id: string }>(rows: T[], entries: ExamEntry[]): T[] {
  if (!entries.length) return rows
  const pending = new Set(entries.map(e => e.itemId))
  return rows.filter(r => !pending.has(r.id))
}
