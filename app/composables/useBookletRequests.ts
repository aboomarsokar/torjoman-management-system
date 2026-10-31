/**
 * طلباتُ الملازم (طلب المستخدم 2026-10-25): المعلّمُ يطلب لحلقته ملزمةً بعدد نسخها فيُشعَر المديرُ الإداريّ
 * (مشغّلُ `booklet_requested`)، والمديرُ يُغلق الطلبَ بعد التسليم. `halaqaId` يقصر الجلبَ على حلقةٍ (لوحة المعلّم)،
 * وبدونه كلُّ ما تسمح به RLS (المديرُ ومشرفُ المشروع). التحقّقُ نقيٌّ ومختبَر.
 * وبأربع حالات (2026-10-31): المديرُ «يُبلغ بالاستلام» فتُحجز النسخ، والمعلّمُ يعدّل ويلغي ما لم يُسلَّم، والمديرُ يلغي بسبب.
 */
import type { Database } from '~/types/database.types'
import { BOOKLET_COUNT, MAX_BOOKLET_COPIES, MAX_BOOKLET_NOTE, MAX_CANCEL_REASON } from '~/constants/booklets'

export type BookletRequest = {
  id: string
  halaqa_id: string
  booklet: number
  copies: number
  note: string | null
  status: string
  created_at: string
  requested_by: string
  notified_at: string | null
  cancel_reason: string | null
  halaqa: { name: string, gender: string | null, teacher: { full_name: string } | null } | null
}

export interface RequestDraft { booklet: number | undefined, copies: string, note: string }
export interface ReadyResult { tracked: boolean, available: number | null, alertAt: number | null }

/** ردُّ «إبلاغ بالاستلام» منمّطاً. */
export function readyResult(data: unknown): ReadyResult {
  const d = (data ?? {}) as { tracked?: boolean, available?: number | null, alert_at?: number | null }
  return { tracked: !!d.tracked, available: d.available ?? null, alertAt: d.alert_at ?? null }
}

/** رسالةُ ما بعد الإبلاغ: نجاحٌ، مع تنبيهٍ إن كانت الملزمةُ غيرَ مجرودة أو بلغ المتوفّرُ حدَّ التنبيه. */
export function readyToast(r: ReadyResult): { title: string, color: 'success' | 'warning' } {
  if (!r.tracked) return { title: 'أُبلغ المعلّم. تنبيه: الملزمةُ غيرُ مجرودة فلم يُتحقَّق من توفّرها.', color: 'warning' }
  if (r.available !== null && r.alertAt !== null && r.available <= r.alertAt) {
    return { title: `أُبلغ المعلّم وحُجزت النسخ. قارب المخزون على النفاد: المتوفّر ${r.available}.`, color: 'warning' }
  }
  return { title: 'أُبلغ المعلّم وحُجزت النسخ.', color: 'success' }
}

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
      .select('id, halaqa_id, booklet, copies, note, status, created_at, requested_by, notified_at, cancel_reason, halaqa:halaqa_id(name, gender, teacher:teacher_id(full_name))')
    if (halaqaId) q = q.eq('halaqa_id', halaqaId)
    const { data, error } = await q.order('created_at', { ascending: false })
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

  /**
   * المديرُ يسلّم الطلب: يُسجَّل التسليمُ في الأرشيف بتاريخه ويُغلَق الطلب في خطوةٍ واحدة (`deliver_booklet_request`)،
   * ومشغّلُ التسليم يُشعر المعلّم.
   */
  async function deliverRequest(id: string, deliveredOn: string): Promise<boolean> {
    return run(() => supabase.rpc('deliver_booklet_request', { p_request: id, p_delivered_on: deliveredOn }),
      'سُجّل التسليمُ في الأرشيف وأُشعر المعلّم.')
  }

  /** المعلّمُ يعدّل طلبَه ما لم يُسلَّم — والمُبلَغُ يعود «جديداً» ويُفكّ حجزُه (`update_booklet_request`). */
  async function updateRequest(id: string, d: RequestDraft): Promise<boolean> {
    const problem = requestError(d)
    if (problem) {
      toast.add({ title: problem, color: 'warning', icon: 'i-lucide-circle-alert' })
      return false
    }
    return run(() => supabase.rpc('update_booklet_request', {
      p_request: id, p_booklet: d.booklet!, p_copies: Number(d.copies), p_note: d.note.trim()
    }), 'عُدِّل الطلبُ وأُشعر المدير الإداري.')
  }

  /** الإلغاءُ — المعلّمُ لطلبه، والمديرُ لأيّ طلبٍ لم يُسلَّم بسببٍ يصل المعلّم. */
  async function cancelRequest(id: string, reason: string): Promise<boolean> {
    if (reason.trim().length > MAX_CANCEL_REASON) {
      toast.add({ title: `السبب لا يتجاوز ${MAX_CANCEL_REASON} حرف.`, color: 'warning', icon: 'i-lucide-circle-alert' })
      return false
    }
    return run(() => supabase.rpc('cancel_booklet_request', { p_request: id, p_reason: reason.trim() }), 'أُلغي الطلب.')
  }

  /**
   * «إبلاغ بالاستلام»: القاعدةُ تفحص المخزون وتحجز النسخ وتُشعر المعلّم (`mark_booklet_request_ready`)، وتُرفض إن لم يكفِ.
   * يُعيد ما بقي متوفّراً للتنبيه بعده (غيرُ المجرودة: `tracked: false`).
   */
  async function markReady(id: string): Promise<ReadyResult | null> {
    busy.value = true
    try {
      const { data, error } = await supabase.rpc('mark_booklet_request_ready', { p_request: id })
      if (error) throw error
      await refresh()
      const result = readyResult(data)
      const msg = readyToast(result)
      toast.add({ ...msg, icon: msg.color === 'success' ? 'i-lucide-circle-check' : 'i-lucide-triangle-alert' })
      return result
    } catch (err) {
      handle(err)
      return null
    } finally {
      busy.value = false
    }
  }

  return { requests, pending, busy, openCount, addRequest, updateRequest, cancelRequest, markReady, deliverRequest, refresh }
}
