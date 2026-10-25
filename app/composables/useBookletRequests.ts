/**
 * طلباتُ الملازم (طلب المستخدم 2026-10-25): المعلّمُ يطلب لحلقته ملزمةً بعدد نسخها فيُشعَر المديرُ الإداريّ
 * (مشغّلُ `booklet_requested`)، والمديرُ يُغلق الطلبَ بعد التسليم. `halaqaId` يقصر الجلبَ على حلقةٍ (لوحة المعلّم)،
 * وبدونه كلُّ ما تسمح به RLS (المديرُ ومشرفُ المشروع). التحقّقُ نقيٌّ ومختبَر.
 */
import type { Database } from '~/types/database.types'
import { BOOKLET_COUNT, MAX_BOOKLET_COPIES, MAX_BOOKLET_NOTE } from '~/constants/booklets'

export type BookletRequest = {
  id: string
  halaqa_id: string
  booklet: number
  copies: number
  note: string | null
  status: string
  created_at: string
  halaqa: { name: string, gender: string | null, teacher: { full_name: string } | null } | null
}

export interface RequestDraft { booklet: number | undefined, copies: string, note: string }

/** خطأُ نموذج الطلب بالعربية، أو null. */
export function requestError(d: RequestDraft): string | null {
  if (!d.booklet || d.booklet < 1 || d.booklet > BOOKLET_COUNT) return 'اختر الملزمة.'
  const copies = Number(d.copies)
  if (!Number.isInteger(copies) || copies < 1) return 'عدد النسخ يجب أن يكون رقماً صحيحاً أكبر من صفر.'
  if (copies > MAX_BOOKLET_COPIES) return `عدد النسخ لا يتجاوز ${MAX_BOOKLET_COPIES}.`
  if (d.note.trim().length > MAX_BOOKLET_NOTE) return `الملاحظة لا تتجاوز ${MAX_BOOKLET_NOTE} حرف.`
  return null
}

export function useBookletRequests(halaqaId?: string) {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()
  const busy = ref(false)

  const { data: requests, pending, refresh } = useLazyAsyncData<BookletRequest[]>(`booklet-requests-${halaqaId ?? 'all'}`, async () => {
    let q = supabase.from('booklet_requests')
      .select('id, halaqa_id, booklet, copies, note, status, created_at, halaqa:halaqa_id(name, gender, teacher:teacher_id(full_name))')
    if (halaqaId) q = q.eq('halaqa_id', halaqaId)
    // المفتوحةُ أوّلاً، ثم الأحدث
    const { data, error } = await q.order('status', { ascending: false }).order('created_at', { ascending: false })
      .returns<BookletRequest[]>()
    if (error) handle(error)
    return data ?? []
  }, { server: false, default: () => [] })

  const openCount = computed(() => (requests.value ?? []).filter(r => r.status === 'open').length)

  async function run(task: () => PromiseLike<{ error: unknown }>, done: string): Promise<boolean> {
    busy.value = true
    try {
      const { error } = await task()
      if (error) throw error
      toast.add({ title: done, color: 'success', icon: 'i-lucide-circle-check' })
      await refresh()
      return true
    } catch (err) {
      handle(err)
      return false
    } finally {
      busy.value = false
    }
  }

  /** المعلّمُ يطلب لحلقته. */
  async function addRequest(forHalaqa: string, d: RequestDraft): Promise<boolean> {
    const problem = requestError(d)
    if (problem) {
      toast.add({ title: problem, color: 'warning', icon: 'i-lucide-circle-alert' })
      return false
    }
    return run(() => supabase.from('booklet_requests').insert({
      halaqa_id: forHalaqa, booklet: d.booklet!, copies: Number(d.copies), note: d.note.trim() || null
    }), 'أُرسل طلبُك إلى المدير الإداري.')
  }

  /** المديرُ يُغلق الطلبَ بعد التسليم. */
  async function closeRequest(id: string): Promise<boolean> {
    return run(() => supabase.from('booklet_requests').update({ status: 'done', closed_at: new Date().toISOString() }).eq('id', id),
      'أُغلق الطلب.')
  }

  return { requests, pending, busy, openCount, addRequest, closeRequest, refresh }
}
