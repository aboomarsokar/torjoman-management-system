import { describe, expect, it } from 'vitest'
import { alertStats, minutesStats, studentStats, transportStats } from './pageStats'

const values = (items: { key: string, value: string | number }[]) => Object.fromEntries(items.map(i => [i.key, i.value]))
const stripMarks = (v: string | number) => String(v).replace(/[⁦-⁩]/g, '')

describe('studentStats', () => {
  it('النشطون وغيرُهم والملتحقون هذا الشهر ومتوسّطُ المحفوظ للنشطين', () => {
    const v = values(studentStats([
      { status: 'active', enrollment_date: '2026-10-05', quran_parts: 3 },
      { status: 'active', enrollment_date: '2026-09-01', quran_parts: null },
      { status: 'active', enrollment_date: null, quran_parts: 4 },
      { status: 'withdrawn', enrollment_date: '2026-10-02', quran_parts: 10 }
    ], '2026-10-21'))
    expect(v).toEqual({ active: 3, inactive: 1, new: 1, parts: '3.5' })
  })
  it('بلا محفوظٍ معروف ← «—»', () => {
    expect(values(studentStats([], '2026-10-21')).parts).toBe('—')
  })
})

describe('transportStats', () => {
  it('العددُ والمجموعُ والمسدَّدُ وغيرُه بالشيكل', () => {
    const v = values(transportStats([{ amount: 20, paid: true }, { amount: '12.5', paid: false }, { amount: 10, paid: false }]))
    expect(v.trips).toBe(3)
    expect(stripMarks(v.total!)).toBe('42.50 ₪')
    expect(stripMarks(v.paid!)).toBe('20 ₪')
    expect(stripMarks(v.unpaid!)).toBe('22.50 ₪')
  })
})

describe('alertStats', () => {
  it('الجديدةُ والمُقَرُّ بها والإنذاراتُ النهائية', () => {
    expect(values(alertStats([
      { status: 'new', severity: 'note' },
      { status: 'acknowledged', severity: 'final_warning' },
      { status: 'new', severity: 'final_warning' }
    ]))).toEqual({ all: 3, new: 2, ack: 1, final: 2 })
  })
})

describe('minutesStats', () => {
  it('المعتمَدُ والمسودّاتُ ومحاضرُ الشهر', () => {
    expect(values(minutesStats([
      { status: 'final', meeting_date: '2026-10-01' },
      { status: 'draft', meeting_date: '2026-10-20' },
      { status: 'final', meeting_date: '2026-09-30' }
    ], '2026-10-21'))).toEqual({ all: 3, final: 2, draft: 1, month: 2 })
  })
})
