import type { Ref } from 'vue'
import type { Database } from '~/types/database.types'
import type { Position, ProgramJuz } from '~/utils/quran/position'
import { completedJuz, isKhatm, nextPosition, startForNewStudent } from '~/utils/quran/position'
import type { Outcome, ProratedPlan } from '~/utils/quran/plan'
import { outcomeOf, proratePlan } from '~/utils/quran/plan'
import { latestEnds, monthRange } from '~/utils/quran/monthHistory'
import type { HistoryRow } from '~/utils/quran/monthHistory'

/**
 * بياناتُ شهرٍ لحلقة: صفوفُ الطلاب (اقتراحُ بداية الرصد، الحضورُ منذ الالتحاق، المطلوبُ المقسَّط،
 * التصنيف، الأجزاءُ المنجزة)، وحفظُ سجلّ طالب، وإجراءاتُ الحالة (إرسال/اعتماد/إعادة).
 * الدوالُّ النقيّة مُصدَّرة ومختبَرة؛ والقاعدةُ هي الحَكَم في الصلاحيات ومسار الحالات (الأخطاء تُعرض بالعربية).
 */
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
  /** أيامُ الحلقة في الشهر منذ التحاقه. */
  daysHeld: number
  daysAttended: number
  plan: ProratedPlan
  outcome: Outcome
  /** الأجزاءُ المكتملة حتى آخر موضعٍ **معتمَد** (لا يدخله الشهرُ الحاليّ ما لم يُعتمد). */
  juzDone: number
  /** بلغ الفاتحة 1:7 في سجلّ الشهر أو فيما سبقه. */
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
    const heldDays = input.days.filter(d => !s.enrollment_date || d >= s.enrollment_date)
    const absent = absentDays.get(s.id)
    const daysHeld = heldDays.length
    const daysAttended = daysHeld - heldDays.filter(d => absent?.has(d)).length
    const record = recordByStudent.get(s.id) ?? null
    const previous = input.previousEnds[s.id] ?? null
    const plan = proratePlan({ required: input.target, daysHeld, daysAttended })

    return {
      studentId: s.id,
      name: s.full_name,
      record,
      suggestedFrom: previous ? nextPosition(previous, input.ayahCountOf) : startForNewStudent(s.quran_parts ?? 0, input.juz),
      daysHeld,
      daysAttended,
      plan,
      outcome: outcomeOf(record ? record.pagesMemorized : null, plan),
      juzDone: completedJuz(input.approvedEnds[s.id] ?? null, input.juz),
      khatm: isKhatm(record?.to ?? previous)
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

export function useQuranMonth(halaqaId: Ref<string | null>, year: Ref<number>, month: Ref<number>) {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const reference = useQuranReference()
  const report = ref<ReportHeader | null>(null)
  const rows = ref<StudentMonthRow[]>([])
  const loading = ref(false)
  // آخرُ قراءةٍ تغلب ما سبقها (تبديلُ الحلقة/الشهر بسرعة)
  let generation = 0

  const REPORT_COLUMNS = 'id, halaqa_id, report_month, report_year, status, return_note, submitted_at, approved_at, target_pages_snapshot'

  async function load(): Promise<void> {
    const hid = halaqaId.value
    const mine = ++generation
    if (!hid) {
      report.value = null
      rows.value = []
      return
    }
    const y = year.value
    const m = month.value
    loading.value = true
    try {
      await reference.load()
      const range = monthRange(y, m)
      const [students, reportRes, daysRes, absencesRes, settings] = await Promise.all([
        supabase.from('students').select('id, full_name, enrollment_date, quran_parts')
          .eq('halaqa_id', hid).eq('status', 'active').order('full_name'),
        supabase.from('monthly_reports').select(REPORT_COLUMNS)
          .eq('halaqa_id', hid).eq('report_year', y).eq('report_month', m).maybeSingle(),
        supabase.from('attendance_days').select('day').eq('halaqa_id', hid).gte('day', range.from).lte('day', range.to).order('day'),
        supabase.from('attendance_absences').select('student_id, day').eq('halaqa_id', hid).gte('day', range.from).lte('day', range.to),
        supabase.from('app_settings').select('target_memorization_pages').limit(1).maybeSingle()
      ])
      const failure = students.error ?? reportRes.error ?? daysRes.error ?? absencesRes.error ?? settings.error
      if (failure) throw failure
      const ids = (students.data ?? []).map(s => s.id)

      // استعلامٌ واحد لكلّ جدول: سجلّاتُ الشهر، وتاريخُ نهايات الطلاب في كلّ التقارير
      const [recordsRes, historyRes] = ids.length
        ? await Promise.all([
            reportRes.data
              ? supabase.from('quran_records').select('*').eq('report_id', reportRes.data.id).in('student_id', ids)
              : Promise.resolve({ data: [] as QuranRecordRow[], error: null }),
            supabase.from('quran_records')
              .select('student_id, to_surah, to_ayah, report:monthly_reports!inner(report_year, report_month, status)')
              .in('student_id', ids).not('to_surah', 'is', null)
          ])
        : [{ data: [] as QuranRecordRow[], error: null }, { data: [], error: null }]
      const failure2 = recordsRes.error ?? historyRes.error
      if (failure2) throw failure2
      if (mine !== generation) return

      const history = (historyRes.data ?? []) as HistoryRow[]
      const before = { year: y, month: m }
      report.value = reportRes.data
      rows.value = buildStudentRows({
        students: students.data ?? [],
        records: recordsRes.data ?? [],
        previousEnds: latestEnds(history, before, false),
        approvedEnds: latestEnds(history, { year: y, month: m + 1 }, true),
        days: (daysRes.data ?? []).map(d => d.day),
        absences: absencesRes.data ?? [],
        target: reportRes.data?.target_pages_snapshot ?? settings.data?.target_memorization_pages ?? null,
        juz: reference.juz.value,
        ayahCountOf: reference.ayahCountOf
      })
    } catch (err) {
      if (mine === generation) handle(err)
    } finally {
      if (mine === generation) loading.value = false
    }
  }

  /** رأسُ الشهر: الموجودُ، وإلا يُنشأ مسوّدةً (ولو سبقه آخر في الأثناء — فريدٌ على الحلقة/الشهر — يُقرأ ما سبق). */
  async function ensureReport(hid: string): Promise<ReportHeader> {
    if (report.value) return report.value
    const created = await supabase.from('monthly_reports')
      .insert({ halaqa_id: hid, report_year: year.value, report_month: month.value })
      .select(REPORT_COLUMNS).single()
    if (!created.error) return created.data
    if (created.error.code !== '23505') throw created.error
    const existing = await supabase.from('monthly_reports').select(REPORT_COLUMNS)
      .eq('halaqa_id', hid).eq('report_year', year.value).eq('report_month', month.value).single()
    if (existing.error) throw existing.error
    return existing.data
  }

  async function saveRecord(
    studentId: string,
    input: { from: Position | null, to: Position | null, pagesMemorized: number, pagesReviewed: number | null, notes: string | null }
  ): Promise<boolean> {
    const hid = halaqaId.value
    if (!hid) return false
    try {
      const header = await ensureReport(hid)
      const { error } = await supabase.from('quran_records').upsert({
        report_id: header.id,
        student_id: studentId,
        from_surah: input.from?.surah ?? null,
        from_ayah: input.from?.ayah ?? null,
        to_surah: input.to?.surah ?? null,
        to_ayah: input.to?.ayah ?? null,
        pages_memorized: input.pagesMemorized,
        pages_reviewed: input.pagesReviewed,
        notes: input.notes
      }, { onConflict: 'report_id,student_id' })
      if (error) throw error
      await load()
      return true
    } catch (err) {
      handle(err)
      return false
    }
  }

  /** تحديثُ الحالة وحدَها (والملاحظة عند الإعادة)؛ الأختامُ تضعها القاعدة. */
  async function setStatus(status: 'submitted' | 'approved' | 'draft', returnNote?: string): Promise<boolean> {
    const current = report.value
    if (!current) return false
    try {
      const { error } = await supabase.from('monthly_reports')
        .update(returnNote === undefined ? { status } : { status, return_note: returnNote })
        .eq('id', current.id)
      if (error) throw error
      await load()
      return true
    } catch (err) {
      handle(err)
      await load()
      return false
    }
  }

  const submit = () => setStatus('submitted')
  const approve = () => setStatus('approved')
  /** الإعادةُ إلى المسوّدة بملاحظةٍ إلزامية (فارغةٌ تُرفض قبل الطلب). */
  function returnWithNote(note: string): Promise<boolean> {
    const trimmed = note.trim()
    if (!trimmed) {
      handle(new Error('اكتب ملاحظةً توضّح سببَ الإعادة.'))
      return Promise.resolve(false)
    }
    return setStatus('draft', trimmed)
  }

  return { report, rows, loading, load, saveRecord, submit, approve, returnWithNote }
}
