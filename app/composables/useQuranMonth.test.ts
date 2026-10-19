/**
 * بياناتُ شهر الحلقة: اقتراحُ البداية، والمطلوبُ المقسَّط بالحضور منذ الالتحاق، وتصنيفُ الإنجاز،
 * وملخّصُ الحلقة، وصلاحيةُ الاعتماد.
 */
import { describe, expect, it } from 'vitest'
import { buildStudentRows, canApproveReport, summarizeOutcomes } from './useQuranMonth'
import type { StudentMonthRow } from './useQuranMonth'
import type { ProgramJuz } from '~/utils/quran/position'

// سورٌ مختصرة تكفي للاختبار: الإخلاص 4 آيات، الفلق 5، الناس 6، الفاتحة 7
const AYAHS: Record<number, number> = { 1: 7, 111: 5, 112: 4, 113: 5, 114: 6 }
const ayahCountOf = (s: number) => AYAHS[s] ?? 0
// جزءان: الأول (الناس←النبأ) نهايته 78:1 هنا مختصراً، والثاني (30) نهايتُه الفاتحة
const juz: ProgramJuz[] = [
  { number: 30, start: { surah: 114, ayah: 1 }, end: { surah: 112, ayah: 4 } },
  { number: 29, start: { surah: 111, ayah: 1 }, end: { surah: 1, ayah: 7 } }
]

