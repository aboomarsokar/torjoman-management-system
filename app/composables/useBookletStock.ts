/**
 * مخزونُ الملازم (طلب المستخدم 2026-10-28): الأرصدةُ (حالةٌ مشتركةٌ يقرؤها عدّادُ القائمة والصفحة) وسجلُّ الحركات،
 * والجردُ والتوريدُ للمدير الإداريّ (`set_booklet_stock` / `add_booklet_stock`). الخصمُ مع التسليم في القاعدة.
 */
import type { Database } from '~/types/database.types'
import { MAX_BOOKLET_NOTE } from '~/constants/booklets'
import { lowStockCount, lowStockWarning, type StockRow } from '~/utils/bookletStock'

export type StockMove = Database['public']['Tables']['booklet_stock_moves']['Row']
export type StockAction = 'supply' | 'count'
export interface StockDraft { booklet: number, action: StockAction, copies: string, alertAt: string, note: string }

/** خطأُ نموذج المخزون بالعربية، أو null. */
export function stockDraftError(d: StockDraft): string | null {
  const n = Number(d.copies)
  if (d.action === 'supply' && (!Number.isInteger(n) || n < 1)) return 'عدد النسخ الواردة رقمٌ صحيحٌ أكبر من صفر.'
  if (d.action === 'count' && (!Number.isInteger(n) || n < 0)) return 'العدد الفعليّ رقمٌ صحيحٌ (صفرٌ أو أكثر).'
  const a = Number(d.alertAt)
  if (d.action === 'count' && (!Number.isInteger(a) || a < 0)) return 'حدّ التنبيه رقمٌ صحيحٌ (صفرٌ أو أكثر).'
  if (d.note.trim().length > MAX_BOOKLET_NOTE) return `الملاحظة لا تتجاوز ${MAX_BOOKLET_NOTE} حرف.`
  return null
}

export function useBookletStock() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()
  const stock = useState<StockRow[]>('booklet-stock', () => [])
  const moves = ref<StockMove[]>([])
  const busy = ref(false)
  const lowCount = computed(() => lowStockCount(stock.value))

  async function refreshStock() {
    const { data, error } = await supabase.from('booklet_stock').select('booklet, quantity, alert_at').order('booklet')
    if (error) return handle(error)
    stock.value = data ?? []
  }

  async function refreshMoves() {
    const { data, error } = await supabase.from('booklet_stock_moves').select('*').order('created_at', { ascending: false }).limit(100)
    if (error) return handle(error)
    moves.value = data ?? []
  }

  /** بعد تسليمٍ: يحدّث الأرصدة وينبّه إن قاربت ملزمتُه النفاد. */
  async function afterDelivery(booklet: number) {
    await refreshStock()
    const warning = lowStockWarning(stock.value, booklet)
    if (warning) toast.add({ title: warning, description: 'أضف نسخاً من «المخزون».', color: 'warning', icon: 'i-lucide-package-x' })
  }

  async function save(d: StockDraft): Promise<boolean> {
    const problem = stockDraftError(d)
    if (problem) {
      toast.add({ title: problem, color: 'warning', icon: 'i-lucide-circle-alert' })
      return false
    }
    busy.value = true
    const note = d.note.trim() || undefined
    const { error } = d.action === 'supply'
      ? await supabase.rpc('add_booklet_stock', { p_booklet: d.booklet, p_copies: Number(d.copies), p_note: note })
      : await supabase.rpc('set_booklet_stock', { p_booklet: d.booklet, p_quantity: Number(d.copies), p_alert_at: Number(d.alertAt), p_note: note })
    busy.value = false
    if (error) {
      handle(error)
      return false
    }
    toast.add({ title: d.action === 'supply' ? 'أُضيفت النسخ إلى المخزون.' : 'حُفظ الجرد.', color: 'success', icon: 'i-lucide-circle-check' })
    await Promise.all([refreshStock(), refreshMoves()])
    return true
  }

  return { stock, moves, busy, lowCount, refreshStock, refreshMoves, afterDelivery, save }
}
