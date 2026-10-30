import { describe, expect, it } from 'vitest'
import type { NomineeRow } from '~/utils/exams/nomination'
import {
  examEligible, examTally, frequentAbsentees, halaqaAttendance, lastRecordedReport, monthSummary, recordingStatus, teacherActions, unrecordedStudents,
  type DashRecord, type DashReport, type DashStudent
} from './teacherDashboard'
import type { StudentMonthRow } from '~/utils/quran/month'

const students: DashStudent[] = [
  { id: 'a', full_name: 'أنس', enrollment_date: null },
  { id: 'b', full_name: 'بلال', enrollment_date: '2026-10-10' },
  { id: 'c', full_name: 'حمزة', enrollment_date: null }
]
const report = (y: number, m: number, status: DashReport['status'], note: string | null = null): DashReport =>
  ({ id: `${y}-${m}`, report_year: y, report_month: m, status, return_note: note })
const rec = (sid: string, y: number, m: number, status: string, pages: number): DashRecord =>
  ({ student_id: sid, pages_memorized: pages, report: { report_year: y, report_month: m, status } })

describe('لوحة المعلم — الحضور', () => {
  it('النسبةُ من مجموع أيام كلّ طالبٍ منذ التحاقه', () => {
    const days = ['2026-10-03', '2026-10-05', '2026-10-12']
    // أنس 3 أيام غاب 1، بلال يومٌ واحد (بعد التحاقه) حضره، حمزة 3 حضرها
    const r = halaqaAttendance(students, days, [{ student_id: 'a', day: '2026-10-05' }])
    expect(r).toEqual({ held: 7, attended: 6, pct: 86 })
  })

  it('بلا أيامٍ منعقدة لا نسبة', () => {
    expect(halaqaAttendance(students, [], []).pct).toBeNull()
  })

  it('الأكثرُ غياباً فوق الحدّ وحدَه، مرتّبٌ بالأكثر، وغيابُ من خرج لا يُحسب', () => {
    const abs = [
      ...['1', '2', '3'].map(d => ({ student_id: 'a', day: d })),
      ...['1', '2', '3', '4'].map(d => ({ student_id: 'c', day: d })),
      { student_id: 'b', day: '1' },
      ...['1', '2', '3'].map(d => ({ student_id: 'gone', day: d }))
    ]
    expect(frequentAbsentees(students, abs, 3)).toEqual([
      { id: 'c', name: 'حمزة', count: 4 },
      { id: 'a', name: 'أنس', count: 3 }
    ])
  })
})

describe('لوحة المعلم — رصد الشهر', () => {
  it('السابقُ المعادُ بملاحظةٍ هو المنتظَر، وحالُه «أُعيد»', () => {
    const r = recordingStatus([report(2026, 10, 'draft', 'راجع حمزة')], '2026-11-20')
    expect(r).toMatchObject({ label: '10-2026', state: 'returned', returnNote: 'راجع حمزة', opensOn: '2026-10-31' })
  })

  it('لا شهرَ قبل بداية المشروع (10/2026): مسوّدةُ 9 لا تُعرض', () => {
    expect(recordingStatus([report(2026, 9, 'draft', 'راجع')], '2026-10-20')).toMatchObject({ label: '10-2026', state: 'none' })
  })

  it('السابقُ مُرسَل ← الجاري، ولم يبدأ بعد', () => {
    const r = recordingStatus([report(2026, 9, 'submitted')], '2026-10-20')
    expect(r).toMatchObject({ label: '10-2026', state: 'none', returnNote: null, opensOn: '2026-10-31' })
  })

  it('لا رصدَ سابق ← الجاري (كما تفتح شاشة الإنجاز)', () => {
    expect(recordingStatus([report(2026, 10, 'draft')], '2026-10-20')).toMatchObject({ label: '10-2026', state: 'draft' })
  })

  it('من لم يُرصد له في شهر الرصد', () => {
    const records = [rec('a', 2026, 10, 'draft', 5), rec('b', 2026, 9, 'approved', 4)]
    expect(unrecordedStudents(students, records, { year: 2026, month: 10 }).map(s => s.id)).toEqual(['b', 'c'])
  })
})

