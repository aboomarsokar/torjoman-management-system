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
import { applyPendingVisits, newVisitEntry, settledVisits, type VisitEntry } from '~/utils/visitOutbox'
import { customRef, type Ref } from 'vue'
import type { DeductionCounts, DeductionItem } from '~/utils/visitForm'

/** شارةُ ما ينتظر الرفع: في عمود الحالة ونافذة النتيجة. */
export const PENDING_UPLOAD_BADGE = 'على جهازك — بانتظار الرفع'
export const VISIT_SAVED_ON_DEVICE = 'حُفظ التقييم على جهازك، ويُرفع حين يعود الاتصال.'

export function useVisitOffline() {
  // يُقرأ طازجاً عند كلّ قراءة: علَمُ النيابة متغيّرٌ عاديّ لا تفاعليّ، فالمحسوبةُ كانت تحبس أوّلَ قيمةٍ للأبد
  const uid = customRef<string | null>(() => ({ get: offlineOwnerUid, set: () => undefined }))
  const queue = useOfflineQueue<VisitEntry>(VISIT_QUEUE, uid)
  // اسمُ الحلقة لسطرٍ مرفوض: من قائمة الزيارات المعروضة (نسخةُ الجهاز أو الجلب) إن وُجدت
  const { data: list } = useNuxtData<VisitRow[]>(SCREEN_KEYS.visits)

  const pending = computed(() => queue.pending.value)
  const pendingFor = (visitId: string): VisitEntry | null => pending.value.find(e => e.visitId === visitId) ?? null
  const shouldQueue = (visitId: string) => !!uid.value && (!isOnlineNow() || !!pendingFor(visitId))

  async function saveOnDevice(visitId: string, input: { executedAt: string, deductions: DeductionCounts, notes: string | null }): Promise<void> {
    const me = uid.value
    if (!me) return
    await queue.put(newVisitEntry(me, visitId, input))
  }

  /** حُفظت الزيارةُ متّصلةً بنجاح: ما رفضته القاعدةُ سابقاً لها صار قديماً (وإعادةُ محاولته ترفع قيماً بالية) — يُترك. */
  async function discardRejectedFor(visitId: string): Promise<void> {
    const old = queue.rejected.value.find(e => e.visitId === visitId)
    if (old) await queue.discard(old.key)
  }

  const rejected = computed(() => queue.rejected.value.map((e) => {
    const name = list.value?.find(v => v.id === e.visitId)?.halaqa?.name
    return { key: e.key, label: name ? `زيارة ${name}` : 'زيارة', error: e.error }
  }))

  /** شارةُ الحالة: ما ينتظر الرفع يحمل شارتَه بدل حالة القاعدة (`normal`). */
  const badgeFor = <B>(visitId: string, normal: B): B | { label: string, color: 'warning' } =>
    pendingFor(visitId) ? { label: PENDING_UPLOAD_BADGE, color: 'warning' } : normal

  /**
   * الصفوفُ المعروضة: ما جلبته الشاشةُ وعليه (١) ما رُفع الآن — بنتيجة القاعدة فوراً قبل أن يعود `refresh()`، كي لا يعود
   * الصفُّ قابلاً للتعديل لحظةً بعد حذف سطره من الصندوق، و(٢) ما ينتظر الرفع على الجهاز. وما رُفع يُمحى حين تصل
   * الشاشةَ نسخةٌ جديدة (فتحُ المدير للمقفلة بعدها لا يُغطّيه ترقيعٌ قديم).
   */
  function rowsFor(fetched: Ref<VisitRow[] | undefined>, items: Ref<DeductionItem[] | undefined>) {
    // `shallowRef`: الصفوفُ كبيرةُ النوع فلا يُفكَّك عمقُها (TS2589)، ولا حاجةَ لتفاعلٍ داخل الترقيع
    const uploaded = shallowRef<{ visitId: string, patch: Partial<VisitRow> }[]>([])
    watch(queue.lastUploaded, (u) => {
      if (u) uploaded.value = [...uploaded.value, { visitId: (u.entry as VisitEntry).visitId, patch: (u.data ?? {}) as Partial<VisitRow> }]
    })
    watch(fetched, () => {
      uploaded.value = []
    })
    return computed(() => {
      const base = uploaded.value.reduce<VisitRow[]>((rows, u) => settledVisits(rows, u.visitId, u.patch), fetched.value ?? [])
      return applyPendingVisits(base, pending.value, items.value ?? [])
    })
  }

  return { rowsFor, badgeFor, uid, pending, pendingFor, shouldQueue, saveOnDevice, discardRejectedFor, rejected, lastUploaded: queue.lastUploaded, retry: queue.retry, discard: queue.discard }
}
