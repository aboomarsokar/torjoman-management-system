/**
 * تعريفُ صناديق الرفع بلا إنترنت (`useOfflineQueue`): كيف يُرفع كلُّ سطر، وكيف تُحدَّث نسخةُ الجهاز بعد رفعه — فيجري
 * ذلك من أيّ شاشةٍ مفتوحة. تستوردها إضافةُ `offline-sync` فتُسجَّل عند الإقلاع.
 */
import { defineOfflineQueue } from '~/composables/useOfflineQueue'
import type { AttendanceMirror } from '~/composables/useOfflineMirror'
import { keptAbsences, type OutboxEntry } from '~/utils/attendanceOutbox'
import { idbGet, idbPut } from '~/utils/offlineDb'

export const ATTENDANCE_QUEUE = 'attendance'

defineOfflineQueue<OutboxEntry>(ATTENDANCE_QUEUE, {
  store: 'outbox',
  order: (a, b) => a.day.localeCompare(b.day),
  upload: (supabase, e) => supabase.rpc('save_attendance_day', {
    p_halaqa: e.halaqaId, p_day: e.day, p_absences: e.absences, p_recorded_at: e.recordedAt
  }),
  // اليومُ المرفوع يدخل نسخةَ الجهاز مسجَّلاً — بلا من تخطّاهم الرفع (لم يعودوا في الحلقة)
  async settle(e, data) {
    const mirror = await idbGet<AttendanceMirror>('mirror', e.uid)
    if (!mirror || mirror.halaqa?.id !== e.halaqaId) return
    const skipped = (data as { skipped?: string[] } | null)?.skipped ?? []
    mirror.days[e.day] = { held: true, absences: keptAbsences(e.absences, skipped) }
    await idbPut('mirror', mirror)
  }
})
