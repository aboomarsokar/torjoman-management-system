/**
 * نموذجُ الزيارة الإشرافية (قرار المستخدم 2026-10-21): ستّةُ معايير، لكلٍّ 7 درجات، والخصمُ = عددُ المرّات × خصمُ المرّة،
 * ومحصّلةُ المعيار max(0, 7 − الخصم)، والمجموعُ من 42. البنودُ من `visit_deduction_items` في القاعدة،
 * والقاعدةُ تحسب المحفوظَ نفسَه (`visit_score_and_lock`) — هذه مرآتُه الحيّة للنافذة. مختبَرةٌ في visitForm.test.ts.
 */
export const CRITERION_MAX = 7
export const VISIT_MAX = 42
/** حدُّ عدد المرّات للبند (قيدُ القاعدة). */
export const DEDUCTION_COUNT_MAX = 99

export interface DeductionItem {
  key: string
  criterion: number
  criterion_label: string
  criterion_hint: string | null
  label: string
  per_time: number
  sort_order: number
}

export interface Criterion {
  number: number
  label: string
  hint: string | null
  items: DeductionItem[]
}

/** عددُ المرّات لكلّ بند — ما يُحفظ في `supervision_visits.deductions`. */
export type DeductionCounts = Record<string, number>

/** البنودُ مجموعةً في معاييرها الستّة بترتيبها. */
export function groupCriteria(items: DeductionItem[]): Criterion[] {
  const map = new Map<number, Criterion>()
  for (const i of [...items].sort((a, b) => a.sort_order - b.sort_order)) {
    const c = map.get(i.criterion) ?? { number: i.criterion, label: i.criterion_label, hint: i.criterion_hint, items: [] }
    c.items.push(i)
    map.set(i.criterion, c)
  }
  return [...map.values()].sort((a, b) => a.number - b.number)
}

/** خصمُ المعيار (قد يتجاوز 7) ومحصّلتُه (لا تنزل تحت الصفر). */
export function criterionResult(c: Criterion, counts: DeductionCounts) {
  const deducted = c.items.reduce((s, i) => s + i.per_time * (counts[i.key] ?? 0), 0)
  return { deducted, score: Math.max(0, CRITERION_MAX - deducted) }
}

/** مجموعُ الخصم ومجموعُ الزيارة من 42. */
export function visitTotals(criteria: Criterion[], counts: DeductionCounts) {
  let deducted = 0
  let score = 0
  for (const c of criteria) {
    const r = criterionResult(c, counts)
    deducted += r.deducted
    score += r.score
  }
  return { deducted, score }
}

/** ما يُرسَل للحفظ: الأعدادُ الموجبة وحدها، صحيحةً ومقصوصةً على الحدّ. */
export function cleanCounts(counts: DeductionCounts): DeductionCounts {
  const out: DeductionCounts = {}
  for (const [k, v] of Object.entries(counts)) {
    const n = Math.min(DEDUCTION_COUNT_MAX, Math.max(0, Math.trunc(Number(v) || 0)))
    if (n > 0) out[k] = n
  }
  return out
}

/** يقرأ `deductions` المحفوظة (jsonb) أعداداً، ويتجاهل ما ليس عدداً. */
export function parseCounts(raw: unknown): DeductionCounts {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return cleanCounts(raw as DeductionCounts)
}
