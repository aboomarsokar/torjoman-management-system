import { describe, expect, it } from 'vitest'
import { attendanceSheet, examsSheet, quranSheet, type ExamResultRow } from './activity'
import type { HalaqaRow, StudentRow } from './people'

const halaqat = [{ id: 'h1', name: 'الصبرة', teacher_id: 't1' }, { id: 'h2', name: 'النفق', teacher_id: null }] as HalaqaRow[]
const students = [
  { id: 'a', full_name: 'أحمد', halaqa_id: 'h1', status: 'active' },
  { id: 'b', full_name: 'باسم', halaqa_id: 'h2', status: 'active' },
  { id: 'c', full_name: 'جمال', halaqa_id: 'h1', status: 'withdrawn' }
] as StudentRow[]

describe('attendanceSheet', () => {
  const sheet = attendanceSheet('10-2026', halaqat, students,
    [{ halaqa_id: 'h1', day: '2026-10-03' }, { halaqa_id: 'h1', day: '2026-10-04' }, { halaqa_id: 'h2', day: '2026-10-04' }],
    [{ halaqa_id: 'h1', day: '2026-10-04', student_id: 'a', kind: 'unexcused' }, { halaqa_id: 'h2', day: '2026-10-04', student_id: 'b', kind: 'excused' }])
  it('عمودٌ لكلّ يومٍ فُتح، والمنسحبُ بلا غيابٍ يُسقط', () => {
    expect(sheet.columns.map(c => c.header)).toEqual(['الحلقة', 'الطالب', '3/10', '4/10', 'أيام الدوام', 'حضور', 'غياب بلا عذر', 'غياب بعذر'])
    expect(sheet.rows.map(r => r.name)).toEqual(['أحمد', 'باسم'])
  })
  it('الرموزُ والمجاميع', () => {
    expect(sheet.rows[0]).toMatchObject({ '2026-10-03': '✓', '2026-10-04': 'غ', 'open': 2, 'present': 1, 'unexcused': 1, 'excused': 0 })
    expect(sheet.rows[1]).toMatchObject({ '2026-10-03': '—', '2026-10-04': 'ع', 'open': 1, 'present': 0, 'excused': 1 })
  })
})

describe('quranSheet', () => {
  it('السورُ بأسمائها وحالةُ الرصد', () => {
    const s = quranSheet('10-2026', halaqat, students, new Map([['t1', 'محمود']]), [{ id: 'r1', halaqa_id: 'h1', status: 'submitted' }],
      [{ report_id: 'r1', student_id: 'a', from_surah: 2, from_ayah: 5, to_surah: 2, to_ayah: 40, pages_memorized: 3, pages_reviewed: 10, notes: null }],
      new Map([[2, 'البقرة']]))
    expect(s.rows[0]).toMatchObject({ halaqa: 'الصبرة', teacher: 'محمود', name: 'أحمد', from: 'البقرة 5', to: 'البقرة 40', memorized: 3, status: 'مُرسَل' })
  })
})

describe('examsSheet', () => {
  it('الأحدثُ أوّلاً بالدورة والنتيجة', () => {
    const r = (date: string, passed: boolean): ExamResultRow => ({ student_id: 'a', examiner_id: 'e', exam_date: date, tajweed_score: 9, total_score: 80, pass_mark_snapshot: 70, passed, notes: null, item: { exam_cycle_id: 1, list: { halaqa_id: 'h1' } } })
    const s = examsSheet([r('2026-10-10', false), r('2026-10-20', true)], halaqat, students, new Map([['e', 'المختبر']]),
      [{ id: 1, stage_number: 1, cycle_number: 1, parts_from: 29, parts_to: 30, surahs_label: '', sort_order: 1 }])
    expect(s.rows.map(x => x.date)).toEqual(['20/10/2026', '10/10/2026'])
    expect(s.rows[0]).toMatchObject({ name: 'أحمد', halaqa: 'الصبرة', cycle: 'المرحلة الأولى · الدورة الأولى — الأجزاء 29–30', result: 'ناجح', examiner: 'المختبر' })
  })
})
