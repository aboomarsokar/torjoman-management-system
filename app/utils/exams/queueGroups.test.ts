import { describe, expect, it } from 'vitest'
import { cycleOptions, examinerOptions, filterQueue, groupQueue, queueSummary, waitDaysBetween, waitLabel, waitTone, type QueueFilters, type QueueItem } from './queueGroups'

const item = (o: Partial<QueueItem>): QueueItem => ({
  id: 'x', student: null, name: 'طالب', halaqaId: 'h1', halaqa: 'حلقة أ', gender: 'female', teacher: 'معلمة',
  examinerId: 'e1', examiner: 'سمر', cycleId: 'c1', title: 'المرحلة الأولى · الدورة الأولى', detail: '', span: '', waitDays: 3, ...o
})
const all: QueueFilters = { gender: 'all', supervisor: 'all', query: '', cycle: 'all' }

describe('طابور الرصد مجمّعاً بالحلقة', () => {
  it('مدّةُ الانتظار ولونُها ولفظُها', () => {
    expect(waitDaysBetween('2026-10-25T09:00:00Z', '2026-11-10')).toBe(16)
    expect(waitDaysBetween(null, '2026-11-10')).toBeNull()
    expect([waitTone(7), waitTone(8), waitTone(15), waitTone(null)]).toEqual(['calm', 'warn', 'late', 'calm'])
    expect([waitLabel(0), waitLabel(1), waitLabel(2), waitLabel(5), waitLabel(16)]).toEqual(['اليوم', 'أمس', 'منذ يومين', 'منذ 5 أيام', 'منذ 16 يوماً'])
  })

  it('التجميع: الأطولُ انتظاراً أولاً، والدورةُ في الرأس متى توحّدت', () => {
    const groups = groupQueue([
      item({ id: '1', name: 'ب', waitDays: 2 }),
      item({ id: '2', name: 'أ', waitDays: 9 }),
      item({ id: '3', halaqaId: 'h2', halaqa: 'حلقة ب', waitDays: 16, cycleId: 'c2', title: 'دورة ثانية' }),
      item({ id: '4', halaqaId: 'h2', halaqa: 'حلقة ب', waitDays: 1 })
    ])
    expect(groups.map(g => g.halaqaId)).toEqual(['h2', 'h1'])
    expect(groups[0]!.cycle).toBeNull()
    expect(groups[1]!.cycle?.title).toBe('المرحلة الأولى · الدورة الأولى')
    expect(groups[1]!.items.map(i => i.id)).toEqual(['2', '1'])
    expect(queueSummary(groups)).toEqual({ students: 4, halqat: 2, oldest: 16 })
  })

  it('الفلاتر: القسم والمختبِر والدورة والبحث، والتجريبيةُ خارجها', () => {
    const items = [
      item({ id: '1', name: 'ريم عسلية' }),
      item({ id: '2', gender: 'male', examinerId: 'e2', examiner: 'أسامة', teacher: 'محمود الحلو' }),
      item({ id: '3', examinerId: null, examiner: null, cycleId: 'c2' }),
      item({ id: '4', halaqa: 'حلقة تجريبية' })
    ]
    const ids = (f: Partial<QueueFilters>) => filterQueue(items, { ...all, ...f }).map(i => i.id)
    expect(ids({})).toEqual(['1', '2', '3'])
    expect(ids({ gender: 'male' })).toEqual(['2'])
    expect(ids({ supervisor: 'none' })).toEqual(['3'])
    expect(ids({ cycle: 'c2' })).toEqual(['3'])
    expect(ids({ query: 'عسليه' })).toEqual(['1'])
    expect(ids({ query: 'الحلو' })).toEqual(['2'])
  })

  it('خياراتُ المختبِر والدورة بأعدادها', () => {
    const items = [item({}), item({ id: '2' }), item({ id: '3', examinerId: null, examiner: null, cycleId: 'c2', title: 'ثانية' })]
    expect(examinerOptions(items)).toEqual([{ value: 'e1', label: 'سمر (2)' }, { value: 'none', label: 'بلا مختبِر (1)' }])
    expect(cycleOptions(items)).toEqual([{ value: 'c1', label: 'المرحلة الأولى · الدورة الأولى (2)' }, { value: 'c2', label: 'ثانية (1)' }])
  })
})
