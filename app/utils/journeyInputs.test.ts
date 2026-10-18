import { describe, expect, it } from 'vitest'
import { buildJourney } from './journey'
import { toApprovedPages, toJourneyResults } from './journeyInputs'

describe('toJourneyResults', () => {
  it('يحمل المحطّة والنجاح والدرجة ويُسقط التاريخ', () => {
    expect(toJourneyResults([{ exam_plan_id: 3, passed: true, total_score: 90, exam_date: '2026-10-02' }]))
      .toEqual([{ exam_plan_id: 3, passed: true, total_score: 90 }])
  })
  it('الفارغ والـnull قائمةٌ فارغة', () => {
    expect(toJourneyResults(null)).toEqual([])
    expect(toJourneyResults(undefined)).toEqual([])
  })
  it('محطّةٌ مجتازة تظهر مجتازةً في الرحلة لا «مستحقّة» (علّة التضمين الأعمى)', () => {
    const plan = [{ id: 1, parts_from: 1, parts_to: 5, stage_type: 'partial' as const }]
    const rows = [{ exam_plan_id: 1, passed: true, total_score: 90, exam_date: '2026-10-02' }]
    expect(buildJourney(5, plan, toJourneyResults(rows)).stations[0]!.result).toBe('passed')
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
