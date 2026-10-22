/**
 * «إنجاز الحلقات» (طلب المستخدم 2026-10-22): أرقامُ `halaqat_achievement` إلى نسبٍ وترتيبٍ وروابطِ تواصل.
 * النسبةُ بمقام سجلّ تقييم المعلم نفسه: المنجزون ÷ (المنجزون + المقصّرون + من لم يُرصد) — «لا يُقاس» خارجها.
 */
import { gazaToday, shiftMonth } from '~/utils/reportWindow'

/** حلقةٌ دون هذه النسبة تُعدّ متأخّرة في الملخّص. */
export const ACHIEVEMENT_LOW_PCT = 50

export interface AchievementRow {
  halaqa_id: string
  halaqa_name: string
  teacher_name: string | null
  teacher_phone: string | null
  teacher_whatsapp: string | null
  report_status: string | null
  students: number
  done: number
  short: number
  unrecorded: number
  unmeasured: number
}

/** مقامُ النسبة: من يُحكم عليه بالإنجاز أو عدمه. */
export const measuredOf = (r: Pick<AchievementRow, 'done' | 'short' | 'unrecorded'>) => r.done + r.short + r.unrecorded

/** نسبةُ الإنجاز صحيحةً، أو null حين لا أحدَ يُقاس. */
export function achievementPct(r: Pick<AchievementRow, 'done' | 'short' | 'unrecorded'>): number | null {
  const m = measuredOf(r)
  return m ? Math.round((100 * r.done) / m) : null
}

/** الأضعفُ أولاً، ثم الأكثرُ مقصّرين، ثم الاسم؛ وما لا يُقاس في الآخر. */
export function sortWeakFirst<T extends AchievementRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const pa = achievementPct(a)
    const pb = achievementPct(b)
    if (pa === null || pb === null) return pa === pb ? a.halaqa_name.localeCompare(b.halaqa_name, 'ar') : pa === null ? 1 : -1
    return pa - pb || b.short + b.unrecorded - (a.short + a.unrecorded) || a.halaqa_name.localeCompare(b.halaqa_name, 'ar')
  })
}

/** الملخّصُ الكلّيّ: المنجزون من المقاسين، وعددُ الحلقات المتأخّرة. */
export function achievementTotals(rows: AchievementRow[]) {
  const done = rows.reduce((s, r) => s + r.done, 0)
  const measured = rows.reduce((s, r) => s + measuredOf(r), 0)
  const low = rows.filter((r) => {
    const p = achievementPct(r)
    return p !== null && p < ACHIEVEMENT_LOW_PCT
  }).length
  return { done, measured, pct: measured ? Math.round((100 * done) / measured) : null, low, halqat: rows.length }
}

/**
 * رابطُ محادثة واتس أب من رقمٍ كما كُتب: الدوليُّ (+ أو 00) كما هو، والمحلّيُّ (يبدأ بـ0) بمفتاح فلسطين 970.
 * null إن لم يبقَ رقمٌ معقول.
 */
export function whatsappLink(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  let digits = trimmed.replace(/\D/g, '')
  if (trimmed.startsWith('+')) {
    // دوليٌّ بعلامة +
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2)
  } else if (digits.startsWith('0')) {
    digits = `970${digits.slice(1)}`
  }
  return digits.length >= 9 ? `https://wa.me/${digits}` : null
}

/** الشهرُ الافتراضيّ: السابقُ لشهر اليوم بتوقيت غزة (رصدُه اكتمل أو كاد). */
export function defaultAchievementMonth(today: string = gazaToday()): { year: number, month: number } {
  const [y, m] = today.split('-').map(Number)
  return shiftMonth(y!, m!, -1)
}
