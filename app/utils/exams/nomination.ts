/**
 * ترشيحُ الاختبار ورصدُه بالدورات — دوالُّ نقيّة تغذّي شاشة الاختبارات وجرسَ الإشعارات:
 * الأجزاءُ المعتمدة لكلّ طالب، وحالةُ دوراته (المجتازة والمعلّقة)، وصفوفُ الترشيح، ونصُّ هدف البند
 * (دورةٌ أو نطاقُ الخطة القديمة)، وتجميعُ البنود المعلّقة بقوائمها، وترجمةُ أخطاء القاعدة المعروفة.
 * ملاحظة: `app/utils/exams/*` لا يُستورد تلقائياً — يُستورد صراحةً.
 */
import { PROGRAM_JUZ_COUNT } from '~/constants/quran'
import { cycleLabel, cycleRange, dueCycle, reachedHint, type ExamCycle } from '~/utils/exams/cycles'
import { latestEnds, type HistoryRow } from '~/utils/quran/monthHistory'
import { completedJuz, type ProgramJuz } from '~/utils/quran/position'

/** صفُّ `exam_cycles` كما يعود من القاعدة (`sort_order` قابلٌ للفراغ في الأنواع). */
export type ExamCycleRow = Omit<ExamCycle, 'sort_order'> & { sort_order: number | null }

/** صفُّ القاعدة ← دورة (الترتيبُ الفارغ صفر). */
export function toExamCycle(r: ExamCycleRow): ExamCycle {
  return { ...r, sort_order: r.sort_order ?? 0 }
}

/** حدٌّ بعد كلّ شهرٍ ممكن: «آخرُ نهايةٍ معتمَدة» بلا قيد تاريخ. */
const AFTER_ALL = { year: 10000, month: 1 }

/**
 * الأجزاءُ المكتملة المعتمدة لكلّ طالب: الأكبرُ من الأجزاء المكتملة حتى آخر نهايةٍ **معتمَدة**
 * (`completedJuz`) وما يحفظه مسجَّلاً (`quran_parts`) — القاعدةُ نفسها في `juzDone` لشهر الحلقة.
 */
export function approvedJuzReached(
  students: { id: string, quran_parts: number | null }[],
  history: HistoryRow[],
  juz: ProgramJuz[]
): Record<string, number> {
  const ends = latestEnds(history, AFTER_ALL, true)
  const out: Record<string, number> = {}
  for (const s of students) {
    const held = Math.max(0, Math.min(PROGRAM_JUZ_COUNT, s.quran_parts ?? 0))
    out[s.id] = Math.max(completedJuz(ends[s.id] ?? null, juz), held)
  }
  return out
}

/** بندُ ترشيحٍ بدورة مع نتائجه (للحالة). */
export interface CycleItemRow {
  id: string
  student_id: string
  exam_cycle_id: number | null
  exam_results: { passed: boolean | null }[] | null
}

/** حالةُ الطالب في الدورات: المجتازة، والبندُ المعلّق (بلا نتيجة) إن وُجد. */
export interface StudentCycleState {
  passed: Set<number>
  pendingItemId: string | null
  pendingCycleId: number | null
}

/** حالةُ دورات كلّ طالب من بنوده؛ البنودُ القديمة (بلا دورة) لا تدخل — كحارس القاعدة. */
export function cycleStateByStudent(items: CycleItemRow[]): Record<string, StudentCycleState> {
  const out: Record<string, StudentCycleState> = {}
  for (const it of items) {
    if (it.exam_cycle_id == null) continue
    const st = (out[it.student_id] ??= { passed: new Set<number>(), pendingItemId: null, pendingCycleId: null })
    const results = it.exam_results ?? []
    if (results.some(r => r.passed)) st.passed.add(it.exam_cycle_id)
    if (!results.length) {
      st.pendingItemId = it.id
      st.pendingCycleId = it.exam_cycle_id
    }
  }
  return out
}

/** صفُّ ترشيحٍ للمعلّم. */
// نوعٌ لا واجهة: كي يُقبل صفّاً في UiDataTable (`T extends Record<string, unknown>`)
export type NomineeRow = {
  id: string
  full_name: string
  halaqa_id: string | null
  /** الأجزاءُ المكتملة المعتمدة. */
  juzReached: number
  /** المستحقّة، أو المعلّقة إن كان له ترشيحٌ بانتظار الرصد؛ null لمن أتمّ الخطة. */
  cycle: ExamCycle | null
  blocked: 'pending' | 'done' | null
  /** البندُ المعلّق (لسحب الترشيح). */
  pendingItemId: string | null
  /** تلميحٌ لا منع: لم يبلغ موضعُه المعتمد حدودَ الدورة. */
  hint: string | null
}

