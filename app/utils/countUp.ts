/** حسابُ العدّاد التصاعديّ (`UiCountUp`) — دالّتان نقيّتان للاختبار. */

/** قيمةُ العدّاد عند نسبةٍ من المدّة (0..1)، سريعٌ أوّلَه ومتباطئٌ آخرَه، مقرَّبةً لمنازل الهدف العشرية. */
export function countUpValue(from: number, to: number, progress: number, decimals = 0): number {
  const t = Math.min(1, Math.max(0, progress))
  const eased = 1 - (1 - t) ** 3
  const factor = 10 ** decimals
  return Math.round((from + (to - from) * eased) * factor) / factor
}

/** منازلُ الهدف العشرية (حتى اثنتين) — فيمرّ عدّادُ «7.5» بـ«7.4» لا بـ«7.4999». */
export function decimalsOf(n: number): number {
  if (Number.isInteger(n)) return 0
  return Math.min(2, (String(n).split('.')[1] ?? '').length)
}
