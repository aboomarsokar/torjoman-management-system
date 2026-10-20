/**
 * لوحة المعلم — حساباتٌ نقيّة ومختبَرة: حضورُ الشهر، والأكثرُ غياباً، وحالُ رصد الشهر الذي ينتظره،
 * ومن لم يُرصد له، وآخرُ شهرٍ معتمد، ونتائجُ اختبارات الشهر، والمستحقّون للاختبار.
 * شهرُ الرصد هو نفسه الذي تفتح عليه شاشة «الإنجاز القرآني» (`defaultPeriod`)، والاستحقاقُ هو نفسه
 * في شاشة الترشيح (`buildNomineeRows`) — فلا تقول اللوحة غيرَ ما تقوله الشاشتان.
 */
import { countAttendance } from '~/utils/quran/attendanceCount'
import { defaultPeriod, type Period, type ReportStatus } from '~/utils/quran/screen'
import type { NomineeRow } from '~/utils/exams/nomination'
import { openingDay, periodLabel, shiftMonth } from '~/utils/reportWindow'
import { isolateLtr } from '~/utils/transport'

export interface DashStudent { id: string, full_name: string, enrollment_date: string | null }
export interface DashReport { id: string, report_year: number, report_month: number, status: ReportStatus, return_note: string | null }
export interface DashRecord { student_id: string, pages_memorized: number | null, report: { report_year: number, report_month: number, status: string } | null }

/** حضورُ الحلقة في الشهر: مجموعُ الحضور على مجموع الأيام (كلُّ طالبٍ منذ التحاقه). */
export function halaqaAttendance(students: DashStudent[], days: string[], absences: { student_id: string, day: string }[]) {
  const byStudent = new Map<string, Set<string>>()
  for (const a of absences) {
    const set = byStudent.get(a.student_id) ?? new Set<string>()
    set.add(a.day)
    byStudent.set(a.student_id, set)
  }
  let held = 0
  let attended = 0
  for (const s of students) {
    const c = countAttendance(days, byStudent.get(s.id), s.enrollment_date)
    held += c.held
    attended += c.attended
  }
  return { held, attended, pct: held ? Math.round((attended / held) * 100) : null }
}

/** من غاب `threshold` يوماً أو أكثر — الأكثرُ غياباً أولاً، وغيابُ من ليس في الحلقة الآن لا يُحسب. */
export function frequentAbsentees(students: DashStudent[], absences: { student_id: string }[], threshold: number) {
  const counts = new Map<string, number>()
  for (const a of absences) counts.set(a.student_id, (counts.get(a.student_id) ?? 0) + 1)
  return students
    .map(s => ({ id: s.id, name: s.full_name, count: counts.get(s.id) ?? 0 }))
    .filter(s => s.count >= threshold)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ar'))
}

export type RecordingState = 'none' | 'draft' | 'returned' | 'submitted' | 'approved'

/** شهرُ الرصد الذي ينتظر المعلم وحالُه: «أُعيد» = مسوّدةٌ عليها ملاحظةُ المعتمِد. */
export function recordingStatus(reports: DashReport[], today: string) {
  const current = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }
  const prevPeriod = shiftMonth(current.year, current.month, -1)
  const find = (p: Period) => reports.find(r => r.report_year === p.year && r.report_month === p.month) ?? null
  const previous = find(prevPeriod)
  const period = defaultPeriod(today, { previousStatus: previous?.status ?? 'none' })
  const report = find(period)
  const state: RecordingState = !report
    ? 'none'
    : report.status === 'draft' && report.return_note ? 'returned' : report.status
  return {
    period,
    label: periodLabel(period.year, period.month),
    state,
    returnNote: state === 'returned' ? report?.return_note ?? null : null,
    opensOn: openingDay(period.year, period.month)
  }
}

/** طلابٌ ليس لهم سجلٌّ في شهر الرصد. */
export function unrecordedStudents(students: DashStudent[], records: DashRecord[], period: Period) {
  const recorded = new Set(records
    .filter(r => r.report?.report_year === period.year && r.report?.report_month === period.month)
    .map(r => r.student_id))
  return students.filter(s => !recorded.has(s.id)).map(s => ({ id: s.id, name: s.full_name }))
}

/** آخرُ شهرٍ معتمد: صفحاتُه ومتوسّطُها لمن رُصد له؛ null إن لم يُعتمد شيء. */
export function lastApprovedMonth(records: DashRecord[]) {
  const approved = records.filter(r => r.report?.status === 'approved')
  if (!approved.length) return null
  const key = (r: DashRecord) => r.report!.report_year * 12 + r.report!.report_month
  const top = Math.max(...approved.map(key))
  const rows = approved.filter(r => key(r) === top)
  const pages = rows.reduce((sum, r) => sum + (r.pages_memorized ?? 0), 0)
  const first = rows[0]!.report!
  return {
    label: periodLabel(first.report_year, first.report_month),
    pages,
    perStudent: Math.round((pages / rows.length) * 10) / 10
  }
}

/** نتائجُ اختبارات الشهر: ناجحٌ ويعيد. */
export function examTally(results: { passed: boolean | null }[]) {
  return {
    passed: results.filter(r => r.passed === true).length,
    failed: results.filter(r => r.passed === false).length
  }
}

