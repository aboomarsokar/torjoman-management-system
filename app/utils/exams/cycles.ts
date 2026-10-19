/**
 * دوراتُ الاختبار المرحليّة (جدول `exam_cycles`): التسميات، الدورةُ المستحقّة، وحدودُ كلّ دورةٍ
 * من تقسيمة البرنامج. دوالُّ نقيّة. ملاحظة: `app/utils/exams/*` لا يُستورد تلقائياً — يُستورد صراحةً.
 */
import { comparePositions, type Position, type ProgramJuz } from '~/utils/quran/position'

export interface ExamCycle {
  id: number
  stage_number: number
  cycle_number: number
  parts_from: number
  parts_to: number
  surahs_label: string
  sort_order: number
}

/** أعمدةُ `exam_cycles` كاملةً لكلّ قارئٍ داخليّ. */
export const CYCLE_COLUMNS = 'id, stage_number, cycle_number, parts_from, parts_to, surahs_label, sort_order'
/** أعمدةُ الصفحة العامّة: بلا `surahs_label` (لا تُعرض هناك فلا تُرسَل). */
export const PUBLIC_CYCLE_COLUMNS = 'id, stage_number, cycle_number, parts_from, parts_to, sort_order'

/** صفُّ `exam_cycles` كما يعود من القاعدة (`sort_order` قابلٌ للفراغ في الأنواع). */
export type ExamCycleRow = Omit<ExamCycle, 'sort_order'> & { sort_order: number | null }

/** صفُّ القاعدة ← دورة (الترتيبُ الفارغ صفر)؛ يقبل الصفَّ الكامل أو المقصورَ على أعمدة الصفحة العامّة. */
export function toExamCycle<T extends { sort_order: number | null }>(r: T): Omit<T, 'sort_order'> & { sort_order: number } {
  return { ...r, sort_order: r.sort_order ?? 0 }
}

export const STAGE_LABELS: Record<number, string> = {
  1: 'المرحلة الأولى',
  2: 'المرحلة الثانية',
  3: 'المرحلة الثالثة'
}

export const CYCLE_LABELS: Record<number, string> = {
  1: 'الدورة الأولى',
  2: 'الدورة الثانية',
  3: 'الدورة الثالثة',
  4: 'الدورة الرابعة',
  5: 'الدورة الخامسة'
}

/** «المرحلة الأولى · الدورة الأولى». */
export function cycleLabel(c: ExamCycle): string {
  return `${STAGE_LABELS[c.stage_number] ?? `المرحلة ${c.stage_number}`} · ${CYCLE_LABELS[c.cycle_number] ?? `الدورة ${c.cycle_number}`}`
}

/** «الأجزاء 28–30 (المجادلة – الناس)». */
export function cycleRange(c: ExamCycle): string {
  return `الأجزاء ${c.parts_from}–${c.parts_to} (${c.surahs_label})`
}

/** «المرحلة الأولى · الدورة الثانية — الأجزاء 26–30»: سطرُ المحطة القادمة بلا أسماء السور. */
export function cycleShort(c: ExamCycle): string {
  return `${cycleLabel(c)} — الأجزاء ${c.parts_from}–${c.parts_to}`
}

/** عددُ أجزاء الدورة نفسها. */
export function partsCount(c: ExamCycle): number {
  return c.parts_to - c.parts_from + 1
}

/**
 * عددُ الأجزاء المحقَّق بالاجتياز (من الناس): 31 − parts_from.
 * ويُقارَن به `students.quran_parts` لمعرفة هل بلغ الطالبُ حدودَ الدورة.
 */
export function partsAfterPass(c: ExamCycle): number {
  return 31 - c.parts_from
}

/**
 * الدورةُ المستحقّة = أوّلُ دورةٍ بـ`sort_order` لم يجتزها الطالب (لا قفزَ فوق دورة).
 * `blocked: 'pending'` إن كانت لها ترشيحٌ بلا نتيجة (تبقى الدورةُ معروضةً)، و`'done'` إن اجتاز الكلَّ.
 */
export function dueCycle(
  cycles: ExamCycle[],
  passedIds: Set<number>,
  pendingIds: Set<number>
): { cycle: ExamCycle | null, blocked: 'pending' | 'done' | null } {
  const next = [...cycles].sort((a, b) => a.sort_order - b.sort_order).find(c => !passedIds.has(c.id))
  if (!next) return { cycle: null, blocked: 'done' }
  return { cycle: next, blocked: pendingIds.has(next.id) ? 'pending' : null }
}

/** تنبيهٌ إن لم يبلغ موضعُ الطالب المعتمد (عددُ أجزائه) حدودَ الدورة؛ وإلا null. */
export function reachedHint(c: ExamCycle, juzReached: number): string | null {
  return juzReached < partsAfterPass(c) ? 'لم يبلغ موضعُه المعتمد حدودَ هذه الدورة بعد' : null
}

/**
 * حدودُ الدورة من تقسيمة البرنامج (طلب المستخدم 2026-10-19: «الاختبارات بناءً على تقسيمة الأجزاء»):
 * البداية = بدايةُ الجزء parts_to، والنهاية = نهايةُ الجزء parts_from — بترتيب الحفظ.
 * null إن غاب أحدُ الجزءين من التقسيمة.
 */
export function cycleSpan(c: ExamCycle, juz: ProgramJuz[]): { from: Position, to: Position } | null {
  const first = juz.find(j => j.number === c.parts_to)
  const last = juz.find(j => j.number === c.parts_from)
  if (!first || !last) return null
  if (comparePositions(first.start, last.end) > 0) return null
  return { from: { ...first.start }, to: { ...last.end } }
}

/** «من الناس 1 إلى المجادلة 22»؛ نصٌّ فارغ إن تعذّر الحساب. */
export function cycleSpanLabel(c: ExamCycle, juz: ProgramJuz[], surahName: (n: number) => string): string {
  const s = cycleSpan(c, juz)
  if (!s) return ''
  return `من ${surahName(s.from.surah)} ${s.from.ayah} إلى ${surahName(s.to.surah)} ${s.to.ayah}`
}