/** صفوفُ الترشيح: لكلّ طالبٍ دورتُه المستحقّة ثابتةً (لا اختيار)، وحالتُه، وتلميحُ البلوغ. */
export function buildNomineeRows(
  students: { id: string, full_name: string, halaqa_id: string | null }[],
  cycles: ExamCycle[],
  items: CycleItemRow[],
  juzReached: Record<string, number>
): NomineeRow[] {
  const states = cycleStateByStudent(items)
  return students.map((s) => {
    const st = states[s.id]
    const reached = juzReached[s.id] ?? 0
    const base = { id: s.id, full_name: s.full_name, halaqa_id: s.halaqa_id, juzReached: reached }
    // ترشيحٌ معلّق يمنع أيّ ترشيحٍ آخر (حارسُ القاعدة)، وتُعرض دورتُه هو
    if (st?.pendingItemId) {
      const cycle = cycles.find(c => c.id === st.pendingCycleId) ?? null
      return { ...base, cycle, blocked: 'pending' as const, pendingItemId: st.pendingItemId, hint: null }
    }
    const due = dueCycle(cycles, st?.passed ?? new Set(), new Set())
    return {
      ...base,
      cycle: due.cycle,
      blocked: due.blocked,
      pendingItemId: null,
      hint: due.cycle ? reachedHint(due.cycle, reached) : null
    }
  })
}

/** بندٌ يُسحب ترشيحُه (معرّفُه واسمُ الطالب ودورتُه للعرض). */
export interface WithdrawTarget { itemId: string, studentName: string, cycleTitle: string }

/** نطاقُ الخطة القديمة (`exam_plan`) لبنودها الباقية. */
export interface OldPlanRef { parts_from: number, parts_to: number }

/** نصُّ هدف البند: الدورةُ ونطاقُها، أو نطاقُ الخطة القديمة كما هو حتى تُحذف. */
export function examTargetText(cycle: ExamCycle | null, plan: OldPlanRef | null): { title: string, detail: string } {
  if (cycle) return { title: cycleLabel(cycle), detail: cycleRange(cycle) }
  if (plan) return { title: 'الخطة السابقة', detail: `الأجزاء ${plan.parts_from}–${plan.parts_to}` }
  return { title: '—', detail: '' }
}

/** بندٌ في طابور الجرس: قائمتُه وحلقتُها ونتائجُه. */
export interface PendingItemRow {
  exam_list_id: string
  exam_results: { id: string }[] | null
  exam_list: { halaqa: { name: string } | null } | null
}

/** قوائمُ الترشيح التي فيها بنودٌ بلا نتيجة، بترتيب ظهورها — معرّفُها معرّفُ القائمة (مصدرُ إشعار `exam_nominated`). */
export function pendingLists(rows: PendingItemRow[]): { listId: string, halaqa: string, count: number }[] {
  const byList = new Map<string, { listId: string, halaqa: string, count: number }>()
  for (const r of rows) {
    if (r.exam_results?.length) continue
    const cur = byList.get(r.exam_list_id)
    if (cur) cur.count++
    else byList.set(r.exam_list_id, { listId: r.exam_list_id, halaqa: r.exam_list?.halaqa?.name ?? '—', count: 1 })
  }
  return [...byList.values()]
}

/** رصدُ نتيجةٍ لبندٍ مرصودٍ سلفاً (قيدُ التفرّد على `exam_results.exam_list_item_id`). */
export const DUPLICATE_GRADE_MESSAGE = 'رُصدت نتيجةُ هذا الترشيح من قبل.'
/** حذفُ حلقةٍ لها ترشيحاتٌ مرصودة يصطدم بحارس التاريخ. */
export const HALAQA_GRADED_MESSAGE = 'للحلقة اختباراتٌ مرصودة؛ عطّلها بدل حذفها.'

/** رسالةُ خطأ الرصد المعروفة، وإلا null (يُعرض الخطأ كما هو). */
export function gradeErrorMessage(err: unknown): string | null {
  const code = (err as { code?: unknown } | null)?.code
  return code === '23505' ? DUPLICATE_GRADE_MESSAGE : null
}

/** رسالةُ فشل حذف الحلقة المعروفة، وإلا null. */
export function halaqaDeleteErrorMessage(err: unknown): string | null {
  const message = (err as { message?: unknown } | null)?.message
  return typeof message === 'string' && message.includes('لا يُحذف ترشيحٌ رُصدت نتيجته') ? HALAQA_GRADED_MESSAGE : null
}
