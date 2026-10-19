/** ترشيحُ الاختبار ورصدُه بالدورات: الأجزاءُ المعتمدة، والحالة، والصفوف، والنصوص، والجرس، والأخطاء. */
import { describe, expect, it } from 'vitest'
import type { ExamCycle } from './cycles'
import type { HistoryRow } from '~/utils/quran/monthHistory'
import type { ProgramJuz } from '~/utils/quran/position'
import {
  DUPLICATE_GRADE_MESSAGE, HALAQA_GRADED_MESSAGE, approvedJuzReached, buildNomineeRows, cycleStateByStudent,
  examTargetText, gradeErrorMessage, halaqaDeleteErrorMessage, pendingLists, toExamCycle, type CycleItemRow
} from './nomination'

const cyc = (id: number, from: number, to: number): ExamCycle =>
  ({ id, stage_number: 1, cycle_number: id, parts_from: from, parts_to: to, surahs_label: 'س', sort_order: id })
const CYCLES = [cyc(1, 28, 30), cyc(2, 26, 30), cyc(3, 23, 25)]

// ثلاثةُ أجزاء مبسّطة بترتيب الحفظ: 30 (114←78)، 29 (77←67)، 28 (66←58)
const JUZ: ProgramJuz[] = [
  { number: 30, start: { surah: 114, ayah: 1 }, end: { surah: 78, ayah: 40 } },
  { number: 29, start: { surah: 77, ayah: 1 }, end: { surah: 67, ayah: 30 } },
  { number: 28, start: { surah: 66, ayah: 1 }, end: { surah: 58, ayah: 22 } }
]
const hist = (student_id: string, surah: number, ayah: number, y: number, m: number, status: string): HistoryRow =>
  ({ student_id, to_surah: surah, to_ayah: ayah, report: { report_year: y, report_month: m, status } })

describe('toExamCycle', () => {
  it('الترتيبُ الفارغ صفر', () => {
    expect(toExamCycle({ ...cyc(1, 28, 30), sort_order: null }).sort_order).toBe(0)
  })
})

describe('approvedJuzReached', () => {
  it('آخرُ نهايةٍ معتمَدة لا المسوّدة ولا المرسَلة', () => {
    const history = [
      hist('a', 67, 30, 2026, 9, 'approved'),
      hist('a', 58, 22, 2026, 10, 'submitted')
    ]
    expect(approvedJuzReached([{ id: 'a', quran_parts: 0 }], history, JUZ)).toEqual({ a: 2 })
  })

  it('الأحدثُ شهراً يغلب ولو كان موضعُه أقرب', () => {
    const history = [hist('a', 58, 22, 2026, 8, 'approved'), hist('a', 78, 40, 2026, 9, 'approved')]
    expect(approvedJuzReached([{ id: 'a', quran_parts: null }], history, JUZ).a).toBe(1)
  })

  it('المحفوظُ المسجَّل يغلب إن كان أكبر، ويُقصّ إلى 0–30', () => {
    const r = approvedJuzReached([{ id: 'a', quran_parts: 5 }, { id: 'b', quran_parts: 40 }, { id: 'c', quran_parts: null }], [], JUZ)
    expect(r).toEqual({ a: 5, b: 30, c: 0 })
  })
})

const item = (id: string, student_id: string, cycle: number | null, results: (boolean | null)[]): CycleItemRow =>
  ({ id, student_id, exam_cycle_id: cycle, exam_results: results.map(passed => ({ passed })) })

describe('cycleStateByStudent', () => {
  it('المجتازةُ والمعلّقة، والبنودُ القديمة خارجها', () => {
    const st = cycleStateByStudent([item('i1', 's', 1, [true]), item('i2', 's', 2, []), item('old', 's', null, [])])
    expect([...st.s!.passed]).toEqual([1])
    expect(st.s!.pendingItemId).toBe('i2')
    expect(st.s!.pendingCycleId).toBe(2)
  })

  it('الراسبُ ليس مجتازاً ولا معلّقاً', () => {
    const st = cycleStateByStudent([item('i1', 's', 1, [false])])
    expect(st.s!.passed.size).toBe(0)
    expect(st.s!.pendingItemId).toBeNull()
  })
})

