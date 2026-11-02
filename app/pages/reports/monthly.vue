<script setup lang="ts">
/**
 * «التقرير الشهري» (طلب المستخدم 2026-11-02): إنجازُ المعلم وطلابه في شهرٍ واحد بنظرة — الحضورُ والغياب، والإنجازُ القرآنيّ
 * بدرجاته، واختباراتُ الشهر، واختبارُ القراءة، والزياراتُ وسجلُّ الجودة، وكلمةُ المشرف. للقراءة وحدها: المعلمُ حلقتَه،
 * والمشرفُ حلقاتِه، والإدارةُ ما تسمح به RLS. الصفوفُ من `useQuranMonth` نفسِه (لا حسابَ ثانٍ)، والإضافاتُ من `fetchMonthlyExtras`.
 */
import type { Database } from '~/types/database.types'
import { summarizeOutcomes } from '~/utils/quran/month'
import { defaultPeriod, periodFromQuery } from '~/utils/quran/screen'
import { attendanceSummary, examSummary, fetchMonthlyExtras, type MonthlyExtras } from '~/utils/monthlyReport'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'التقرير الشهري — ترجمان' })

type HalaqaRow = Pick<Database['public']['Tables']['halaqat']['Row'], 'id' | 'name'>

const supabase = useSupabaseClient<Database>()
const { role, profile } = useProfile()
const { handle } = useErrorHandler()
const { isTeacher } = usePermissions()

const today = gazaToday()
const now = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }
const route = useRoute()
const initial = periodFromQuery(route.query.y, route.query.m, today) ?? defaultPeriod(today, { previousStatus: null })
const year = ref(initial.year)
const month = ref(initial.month)
const halaqaId = ref<string | null>(typeof route.query.h === 'string' ? route.query.h : null)
const query = ref('')

const { data: halaqat, pending: halaqatPending } = useLazyAsyncData<HalaqaRow[]>('monthly-report-halaqat', async () => {
  if (!role.value) return []
  let q = supabase.from('halaqat').select('id, name').eq('status', 'active').order('name')
  if (role.value === 'teacher') q = q.eq('teacher_id', profile.value?.id ?? '')
  else if (role.value === 'field_supervisor') q = q.eq('supervisor_id', profile.value?.id ?? '')
  const { data, error } = await q
  if (error) handle(error)
  return data ?? []
}, { server: false, default: () => [], watch: [role] })
// المعلّمُ حلقتُه الواحدة
watch(halaqat, (list) => {
  if (isTeacher.value && list[0] && !halaqaId.value) halaqaId.value = list[0].id
}, { immediate: true })
const halaqaItems = computed(() => halaqat.value.map(h => ({ label: h.name, value: h.id })))
const halaqa = computed(() => halaqat.value.find(h => h.id === halaqaId.value) ?? null)

const { report, rows, loading, load } = useQuranMonth(halaqaId, year, month)
watch([halaqaId, year, month], load, { immediate: true })

const extras = ref<MonthlyExtras | null>(null)
const extrasLoading = ref(false)
watch([halaqaId, year, month, rows], async () => {
  const hid = halaqaId.value
  if (!hid) {
    extras.value = null
    return
  }
  extrasLoading.value = true
  try {
    extras.value = await fetchMonthlyExtras(supabase, hid, year.value, month.value, rows.value.map(r => r.studentId))
  } catch (err) {
    handle(err)
    extras.value = null
  } finally {
    extrasLoading.value = false
  }
})

const outcomes = computed(() => summarizeOutcomes(rows.value))
const attendance = computed(() => attendanceSummary(rows.value))
const exams = computed(() => examSummary(extras.value?.exams ?? []))
const reading = computed(() => ({
  total: extras.value?.reading.length ?? 0,
  passed: extras.value?.reading.filter(r => r.passed).length ?? 0
}))
</script>

<template>
  <div class="mr">
    <UiPageHeader
      title="التقرير الشهري"
      subtitle="إنجازُ الحلقة وطلابها في الشهر: الحضور، والإنجاز القرآني، والاختبارات، والبرامج المصاحبة، والإشراف."
    />
    <UiEmptyState
      v-if="role && !halaqatPending && !halaqat.length"
      icon="i-lucide-book-open"
      title="لا حلقات في نطاقك"
    />
    <template v-else>
      <QuranMonthFilters
        v-model:halaqa="halaqaId"
        v-model:year="year"
        v-model:month="month"
        v-model:query="query"
        :is-teacher="isTeacher"
        :halaqa-name="halaqa?.name ?? ''"
        :halaqa-items="halaqaItems"
        :max="now"
      />
      <UiEmptyState
        v-if="!halaqaId"
        icon="i-lucide-file-chart-column"
        title="اختر حلقةً لعرض تقريرها"
      />
      <div
        v-else-if="loading && !rows.length"
        class="mr-stack"
        aria-busy="true"
      >
        <UiSkeletonCard
          v-for="i in 3"
          :key="i"
        />
      </div>
      <div
        v-else
        class="mr-stack"
      >
        <MonthlyReportSummary
          :outcomes="outcomes"
          :attendance-pct="attendance.pct"
          :exams="exams"
          :reading="reading"
        />
        <MonthlyReportSupervision
          :visits="extras?.visits"
          :quality="extras?.quality ?? null"
          :approval-note="report?.approval_note ?? null"
          :frequent="attendance.frequent"
        />
        <MonthlyReportStudents
          :rows="rows"
          :exams="extras?.exams ?? []"
          :reading="extras?.reading ?? []"
        />
        <p
          v-if="extras && extras.nominated"
          class="mr-foot"
        >
          رُشّح للاختبار هذا الشهر {{ extras.nominated }} {{ extras.nominated === 1 ? 'طالب' : 'طلاب' }}.
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.mr-stack { display: flex; flex-direction: column; gap: 16px; }
.mr-foot { margin: 0; color: var(--ink-3); font-size: 14px; }
</style>
