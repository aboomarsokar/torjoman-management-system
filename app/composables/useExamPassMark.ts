/**
 * درجةُ النجاح من الإعدادات — جلبٌ واحدٌ مشتركٌ بين طابور الرصد (حكمُ ما رُصد على الجهاز) ونافذة الرصد (المفتاحُ نفسُه،
 * فمعالجُ الجلب الأوّلُ هو المحفوظ). ولها نسخةٌ على جهاز المختبِر:
 *   • خطأُ الخادم والاتصالُ قائم يُرمى فلا يُكتب شيءٌ فوق النسخة، ويُعرض للمستخدم.
 *   • تعثّرٌ بلا اتصال يردّ `null` فيرجع `wrap` إلى النسخة.
 * `null` = لم تُجلب ولم تُحفظ: لا حكمَ ولا درجةَ تُفترض في العرض.
 */
import type { Database } from '~/types/database.types'
import { EXAMS_PASSMARK_KEY, fetchPassMark } from '~/utils/fieldScreens'
import { isOnlineNow } from '~/utils/reachability'

export function useExamPassMark() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const { wrap } = useOfflineCopy()
  const copied = wrap<number | null>(EXAMS_PASSMARK_KEY, () => fetchPassMark(supabase).catch((err) => {
    if (isOnlineNow()) throw err
    return null
  }))
  const { data } = useLazyAsyncData<number | null>(EXAMS_PASSMARK_KEY, () => copied().catch((err) => {
    handle(err)
    return null
  }), { server: false, default: () => null })
  const passMark = computed(() => data.value ?? null)
  return { passMark }
}
