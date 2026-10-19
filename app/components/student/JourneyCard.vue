<script setup lang="ts">
/**
 * بطاقة رحلة الطالب على دورات الاختبار (للقراءة فقط) — مشتركة بين ملف الطالب الداخلي
 * وصفحة «صفحتي». تجلب دوراتِ الاختبار ونتائج الطالب وصفحات الحفظ المعتمدة وتمرّرها
 * إلى `StudentJourney`. كلّ ما يُجلب خاضعٌ لـRLS: الطالب لا يرى إلا ما يخصّه.
 *
 * `ownRecords` (صفحة الطالب /me): الطالب لا يجتاز سياستَي `exam_list_items` و`monthly_reports`،
 * فتصله تضمينات الدورة والاعتماد `null` (محطّاتٌ مجتازةٌ تظهر «مستحقّة» وصفحاتٌ معتمدةٌ تُجمَع صفراً).
 * فيقرأ عبر `my_exam_cycle_results()` و`my_approved_pages()` و`my_quran_months()` المقصورة على سجلّه.
 * العاملون يقرؤون `quran_records` المعتمَدة (RLS). تحت الرحلة «سجلّ الشهور» و«وصل N من 30 جزءاً».
 */
import type { Database } from '~/types/database.types'
import type { ExamCycle } from '~/utils/exams/cycles'
import { toApprovedPages, toCycleResults } from '~/utils/journeyInputs'
import type { ApprovedMonth } from '~/utils/quran/studentHistory'
import { juzReached, toMonthHistory, totalPages } from '~/utils/quran/studentHistory'

interface Props {
  studentId: string
  quranParts: number | null
  enrollmentDate: string | null
  /** الطالب نفسه يعرض رحلته (يقرأ بدالّتيه الخاصّتين لا بالتضمين). */
  ownRecords?: boolean
}

const props = withDefaults(defineProps<Props>(), { ownRecords: false })

const supabase = useSupabaseClient<Database>()
// المطلوبُ الشهريّ من الإعدادات مباشرةً
const { data: targetPerMonth } = useLazyAsyncData<number>('journey-target-pages', async () => {
  const { data } = await supabase.from('app_settings').select('target_memorization_pages').eq('id', 1).maybeSingle()
  return data?.target_memorization_pages ?? 30
}, { server: false, default: () => 30 })

// جلب غير حاجز: الاستعلامات الثلاثة مستقلّة وتعمل بالتوازي
const { data: cycles } = useLazyAsyncData<ExamCycle[]>('journey-exam-cycles', async () => {
  const { data } = await supabase.from('exam_cycles')
    .select('id, stage_number, cycle_number, parts_from, parts_to, surahs_label, sort_order')
    .order('sort_order')
  return (data ?? []).map(c => ({ ...c, sort_order: c.sort_order ?? 0 }))
}, { server: false, default: () => [] })

type ResultRow = { passed: boolean | null, total_score: number | null, exam_list_item: { exam_cycle_id: number | null } | null }
const { data: examResults } = useLazyAsyncData(() => `journey-results-${props.studentId}-${props.ownRecords}`, async () => {
  if (props.ownRecords) {
    const { data, error } = await supabase.rpc('my_exam_cycle_results')
    if (error) console.error('[journey] فشل جلب نتائجي:', error.message)
    return toCycleResults(data)
  }
  const { data } = await supabase
    .from('exam_results')
    .select('passed, total_score, exam_list_item:exam_list_item_id(exam_cycle_id)')
    .eq('student_id', props.studentId)
    .returns<ResultRow[]>()
  return (data ?? []).map(r => ({ exam_cycle_id: r.exam_list_item?.exam_cycle_id ?? null, passed: r.passed, total_score: r.total_score }))
}, { server: false, default: () => [] })

// الشهورُ المعتمَدة: الطالب من `my_quran_months()` (مواضعها قد تكون null)، والعاملون من `quran_records` المعتمَدة
type StaffRecord = Omit<ApprovedMonth, 'report_year' | 'report_month'> & { report: { status: string, report_year: number, report_month: number } | null }
const { data: months } = useLazyAsyncData<ApprovedMonth[]>(() => `journey-months-${props.studentId}-${props.ownRecords}`, async () => {
  if (props.ownRecords) {
    const { data, error } = await supabase.rpc('my_quran_months')
    if (error) console.error('[journey] فشل جلب شهوري المعتمدة:', error.message)
    return data ?? []
  }
  const { data, error } = await supabase
    .from('quran_records')
    .select('from_surah, from_ayah, to_surah, to_ayah, pages_memorized, report:report_id(status, report_year, report_month)')
    .eq('student_id', props.studentId)
    .returns<StaffRecord[]>()
  if (error) console.error('[journey] فشل جلب سجلّات القرآن:', error.message)
  return (data ?? []).flatMap(({ report, ...r }) =>
    report?.status === 'approved' ? [{ ...r, report_year: report.report_year, report_month: report.report_month }] : [])
}, { server: false, default: () => [] })

// إجمالي صفحات الحفظ المعتمدة: الطالب بدالّته، والعاملون من الشهور نفسها (طلبٌ واحد)
const { data: ownPages } = useLazyAsyncData(() => `journey-pages-${props.studentId}-${props.ownRecords}`, async () => {
  if (!props.ownRecords) return 0
  const { data, error } = await supabase.rpc('my_approved_pages')
  if (error) console.error('[journey] فشل جلب صفحاتي المعتمدة:', error.message)
  return toApprovedPages(data)
}, { server: false, default: () => 0 })
const memorizationPages = computed(() => props.ownRecords ? ownPages.value : totalPages(months.value))

const { surahName, juz, ready, load: loadQuranRef } = useQuranReference()
onMounted(() => void loadQuranRef())
const history = computed(() => toMonthHistory(months.value, surahName))
const juzDone = computed(() => ready.value ? juzReached(months.value, props.quranParts, juz.value) : null)
</script>

<template>
  <section class="card journey">
    <h3>
      <span class="ico"><UIcon
        name="i-lucide-route"
        class="size-5"
      /></span>
      رحلة الطالب على دورات الاختبار
    </h3>
    <StudentJourney
      :quran-parts="quranParts"
      :cycles="cycles"
      :results="examResults"
      :memorization-pages="memorizationPages"
      :target-per-month="targetPerMonth"
      :enrollment-date="enrollmentDate"
    />
    <StudentQuranHistory
      :items="history"
      :juz-done="juzDone"
    />
  </section>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 24px; box-shadow: var(--shadow); }
.journey { margin-top: 22px; }
.card h3 { margin: 0 0 18px; font-size: 17px; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 10px; }
.ico { width: 36px; height: 36px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; flex: none; background: var(--green-soft); color: var(--green-ink); }
</style>
