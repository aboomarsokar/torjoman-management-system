<script setup lang="ts">
/**
 * نشاطٌ في بطاقة هدفٍ من خطة القسم: شارةُ ترقيمه («1-2»)، وشريطٌ على طرفه بلون حالته، والعنوانُ والمسؤولون والموعد
 * (المتأخّرُ أحمر والقريبُ أصفر)، والملاحظة، وزرُّ الحالة ظاهراً، والتعديلُ والحذفُ في قائمة «⋯» للمدير الإداريّ.
 */
import type { DropdownMenuItem } from '@nuxt/ui'
import type { DeptTask } from '~/composables/useDeptPlan'
import { DEPT_TASK_STATUS_COLOR, DEPT_TASK_STATUS_ICON, DEPT_TASK_STATUS_LABEL } from '~/constants/deptPlan'
import { isDueSoon, isOverdue, shortDay } from '~/utils/deptPlan'

interface Props {
  task: DeptTask
  label: string
  ownerNames: string
  today: string
  canUpdate: boolean
  canEdit: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{ status: [], edit: [], remove: [] }>()

const flag = computed(() => isOverdue(props.task, props.today) ? 'overdue' : isDueSoon(props.task, props.today) ? 'soon' : '')
const menu = computed<DropdownMenuItem[]>(() => [
  { label: 'تعديل النشاط', icon: 'i-lucide-pencil', onSelect: () => emit('edit') },
  { label: 'حذف النشاط', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => emit('remove') }
])
</script>

<template>
  <li
    class="ti"
    :class="`is-${task.status}`"
  >
    <span class="ti-no">{{ label }}</span>
    <div class="ti-body">
      <p class="ti-ttl">
        {{ task.title }}
      </p>
      <p class="ti-meta">
        <span><UIcon
          name="i-lucide-user"
          class="size-3.5"
        /> {{ ownerNames }}</span>
        <span :class="flag"><UIcon
          name="i-lucide-calendar"
          class="size-3.5"
        /> {{ shortDay(task.due_on) }}<template v-if="flag === 'overdue'"> · متأخّر</template><template v-else-if="flag === 'soon'"> · قريب</template></span>
      </p>
      <p
        v-if="task.notes"
        class="ti-notes"
      >
        {{ task.notes }}
      </p>
    </div>
    <div class="ti-actions">
      <UButton
        :label="DEPT_TASK_STATUS_LABEL[task.status]"
        :icon="DEPT_TASK_STATUS_ICON[task.status]"
        :color="DEPT_TASK_STATUS_COLOR[task.status]"
        variant="soft"
        size="sm"
        :disabled="!canUpdate"
        :ui="{ base: 'rounded-full min-h-11 font-semibold' }"
        :aria-label="canUpdate ? `تحديث الحالة: ${DEPT_TASK_STATUS_LABEL[task.status]}` : DEPT_TASK_STATUS_LABEL[task.status]"
        @click="emit('status')"
      />
      <UDropdownMenu
        v-if="canEdit"
        :items="menu"
        :content="{ align: 'end' }"
      >
        <UButton
          icon="i-lucide-ellipsis-vertical"
          color="neutral"
          variant="ghost"
          aria-label="خيارات النشاط"
          :ui="{ base: 'min-h-11 min-w-11 justify-center' }"
        />
      </UDropdownMenu>
    </div>
  </li>
</template>

<style scoped>
.ti {
  display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: start;
  padding: 12px 14px; border-top: 1px solid var(--line); box-shadow: inset -3px 0 0 var(--stripe);
  --stripe: var(--line-2);
}
.ti.is-in_progress { --stripe: var(--blue); }
.ti.is-done { --stripe: var(--green); }
.ti.is-not_done { --stripe: var(--err); }
.ti-no {
  min-width: 34px; padding: 2px 8px; border-radius: 8px; background: var(--surface-3); color: var(--ink-3);
  font-size: 12px; font-weight: 600; text-align: center; font-variant-numeric: tabular-nums; margin-top: 2px;
}
.ti-body { min-width: 0; }
.ti-ttl { margin: 0; color: var(--ink); line-height: 1.7; }
.ti.is-done .ti-ttl { color: var(--ink-2); }
.ti-meta { margin: 2px 0 0; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12.5px; color: var(--ink-3); }
.ti-meta span { display: inline-flex; align-items: center; gap: 4px; }
.ti-meta .overdue { color: var(--err); font-weight: 600; }
.ti-meta .soon { color: var(--chip-warn-ink); font-weight: 600; }
.ti-notes { margin: 6px 0 0; font-size: 13px; color: var(--ink-2); background: var(--surface-3); border-radius: 8px; padding: 4px 10px; }
.ti-actions { display: flex; align-items: center; gap: 2px; }
@media (max-width: 640px) {
  .ti { grid-template-columns: auto 1fr; }
  .ti-actions { grid-column: 2; }
}
</style>
