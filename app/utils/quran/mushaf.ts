/**
 * صفحاتُ المصحف من فهرس `quran_pages` (أولُ آيةٍ في كلّ صفحة، مرتَّباً بالصفحة).
 * الفهرسُ يُمرَّر معاملاً فتبقى الدوالُّ نقيّةً. `app/utils/quran/*` يُستورد صراحةً.
 */
import { comparePositions, type Position } from './position'

export interface MushafPage { page: number, surah: number, ayah: number }

/** صفحةُ الموضع: آخرُ صفحةٍ تبدأ عنده أو قبله؛ null إن كان الفهرسُ فارغاً. */
export function pageOf(index: MushafPage[], surah: number, ayah: number): MushafPage | null {
  let found: MushafPage | null = null
  for (const entry of index) {
    if (entry.surah < surah || (entry.surah === surah && entry.ayah <= ayah)) found = entry
    else break
  }
  return found ?? index[0] ?? null
}

/** أوّلُ صفحةٍ تحمل شيئاً من السورة. */
export function surahFirstPage(index: MushafPage[], surah: number): number | null {
  return pageOf(index, surah, 1)?.page ?? null
}

/** آخرُ صفحةٍ تحمل شيئاً من السورة: آخرُ صفحةٍ تبدأ فيها (التي بعدها تبدأ في التالية) — بلا عدد آياتها. */
export function surahLastPage(index: MushafPage[], surah: number): number | null {
  return pageOf(index, surah, Number.MAX_SAFE_INTEGER)?.page ?? null
}

/**
 * صفحاتُ ما حُفظ بين موضعين **بترتيب الحفظ لا بمسافة الصفحات**: يُتمّ السورةَ
 * التي بدأ فيها، ثم ما بينهما كاملاً، ثم يقف حيث وقف في الأخيرة — فيُطرح ما
 * قبل البداية في سورتها وما بعد النهاية في سورتها. الصفحةُ المشتركة تُحسب
 * كاملة (لا كسور)، وموضعان في صفحةٍ واحدة = صفحة. null إن فُقد الفهرس.
 * والنطاقُ المقلوب (البدايةُ بعد النهاية بترتيب الحفظ) يُعدَّل ببدّل الطرفين
 * فيعطي القيمةَ نفسها — الصيغةُ نفسُها غيرُ متماثلة عند تبديل المعاملين.
 */
export function pagesMemorized(index: MushafPage[], from: Position, to: Position): number | null {
  const [start, end] = comparePositions(from, to) <= 0 ? [from, to] : [to, from]
  const startPage = pageOf(index, start.surah, start.ayah)?.page ?? null
  const endPage = pageOf(index, end.surah, end.ayah)?.page ?? null
  const low = surahFirstPage(index, Math.min(start.surah, end.surah))
  const high = surahLastPage(index, Math.max(start.surah, end.surah))
  const startFirst = surahFirstPage(index, start.surah)
  const endLast = surahLastPage(index, end.surah)

  if (startPage === null || endPage === null || low === null || high === null || startFirst === null || endLast === null) {
    return null
  }

  const covered = (high - low + 1) - (startPage - startFirst) - (endLast - endPage)
  return Math.max(covered, 1)
}
