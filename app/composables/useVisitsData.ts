/**
 * جلبُ شاشة الزيارات: قائمةُ الزيارات وحلقاتُ الجدولة — على نمط `useDeductionItems`. ولهما نسخةٌ على جهاز المعلّم والمشرف:
 *   • خطأُ الخادم والاتصالُ قائم (5xx أو مهلة أو 401) يُرمى داخل `wrap` فلا يُكتب فوق النسخة قائمةٌ فارغة، ويُعرض خارجه.
 *   • تعثّرٌ بلا اتصال يردّ فارغاً فيرجع `wrap` إلى النسخة (لا رسالةُ خطأ للمنقطع).
 *   • الإدارةُ (بلا `uid`: لا نسخةَ لها) يُرمى لها الخطأُ دائماً ويُعرض كما كان قبل العمل بلا اتصال.
 */
import type { Database } from '~/types/database.types'
import type { VisitHalqaOption, VisitRow } from '~/types/visits'
import { offlineOwnerUid } from '~/utils/offlineSnapshot'
import { isOnlineNow } from '~/utils/reachability'
import { fetchVisitHalqat, fetchVisits, SCREEN_KEYS } from '~/utils/teacherScreens'

export function useVisitsData() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const { wrap } = useOfflineCopy()

  /** يُرمى الخطأُ إلا لمن له نسخةٌ وهو بلا اتصال. */
  const tolerate = (err: unknown): never[] => {
    if (isOnlineNow() || !offlineOwnerUid()) throw err
    return []
  }
  /** يعرض الخطأَ المرميَّ من `wrap` ويردّ فارغاً (الصفحةُ تبقى قائمة). */
  const shown = (err: unknown): never[] => {
    handle(err)
    return []
  }

  const visitsCopy = wrap(SCREEN_KEYS.visits, () => fetchVisits(supabase).catch(tolerate))
  const { data: fetched, refresh, pending } = useLazyAsyncData<VisitRow[]>(SCREEN_KEYS.visits, () => visitsCopy().catch(shown), { server: false, default: () => [] })

  const halqatCopy = wrap(SCREEN_KEYS.visitHalqat, () => fetchVisitHalqat(supabase).catch(tolerate))
  const { data: halqat } = useLazyAsyncData<VisitHalqaOption[]>(SCREEN_KEYS.visitHalqat, () => halqatCopy().catch(shown), { server: false, default: () => [] })

  return { fetched, refresh, pending, halqat }
}
