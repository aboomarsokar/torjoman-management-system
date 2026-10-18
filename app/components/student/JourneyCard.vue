<script setup lang="ts">
/**
 * بطاقة رحلة الطالب على خطة الاختبارات (للقراءة فقط) — مشتركة بين ملف الطالب الداخلي
 * وصفحة «صفحتي». تجلب خطة الاختبارات ونتائج الطالب وصفحات الحفظ المعتمدة وتمرّرها
 * إلى `StudentJourney`. كلّ ما يُجلب خاضعٌ لـRLS: الطالب لا يرى إلا ما يخصّه.
 */
import type { Database } from '~/types/database.types'

interface Props {
  studentId: string
  quranParts: number | null
  enrollmentDate: string | null
}

const props = defineProps<Props>()

const supabase = useSupabaseClient<Database>()
const { settings: gradeCfg, loadSettings } = useGrades()
onMounted(loadSettings)

// جلب غير حاجز: الاستعلامات الثلاثة مستقلّة وتعمل بالتوازي
const { data: plan } = useLazyAsyncData('journey-exam-plan', async () => {
  const { data } = await supabase.from('exam_plan').select('id, parts_from, parts_to, stage_type').order('parts_to')
  return data ?? []
}, { server: false, default: () => [] })

type ResultRow = { passed: boolean | null, total_score: number | null, exam_list_item: { exam_plan_id: number | null } | null }
const { data: examResults } = useLazyAsyncData(() => `journey-results-${props.studentId}`, async () => {
  const { data } = await supabase
    .from('exam_results')
    .select('passed, total_score, exam_list_item:exam_list_item_id(exam_plan_id)')
    .eq('student_id', props.studentId)
    .returns<ResultRow[]>()
  return (data ?? []).map(r => ({ exam_plan_id: r.exam_list_item?.exam_plan_id ?? null, passed: r.passed, total_score: r.total_score }))
}, { server: false, default: () => [] })

// إجمالي صفحات الحفظ من التقارير الشهرية المعتمدة
type PagesRow = { memorization_pages: number | null, report: { status: string } | null }
const { data: memorizationPages } = useLazyAsyncData(() => `journey-pages-${props.studentId}`, async () => {
  const { data } = await supabase
    .from('monthly_report_students')
    .select('memorization_pages, report:report_id(status)')
    .eq('student_id', props.studentId)
    .returns<PagesRow[]>()
  return (data ?? []).filter(r => r.report?.status === 'approved').reduce((sum, r) => sum + (r.memorization_pages ?? 0), 0)
}, { server: false, default: () => 0 })
</script>

<template>
  <section class="card journey">
    <h3>
      <span class="ico"><UIcon
        name="i-lucide-route"
        class="size-5"
      /></span>
      رحلة الطالب على خطة الاختبارات
    </h3>
    <StudentJourney
      :quran-parts="quranParts"
      :plan="plan"
      :results="examResults"
      :memorization-pages="memorizationPages"
      :target-per-month="gradeCfg.target"
      :enrollment-date="enrollmentDate"
    />
  </section>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 24px; box-shadow: var(--shadow); }
.journey { margin-top: 22px; }
.card h3 { margin: 0 0 18px; font-size: 17px; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 10px; }
.ico { width: 36px; height: 36px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; flex: none; background: var(--green-soft); color: var(--green-ink); }
</style>
