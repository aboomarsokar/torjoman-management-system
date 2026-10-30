<script setup lang="ts">
/**
 * إضافةُ نشاطٍ في خطة القسم أو تعديلُه (للمدير الإداريّ): الهدفُ والنشاطُ والموعدُ (داخل شهر الخطة) ومسؤولٌ أو أكثر
 * من العاملين — المُضافُ يصله إشعارُ الإسناد.
 */
import type { DeptGoal, DeptTask, StaffOption, TaskDraft } from '~/composables/useDeptPlan'
import { MAX_TASK_TITLE } from '~/constants/deptPlan'
import { roleLabel } from '~/constants/roles'
import { dueRange, goalLabel } from '~/utils/deptPlan'

interface Props {
  task: DeptTask | null
  goalId: string | null
  goals: DeptGoal[]
  staff: StaffOption[]
  year: number
  month: number
  busy: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{ save: [draft: TaskDraft, id?: string] }>()
const open = defineModel<boolean>('open', { required: true })

const form = reactive<TaskDraft>({ goalId: '', title: '', dueOn: '', owners: [] })
watch(open, (o) => {
  if (!o) return
  const t = props.task
  Object.assign(form, t
    ? { goalId: t.goal_id, title: t.title, dueOn: t.due_on, owners: [...t.owners] }
    : { goalId: props.goalId ?? props.goals[0]?.id ?? '', title: '', dueOn: '', owners: [] })
})
const range = computed(() => dueRange(props.year, props.month))
const goalItems = computed(() => props.goals.map((g, i) => ({ label: `${goalLabel(i)} — ${g.title}`, value: g.id })))
const staffItems = computed(() => props.staff.map(s => ({ label: `${s.name} · ${roleLabel(s.role, s.gender)}`, value: s.id })))
</script>

<template>
  <UModal
    v-model:open="open"
    :title="task ? 'تعديل النشاط' : 'نشاط جديد'"
  >
    <template #body>
      <div class="tm">
        <UFormField label="الهدف">
          <UiSelect
            v-model="form.goalId"
            :items="goalItems"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="النشاط"
          :hint="`${form.title.trim().length}/${MAX_TASK_TITLE}`"
        >
          <UTextarea
            v-model="form.title"
            :rows="2"
            autoresize
            class="w-full"
            :maxlength="MAX_TASK_TITLE"
            placeholder="مثال: تجهيز 100 سؤال لكتاب اليوم النبوي"
          />
        </UFormField>
        <UFormField label="الموعد">
          <UInput
            v-model="form.dueOn"
            type="date"
            :min="range.min"
            :max="range.max"
            dir="ltr"
            size="xl"
            class="w-full"
            :ui="{ base: 'rounded-[12px] min-h-12' }"
          />
        </UFormField>
        <UFormField
          label="المسؤول"
          hint="يمكن اختيار أكثر من مسؤول"
        >
          <USelectMenu
            v-model="form.owners"
            :items="staffItems"
            value-key="value"
            multiple
            placeholder="اختر من العاملين"
            :search-input="{ placeholder: 'ابحث بالاسم' }"
            class="w-full"
            :ui="{ base: 'rounded-[12px] min-h-12' }"
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
          @click="emit('save', { ...form, owners: [...form.owners] }, task?.id)"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.tm { display: flex; flex-direction: column; gap: 14px; }
</style>
