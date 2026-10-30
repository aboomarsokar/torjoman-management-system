<script setup lang="ts">
/** تحديثُ حالة نشاطٍ في خطة القسم وملاحظته — للمسؤول عنه وللمدير الإداريّ (`update_my_dept_task`). */
import type { DeptTask } from '~/composables/useDeptPlan'
import { DEPT_TASK_STATUSES, DEPT_TASK_STATUS_ICON, DEPT_TASK_STATUS_LABEL, MAX_TASK_NOTES, type DeptTaskStatus } from '~/constants/deptPlan'
import { shortDay } from '~/utils/deptPlan'

const props = defineProps<{ task: DeptTask | null, busy: boolean }>()
const emit = defineEmits<{ save: [id: string, status: DeptTaskStatus, notes: string] }>()
const open = defineModel<boolean>('open', { required: true })

const form = reactive<{ status: DeptTaskStatus, notes: string }>({ status: 'not_started', notes: '' })
watch(open, (o) => {
  if (o && props.task) Object.assign(form, { status: props.task.status, notes: props.task.notes ?? '' })
})
const needsReason = computed(() => form.status === 'not_done')
</script>

<template>
  <UModal
    v-model:open="open"
    title="تحديث حالة النشاط"
  >
    <template #body>
      <div
        v-if="task"
        class="sm"
      >
        <p class="sm-task">
          {{ task.title }}
          <span>الموعد {{ shortDay(task.due_on) }}</span>
        </p>
        <div
          class="sm-choices"
          role="radiogroup"
          aria-label="الحالة"
        >
          <button
            v-for="s in DEPT_TASK_STATUSES"
            :key="s"
            type="button"
            role="radio"
            :aria-checked="form.status === s"
            class="sm-choice"
            :class="[`is-${s}`, { on: form.status === s }]"
            @click="form.status = s"
          >
            <UIcon
              :name="DEPT_TASK_STATUS_ICON[s]"
              class="size-5"
            />
            {{ DEPT_TASK_STATUS_LABEL[s] }}
          </button>
        </div>
        <UFormField
          :label="needsReason ? 'سبب عدم الإتمام' : 'ملاحظة'"
          :hint="`${form.notes.trim().length}/${MAX_TASK_NOTES}`"
        >
          <UTextarea
            v-model="form.notes"
            :rows="2"
            autoresize
            class="w-full"
            :maxlength="MAX_TASK_NOTES"
            :placeholder="needsReason ? 'لماذا لم يتم النشاط؟' : 'اختيارية'"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="إلغاء"
          color="neutral"
          variant="ghost"
          :ui="{ base: 'rounded-[12px] min-h-11' }"
          @click="open = false"
        />
        <UButton
          label="احفظ"
          icon="i-lucide-check"
          color="primary"
          :loading="busy"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="task && emit('save', task.id, form.status, form.notes)"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.sm { display: flex; flex-direction: column; gap: 14px; }
.sm-task { margin: 0; font-weight: 600; line-height: 1.7; }
.sm-task span { display: block; font-weight: 400; font-size: 13px; color: var(--ink-3); }
.sm-choices { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.sm-choice {
  display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 14px;
  border: 1px solid var(--line); border-radius: 12px; background: var(--surface); color: var(--ink-2); font: inherit; font-weight: 600; cursor: pointer;
}
.sm-choice:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
.sm-choice.on.is-not_started { border-color: var(--ink-3); color: var(--ink); background: var(--surface-3); }
.sm-choice.on.is-in_progress { border-color: var(--blue); color: var(--blue-ink); background: var(--blue-soft); }
.sm-choice.on.is-done { border-color: var(--green); color: var(--green-ink); background: var(--green-soft); }
.sm-choice.on.is-not_done { border-color: var(--err); color: var(--err); background: var(--err-soft); }
</style>
