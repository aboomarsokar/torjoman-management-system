<script setup lang="ts">
/**
 * هدفٌ في خطة القسم وأنشطتُه: رقمُه ونسبةُ إنجازه، ولكلّ نشاطٍ ترقيمُه («٣-٢») وموعدُه ومسؤولوه وحالتُه وملاحظته.
 * المتأخّرُ يُعلَّم بالأحمر وقريبُ الموعد بالأصفر. أزرارُ الكتابة بحسب ما يحقّ للمشاهد.
 */
import type { DeptGoal, DeptTask } from '~/composables/useDeptPlan'
import { DEPT_TASK_STATUS_COLOR, DEPT_TASK_STATUS_ICON, DEPT_TASK_STATUS_LABEL } from '~/constants/deptPlan'
import { goalLabel, isDueSoon, isOverdue, progressOf, shortDay, taskLabel } from '~/utils/deptPlan'

interface Props {
  goal: DeptGoal
  index: number
  tasks: DeptTask[]
  /** ترتيبُ كلّ نشاطٍ بين أنشطة هدفه كلّها (لا المعروضة فقط بعد التصفية). */
  taskIndex: Record<string, number>
  names: Record<string, string>
  today: string
  me: string | null
  canEdit: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{
  editGoal: [goal: DeptGoal]
  removeGoal: [goal: DeptGoal]
  addTask: [goalId: string]
  editTask: [task: DeptTask]
  removeTask: [task: DeptTask]
  status: [task: DeptTask]
}>()

const progress = computed(() => progressOf(props.tasks))
const canUpdate = (t: DeptTask) => props.canEdit || (!!props.me && t.owners.includes(props.me))
const ownerNames = (t: DeptTask) => t.owners.map(id => props.names[id] ?? '—').join('، ') || 'بلا مسؤول'
const flag = (t: DeptTask) => isOverdue(t, props.today) ? 'overdue' : isDueSoon(t, props.today) ? 'soon' : ''
</script>

<template>
  <article class="gc">
    <header class="gc-h">
      <div class="gc-title">
        <span class="gc-no">{{ goalLabel(index) }}</span>
        <h3>{{ goal.title }}</h3>
      </div>
      <div class="gc-side">
        <span class="gc-pct">{{ progress.done }} من {{ progress.total }} ({{ progress.pct }}%)</span>
        <template v-if="canEdit">
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="تعديل الهدف"
            :ui="{ base: 'min-h-11 min-w-11 justify-center' }"
            @click="emit('editGoal', goal)"
          />
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="sm"
            aria-label="حذف الهدف"
            :ui="{ base: 'min-h-11 min-w-11 justify-center' }"
            @click="emit('removeGoal', goal)"
          />
        </template>
      </div>
    </header>
    <div class="gc-bar">
      <i :style="{ width: progress.pct + '%' }" />
    </div>

    <ul class="gc-tasks">
      <li
        v-for="t in tasks"
        :key="t.id"
        class="gc-task"
        :class="flag(t)"
      >
        <span class="gc-tno">{{ taskLabel(index, taskIndex[t.id] ?? 0) }}</span>
        <div class="gc-body">
          <p class="gc-ttl">
            {{ t.title }}
          </p>
          <p class="gc-meta">
            <span><UIcon
              name="i-lucide-user"
              class="size-3.5"
            /> {{ ownerNames(t) }}</span>
            <span :class="flag(t)"><UIcon
              name="i-lucide-calendar"
              class="size-3.5"
            /> {{ shortDay(t.due_on) }}<template v-if="flag(t) === 'overdue'"> · متأخّر</template><template v-else-if="flag(t) === 'soon'"> · قريب</template></span>
          </p>
          <p
            v-if="t.notes"
            class="gc-notes"
          >
            {{ t.notes }}
          </p>
        </div>
        <div class="gc-actions">
          <UButton
            :label="DEPT_TASK_STATUS_LABEL[t.status]"
            :icon="DEPT_TASK_STATUS_ICON[t.status]"
            :color="DEPT_TASK_STATUS_COLOR[t.status]"
            variant="soft"
            size="sm"
            :disabled="!canUpdate(t)"
            :ui="{ base: 'rounded-full min-h-11 font-semibold' }"
            :aria-label="canUpdate(t) ? `تحديث الحالة: ${DEPT_TASK_STATUS_LABEL[t.status]}` : DEPT_TASK_STATUS_LABEL[t.status]"
            @click="emit('status', t)"
          />
          <template v-if="canEdit">
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="تعديل النشاط"
              :ui="{ base: 'min-h-11 min-w-11 justify-center' }"
              @click="emit('editTask', t)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              aria-label="حذف النشاط"
              :ui="{ base: 'min-h-11 min-w-11 justify-center' }"
              @click="emit('removeTask', t)"
            />
          </template>
        </div>
      </li>
      <li
        v-if="!tasks.length"
        class="gc-empty"
      >
        لا أنشطة هنا.
      </li>
    </ul>

    <UButton
      v-if="canEdit"
      label="نشاط جديد"
      icon="i-lucide-plus"
      color="neutral"
      variant="ghost"
      :ui="{ base: 'rounded-[12px] min-h-11 self-start' }"
      @click="emit('addTask', goal.id)"
    />
  </article>
</template>

<style scoped>
.gc { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.gc-h { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
.gc-title { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.gc-no { font-size: 12.5px; font-weight: 600; color: var(--blue-ink); }
.gc-title h3 { margin: 0; font-size: 16px; font-weight: 600; color: var(--ink); line-height: 1.6; text-wrap: balance; }
.gc-side { display: flex; align-items: center; gap: 4px; }
.gc-pct { font-size: 13px; color: var(--ink-3); font-variant-numeric: tabular-nums; margin-inline-end: 6px; white-space: nowrap; }
.gc-bar { height: 6px; border-radius: 99px; background: var(--surface-3); overflow: hidden; }
.gc-bar i { display: block; height: 100%; background: var(--green); border-radius: 99px; transition: width .3s var(--ease-out); }
.gc-tasks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.gc-task { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: start; padding: 10px 0; border-top: 1px solid var(--line); }
.gc-task.overdue { box-shadow: inset -3px 0 0 var(--err); padding-inline-start: 8px; }
.gc-task.soon { box-shadow: inset -3px 0 0 var(--chip-warn-ink); padding-inline-start: 8px; }
.gc-tno { font-size: 12.5px; font-weight: 600; color: var(--ink-3); min-width: 30px; padding-top: 3px; font-variant-numeric: tabular-nums; }
.gc-body { min-width: 0; }
.gc-ttl { margin: 0; color: var(--ink); line-height: 1.7; }
.gc-meta { margin: 2px 0 0; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12.5px; color: var(--ink-3); }
.gc-meta span { display: inline-flex; align-items: center; gap: 4px; }
.gc-meta .overdue { color: var(--err); font-weight: 600; }
.gc-meta .soon { color: var(--chip-warn-ink); font-weight: 600; }
.gc-notes { margin: 4px 0 0; font-size: 13px; color: var(--ink-2); background: var(--surface-3); border-radius: 8px; padding: 4px 10px; }
.gc-actions { display: flex; align-items: center; gap: 2px; }
.gc-empty { padding: 10px 0; border-top: 1px solid var(--line); color: var(--ink-3); font-size: 13px; }
@media (max-width: 640px) {
  .gc-task { grid-template-columns: auto 1fr; }
  .gc-actions { grid-column: 2; }
}
</style>
