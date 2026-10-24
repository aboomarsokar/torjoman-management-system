<script setup lang="ts">
/**
 * متصفّح نتائج الاختبارات (§4.16) — لكل الأدوار حسب النطاق (RLS يقصّ البيانات):
 * فلاتر هرمية (مشرف ميداني → حلقة) تظهر حسب الدور + ترقيم صفحات. كلُّ نتيجةٍ بدورتها ونطاقها،
 * ولا تُعرض نتيجةٌ بلا دورة. على الجوال بطاقات.
 */
import type { Database } from '~/types/database.types'
import { toExamCycle, type ExamCycleRow } from '~/utils/exams/cycles'
import { examTargetText } from '~/utils/exams/nomination'
import { EXAM_MAX_TOTAL } from '~/constants/exams'
import { examResultStats } from '~/utils/pageStats'

const supabase = useSupabaseClient<Database>()
const { handle } = useErrorHandler()
const { isTeacher, isFieldSupervisor, isExaminer, isManager, isReadOnly, isWomenAdmin } = usePermissions()
/** فلتر المشرف لمن يرى أكثر من مشرف: الإداري والفني ومشرف المشروع والمديرة الإدارية. */
const showSupervisorFilter = computed(() => isManager.value || isReadOnly.value || isWomenAdmin.value)
/** عمود المشرف لمن يرى أكثر من مشرف (لا المعلّم ولا المشرف الميداني). */
const showSupervisorColumn = computed(() => !isTeacher.value && !isFieldSupervisor.value)
/** عمودُ من رصد النتيجة (طلب المستخدم 2026-10-24) — لكلّ من يرى النتائج إلا المختبِرَ نفسَه (هو صاحبُها غالباً). */
const showExaminerColumn = computed(() => !isExaminer.value)
// قسمُ المديرة الإدارية إناثٌ كلُّه: التسمياتُ بالمؤنّث (2026-10-22)
const fem = isWomenAdmin
const W = computed(() => fem.value
  ? { results: 'نتائج الطالبات', student: 'الطالبة', sup: 'المشرفة', examiner: 'المختبِرة', allSups: 'كل المشرفات', emptyHint: 'تظهر هنا حين ترصد المختبِرةُ نتائجَ طالبات قسمك.' }
  : { results: 'نتائج الطلاب', student: 'الطالب', sup: 'المشرف', examiner: 'المختبِر', allSups: 'كل المشرفين', emptyHint: 'تظهر هنا حين يرصد المختبِرُ نتائجَ طلاب نطاقك.' })

/** أعلى مجموعٍ ممكن: تسعةُ أسئلةٍ من 10 + التجويد حتى 9. */
const MAX_TOTAL = EXAM_MAX_TOTAL

type RawResult = {
  id: string
  exam_date: string
  total_score: number | null
  passed: boolean | null
  student: {
    id: string
    full_name: string
    halaqa: {
      id: string
      name: string
      supervisor: { id: string, full_name: string } | null
    } | null
  } | null
  exam_list_item: { exam_cycle: ExamCycleRow | null } | null
  examiner: { full_name: string } | null
}
type FlatResult = {
  id: string
  exam_date: string
  total_score: number | null
  passed: boolean | null
  studentId: string
  student: string
  title: string
  detail: string
  halqaId: string
  halqa: string
  supId: string
  sup: string
  examiner: string
}

// بلا await قبل defineExpose (قاعدة vue/no-expose-after-await) — الجلب عميل فقط أصلاً
const { data: rawResults, refresh, pending } = useAsyncData<RawResult[]>('exams-results', async () => {
  const { data, error } = await supabase
    .from('exam_results')
    .select('id, exam_date, total_score, passed, student:student_id(id, full_name, halaqa:halaqa_id(id, name, supervisor:supervisor_id(id, full_name))), exam_list_item:exam_list_item_id(exam_cycle:exam_cycle_id(id, stage_number, cycle_number, parts_from, parts_to, surahs_label, sort_order)), examiner:examiner_id(full_name)')
    .order('exam_date', { ascending: false })
    .limit(500)
    .returns<RawResult[]>()
  if (error) {
    handle(error)
    return []
  }
  return data ?? []
}, { server: false, default: () => [] })

defineExpose({ refresh })

