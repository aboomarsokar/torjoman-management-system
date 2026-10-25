/**
 * أرشيفُ تسليم الملازم للحلقات — جلبُ التسليمات والحلقات، وتسجيلُ تسليمٍ وحذفُه (المديرُ الإداريّ وحده؛
 * ومشرفُ المشروع يقرأ — RLS هي الحَكَم). التحقّقُ نقيٌّ ومختبَر.
 */
import type { Database } from '~/types/database.types'
import { BOOKLET_COUNT, MAX_BOOKLET_COPIES, MAX_BOOKLET_NOTE } from '~/constants/booklets'
import type { DeliveryRow, HalaqaLite } from '~/utils/booklets'

export interface DeliveryDraft {
  halaqaId: string | undefined
  booklet: number | undefined
  copies: string
  deliveredOn: string
  note: string
}

/** خطأُ نموذج التسليم بالعربية، أو null. `today` بصيغة `YYYY-MM-DD`. */
export function deliveryError(d: DeliveryDraft, today: string): string | null {
  if (!d.halaqaId) return 'اختر الحلقة.'
  if (!d.booklet || d.booklet < 1 || d.booklet > BOOKLET_COUNT) return 'اختر الملزمة.'
  const copies = Number(d.copies)
  if (!Number.isInteger(copies) || copies < 1) return 'عدد النسخ يجب أن يكون رقماً صحيحاً أكبر من صفر.'
  if (copies > MAX_BOOKLET_COPIES) return `عدد النسخ لا يتجاوز ${MAX_BOOKLET_COPIES}.`
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.deliveredOn)) return 'اختر تاريخ التسليم.'
  if (d.deliveredOn > today) return 'تاريخ التسليم لا يكون في المستقبل.'
  if (d.note.trim().length > MAX_BOOKLET_NOTE) return `الملاحظة لا تتجاوز ${MAX_BOOKLET_NOTE} حرف.`
  return null
}

export function useBooklets() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()
  const busy = ref(false)

  const { data: deliveries, pending, refresh } = useLazyAsyncData<DeliveryRow[]>('booklet-deliveries', async () => {
    const { data, error } = await supabase.from('booklet_deliveries')
      .select('id, halaqa_id, booklet, copies, delivered_on, note')
      .order('delivered_on', { ascending: false }).order('created_at', { ascending: false })
    if (error) handle(error)
    return data ?? []
  }, { server: false, default: () => [] })

  const { data: halaqat } = useLazyAsyncData<HalaqaLite[]>('booklet-halaqat', async () => {
    const { data, error } = await supabase.from('halaqat').select('id, name, status, gender, teacher:teacher_id(full_name)').order('name')
      .returns<HalaqaLite[]>()
    if (error) handle(error)
    return data ?? []
  }, { server: false, default: () => [] })

  /** يسجّل تسليماً بعد التحقّق؛ يُرجع true عند النجاح. */
  async function addDelivery(d: DeliveryDraft, today: string): Promise<boolean> {
    const problem = deliveryError(d, today)
    if (problem) {
      toast.add({ title: problem, color: 'warning', icon: 'i-lucide-circle-alert' })
      return false
    }
    busy.value = true
    try {
      const { error } = await supabase.from('booklet_deliveries').insert({
        halaqa_id: d.halaqaId!, booklet: d.booklet!, copies: Number(d.copies), delivered_on: d.deliveredOn, note: d.note.trim() || null
      })
      if (error) throw error
      toast.add({ title: 'سُجّل التسليم.', color: 'success', icon: 'i-lucide-circle-check' })
      await refresh()
      return true
    } catch (err) {
      handle(err)
      return false
    } finally {
      busy.value = false
    }
  }

  /** يحذف تسليماً مسجَّلاً خطأً؛ يُرجع true عند النجاح. */
  async function removeDelivery(id: string): Promise<boolean> {
    busy.value = true
    try {
      const { error } = await supabase.from('booklet_deliveries').delete().eq('id', id)
      if (error) throw error
      toast.add({ title: 'حُذف التسليم.', color: 'success', icon: 'i-lucide-trash-2' })
      await refresh()
      return true
    } catch (err) {
      handle(err)
      return false
    } finally {
      busy.value = false
    }
  }

  return { deliveries, halaqat, pending, busy, addDelivery, removeDelivery }
}
