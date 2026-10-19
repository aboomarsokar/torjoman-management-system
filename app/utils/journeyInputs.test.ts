import { describe, expect, it } from 'vitest'
import { buildJourney } from './journey'
import { toApprovedPages, toCycleResults } from './journeyInputs'

describe('toCycleResults', () => {
  it('يحمل الدورة والنجاح والدرجة ويُسقط التاريخ', () => {
    expect(toCycleResults([{ exam_cycle_id: 4, passed: true, total_score: 91, exam_date: '2026-10-02' }]))
      .toEqual([{ exam_cycle_id: 4, passed: true, total_score: 91 }])
  })
  it('الفارغ والـnull قائمةٌ فارغة', () => {
    expect(toCycleResults(null)).toEqual([])
    expect(toCycleResults(undefined)).toEqual([])
  })
  it('كلُّ المحاولات تمرّ والرحلةُ تختار: نجاحٌ ثم رسوبٌ ← مجتازة', () => {
    const cycles = [{ id: 1, stage_number: 1, cycle_number: 1, parts_from: 28, parts_to: 30, surahs_label: '', sort_order: 1 }]
    const rows = [
      { exam_cycle_id: 1, passed: true, total_score: 88, exam_date: '2026-10-02' },
      { exam_cycle_id: 1, passed: false, total_score: 50, exam_date: '2026-10-09' }
    ]
    expect(buildJourney(3, cycles, toCycleResults(rows)).stations[0]).toMatchObject({ result: 'passed', score: 88 })
  })
})

describe('toApprovedPages', () => {
  it('أعدادٌ سليمة', () => {
    expect(toApprovedPages(30)).toBe(30)
    expect(toApprovedPages('7')).toBe(7)
  })
  it('الفارغ وغير الصالح صفر', () => {
    expect(toApprovedPages(null)).toBe(0)
    expect(toApprovedPages(undefined)).toBe(0)
    expect(toApprovedPages('x')).toBe(0)
    expect(toApprovedPages(-3)).toBe(0)
  })
})
