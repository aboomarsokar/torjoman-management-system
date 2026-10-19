/** تاريخُ نهايات الرصد ونطاقُ الشهر. */
import { describe, expect, it } from 'vitest'
import { latestEnds, monthRange } from './monthHistory'
import type { HistoryRow } from './monthHistory'

const row = (student_id: string, y: number, m: number, status: string, surah: number, ayah: number): HistoryRow =>
  ({ student_id, to_surah: surah, to_ayah: ayah, report: { report_year: y, report_month: m, status } })

describe('latestEnds', () => {
  const rows = [
    row('a', 2026, 8, 'approved', 114, 6),
    row('a', 2026, 9, 'submitted', 113, 5),
    row('a', 2026, 10, 'draft', 112, 2),
    row('b', 2025, 12, 'approved', 114, 3)
  ]
  it('يختار الأحدثَ قبل الشهر المعطى ويتجاهل الشهر نفسه وما بعده', () => {
    expect(latestEnds(rows, { year: 2026, month: 10 }, false)).toEqual({
      a: { surah: 113, ayah: 5 }, b: { surah: 114, ayah: 3 }
    })
  })
  it('المعتمَدُ وحدَه', () => {
    expect(latestEnds(rows, { year: 2026, month: 10 }, true)).toEqual({
      a: { surah: 114, ayah: 6 }, b: { surah: 114, ayah: 3 }
    })
  })
  it('عبورُ السنة: يناير يرى ديسمبر السابق', () => {
    expect(latestEnds(rows, { year: 2026, month: 1 }, false)).toEqual({ b: { surah: 114, ayah: 3 } })
  })
  it('في الشهر الواحد الأبعدُ موضعاً (سجلّان من حلقتين)', () => {
    const two = [row('a', 2026, 9, 'approved', 113, 2), row('a', 2026, 9, 'approved', 112, 1)]
    expect(latestEnds(two, { year: 2026, month: 10 }, false).a).toEqual({ surah: 112, ayah: 1 })
  })
  it('يتجاهل سجلاً بلا موضعٍ أو بلا تقرير', () => {
    const bad: HistoryRow[] = [{ student_id: 'a', to_surah: null, to_ayah: null, report: { report_year: 2026, report_month: 9, status: 'approved' } },
      { student_id: 'a', to_surah: 114, to_ayah: 1, report: null }]
    expect(latestEnds(bad, { year: 2026, month: 10 }, false)).toEqual({})
  })
})

describe('monthRange', () => {
  it('أولُ الشهر وآخره', () => {
    expect(monthRange(2026, 10)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(monthRange(2026, 2)).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(monthRange(2028, 2)).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })
})