describe('لوحة المعلم — المطلوب منك الآن', () => {
  const base = {
    today: '2026-10-20',
    todayAttendance: { isFriday: false, held: false, absent: 0 },
    recording: recordingStatus([], '2026-10-20'),
    recordedCount: 2,
    studentCount: 6,
    incentive: { allocated: 0, status: null, returned: false },
    newAlerts: 0,
    money: (n: number) => `${n} ₪`,
    day: (iso: string) => iso
  } satisfies Parameters<typeof teacherActions>[0]

  it('المعادُ إليك أوّلاً، ثم ما ينتظرك، ثم المنجَز', () => {
    const acts = teacherActions({
      ...base,
      todayAttendance: { isFriday: false, held: true, absent: 2 },
      recording: recordingStatus([report(2026, 10, 'draft', 'راجع')], '2026-11-20'),
      incentive: { allocated: 300, status: null, returned: false },
      newAlerts: 1
    })
    expect(acts.map(a => `${a.key}:${a.tone}`)).toEqual(['rec:urgent', 'alerts:urgent', 'inc:todo', 'att:done'])
    expect(acts.find(a => a.key === 'rec')).toMatchObject({ detail: 'راجع', to: '/t/quran?y=2026&m=10' })
    expect(acts.find(a => a.key === 'att')?.detail).toBe('غاب 2')
  })

  it('رصدٌ لم يُرسل: التقدّمُ وموعدُ الإرسال', () => {
    const rec = teacherActions(base).find(a => a.key === 'rec')
    // التسميةُ معزولةٌ لاتينيّاً (LRI…PDI) كي لا تنقلب «2026-10» بعد كلامٍ عربيّ
    expect(rec).toMatchObject({ tone: 'todo', title: 'رصد شهر ⁦10-2026⁩: رُصد 2 من 6', detail: 'يُرسَل ابتداءً من 2026-10-31' })
  })

  it('يومُ إجازة: بندُ الإجازة هادئاً بدل «لم تسجّل حضور اليوم»', () => {
    const acts = teacherActions({ ...base, todayAttendance: { isFriday: false, held: false, absent: 0, holiday: 'عيد' } })
    const att = acts.find(a => a.key === 'att')
    expect(att).toMatchObject({ tone: 'done', icon: 'i-lucide-calendar-off', title: 'اليوم إجازة: عيد', to: '/t' })
    expect(att?.cta).toBeUndefined()
    expect(acts.some(a => a.title === 'لم تسجّل حضور اليوم بعد')).toBe(false)
  })

  it('إجازةٌ null أو غائبة: الحضورُ كما كان', () => {
    for (const holiday of [null, undefined]) {
      const att = teacherActions({ ...base, todayAttendance: { isFriday: false, held: false, absent: 0, holiday } }).find(a => a.key === 'att')
      expect(att?.title).toBe('لم تسجّل حضور اليوم بعد')
    }
  })

  it('الجمعةُ بلا بند حضور، ولا كشفَ حوافز بلا مخصّصٍ ولا كشف', () => {
    const keys = teacherActions({ ...base, todayAttendance: { isFriday: true, held: false, absent: 0 } }).map(a => a.key)
    expect(keys).toEqual(['rec'])
  })
})

describe('لوحة المعلم — الحفظ والاختبارات', () => {
  it('آخرُ شهرٍ رُصد بأيّ حالة: المسوّدةُ الأحدثُ تغلب المعتمَدَ الأقدم، والتقريرُ الفارغ لا يُعدّ', () => {
    const reports = [report(2026, 9, 'approved'), report(2026, 11, 'draft'), report(2026, 10, 'draft')]
    const records = [rec('a', 2026, 9, 'approved', 12), rec('a', 2026, 10, 'draft', 30)]
    expect(lastRecordedReport(reports, records)?.id).toBe('2026-10')
    expect(lastRecordedReport(reports, [])).toBeNull()
  })

  it('خلاصةُ الشهر: التقييمُ بالخطة، و«أُعيد» للمسوّدة المعادة', () => {
    const plan = { required: 10, full: 10, basis: 'full' as const }
    const row = (id: string, pages: number | null, outcome: StudentMonthRow['outcome']): StudentMonthRow => ({
      studentId: id, name: id, recordedElsewhere: false, suggestedFrom: null, suggestedFromPrevious: false,
      daysHeld: 20, daysAttended: 20, plan, outcome, juzDone: 0, khatm: false,
      record: pages === null ? null : { id, from: null, to: null, pagesMemorized: pages, pagesReviewed: null, notes: null } as StudentMonthRow['record']
    })
    const rows = [row('a', 12, 'done'), row('b', 7, 'short'), row('c', null, 'unrecorded')]
    expect(monthSummary(report(2026, 10, 'draft', 'راجع'), rows)).toEqual({
      label: '10-2026', state: 'returned', done: 1, short: 1, unmeasured: 0, unrecorded: 1
    })
    expect(monthSummary(report(2026, 9, 'approved'), [])).toMatchObject({ state: 'approved', done: 0 })
  })

  it('نتائجُ الشهر: ناجحٌ ويعيد', () => {
    expect(examTally([{ passed: true }, { passed: false }, { passed: true }, { passed: null }])).toEqual({ passed: 2, failed: 1 })
  })

  it('المستحقّ: دورةٌ بلا ترشيحٍ معلّق ولا تلميحِ عدم بلوغ', () => {
    const base = { halaqa_id: 'h', juzReached: 3, pendingItemId: null }
    const cycle = { id: 1 } as NomineeRow['cycle']
    const rows: NomineeRow[] = [
      { ...base, id: 'a', full_name: 'أنس', cycle, blocked: null, hint: null },
      { ...base, id: 'b', full_name: 'بلال', cycle, blocked: null, hint: 'لم يبلغ' },
      { ...base, id: 'c', full_name: 'حمزة', cycle, blocked: 'pending', hint: null },
      { ...base, id: 'd', full_name: 'زيد', cycle: null, blocked: 'done', hint: null }
    ]
    expect(examEligible(rows)).toEqual([{ id: 'a', name: 'أنس' }])
  })
})
