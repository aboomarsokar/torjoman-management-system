/**
 * تفصيلُ علامة الاختبار (طلب المستخدم 2026-10-22: «أعرض تفصيل علامة الطالب عند الضغط عليها»): ثلاثةُ أسئلةٍ لكلٍّ
 * ثلاثةُ فروعٍ (الحفظ والفهم والتدبّر) من 10، والتجويدُ من 9، والمجموعُ من 99 — كخانات `exam_results` ونافذةِ الرصد.
 * مختبَرةٌ في examBreakdown.test.ts.
 */
export const BRANCH_MAX = 10
export const TAJWEED_MAX = 9

type Branch = 'memorization' | 'understanding' | 'reflection'
export const BRANCHES: { key: Branch, label: string }[] = [
  { key: 'memorization', label: 'الحفظ' },
  { key: 'understanding', label: 'الفهم' },
  { key: 'reflection', label: 'التدبّر' }
]
const QUESTIONS = [
  { n: 1, title: 'السؤال الأول' },
  { n: 2, title: 'السؤال الثاني' },
  { n: 3, title: 'السؤال الثالث' }
] as const

export type ScoreRow = Record<`q${1 | 2 | 3}_${Branch}`, number> & { tajweed_score: number }

/** الأسئلةُ الثلاثة بفروعها ومجموعِ كلٍّ (من 30)، والتجويد، والمجموعُ الكلّيّ. */
export function examBreakdown(r: ScoreRow) {
  const questions = QUESTIONS.map((q) => {
    const branches = BRANCHES.map(b => ({ label: b.label, score: Number(r[`q${q.n}_${b.key}`] ?? 0) }))
    return { title: q.title, branches, sum: branches.reduce((s, b) => s + b.score, 0), max: BRANCH_MAX * BRANCHES.length }
  })
  const tajweed = Number(r.tajweed_score ?? 0)
  return { questions, tajweed, total: questions.reduce((s, q) => s + q.sum, 0) + tajweed }
}

/** مجموعُ كلّ فرعٍ عبر الأسئلة الثلاثة (من 30) — أين قوّةُ الطالب وضعفُه. */
export function branchTotals(r: ScoreRow) {
  return BRANCHES.map(b => ({
    label: b.label,
    score: QUESTIONS.reduce((s, q) => s + Number(r[`q${q.n}_${b.key}`] ?? 0), 0),
    max: BRANCH_MAX * QUESTIONS.length
  }))
}
