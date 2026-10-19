/** ملخّصُ حضور الطالب في الشهر الجاري. */
import { describe, expect, it } from 'vitest'
import { summarizeMyMonth } from './useMyAttendance'

describe('summarizeMyMonth', () => {
  it('حضر a من b والشهرُ بالأرقام', () => {
    const days = ['2026-10-04', '2026-10-05', '2026-10-06']
    expect(summarizeMyMonth(2026, 10, days, ['2026-10-05'], null)).toEqual({ label: '10-2026', held: 3, attended: 2 })
  })
  it('لا يُحسب ما قبل الالتحاق', () => {
    expect(summarizeMyMonth(2026, 10, ['2026-10-04', '2026-10-06'], [], '2026-10-05')).toEqual({ label: '10-2026', held: 1, attended: 1 })
  })
  it('شهرٌ بلا أيام: أصفار', () => {
    expect(summarizeMyMonth(2026, 1, [], [], null)).toEqual({ label: '01-2026', held: 0, attended: 0 })
  })
})
