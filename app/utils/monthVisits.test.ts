import { describe, expect, it } from 'vitest'
import { groupMonthVisits, monthQueryRange } from './monthVisits'

const v = (halaqa_id: string, scheduled_at: string, executed_at: string | null, score: number | null, name = 'مها') =>
  ({ halaqa_id, scheduled_at, executed_at, score, visitor: { full_name: name } })

describe('groupMonthVisits', () => {
  it('المنفّذةُ بعلامتها ومعدّلُها، والمجدولةُ معلّقة، وغيرُ الشهر خارجها', () => {
    const m = groupMonthVisits([
      v('h1', '2026-10-05T07:00:00Z', '2026-10-05T08:00:00Z', 40),
      v('h1', '2026-10-20T07:00:00Z', '2026-10-20T08:00:00Z', 35, 'راغد'),
      v('h1', '2026-10-28T07:00:00Z', null, null),
      v('h1', '2026-11-02T07:00:00Z', '2026-11-02T08:00:00Z', 30),
      v('h2', '2026-09-30T22:30:00Z', '2026-10-01T07:00:00Z', 42)
    ], '2026-10')
    expect(m.get('h1')).toEqual({ done: [{ day: '2026-10-05', score: 40, visitor: 'مها' }, { day: '2026-10-20', score: 35, visitor: 'راغد' }], pending: 1, avg: 37.5 })
    expect(m.get('h2')?.done.length).toBe(1)
  })
})

describe('monthQueryRange', () => {
  it('هامشُ يومٍ على الطرفين', () => {
    expect(monthQueryRange(2026, 10)).toEqual({ from: '2026-09-30T00:00:00.000Z', to: '2026-11-02T00:00:00.000Z' })
  })
})
