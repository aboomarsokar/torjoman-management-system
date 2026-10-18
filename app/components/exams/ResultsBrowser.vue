<script setup lang="ts">
/**
 * متصفّح نتائج الاختبارات (§4.16) — لكل الأدوار حسب النطاق (RLS يقصّ البيانات):
 * فلاتر هرمية (مشرف ميداني → حلقة) تظهر حسب الدور + ترقيم صفحات.
 */
import type { Database } from '~/types/database.types'

const supabase = useSupabaseClient<Database>()
const { isTeacher, isFieldSupervisor, isManager, isReadOnly, isWomenAdmin } = usePermissions()
/** فلتر المشرف لمن يرى أكثر من مشرف: الإداري والفني ومشرف المشروع والمديرة الإدارية. */
const showSupervisorFilter = computed(() => isManager.value || isReadOnly.value || isWomenAdmin.value)

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
  exam_list_item: { exam_plan: { parts_from: number, parts_to: number } | null } | null
}
type FlatResult = {
  id: string
  exam_date: string
  total_score: number | null
  passed: boolean | null
  student: string
  range: string
  halqaId: string
  halqa: string
  supId: string
  sup: string
}

// بلا await قبل defineExpose (قاعدة vue/no-expose-after-await) — الجلب عميل فقط أصلاً
const { data: rawResults, refresh } = useAsyncData<RawResult[]>('exams-results', async () => {
  const { data, error } = await supabase
    .from('exam_results')
    .select('id, exam_date, total_score, passed, student:student_id(full_name, halaqa:halaqa_id(id, name, supervisor:supervisor_id(id, full_name))), exam_list_item:exam_list_item_id(exam_plan:exam_plan_id(parts_from, parts_to))')
    .order('exam_date', { ascending: false })
    .limit(500)
    .returns<RawResult[]>()
  if (error) {
    console.error('[exams] results:', error.message)
    return []
  }
  return data ?? []
}, { server: false, default: () => [] })

defineExpose({ refresh })

const allResults = computed<FlatResult[]>(() => (rawResults.value ?? []).map((r) => {
  const h = r.student?.halaqa
  const sup = h?.supervisor
  return {
    id: r.id, exam_date: r.exam_date, total_score: r.total_score, passed: r.passed,
    student: r.student?.full_name ?? '—',
    range: r.exam_list_item?.exam_plan ? `${r.exam_list_item.exam_plan.parts_from}–${r.exam_list_item.exam_plan.parts_to}` : '—',
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
    <div
      v-else
      class="card table-wrap"
    >
      <table>
        <thead>
          <tr>
            <th class="ta-start">
              #
            </th>
            <th class="ta-start">
              الطالب
            </th>
            <th class="ta-start">
              الحلقة
            </th>
            <th
              v-if="!isTeacher && !isFieldSupervisor"
              class="ta-start"
            >
              المشرف
            </th>
            <th class="ta-start">
              النطاق
            </th>
            <th class="ta-start">
              التاريخ
            </th>
            <th class="ta-start">
              العلامة
            </th>
            <th class="ta-start">
              النتيجة
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(r, i) in resPaged"
            :key="r.id"
          >
            <td class="muted">
              {{ i + 1 }}
            </td>
            <td class="strong">
              {{ r.student }}
            </td>
            <td class="muted">
              {{ r.halqa }}
            </td>
            <td
              v-if="!isTeacher && !isFieldSupervisor"
              class="muted"
            >
              {{ r.sup }}
            </td>
            <td class="muted">
              {{ r.range }}
            </td>
            <td class="muted">
              {{ r.exam_date }}
            </td>
            <td><strong>{{ r.total_score ?? '—' }}</strong> / 100</td>
            <td>
              <UBadge
                :label="r.passed ? 'مجتاز' : 'غير مجتاز'"
                :color="r.passed ? 'success' : 'error'"
                variant="soft"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
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

.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); }
.table-wrap { overflow-x: auto; }
.table-wrap table { width: 100%; border-collapse: collapse; font-size: 15px; }
@media (max-width: 640px) { .table-wrap table { min-width: 600px; } }
.table-wrap thead tr { background: var(--surface-2); }
.table-wrap th { padding: 14px 18px; font-weight: 600; color: var(--ink-3); font-size: 13px; white-space: nowrap; }
.ta-start { text-align: start; }
.table-wrap tbody tr { border-top: 1px solid var(--line); }
.table-wrap td { padding: 13px 18px; vertical-align: middle; white-space: nowrap; }
.strong { font-weight: 600; color: var(--ink); }
.muted { color: var(--ink-2); }
</style>
