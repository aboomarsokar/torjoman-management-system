import { describe, expect, it } from 'vitest'
import { halaqaBreakdown, monthGrading, pendingQueue, type ExaminerItem } from './examinerDashboard'

const item = (id: string, halaqa: string, created: string, result: ExaminerItem['result'] = null): ExaminerItem =>
  ({ id, created_at: created, halaqa_id: halaqa, result })
const items: ExaminerItem[] = [
  item('1', 'h1', '2026-10-15T08:00:00Z'),
  item('2', 'h1', '2026-10-19T08:00:00Z'),
  item('3', 'h2', '2026-10-01T08:00:00Z', { passed: true, total_score: 90, exam_date: '2026-10-05' }),
  item('4', 'h2', '2026-10-02T08:00:00Z', { passed: false, total_score: 60, exam_date: '2026-10-06' }),
  item('5', 'h2', '2026-09-02T08:00:00Z', { passed: true, total_score: 99, exam_date: '2026-09-10' })
]

describe('pendingQueue', () => {
  it('العددُ وأقدمُ ما ينتظر بالأيام', () => {
    expect(pendingQueue(items, '2026-10-22')).toEqual({ count: 2, oldestDays: 7 })
    expect(pendingQueue([], '2026-10-22')).toEqual({ count: 0, oldestDays: 0 })
  })
})

describe('monthGrading', () => {
  it('رصدُ الشهر وحده: النسبةُ من المحسوم ومتوسّطُ العلامة', () => {
    expect(monthGrading(items, '2026-10')).toEqual({ graded: 2, passed: 1, failed: 1, passPct: 50, avg: 75 })
  })
  it('شهرٌ بلا رصد', () => {
    expect(monthGrading(items, '2026-11')).toEqual({ graded: 0, passed: 0, failed: 0, passPct: null, avg: null })
  })
})

describe('halaqaBreakdown', () => {
  it('ما ينتظر أوّلاً، وما رُصد في الشهر لكلّ حلقة', () => {
    const r = halaqaBreakdown([{ id: 'h2', name: 'ب', teacher: 'ت' }, { id: 'h1', name: 'أ', teacher: 'ث' }], items, '2026-10')
    expect(r.map(h => [h.id, h.pending, h.graded])).toEqual([['h1', 2, 0], ['h2', 0, 2]])
  })
})
