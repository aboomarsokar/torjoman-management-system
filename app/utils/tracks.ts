/**
 * حسابُ نظام المسارين في الواجهة — مرآةٌ لدوالّ القاعدة للعرض والمعاينة، والحكمُ للقاعدة دائماً.
 * المحتسب: حضر أكثرَ من نصف أيام دوام حلقته بعد طرح غيابه بعذر. الأصل: كاملُ المسار ناقصاً
 * (30 أو 50 إن نقص الشهرُ السابق) × الناقصين، ولا ينزل عن صفر. الإنجاز: نسبةٌ مفتوحة لأفضل «ن».
 */
import { TRACKS, TRACKS_START, TRACK_RATE_CONSECUTIVE, TRACK_RATE_FIRST, type TrackNo } from '~/constants/tracks'
import type { Outcome } from '~/utils/quran/plan'
import { achievementPct as legacyPct } from '~/utils/halaqatAchievement'

/** هل يسري نظامُ المسارين على الشهر؟ */
export function tracksApply(year: number, month: number): boolean {
  return year * 100 + month >= TRACKS_START
}

/** أوّلُ شهرٍ في الفصل التالي — مرآةُ `private.next_term_start`. */
export function nextTermStart(year: number, month: number): { year: number, month: number } {
  if (month >= 2 && month <= 5) return { year, month: 6 }
  if (month >= 6 && month <= 9) return { year, month: 10 }
  if (month >= 10) return { year: year + 1, month: 2 }
  return { year, month: 2 }
}

/** هل يُحتسب الطالب؟ null حين لم تُفتح أيامٌ (يحكم بها القاعدة بأيام العضوية). */
export function isCounted(attended: number, held: number, excused: number): boolean | null {
  if (held <= 0) return null
  return attended * 2 > held - excused
}

export interface RewardCalc {
  quota: number
  full: number
  missing: number
  rate: number
  deduction: number
  base: number
}

/** أصلُ المكافأة — مرآةُ `private.halaqa_month_reward`. */
export function rewardBase(track: TrackNo, counted: number, previousMissing: number): RewardCalc {
  const { quota, amount } = TRACKS[track]
  const missing = Math.max(0, quota - counted)
  const rate = missing === 0 ? 0 : previousMissing > 0 ? TRACK_RATE_CONSECUTIVE : TRACK_RATE_FIRST
  return { quota, full: amount, missing, rate, deduction: rate * missing, base: Math.max(0, amount - rate * missing) }
}

/** نسبةُ إنجاز الطالب المفتوحة: لم يُرصد 0 · مطلوبُه صفر 1 · وإلا الصفحات ÷ المطلوب بسقف 1. */
export function openRatio(outcome: Outcome, pages: number | null, required: number | null): number | null {
  if (outcome === 'absentee' || outcome === 'unmeasured') return null
  if (outcome === 'unrecorded' || pages === null) return 0
  if (!required) return 1
  return Math.min(1, pages / required)
}

/**
 * إنجازُ المعلم بالنسبة المفتوحة — مرآةُ `private.halaqa_achievement_score`: مجموعُ أفضل «ن» نسبةً ÷ ن،
 * ن = الأصغر من المقاسين ونصاب المسار. null حين لا أحدَ يُقاس.
 */
export function openAchievement(
  rows: { outcome: Outcome, pages: number | null, required: number | null }[],
  quota: number
): { pct: number | null, n: number, pool: number } {
  const ratios = rows.map(r => openRatio(r.outcome, r.pages, r.required)).filter((x): x is number => x !== null)
  const n = Math.min(ratios.length, quota)
  if (!n) return { pct: null, n: 0, pool: ratios.length }
  const top = ratios.sort((a, b) => b - a).slice(0, n).reduce((s, x) => s + x, 0)
  return { pct: Math.round((100 * top) / n), n, pool: ratios.length }
}

/** رقمُ المسار من قيمةٍ قادمة من القاعدة (الافتراضُ الأول). */
export function asTrack(v: unknown): TrackNo {
  return v === 2 ? 2 : 1
}

/** موقفُ الحلقة في شهر كما يعيده `halaqa_track_standing`. */
export interface TrackReward {
  track: TrackNo
  quota: number
  full: number
  held_days: number
  no_attendance: boolean
  counted: number
  missing: number
  consecutive: boolean
  rate: number
  deduction: number
  base: number
}

export interface TrackStanding {
  /** null قبل 11/2026. */
  reward: TrackReward | null
  achievement: { quota: number, pool: number, n: number, top: number, achievement: number | null, pct: number | null }
  current_track: TrackNo
  /** أوّلُ الفصل التالي بصيغة سنة×100+شهر. */
  next_term: number
  next_term_track: TrackNo
  students: { id: string, name: string, member_days: number, attended: number, excused: number, counted: boolean }[]
  pending_request: { id: string, track: TrackNo, note: string | null, created_at: string } | null
}

/** «MM-YYYY» من سنة×100+شهر. */
export function yyyymmLabel(n: number): string {
  return `${String(n % 100).padStart(2, '0')}-${Math.floor(n / 100)}`
}

/**
 * إنجازُ المعلم في التقرير الشهريّ: من 11/2026 بالنسبة المفتوحة على نصاب مسار الحلقة (12 إن لم يُعرف بعد)،
 * وقبله بالحساب القديم (أعلى 12 بالأوزان).
 */
export function teacherAchievementOf(
  rows: { outcome: Outcome, record: { pagesMemorized: number } | null, plan: { required: number | null } }[],
  year: number,
  month: number,
  quota: number | null | undefined
): { pct: number | null, sub: string } {
  if (!tracksApply(year, month)) {
    const c = { done: 0, near: 0, short: 0, unrecorded: 0 }
    for (const r of rows) if (r.outcome in c) c[r.outcome as keyof typeof c]++
    return { pct: legacyPct(c), sub: 'أعلى 12 طالباً' }
  }
  const q = quota ?? TRACKS[1].quota
  const res = openAchievement(rows.map(r => ({ outcome: r.outcome, pages: r.record?.pagesMemorized ?? null, required: r.plan.required })), q)
  return { pct: res.pct, sub: `أفضل ${res.n} من نصاب ${q}` }
}

/** مسارُ حلقةٍ في شهر من صفوف `halaqa_tracks` — مرآةُ `private.halaqa_track`: آخرُ تعيينٍ سرى حتى الشهر، وإلا الأول. */
export function trackAt(
  rows: { halaqa_id: string, track: number, effective_year: number, effective_month: number }[],
  halaqaId: string,
  year: number,
  month: number
): TrackNo {
  const ym = year * 100 + month
  let best: { ym: number, track: number } | null = null
  for (const r of rows) {
    const k = r.effective_year * 100 + r.effective_month
    if (r.halaqa_id === halaqaId && k <= ym && (!best || k > best.ym)) best = { ym: k, track: r.track }
  }
  return asTrack(best?.track ?? 1)
}
