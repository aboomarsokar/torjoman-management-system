/**
 * بياناتُ لوحة المعلم — خطوتان لا سلسلة: الحلقةُ أوّلاً، ثم كلُّ ما تحتاجه اللوحة دفعةً واحدة بالتوازي
 * (طلابُها، وحضورُ الشهر، ورصدُ الشهور، والترشيحات، والسجلّاتُ المعتمدة، واختباراتُ الشهر، والتنبيهات،
 * والحوافز). الحساباتُ في `utils/teacherDashboard.ts` (نقيّة ومختبَرة)، والاستحقاقُ بـ`buildNomineeRows`
 * كشاشة الترشيح. كلُّ ما يُقرأ تحكمه RLS: المعلمُ لا يرى إلا حلقتَه وتنبيهاتِه.
 */
import type { Database } from '~/types/database.types'
import { ABSENCE_ATTENTION_DAYS } from '~/constants/teacherDashboard'
import { CYCLE_COLUMNS, toExamCycle } from '~/utils/exams/cycles'
import { approvedJuzReached, buildNomineeRows, type CycleItemRow } from '~/utils/exams/nomination'
import { HISTORY_MONTHS, monthRange, type HistoryRow } from '~/utils/quran/monthHistory'
import { gazaToday, shiftMonth } from '~/utils/reportWindow'
import { behindStudents } from '~/utils/reading'
import {
  examEligible, examTally, frequentAbsentees, halaqaAttendance, lastApprovedMonth, recordingStatus, unrecordedStudents,
  type DashRecord, type DashReport
} from '~/utils/teacherDashboard'

type StatementStatus = Database['public']['Enums']['statement_status']
type RecordRow = HistoryRow & DashRecord
const FRIDAY = 5

export function useTeacherDashboard() {
  const supabase = useSupabaseClient<Database>()
  const { profile } = useProfile()
  const { handle } = useErrorHandler()
  const quran = useQuranReference()

  async function load() {
    const me = profile.value?.id
    if (!me) return null
    const { data: halaqa, error: hErr } = await supabase.from('halaqat').select('id, name, daily_time').eq('teacher_id', me).limit(1).maybeSingle()
    if (hErr) throw hErr
    if (!halaqa) return { halaqa: null } as const

    const hid = halaqa.id
    const today = gazaToday()
    const year = Number(today.slice(0, 4))
    const month = Number(today.slice(5, 7))
    const range = monthRange(year, month)
    const lowerYear = shiftMonth(year, month, -HISTORY_MONTHS).year

    const [students, days, absences, reports, cycles, items, records, results, alerts, alloc, statement, readingUnits, readingPassed] = await Promise.all([
      supabase.from('students').select('id, full_name, quran_parts, enrollment_date, halaqa_id').eq('halaqa_id', hid).eq('status', 'active').order('full_name'),
      supabase.from('attendance_days').select('day').eq('halaqa_id', hid).gte('day', range.from).lte('day', range.to),
      supabase.from('attendance_absences').select('student_id, day').eq('halaqa_id', hid).gte('day', range.from).lte('day', range.to),
      supabase.from('monthly_reports').select('id, report_year, report_month, status, return_note').eq('halaqa_id', hid)
        .order('report_year', { ascending: false }).order('report_month', { ascending: false }).limit(6),
      supabase.from('exam_cycles').select(CYCLE_COLUMNS).order('sort_order'),
      supabase.from('exam_list_items').select('id, student_id, exam_cycle_id, exam_results(passed), student:student_id!inner(halaqa_id)')
        .eq('student.halaqa_id', hid).not('exam_cycle_id', 'is', null).returns<CycleItemRow[]>(),
      supabase.from('quran_records')
        .select('student_id, to_surah, to_ayah, pages_memorized, report:monthly_reports!inner(report_year, report_month, status), student:student_id!inner(halaqa_id)')
        .eq('student.halaqa_id', hid).gte('report.report_year', lowerYear).returns<RecordRow[]>(),
      supabase.from('exam_results').select('passed, student:student_id!inner(halaqa_id)')
        .eq('student.halaqa_id', hid).gte('exam_date', range.from).lte('exam_date', range.to),
      supabase.from('admin_alerts').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('halaqa_incentives').select('allocated_amount').eq('halaqa_id', hid).eq('incentive_month', month).eq('incentive_year', year).maybeSingle(),
      supabase.from('incentive_statements').select('status, return_note').eq('halaqa_id', hid).eq('statement_month', month).eq('statement_year', year).maybeSingle(),
      supabase.from('reading_units').select('id', { count: 'exact', head: true }),
      supabase.from('reading_attempts').select('student_id, unit_id, student:student_id!inner(halaqa_id)').eq('student.halaqa_id', hid).eq('passed', true),
      quran.load()
    ])
    const failure = students.error ?? days.error ?? absences.error ?? reports.error ?? cycles.error ?? items.error
      ?? records.error ?? results.error ?? alerts.error ?? alloc.error ?? statement.error ?? readingUnits.error ?? readingPassed.error
    if (failure) throw failure

    const studs = students.data ?? []
    const dayList = (days.data ?? []).map(d => d.day)
    const absenceRows = absences.data ?? []
    const recordRows = records.data ?? []
    const recording = recordingStatus((reports.data ?? []) as DashReport[], today)
    const nominees = buildNomineeRows(studs, (cycles.data ?? []).map(toExamCycle), items.data ?? [],
      approvedJuzReached(studs, recordRows, quran.juz.value))
    const todayHeld = dayList.includes(today)
    const unrecorded = unrecordedStudents(studs, recordRows, recording.period)
    // مقرّراتُ القراءة المجتازة لكلّ طالب (مقرّرٌ مكرّرُ النجاح يُعدّ مرّة)
    const passedUnits = new Map<string, Set<number>>()
    for (const a of readingPassed.data ?? []) {
      const set = passedUnits.get(a.student_id) ?? new Set<number>()
      set.add(a.unit_id)
      passedUnits.set(a.student_id, set)
    }
    const readingBehind = behindStudents(studs, new Map([...passedUnits].map(([k, v]) => [k, v.size])), readingUnits.count ?? 0, Date.now())

    return {
      halaqa,
      studentCount: studs.length,
      today: {
        isFriday: new Date(`${today}T12:00:00Z`).getUTCDay() === FRIDAY,
        held: todayHeld,
        absent: todayHeld ? absenceRows.filter(a => a.day === today).length : 0
      },
      recording,
      recordedCount: studs.length - unrecorded.length,
      unrecorded,
      attendance: halaqaAttendance(studs, dayList, absenceRows),
      absentees: frequentAbsentees(studs, absenceRows, ABSENCE_ATTENTION_DAYS),
      lastMonth: lastApprovedMonth(recordRows),
      exams: examTally(results.data ?? []),
      eligible: examEligible(nominees),
      readingBehind,
      newAlerts: alerts.count ?? 0,
      incentive: {
        allocated: alloc.data?.allocated_amount ?? 0,
        status: (statement.data?.status ?? null) as StatementStatus | null,
        returned: statement.data?.status === 'draft' && !!statement.data.return_note
      }
    }
  }

  const { data, pending } = useLazyAsyncData('teacher-dashboard', async () => {
    try {
      return await load()
    } catch (err) {
      handle(err, 'تعذّر تحميل لوحتك. حاول مجدداً.')
      return null
    }
  }, { server: false, default: () => null, watch: [() => profile.value?.id] })

  return { dash: data, pending }
}
