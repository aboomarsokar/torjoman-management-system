import type { Ref } from 'vue'
import type { Database } from '~/types/database.types'
import { midSubmitBlock } from '~/utils/quran/midmonth'
import { gazaToday, isEntryOpen } from '~/utils/reportWindow'

/**
 * «تسليمُ رصد المنتصف» للمعلّم (طلب المستخدم 2026-11-21): وقتُ آخر تسليمٍ لرأس الشهر، وسببُ التعطيل،
 * والتسليمُ بالدالّة `submit_quran_midmonth` (تحفظ صورةً من رصد الشهر وتُشعر المشرفَ أوّلَ مرّة؛ والقاعدةُ تحكم الشروط).
 */
export function useQuranMidmonth(o: {
  reportId: Ref<string | null>
  year: Ref<number>
  month: Ref<number>
  status: Ref<string | null>
  online: Ref<boolean>
  pending: Ref<number>
}) {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()
  const today = gazaToday()
  const submittedAt = ref<string | null>(null)
  const busy = ref(false)

  async function load() {
    submittedAt.value = null
    if (!o.reportId.value || !o.online.value) return
    const { data, error } = await supabase.from('quran_midmonth').select('submitted_at').eq('report_id', o.reportId.value).maybeSingle()
    if (error) handle(error)
    else submittedAt.value = data?.submitted_at ?? null
  }
  watch([o.reportId, o.online], load, { immediate: true })

  const isCurrentMonth = computed(() => `${o.year.value}-${String(o.month.value).padStart(2, '0')}` === today.slice(0, 7))
  const block = computed(() => midSubmitBlock({
    online: o.online.value,
    pending: o.pending.value,
    isCurrentMonth: isCurrentMonth.value,
    entryOpen: isEntryOpen(o.year.value, o.month.value, today),
    status: o.status.value,
    hasReport: !!o.reportId.value
  }))

  async function submit(): Promise<boolean> {
    if (block.value || !o.reportId.value) return false
    busy.value = true
    try {
      const { data, error } = await supabase.rpc('submit_quran_midmonth', { p_report: o.reportId.value })
      if (error) throw error
      submittedAt.value = new Date().toISOString()
      toast.add({ title: 'سُلّم رصدُ المنتصف', description: `حُفظت صورةُ ${data} طالباً للمتابعة.`, color: 'success', icon: 'i-lucide-circle-check' })
      return true
    } catch (err) {
      handle(err)
      return false
    } finally {
      busy.value = false
    }
  }

  return { submittedAt, block, busy, isCurrentMonth, submit }
}
