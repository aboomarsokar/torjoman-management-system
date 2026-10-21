import { describe, expect, it } from 'vitest'
import {
  alertStats, examPlanStats, examResultStats, minutesStats, newsStats, studentStats, supervisorStats, transportStats, userStats
} from './pageStats'

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

describe('examResultStats', () => {
  it('المجتازون ونسبتُهم من المحسوم وغيرُ المجتازين ومتوسّطُ العلامة', () => {
    const items = examResultStats([
      { passed: true, total_score: 90 },
      { passed: false, total_score: 60 },
      { passed: true, total_score: 85 },
      { passed: null, total_score: null }
    ], 99)
    expect(values(items)).toEqual({ all: 4, passed: 2, failed: 1, avg: '78.3 / 99' })
    expect(items.find(i => i.key === 'passed')?.label).toBe('مجتازاً — 67٪')
  })
})

describe('examPlanStats', () => {
  it('الدوراتُ والمراحلُ والأجزاءُ المغطّاة بلا تكرارٍ وأطولُ دورة', () => {
    expect(values(examPlanStats([
      { stage_number: 1, parts_from: 30, parts_to: 30 },
      { stage_number: 1, parts_from: 29, parts_to: 30 },
      { stage_number: 2, parts_from: 26, parts_to: 28 }
    ]))).toEqual({ cycles: 3, stages: 2, parts: 5, longest: 3 })
  })
})

describe('userStats', () => {
  it('النشطُ والمعطَّلُ والمعلّمون والمشرفون النشطون', () => {
    expect(values(userStats([
      { status: 'active', role: 'teacher' },
      { status: 'active', role: 'field_supervisor' },
      { status: 'disabled', role: 'teacher' },
      { status: 'active', role: 'admin_manager' }
    ]))).toEqual({ active: 3, disabled: 1, teachers: 1, supervisors: 1 })
  })
})

describe('supervisorStats', () => {
  it('الحلقاتُ ومن بلا حلقةٍ ومتوسّطُ الالتزام لمن قِيس', () => {
    expect(values(supervisorStats([
      { halqat: 2, commitment: 80 },
      { halqat: 0, commitment: null },
      { halqat: 3, commitment: 61 }
    ]))).toEqual({ sups: 3, halqat: 5, idle: 1, commit: '71٪' })
  })
})

describe('newsStats', () => {
  it('المنشورُ والمسودّاتُ وأخبارُ الشهر', () => {
    expect(values(newsStats([
      { published: true, news_date: '2026-10-02' },
      { published: false, news_date: '2026-09-02' }
    ], '2026-10-21'))).toEqual({ all: 2, pub: 1, draft: 1, month: 1 })
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
