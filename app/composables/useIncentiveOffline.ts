/**
 * كشفُ الحوافز بلا إنترنت (البند 14، الدفعة الثانية — 2026-10-28): ما يلزم `useIncentiveStatement` للمعلّم —
 *   • نسخةُ الشهر على جهازه (`snap|<uid>|incentive-statement|y-m`) تُكتب بعد كلّ جلبٍ وحفظٍ متّصلَين، وتُقرأ بلا اتصال.
 *   • مسوّدةُ الشهر في صندوق الرفع (`INCENTIVE_QUEUE`) — سطرٌ واحدٌ للشهر يغلب آخرُ حفظٍ فيه ما قبله.
 *   • `uploadNow`: حفظٌ متّصلٌ والصندوقُ فيه مسوّدةٌ للشهر — يمرّ به كي لا تُرفع القديمةُ بعد الجديدة.
 * غيرُ المعلّم (`uid` فارغ) لا يُحفظ له شيءٌ على جهازه، ويحفظ متّصلاً كما كان.
 */
import type { Ref } from 'vue'
import { INCENTIVE_HALQA_KEY, incentiveSnapshotKey, newIncentiveEntry, type IncentiveEntry, type IncentiveItem, type IncentiveSnapshot } from '~/utils/incentiveOutbox'
import { INCENTIVE_QUEUE } from '~/utils/offlineQueues'
import { offlineTeacherUid, readSnapshot, writeSnapshot } from '~/utils/offlineSnapshot'

/** نتيجةُ الحفظ عبر الصندوق: رُفع، أو بقي على الجهاز ينتظر الشبكة، أو رفضته القاعدة (برسالتها). */
export type QueuedSave = { kind: 'uploaded' } | { kind: 'on-device' } | { kind: 'rejected', error?: string }

export const INCENTIVE_SAVED_ON_DEVICE = 'حُفظ الكشفُ على جهازك — يُرفع حين يعود الاتصال.'

export function useIncentiveOffline(halaqaId: Ref<string | null>, month: Ref<number>, year: Ref<number>) {
  const uid = computed(() => offlineTeacherUid())
  const queue = useOfflineQueue<IncentiveEntry>(INCENTIVE_QUEUE, uid)
  const saved = useOfflineSavedKeys()
  const copyKey = computed(() => incentiveSnapshotKey(year.value, month.value))

  /** مسوّدةُ الشهر المعروض على الجهاز (تنتظر الرفع). */
  const pendingEntry = computed(() => queue.pending.value.find(e => e.halaqaId === halaqaId.value && e.year === year.value && e.month === month.value) ?? null)
  const rejected = computed(() => queue.rejected.value.map(e => ({ key: e.key, label: `كشف ${String(e.month).padStart(2, '0')}-${e.year}`, error: e.error })))

  /** يعلّم نسخةَ الشهر «من الجهاز» بوقتها، أو يمحو العلامة — ومحوُها يمحو علامةَ الحلقة كذلك: كشفٌ جُلب من القاعدة
   *  يعني اتصالاً عاد، وكان اسمُ الحلقة المقروءُ من الجهاز يُبقي «معروضٌ من جهازك» بعد الرفع (تجربةُ الجوال 2026-10-28). */
  const markSaved = (at: string | null) => {
    const { [copyKey.value]: _old, [INCENTIVE_HALQA_KEY]: _halqa, ...rest } = saved.value
    saved.value = at ? { ...rest, ...(_halqa ? { [INCENTIVE_HALQA_KEY]: _halqa } : {}), [copyKey.value]: at } : rest
  }

  async function readCopy(): Promise<IncentiveSnapshot | null> {
    if (!uid.value) return null
    const snap = await readSnapshot<IncentiveSnapshot>(uid.value, copyKey.value)
    if (snap) markSaved(snap.savedAt)
    return snap?.data ?? null
  }

  async function writeCopy(data: IncentiveSnapshot) {
    if (!uid.value) return
    await writeSnapshot(uid.value, copyKey.value, data)
    markSaved(null)
  }

  /** يحفظ المسوّدةَ في الصندوق (ويبدأ رفعُها في الخلفية) — false لغير المعلّم أو بلا حلقة. */
  async function queueDraft(items: IncentiveItem[]): Promise<IncentiveEntry | null> {
    if (!uid.value || !halaqaId.value) return null
    const entry = newIncentiveEntry(uid.value, halaqaId.value, year.value, month.value, items)
    await queue.put(entry)
    return entry
  }

  /** متّصلاً: يحفظ في الصندوق وينتظر الرفع — رفعٌ جارٍ قبله يُنتظر ثمّ تُرفع هذه في دورتها. */
  async function uploadNow(items: IncentiveItem[]): Promise<QueuedSave> {
    const entry = await queueDraft(items)
    if (!entry) return { kind: 'on-device' }
    await queue.flush()
    await queue.flush()
    const left = queue.entries.value.find(e => e.key === entry.key)
    if (!left) return { kind: 'uploaded' }
    if (left.status === 'rejected') {
      // الحفظُ المتّصل يُرفض أمام المعلّم كما كان — لا يبقى سطرٌ مرفوضٌ على الجهاز
      await queue.discard(entry.key)
      return { kind: 'rejected', error: left.error }
    }
    return { kind: 'on-device' }
  }

  return { uid, pendingEntry, rejected, lastUploaded: queue.lastUploaded, readCopy, writeCopy, queueDraft, uploadNow, retry: queue.retry, discard: queue.discard }
}
