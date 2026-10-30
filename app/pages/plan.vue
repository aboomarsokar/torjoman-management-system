<script setup lang="ts">
/**
 * خطةُ القسم الشهرية (طلب المستخدم 2026-10-30): أهدافٌ وأنشطةٌ بمواعيد ومسؤولين ونسبةُ إنجاز، وتقريرُ القسم آخر الشهر.
 * المدير الإداريّ يكتب كلَّ شيء؛ المدير الفنيّ والمديرة الإدارية ومشرف المشروع يقرؤونها كاملة؛ وكلُّ مسؤولٍ يرى أنشطته
 * ويحدّث حالتها. التذكيرُ في القاعدة: عند الإسناد، وقبل الموعد بيومين، وصباح يومه، والمتأخّرُ للمدير الإداريّ.
 */
import type { DeptGoal, DeptTask, TaskDraft } from '~/composables/useDeptPlan'
import type { SegmentTab } from '~/components/ui/SegmentTabs.vue'
import { DEPT_PLAN_FULL_VIEWERS, MAX_DEPT_GOALS, type DeptTaskStatus } from '~/constants/deptPlan'
import { filterTasks, isDueSoon, isOverdue, planMonthLabel, progressOf, shiftPlanMonth, type TaskFilter } from '~/utils/deptPlan'
import { gazaToday } from '~/utils/reportWindow'
import { deptPlanSheets } from '~/utils/excel/deptPlan'
import { downloadWorkbook } from '~/utils/excel/workbook'
import { ALL_OWNERS } from '~/constants/deptPlan'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'خطة القسم — ترجمان' })

const { role, isAdmin } = usePermissions()
const { profile } = useProfile()
const me = computed(() => profile.value?.id ?? null)
const fullView = computed(() => (DEPT_PLAN_FULL_VIEWERS as readonly string[]).includes(role.value ?? ''))

const today = gazaToday()
const route = useRoute()
const year = ref(Number(route.query.y) || Number(today.slice(0, 4)))
const month = ref(Number(route.query.m) || Number(today.slice(5, 7)))
function go(by: number) {
  const n = shiftPlanMonth(year.value, month.value, by)
  year.value = n.year
  month.value = n.month
}

const api = useDeptPlan(year, month)
const { plan, goals, tasks, staff, loading, busy } = api
watch([year, month], () => void api.load())
onMounted(() => {
  void api.load()
  void api.loadStaff()
})
const names = computed(() => Object.fromEntries(staff.value.map(s => [s.id, s.name])))

const filter = ref<TaskFilter>('all')
// الدورُ قد يصل بعد أوّل رسم: من لا يرى الخطة كاملة يبدأ بمهامّه
watch(role, (r) => {
  if (r) filter.value = fullView.value ? 'all' : 'mine'
}, { immediate: true })
// تصفيةٌ بالمسؤول (طلب المستخدم 2026-10-30)، وتُطبَّق قبل تبويبات الحالة
const owner = ref<string>(ALL_OWNERS)
watch([year, month], () => (owner.value = ALL_OWNERS))
const byOwner = computed(() => owner.value === ALL_OWNERS ? tasks.value : tasks.value.filter(t => t.owners.includes(owner.value)))
const filterTabs = computed<SegmentTab<TaskFilter>[]>(() => [
  { key: 'all', label: 'الكل', icon: 'i-lucide-list', count: byOwner.value.length },
  { key: 'mine', label: 'مهامي', icon: 'i-lucide-user-check', count: filterTasks(byOwner.value, 'mine', today, me.value).length || undefined },
  { key: 'overdue', label: 'متأخّر', icon: 'i-lucide-clock-alert', count: filterTasks(byOwner.value, 'overdue', today, null).length || undefined },
  { key: 'soon', label: 'قريب الموعد', icon: 'i-lucide-alarm-clock', count: filterTasks(byOwner.value, 'soon', today, null).length || undefined },
  { key: 'done', label: 'منجز', icon: 'i-lucide-circle-check' }
])
const shown = computed(() => filterTasks(byOwner.value, filter.value, today, me.value))
const taskIndex = computed(() => {
  const idx: Record<string, number> = {}
  for (const g of goals.value) tasks.value.filter(t => t.goal_id === g.id).forEach((t, i) => (idx[t.id] = i))
  return idx
})
const visibleGoals = computed(() => goals.value
  .map((g, i) => ({ g, i, list: shown.value.filter(t => t.goal_id === g.id) }))
  .filter(x => (filter.value === 'all' && owner.value === ALL_OWNERS) || x.list.length))