// حلقاتُ النطاق كلُّها (RLS) لقائمتي الفلتر — كانت القائمةُ من النتائج وحدها فتغيب حلقةٌ لم يُختبر طلابُها بعد
type ScopeHalaqa = { id: string, name: string, supervisor: { id: string, full_name: string } | null }
const { data: scopeHalqat } = useLazyAsyncData<ScopeHalaqa[]>('exams-results-halqat', async () => {
  const { data, error } = await supabase.from('halaqat')
    .select('id, name, supervisor:supervisor_id(id, full_name)').eq('status', 'active').order('name')
    .returns<ScopeHalaqa[]>()
  if (error) handle(error)
  return data ?? []
}, { server: false, default: () => [] })

const allResults = computed<FlatResult[]>(() => (rawResults.value ?? []).filter(r => r.exam_list_item?.exam_cycle).map((r) => {
  const h = r.student?.halaqa
  const sup = h?.supervisor
  const item = r.exam_list_item
  const t = examTargetText(item?.exam_cycle ? toExamCycle(item.exam_cycle) : null)
  return {
    id: r.id, exam_date: r.exam_date, total_score: r.total_score, passed: r.passed,
    studentId: r.student?.id ?? '',
    student: r.student?.full_name ?? '—',
    title: t.title, detail: t.detail,
    halqaId: h?.id ?? '', halqa: h?.name ?? '—',
    supId: sup?.id ?? '', sup: sup?.full_name ?? '—',
    examiner: r.examiner?.full_name ?? '—'
  }
}))

// فلاتر هرمية
const fSupervisor = ref('all')
const fHalqa = ref('all')
/** «الكل» يُسمّى بما يجمعه («كل الحلقات») — تقرأ القائمةُ نفسَها بلا تسمية. */
const uniq = (arr: { id: string, label: string }[], allLabel: string) => {
  const m = new Map<string, string>()
  for (const x of arr) if (x.id) m.set(x.id, x.label)
  return [{ value: 'all', label: allLabel }, ...[...m].map(([value, label]) => ({ value, label }))]
}
// الخياراتُ من حلقات النطاق ومن النتائج معاً (حلقةٌ موقوفة لها نتائجُ قديمة تبقى)، وبجانب الحلقة عددُ نتائجها
const resultsPerHalqa = computed(() => {
  const m = new Map<string, number>()
  for (const r of allResults.value) m.set(r.halqaId, (m.get(r.halqaId) ?? 0) + 1)
  return m
})
const scopeRows = computed(() => [
  ...(scopeHalqat.value ?? []).map(h => ({ halqaId: h.id, halqa: h.name, supId: h.supervisor?.id ?? '', sup: h.supervisor?.full_name ?? '—' })),
  ...allResults.value
])
const supervisorOpts = computed(() => uniq(scopeRows.value.map(r => ({ id: r.supId, label: r.sup })), W.value.allSups))
const halqaOpts = computed(() => uniq(scopeRows.value
  .filter(r => fSupervisor.value === 'all' || r.supId === fSupervisor.value)
  .map(r => ({ id: r.halqaId, label: `${r.halqa} (${resultsPerHalqa.value.get(r.halqaId) ?? 0})` })), 'كل الحلقات'))
watch(fSupervisor, () => {
  fHalqa.value = 'all'
})

const results = computed(() => allResults.value.filter(r =>
  (fSupervisor.value === 'all' || r.supId === fSupervisor.value)
  && (fHalqa.value === 'all' || r.halqaId === fHalqa.value)))

const { page: resPage, pageCount: resPageCount, total: resTotal, pageSize: resPageSize, paged: resPaged, resetPage: resetResPage } = usePagination(results, 12)
// أرقامُ النتائج المعروضة (تتبع فلترَي المشرف والحلقة)
const stats = computed(() => examResultStats(results.value, EXAM_MAX_TOTAL))
watch([fSupervisor, fHalqa], resetResPage)
// تفصيلُ العلامة واختباراتُ الطالب السابقة (طلبا المستخدم 2026-10-22)
const detailOpen = ref(false)
const detail = ref<{ studentId: string, student: string, resultId: string } | null>(null)
function openDetail(r: FlatResult) {
  detail.value = { studentId: r.studentId, student: r.student, resultId: r.id }
  detailOpen.value = true
}
function clearResFilters() {
  fSupervisor.value = 'all'
  fHalqa.value = 'all'
}