/** المستحقّون للاختبار: لهم دورةٌ مستحقّة، ولا ترشيحَ معلّقاً، وبلغ موضعُهم المعتمد حدودَها (لا تلميح). */
export function examEligible(rows: NomineeRow[]) {
  return rows.filter(r => r.cycle && !r.blocked && !r.hint).map(r => ({ id: r.id, name: r.full_name }))
}

/** بندٌ في «المطلوب منك الآن»: `urgent` أُعيد إليك، `todo` ينتظرك، `done` أُنجز (يُعرض خافتاً). */
export interface TeacherAction {
  key: string
  tone: 'urgent' | 'todo' | 'done'
  icon: string
  title: string
  detail?: string
  to?: string
  cta?: string
}

export interface ActionsInput {
  today: string
  todayAttendance: { isFriday: boolean, held: boolean, absent: number }
  recording: ReturnType<typeof recordingStatus>
  recordedCount: number
  studentCount: number
  incentive: { allocated: number, status: 'draft' | 'submitted' | 'reviewed' | null, returned: boolean }
  newAlerts: number
  /** تنسيقُ المبلغ والتاريخ — يُمرَّران كي يبقى الملفّ بلا تبعيّات عرض. */
  money: (n: number) => string
  day: (iso: string) => string
}

const TONE_ORDER = { urgent: 0, todo: 1, done: 2 } as const

/** بنودُ «المطلوب منك الآن» بترتيب الأولوية: المعادُ إليك، ثم ما ينتظرك، ثم ما أُنجز. */
export function teacherActions(i: ActionsInput): TeacherAction[] {
  const out: TeacherAction[] = []
  const r = i.recording
  const reportLink = `/reports?y=${r.period.year}&m=${r.period.month}`
  // «10-2026» بعد كلامٍ عربيّ تنقلب «2026-10» (الشَّرطةُ لا تصل أرقاماً تلي حروفاً عربية) — تُعزل لاتينيّاً
  const month = isolateLtr(r.label)

  // حضور اليوم (الجمعة بلا حلقة)
  if (!i.todayAttendance.isFriday) {
    out.push(i.todayAttendance.held
      ? { key: 'att', tone: 'done', icon: 'i-lucide-calendar-check', title: 'فُتح يوم اليوم', detail: i.todayAttendance.absent ? `غاب ${i.todayAttendance.absent}` : 'الجميع حاضر', to: '/attendance' }
      : { key: 'att', tone: 'todo', icon: 'i-lucide-calendar-plus', title: 'لم تفتح يوم اليوم بعد', detail: 'افتحه فيصير الجميع حاضراً، ثم سجّل الغيابات وحدها.', to: '/attendance', cta: 'افتح اليوم' })
  }

  // رصد الشهر
  const progress = `رُصد ${i.recordedCount} من ${i.studentCount}`
  const window = i.today >= r.opensOn ? 'الإرسال مفتوح الآن' : `يُرسَل ابتداءً من ${i.day(r.opensOn)}`
  if (r.state === 'returned') {
    out.push({ key: 'rec', tone: 'urgent', icon: 'i-lucide-undo-2', title: `أُعيد إليك رصد شهر ${month}`, detail: r.returnNote ?? undefined, to: reportLink, cta: 'افتح الرصد' })
  } else if (r.state === 'none' || r.state === 'draft') {
    out.push({ key: 'rec', tone: 'todo', icon: 'i-lucide-book-marked', title: `رصد شهر ${month}: ${progress}`, detail: window, to: reportLink, cta: 'افتح الرصد' })
  } else {
    out.push({ key: 'rec', tone: 'done', icon: 'i-lucide-book-check', title: r.state === 'approved' ? `اعتُمد رصد شهر ${month}` : `أُرسل رصد شهر ${month} — بانتظار الاعتماد`, to: reportLink })
  }

  // كشف الحوافز للشهر الجاري — إن خُصّص مبلغٌ أو بدأ الكشف
  const inc = i.incentive
  if (inc.returned) {
    out.push({ key: 'inc', tone: 'urgent', icon: 'i-lucide-undo-2', title: 'أُعيد إليك كشف الحوافز', detail: `المخصّص ${i.money(inc.allocated)}`, to: '/incentives', cta: 'افتح الكشف' })
  } else if (inc.status === 'submitted' || inc.status === 'reviewed') {
    out.push({ key: 'inc', tone: 'done', icon: 'i-lucide-gift', title: inc.status === 'reviewed' ? 'رُوجع كشف الحوافز' : 'أُرسل كشف الحوافز — بانتظار المراجعة', to: '/incentives' })
  } else if (inc.allocated > 0 || inc.status === 'draft') {
    out.push({ key: 'inc', tone: 'todo', icon: 'i-lucide-gift', title: 'كشف الحوافز لم يُرسل', detail: `المخصّص هذا الشهر ${i.money(inc.allocated)}`, to: '/incentives', cta: 'افتح الكشف' })
  }

  // التنبيهات الإدارية
  if (i.newAlerts > 0) {
    out.push({ key: 'alerts', tone: 'urgent', icon: 'i-lucide-bell-ring', title: i.newAlerts === 1 ? 'تنبيهٌ إداريّ بانتظار إقرارك' : `${i.newAlerts} تنبيهات إدارية بانتظار إقرارك`, to: '/alerts', cta: 'اطّلع' })
  }

  return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone])
}
