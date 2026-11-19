import { describe, expect, it } from 'vitest'
import { allocationRows, type AllocationHalaqa } from './incentiveAllocation'

const h = (id: string, status = 'active', teacherStatus = 'active'): AllocationHalaqa =>
  ({ id, name: `حلقة ${id}`, status, teacher: { full_name: `معلم ${id}`, status: teacherStatus } })

describe('allocationRows', () => {
  it('شهرٌ لم يُخصَّص: 150 لكل حلقةٍ نشطة بمعلّمٍ نشط', () => {
    const rows = allocationRows([h('a'), h('b', 'stopped'), h('c', 'active', 'disabled')], {})
    expect(rows.map(r => [r.halaqa_id, r.amount])).toEqual([['a', '150']])
  })
  it('شهرٌ محفوظ: يُعرض المحفوظ، والفارغُ يبقى فارغاً', () => {
    const rows = allocationRows([h('a'), h('b')], { a: 100 })
    expect(rows.map(r => r.amount)).toEqual(['100', ''])
  })
  it('تبقى المتوقّفةُ إن خُصّص لها في الشهر', () => {
    const rows = allocationRows([h('a'), h('b', 'stopped')], { b: 150 })
    expect(rows.map(r => r.halaqa_id)).toEqual(['a', 'b'])
  })
})
