/** رحلة الطالب على دورات الاختبار. */
import { describe, expect, it } from 'vitest'
import { buildJourney } from './journey'
import type { ExamCycle } from './exams/cycles'

const mk = (id: number, from: number, to: number, sort = id): ExamCycle =>
  ({ id, stage_number: 1, cycle_number: id, parts_from: from, parts_to: to, surahs_label: '', sort_order: sort })
const CYCLES = [mk(1, 28, 30), mk(2, 26, 30), mk(3, 23, 25)]

describe('buildJourney (الدورات)', () => {
  it('ثلاثةُ أجزاء ← الدورة 1 «بُلغت» وهي المستحقّة الآن', () => {
    const j = buildJourney(3, CYCLES, [])
    expect(j.stations.map(s => s.reached)).toEqual([true, false, false])
    expect(j.nextStation?.cycle.id).toBe(1)
    expect(j.reachedCount).toBe(1)
    expect(j.totalStations).toBe(3)
  })
  it('بلا أجزاء ← لا محطّةَ مستحقّة، والقادمةُ الأولى', () => {
    const j = buildJourney(null, CYCLES, [])
    expect(j.nextStation).toBeNull()
    expect(j.upcomingStation?.cycle.id).toBe(1)
  })
  it('المحطّاتُ بـsort_order لا بترتيب المدخلات', () => {
    expect(buildJourney(30, [...CYCLES].reverse(), []).stations.map(s => s.cycle.id)).toEqual([1, 2, 3])
  })
  it('الاجتيازُ يُنقل المستحقّة إلى التالية', () => {
    const j = buildJourney(10, CYCLES, [{ exam_cycle_id: 1, passed: true, total_score: 90 }])
    expect(j.stations[0]).toMatchObject({ result: 'passed', score: 90, isNext: false })
    expect(j.nextStation?.cycle.id).toBe(2)
    expect(j.passedCount).toBe(1)
    expect(j.upcomingStation?.cycle.id).toBe(2)
  })
  it('نجاحٌ ثم رسوب ← تبقى مجتازة (بدرجة النجاح)', () => {
    const j = buildJourney(3, CYCLES, [
      { exam_cycle_id: 1, passed: true, total_score: 85 },
      { exam_cycle_id: 1, passed: false, total_score: 40 }
    ])
    expect(j.stations[0]).toMatchObject({ result: 'passed', score: 85 })
  })
  it('رسوبٌ ثم نجاح ← مجتازة', () => {
    const j = buildJourney(3, CYCLES, [
      { exam_cycle_id: 1, passed: false, total_score: 40 },
      { exam_cycle_id: 1, passed: true, total_score: 85 }
    ])
    expect(j.stations[0]!.result).toBe('passed')
  })
  it('رسوبٌ وحده ← failed وتبقى مستحقّةً', () => {
    const j = buildJourney(3, CYCLES, [{ exam_cycle_id: 1, passed: false, total_score: 40 }])
    expect(j.stations[0]).toMatchObject({ result: 'failed', isNext: true })
  })
  it('نتائجُ بلا دورة (قديمة) تُهمل', () => {
    const j = buildJourney(3, CYCLES, [{ exam_cycle_id: null, passed: true, total_score: 90 }])
    expect(j.passedCount).toBe(0)
  })
})