const columns = computed(() => [
  { key: 'student', label: W.value.student },
  { key: 'halqa', label: 'الحلقة' },
  ...(showSupervisorColumn.value ? [{ key: 'sup', label: W.value.sup }] : []),
  ...(showExaminerColumn.value ? [{ key: 'examiner', label: W.value.examiner }] : []),
  { key: 'cycle', label: 'الدورة' },
  { key: 'exam_date', label: 'التاريخ' },
  { key: 'total_score', label: 'العلامة' },
  { key: 'passed', label: 'النتيجة' }
])
const verdict = (r: FlatResult) => (r.passed ? 'مجتاز' : 'غير مجتاز')
const scoreText = (r: FlatResult) => `${r.total_score ?? '—'} / ${MAX_TOTAL}`
/** التاريخُ يوماً-شهراً-سنة كبقيّة النظام. */
const fmtDate = (iso: string) => iso.split('-').reverse().join('-')
</script>

<template>
  <div>
    <h3 class="sec-title">
      {{ W.results }} <span class="count">{{ resTotal }}</span>
    </h3>
    <UiStatStrip
      v-if="results.length"
      :items="stats"
      label="أرقام نتائج الاختبارات"
    />

    <!-- الفلاترُ حين توجد نتائجُ تُصفّى — بلا نتائج أصلاً كانت توحي بأنّ الفلتر هو السبب -->
    <div
      v-if="allResults.length"
      class="res-filters"
    >
      <UFormField
        v-if="showSupervisorFilter"
        :label="W.sup"
        :ui="{ label: 'rf-label' }"
      >
        <UiSelect
          v-model="fSupervisor"
          :ui="{ base: 'rounded-[12px] min-h-12' }"
          :items="supervisorOpts"
          size="xl"
          class="rf"
        />
      </UFormField>
      <UFormField
        v-if="!isTeacher"
        label="الحلقة"
        :ui="{ label: 'rf-label' }"
      >
        <UiSelect
          v-model="fHalqa"
          :ui="{ base: 'rounded-[12px] min-h-12' }"
          :items="halqaOpts"
          size="xl"
          class="rf"
        />
      </UFormField>
      <UButton
        v-if="fSupervisor !== 'all' || fHalqa !== 'all'"
        label="مسح الفلاتر"
        color="neutral"
        variant="ghost"
        size="xl"
        icon="i-lucide-x"
        @click="clearResFilters"
      />
    </div>

    <UiSkeletonTable
      v-if="pending && !allResults.length"
      :columns="columns"
    />
    <!-- فراغان مختلفان: لا نتائجَ بعدُ (متى تظهر)، أو لا نتائجَ لهذا الاختيار (والمخرجُ مسحُ الفلاتر) -->
    <UiEmptyState
      v-else-if="!allResults.length"
      icon="i-lucide-clipboard-list"
      title="لا نتائجَ اختباراتٍ بعد"
      :description="W.emptyHint"
    />
    <UiEmptyState
      v-else-if="!results.length"
      icon="i-lucide-filter-x"
      title="لا نتائجَ لهذا الاختيار"
      description="جرّب حلقةً أخرى، أو اعرض النتائج كلَّها."
    >
      <UButton
        label="مسح الفلاتر"
        color="neutral"
        variant="outline"
        icon="i-lucide-x"
        :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
        @click="clearResFilters"
      />
    </UiEmptyState>
    <UiDataTable
      v-else
      :columns="columns"
      :rows="resPaged"
      row-key="id"
    >
      <template #student="{ row }">
        <span class="strong">{{ row.student }}</span>
      </template>
      <template #halqa="{ row }">
        <span class="muted">{{ row.halqa }}</span>
      </template>
      <template #sup="{ row }">
        <span class="muted">{{ row.sup }}</span>
      </template>
      <template #examiner="{ row }">
        <span class="muted">{{ row.examiner }}</span>
      </template>
      <template #cycle="{ row }">
        <div class="cyc">
          <span>{{ row.title }}</span>
          <span class="muted sm">{{ row.detail }}</span>
        </div>
      </template>
      <template #exam_date="{ row }">
        <bdi
          class="muted nowrap"
          dir="ltr"
        >{{ fmtDate(row.exam_date) }}</bdi>
      </template>
      <template #total_score="{ row }">
        <button
          type="button"
          class="score-btn"
          :aria-label="`تفصيل علامة ${row.student}`"
          @click="openDetail(row)"
        >
          <!-- سطرٌ واحدٌ باتّجاهٍ ثابت: كانت «76 /» تنكسر فوق «99» في العمود الضيّق (2026-10-22) -->
          <bdi
            dir="ltr"
            class="nowrap"
          ><strong>{{ row.total_score ?? '—' }}</strong> / {{ MAX_TOTAL }}</bdi>
          <UIcon
            name="i-lucide-chevron-left"
            class="size-4"
          />
        </button>
      </template>
      <template #passed="{ row }">
        <UBadge
          :label="verdict(row)"
          :color="row.passed ? 'success' : 'error'"
          variant="soft"
        />
      </template>
      <template #card="{ row }">
        <UiCardRow
          :title="row.student"
          :subtitle="row.title"
          :fields="[
            { label: 'الحلقة', value: row.halqa },
            ...(showSupervisorColumn ? [{ label: 'المشرف', value: row.sup }] : []),
            ...(showExaminerColumn ? [{ label: W.examiner, value: row.examiner }] : []),
            { label: 'النطاق', value: row.detail },
            { label: 'التاريخ', value: fmtDate(row.exam_date) },
            { label: 'العلامة', value: scoreText(row) }
          ]"
        >
          <template #badge>
            <UBadge
              :label="verdict(row)"
              :color="row.passed ? 'success' : 'error'"
              variant="soft"
            />
          </template>
          <template #actions>
            <UButton
              label="تفصيل العلامة واختباراته"
              color="neutral"
              variant="outline"
              size="md"
              icon="i-lucide-list-checks"
              class="w-full justify-center"
              :ui="{ base: 'rounded-[12px] min-h-11' }"
              @click="openDetail(row)"
            />
          </template>
        </UiCardRow>
      </template>
    </UiDataTable>
    <UiPaginator
      v-if="results.length"
      :page="resPage"
      :page-count="resPageCount"
      :total="resTotal"
      :page-size="resPageSize"
      @update:page="resPage = $event"
    />

    <ExamsResultDetailModal
      v-model:open="detailOpen"
      :student-id="detail?.studentId ?? null"
      :student-name="detail?.student ?? ''"
      :result-id="detail?.resultId ?? null"
    />
  </div>
