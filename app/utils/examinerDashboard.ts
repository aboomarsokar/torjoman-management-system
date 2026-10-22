/**
 * لوحة المختبِر (طلب المستخدم 2026-10-22) — حساباتٌ نقيّة مختبَرة: ما ينتظر رصدَه (بنودٌ مرشَّحة بلا نتيجة)
 * وأقدمُها، ورصدُ الشهر (المجتازون والمعيدون ومتوسّطُ العلامة)، وتوزيعُ ذلك على حلقاته. البياناتُ من
 * `useExaminerDashboard`، والنطاقُ تحكمه RLS (حلقاتُ المختبِر وحدها).
 */
export interface ExaminerItem {
  id: string
  created_at: string
  halaqa_id: string | null
  /** نتيجةُ البند إن رُصد (واحدةٌ على الأكثر). */
  result: { passed: boolean | null, total_score: number | null, exam_date: string } | null
}

export interface ExaminerHalaqa { id: string, name: string, teacher: string }

const DAY = 86_400_000
const inMonth = (iso: string, ym: string) => iso.slice(0, 7) === ym

/** ما ينتظر الرصد، وأقدمُه بالأيام (منذ الترشيح). */
export function examinerQueue(items: ExaminerItem[], today: string) {
  const pending = items.filter(i => !i.result)
  const oldest = pending.reduce<string | null>((o, i) => (!o || i.created_at < o ? i.created_at : o), null)
  const oldestDays = oldest ? Math.max(0, Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(oldest)) / DAY)) : 0
  return { count: pending.length, oldestDays }
}

/** رصدُ الشهر: عددُه، والمجتازون والمعيدون، ونسبةُ الاجتياز من المحسوم، ومتوسّطُ العلامة. */
export function monthGrading(items: ExaminerItem[], ym: string) {
  const graded = items.filter(i => i.result && inMonth(i.result.exam_date, ym)).map(i => i.result!)
  const passed = graded.filter(r => r.passed === true).length
  const failed = graded.filter(r => r.passed === false).length
  const scores = graded.map(r => r.total_score).filter((s): s is number => s !== null)
  return {
    graded: graded.length,
    passed,
    failed,
    passPct: passed + failed ? Math.round((passed / (passed + failed)) * 100) : null,
    avg: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null
  }
}

/** لكلّ حلقةٍ: ما ينتظر رصدَه، وما رُصد هذا الشهر — ما ينتظر أوّلاً. */
export function halaqaBreakdown(halqat: ExaminerHalaqa[], items: ExaminerItem[], ym: string) {
  return halqat.map((h) => {
    const mine = items.filter(i => i.halaqa_id === h.id)
    return {
      ...h,
      pending: mine.filter(i => !i.result).length,
      graded: mine.filter(i => i.result && inMonth(i.result.exam_date, ym)).length
    }
  }).sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name, 'ar'))
}
