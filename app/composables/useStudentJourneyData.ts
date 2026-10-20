/**
 * بياناتُ رحلة الطالب — مصدرٌ واحدٌ لبطاقة الرحلة (`StudentJourneyCard`) ولوحة تحكّم الطالب
 * (`StudentDashboard`)، فلا يحسب العرضان رقماً واحداً بطريقتين. المفاتيحُ ثابتةٌ بالطالب، فمن
 * يستدعيه مرّتين في الجلسة يأخذ المخبأَ لا طلباً ثانياً.
 *
 * `ownRecords` (صفحة الطالب /me): الطالب لا يجتاز سياستَي `exam_list_items` و`monthly_reports`،
 * فتصله تضمينات الدورة والاعتماد `null` (محطّاتٌ مجتازةٌ تظهر «مستحقّة» وصفحاتٌ معتمدةٌ تُجمَع صفراً).
 * فيقرأ عبر `my_exam_cycle_results()` و`my_approved_pages()` و`my_quran_months()` المقصورة على سجلّه.
 * العاملون يقرؤون `quran_records` المعتمَدة (RLS).
 */
import type { Database } from '~/types/database.types'
import { CYCLE_COLUMNS, toExamCycle, type ExamCycle } from '~/utils/exams/cycles'
import { buildJourney } from '~/utils/journey'
import { toApprovedPages, toCycleResults } from '~/utils/journeyInputs'
import type { ApprovedMonth } from '~/utils/quran/studentHistory'
import { juzReached, toMonthHistory, totalPages } from '~/utils/quran/studentHistory'

export interface JourneySource {
  studentId: string
  quranParts: number | null
  ownRecords: boolean
}

export function useStudentJourneyData(source: () => JourneySource) {
  const supabase = useSupabaseClient<Database>()
  const s = computed(source)

  // المطلوبُ الشهريّ من الإعدادات مباشرةً
  const { data: targetPerMonth } = useLazyAsyncData<number>('journey-target-pages', async () => {
    const { data } = await supabase.from('app_settings').select('target_memorization_pages').eq('id', 1).maybeSingle()
    return data?.target_memorization_pages ?? 30
  }, { server: false, default: () => 30 })

  // جلب غير حاجز: الاستعلامات مستقلّة وتعمل بالتوازي
  const { data: cycles } = useLazyAsyncData<ExamCycle[]>('journey-exam-cycles', async () => {
    const { data, error } = await supabase.from('exam_cycles').select(CYCLE_COLUMNS).order('sort_order')
    if (error) console.error('[journey] فشل جلب دورات الاختبار:', error.message)
    return (data ?? []).map(toExamCycle)
  }, { server: false, default: () => [] })

  type ResultRow = { passed: boolean | null, total_score: number | null, exam_list_item: { exam_cycle_id: number | null } | null }
  const { data: examResults } = useLazyAsyncData(() => `journey-results-${s.value.studentId}-${s.value.ownRecords}`, async () => {
    if (s.value.ownRecords) {
      const { data, error } = await supabase.rpc('my_exam_cycle_results')
      if (error) console.error('[journey] فشل جلب نتائجي:', error.message)
      return toCycleResults(data)
    }
    const { data } = await supabase
      .from('exam_results')
      .select('passed, total_score, exam_list_item:exam_list_item_id(exam_cycle_id)')
      .eq('student_id', s.value.studentId)
      .returns<ResultRow[]>()
    return (data ?? []).map(r => ({ exam_cycle_id: r.exam_list_item?.exam_cycle_id ?? null, passed: r.passed, total_score: r.total_score }))
  }, { server: false, default: () => [] })

  // الشهورُ المعتمَدة: الطالب من `my_quran_months()` (مواضعها قد تكون null)، والعاملون من `quran_records` المعتمَدة
  type StaffRecord = Omit<ApprovedMonth, 'report_year' | 'report_month'> & { report: { status: string, report_year: number, report_month: number } | null }
  const { data: months } = useLazyAsyncData<ApprovedMonth[]>(() => `journey-months-${s.value.studentId}-${s.value.ownRecords}`, async () => {
    if (s.value.ownRecords) {
      const { data, error } = await supabase.rpc('my_quran_months')
      if (error) console.error('[journey] فشل جلب شهوري المعتمدة:', error.message)
      return data ?? []
    }
    const { data, error } = await supabase
      .from('quran_records')
      .select('from_surah, from_ayah, to_surah, to_ayah, pages_memorized, report:report_id(status, report_year, report_month)')
      .eq('student_id', s.value.studentId)
      .returns<StaffRecord[]>()
    if (error) console.error('[journey] فشل جلب سجلّات القرآن:', error.message)
    return (data ?? []).flatMap(({ report, ...r }) =>
      report?.status === 'approved' ? [{ ...r, report_year: report.report_year, report_month: report.report_month }] : [])
  }, { server: false, default: () => [] })

  // إجمالي صفحات الحفظ المعتمدة: الطالب بدالّته، والعاملون من الشهور نفسها (طلبٌ واحد)
  const { data: ownPages } = useLazyAsyncData(() => `journey-pages-${s.value.studentId}-${s.value.ownRecords}`, async () => {
    if (!s.value.ownRecords) return 0
    const { data, error } = await supabase.rpc('my_approved_pages')
    if (error) console.error('[journey] فشل جلب صفحاتي المعتمدة:', error.message)
    return toApprovedPages(data)
  }, { server: false, default: () => 0 })
  const memorizationPages = computed(() => s.value.ownRecords ? ownPages.value : totalPages(months.value))

  const { surahName, juz, ready, load: loadQuranRef } = useQuranReference()
  onMounted(() => void loadQuranRef())
  const history = computed(() => toMonthHistory(months.value, surahName))
  const juzDone = computed(() => ready.value ? juzReached(months.value, s.value.quranParts, juz.value) : null)
  const journey = computed(() => buildJourney(s.value.quranParts, cycles.value, examResults.value ?? []))

  return { targetPerMonth, cycles, examResults, months, memorizationPages, history, juzDone, journey }
}