describe('buildNomineeRows', () => {
  const students = [
    { id: 'new', full_name: 'جديد', halaqa_id: 'h' },
    { id: 'pass1', full_name: 'اجتاز الأولى', halaqa_id: 'h' },
    { id: 'pend', full_name: 'معلّق', halaqa_id: 'h' },
    { id: 'done', full_name: 'أتمّ', halaqa_id: 'h' },
    { id: 'fail', full_name: 'راسب', halaqa_id: 'h' }
  ]
  const items = [
    item('a', 'pass1', 1, [true]),
    item('b', 'pend', 1, [true]), item('c', 'pend', 2, []),
    item('d', 'done', 1, [true]), item('e', 'done', 2, [true]), item('f', 'done', 3, [true]),
    item('g', 'fail', 1, [false])
  ]
  const rows = buildNomineeRows(students, CYCLES, items, { new: 0, pass1: 3, pend: 3, done: 8, fail: 3 })
  const of = (id: string) => rows.find(r => r.id === id)!

  it('الجديدُ: الدورةُ الأولى مع تلميح البلوغ', () => {
    expect(of('new').cycle?.id).toBe(1)
    expect(of('new').blocked).toBeNull()
    expect(of('new').hint).toBeTruthy()
  })

  it('من اجتاز الأولى: الثانية، ولم يبلغ حدودها (5 أجزاء) فتلميح', () => {
    expect(of('pass1').cycle?.id).toBe(2)
    expect(of('pass1').hint).toBeTruthy()
  })

  it('المعلّقُ: دورتُه المعلّقة وبندُها للسحب', () => {
    expect(of('pend').blocked).toBe('pending')
    expect(of('pend').cycle?.id).toBe(2)
    expect(of('pend').pendingItemId).toBe('c')
  })

  it('من أتمّ الخطة: لا دورة', () => {
    expect(of('done').cycle).toBeNull()
    expect(of('done').blocked).toBe('done')
  })

  it('الراسبُ للدورة نفسها، وبلغ حدودها فلا تلميح', () => {
    expect(of('fail').cycle?.id).toBe(1)
    expect(of('fail').hint).toBeNull()
  })
})

describe('examTargetText', () => {
  it('الدورة', () => {
    expect(examTargetText(CYCLES[0]!, null)).toEqual({ title: 'المرحلة الأولى · الدورة الأولى', detail: 'الأجزاء 28–30 (س)' })
  })
  it('البندُ القديم بنطاق خطته', () => {
    expect(examTargetText(null, { parts_from: 1, parts_to: 3 })).toEqual({ title: 'الخطة السابقة', detail: 'الأجزاء 1–3' })
  })
  it('لا شيء', () => {
    expect(examTargetText(null, null).title).toBe('—')
  })
})

describe('pendingLists', () => {
  it('قائمةٌ لكلّ ترشيحٍ فيه بنودٌ بلا نتيجة، بعددها', () => {
    const h = (name: string) => ({ halaqa: { name } })
    const rows = [
      { exam_list_id: 'L1', exam_results: [], exam_list: h('الفرقان') },
      { exam_list_id: 'L2', exam_results: [{ id: 'r' }], exam_list: h('النور') },
      { exam_list_id: 'L1', exam_results: null, exam_list: h('الفرقان') },
      { exam_list_id: 'L3', exam_results: [], exam_list: null }
    ]
    expect(pendingLists(rows)).toEqual([
      { listId: 'L1', halaqa: 'الفرقان', count: 2 },
      { listId: 'L3', halaqa: '—', count: 1 }
    ])
  })
})

describe('رسائلُ الأخطاء', () => {
  it('23505 ← رُصدت من قبل', () => {
    expect(gradeErrorMessage({ code: '23505', message: 'duplicate key' })).toBe(DUPLICATE_GRADE_MESSAGE)
    expect(gradeErrorMessage({ code: '23514' })).toBeNull()
    expect(gradeErrorMessage(null)).toBeNull()
  })
  it('حذفُ حلقةٍ لها مرصود', () => {
    expect(halaqaDeleteErrorMessage({ message: 'لا يُحذف ترشيحٌ رُصدت نتيجته.' })).toBe(HALAQA_GRADED_MESSAGE)
    expect(halaqaDeleteErrorMessage({ message: 'foreign key' })).toBeNull()
    expect(halaqaDeleteErrorMessage(undefined)).toBeNull()
  })
})
