import { describe, expect, it } from 'vitest'
import { behindStudents, monthsSince, readingJourney, unitScope, type ReadingAttempt, type ReadingUnit } from './reading'

const unit = (id: number, parts = [{ book: 'صفقات رابحة', author: null, page_from: 1, page_to: 88 }]): ReadingUnit =>
  ({ id, sort_order: id, title: `المقرّر ${id}`, parts })
const units = [unit(1), unit(2), unit(3)]
const NOW = Date.parse('2026-10-21T09:00:00Z')
const days = (n: number) => new Date(NOW - n * 86400000).toISOString()
const attempt = (unitId: number, percent: number | null, submittedDaysAgo: number | null, extra: Partial<ReadingAttempt> = {}): ReadingAttempt => ({
  id: `${unitId}-${submittedDaysAgo}`,
  unit_id: unitId,
  started_at: days((submittedDaysAgo ?? 0) + 0.01),
  deadline_at: days((submittedDaysAgo ?? 0) - 0.01),
  submitted_at: submittedDaysAgo === null ? null : days(submittedDaysAgo),
  score: percent === null ? null : percent / 5,
  total: 20,
  percent,
  passed: percent === null ? null : percent >= 80,
  ...extra
})
const opts = { retryDays: 7, now: NOW, enrollmentDate: '2026-07-01' }

describe('مسار القراءة', () => {
  it('نطاقُ المقرّر يجمع كتبه', () => {
    expect(unitScope(unit(3, [
      { book: 'صفقات رابحة', author: null, page_from: 165, page_to: 196 },
      { book: 'اليوم النبوي', author: null, page_from: 1, page_to: 124 }
    ]))).toBe('صفقات رابحة 165–196 + اليوم النبوي 1–124')
  })

  it('بلا محاولات: الأولُ مستحقّ والباقي مقفل، ويبدأ', () => {
    const j = readingJourney(units, [], opts)
    expect(j.stations.map(s => s.status)).toEqual(['due', 'locked', 'locked'])
    expect(j).toMatchObject({ passedCount: 0, canStart: true, retryOn: null })
  })

  it('النجاحُ ينقل إلى التالي، وأعلى نسبةٍ تُعرض', () => {
    const j = readingJourney(units, [attempt(1, 60, 20), attempt(1, 90, 10)], opts)
    expect(j.stations[0]).toMatchObject({ status: 'passed', best: 90, attempts: 2 })
    expect(j.due?.id).toBe(2)
  })

  it('رسوبٌ قبل أقلّ من أسبوع: ينتظر حتى تاريخه', () => {
    const j = readingJourney(units, [attempt(1, 50, 2)], opts)
    expect(j).toMatchObject({ canStart: false, retryOn: '2026-10-26' })
  })

  it('علامةُ آخر محاولة للمستحقّ — الأحدثُ لا الأعلى', () => {
    const j = readingJourney(units, [attempt(1, 70, 20), attempt(1, 40, 2)], opts)
    expect(j.stations[0]).toMatchObject({ status: 'due', best: 70, last: 40, attempts: 2 })
  })

  it('رسوبٌ قبل أكثر من أسبوع: يعيد', () => {
    expect(readingJourney(units, [attempt(1, 50, 8)], opts)).toMatchObject({ canStart: true, retryOn: null })
  })

  it('محاولةٌ مفتوحةٌ في وقتها تُستأنف ولو كان ينتظر', () => {
    const open = attempt(1, null, null, { deadline_at: new Date(NOW + 600000).toISOString() })
    const j = readingJourney(units, [attempt(1, 50, 2), open], opts)
    expect(j.open?.id).toBe(open.id)
    expect(j.canStart).toBe(true)
  })

  it('المتوقّعُ مقرّرٌ لكلّ شهرٍ منذ الالتحاق، والتقدّمُ مقارنةٌ به', () => {
    expect(monthsSince('2026-07-01', NOW)).toBe(3)
    expect(readingJourney(units, [attempt(1, 90, 30)], opts)).toMatchObject({ expected: 3, pace: 'behind' })
    expect(readingJourney(units, [], { ...opts, enrollmentDate: '2026-10-10' }).pace).toBeNull()
  })

  it('أتمّ المقرّرات كلّها: لا مستحقّ', () => {
    const j = readingJourney(units, [attempt(1, 90, 60), attempt(2, 85, 30), attempt(3, 80, 1)], opts)
    expect(j).toMatchObject({ due: null, canStart: false, passedCount: 3, pace: 'onTrack' })
  })

  it('المتأخّرون: الفرقُ بين المتوقّع والمجتاز', () => {
    const students = [
      { id: 'a', full_name: 'أنس', enrollment_date: '2026-07-01' },
      { id: 'b', full_name: 'بلال', enrollment_date: '2026-10-01' }
    ]
    expect(behindStudents(students, new Map([['a', 1]]), 3, NOW)).toEqual([{ id: 'a', name: 'أنس', count: 2 }])
  })
})
