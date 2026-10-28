/**
 * «أُقِرّ بالاطّلاع» بلا إنترنت (البند 14، الدفعة الأولى — 2026-10-27): متّصلاً لا يتدخّل (الشاشةُ تنادي القاعدةَ كما
 * كانت)؛ وبلا اتصالٍ يحفظ الإقرارَ في صندوق الرفع ويعلّم السطرَ في نسخة الشاشة فيظهر «اطّلعتَ» فوراً — ويُرفع حين يعود
 * الاتصال من أيّ شاشة. للمعلّم وحده (صاحبُ النسخة).
 */
import { ackSnapshotKey, markAcknowledged, newAckEntry, type AckEntry, type AckKind } from '~/utils/ackOutbox'
import { ACK_QUEUE } from '~/utils/offlineQueues'
import { offlineTeacherUid, patchSnapshot } from '~/utils/offlineSnapshot'
import { isOnlineNow } from '~/utils/reachability'

export const ACK_SAVED_MESSAGE = 'سُجّل اطّلاعك على جهازك — يُرفع حين يعود الاتصال.'

export function useOfflineAck() {
  const uid = computed(() => offlineTeacherUid())
  const queue = useOfflineQueue<AckEntry>(ACK_QUEUE, uid)

  /** بلا اتصالٍ: يحفظ الإقرار ويعدّل النسخة ويردّ true — ومتّصلاً false (فتمضي الشاشةُ إلى القاعدة). */
  async function queueIfOffline(kind: AckKind, id: string, month?: { year: number, month: number }): Promise<boolean> {
    const me = uid.value
    if (isOnlineNow() || !me) return false
    const entry = newAckEntry(me, kind, id)
    await queue.put(entry)
    await patchSnapshot<{ id: string }[]>(me, ackSnapshotKey(kind, month), rows => markAcknowledged(rows, kind, id, entry.recordedAt))
    return true
  }

  return { queueIfOffline }
}
