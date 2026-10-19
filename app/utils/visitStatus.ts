/**
 * حالةُ الزيارة كما تُعرض، والالتزامُ بالمواعيد (قرار 2026-10-19):
 * القاعدةُ تخزّن done (نُفّذت في يوم موعدها أو قبله) و late (بعده) و scheduled (بلا تنفيذ) —
 * و«فائتة» تُشتقّ هنا: مجدولةٌ فات يومُ موعدها بتوقيت غزة بلا نتيجة. لا مهمّةَ مجدولة تكتبها،
 * فتصحّ في كلّ لحظةٍ وتنقلب «متأخّرة» حين تُرفع نتيجتُها.
 */
export type VisitDisplayStatus = 'scheduled' | 'done' | 'late' | 'missed'
export interface VisitDates { status: string, scheduled_at: string }

const GAZA_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Gaza', year: 'numeric', month: '2-digit', day: '2-digit' })

/** يومُ لحظةٍ بتوقيت غزة `YYYY-MM-DD`. */
export function gazaDayOf(iso: string): string {
  return GAZA_DAY.format(new Date(iso))
}

export function visitDisplayStatus(v: VisitDates, today: string): VisitDisplayStatus {
  if (v.status === 'scheduled') return gazaDayOf(v.scheduled_at) < today ? 'missed' : 'scheduled'
  return v.status as VisitDisplayStatus
}

/** نسبةُ الالتزام: في وقتها ÷ المستحقّة (تمّت + متأخّرة + فائتة)، و`null` إن لم تستحقّ زيارة. */
export function visitCommitment(visits: VisitDates[], today: string): number | null {
  let onTime = 0
  let due = 0
  for (const v of visits) {
    const s = visitDisplayStatus(v, today)
    if (s === 'scheduled') continue
    due++
    if (s === 'done') onTime++
  }
  return due ? Math.round(onTime / due * 100) : null
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
