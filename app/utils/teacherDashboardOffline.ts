/**
 * لوحةُ المعلّم بلا إنترنت (البند 14، 2026-10-27): آخرُ نسخةٍ من بياناتها تُحفظ على الجهاز، ويُدمج فيها ما سجّله المعلّمُ
 * بعدها على جهازه — حضورُ اليوم (من نسخة الحضور وصندوقه) وإنجازُ شهر الرصد (من صندوق الإنجاز) — كي لا تقول اللوحةُ
 * «لم تسجّل حضور اليوم» وقد سجّله منقطعاً. دوالُّ نقيّةٌ مختبَرة.
 */
import { entryKind, type Absences, type OutboxEntry } from '~/utils/attendanceOutbox'
import type { OffStatus } from '~/utils/offDays'
import type { Period } from '~/utils/quran/screen'
import { isFriday } from '~/utils/reportWindow'

/** ما يمسّه الدمجُ من بيانات اللوحة (`useTeacherDashboard`). `off`: حالُ بلاغ «لم تنعقد» لليوم (نسخةٌ قديمة بلا الحقل = لا بلاغ). */
export interface DashLike {
  halaqa: { id: string } | null
  today: { isFriday: boolean, held: boolean, absent: number, off?: OffStatus | null }
  recording: { period: Period }
  recordedCount: number
  unrecorded: { id: string, name: string }[]
}

/** النسخةُ المحفوظة: لصاحبها، ومتى حُفظت، وفي أيّ يوم (بتوقيت غزة). */
export interface DashSnapshot<D> {
  uid: string
  savedAt: string
  day: string
  dash: D
}

/** حضورُ اليوم على الجهاز: ما ينتظر الرفعَ يغلب، ثمّ نسخةُ الحضور؛ null إن لم يُعرف. */
export function localDay(
  queued: Absences | null,
  mirrorDay: { held: boolean, absences: Absences } | null | undefined
): { held: boolean, absent: number } | null {
  if (queued) return { held: true, absent: Object.keys(queued).length }
  if (mirrorDay) return { held: mirrorDay.held, absent: mirrorDay.held ? Object.keys(mirrorDay.absences).length : 0 }
  return null
}

/**
 * اليومُ من سطر الصندوق المنتظِر (إن وُجد) ونسخةِ الحضور: الحضورُ يُسجّله ويُلغي البلاغ، والبلاغُ يتركه غيرَ مسجَّلٍ
 * وبلاغُه معلّق، والسحبُ يتركه غيرَ مسجَّلٍ بلا بلاغ. `queuedOff` الغائبُ = لا سطرَ يقول شيئاً عن البلاغ.
 */
export function queuedToday(
  entry: OutboxEntry | undefined,
  mirrorDay: { held: boolean, absences: Absences } | null | undefined
): { day: { held: boolean, absent: number } | null, queuedOff?: OffStatus | null } {
  if (!entry) return { day: localDay(null, mirrorDay) }
  const kind = entryKind(entry)
  if (kind === 'attendance') return { day: localDay(entry.absences, mirrorDay), queuedOff: null }
  return { day: { held: false, absent: 0 }, queuedOff: kind === 'off' ? 'pending' : null }
}

/** يدمج عملَ الجهاز في بيانات اللوحة. */
export function withLocalWork<D extends DashLike>(d: D, local: {
  today: string
  /** يومُ النسخة — إن مضى ولا علمَ بحضور اليوم فاليومُ لم يُسجَّل. */
  savedOn: string
  day: { held: boolean, absent: number } | null
  /** بلاغُ اليوم من سطرٍ ينتظر الرفع (`queuedToday`)؛ غائبٌ = لا سطر. */
  queuedOff?: OffStatus | null
  /** حالُ بلاغ اليوم في نسخة الحضور على الجهاز — احتياطٌ حين لا تعرفه قراءةُ القاعدة. */
  mirrorOff?: OffStatus | null
  /** سجلّاتُ إنجازٍ تنتظر الرفع. */
  quranPending: { halaqaId: string, studentId: string, year: number, month: number, status: string }[]
}): D {
  const stale = local.savedOn !== local.today
  const base = local.day
    ? { isFriday: isFriday(local.today), ...local.day }
    : stale ? { isFriday: isFriday(local.today), held: false, absent: 0 } : d.today
  // البلاغ: سطرُ الصندوق يغلب، ثمّ قراءةُ القاعدة اليوم (أحدثُ بقرار المعتمِد)، ثمّ نسخةُ الجهاز
  const serverOff = stale ? null : d.today.off ?? null
  const off = local.queuedOff !== undefined ? local.queuedOff : serverOff ?? local.mirrorOff ?? null
  const today = { ...base, off }
  const { year, month } = d.recording.period
  const queued = new Set(local.quranPending
    .filter(e => e.status === 'pending' && e.halaqaId === d.halaqa?.id && e.year === year && e.month === month)
    .map(e => e.studentId))
  const unrecorded = d.unrecorded.filter(s => !queued.has(s.id))
  return { ...d, today, unrecorded, recordedCount: d.recordedCount + d.unrecorded.length - unrecorded.length }
}
