/**
 * نظامُ مكافآت المعلمين بالمسارين (قرار المستخدم 2026-11-16) — ثوابتُه مرآةٌ لهجرة `*_teacher_tracks.sql`
 * (`private.track_quota` و`private.track_amount` و`private.halaqa_month_reward`). الحكمُ للقاعدة.
 */

/** رقمُ المسار. */
export type TrackNo = 1 | 2

export interface TrackSpec {
  /** نصابُ المحتسبين. */
  quota: number
  /** أصلُ المكافأة كاملاً قبل خصم النقص (شيكل). */
  amount: number
  label: string
}

export const TRACKS: Record<TrackNo, TrackSpec> = {
  1: { quota: 12, amount: 600, label: 'المسار الأول' },
  2: { quota: 8, amount: 400, label: 'المسار الثاني' }
}

/** خصمُ كلّ طالبٍ ناقص عن النصاب في أوّل شهر. */
export const TRACK_RATE_FIRST = 30
/** خصمُ كلّ ناقص إن نقصت الحلقةُ عن نصابها في الشهر السابق أيضاً. */
export const TRACK_RATE_CONSECUTIVE = 50

/** أوّلُ شهرٍ يسري فيه النظام (سنة×100+شهر)؛ ما قبله على الحساب القديم. */
export const TRACKS_START = 202611

/** أوائلُ الفصول (أربعةُ أشهر): 10–1 · 2–5 · 6–9. */
export const TERM_START_MONTHS = [2, 6, 10] as const
