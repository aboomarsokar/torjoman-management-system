/**
 * منطقُ شاشة «أيام الإجازة» النقيّ: توسيعُ مدى «من — إلى» إلى أيامه بلا الجُمَع، وفصلُ الأيام الجديدة عن المعيَّنة سابقاً،
 * وترتيبُ القائمة (القادمةُ أولاً)، وتشذيبُ السبب، ونصُّ التأكيد قبل الإضافة. التواريخُ `YYYY-MM-DD` أيامٌ تقويميةٌ بلا منطقة.
 */
import { HOLIDAY_HORIZON_DAYS, HOLIDAY_REASON_MAX } from '~/constants/holidays'
import { daysCount } from '~/utils/attendanceOutbox'
import { isFriday } from '~/utils/reportWindow'

export interface Holiday { day: string, reason: string }

const DAY_MS = 86_400_000

/** أيامُ المدى شاملةً طرفيه بلا الجُمَع؛ والمدى المقلوبُ يُعامل بترتيب طرفيه. */
export function expandHolidayRange(from: string, to: string): string[] {
  const [first, last] = from <= to ? [from, to] : [to, from]
  const end = Date.parse(`${last.slice(0, 10)}T12:00:00Z`)
  const days: string[] = []
  for (let t = Date.parse(`${first.slice(0, 10)}T12:00:00Z`); t <= end; t += DAY_MS) {
    const day = new Date(t).toISOString().slice(0, 10)
    if (!isFriday(day)) days.push(day)
  }
  return days
}

/** يفصل أيامَ المدى إلى جديدةٍ تُضاف، وأخرى إجازةٌ أصلاً تُتخطّى (لا يفشل الإدراجُ كلُّه بسببها). */
export function splitNewHolidays(days: string[], existing: string[]): { fresh: string[], skipped: string[] } {
  const known = new Set(existing)
  const fresh: string[] = []
  const skipped: string[] = []
  for (const day of days) (known.has(day) ? skipped : fresh).push(day)
  return { fresh, skipped }
}

/** القادمةُ (من اليوم فصاعداً) تصاعدياً أولاً، ثم الماضيةُ من الأحدث إلى الأقدم. */
export function sortHolidays<T extends { day: string }>(list: T[], today: string): T[] {
  const upcoming = list.filter(h => h.day >= today).sort((a, b) => a.day.localeCompare(b.day))
  const past = list.filter(h => h.day < today).sort((a, b) => b.day.localeCompare(a.day))
  return [...upcoming, ...past]
}

/** السببُ مشذَّباً، أو `null` إن كان فارغاً أو أطولَ من الحدّ (قيدُ القاعدة 1..80). */
export function cleanHolidayReason(raw: string): string | null {
  const reason = raw.trim()
  return reason.length >= 1 && reason.length <= HOLIDAY_REASON_MAX ? reason : null
}

/** آخرُ يومٍ يُعيَّن إجازةً: اليومُ + أفق التعيين، `YYYY-MM-DD`. */
export function holidayHorizon(today: string): string {
  return new Date(Date.parse(`${today}T12:00:00Z`) + HOLIDAY_HORIZON_DAYS * DAY_MS).toISOString().slice(0, 10)
}

/** نصُّ التأكيد: عددُ الأيام وعددُ الحلقات التي سجّلت حضوراً فيها (يبقى كما هو)، وما تُخطّي لأنّه إجازةٌ أصلاً. */
export function holidayConfirmMessage(days: number, halaqat: number, skipped: number): string {
  const kept = halaqat > 0
    ? `وسجّلت فيها ${halaqat} حلقة حضوراً يبقى كما هو`
    : 'ولم تسجّل فيها أيُّ حلقةٍ حضوراً'
  const extra = skipped > 0 ? ` (تُخطّي ${daysCount(skipped)}: إجازةٌ أصلاً)` : ''
  return `${daysCount(days)}، ${kept}.${extra}`
}
