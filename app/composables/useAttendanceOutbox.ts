/**
 * صندوقُ رفع الحضور (البند 14 — نمطُ الصحابة): «حفظ الحضور» يُكتب على الجهاز أوّلاً ثمّ يُرفع في الخلفية يوماً يوماً
 * (`save_attendance_day`). طبقةٌ رقيقةٌ فوق الصندوق العامّ (`useOfflineQueue` — يُرفع من أيّ شاشة)؛ وتعريفُ الرفع وتحديثُ
 * نسخة الجهاز بعده في `utils/offlineQueues.ts`.
 */
import { newEntry, type Absences, type OutboxEntry } from '~/utils/attendanceOutbox'
import { ATTENDANCE_QUEUE } from '~/utils/offlineQueues'

export function useAttendanceOutbox(uid: Ref<string | null>) {
  const q = useOfflineQueue<OutboxEntry>(ATTENDANCE_QUEUE, uid)
  const entryFor = (halaqaId: string, day: string) => q.entries.value.find(e => e.halaqaId === halaqaId && e.day === day)

  /** «حفظ الحضور»: على الجهاز فوراً، ثمّ محاولةُ رفع. */
  async function enqueue(halaqaId: string, day: string, absences: Absences): Promise<OutboxEntry> {
    if (!uid.value) throw new Error('لا جلسةَ معلّمٍ على هذا الجهاز.')
    const entry = newEntry(uid.value, halaqaId, day, absences)
    await q.put(entry)
    return entry
  }

  return { ...q, entryFor, enqueue }
}
