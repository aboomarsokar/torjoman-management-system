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

const supabase = useSupabaseClient<Database>()
const { handle } = useErrorHandler()
const { isTeacher, isFieldSupervisor, isManager, isReadOnly, isWomenAdmin } = usePermissions()
/** فلتر المشرف لمن يرى أكثر من مشرف: الإداري والفني ومشرف المشروع والمديرة الإدارية. */
const showSupervisorFilter = computed(() => isManager.value || isReadOnly.value || isWomenAdmin.value)
/** عمود المشرف لمن يرى أكثر من مشرف (لا المعلّم ولا المشرف الميداني). */
const showSupervisorColumn = computed(() => !isTeacher.value && !isFieldSupervisor.value)

/** أعلى مجموعٍ ممكن: تسعةُ أسئلةٍ من 10 + التجويد حتى 9. */
const MAX_TOTAL = EXAM_MAX_TOTAL

type RawResult = {
  id: string
  exam_date: string
  total_score: number | null
  passed: boolean | null
  student: {
    full_name: string
    halaqa: {
      id: string
      name: string
      supervisor: { id: string, full_name: string } | null
    } | null
  } | null
  exam_list_item: { exam_cycle: ExamCycleRow | null } | null
}
type FlatResult = {
  id: string
  exam_date: string
  total_score: number | null
  passed: boolean | null
  student: string
  title: string
  detail: string
  halqaId: string
  halqa: string
  supId: string
  sup: string
}

// بلا await قبل defineExpose (قاعدة vue/no-expose-after-await) — الجلب عميل فقط أصلاً
const { data: rawResults, refresh } = useAsyncData<RawResult[]>('exams-results', async () => {
  const { data, error } = await supabase
    .from('exam_results')
    .select('id, exam_date, total_score, passed, student:student_id(full_name, halaqa:halaqa_id(id, name, supervisor:supervisor_id(id, full_name))), exam_list_item:exam_list_item_id(exam_cycle:exam_cycle_id(id, stage_number, cycle_number, parts_from, parts_to, surahs_label, sort_order))')
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

const allResults = computed<FlatResult[]>(() => (rawResults.value ?? []).filter(r => r.exam_list_item?.exam_cycle).map((r) => {
  const h = r.student?.halaqa
  const sup = h?.supervisor
  const item = r.exam_list_item
  const t = examTargetText(item?.exam_cycle ? toExamCycle(item.exam_cycle) : null)
  return {
    id: r.id, exam_date: r.exam_date, total_score: r.total_score, passed: r.passed,
    student: r.student?.full_name ?? '—',
    title: t.title, detail: t.detail,
    halqaId: h?.id ?? '', halqa: h?.name ?? '—',
    supId: sup?.id ?? '', sup: sup?.full_name ?? '—'
  }
}))

// فلاتر هرمية
const fSupervisor = ref('all')
const fHalqa = ref('all')
const uniq = (arr: { id: string, label: string }[]) => {
  const m = new Map<string, string>()
  for (const x of arr) if (x.id) m.set(x.id, x.label)
  return [{ value: 'all', label: 'الكل' }, ...[...m].map(([value, label]) => ({ value, label }))]
}
const supervisorOpts = computed(() => uniq(allResults.value.map(r => ({ id: r.supId, label: r.sup }))))
const halqaOpts = computed(() => uniq(allResults.value
  .filter(r => fSupervisor.value === 'all' || r.supId === fSupervisor.value)
  .map(r => ({ id: r.halqaId, label: r.halqa }))))
watch(fSupervisor, () => {
  fHalqa.value = 'all'
})

const results = computed(() => allResults.value.filter(r =>
  (fSupervisor.value === 'all' || r.supId === fSupervisor.value)
  && (fHalqa.value === 'all' || r.halqaId === fHalqa.value)))

const { page: resPage, pageCount: resPageCount, total: resTotal, pageSize: resPageSize, paged: resPaged, resetPage: resetResPage } = usePagination(results, 12)
watch([fSupervisor, fHalqa], resetResPage)
function clearResFilters() {
  fSupervisor.value = 'all'
  fHalqa.value = 'all'
}

const columns = computed(() => [
  { key: 'student', label: 'الطالب' },
  { key: 'halqa', label: 'الحلقة' },
  ...(showSupervisorColumn.value ? [{ key: 'sup', label: 'المشرف' }] : []),
  { key: 'cycle', label: 'الدورة' },
  { key: 'exam_date', label: 'التاريخ' },
  { key: 'total_score', label: 'العلامة' },
  { key: 'passed', label: 'النتيجة' }
])
const verdict = (r: FlatResult) => (r.passed ? 'مجتاز' : 'غير مجتاز')
const scoreText = (r: FlatResult) => `${r.total_score ?? '—'} / ${MAX_TOTAL}`
</script>

<template>
  <div>
    <h3 class="sec-title">
      نتائج الطلاب <span class="count">{{ resTotal }}</span>
    </h3>

    <div class="res-filters">
      <UFormField
        v-if="showSupervisorFilter"
        label="المشرف"
        size="sm"
      >
        <UiSelect
          v-model="fSupervisor"
          :items="supervisorOpts"
          size="md"
          class="rf"
        />
      </UFormField>
      <UFormField
        v-if="!isTeacher"
        label="الحلقة"
        size="sm"
      >
        <UiSelect
          v-model="fHalqa"
          :items="halqaOpts"
          size="md"
          class="rf"
        />
      </UFormField>
      <UButton
        v-if="fSupervisor !== 'all' || fHalqa !== 'all'"
        label="مسح الفلاتر"
        color="neutral"
        variant="ghost"
        size="md"
        icon="i-lucide-x"
        @click="clearResFilters"
      />
    </div>

    <UiEmptyState
      v-if="!results.length"
      icon="i-lucide-file-text"
      title="لا نتائج مطابقة"
    />
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
      <template #cycle="{ row }">
        <div class="cyc">
          <span>{{ row.title }}</span>
          <span class="muted sm">{{ row.detail }}</span>
        </div>
      </template>
      <template #exam_date="{ row }">
        <span
          class="muted"
          dir="ltr"
        >{{ row.exam_date }}</span>
      </template>
      <template #total_score="{ row }">
        <strong>{{ row.total_score ?? '—' }}</strong> / {{ MAX_TOTAL }}
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
            { label: 'النطاق', value: row.detail },
            { label: 'التاريخ', value: row.exam_date },
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
  </div>
</template>

<style scoped>
.sec-title { font-size: 18px; font-weight: 700; color: var(--ink); margin: 0 0 14px; display: flex; align-items: center; gap: 9px; }
.count { display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 999px; background: var(--blue-soft); color: var(--blue-ink); font-size: 13px; }
.res-filters { display: flex; gap: 10px; flex-wrap: wrap; align-items: end; margin-bottom: 14px; }
.rf { width: 200px; max-width: 100%; }
.strong { font-weight: 600; color: var(--ink); }
.muted { color: var(--ink-2); }
.sm { font-size: 13px; }
.cyc { display: flex; flex-direction: column; gap: 2px; }
</style>
