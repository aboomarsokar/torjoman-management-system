import { describe, expect, it } from 'vitest'
import {
  alertStats, examPlanStats, examResultStats, minutesStats, newsStats, studentStats, halqatSplitStats, studentSplitStats, supervisorSplitStats, supervisorStats, transportStats, userSplitStats, userStats
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
    expect(values(items)).toEqual({ all: 4, passed: 2, failed: 1, avg: '78.3' })
    expect(items.find(i => i.key === 'avg')?.label).toBe('متوسّطُ العلامة من 99')
    expect(items.find(i => i.key === 'passed')?.sub).toBe('67٪ من المحسوم')
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

describe('userSplitStats', () => {
  it('يفصل الحسابات والأدوار النشطة بين الذكور والإناث', () => {
    const out = userSplitStats([
      { status: 'active', role: 'teacher', gender: 'male' },
      { status: 'active', role: 'teacher', gender: 'female' },
      { status: 'active', role: 'teacher', gender: 'female' },
      { status: 'disabled', role: 'teacher', gender: 'female' },
      { status: 'active', role: 'examiner', gender: 'male' }
    ])
    const by = Object.fromEntries(out.map(i => [i.key, [i.male, i.female]]))
    expect(by).toEqual({ active: [2, 2], disabled: [0, 1], teachers: [1, 2], sups: [0, 0], examiners: [1, 0] })
  })
})

describe('الفصل بين البنين والبنات (الطلاب والحلقات والمشرفون)', () => {
  const pick = (items: { key: string, male: number | null, female: number | null, total?: number | null }[]) =>
    Object.fromEntries(items.map(i => [i.key, [i.male, i.female, i.total ?? null]]))

  it('الطلاب: النشطون وغيرُهم والملتحقون، ومتوسّطُ المحفوظ بعامّه', () => {
    const today = '2026-10-22'
    const out = studentSplitStats([
      { gender: 'male', status: 'active', enrollment_date: '2026-10-01', quran_parts: 2 },
      { gender: 'male', status: 'withdrawn', enrollment_date: '2026-09-01', quran_parts: null },
      { gender: 'female', status: 'active', enrollment_date: '2026-09-01', quran_parts: 4 },
      { gender: 'female', status: 'active', enrollment_date: '2026-10-05', quran_parts: null }
    ], today)
    expect(pick(out)).toEqual({ active: [1, 2, null], inactive: [1, 0, null], new: [1, 1, null], parts: [2, 4, 3] })
  })

  it('الحلقات: العددُ والطلابُ، ومتوسّطُ الحلقة لكلٍّ وللمجموع', () => {
    const h = (gender: string, n: number) => ({ gender, status: 'active', student_count: [{ count: n }] })
    expect(pick(halqatSplitStats([h('male', 6), h('male', 4), h('female', 6)])))
      .toEqual({ halqat: [2, 1, null], students: [10, 6, null], avg: [5, 6, 5.3] })
  })

  it('المشرفون: بلا حلقة، والإنجازُ متوسّطٌ ولا قيمةَ حين لا حلقات نشطة', () => {
    expect(pick(supervisorSplitStats([
      { gender: 'male', halqat: 2, commitment: 100 },
      { gender: 'female', halqat: 0, commitment: null }
    ]))).toEqual({ sups: [1, 1, null], halqat: [2, 0, null], idle: [0, 1, null], commit: [100, null, 100] })
  })
})
