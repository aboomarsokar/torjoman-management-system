import { describe, expect, it } from 'vitest'
import { midmonthSummary, midSubmitBlock, midThreshold } from './midmonth'

const ok = { online: true, pending: 0, isCurrentMonth: true, entryOpen: true, status: 'draft', hasReport: true }

describe('midSubmitBlock', () => {
  it('متاحٌ في الشهر الجاري من يوم 15 والمسوّدةُ مرفوعة', () => {
    expect(midSubmitBlock(ok)).toBeNull()
  })
  it('يعطَّل بالترتيب', () => {
    expect(midSubmitBlock({ ...ok, isCurrentMonth: false })).toBe('رصدُ المنتصف للشهر الجاري وحده.')
    expect(midSubmitBlock({ ...ok, status: 'submitted' })).toBe('أُرسل رصدُ الشهر — لا تسليمَ للمنتصف بعده.')
    expect(midSubmitBlock({ ...ok, entryOpen: false })).toBe('يُفتح تسليمُ رصد المنتصف يومَ 15.')
    expect(midSubmitBlock({ ...ok, online: false })).toBe('التسليمُ يحتاج اتصالاً.')
    expect(midSubmitBlock({ ...ok, pending: 2 })).toBe('انتظر رفعَ ما رصدتَه قبل التسليم.')
    expect(midSubmitBlock({ ...ok, status: null, hasReport: false })).toBe('ارصد طلابك أوّلاً.')
  })
})

describe('midmonthSummary', () => {
  const halaqat = [
    { id: 'h1', name: 'حلقة أ', teacher: 'معلم أ' },
    { id: 'h2', name: 'حلقة ب', teacher: 'معلم ب' },
    { id: 'h3', name: 'حلقة ج', teacher: null }
  ]
  const students = [
    { id: 's1', halaqa_id: 'h1', full_name: 'طالب 1' },
    { id: 's2', halaqa_id: 'h1', full_name: 'طالب 2' },
    { id: 's3', halaqa_id: 'h1', full_name: 'طالب 3' },
    { id: 's4', halaqa_id: 'h1', full_name: 'طالب 4' },
    { id: 's5', halaqa_id: 'h2', full_name: 'طالب 5' }
  ]
  const out = midmonthSummary({
    halaqat,
    heads: [{ report_id: 'r1', halaqa_id: 'h1', submitted_at: '2026-11-15T08:00:00Z' }, { report_id: 'r2', halaqa_id: 'h2', submitted_at: '2026-11-16T08:00:00Z' }],
    records: [
      { halaqa_id: 'h1', student_id: 's1', pages_memorized: 20 },
      { halaqa_id: 'h1', student_id: 's2', pages_memorized: 10 },
      { halaqa_id: 'h1', student_id: 's3', pages_memorized: 0 },
      { halaqa_id: 'h2', student_id: 's5', pages_memorized: 3 }
    ],
    students,
    monthTarget: 30
  })

  it('الحدُّ نصفُ الهدف', () => {
    expect(midThreshold(30)).toBe(15)
  })
  it('يصنّف المتأخّرَ ومن لم يحفظ ومن لم يُرصد', () => {
    const h1 = out.submitted.find(r => r.id === 'h1')!
    expect(h1).toMatchObject({ students: 3, avgPages: 10, late: ['طالب 2'], none: ['طالب 3'], unrecorded: ['طالب 4'] })
  })
  it('الأضعفُ متوسّطاً أوّلاً، وغيرُ المسلِّمة منفصلة', () => {
    expect(out.submitted.map(r => r.id)).toEqual(['h2', 'h1'])
    expect(out.missing.map(h => h.id)).toEqual(['h3'])
  })
})