const progress = computed(() => progressOf(tasks.value))
const summary = computed(() => ({
  ...progress.value,
  active: tasks.value.filter(t => t.status === 'in_progress').length,
  soon: tasks.value.filter(t => isDueSoon(t, today)).length,
  late: tasks.value.filter(t => isOverdue(t, today)).length
}))

// ── النوافذ ──
const goalModal = reactive({ open: false, id: '' as string, title: '' })
function openGoal(g?: DeptGoal) {
  Object.assign(goalModal, { open: true, id: g?.id ?? '', title: g?.title ?? '' })
}
async function saveGoal() {
  if (await api.saveGoal(goalModal.title, goalModal.id || undefined)) goalModal.open = false
}
const taskModal = reactive({ open: false, task: null as DeptTask | null, goalId: null as string | null })
function openTask(task: DeptTask | null, goalId: string | null = null) {
  Object.assign(taskModal, { open: true, task, goalId })
}
async function saveTask(d: TaskDraft, id?: string) {
  if (await api.saveTask(d, id)) taskModal.open = false
}
const statusModal = reactive({ open: false, task: null as DeptTask | null })
async function saveStatus(id: string, status: DeptTaskStatus, notes: string) {
  if (await api.updateStatus(id, status, notes)) statusModal.open = false
}
const confirm = reactive({ open: false, title: '', message: '', run: async () => true as boolean })
function askRemoveGoal(g: DeptGoal) {
  Object.assign(confirm, { open: true, title: 'حذف الهدف', message: `سيُحذف «${g.title}» وجميع أنشطته.`, run: () => api.removeGoal(g.id) })
}
function askRemoveTask(t: DeptTask) {
  Object.assign(confirm, { open: true, title: 'حذف النشاط', message: `سيُحذف «${t.title}».`, run: () => api.removeTask(t.id) })
}
async function runConfirm() {
  if (await confirm.run()) confirm.open = false
}

const exporting = ref(false)
async function exportPlan() {
  if (!plan.value) return
  exporting.value = true
  await downloadWorkbook(`ترجمان — خطة القسم — ${planMonthLabel(year.value, month.value)}.xlsx`, deptPlanSheets(plan.value, goals.value, tasks.value, names.value))
  exporting.value = false
}
</script>

