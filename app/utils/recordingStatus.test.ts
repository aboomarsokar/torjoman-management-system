import { describe, expect, it } from 'vitest'
import { daysLeft, isLagging, parseRecent, recordingSummary, reportState, sortByLag, weekdayName, weekdayShort, type RecordingRow } from './recordingStatus'

const row = (name: string, o: Partial<RecordingRow> = {}): RecordingRow => ({
  halaqa_id: name, halaqa_name: name, gender: 'male', teacher_name: null, teacher_phone: null, teacher_whatsapp: null,
  today: '2026-10-22', recorded_today: true, expected_days: 5, recorded_days: 5, missed_days: [], recent: [],
  report_year: 2026, report_month: 9, report_status: 'submitted', report_deadline: '2026-10-03', ...o
})

describe('reportState', () => {
  it('المعتمدُ والمُرسَل كما هما', () => {
    expect(reportState(row('أ', { report_status: 'approved' }))).toBe('approved')
    expect(reportState(row('أ', { report_status: 'submitted' }))).toBe('submitted')
  })
  it('المسوّدةُ وما لم يبدأ: متأخّرٌ بعد المهلة، ومستحقٌّ قبلها وفي يومها', () => {
    expect(reportState(row('أ', { report_status: 'draft' }))).toBe('late')
    expect(reportState(row('أ', { report_status: null }))).toBe('late')
    expect(reportState(row('أ', { report_status: null, today: '2026-10-03' }))).toBe('due')
  })
})

describe('daysLeft', () => {
  it('الأيامُ الباقية، و0 في يوم المهلة', () => {
    expect(daysLeft(row('أ', { today: '2026-10-01' }))).toBe(2)
    expect(daysLeft(row('أ', { today: '2026-10-03' }))).toBe(0)
  })
})

describe('isLagging / sortByLag / recordingSummary', () => {
  const late = row('متأخّر', { report_status: 'draft' })
  const missed2 = row('فاتها يومان', { missed_days: ['2026-10-19', '2026-10-20'] })
  const missed1 = row('فاتها يوم', { missed_days: ['2026-10-20'] })
  const notToday = row('لم يُرصد اليوم', { recorded_today: false })
  const fine = row('منتظمة')

  it('اليومُ الجاري بلا رصدٍ ليس تقصيراً', () => {
    expect(isLagging(notToday)).toBe(false)
    expect(isLagging(missed1)).toBe(true)
    expect(isLagging(late)).toBe(true)
  })
  it('الأشدُّ أولاً', () => {
    expect(sortByLag([fine, notToday, missed1, late, missed2]).map(r => r.halaqa_name))
      .toEqual(['متأخّر', 'فاتها يومان', 'فاتها يوم', 'لم يُرصد اليوم', 'منتظمة'])
  })
  it('الملخّص', () => {
    expect(recordingSummary([fine, notToday, missed1, late])).toEqual({ halqat: 4, today: 3, lagging: 2, lateReports: 1 })
  })
})

describe('parseRecent / weekdayName', () => {
  it('يُسقط ما لا يُفهم', () => {
    expect(parseRecent([{ day: '2026-10-22', state: 'today' }, { day: 3, state: 'held' }, { day: '2026-10-21', state: 'x' }]))
      .toEqual([{ day: '2026-10-22', state: 'today' }])
    expect(parseRecent(null)).toEqual([])
  })
  it('اسمُ اليوم', () => {
    expect(weekdayName('2026-10-22')).toBe('الخميس')
    expect(weekdayName('2026-10-24')).toBe('السبت')
    expect(['2026-10-18', '2026-10-21'].map(weekdayShort)).toEqual(['أحد', 'أرب'])
  })
})
