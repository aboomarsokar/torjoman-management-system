import { describe, expect, it } from 'vitest'
import { midmonthSummary, midSubmitBlock, midThreshold, studentMidThreshold, testedPartsBefore } from './midmonth'

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

describe('الاختبارُ قبل المنتصف يُسقط التخفيضَ كاملاً (2026-11-22)', () => {
  it('الحدُّ: 15 − التخفيض، ولا ينزل عن صفر', () => {
    expect(studentMidThreshold(30, 0)).toBe(15)
    expect(studentMidThreshold(30, 1)).toBe(5)
    expect(studentMidThreshold(30, 2)).toBe(0)
    expect(studentMidThreshold(30, 3)).toBe(0)
  })
  it('أكبرُ اختبارٍ في الشهر حتى يوم التسليم وحده', () => {
    const exams = [
      { student_id: 'a', exam_date: '2026-11-08', parts: 3 },
      { student_id: 'a', exam_date: '2026-11-10', parts: 5 },
      { student_id: 'b', exam_date: '2026-11-20', parts: 3 },
      { student_id: 'c', exam_date: '2026-10-30', parts: 10 }
    ]
    const at = '2026-11-15T08:00:00Z'
    expect(testedPartsBefore(exams, 'a', at)).toBe(5)
    expect(testedPartsBefore(exams, 'b', at)).toBe(0)
    expect(testedPartsBefore(exams, 'c', at)).toBe(0)
  })
  it('يصنّف بحدّ كلّ طالب ويسِمُ المختبَر', () => {
    const out = midmonthSummary({
      halaqat: [{ id: 'h', name: 'ح', teacher: null }],
      heads: [{ report_id: 'r', halaqa_id: 'h', submitted_at: '2026-11-15T08:00:00Z' }],
      records: [
        { halaqa_id: 'h', student_id: 'x', pages_memorized: 12 },
        { halaqa_id: 'h', student_id: 'k', pages_memorized: 6 },
        { halaqa_id: 'h', student_id: 'u', pages_memorized: 3 },
        { halaqa_id: 'h', student_id: 'b', pages_memorized: 0 }
      ],
      students: [
        { id: 'x', halaqa_id: 'h', full_name: 'أحمد' },
        { id: 'k', halaqa_id: 'h', full_name: 'خالد' },
        { id: 'u', halaqa_id: 'h', full_name: 'عمر' },
        { id: 'b', halaqa_id: 'h', full_name: 'بلال' }
      ],
      exams: [
        { student_id: 'k', exam_date: '2026-11-08', parts: 3 },
        { student_id: 'u', exam_date: '2026-11-10', parts: 3 },
        { student_id: 'b', exam_date: '2026-11-05', parts: 5 }
      ],
      monthTarget: 30
    })
    const r = out.submitted[0]!
    expect(r.late).toEqual(['أحمد', 'عمر'])
    expect(r.none).toEqual([])
    expect(r.tested).toEqual([{ name: 'خالد', parts: 3 }, { name: 'عمر', parts: 3 }, { name: 'بلال', parts: 5 }])
  })
})
