/**
 * تقييمُ الزيارة بلا إنترنت للمشرف الميدانيّ (الدفعة الثالثة — 2026-10-29): ما يلزم شاشةَ الزيارات ونافذةَ النتيجة —
 *   • سطرُ الزيارة في صندوق الرفع (`VISIT_QUEUE`) مفتاحُه `uid|visitId`: حفظٌ ثانٍ لزيارةٍ معلَّقة يغلب الأوّل.
 *   • `shouldQueue`: بلا اتصال، أو متّصلاً وللزيارة سطرٌ معلَّق (كي لا يتخطّى حفظٌ مباشرٌ سطرَه القديم فيُرفع بعده).
 *   • يومُ التنفيذ يُثبَّت في السطر ساعةَ الحفظ لا الرفع.
 * غيرُ المشرف والمختبِر (المديرُ الفنيّ، وأيٌّ منهما أثناء النيابة) بلا `uid`: لا يُحفظ له شيءٌ ويحفظ متّصلاً كما كان.
 */
import { isOnlineNow } from '~/utils/reachability'
import { VISIT_QUEUE } from '~/utils/offlineQueues'
import { offlineOwnerUid } from '~/utils/offlineSnapshot'
import { SCREEN_KEYS } from '~/utils/teacherScreens'
import type { VisitRow } from '~/types/visits'
import { newVisitEntry, type VisitEntry } from '~/utils/visitOutbox'
import type { DeductionCounts } from '~/utils/visitForm'

/** شارةُ ما ينتظر الرفع: في عمود الحالة ونافذة النتيجة. */
export const PENDING_UPLOAD_BADGE = 'على جهازك — بانتظار الرفع'
export const VISIT_SAVED_ON_DEVICE = 'حُفظ التقييم على جهازك، ويُرفع حين يعود الاتصال.'

export function useVisitOffline() {
  const uid = computed(() => offlineOwnerUid())
  const queue = useOfflineQueue<VisitEntry>(VISIT_QUEUE, uid)
  // اسمُ الحلقة لسطرٍ مرفوض: من قائمة الزيارات المعروضة (نسخةُ الجهاز أو الجلب) إن وُجدت
  const { data: list } = useNuxtData<VisitRow[]>(SCREEN_KEYS.visits)

  const pending = computed(() => queue.pending.value)
  const pendingFor = (visitId: string): VisitEntry | null => pending.value.find(e => e.visitId === visitId) ?? null
  const shouldQueue = (visitId: string) => !!uid.value && (!isOnlineNow() || !!pendingFor(visitId))

  async function saveOnDevice(visitId: string, input: { executedAt: string, deductions: DeductionCounts, notes: string | null }): Promise<void> {
    if (!uid.value) return
    await queue.put(newVisitEntry(uid.value, visitId, input))
  }

  const rejected = computed(() => queue.rejected.value.map((e) => {
    const name = list.value?.find(v => v.id === e.visitId)?.halaqa?.name
    return { key: e.key, label: name ? `زيارة ${name}` : 'زيارة', error: e.error }
  }))

  return { uid, pending, pendingFor, shouldQueue, saveOnDevice, rejected, lastUploaded: queue.lastUploaded, retry: queue.retry, discard: queue.discard }
}