<template>
  <main class="page">
    <UiPageHeader
      title="خطة القسم"
      :subtitle="fullView ? 'أهداف القسم وأنشطته لكل شهر، ومتابعة إنجازها' : 'المهام المسندة إليك في خطة القسم'"
    />

    <div class="bar">
      <PlanMonthNav
        :label="planMonthLabel(year, month)"
        @go="go"
      />
      <div
        v-if="plan"
        class="tools"
      >
        <UButton
          v-if="isAdmin && goals.length < MAX_DEPT_GOALS"
          label="هدف جديد"
          icon="i-lucide-plus"
          color="primary"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="openGoal()"
        />
        <UButton
          v-if="fullView"
          label="تصدير Excel"
          icon="i-lucide-file-spreadsheet"
          color="neutral"
          variant="outline"
          :loading="exporting"
          :ui="{ base: 'rounded-[12px] min-h-11' }"
          @click="exportPlan"
        />
      </div>
    </div>

    <UiSkeletonCard
      v-if="loading && !plan"
      :lines="4"
    />

    <template v-else-if="!plan">
      <UiEmptyState
        icon="i-lucide-target"
        :title="`لا خطة لشهر ${planMonthLabel(year, month)}`"
        :description="isAdmin ? 'أنشئ خطة جديدة، أو انسخ خطة الشهر السابق وعدّلها.' : 'لم تُكتب خطة هذا الشهر بعد، أو لا مهام مسندة إليك فيها.'"
      />
      <div
        v-if="isAdmin"
        class="start"
      >
        <UButton
          label="إنشاء خطة الشهر"
          icon="i-lucide-plus"
          color="primary"
          :loading="busy"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="api.createPlan()"
        />
        <UButton
          label="نسخ خطة الشهر السابق"
          icon="i-lucide-copy"
          color="neutral"
          variant="outline"
          :loading="busy"
          :ui="{ base: 'rounded-[12px] min-h-11' }"
          @click="api.copyFromPrevious()"
        />
      </div>
    </template>

    <template v-else>
      <PlanSummary
        v-bind="summary"
        @filter="(f: TaskFilter) => (filter = f)"
      />
      <div
        class="toolbar"
        role="group"
        aria-label="تصفية الأنشطة"
      >
        <UiSegmentTabs
          v-model="filter"
          :tabs="filterTabs"
          label="حالة الأنشطة"
          class="toolbar-tabs"
        />
        <PlanOwnerFilter
          v-if="fullView"
          v-model="owner"
          :tasks="tasks"
          :names="names"
          :shown="shown.length"
        />
      </div>
      <div class="goals">
        <PlanGoalCard
          v-for="x in visibleGoals"
          :key="x.g.id"
          :goal="x.g"
          :index="x.i"
          :tasks="x.list"
          :all-tasks="tasks.filter(t => t.goal_id === x.g.id)"
          :task-index="taskIndex"
          :names="names"
          :today="today"
          :me="me"
          :can-edit="isAdmin"
          @edit-goal="openGoal"
          @remove-goal="askRemoveGoal"
          @add-task="(id: string) => openTask(null, id)"
          @edit-task="(t: DeptTask) => openTask(t)"
          @remove-task="askRemoveTask"
          @status="(t: DeptTask) => Object.assign(statusModal, { open: true, task: t })"
        />
        <UiEmptyState
          v-if="!visibleGoals.length"
          icon="i-lucide-list-checks"
          :title="goals.length ? 'لا أنشطة في هذا التصنيف' : 'لا أهداف بعد'"
          :description="isAdmin && !goals.length ? 'ابدأ بإضافة هدف، ثم أنشطته.' : undefined"
        />
      </div>
      <PlanReportPanel
        v-if="fullView"
        :plan="plan"
        :can-edit="isAdmin"
        :busy="busy"
        @save="api.saveReport"
      />
    </template>

    <PlanGoalModal
      v-model:open="goalModal.open"
      v-model:title="goalModal.title"
      :editing="!!goalModal.id"
      :busy="busy"
      @save="saveGoal"
    />
    <PlanTaskModal
      v-model:open="taskModal.open"
      :task="taskModal.task"
      :goal-id="taskModal.goalId"
      :goals="goals"
      :staff="staff"
      :year="year"
      :month="month"
      :busy="busy"
      @save="saveTask"
    />
    <PlanStatusModal
      v-model:open="statusModal.open"
      :task="statusModal.task"
      :busy="busy"
      @save="saveStatus"
    />
    <UiConfirmModal
      v-model:open="confirm.open"
      :title="confirm.title"
      :message="confirm.message"
      :loading="busy"
      @confirm="runConfirm"
    />
  </main>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 18px; }
.bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
.tools, .start { display: flex; flex-wrap: wrap; gap: 8px; }
.start { justify-content: center; }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; }
.toolbar-tabs { flex: 0 1 auto; max-width: 100%; min-width: 0; margin-bottom: 0; overflow-x: auto; scrollbar-width: none; }
.toolbar-tabs::-webkit-scrollbar { display: none; }
@media (max-width: 640px) {
  .toolbar-tabs { flex: 1 1 100%; }
}
.goals { display: flex; flex-direction: column; gap: 14px; }
</style>
