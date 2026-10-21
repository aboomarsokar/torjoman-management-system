/**
 * حالةُ الزيارة كما تُعرض، والالتزامُ بالمواعيد (قرار المستخدم 2026-10-21، يحلّ محلّ قرار 2026-10-19):
 * ثلاثُ حالاتٍ لا أربع — «مجدولة» (موعدُها اليوم أو بعده بلا تنفيذ)، و«متأخّرة» (مجدولةٌ فات يومُ موعدها
 * بتوقيت غزة بلا تنفيذ)، و«تمّت» (نُفّذت، في موعدها أو بعده — التأخّرُ في زيارةٍ نُفّذت لا يعني المستخدم).
 * القاعدةُ ما زالت تخزّن done/late للمنفّذة (يومُ التنفيذ مقابلَ الموعد)، والعرضُ يجمعهما «تمّت».
 * «متأخّرة» تُشتقّ هنا بلا مهمّةٍ مجدولة تكتبها، فتصحّ في كلّ لحظةٍ وتنقلب «تمّت» حين تُرفع نتيجتُها.
 */
export type VisitDisplayStatus = 'scheduled' | 'done' | 'late'
export interface VisitDates { status: string, scheduled_at: string }

const GAZA_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Gaza', year: 'numeric', month: '2-digit', day: '2-digit' })

/** يومُ لحظةٍ بتوقيت غزة `YYYY-MM-DD`. */
export function gazaDayOf(iso: string): string {
  return GAZA_DAY.format(new Date(iso))
}

export function visitDisplayStatus(v: VisitDates, today: string): VisitDisplayStatus {
  if (v.status === 'scheduled') return gazaDayOf(v.scheduled_at) < today ? 'late' : 'scheduled'
  return 'done'
}

/** المطلوبُ من الزيارات: زيارتان لكلّ حلقةٍ في الشهر (سجلُّ تقييم الجودة — قرار المستخدم 2026-10-21). */
export const VISITS_PER_HALAQA_MONTH = 2

/**
 * «إنجازُ الزيارات» (قرار المستخدم 2026-10-21، يحلّ محلّ «الالتزام بالمواعيد»): المنفّذةُ ÷ المطلوبة
 * (الحلقاتُ × 2 × الأشهر)، مقصوصةً على 100٪ — فمن جدول قليلاً ونفّذه لا يبلغ الكمال. `pct` = null بلا مطلوب.
 */
export function visitCompletion(visits: VisitDates[], halaqat: number, months = 1) {
  const done = visits.filter(v => v.status !== 'scheduled').length
  const required = Math.max(0, halaqat) * VISITS_PER_HALAQA_MONTH * Math.max(1, months)
  return { done, required, pct: required ? Math.min(100, Math.round((done / required) * 100)) : null }
}

const GAZA_TIME = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Gaza', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** لحظةٌ ← `DD-MM-YYYY · HH:mm` بتوقيت غزة — الشهرُ بالرقم لا بالاسم (قرار المستخدم). */
export function formatVisitMoment(iso: string): string {
  const [y, m, d] = gazaDayOf(iso).split('-')
  return `${d}-${m}-${y} · ${GAZA_TIME.format(new Date(iso))}`
}

/**
 * تاريخُ تنفيذٍ مختار (`YYYY-MM-DD`) ← لحظةٌ تقع في اليوم نفسه بتوقيت غزة: الظهرُ بتوقيت غرينتش
 * (14:00 أو 15:00 في غزة) — فلا يقلب فرقُ التوقيت اليومَ قبلَه أو بعده.
 */
export function executedAtFromDay(day: string): string {
  return `${day}T12:00:00.000Z`
}
