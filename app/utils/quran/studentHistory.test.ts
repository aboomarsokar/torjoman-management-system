/** سجلُّ شهور الطالب المعتمَدة وآخرُ نهاية. */
import { describe, expect, it } from 'vitest'
import { formatPosition, juzReached, lastApprovedEnd, toMonthHistory, totalPages } from './studentHistory'
import type { ProgramJuz } from './position'
import type { ApprovedMonth } from './studentHistory'

const names: Record<number, string> = { 114: 'الناس', 113: 'الفلق', 112: 'الإخلاص' }
const name = (n: number) => names[n] ?? ''
const m = (y: number, mo: number, fs: number | null, fa: number | null, ts: number | null, ta: number | null, pages: number): ApprovedMonth =>
  ({ report_year: y, report_month: mo, from_surah: fs, from_ayah: fa, to_surah: ts, to_ayah: ta, pages_memorized: pages })

describe('formatPosition', () => {
  it('اسمُ السورة ثم الآية، وبالرقم إن غابت الأسماء', () => {
    expect(formatPosition({ surah: 114, ayah: 6 }, name)).toBe('الناس 6')
    expect(formatPosition({ surah: 99, ayah: 2 }, name)).toBe('99 2')
  })
})

describe('toMonthHistory', () => {
  it('أسطرٌ بالأحدث أولاً والشهر بالأرقام', () => {
    const rows = [m(2026, 9, 114, 1, 113, 5, 3), m(2026, 10, 113, 6, 112, 2, 4)]
    expect(toMonthHistory(rows, name).map(i => i.text)).toEqual([
      '10-2026 · من الفلق 6 إلى الإخلاص 2 · 4 صفحة',
      '09-2026 · من الناس 1 إلى الفلق 5 · 3 صفحة'
    ])
  })
  it('بلا موضعٍ: الشهر والصفحات فقط', () => {
    expect(toMonthHistory([m(2026, 8, null, null, null, null, 2)], name)[0]!.text).toBe('08-2026 · 2 صفحة')
  })
  it('لا يغيّر المدخلات', () => {
    const rows = [m(2026, 9, 114, 1, 113, 5, 3), m(2026, 10, 113, 6, 112, 2, 4)]
    toMonthHistory(rows, name)
    expect(rows[0]!.report_month).toBe(9)
  })
  it('مفاتيحُ فريدة لشهرين متساويين', () => {
    const rows = [m(2026, 9, 114, 1, 113, 5, 3), m(2026, 9, 112, 1, 111, 5, 2)]
    const keys = toMonthHistory(rows, name).map(i => i.key)
    expect(new Set(keys).size).toBe(2)
  })
})

describe('lastApprovedEnd', () => {
  it('نهايةُ الأحدث شهراً', () => {
    expect(lastApprovedEnd([m(2026, 9, 114, 1, 113, 5, 3), m(2026, 10, 113, 6, 112, 2, 4)])).toEqual({ surah: 112, ayah: 2 })
  })
  it('تتخطّى الشهر بلا موضعٍ إلى ما قبله', () => {
    expect(lastApprovedEnd([m(2026, 9, 114, 1, 113, 5, 3), m(2026, 10, null, null, null, null, 4)])).toEqual({ surah: 113, ayah: 5 })
  })
  it('في الشهر الواحد الأبعدُ موضعاً', () => {
    expect(lastApprovedEnd([m(2026, 9, 114, 1, 113, 2, 1), m(2026, 9, 112, 1, 111, 1, 1)])).toEqual({ surah: 111, ayah: 1 })
  })
  it('فارغٌ ← null', () => {
    expect(lastApprovedEnd([])).toBeNull()
  })
})

describe('totalPages', () => {
  it('المجموع وصفرٌ للفارغ', () => {
    expect(totalPages([m(2026, 9, null, null, null, null, 3), m(2026, 10, null, null, null, null, 4)])).toBe(7)
    expect(totalPages([])).toBe(0)
  })
})

describe('juzReached', () => {
  // جزءان مصغّران: 30 (الناس←الفلق) و29 (الإخلاص←المسد)
  const juz: ProgramJuz[] = [
    { number: 30, start: { surah: 114, ayah: 1 }, end: { surah: 113, ayah: 5 } },
    { number: 29, start: { surah: 112, ayah: 1 }, end: { surah: 111, ayah: 5 } }
  ]
  it('المكتملُ حتى آخر نهايةٍ معتمَدة', () => {
    expect(juzReached([m(2026, 9, 114, 1, 113, 5, 3)], 0, juz)).toBe(1)
    expect(juzReached([m(2026, 9, 114, 1, 112, 2, 3)], 0, juz)).toBe(1)
    expect(juzReached([m(2026, 9, 114, 1, 111, 5, 3)], 0, juz)).toBe(2)
  })
  it('الأعلى من المعتمَد وما كان يحفظه عند الالتحاق', () => {
    expect(juzReached([], 7, juz)).toBe(7)
    expect(juzReached([m(2026, 9, 114, 1, 111, 5, 3)], 1, juz)).toBe(2)
  })
  it('بلا شيء ← صفر، ويُقيَّد بثلاثين', () => {
    expect(juzReached([], null, juz)).toBe(0)
    expect(juzReached([], 99, juz)).toBe(30)
  })
})
