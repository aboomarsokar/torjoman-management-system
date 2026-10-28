/**
 * طلبُ حذف طالب (طلب المستخدم 2026-10-28) — بآلية طلبات الإضافة: المعلّمُ يطلب من ملفّ الطالب حذفَه **بسببٍ إلزاميّ**،
 * والمديرُ الإداريّ يُنهي التحاقَه (`approve_student_removal` — «منقطع» من يوم الموافقة، ويبقى سجلُّه) أو يرفض بسبب.
 * يحتاج اتصالاً. والطلبُ المفتوح يُقرأ ليقول الملفُّ «طلبُ حذفه بانتظار الإدارة» بدل الزرّ.
 */
import type { Database } from '~/types/database.types'
import { REMOVE_REASON_MIN, REQUEST_NOTE_MAX } from '~/constants/studentRequests'

/** خطأُ سبب الحذف بالعربية، أو null. */
export function removalReasonError(reason: string): string | null {
  const r = reason.trim()
  if (r.length < REMOVE_REASON_MIN) return 'اكتب سببَ طلب الحذف.'
  if (r.length > REQUEST_NOTE_MAX) return `السببُ لا يتجاوز ${REQUEST_NOTE_MAX} حرف.`
  return null
}

export function useStudentRemoval() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()
  const busy = ref(false)

  /** طلبُ الحذف المفتوح لهذا الطالب (تاريخُه)، أو null. */
  async function openRemovalFor(studentId: string): Promise<{ id: string, created_at: string } | null> {
    const { data } = await supabase.from('student_requests').select('id, created_at')
      .eq('student_id', studentId).eq('kind', 'remove').eq('status', 'open').maybeSingle()
    return data
  }

  /** المعلّمُ يطلب حذفَ طالبٍ من حلقته — الاسمُ يأخذه حارسُ القاعدة من سجلّ الطالب. */
  async function requestRemoval(halaqaId: string, studentId: string, reason: string): Promise<boolean> {
    const problem = removalReasonError(reason)
    if (problem) {
      toast.add({ title: problem, color: 'warning', icon: 'i-lucide-circle-alert' })
      return false
    }
    busy.value = true
    try {
      // full_name يملؤه الحارس من سجلّ الطالب (لقطة)؛ والقيدُ يطلب قيمةً عند الإدراج فتُرسل نائبةٌ تُستبدل
      const { error } = await supabase.from('student_requests').insert({
        kind: 'remove', halaqa_id: halaqaId, student_id: studentId, note: reason.trim(), full_name: 'طلب حذف'
      })
      if (error) throw error
      toast.add({ title: 'أُرسل طلبُ الحذف إلى الإدارة.', color: 'success', icon: 'i-lucide-circle-check' })
      return true
    } catch (err) {
      handle(err)
      return false
    } finally {
      busy.value = false
    }
  }

  /** المديرُ الإداريّ يُنهي التحاقَ الطالب ويُغلق الطلب. */
  async function approveRemoval(requestId: string): Promise<boolean> {
    busy.value = true
    try {
      const { error } = await supabase.rpc('approve_student_removal', { p_request: requestId })
      if (error) throw error
      toast.add({ title: 'أُنهي التحاقُ الطالب وأُشعر المعلّم.', color: 'success', icon: 'i-lucide-circle-check' })
      return true
    } catch (err) {
      handle(err)
      return false
    } finally {
      busy.value = false
    }
  }

  return { busy, openRemovalFor, requestRemoval, approveRemoval }
}
