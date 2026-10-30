<script setup lang="ts">
/** تقريرُ القسم آخر الشهر (الحقولُ الأربعة كملفّ الخطة): يكتبه المدير الإداريّ، ويقرؤه من يرى الخطة كاملة. */
import type { DeptPlan } from '~/composables/useDeptPlan'
import { DEPT_REPORT_FIELDS, MAX_REPORT_FIELD, type DeptReportKey } from '~/constants/deptPlan'

const props = defineProps<{ plan: DeptPlan, canEdit: boolean, busy: boolean }>()
const emit = defineEmits<{ save: [report: Record<DeptReportKey, string>] }>()

const blank = (): Record<DeptReportKey, string> => ({ report_achievements: '', report_not_done: '', report_obstacles: '', report_team_notes: '' })
const form = reactive(blank())
watch(() => props.plan, (p) => {
  for (const f of DEPT_REPORT_FIELDS) form[f.key] = p[f.key] ?? ''
}, { immediate: true })
const dirty = computed(() => DEPT_REPORT_FIELDS.some(f => form[f.key].trim() !== (props.plan[f.key] ?? '')))
</script>

<template>
  <section class="rp">
    <h2>تقرير القسم</h2>
    <p class="rp-sub">
      يُعبّأ آخر الشهر ويُرسل مع خطة الشهر الجديد.
    </p>
    <div class="rp-fields">
      <UFormField
        v-for="f in DEPT_REPORT_FIELDS"
        :key="f.key"
        :label="f.label"
        :hint="canEdit ? `${form[f.key].trim().length}/${MAX_REPORT_FIELD}` : undefined"
      >
        <UTextarea
          v-if="canEdit"
          v-model="form[f.key]"
          :rows="3"
          autoresize
          class="w-full"
          :maxlength="MAX_REPORT_FIELD"
        />
        <p
          v-else
          class="rp-read"
        >
          {{ plan[f.key] || '—' }}
        </p>
      </UFormField>
    </div>
    <UButton
      v-if="canEdit"
      label="احفظ التقرير"
      icon="i-lucide-check"
      color="primary"
      :loading="busy"
      :disabled="!dirty"
      :ui="{ base: 'rounded-[12px] min-h-11 font-semibold self-start' }"
      @click="emit('save', { ...form })"
    />
  </section>
</template>

<style scoped>
.rp { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 12px; }
.rp h2 { margin: 0; font-size: 17px; font-weight: 600; color: var(--ink); }
.rp-sub { margin: -6px 0 0; font-size: 13px; color: var(--ink-3); }
.rp-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 14px; }
.rp-read { margin: 0; white-space: pre-wrap; color: var(--ink-2); line-height: 1.8; }
</style>
