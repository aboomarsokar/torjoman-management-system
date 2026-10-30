/**
 * ثوابتُ شاشة «أيام الإجازة» (`/attendance/holidays`): حدّا السبب كما في قيد القاعدة `attendance_holidays`،
 * وأبعدُ يومٍ يمكن تعيينُه إجازةً من اليوم (يحدّ منتقيَ التاريخ؛ القاعدةُ نفسها لا تمنع المستقبل).
 */

/** أقصى طول للسبب بعد التشذيب — قيدُ القاعدة `char_length(reason) between 1 and 80`. */
export const HOLIDAY_REASON_MAX = 80

/** أبعدُ يومٍ يُعيَّن إجازةً: سنةٌ من اليوم تقريباً. */
export const HOLIDAY_HORIZON_DAYS = 400

/** حجمُ صفحة قراءة `attendance_days` (سقفُ PostgREST الافتراضيّ ألفُ صفّ). */
export const HOLIDAY_READ_PAGE = 1000
