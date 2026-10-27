import { describe, expect, it } from 'vitest'
import { mirrorPeriods } from './useQuranMirror'

describe('mirrorPeriods', () => {
  it('السابقُ ثمّ الجاري', () => {
    expect(mirrorPeriods('2026-11-03')).toEqual([{ year: 2026, month: 10 }, { year: 2026, month: 11 }])
    expect(mirrorPeriods('2027-01-10')).toEqual([{ year: 2026, month: 12 }, { year: 2027, month: 1 }])
  })
  it('لا شهرَ قبل بداية المشروع', () => {
    expect(mirrorPeriods('2026-10-27')).toEqual([{ year: 2026, month: 10 }])
  })
})
