import { describe, expect, it } from 'vitest'
import { attendanceStrip, lastSchoolDays } from './attendanceStrip'

describe('lastSchoolDays', () => {
  it('يتخطّى الجمعة ويقف عند بداية المشروع', () => {
    // 2026-10-23 جمعة
    expect(lastSchoolDays('2026-10-26', '2026-10-01', 4)).toEqual(['2026-10-22', '2026-10-24', '2026-10-25', '2026-10-26'])
    expect(lastSchoolDays('2026-10-02', '2026-10-01', 15)).toEqual(['2026-10-01'])
  })
})

describe('attendanceStrip', () => {
  it('الصندوقُ يغلب، ثمّ المسجَّل، ثمّ المعتمَد، والباقي ناقص', () => {
    const strip = attendanceStrip({
      days: ['2026-09-30', '2026-10-24', '2026-10-25', '2026-10-26'],
      mirror: { '2026-10-24': { held: true, absences: {} }, '2026-10-25': { held: true, absences: {} } },
      queued: new Set(['2026-10-25']),
      approvedMonths: ['2026-09']
    })
    expect(strip.days.map(d => d.state)).toEqual(['locked', 'recorded', 'queued', 'missing'])
    expect(strip.missing).toBe(1)
  })
})

describe('attendanceStrip — بلاغ «لم تنعقد» والإجازات', () => {
  const off = (status: 'pending' | 'approved' | 'rejected') => ({ reason: 'security' as const, note: null, status, reviewNote: null })
  const none = { held: true, absences: {} }

  function stateOf(over: Partial<Parameters<typeof attendanceStrip>[0]>): string {
    return attendanceStrip({
      days: ['2026-10-25'], mirror: {}, queued: new Set(), approvedMonths: [],
      offDays: {}, holidays: {}, queuedOff: new Set(), queuedWithdraw: new Set(), ...over
    }).days[0]!.state
  }
  const d = '2026-10-25'

  it('الحالاتُ التسع بأسبقيّتها', () => {
    // 1 بلاغٌ على الجهاز يغلب كلَّ شيء
    expect(stateOf({ queuedOff: new Set([d]), queued: new Set([d]), mirror: { [d]: none }, holidays: { [d]: 'عيد' } })).toBe('off_pending')
    // 2 حضورٌ على الجهاز
    expect(stateOf({ queued: new Set([d]), mirror: { [d]: none } })).toBe('queued')
    // 3 سحبٌ على الجهاز: إجازةٌ إن كانت، وإلا ناقص
    expect(stateOf({ queuedWithdraw: new Set([d]), holidays: { [d]: 'عيد' }, mirror: { [d]: none } })).toBe('holiday')
    expect(stateOf({ queuedWithdraw: new Set([d]), offDays: { [d]: off('approved') }, mirror: { [d]: none } })).toBe('missing')
    // 4 مسجَّل
    expect(stateOf({ mirror: { [d]: none }, offDays: { [d]: off('approved') } })).toBe('recorded')
    // 5 إجازة
    expect(stateOf({ holidays: { [d]: 'عيد' }, offDays: { [d]: off('approved') } })).toBe('holiday')
    // 6 بلاغٌ معتمَد
    expect(stateOf({ offDays: { [d]: off('approved') }, approvedMonths: ['2026-10'] })).toBe('off')
    // 7 بلاغٌ معلّق
    expect(stateOf({ offDays: { [d]: off('pending') }, approvedMonths: ['2026-10'] })).toBe('off_pending')
    // 8 شهرٌ معتمَد
    expect(stateOf({ approvedMonths: ['2026-10'] })).toBe('locked')
    // 9 وإلا ناقص — والمرفوضُ يعود ناقصاً
    expect(stateOf({})).toBe('missing')
    expect(stateOf({ offDays: { [d]: off('rejected') } })).toBe('missing')
  })

  it('«ناقص» يشمل off_pending ولا يشمل off ولا holiday', () => {
    const strip = attendanceStrip({
      days: ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28'],
      mirror: {},
      queued: new Set(),
      approvedMonths: [],
      offDays: { '2026-10-24': off('approved'), '2026-10-25': off('pending') },
      holidays: { '2026-10-26': 'عيد' },
      queuedOff: new Set(),
      queuedWithdraw: new Set()
    })
    expect(strip.days.map(x => x.state)).toEqual(['off', 'off_pending', 'holiday', 'missing', 'missing'])
    expect(strip.missing).toBe(3)
  })

  it('نسخةُ جهازٍ قديمة بلا الحقول الجديدة تعمل كأنّ لا بلاغات ولا إجازات', () => {
    const strip = attendanceStrip({ days: ['2026-10-25', '2026-10-26'], mirror: { '2026-10-25': none }, queued: new Set(), approvedMonths: [] })
    expect(strip.days.map(x => x.state)).toEqual(['recorded', 'missing'])
    expect(strip.missing).toBe(1)
  })
})
