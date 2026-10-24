/**
 * نافذةُ رصد الشهر وتنسيقُ التواريخ: التاريخ بتوقيت غزة، والشهرُ بالرقم
 * (`10-2026`) لا بالاسم، واليومُ `DD-MM-YYYY`.
 */

const TZ = 'Asia/Gaza'
const FRIDAY = 5

/** تاريخُ اليوم بتوقيت غزة `YYYY-MM-DD`. */
export function gazaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** الجمعةُ عطلةُ الحلقات (الدوامُ من السبت إلى الخميس): لا حضورَ فيها، والقاعدةُ ترفض تسجيلَها. */
export function isFriday(day: string): boolean {
  return new Date(`${day.slice(0, 10)}T12:00:00Z`).getUTCDay() === FRIDAY
}

/** آخرُ يومِ دوامٍ لا يتجاوز `day` (YYYY-MM-DD): الجمعةُ ← الخميسُ قبلها، وما سواها كما هو. */
export function schoolDayOnOrBefore(day: string): string {
  if (!isFriday(day)) return day
  const d = new Date(`${day.slice(0, 10)}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** أولُ يومٍ يُرسَل فيه رصدُ الشهر: آخرُ يومٍ فيه، والخميسُ إن كان جمعة. */
export function openingDay(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0))
  if (last.getUTCDay() === FRIDAY) last.setUTCDate(last.getUTCDate() - 1)
  return last.toISOString().slice(0, 10)
}

/** هل بلغ `today` (YYYY-MM-DD) يومَ فتح الإرسال؟ */
export function isSubmittable(year: number, month: number, today: string): boolean {
  return today >= openingDay(year, month)
}

/** تسميةُ الفترة بالأرقام: `10-2026`. */
export function periodLabel(year: number, month: number): string {
  return `${String(month).padStart(2, '0')}-${year}`
}

/** `YYYY-MM-DD…` ← `DD-MM-YYYY`. */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}-${m}-${y}`
}

/** إزاحةُ شهرٍ بعددٍ موجبٍ أو سالب مع عبور حدّ السنة. */
export function shiftMonth(year: number, month: number, by: number): { year: number, month: number } {
  const idx = year * 12 + (month - 1) + by
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 }
}
