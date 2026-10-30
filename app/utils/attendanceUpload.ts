/**
 * رفعُ سطر صندوق الحضور وأثرُه في نسخة الجهاز بحسب نوعه (بلاغ «لم تنعقد» 2026-10-30):
 *   حضور ← `save_attendance_day` · بلاغ ← `report_off_day` · سحبٌ ← `withdraw_off_day`.
 * منطقٌ نقيٌّ يستدعيه تعريفُ الصندوق في `offlineQueues.ts`، فيُختبر بلا IndexedDB.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import type { MirrorDay, OutboxEntry } from '~/utils/attendanceOutbox'
import { entryKind, keptAbsences } from '~/utils/attendanceOutbox'
import { asOffStatus, normalizeOffNote, type OffDay } from '~/utils/offDays'
import { withoutKey } from '~/utils/withoutKey'

/** ما يلزم من النسخة ليُحدَّث بعد الرفع — النسخةُ الكاملة تحقّق هذا الشكل. */
export interface SettleTarget {
  days: Record<string, MirrorDay>
  offDays?: Record<string, OffDay>
}

type Result = { data: unknown, error: { code?: string | null, message?: string | null } | null }

/** رفضٌ نهائيّ (22023 ضمن رموز الرفض) لبلاغٍ ناقصٍ على الجهاز: لا يُرفع حضوراً، وتُظهره الشاشةُ في «لم تقبله الإدارة». */
const INCOMPLETE_OFF_ERROR = { code: '22023', message: 'بلاغٌ ناقص على الجهاز' }

/** يرفع السطرَ بالدالّة التي تناسب نوعه. */
export function uploadAttendanceEntry(supabase: SupabaseClient<Database>, e: OutboxEntry): PromiseLike<Result> {
  const kind = entryKind(e)
  if (kind === 'withdraw') return supabase.rpc('withdraw_off_day', { p_halaqa: e.halaqaId, p_day: e.day })
  if (kind === 'off') {
    // بلاغٌ بلا سببه تالفٌ: لا يُرفع حضوراً أبداً (كان سيُسجَّل يومٌ منعقدٌ كاذب)
    if (!e.off) return Promise.resolve({ data: null, error: INCOMPLETE_OFF_ERROR })
    return supabase.rpc('report_off_day', {
      p_halaqa: e.halaqaId, p_day: e.day, p_reason: e.off.reason,
      // الملاحظةُ الفارغة null لا نصٌّ فارغ (القاعدة تعدّ الفارغ ملاحظة)؛ والأنواعُ المولَّدة لا تقبل null لوسيطٍ نصّي
      // مع أنّ الدالّةَ تقبله — فالتحويلُ هنا كالذي في `save_quran_record`
      p_note: normalizeOffNote(e.off.note) as string,
      p_reported_at: e.recordedAt
    })
  }
  return supabase.rpc('save_attendance_day', {
    p_halaqa: e.halaqaId, p_day: e.day, p_absences: e.absences, p_recorded_at: e.recordedAt
  })
}

/** يكتب أثرَ سطرٍ مرفوع في النسخة (يعدّلها في مكانها): حضورٌ يمحو البلاغ، وبلاغٌ يمحو الحضور، وسحبٌ يمحو البلاغ. */
export function settleAttendanceEntry(mirror: SettleTarget, e: OutboxEntry, data: unknown): void {
  const kind = entryKind(e)
  if (kind === 'off') {
    if (!e.off) return
    // الحالةُ ممّا ردّته الدالّة: إعادةُ رفعٍ بعد ردٍّ ضائع تردّ الصفَّ الموجود وقد يكون معتمَداً أو مرفوضاً
    const status = asOffStatus((data as { status?: unknown } | null)?.status) ?? 'pending'
    mirror.offDays = { ...mirror.offDays, [e.day]: { reason: e.off.reason, note: normalizeOffNote(e.off.note), status, reviewNote: null } }
    mirror.days = withoutKey(mirror.days, e.day)
    return
  }
  if (mirror.offDays) mirror.offDays = withoutKey(mirror.offDays, e.day)
  if (kind === 'withdraw') return
  // اليومُ المرفوع يدخل مسجَّلاً — بلا من تخطّاهم الرفع (لم يعودوا في الحلقة)
  const skipped = (data as { skipped?: string[] } | null)?.skipped ?? []
  mirror.days[e.day] = { held: true, absences: keptAbsences(e.absences, skipped) }
}
