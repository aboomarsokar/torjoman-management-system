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
