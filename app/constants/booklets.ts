/**
 * ملازمُ المشروع (مقرّراتُه المطبوعة) — خمسَ عشرةَ ملزمةً بجزأين من آخر المصحف إلى أوّله:
 * الملزمة 1 = الجزء 29 + 30، والملزمة 2 = 27 + 28 … والملزمة 15 = 1 + 2 (طلب المستخدم 2026-10-21).
 * رقمُ الملزمة هو المخزَّن في `booklet_deliveries.booklet` (قيدُ القاعدة 1..15).
 */
export const BOOKLET_COUNT = 15
/** عددُ أجزاء المصحف — الملزمةُ الأولى تنتهي به. */
const LAST_JUZ = 30

export interface Booklet {
  no: number
  /** الجزءُ الأصغر في الملزمة. */
  from: number
  to: number
  /** «الجزء 29 + 30». */
  label: string
}

export const BOOKLETS: Booklet[] = Array.from({ length: BOOKLET_COUNT }, (_, i) => {
  const to = LAST_JUZ - 2 * i
  const from = to - 1
  return { no: i + 1, from, to, label: `الجزء ${from} + ${to}` }
})

/** أقصى نسخٍ في التسليم الواحد (قيدُ القاعدة). */
export const MAX_BOOKLET_COPIES = 1000
/** أقصى طول الملاحظة (قيدُ القاعدة). */
export const MAX_BOOKLET_NOTE = 300
