/**
 * تصديرُ البيانات إلى Excel (طلب المستخدم 2026-10-28) — للمدير الإداريّ وحده: العاملون والطلاب والحلقات، والحضورُ
 * والإنجازُ القرآنيّ لشهرٍ، ونتائجُ الاختبارات، وتصديرٌ شاملٌ في ملفٍّ واحد. الجلبُ عبر Supabase (RLS تحكم)
 * على دفعاتٍ فوق حدّ الألف صفّ، والبناءُ في utils/excel.
 */
import type { Database } from '~/types/database.types'
import { EXPORT_PAGE_SIZE } from '~/constants/dataExport'
import { gazaToday, periodLabel } from '~/utils/reportWindow'
import { toExamCycle, CYCLE_COLUMNS, type ExamCycleRow } from '~/utils/exams/cycles'
import { attendanceSheet, examsSheet, quranSheet, type ExamResultRow } from '~/utils/excel/activity'
import { halaqatSheet, staffSheet, studentsSheet, type HalaqaRow, type ProfileRow, type StudentRow } from '~/utils/excel/people'
import { downloadWorkbook, exportFileName, type SheetSpec } from '~/utils/excel/workbook'

export type ExportKind = 'staff' | 'students' | 'halaqat' | 'attendance' | 'quran' | 'exams' | 'all'

/** أوّلُ يومٍ وآخرُه لشهرٍ `YYYY-MM-DD`. */
export function monthRange(year: number, month: number): { from: string, to: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` }
}

export function useDataExport() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()
  const busy = ref<ExportKind | null>(null)

  /** يجلب الجدولَ كلَّه على دفعاتٍ (حدُّ Supabase ألفُ صفٍّ في الطلب). */
  async function fetchAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null, error: unknown }>): Promise<T[]> {
    const out: T[] = []
    for (let from = 0; ; from += EXPORT_PAGE_SIZE) {
      const { data, error } = await query(from, from + EXPORT_PAGE_SIZE - 1)
      if (error) throw error
      out.push(...(data ?? []))
      if (!data || data.length < EXPORT_PAGE_SIZE) return out
    }
  }

  async function base() {
    const [staff, students, halaqat] = await Promise.all([
      fetchAll<ProfileRow>((a, b) => supabase.from('profiles').select('*').neq('role', 'student').order('full_name').range(a, b)),
      fetchAll<StudentRow>((a, b) => supabase.from('students').select('*').order('full_name').range(a, b)),
      fetchAll<HalaqaRow>((a, b) => supabase.from('halaqat').select('*').order('name').range(a, b))
    ])
    return { staff, students, halaqat, names: new Map(staff.map(p => [p.id, p.full_name])) }
  }
  type Base = Awaited<ReturnType<typeof base>>

  async function attendance(b: Base, year: number, month: number): Promise<SheetSpec> {
    const { from, to } = monthRange(year, month)
    const [days, absences] = await Promise.all([
      fetchAll((a, z) => supabase.from('attendance_days').select('halaqa_id, day').gte('day', from).lte('day', to).range(a, z)),
      fetchAll((a, z) => supabase.from('attendance_absences').select('halaqa_id, day, student_id, kind').gte('day', from).lte('day', to).range(a, z))
    ])
    return attendanceSheet(periodLabel(year, month), b.halaqat, b.students, days, absences)
  }

  async function quran(b: Base, year: number, month: number): Promise<SheetSpec> {
    const reports = await fetchAll((a, z) => supabase.from('monthly_reports').select('id, halaqa_id, status')
      .eq('report_year', year).eq('report_month', month).range(a, z))
    const ids = reports.map(r => r.id)
    const [records, surahs] = await Promise.all([
      ids.length
        ? fetchAll((a, z) => supabase.from('quran_records')
            .select('report_id, student_id, from_surah, from_ayah, to_surah, to_ayah, pages_memorized, pages_reviewed, notes')
            .in('report_id', ids).range(a, z))
        : Promise.resolve([]),
      fetchAll((a, z) => supabase.from('surahs').select('number, name').range(a, z))
    ])
    return quranSheet(periodLabel(year, month), b.halaqat, b.students, b.names, reports, records, new Map(surahs.map(s => [s.number, s.name])))
  }

  async function exams(b: Base): Promise<SheetSpec> {
    const [results, cycles] = await Promise.all([
      fetchAll<ExamResultRow>((a, z) => supabase.from('exam_results')
        .select('student_id, examiner_id, exam_date, tajweed_score, total_score, pass_mark_snapshot, passed, notes, item:exam_list_item_id(exam_cycle_id, list:exam_list_id(halaqa_id))')
        .range(a, z).returns<ExamResultRow[]>()),
      fetchAll<ExamCycleRow>((a, z) => supabase.from('exam_cycles').select(CYCLE_COLUMNS).range(a, z).returns<ExamCycleRow[]>())
    ])
    return examsSheet(results, b.halaqat, b.students, b.names, cycles.map(toExamCycle))
  }

  const TITLES: Record<ExportKind, string> = {
    staff: 'العاملون', students: 'الطلاب', halaqat: 'الحلقات', attendance: 'الحضور', quran: 'الإنجاز القرآني', exams: 'نتائج الاختبارات', all: 'تصدير شامل'
  }

  /** يبني الملفّ المطلوب وينزّله؛ الحضورُ والإنجازُ لشهر (`year`/`month`)، والشاملُ يضمّهما لذلك الشهر. */
  async function run(kind: ExportKind, year: number, month: number): Promise<void> {
    if (busy.value) return
    busy.value = kind
    try {
      const b = await base()
      const sheets: SheetSpec[] = []
      if (kind === 'staff' || kind === 'all') sheets.push(staffSheet(b.staff, b.halaqat))
      if (kind === 'students' || kind === 'all') sheets.push(studentsSheet(b.students, b.halaqat, b.names))
      if (kind === 'halaqat' || kind === 'all') sheets.push(halaqatSheet(b.halaqat, b.names, b.students))
      if (kind === 'attendance' || kind === 'all') sheets.push(await attendance(b, year, month))
      if (kind === 'quran' || kind === 'all') sheets.push(await quran(b, year, month))
      if (kind === 'exams' || kind === 'all') sheets.push(await exams(b))
      const title = kind === 'attendance' || kind === 'quran' ? `${TITLES[kind]} ${periodLabel(year, month)}` : TITLES[kind]
      await downloadWorkbook(exportFileName(title, gazaToday()), sheets)
      toast.add({ title: `نُزّل ملفّ «${title}».`, color: 'success', icon: 'i-lucide-file-spreadsheet' })
    } catch (err) {
      handle(err, 'تعذّر التصدير — حاول مجدداً.')
    } finally {
      busy.value = null
    }
  }

  return { busy, run }
}
