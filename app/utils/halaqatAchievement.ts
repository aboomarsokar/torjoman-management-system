/**
 * «إنجاز الحلقات» (طلب المستخدم 2026-10-22): أرقامُ `halaqat_achievement` إلى نسبٍ وترتيبٍ وروابطِ تواصل.
 * النسبةُ بحساب سجلّ تقييم المعلم نفسه (قرار 2026-11-02): أعلى 12 طالباً بأوزان أنجز 1 · قريب ½ · مقصّر ولم يُرصد 0،
 * مقسوماً على 12 دائماً — «لا يُقاس» خارجها. مرآتُه في القاعدة `quality_month_compute`.
 */
import { gazaToday, shiftMonth } from '~/utils/reportWindow'
import { clampToProjectStart } from '~/utils/projectStart'

/** حلقةٌ دون هذه النسبة تُعدّ متأخّرة في الملخّص. */
export const ACHIEVEMENT_LOW_PCT = 50

/** عددُ الطلاب الذين يُحسب بهم إنجازُ المعلم (الأعلى منهم)، ومقامُ نسبته دائماً. */
export const ACHIEVEMENT_TOP_N = 12

export interface AchievementRow {
  halaqa_id: string
  halaqa_name: string
  teacher_name: string | null
  teacher_phone: string | null
  teacher_whatsapp: string | null
  report_status: string | null
  students: number
  done: number
  near: number
  short: number
  /** كثيرو الغياب — خارج الحساب كـ«لا يُقاس» (قانون الغياب 2026-11-02). */
  absentee: number
  unrecorded: number
  unmeasured: number
}

type Counts = Pick<AchievementRow, 'done' | 'near' | 'short' | 'unrecorded'>

/** من يُحكم عليه بالإنجاز أو عدمه (بلا «لا يُقاس»). */
export const measuredOf = (r: Counts) => r.done + r.near + r.short + r.unrecorded

/** مجموعُ أعلى 12 طالباً: المنجزون أوّلاً (1) ثم القريبون (½). */
export function topScore(r: Pick<AchievementRow, 'done' | 'near'>): number {
  const done = Math.min(r.done, ACHIEVEMENT_TOP_N)
  return done + 0.5 * Math.min(r.near, ACHIEVEMENT_TOP_N - done)
}

/** نسبةُ إنجاز المعلم صحيحةً (أعلى 12 ÷ 12)، أو null حين لا أحدَ يُقاس. */
export function achievementPct(r: Counts): number | null {
  return measuredOf(r) ? Math.round((100 * topScore(r)) / ACHIEVEMENT_TOP_N) : null
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
  const near = rows.reduce((s, r) => s + r.near, 0)
  const measured = rows.reduce((s, r) => s + measuredOf(r), 0)
  const low = rows.filter((r) => {
    const p = achievementPct(r)
    return p !== null && p < ACHIEVEMENT_LOW_PCT
  }).length
  return { done, near, measured, pct: measured ? Math.round((100 * (done + 0.5 * near)) / measured) : null, low, halqat: rows.length }
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

/** الشهرُ الافتراضيّ: السابقُ لشهر اليوم بتوقيت غزة (رصدُه اكتمل أو كاد) — ولا قبل بداية المشروع. */
export function defaultAchievementMonth(today: string = gazaToday()): { year: number, month: number } {
  const [y, m] = today.split('-').map(Number)
  return clampToProjectStart(shiftMonth(y!, m!, -1))
}
