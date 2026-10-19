/**
 * مواضعُ الحفظ: يمشي الطالب من الناس إلى الفاتحة — السورةُ تنازلياً والآيةُ
 * داخلها تصاعدياً. ملاحظة: `app/utils/quran/*` لا يُستورد تلقائياً (Nuxt يمسح
 * المستوى الأول فقط) فيُستورد صراحةً.
 */
import { KHATM_POSITION } from '~/constants/quran'
import type { Database } from '~/types/database.types'

export interface Position { surah: number, ayah: number }

/** جزءُ البرنامج (صفُّ `program_juz`): على حدود السور، مرقّمٌ بترتيب الحفظ 30←1. */
export interface ProgramJuz { number: number, start: Position, end: Position }

type ProgramJuzRow = Database['public']['Tables']['program_juz']['Row']

/** صفوفُ `program_juz` ← أجزاءُ الموضع بترتيب الحفظ (الجزء 30 أولاً ثم 29 … 1)؛ لا تغيّر المدخلات. */
export function toProgramJuz(rows: Pick<ProgramJuzRow, 'number' | 'start_surah' | 'start_ayah' | 'end_surah' | 'end_ayah'>[]): ProgramJuz[] {
  return rows
    .map(r => ({
      number: r.number,
      start: { surah: r.start_surah, ayah: r.start_ayah },
      end: { surah: r.end_surah, ayah: r.end_ayah }
    }))
    .sort((a, b) => b.number - a.number)
}

/** سالبٌ إن سبق `a` الموضعَ `b` بترتيب الحفظ. */
export function comparePositions(a: Position, b: Position): number {
  if (a.surah !== b.surah) return b.surah - a.surah
  return a.ayah - b.ayah
}

/** هل `from` ≤ `to` بترتيب الحفظ؟ */
export function isInMemorizationOrder(from: Position, to: Position): boolean {
  return comparePositions(from, to) <= 0
}

/** الآيةُ التي تلي نهايةً بترتيب الحفظ؛ null بعد الفاتحة 1:7 (الختم). */
export function nextPosition(end: Position, ayahCountOf: (surah: number) => number): Position | null {
  if (end.ayah < ayahCountOf(end.surah)) return { surah: end.surah, ayah: end.ayah + 1 }
  if (end.surah === 1) return null
  return { surah: end.surah - 1, ayah: 1 }
}

/** الأجزاءُ المكتملة حتى آخر موضعٍ معتمَد: كلُّ جزءٍ نهايتُه ≤ الموضع. */
export function completedJuz(lastEnd: Position | null, juz: ProgramJuz[]): number {
  if (!lastEnd) return 0
  return juz.filter(j => comparePositions(j.end, lastEnd) <= 0).length
}

/** بدايةُ رصد طالبٍ بلا سجلٍّ سابق: أوّلُ الجزء الذي يلي ما يحفظه (0 ← الناس 1)، وnull لمن أتمّ الثلاثين. */
export function startForNewStudent(quranParts: number, juz: ProgramJuz[]): Position | null {
  const next = juz.find(j => j.number === 30 - Math.max(0, Math.min(30, quranParts)))
  return next ? { ...next.start } : null
}

/** هل الموضعُ نهايةُ المسار (الفاتحة 1:7)؟ */
export function isKhatm(p: Position | null): boolean {
  return !!p && p.surah === KHATM_POSITION.surah && p.ayah === KHATM_POSITION.ayah
}
