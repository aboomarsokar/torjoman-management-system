import { describe, expect, it } from 'vitest'
import { buildDayDetail } from './useFollowUpDayDetail'

describe('حالُ اليوم في متابعة الرصد', () => {
  it('المقيَّدون حتى اليوم وحدهم، والغائبون مرتّبون بالاسم (والمجهولُ أولاً)', () => {
    const d = buildDayDetail('2026-11-05',
      [{ kind: 'unexcused', student: { full_name: 'يوسف' } }, { kind: 'excused', student: null }, { kind: 'excused', student: { full_name: 'أحمد' } }],
      [{ enrollment_date: null }, { enrollment_date: '2026-11-05' }, { enrollment_date: '2026-11-06' }])
    expect(d.roster).toBe(2)
    expect(d.absentees.map(a => a.name)).toEqual(['—', 'أحمد', 'يوسف'])
  })
})
