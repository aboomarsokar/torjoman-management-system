import { describe, expect, it } from 'vitest'
import { attendancePct } from './monthlyOverview'

describe('attendancePct', () => {
  it('1 − الغيابات ÷ (الأيام × الطلاب)', () => {
    expect(attendancePct(20, 10, 30)).toBe(85)
    expect(attendancePct(20, 10, 0)).toBe(100)
  })
  it('بلا أيامٍ أو طلاب ← null', () => {
    expect(attendancePct(0, 10, 0)).toBeNull()
    expect(attendancePct(20, 0, 0)).toBeNull()
  })
})
