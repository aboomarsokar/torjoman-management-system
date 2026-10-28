/**
 * نسخةُ الشاشة على جهاز المعلّم (البند 14، الدفعة الأولى — 2026-10-27): يلفّ دالّةَ الجلب في `useLazyAsyncData` فلا
 * يتغيّر شيءٌ في الصفحة غيرُ سطرٍ واحد —
 *   • متّصلاً: يجلب كالمعتاد ويحفظ النتيجةَ على الجهاز (لا طلبَ زائداً).
 *   • بلا اتصال (أو تعثّر الجلبُ فصار الجهازُ منقطعاً): آخرُ نسخةٍ محفوظة، ويُعلَّم مفتاحُها «من الجهاز» بوقتها.
 * غيرُ المعلّم يجلب كالمعتاد ولا يُحفظ له شيء. `OfflineSavedNote` يعرض «آخرُ تحديث» حين تُعرض نسخةٌ من الجهاز.
 */
import { isOnlineNow } from '~/utils/reachability'
import { offlineTeacherUid, readSnapshot, writeSnapshot } from '~/utils/offlineSnapshot'

/** مفاتيحُ الجلب المعروضة من الجهاز الآن ← وقتُ نسختها. */
export const useOfflineSavedKeys = () => useState<Record<string, string>>('offline-saved-keys', () => ({}))

export function useOfflineCopy() {
  const saved = useOfflineSavedKeys()
  const mark = (key: string, at: string | null) => {
    const { [key]: _old, ...rest } = saved.value
    saved.value = at ? { ...rest, [key]: at } : rest
  }

  /** يلفّ الجلب: `key` مفتاحُ النسخة (ثابتٌ أو دالّة — كمفتاح الجلب نفسه). */
  function wrap<T>(key: string | (() => string), fetcher: () => Promise<T>): () => Promise<T> {
    return async () => {
      const k = typeof key === 'function' ? key() : key
      const uid = offlineTeacherUid()
      if (!uid) return fetcher()
      if (!isOnlineNow()) {
        const snap = await readSnapshot<T>(uid, k)
        if (snap) {
          mark(k, snap.savedAt)
          return snap.data
        }
      }
      const data = await fetcher()
      if (isOnlineNow()) {
        await writeSnapshot(uid, k, data)
        mark(k, null)
        return data
      }
      // تعثّر الجلبُ في الطريق (الدالّةُ تبتلع خطأها وتردّ فارغاً): النسخةُ أصدق من الفراغ
      const snap = await readSnapshot<T>(uid, k)
      if (snap) {
        mark(k, snap.savedAt)
        return snap.data
      }
      return data
    }
  }

  return { wrap }
}
