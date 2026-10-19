/**
 * منطقُ صفوف شهر الحلقة النقيّ: اقتراحُ بداية الرصد، الحضورُ منذ الالتحاق، المطلوبُ المقسَّط، التصنيف،
 * الأجزاءُ المنجزة، وملخّصُ النتائج، وصلاحيةُ الاعتماد في الواجهة. يستعمله `useQuranMonth` ويُعيد تصديره.
 */
import { PROGRAM_JUZ_COUNT } from '~/constants/quran'
import type { Database } from '~/types/database.types'
import { countAttendance } from '~/utils/quran/attendanceCount'
import type { Position, ProgramJuz } from '~/utils/quran/position'
import { completedJuz, isKhatm, nextPosition, startForNewStudent } from '~/utils/quran/position'
import type { Outcome, ProratedPlan } from '~/utils/quran/plan'
import { outcomeOf, proratePlan } from '~/utils/quran/plan'

export type QuranRecordRow = Database['public']['Tables']['quran_records']['Row']
export type ReportHeader = Pick<
  Database['public']['Tables']['monthly_reports']['Row'],
  'id' | 'halaqa_id' | 'report_month' | 'report_year' | 'status' | 'return_note' | 'submitted_at' | 'approved_at' | 'target_pages_snapshot'
>

export interface MonthRecord {
  id: string
  from: Position | null
  to: Position | null
  pagesMemorized: number
  pagesReviewed: number | null
  notes: string | null
}

export interface StudentMonthRow {
  studentId: string
  name: string
  record: MonthRecord | null
  /** بعد آخر نهايةٍ سابقة، وإلا بدايةُ الطالب الجديد؛ null بعد الختم. */
  suggestedFrom: Position | null
  /** الاقتراحُ من نهايةٍ سابقةٍ مرصودة (لا من بداية الطالب الجديد بحسب محفوظه). */
  suggestedFromPrevious: boolean
  /** أيامُ الحلقة في الشهر منذ التحاقه. */
  daysHeld: number
  daysAttended: number
  plan: ProratedPlan
  outcome: Outcome
  /** الأجزاءُ المنجزة: الأكبرُ من الأجزاء المكتملة حتى آخر نهايةٍ **معتمَدة** وما كان يحفظه عند التحاقه (`quran_parts`)؛ لا يدخله الشهرُ الحاليّ ما لم يُعتمد. */
  juzDone: number
  /** بلغ الفاتحة 1:7 في نهايةٍ **معتمَدة** أو كان محفوظُه عند الالتحاق 30 جزءاً؛ المسوّدةُ والمُرسَل لا يُختم بهما. */
  khatm: boolean
}

export interface BuildRowsInput {
  students: { id: string, full_name: string, enrollment_date: string | null, quran_parts: number | null }[]
  /** سجلّاتُ هذا الشهر. */
  records: QuranRecordRow[]
  /** آخرُ «إلى» في شهرٍ سابق (أيّ حالة). */
  previousEnds: Record<string, Position | null>
  /** آخرُ «إلى» معتمَد. */
  approvedEnds: Record<string, Position | null>
  /** أيامُ الحلقة في الشهر. */
  days: string[]
  /** يُقسَّط المطلوبُ بالحضور (الافتراض)؛ false ← كاملاً للجميع مع بقاء أيام الحضور للعرض (`prorationApplies`). */
  prorate?: boolean
  absences: { student_id: string, day: string }[]
  target: number | null
  juz: ProgramJuz[]
  ayahCountOf: (surah: number) => number
}

function toPosition(surah: number | null, ayah: number | null): Position | null {
  return surah === null || ayah === null ? null : { surah, ayah }
}

function toMonthRecord(r: QuranRecordRow): MonthRecord {
  return {
    id: r.id,
    from: toPosition(r.from_surah, r.from_ayah),
    to: toPosition(r.to_surah, r.to_ayah),
    pagesMemorized: r.pages_memorized,
    pagesReviewed: r.pages_reviewed,
    notes: r.notes
  }
}

/** صفوفُ طلاب الحلقة لشهرٍ واحد؛ لا تغيّر المدخلات. */
export function buildStudentRows(input: BuildRowsInput): StudentMonthRow[] {
  const recordByStudent = new Map(input.records.map(r => [r.student_id, toMonthRecord(r)]))
  const absentDays = new Map<string, Set<string>>()
  for (const a of input.absences) {
    const set = absentDays.get(a.student_id) ?? new Set<string>()
    set.add(a.day)
    absentDays.set(a.student_id, set)
  }

  return input.students.map((s) => {
    const { held: daysHeld, attended: daysAttended } = countAttendance(input.days, absentDays.get(s.id), s.enrollment_date)
    const record = recordByStudent.get(s.id) ?? null
    const previous = input.previousEnds[s.id] ?? null
    const heldParts = Math.max(0, Math.min(PROGRAM_JUZ_COUNT, s.quran_parts ?? 0))
    const plan = input.prorate === false
      ? proratePlan({ required: input.target, daysHeld: null, daysAttended: null })
      : proratePlan({ required: input.target, daysHeld, daysAttended, monthDays: input.days.length })

    return {
      studentId: s.id,
      name: s.full_name,
      record,
      suggestedFrom: previous ? nextPosition(previous, input.ayahCountOf) : startForNewStudent(s.quran_parts ?? 0, input.juz),
      suggestedFromPrevious: previous !== null,
      daysHeld,
      daysAttended,
      plan,
      outcome: outcomeOf(record ? record.pagesMemorized : null, plan),
      // الأعلى من المعتمَد في النظام وما كان يحفظه عند التحاقه
      juzDone: Math.max(completedJuz(input.approvedEnds[s.id] ?? null, input.juz), heldParts),
      khatm: isKhatm(input.approvedEnds[s.id] ?? null) || heldParts >= PROGRAM_JUZ_COUNT
    }
  })
}

/** عدّادُ النتائج ونسبةُ المرصودين (غيرُ «لم يُرصد») مقرَّبةً؛ صفرٌ لقائمةٍ فارغة. */
export function summarizeOutcomes(rows: StudentMonthRow[]): Record<Outcome, number> & { recordedPct: number } {
  const summary = { done: 0, short: 0, unmeasured: 0, unrecorded: 0 }
  for (const r of rows) summary[r.outcome]++
  const recordedPct = rows.length ? Math.round(((rows.length - summary.unrecorded) / rows.length) * 100) : 0
  return { ...summary, recordedPct }
}

/** مرآةٌ لـ `can_approve_report_in_halaqa` للواجهة وحدها (الحكمُ للقاعدة): الإداري، والمديرةُ للبنات، والمشرفُ الميدانيّ لحلقته. */
export function canApproveReport(
  role: string | null,
  profileId: string | null,
  halaqa: { gender: 'male' | 'female', supervisor_id: string | null }
): boolean {
  if (role === 'admin_manager') return true
  if (role === 'women_admin') return halaqa.gender === 'female'
  return role === 'field_supervisor' && !!profileId && halaqa.supervisor_id === profileId
}