const dayList = (n: number) => Array.from({ length: n }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`)
const student = (over: Partial<{ id: string, enrollment_date: string | null, quran_parts: number }> = {}) =>
  ({ id: 's1', full_name: 'طالب', enrollment_date: null, quran_parts: 0, ...over })
const record = (over: Record<string, unknown> = {}) => ({
  id: 'r1', report_id: 'rep', student_id: 's1', from_surah: 114, from_ayah: 1, to_surah: 113, to_ayah: 3,
  pages_memorized: 30, pages_reviewed: null, notes: null, ...over
}) as never

function build(over: Partial<Parameters<typeof buildStudentRows>[0]> = {}) {
  return buildStudentRows({
    students: [student()], records: [], previousEnds: {}, approvedEnds: {},
    days: dayList(20), absences: [], target: 35, juz, ayahCountOf, ...over
  })
}

describe('buildStudentRows — اقتراح البداية', () => {
  it('طالبٌ بلا سجلٍّ سابق وquran_parts=0 ← الناس 1', () => {
    expect(build()[0]!.suggestedFrom).toEqual({ surah: 114, ayah: 1 })
  })
  it('آخرُ نهايةٍ (112:2) ← الآية التالية (112:3)', () => {
    expect(build({ previousEnds: { s1: { surah: 112, ayah: 2 } } })[0]!.suggestedFrom).toEqual({ surah: 112, ayah: 3 })
  })
  it('آخرُ نهايةٍ آخرُ الإخلاص (112:4) ← أولُ الفلق (111:1)', () => {
    expect(build({ previousEnds: { s1: { surah: 112, ayah: 4 } } })[0]!.suggestedFrom).toEqual({ surah: 111, ayah: 1 })
  })
  it('بعد الفاتحة 1:7 لا اقتراح، ولا ختمَ ما لم تكن النهايةُ معتمَدة', () => {
    const [row] = build({ previousEnds: { s1: { surah: 1, ayah: 7 } } })
    expect(row!.suggestedFrom).toBeNull()
    expect(row!.khatm).toBe(false)
    const [approved] = build({ previousEnds: { s1: { surah: 1, ayah: 7 } }, approvedEnds: { s1: { surah: 1, ayah: 7 } } })
    expect(approved!.khatm).toBe(true)
  })
  it('مصدرُ الاقتراح: نهايةٌ سابقة ← true، وبدايةُ الطالب الجديد ← false', () => {
    expect(build({ previousEnds: { s1: { surah: 112, ayah: 2 } } })[0]!.suggestedFromPrevious).toBe(true)
    expect(build()[0]!.suggestedFromPrevious).toBe(false)
  })
})

describe('buildStudentRows — الحضور والمطلوب', () => {
  it('التحق في 15 والحلقة 20 يوماً ← daysHeld=10', () => {
    const [row] = build({ students: [student({ enrollment_date: '2026-10-11' })] })
    expect(row!.daysHeld).toBe(10)
  })
  it('غيابان بعد الالتحاق ← daysAttended=8', () => {
    const [row] = build({
      students: [student({ enrollment_date: '2026-10-11' })],
      absences: [{ student_id: 's1', day: '2026-10-12' }, { student_id: 's1', day: '2026-10-15' }]
    })
    expect(row!.daysAttended).toBe(8)
  })
  it('غيابٌ قبل الالتحاق أو في يومٍ غير منعقد أو مكرَّر أو لطالبٍ آخر لا يُحتسب', () => {
    const [row] = build({
      students: [student({ enrollment_date: '2026-10-11' })],
      days: dayList(20),
      absences: [
        { student_id: 's1', day: '2026-10-05' }, { student_id: 's1', day: '2026-11-02' },
        { student_id: 's1', day: '2026-10-12' }, { student_id: 's1', day: '2026-10-12' },
        { student_id: 's2', day: '2026-10-13' }
      ]
    })
    expect(row!.daysAttended).toBe(9)
  })
  it('مطلوب 35 وحضر 8 من 10 ← plan.required = 28', () => {
    const [row] = build({
      students: [student({ enrollment_date: '2026-10-11' })],
      absences: [{ student_id: 's1', day: '2026-10-12' }, { student_id: 's1', day: '2026-10-15' }]
    })
    expect(row!.plan).toEqual({ required: 28, full: 35, basis: 'prorated' })
  })
  it('انعقدت أيامٌ في الشهر ولم ينعقد منها شيءٌ بعد الالتحاق ← unheld ولا يُقاس', () => {
    const rows = build({ students: [student({ enrollment_date: '2026-11-05' })], records: [record()] })
    expect(rows[0]!.daysHeld).toBe(0)
    expect(rows[0]!.plan).toEqual({ required: null, full: 35, basis: 'unheld' })
    expect(rows[0]!.outcome).toBe('unmeasured')
  })
  it('شهرٌ بلا أيامٍ أصلاً ← المطلوبُ كاملاً كما كان', () => {
    const [row] = build({ days: [], records: [record({ pages_memorized: 10 })] })
    expect(row!.plan).toEqual({ required: 35, full: 35, basis: 'full' })
    expect(row!.outcome).toBe('short')
  })
  it('بلا مطلوب (null) ← لا يُقاس بعد الرصد', () => {
    expect(build({ target: null, records: [record()] })[0]!.outcome).toBe('unmeasured')
  })
})

describe('buildStudentRows — النتيجة والسجلّ', () => {
  it('لا سجلّ ← unrecorded ولو كان غائباً', () => {
    expect(build()[0]!.outcome).toBe('unrecorded')
    expect(build({ absences: dayList(20).map(day => ({ student_id: 's1', day })) })[0]!.outcome).toBe('unrecorded')
  })
  it('سجلٌّ لمن لم يحضر يوماً ← unmeasured', () => {
    const rows = build({ records: [record()], absences: dayList(20).map(day => ({ student_id: 's1', day })) })
    expect(rows[0]!.daysAttended).toBe(0)
    expect(rows[0]!.outcome).toBe('unmeasured')
  })
  it('صفحاتٌ ≥ المطلوب ← done، ودونه ← short', () => {
    expect(build({ records: [record({ pages_memorized: 35 })] })[0]!.outcome).toBe('done')
    expect(build({ records: [record({ pages_memorized: 34 })] })[0]!.outcome).toBe('short')
  })
  it('يحوّل السجلّ إلى مواضع وحقولٍ مسمّاة', () => {
    const [row] = build({ records: [record({ pages_reviewed: 12, notes: 'ملاحظة' })] })
    expect(row!.record).toEqual({
      id: 'r1', from: { surah: 114, ayah: 1 }, to: { surah: 113, ayah: 3 },
      pagesMemorized: 30, pagesReviewed: 12, notes: 'ملاحظة'
    })
  })
  it('سجلٌّ بلا مواضع (صفحاتٌ فقط) ← from/to بلا قيمة', () => {
    const [row] = build({ records: [record({ from_surah: null, from_ayah: null, to_surah: null, to_ayah: null })] })
    expect(row!.record).toMatchObject({ from: null, to: null })
  })
  it('تجاهل سجلّ طالبٍ ليس في القائمة', () => {
    expect(build({ records: [record({ student_id: 'other' })] })[0]!.record).toBeNull()
  })
})

describe('buildStudentRows — الأجزاء المنجزة', () => {
  it('من آخر موضعٍ معتمَد لا من سجلّ الشهر الحاليّ', () => {
    const rows = build({
      records: [record({ to_surah: 112, to_ayah: 4 })],
      approvedEnds: { s1: null }
    })
    expect(rows[0]!.juzDone).toBe(0)
    const approved = build({ approvedEnds: { s1: { surah: 112, ayah: 4 } } })
    expect(approved[0]!.juzDone).toBe(1)
  })
  it('ما يحفظه الطالبُ عند التحاقه (quran_parts) يُحتسب بلا سجلٍّ معتمَد', () => {
    expect(build({ students: [student({ quran_parts: 3 })] })[0]!.juzDone).toBe(3)
  })
  it('الأكبرُ من المعتمَد وquran_parts (المعتمَدُ أمامه)', () => {
    const rows = build({ students: [student({ quran_parts: 0 })], approvedEnds: { s1: { surah: 1, ayah: 7 } } })
    expect(rows[0]!.juzDone).toBe(2)
    const ahead = build({ students: [student({ quran_parts: 1 })], approvedEnds: { s1: { surah: 1, ayah: 7 } } })
    expect(ahead[0]!.juzDone).toBe(2)
  })
  it('quran_parts يُقصّ إلى 0–30', () => {
    expect(build({ students: [student({ quran_parts: 45 })] })[0]!.juzDone).toBe(30)
    expect(build({ students: [student({ quran_parts: -2 })] })[0]!.juzDone).toBe(0)
  })
  it('quran_parts=30 ← ختم', () => {
    expect(build({ students: [student({ quran_parts: 30 })] })[0]!.khatm).toBe(true)
    expect(build({ students: [student({ quran_parts: 29 })] })[0]!.khatm).toBe(false)
  })
  it('الختم من نهايةٍ معتمَدة وحدها: مسوّدةُ الشهر وآخرُ نهايةٍ سابقة (أيّ حالة) لا يختمان', () => {
    expect(build({ records: [record({ to_surah: 1, to_ayah: 7 })] })[0]!.khatm).toBe(false)
    expect(build({ previousEnds: { s1: { surah: 1, ayah: 7 } } })[0]!.khatm).toBe(false)
    expect(build({ approvedEnds: { s1: { surah: 1, ayah: 7 } } })[0]!.khatm).toBe(true)
  })
})

const row = (outcome: StudentMonthRow['outcome']) => ({ outcome }) as StudentMonthRow

describe('summarizeOutcomes', () => {
  it('يعدّ كلَّ نتيجة ويقرّب نسبة المرصودين', () => {
    const s = summarizeOutcomes([row('done'), row('done'), row('short'), row('unrecorded'), row('unmeasured'), row('unrecorded')])
    expect(s).toEqual({ done: 2, short: 1, unmeasured: 1, unrecorded: 2, recordedPct: 67 })
  })
  it('قائمةٌ فارغة ← أصفار ولا قسمةَ على صفر', () => {
    expect(summarizeOutcomes([])).toEqual({ done: 0, short: 0, unmeasured: 0, unrecorded: 0, recordedPct: 0 })
  })
  it('الكلُّ مرصود ← 100', () => {
    expect(summarizeOutcomes([row('done'), row('short')]).recordedPct).toBe(100)
  })
})

describe('canApproveReport', () => {
  const male = { gender: 'male' as const, supervisor_id: 'sup1' }
  const female = { gender: 'female' as const, supervisor_id: 'sup1' }
  it('المديرُ الإداري يعتمد كلَّ الحلقات', () => {
    expect(canApproveReport('admin_manager', 'a', male)).toBe(true)
    expect(canApproveReport('admin_manager', 'a', female)).toBe(true)
  })
  it('المديرة الإدارية للبنات وحدهنّ', () => {
    expect(canApproveReport('women_admin', 'w', female)).toBe(true)
    expect(canApproveReport('women_admin', 'w', male)).toBe(false)
  })
  it('المشرفُ الميدانيّ لحلقته وحدها', () => {
    expect(canApproveReport('field_supervisor', 'sup1', male)).toBe(true)
    expect(canApproveReport('field_supervisor', 'sup2', male)).toBe(false)
    expect(canApproveReport('field_supervisor', null, { gender: 'male', supervisor_id: null })).toBe(false)
  })
  it('المديرُ الفنيّ والمعلّم ومشرفُ المشروع والمجهول لا يعتمدون', () => {
    for (const r of ['technical_manager', 'teacher', 'project_supervisor', 'examiner', 'student', null]) {
      expect(canApproveReport(r, 'sup1', male)).toBe(false)
    }
  })
})
