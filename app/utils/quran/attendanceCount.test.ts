/** عدُّ حضور الطالب في أيام حلقته. */
import { describe, expect, it } from 'vitest'
import { countAttendance } from './attendanceCount'

const days = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07']

describe('countAttendance', () => {
  it('بلا غيابات: حضر الكلَّ', () => {
    expect(countAttendance(days, undefined, null)).toEqual({ held: 4, attended: 4 })
  })
  it('يطرح الغياب', () => {
    expect(countAttendance(days, new Set(['2026-10-05', '2026-10-06']), null)).toEqual({ held: 4, attended: 2 })
  })
  it('لا يعدّ أياماً قبل الالتحاق ولا غيابَها', () => {
    expect(countAttendance(days, new Set(['2026-10-04', '2026-10-07']), '2026-10-06')).toEqual({ held: 2, attended: 1 })
  })
  it('غيابٌ في يومٍ ليس من أيام الحلقة لا يُحسب', () => {
    expect(countAttendance(days, new Set(['2026-10-20']), null)).toEqual({ held: 4, attended: 4 })
  })
  it('لا أيام: أصفار', () => {
    expect(countAttendance([], new Set(['2026-10-05']), null)).toEqual({ held: 0, attended: 0 })
  })
})
