/**
 * بياناتُ شهرٍ لحلقة: صفوفُ الطلاب (اقتراحُ بداية الرصد، الحضورُ منذ الالتحاق، المطلوبُ المقسَّط،
 * التصنيف، الأجزاءُ المنجزة)، وحفظُ سجلّ طالب، وإجراءاتُ الحالة (إرسال/اعتماد/إعادة).
 * الدوالُّ النقيّة مُصدَّرة ومختبَرة؛ والقاعدةُ هي الحَكَم في الصلاحيات ومسار الحالات (الأخطاء تُعرض بالعربية).
 */
import type { Ref } from 'vue'
import type { Database } from '~/types/database.types'
import type { Position } from '~/utils/quran/position'
import { buildStudentRows } from '~/utils/quran/month'
import type { QuranRecordRow, ReportHeader, StudentMonthRow } from '~/utils/quran/month'
import { HISTORY_MONTHS, latestEnds, monthRange } from '~/utils/quran/monthHistory'
import type { HistoryRow } from '~/utils/quran/monthHistory'
import { shiftMonth } from '~/utils/reportWindow'

// الدوالُّ النقيّة والأنواع تعيش في utils (حدُّ 300 سطر) وتُعاد من هنا لمن يستوردها من الـcomposable
export { buildStudentRows, canApproveReport, summarizeOutcomes } from '~/utils/quran/month'
export type { MonthRecord, QuranRecordRow, ReportHeader, StudentMonthRow, BuildRowsInput } from '~/utils/quran/month'

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
      loading.value = false
      return
    }
    const y = year.value
    const m = month.value
    loading.value = true
    try {
      await reference.load()
      // المراجعُ لم تُحمَّل (الخطأ معروضٌ من reference.load): لا صفوفَ تُبنى على مراجعَ فارغة
      if (!reference.ready.value) {
        if (mine === generation) {
          report.value = null
          rows.value = []
        }
        return
      }
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

      // استعلامٌ واحد لكلّ جدول: سجلّاتُ الشهر، وتاريخُ نهايات الطلاب. التاريخُ محدودٌ بآخر HISTORY_MONTHS شهراً
      // قبل الشهر المعروض على مستوى السنة (حدُّ سنةٍ كاملة يكفي لقصّ الخادم؛ `latestEnds` يحسم الأدقّ) ومرتّبٌ بالأحدث
      const lowerYear = shiftMonth(y, m, -HISTORY_MONTHS).year
      const [recordsRes, historyRes] = ids.length
        ? await Promise.all([
            reportRes.data
              ? supabase.from('quran_records').select('*').eq('report_id', reportRes.data.id).in('student_id', ids)
              : Promise.resolve({ data: [] as QuranRecordRow[], error: null }),
            supabase.from('quran_records')
              .select('student_id, to_surah, to_ayah, report:monthly_reports!inner(report_year, report_month, status)')
              .in('student_id', ids).not('to_surah', 'is', null)
              .gte('report.report_year', lowerYear)
              .order('report(report_year)', { ascending: false })
              .order('report(report_month)', { ascending: false })
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
    const cached = report.value
    const y = year.value
    const m = month.value
    // الرأسُ المخبّأ يخصّ حلقةً/شهراً آخر (تبديلٌ لم يكتمل تحميلُه): لا يُكتب سجلٌّ تحت رأسٍ خاطئ
    if (cached && cached.halaqa_id === hid && cached.report_year === y && cached.report_month === m) return cached
    const found = await supabase.from('monthly_reports').select(REPORT_COLUMNS)
      .eq('halaqa_id', hid).eq('report_year', y).eq('report_month', m).maybeSingle()
    if (found.error) throw found.error
    if (found.data) return found.data
    const created = await supabase.from('monthly_reports')
      .insert({ halaqa_id: hid, report_year: y, report_month: m })
      .select(REPORT_COLUMNS).single()
    if (!created.error) return created.data
    if (created.error.code !== '23505') throw created.error
    const existing = await supabase.from('monthly_reports').select(REPORT_COLUMNS)
      .eq('halaqa_id', hid).eq('report_year', y).eq('report_month', m).single()
    if (existing.error) throw existing.error
    return existing.data
  }

  async function saveRecord(
    studentId: string,
    input: { from: Position | null, to: Position | null, pagesMemorized: number, pagesReviewed: number | null, notes: string | null }
  ): Promise<boolean> {
    const hid = halaqaId.value
    if (!hid) return false
    if (loading.value) {
      handle(new Error('انتظر حتى يكتمل التحميل.'))
      return false
    }
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
      const { data, error } = await supabase.from('monthly_reports')
        .update(returnNote === undefined ? { status } : { status, return_note: returnNote })
        .eq('id', current.id)
        .select('id')
      if (error) throw error
      // RLS تُسقط التحديثَ بلا خطأ حين لا يملك صاحبُه الخطوة: لا صفَّ مُحدَّثاً = فشل
      if (!data?.length) throw new Error('لم يتغيّر شيء — قد لا تملك هذه الخطوة.')
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
