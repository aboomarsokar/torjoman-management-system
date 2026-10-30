<script setup lang="ts">
/**
 * قائمةُ طلاب اليوم في «الحضور اليوميّ»: ملخّصُ (حضر · بعذر · بلا عذر) وصفٌّ لكلّ طالبٍ بمفتاح حالته. الجميعُ حاضرٌ افتراضاً
 * والمسوّدةُ تحمل الغياباتِ وحدَها؛ التعديلُ يصعد إلى الصفحة.
 */
import type { AbsenceKind, AttendanceChoice } from '~/composables/useAttendanceDay'

const props = defineProps<{
  students: { id: string, full_name: string }[]
  /** مسوّدةُ الغيابات: طالبٌ ← نوعُ غيابه، وغيابُه من القائمة = حاضر. */
  draft: Record<string, AbsenceKind>
  disabled: boolean
}>()
const emit = defineEmits<{ set: [studentId: string, kind: AttendanceChoice] }>()

const summary = computed(() => summarizeDay(props.students, props.draft))
const summaryText = computed(() => `حضر ${summary.value.present} · بعذر ${summary.value.excused} · بلا عذر ${summary.value.unexcused}`)
</script>

<template>
  <div>
    <p
      class="summary"
      aria-live="polite"
    >
      {{ summaryText }}
    </p>
    <ul class="card list">
      <li
        v-for="s in students"
        :key="s.id"
        class="row"
      >
        <span class="name">{{ s.full_name }}</span>
        <AttendanceStatusSegment
          :model-value="draft[s.id] ?? 'present'"
          :name="s.full_name"
          :disabled="disabled"
          @update:model-value="emit('set', s.id, $event)"
        />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); padding: 20px; margin-bottom: 16px; }
.summary { margin: 0 4px 12px; font-size: 15px; font-weight: 600; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.list { list-style: none; margin: 0; padding: 6px 20px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 10px 0; }
.row + .row { border-top: 1px solid var(--line); }
.name { font-size: 15.5px; font-weight: 600; color: var(--ink); min-width: 0; }
@media (max-width: 520px) {
  .row { flex-direction: column; align-items: stretch; gap: 8px; }
}
</style>
