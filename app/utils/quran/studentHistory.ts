/**
 * سجلُّ شهور الطالب المعتمَدة: سطرُ كلّ شهرٍ «MM-YYYY · من <سورة آية> إلى <سورة آية> · N صفحة»،
 * وآخرُ نهايةٍ معتمَدة لحساب «وصل N من 30 جزءاً». نقيٌّ ومختبَر؛ يغذّي بطاقةَ الرحلة
 * (الطالب والموظّف) والرابطَ العامّ. المواضعُ قد تغيب في سجلٍّ قديم فتُحذف عبارةُ المدى.
 */
import { PROGRAM_JUZ_COUNT } from '~/constants/quran'
import { periodLabel } from '~/utils/reportWindow'
import type { Position, ProgramJuz } from '~/utils/quran/position'
import { comparePositions, completedJuz } from '~/utils/quran/position'

/** شهرٌ معتمَد لطالب: من `my_quran_months()` أو من `quran_records` المعتمدة. */
export interface ApprovedMonth {
  report_year: number
  report_month: number
  from_surah: number | null
  from_ayah: number | null
  to_surah: number | null
  to_ayah: number | null
  pages_memorized: number
  pages_reviewed?: number | null
}

export interface MonthHistoryItem {
  /** مفتاحٌ ثابت للعرض. */
  key: string
  /** السطرُ الكامل الجاهز للعرض. */
  text: string
}

function positionOf(surah: number | null, ayah: number | null): Position | null {
  return surah === null || ayah === null ? null : { surah, ayah }
}

/** «<اسم السورة> <آية>»؛ رقمُ السورة إن لم تُحمَّل الأسماء بعد. */
export function formatPosition(p: Position, surahName: (n: number) => string): string {
  return `${surahName(p.surah) || p.surah} ${p.ayah}`
}

const monthKey = (m: ApprovedMonth) => m.report_year * 12 + m.report_month

/** الأحدثُ شهراً أولاً ثم الأبعدُ نهايةً؛ لا تغيّر المدخلات. */
function newestFirst(rows: ApprovedMonth[]): ApprovedMonth[] {
  return [...rows].sort((a, b) => {
    if (monthKey(a) !== monthKey(b)) return monthKey(b) - monthKey(a)
    const ea = positionOf(a.to_surah, a.to_ayah)
    const eb = positionOf(b.to_surah, b.to_ayah)
    if (ea && eb) return comparePositions(eb, ea)
    return ea ? -1 : eb ? 1 : 0
  })
}

/** أسطرُ السجلّ بالأحدث أولاً. */
export function toMonthHistory(rows: ApprovedMonth[], surahName: (n: number) => string): MonthHistoryItem[] {
  return newestFirst(rows).map((r, i) => {
    const from = positionOf(r.from_surah, r.from_ayah)
    const to = positionOf(r.to_surah, r.to_ayah)
    const range = from && to ? ` · من ${formatPosition(from, surahName)} إلى ${formatPosition(to, surahName)}` : ''
    return {
      key: `${periodLabel(r.report_year, r.report_month)}-${i}`,
      text: `${periodLabel(r.report_year, r.report_month)}${range} · ${r.pages_memorized} صفحة`
    }
  })
}

/** آخرُ نهايةٍ معتمَدة (الأحدثُ شهراً ثم الأبعدُ موضعاً)؛ null إن لم يكن لأيّ شهرٍ موضعٌ. */
export function lastApprovedEnd(rows: ApprovedMonth[]): Position | null {
  for (const r of newestFirst(rows)) {
    const end = positionOf(r.to_surah, r.to_ayah)
    if (end) return end
  }
  return null
}

/** مجموعُ صفحات الحفظ المعتمدة. */
export function totalPages(rows: ApprovedMonth[]): number {
  return rows.reduce((sum, r) => sum + (r.pages_memorized ?? 0), 0)
}

/**
 * أجزاءُ البرنامج التي وصل إليها: الأعلى من المكتمل حتى آخر نهايةٍ معتمَدة وما كان يحفظه عند التحاقه
 * (`quran_parts`) — كما في شاشة الإنجاز الشهرية، فلا يبدأ من صفرٍ طالبٌ التحق بحفظٍ سابق.
 */
export function juzReached(rows: ApprovedMonth[], quranParts: number | null, juz: ProgramJuz[]): number {
  const held = Math.max(0, Math.min(PROGRAM_JUZ_COUNT, quranParts ?? 0))
  return Math.max(completedJuz(lastApprovedEnd(rows), juz), held)
}
