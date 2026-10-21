/**
 * خلاصةُ شاشة الحلقات (طلب المستخدم 2026-10-21: «عددُهم ومعلوماتٌ عامّة عنهم») — من الصفوف المعروضة
 * بعد التصفية: عددُ الحلقات ونشطُها، والطلابُ النشطون، ومتوسّطُ الحلقة، وتوزيعُ الفئتين.
 */
export interface SummaryHalaqa {
  status: string | null
  classification: 'a' | 'b' | null
  student_count: { count: number }[]
}

export function halqatSummary(rows: SummaryHalaqa[]) {
  const students = rows.reduce((sum, h) => sum + (h.student_count[0]?.count ?? 0), 0)
  return {
    halqat: rows.length,
    active: rows.filter(h => h.status === 'active').length,
    students,
    perHalaqa: rows.length ? Math.round((students / rows.length) * 10) / 10 : 0,
    classA: rows.filter(h => h.classification === 'a').length,
    classB: rows.filter(h => h.classification === 'b').length
  }
}
