/**
 * بنودُ خصم نموذج الزيارة ومعاييرُها — جلبٌ واحدٌ مشتركٌ بين شاشة الزيارات ونافذة النتيجة (المفتاحُ نفسُه، فمعالجُ
 * الجلب الأوّلُ هو المحفوظ، ولذلك لا يتكرّر هذا الجلبُ في الموضعين). ولها نسخةٌ على جهاز المشرف:
 *   • خطأُ الخادم والاتصالُ قائم (5xx أو مهلة أو RLS) يُرمى فلا يُكتب شيءٌ فوق النسخة، ويُعرض للمستخدم.
 *   • تعثّرٌ بلا اتصال يردّ فارغاً فيرجع `wrap` إلى النسخة (لا رسالةُ خطأ للمنقطع).
 */
import type { Database } from '~/types/database.types'
import { fetchDeductionItems, VISIT_ITEMS_KEY } from '~/utils/fieldScreens'
import { isOnlineNow } from '~/utils/reachability'
import { groupCriteria, type DeductionItem } from '~/utils/visitForm'

export function useDeductionItems() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const { wrap } = useOfflineCopy()
  const copied = wrap(VISIT_ITEMS_KEY, () => fetchDeductionItems(supabase).catch((err) => {
    if (isOnlineNow()) throw err
    return []
  }))
  const { data } = useLazyAsyncData<DeductionItem[]>(VISIT_ITEMS_KEY, () => copied().catch((err) => {
    handle(err)
    return []
  }), { server: false, default: () => [] })
  const items = computed(() => data.value ?? [])
  const criteria = computed(() => groupCriteria(items.value))
  return { items, criteria }
}
