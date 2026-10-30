/**
 * رصدُ نتائج الاختبار بلا إنترنت للمختبِر (الدفعة الثالثة — 2026-10-29): ما يلزم طابورَ الرصد ونافذتَه —
 *   • سطرُ النتيجة في صندوق الرفع (`EXAM_QUEUE`) مفتاحُه `uid|itemId`، وحمولتُه هي الإدراجُ كما كان سيُرسَل متّصلاً.
 *   • `shouldQueue`: لصاحب جهازٍ (مختبِر) وبلا اتصال. المديران احتياطاً وأيُّ مختبِرٍ أثناء النيابة بلا `uid`: يرصدون متّصلين كما كان.
 *   • الحكمُ «اجتاز/لم يجتز» على الجهاز بدرجة النجاح المحفوظة؛ وإن لم تُحفظ فلا حكم (لا قيمةَ افتراضية).
 *   • `rowsFor`: الطابورُ بلا ما رُصد على الجهاز (معلَّقاً أو مرفوضاً) وبلا ما رُفع الآن إلى أن تصل نسخةٌ أحدث.
 */
import type { Ref } from 'vue'
import { examTotal, newExamEntry, passVerdict, type ExamEntry, type ExamPayload, withoutPending } from '~/utils/examOutbox'
import { EXAM_QUEUE } from '~/utils/offlineQueues'
import { isOnlineNow } from '~/utils/reachability'
import { offlineOwnerUid } from '~/utils/offlineSnapshot'

export const EXAM_SAVED_ON_DEVICE = 'حُفظت النتيجة على جهازك، وتُرفع حين يعود الاتصال.'

export function useExamOffline(passMark: Ref<number | null>) {
  const uid = computed(() => offlineOwnerUid())
  const queue = useOfflineQueue<ExamEntry>(EXAM_QUEUE, uid)

  const pending = computed(() => queue.pending.value.map((e) => {
    const total = examTotal(e.payload)
    return { key: e.key, studentName: e.studentName, title: e.title, total, verdict: passVerdict(total, passMark.value) }
  }))

  const shouldQueue = () => !!uid.value && !isOnlineNow()

  async function saveOnDevice(item: { id: string, studentName: string, title: string }, payload: ExamPayload): Promise<void> {
    if (!uid.value) return
    await queue.put(newExamEntry(uid.value, item, payload))
  }

  const rejected = computed(() => queue.rejected.value.map(e => ({ key: e.key, label: e.studentName, error: e.error })))

  /**
   * الطابورُ المعروض: ما جلبته الشاشةُ دون ما رُصد على الجهاز، ودون ما رُفع الآن — فبعد حذف سطره من الصندوق وقبل
   * أن يعود `refresh()` لا يعود البندُ إلى الطابور لحظةً (رمشة). وما رُفع يُمحى حين تصل الشاشةَ نسخةٌ جديدة.
   */
  function rowsFor<T extends { id: string }>(fetched: Ref<T[] | undefined>) {
    const uploaded = shallowRef<string[]>([])
    watch(queue.lastUploaded, (u) => {
      if (u) uploaded.value = [...uploaded.value, (u.entry as ExamEntry).itemId]
    })
    watch(fetched, () => {
      uploaded.value = []
    })
    return computed(() => {
      const rows = withoutPending(fetched.value ?? [], queue.entries.value)
      return uploaded.value.length ? rows.filter(r => !uploaded.value.includes(r.id)) : rows
    })
  }

  return {
    uid, pending, entries: queue.entries, shouldQueue, saveOnDevice, rejected, rowsFor,
    lastUploaded: queue.lastUploaded, retry: queue.retry, discard: queue.discard
  }
}