</template>

<style scoped>
.sec-title { font-size: 18px; font-weight: 700; color: var(--ink); margin: 0 0 14px; display: flex; align-items: center; gap: 9px; }
/* شارةُ العدد الكحليّة نفسُها في اللوحات وصفحة المشرف (2026-10-22) */
.count { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 28px; padding: 0 10px; border-radius: 999px; background: var(--navy); color: #fff; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.res-filters { display: flex; gap: 10px 14px; flex-wrap: wrap; align-items: end; margin-bottom: 14px; padding: 14px 18px; background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); }
/* مثلُ فلترَي «اختبارات الطلاب» (الحلقة والشهر — طلب المستخدم 2026-10-22) */
.rf { width: 280px; max-width: 100%; }
.res-filters :deep(.rf-label) { font-size: 14px; font-weight: 600; color: var(--ink-2); }
@media (max-width: 560px) { .rf { width: 100%; } .res-filters > * { width: 100%; } }
.strong { font-weight: 600; color: var(--ink); }
.nowrap { white-space: nowrap; }
/* زرٌّ ظاهرٌ دائماً — لا عند المرور وحده (طلب المستخدم 2026-10-22) */
.score-btn { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; min-height: 36px; padding: 4px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); box-shadow: 0 1px 2px rgb(9 64 100 / 0.06); color: var(--ink); font: inherit; cursor: pointer; transition: background .15s, border-color .15s; }
.score-btn:hover { background: var(--blue-soft); border-color: var(--blue); color: var(--blue-ink); }
.score-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
.muted { color: var(--ink-2); }
.sm { font-size: 13px; }
.cyc { display: flex; flex-direction: column; gap: 2px; }
</style>
