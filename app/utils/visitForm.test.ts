import { describe, expect, it } from 'vitest'
import { cleanCounts, criterionResult, groupCriteria, parseCounts, visitTotals, type DeductionItem } from './visitForm'

const item = (key: string, criterion: number, per_time: number, sort_order: number): DeductionItem =>
  ({ key, criterion, criterion_label: `م${criterion}`, criterion_hint: null, label: key, per_time, sort_order })

// الحالةُ نفسُها في اختبار الهجرة الملغى: غياب بغير إذن مرّة (−3) وضعف السيطرة ثلاثاً (−9 ← 0) = 32
const items = [
  item('absence_excused', 1, 2, 1), item('absence_unexcused', 1, 3, 2),
  item('undocumented_day', 2, 1, 3),
  item('weak_control', 3, 3, 5), item('teacher_distracted', 3, 3, 4),
  item('missed_mistake', 4, 4, 9),
  item('program_cancelled', 5, 5, 12),
  item('admin_group_silent', 6, 2, 13)
]

describe('groupCriteria', () => {
  it('ستّةُ معايير بترتيبها وبنودُ كلٍّ بترتيبها', () => {
    const g = groupCriteria(items)
    expect(g.map(c => c.number)).toEqual([1, 2, 3, 4, 5, 6])
    expect(g[2]!.items.map(i => i.key)).toEqual(['teacher_distracted', 'weak_control'])
  })
})

describe('criterionResult و visitTotals', () => {
  it('المحصّلةُ لا تنزل تحت الصفر، والمجموعُ من 42', () => {
    const g = groupCriteria(items)
    const counts = { absence_unexcused: 1, weak_control: 3 }
    expect(criterionResult(g[0]!, counts)).toEqual({ deducted: 3, score: 4 })
    expect(criterionResult(g[2]!, counts)).toEqual({ deducted: 9, score: 0 })
    expect(visitTotals(g, counts)).toEqual({ deducted: 12, score: 32 })
  })
  it('بلا خصمٍ 42 كاملة', () => {
    expect(visitTotals(groupCriteria(items), {})).toEqual({ deducted: 0, score: 42 })
  })
})

describe('cleanCounts و parseCounts', () => {
  it('الموجبُ وحده صحيحاً مقصوصاً على 99', () => {
    expect(cleanCounts({ a: 0, b: 2.7, c: -1, d: 150 })).toEqual({ b: 2, d: 99 })
  })
  it('المحفوظُ غيرُ الكائن لا شيء', () => {
    expect(parseCounts(null)).toEqual({})
    expect(parseCounts([1])).toEqual({})
    expect(parseCounts({ a: 2 })).toEqual({ a: 2 })
  })
})
