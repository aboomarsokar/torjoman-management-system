/**
 * تعريفُ صناديق الرفع بلا إنترنت (`useOfflineQueue`): كيف يُرفع كلُّ سطر، وكيف تُحدَّث نسخةُ الجهاز بعد رفعه — فيجري
 * ذلك من أيّ شاشةٍ مفتوحة. تستوردها إضافةُ `offline-sync` فتُسجَّل عند الإقلاع.
 */
import { defineOfflineQueue } from '~/composables/useOfflineQueue'
import type { AttendanceMirror } from '~/composables/useOfflineMirror'
import { keptAbsences, type OutboxEntry } from '~/utils/attendanceOutbox'
import { idbGet, idbPut } from '~/utils/offlineDb'
import { entryAsRecord, quranMirrorKey, type QuranEntry, type QuranMirror } from '~/utils/quranOutbox'

export const ATTENDANCE_QUEUE = 'attendance'
export const QURAN_QUEUE = 'quran'

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

defineOfflineQueue<QuranEntry>(QURAN_QUEUE, {
  store: 'quran_outbox',
  order: (a, b) => a.recordedAt.localeCompare(b.recordedAt),
  upload: (supabase, e) => supabase.rpc('save_quran_record', {
    p_halaqa: e.halaqaId, p_year: e.year, p_month: e.month, p_student: e.studentId,
    // الدالّةُ تقبل null في المواضع («لم يحفظ جديداً») والأنواعُ المولَّدة لا تعرف ذلك — و`undefined` يُسقط
    // الوسيطَ من الطلب فلا تُعرف الدالّة (PGRST202)، فالفارغُ null صريحاً
    p_from_surah: (e.input.from?.surah ?? null) as number, p_from_ayah: (e.input.from?.ayah ?? null) as number,
    p_to_surah: (e.input.to?.surah ?? null) as number, p_to_ayah: (e.input.to?.ayah ?? null) as number,
    p_pages_memorized: e.input.pagesMemorized, p_pages_reviewed: e.input.pagesReviewed as number,
    p_notes: e.input.notes as string, p_recorded_at: e.recordedAt
  }),
  // السجلُّ المرفوع يدخل نسخةَ الشهر بمعرّفه في القاعدة
  async settle(e, data) {
    const mirror = await idbGet<QuranMirror>('quran_mirror', quranMirrorKey(e.uid, e.year, e.month))
    if (!mirror?.inputs || mirror.halaqa?.id !== e.halaqaId) return
    const records = mirror.inputs.records
    const existing = records.find(r => r.student_id === e.studentId)
    const next = entryAsRecord(e, existing, typeof data === 'string' ? data : undefined)
    mirror.inputs.records = [...records.filter(r => r.student_id !== e.studentId), next]
    await idbPut('quran_mirror', mirror)
  }
})
