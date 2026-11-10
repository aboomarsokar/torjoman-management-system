import { describe, expect, it } from 'vitest'
import { behindStudents, formatDuration, monthsSince, monthUnit, readingJourney, readingProgressRows, roadmapWeeks, unitMonthLabel, unitOpensOn, unitScope, weekOfMonth, type ReadingAttempt, type ReadingItem, type ReadingUnit } from './reading'

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

describe('إنجاز الطلاب للعاملين', () => {
  it('لكلّ طالبٍ مقرّرُه وحالُه، والمتأخّرُ أوّلاً', () => {
    const students = [
      { id: 'a', full_name: 'أنس', enrollment_date: '2026-07-01' },
      { id: 'b', full_name: 'بلال', enrollment_date: '2026-07-01' },
      { id: 'c', full_name: 'حمزة', enrollment_date: '2026-10-15' },
      { id: 'd', full_name: 'زيد', enrollment_date: '2026-07-01' }
    ]
    const attempts = [
      { ...attempt(1, 40, 2), student_id: 'b' },
      { ...attempt(1, 90, 60), student_id: 'd' }, { ...attempt(2, 85, 30), student_id: 'd' }, { ...attempt(3, 80, 1), student_id: 'd' }
    ]
    const rows = readingProgressRows(students, attempts, units, { retryDays: 7, now: NOW })
    expect(rows.map(r => [r.name, r.state, r.current?.id ?? null, r.passed, r.last])).toEqual([
      ['أنس', 'behind', 1, 0, null],
      ['بلال', 'waiting', 1, 0, 40],
      ['حمزة', 'new', 1, 0, null],
      ['زيد', 'done', null, 3, null]
    ])
  })
})

describe('فتحُ المقرّرات بالشهر وخارطةُ الطريق', () => {
  const sched = [
    { ...unit(1), opensOn: '2026-10-01' },
    { ...unit(2), opensOn: '2026-11-01' },
    { ...unit(3), opensOn: '2026-12-01' }
  ]
  const nov = Date.parse('2026-11-10T09:00:00Z')
  const o = { retryDays: 7, now: nov, enrollmentDate: '2026-07-01' }

  it('أتمّ ما فُتح: المستحقُّ ينتظر شهرَه ولا يُختبر', () => {
    const j = readingJourney(sched, [attempt(1, 90, 20), attempt(2, 85, 1)], o)
    expect(j).toMatchObject({ canStart: false, dueOpensOn: '2026-12-01', pace: 'onTrack', expected: 2 })
    expect(j.due?.id).toBe(3)
  })

  it('المتأخّرُ يلحق بما فُتح قبله', () => {
    const j = readingJourney(sched, [], o)
    expect(j).toMatchObject({ canStart: true, dueOpensOn: null, pace: 'behind', expected: 2 })
  })

  it('مقرّرُ الشهر آخرُ ما فُتح، والأسبوعُ من يوم الشهر', () => {
    expect(monthUnit(sched, '2026-11-10')?.id).toBe(2)
    expect(monthUnit(sched, '2026-09-20')?.id).toBe(1)
    expect([weekOfMonth('2026-11-01'), weekOfMonth('2026-11-08'), weekOfMonth('2026-11-21'), weekOfMonth('2026-11-30')]).toEqual([1, 2, 3, 4])
  })

  it('الأسابيعُ مرتّبةً بالبنود، والمدّةُ مقروءة', () => {
    const item = (week: number, sort_order: number, kind: ReadingItem['kind'] = 'pages'): ReadingItem =>
      ({ week, sort_order, kind, book: 'صفقات رابحة', page_from: 1, page_to: 2, title: null, speaker: null, durationSeconds: null, url: null })
    expect(roadmapWeeks({ items: [item(2, 1), item(1, 2), item(1, 1, 'lecture')] }).map(w => [w.week, w.items.map(i => i.sort_order)]))
      .toEqual([[1, [1, 2]], [2, [1]]])
    expect([formatDuration(5044), formatDuration(1723), formatDuration(null)]).toEqual(['1:24:04', '28:43', ''])
  })
})

describe('شهرُ المقرّر', () => {
  it('من موعد فتحه', () => {
    expect(unitMonthLabel('2026-11-01')).toBe('نوفمبر 2026')
    expect(unitMonthLabel('2027-08-01')).toBe('أغسطس 2027')
    expect(unitMonthLabel(null)).toBe('')
    expect([unitOpensOn(1), unitOpensOn(3), unitOpensOn(12)]).toEqual(['2026-10-01', '2026-12-01', '2027-09-01'])
  })
})
