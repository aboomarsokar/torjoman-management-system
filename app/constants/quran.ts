/** ثوابتُ المصحف وبرنامجِ الحفظ، وتسميةُ إنجاز الشهر بالأجزاء والصفحات. */

/** صفحاتُ المصحف. */
export const MUSHAF_PAGES = 604

/** أجزاءُ البرنامج (على حدود السور، مرقّمةٌ بترتيب الحفظ 30←1). */
export const PROGRAM_JUZ_COUNT = 30

/** صفحاتُ الجزء بحساب المعلّمين (604 ÷ 30 ≈ 20.13 فيُعَدّ عشرين) — فلا كسورَ عشرية. */
export const PAGES_PER_JUZ = 20

/**
 * أوّلُ شهرٍ يُقسَّط فيه المطلوبُ بالحضور. رصدُ الحضور أُطلق في 19/10/2026، فالشهرُ 10 وما قبله
 * مطلوبُه كاملٌ للجميع (قرار 2026-10-19) — لا نسبةَ على شهرٍ لم يُسجَّل حضورُه كلُّه.
 */
export const ATTENDANCE_PRORATION_FROM = { year: 2026, month: 11 } as const

/** هل يُقسَّط مطلوبُ هذا الشهر بالحضور؟ */
export function prorationApplies(year: number, month: number): boolean {
  const from = ATTENDANCE_PRORATION_FROM
  return year > from.year || (year === from.year && month >= from.month)
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
