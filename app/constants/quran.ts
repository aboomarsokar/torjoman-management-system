/** ثوابتُ المصحف وبرنامجِ الحفظ، وتسميةُ إنجاز الشهر بالأجزاء والصفحات. */

/** صفحاتُ المصحف. */
export const MUSHAF_PAGES = 604

/** أجزاءُ البرنامج (على حدود السور، مرقّمةٌ بترتيب الحفظ 30←1). */
export const PROGRAM_JUZ_COUNT = 30

/** صفحاتُ الجزء بحساب المعلّمين (604 ÷ 30 ≈ 20.13 فيُعَدّ عشرين) — فلا كسورَ عشرية. */
export const PAGES_PER_JUZ = 20

/**
 * أوّلُ شهرٍ يُقسَّط فيه المطلوبُ بالحضور: أوّلُ شهرٍ في المشروع (10-2026). كان من 11 (قرار 2026-10-19)
 * ثم طلب المستخدم تقسيطَ أكتوبر أيضاً (2026-11-02) — ومرآتُه في القاعدة `halaqa_student_achievement`.
 */
export const ATTENDANCE_PRORATION_FROM = { year: 2026, month: 10 } as const

/** هل يُقسَّط مطلوبُ هذا الشهر بالحضور؟ */
export function prorationApplies(year: number, month: number): boolean {
  const from = ATTENDANCE_PRORATION_FROM
  return year > from.year || (year === from.year && month >= from.month)
}

/**
 * تخفيضُ المطلوب الشهريّ لمن اختُبر في الشهر (قرار المستخدم 2026-11-02): المراجعةُ للاختبار تأخذ من وقت الحفظ الجديد.
 * المفتاحُ عددُ أجزاء الدورة (`parts_to - parts_from + 1`)، والقيمةُ **أثلاثٌ** من المطلوب: 3 أجزاء الثلث، 5 الثلثان،
 * 10 المطلوبُ كلُّه؛ مرّةً في الشهر بأكبرها، نجح أو لم ينجح. مرآتُها في القاعدة `private.halaqa_student_achievement`.
 */
export const EXAM_RELIEF_THIRDS: Readonly<Record<number, number>> = { 3: 1, 5: 2, 10: 3 }

/** أثلاثُ التخفيض لاختبار دورةٍ بعدد أجزائها (0 لما لا يقابله تخفيض). */
export function examReliefThirds(parts: number): number {
  return EXAM_RELIEF_THIRDS[parts] ?? 0
}

/** «الثلث» / «الثلثان» / «كامل المطلوب» لشارة التخفيض. */
export function reliefLabel(thirds: number): string {
  return thirds >= 3 ? 'كامل المطلوب' : thirds === 2 ? 'الثلثان' : 'الثلث'
}

/** نهايةُ المسار: الفاتحة 1:7 — من بلغها ختم. */
export const KHATM_POSITION = { surah: 1, ayah: 7 } as const

/** عددٌ بالمفرد والمثنّى والجمع العربيّ: «جزء/جزءان/3 أجزاء/11 جزءاً». */
function counted(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one
  if (n === 2) return two
  return n <= 10 ? `${n} ${few}` : `${n} ${many}`
}

/**
 * إنجازُ الشهر بالأجزاء من صفحاته المرصودة: «جزء و5 صفحات» لا «1.25 جزء».
 * دون الجزء الواحد `null` (الصفحاتُ وحدَها تكفي و«0 جزء» تُقرأ تقصيراً).
 */
export function monthlyJuzLabel(pages: number): string | null {
  const juz = Math.floor(pages / PAGES_PER_JUZ)
  const rest = pages - juz * PAGES_PER_JUZ
  if (juz < 1) return null

  const juzText = counted(juz, 'جزء', 'جزءان', 'أجزاء', 'جزءاً')
  if (rest === 0) return juzText
  return `${juzText} و${counted(rest, 'صفحة', 'صفحتان', 'صفحات', 'صفحة')}`
}
