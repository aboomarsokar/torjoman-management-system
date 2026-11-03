/**
 * حسابُ كشف الرواتب (طلب المستخدم 2026-11-03): المعلمُ بمكافأته × تقييمه النهائيّ ÷ 100، والمشرفُ والمختبِرُ وسائرُ
 * أصحاب الرواتب بمكافأتهم كاملة، ثم يُرفع المبلغ إلى أقرب 5 ولا يُنقص. والتعديلُ اليدويّ يُضاف بعد التقريب.
 */

/** المكافأةُ الافتراضية حين لا تُحدَّد لعاملٍ مكافأةٌ خاصّة (مرآةُ `app_settings.default_reward`). */
export const DEFAULT_REWARD = 600

/** يرفع المبلغ إلى أقرب مضاعفٍ لـ5 (501 ← 505، 505 ← 505). */
export function ceilTo5(n: number): number {
  return Math.ceil(Math.round(n * 100) / 500) * 5
}

/**
 * المستحقُّ المحسوب قبل التعديل اليدويّ، أو null للمعلم الذي لم يُقفَل سجلُّ جودته بعد (`final` = null).
 * غيرُ المعلم مكافأتُه كاملة بلا تقييم.
 */
export function suggestedSalary(role: string, base: number, final: number | null): number | null {
  if (role !== 'teacher') return ceilTo5(base)
  if (final === null) return null
  return ceilTo5((base * Math.min(100, Math.max(0, final))) / 100)
}

/** الصافي = المحسوبُ + التعديل؛ وبلا محسوبٍ ولا تعديل لا مبلغ. */
export function netSalary(suggested: number | null, adjustment: number): number | null {
  if (suggested === null && !adjustment) return null
  return Math.max(0, (suggested ?? 0) + adjustment)
}
