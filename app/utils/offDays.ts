/**
 * منطقُ بلاغ «لم تنعقد الحلقة» النقيّ (طلب المستخدم 2026-10-30): أسبابُ البلاغ وتسمياتُها، والتحقّقُ من المدخل،
 * وهل يُقبل البلاغُ عن يومٍ ما (مرآةٌ لحارس القاعدة `private.off_day_window_ok` بنصوصه نفسها وترتيبه — فيُمنع الزرُّ
 * بلا اتصالٍ بنفس السبب الذي سترفض به القاعدةُ لاحقاً)، وعبارةُ حالة البلاغ للمعلّم.
 */
import { PROJECT_START_DATE } from '~/constants/project'
import { isFriday } from '~/utils/reportWindow'

/** كلُّ سببٍ تقبله القاعدة (للقراءة والعرض) — «عطلة رسمية» و«ظرف أمني» أُخفيا عن المعلّم 2026-10-31 وبقيا مقبولَين
 *  كي لا يُرفض بلاغٌ من جهازٍ لم يصله التحديث (العطلةُ والظرفُ العامّ إجازةٌ يعيّنها المدير الإداري). */
export const OFF_REASONS = ['teacher_sick', 'emergency', 'other', 'official_holiday', 'security'] as const
export type OffReason = typeof OFF_REASONS[number]

/** ما يختاره المعلّمُ في نافذة البلاغ (طلب المستخدم 2026-10-31). */
export const OFF_REASON_CHOICES: readonly OffReason[] = ['teacher_sick', 'emergency', 'other']

export const OFF_REASON_LABELS: Record<OffReason, string> = {
  teacher_sick: 'مرض المعلم',
  emergency: 'عذر طارئ',
  other: 'سبب آخر',
  official_holiday: 'عطلة رسمية',
  security: 'ظرف أمني'
}

export const OFF_STATUSES = ['pending', 'approved', 'rejected'] as const
export type OffStatus = typeof OFF_STATUSES[number]

/** حالةٌ صالحةٌ من قيمةٍ خام (ردّ القاعدة)، أو `null`. */
export function asOffStatus(value: unknown): OffStatus | null {
  return (OFF_STATUSES as readonly unknown[]).includes(value) ? value as OffStatus : null
}

/** تطبيعُ الملاحظة كما تحفظها القاعدة: تشذيبٌ ثمّ `null` إن فرغت. */
export function normalizeOffNote(note: string | null | undefined): string | null {
  return note?.trim() || null
}

/** بلاغٌ مرفوعٌ كما تحفظه نسخةُ الجهاز. */
export interface OffDay { reason: OffReason, note: string | null, status: OffStatus, reviewNote: string | null }

/** بلاغٌ كما يُعرض: `queued` = على الجهاز لم يُرفع بعد. */
export interface ShownOff extends OffDay { queued: boolean }

/** سقفُ الملاحظة (يطابق قيدَ القاعدة). */
export const OFF_NOTE_MAX = 300

/** خطأُ مدخل نافذة البلاغ، أو `null` إن صحّ. الملاحظةُ إلزاميةٌ مع «سببٌ آخر» بعد التشذيب. */
export function offInputError(reason: OffReason | null, note: string): string | null {
  if (!reason) return 'اختر سبباً'
  const trimmed = note.trim()
  if (reason === 'other' && !trimmed) return 'اكتب السببَ في الملاحظة'
  if (trimmed.length > OFF_NOTE_MAX) return `الملاحظة أطول من ${OFF_NOTE_MAX} حرف`
  return null
}

/** أولُ يومٍ من الشهر السابق لـ`today` (YYYY-MM-DD) — أقدمُ ما يُبلَّغ عنه. */
function previousMonthStart(today: string): string {
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  const y = month === 1 ? year - 1 : year
  const m = month === 1 ? 12 : month - 1
  return `${y}-${String(m).padStart(2, '0')}-01`
}

/**
 * سببُ منع البلاغ عن `day` أو `null` إن جاز. الترتيبُ كحارس القاعدة: جمعة · قبل بداية المشروع · آتٍ ·
 * أقدمُ من الشهر السابق · شهرٌ معتمَد (`approvedMonths` بصيغة YYYY-MM) · إجازةٌ عامة (`holidays[day]`).
 */
export function offDayBlock(day: string, today: string, approvedMonths: string[], holidays: Record<string, string>): string | null {
  if (isFriday(day)) return 'الجمعة عطلة — لا بلاغ فيها'
  if (day < PROJECT_START_DATE) return 'قبل بداية المشروع'
  if (day > today) return 'لا بلاغ عن يومٍ لم يأتِ'
  if (day < previousMonthStart(today)) return 'البلاغُ لأيام هذا الشهر والذي قبله'
  if (approvedMonths.includes(day.slice(0, 7))) return 'الشهر معتمَد — لا بلاغ بعد اعتماده'
  if (holidays[day] !== undefined) return 'هذا اليوم إجازةٌ عامة — لا يحتاج بلاغاً'
  return null
}

/** عبارةُ حالة البلاغ للمعلّم: ما على الجهاز لم يُرفع يغلب حالةَ القاعدة. */
export function offStatusLabel(o: ShownOff): string {
  if (o.queued) return 'على جهازك — بانتظار الرفع'
  if (o.status === 'approved') return 'معتمَد'
  if (o.status === 'rejected') return 'مرفوض'
  return 'بانتظار الاعتماد'
}
